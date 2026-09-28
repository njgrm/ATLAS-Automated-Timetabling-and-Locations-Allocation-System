<#
.SYNOPSIS
    Shared helpers for the ATLAS staging lane (Lane A4). Read-only or
    non-destructive helpers only; the mutating scripts own their own guards.

.DESCRIPTION
    Every helper here obeys two ATLAS rules that are cheap to state and expensive
    to learn twice:

      1. No credential value is ever returned to a caller's output stream.
         `Get-PgConnection` returns a password *object property* for in-process
         injection into $env:PGPASSWORD only. Callers must never Write-Output it,
         never place it in a ConvertTo-Json payload, and never log it. Everything
         else in this module reports key NAMES and counts, never values.

      2. Live and staging share one machine-scope namespace for
         ATLAS_RUNTIME_SOURCE_DIR / ATLAS_RUNTIME_RELEASE_SHA /
         ATLAS_RUNTIME_ENV_FILE, so the staging runtime must never write machine
         scope. Get-StagingLaunchEnvironment returns the three values for a
         CHILD PROCESS ONLY; nothing in this module calls
         [Environment]::SetEnvironmentVariable(...,'Machine').
#>

Set-StrictMode -Version Latest

function Invoke-PgPipeline {
    <#
    .SYNOPSIS
        Run `pg_dump -Fc | pg_restore` as a binary-safe streaming pipeline.
    .DESCRIPTION
        The archive is piped straight into pg_restore and NEVER lands on disk. A
        `pg_dump -Fc` of the live database contains JWT_SECRET, ATLAS_SYSTEM_TOKEN,
        the SSO client secrets, the EnrollPro service token and password hashes, so
        materialising it as a file is a credential-at-rest exposure that no
        stdout scrub covers.

        PowerShell 5.1 mangles binary data when it pumps one native process into
        another, so the pipeline is executed by cmd.exe, which passes bytes
        through untouched. PGPASSWORD/PGUSER/PGHOST/PGPORT are set in the parent
        process environment and inherited by both children, so the credential
        never appears on a command line.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $PgBin,
        [Parameter(Mandatory)][string[]] $DumpArguments,
        [Parameter(Mandatory)][string[]] $RestoreArguments,
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $EnvMap
    )

    $dump    = Join-Path $PgBin 'pg_dump.exe'
    $restore = Join-Path $PgBin 'pg_restore.exe'
    foreach ($tool in $dump, $restore) { if (-not (Test-Path -LiteralPath $tool)) { throw "PG_TOOL_MISSING: $tool" } }

    $conn = Get-PgConnection $EnvMap
    $previous = @{ PGPASSWORD = $env:PGPASSWORD; PGUSER = $env:PGUSER; PGHOST = $env:PGHOST; PGPORT = $env:PGPORT }
    try {
        $env:PGPASSWORD = $conn.Password
        $env:PGUSER     = $conn.User
        $env:PGHOST     = $conn.Host
        $env:PGPORT     = [string]$conn.Port
        $quote = { param($a) if ($a -match '[\s"]') { '"' + $a + '"' } else { $a } }
        $left  = (@($dump)    + $DumpArguments)    | ForEach-Object { & $quote $_ }
        $right = (@($restore) + $RestoreArguments) | ForEach-Object { & $quote $_ }
        $line  = ($left -join ' ') + ' | ' + ($right -join ' ')
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { $out = & cmd.exe /d /c $line 2>&1 } finally { $ErrorActionPreference = $previousPreference }
    } finally {
        $env:PGPASSWORD = $previous.PGPASSWORD
        $env:PGUSER     = $previous.PGUSER
        $env:PGHOST     = $previous.PGHOST
        $env:PGPORT     = $previous.PGPORT
    }
    if ($LASTEXITCODE -ne 0) {
        $text = (($out | Select-Object -Last 12) -join "`n") -replace [regex]::Escape($conn.Password), '***'
        throw "pg_dump|pg_restore failed (exit $LASTEXITCODE): $text"
    }
}

function Get-AtlasScalar {
    <#
    .SYNOPSIS
        Read one scalar from psql, selected BY SHAPE rather than by stream index.
    .DESCRIPTION
        psql writes NOTICE/WARNING lines to stderr, and this caller merges stderr
        into stdout. Indexing that merged stream would silently parse a NOTICE as
        the answer, which is exactly how a live-signature zero-write check becomes
        a false pass. Select the first line that matches the expected shape.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)][string[]] $Lines,
        [Parameter(Mandatory)][string] $Pattern
    )
    foreach ($line in $Lines) {
        $t = ([string]$line).Trim()
        if ($t -match $Pattern) { return $t }
    }
    throw "SCALAR_NOT_FOUND: no line matched '$Pattern'. Lines: $(($Lines | Select-Object -First 8) -join ' | ')"
}

function Get-AtlasEnvMap {
    <#
    .SYNOPSIS
        Parse a dotenv-format ATLAS env file into an ordered key -> value map.
    .NOTES
        Mirrors ops/runtime/lib/contract.mjs parseEnvFile: no interpolation,
        optional surrounding quotes stripped, comments and blank lines skipped.
    #>
    [CmdletBinding()]
    [OutputType([System.Collections.Specialized.OrderedDictionary])]
    param(
        [Parameter(Mandatory)][string] $Path,
        [switch] $ValuesOnly
    )

    if (-not (Test-Path -LiteralPath $Path)) { throw "ENV_FILE_MISSING: $Path" }
    $map = [ordered]@{}
    foreach ($raw in [System.IO.File]::ReadAllLines($Path)) {
        $line = $raw.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        $eq = $line.IndexOf('=')
        if ($eq -le 0) { continue }
        $key = $line.Substring(0, $eq).Trim()
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
        $value = $line.Substring($eq + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $map[$key] = $value
    }
    if ($ValuesOnly) { return $map }
    return $map
}

function Get-PgConnection {
    <#
    .SYNOPSIS
        Derive a PostgreSQL connection descriptor from a DATABASE_URL.
    .DESCRIPTION
        Returns Host, Port, User, Database and a `Password` property intended
        ONLY for in-process assignment to $env:PGPASSWORD. The caller is
        responsible for clearing it. Callers MUST NOT serialise this object.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $EnvMap
    )

    $raw = $EnvMap['DATABASE_URL']
    if ([string]::IsNullOrWhiteSpace($raw)) { throw 'DATABASE_URL_MISSING' }
    $uri = [Uri]$raw
    $userInfo = $uri.UserInfo -split ':', 2
    $user = [Uri]::UnescapeDataString($userInfo[0])
    $password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
    if ([string]::IsNullOrEmpty($user) -or [string]::IsNullOrEmpty($password)) {
        throw 'DATABASE_URL_MISSING_USER_OR_PASSWORD'
    }
    [pscustomobject]@{
        Host     = $uri.Host
        Port     = $uri.Port
        User     = $user
        Password = $password
        Database = $uri.AbsolutePath.TrimStart('/')
    }
}

function Invoke-PgTool {
    <#
    .SYNOPSIS
        Run a PostgreSQL client tool with the connection injected from an env map.
    .DESCRIPTION
        Injects PGPASSWORD/PGUSER/PGHOST/PGPORT into the CHILD environment, runs
        the tool, and clears them afterwards. Tool output is returned as text. The
        password is never placed on a command line, so it cannot appear in a
        process listing or in a transcript.
    #>
    [CmdletBinding()]
    [OutputType([string[]])]
    param(
        [Parameter(Mandatory)][string] $PgBin,
        [Parameter(Mandatory)][string] $Tool,
        [Parameter(Mandatory)][string[]] $Arguments,
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $EnvMap,
        [string] $Database = ''
    )

    $exe = Join-Path $PgBin $Tool
    if (-not (Test-Path -LiteralPath $exe)) { throw "PG_TOOL_MISSING: $exe" }
    $conn = Get-PgConnection $EnvMap
    $db = if ($Database) { $Database } else { $conn.Database }

    $previous = @{
        PGPASSWORD = $env:PGPASSWORD
        PGUSER     = $env:PGUSER
        PGHOST     = $env:PGHOST
        PGPORT     = $env:PGPORT
    }
    try {
        $env:PGPASSWORD = $conn.Password
        $env:PGUSER     = $conn.User
        $env:PGHOST     = $conn.Host
        $env:PGPORT     = [string]$conn.Port
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $out = & $exe @Arguments 2>&1
        } finally {
            $ErrorActionPreference = $previousPreference
        }
    } finally {
        $env:PGPASSWORD = $previous.PGPASSWORD
        $env:PGUSER     = $previous.PGUSER
        $env:PGHOST     = $previous.PGHOST
        $env:PGPORT     = $previous.PGPORT
    }
    if ($LASTEXITCODE -ne 0) {
        $text = ($out -join "`n")
        # A failed pg tool can echo the connection string; scrub before surfacing.
        $text = $text -replace [regex]::Escape($conn.Password), '***'
        throw "$Tool failed (exit $LASTEXITCODE): $text"
    }
    return @($out | ForEach-Object { [string]$_ })
}

function New-PostgresUrl {
    <#
    .SYNOPSIS
        Build a DATABASE_URL for a different database on the SAME server,
        preserving the existing user and password.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $EnvMap,
        [Parameter(Mandatory)][string] $Database
    )
    $conn = Get-PgConnection $EnvMap
    $user = [Uri]::EscapeDataString($conn.User)
    $pass = [Uri]::EscapeDataString($conn.Password)
    return "postgresql://${user}:${pass}@$($conn.Host):$($conn.Port)/$Database"
}

function New-StagingEnvMap {
    <#
    .SYNOPSIS
        Produce the staging env map from the live env map, changing only the keys
        the staging isolation contract requires.
    .DESCRIPTION
        Changed, and why:
          DATABASE_URL  -> the staging database. This is the primary isolation
                           control: staging cannot write the live database.
          JWT_SECRET    -> a fresh 32-byte random secret. Staging tokens are then
                           not accepted by live and live tokens are not accepted
                           by staging, so an ATLAS session cannot be replayed
                           across the two origins.
          PORT          -> the staging API port. The supervisor target actually
                           forces PORT from the contract, but the env file is kept
                           truthful so an operator reading it is never misled.
          CLIENT_URL and CORS_EXTRA_ORIGINS -> the staging origin. Without this
                           the staging client host would be refused by the
                           staging server's own CORS/origin checks, so a browser
                           row could never pass.

        Deliberately UNCHANGED: ENROLLPRO_* and the companion SSO secrets. The
        packet requires staging to read EnrollPro/SMART/AIMS with the same keys
        and never write; those are read-only companion credentials.

        The caller receives the map and a list of changed key NAMES. No value is
        ever logged by this function.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $LiveMap,
        [Parameter(Mandatory)][string] $StagingDatabase,
        [Parameter(Mandatory)][int] $ServerPort,
        [Parameter(Mandatory)][int] $ClientPort,
        [Parameter(Mandatory)][string] $EnrollProOrigin
    )

    foreach ($required in 'DATABASE_URL', 'JWT_SECRET') {
        if (-not $LiveMap.Contains($required) -or [string]::IsNullOrWhiteSpace($LiveMap[$required])) {
            throw "LIVE_ENV_MISSING_REQUIRED_KEY: $required"
        }
    }

    $staging = [ordered]@{}
    foreach ($key in $LiveMap.Keys) { $staging[$key] = $LiveMap[$key] }

    $clientOrigin = "http://127.0.0.1:$ClientPort"

    # 32 bytes of CSPRNG output, hex encoded. Never echoed.
    $secretBytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretBytes)
    $newSecret = -join ($secretBytes | ForEach-Object { $_.ToString('x2') })

    $staging['DATABASE_URL'] = New-PostgresUrl -EnvMap $LiveMap -Database $StagingDatabase
    $staging['JWT_SECRET']   = $newSecret
    $staging['PORT']         = [string]$ServerPort
    $staging['CLIENT_URL']   = $clientOrigin

    # The companion proxy origin is a real control, so -EnrollProOrigin must
    # actually reach the environment instead of being accepted and discarded.
    # It is applied only when non-empty; the default caller passes the live value
    # so staging can never silently diverge from what the client bundle was built
    # against.
    if (-not [string]::IsNullOrWhiteSpace($EnrollProOrigin)) {
        $staging['ENROLLPRO_PROXY_ORIGIN'] = $EnrollProOrigin
    }

    # CORS: keep every origin the live file already allowed, and add staging's
    # own origin, so staging is reachable and nothing that works today regresses.
    $existing = @()
    if ($staging.Contains('CORS_EXTRA_ORIGINS') -and -not [string]::IsNullOrWhiteSpace($staging['CORS_EXTRA_ORIGINS'])) {
        $existing = @($staging['CORS_EXTRA_ORIGINS'] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    }
    if ($existing -notcontains $clientOrigin) { $existing += $clientOrigin }
    $staging['CORS_EXTRA_ORIGINS'] = ($existing -join ',')

    $changed = @('DATABASE_URL', 'JWT_SECRET', 'PORT', 'CLIENT_URL', 'CORS_EXTRA_ORIGINS')
    if ($staging['ENROLLPRO_PROXY_ORIGIN'] -cne $LiveMap['ENROLLPRO_PROXY_ORIGIN']) { $changed += 'ENROLLPRO_PROXY_ORIGIN' }
    [pscustomobject]@{
        Map             = $staging
        ChangedKeys     = $changed
        ClientOrigin    = $clientOrigin
        EnrollProOrigin = $EnrollProOrigin
    }
}

function Write-StagingEnvFile {
    <#
    .SYNOPSIS
        Serialise a staging env map to disk with the SAME ACL as the live file.
    .DESCRIPTION
        The live ACL is copied rather than inherited, because the staging env file
        holds a JWT secret and a database credential and must not be more
        permissive than the live file it was derived from.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary] $Map,
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $LiveEnvFile
    )

    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# ATLAS STAGING environment. Generated by ops/staging/deploy-staging.ps1.")
    $lines.Add("# Derived from the live env file; DATABASE_URL, JWT_SECRET, PORT, CLIENT_URL,")
    $lines.Add("# CORS_EXTRA_ORIGINS and ENROLLPRO_PROXY_ORIGIN differ. Never copy this file into a")
    $lines.Add("# git worktree. Regenerate with deploy-staging.ps1 -Sha <sha> -Execute.")
    $lines.Add("# Never print its values.")
    foreach ($key in $Map.Keys) { $lines.Add("$key=$($Map[$key])") }
    $text = ($lines -join "`r`n") + "`r`n"

    # ORDER MATTERS, and this was a reviewed BLOCKING defect once already.
    # Create the file EMPTY, restrict it to the live file's ACL, and only then
    # write the secret. The reverse order leaves a fresh JWT secret and the live
    # database password in a file carrying the directory's inherited DACL, which
    # on this host grants `NT AUTHORITY\Authenticated Users: Modify` and
    # `BUILTIN\Users: ReadAndExecute` until the Set-Acl runs -- and lets a local
    # user pre-create the name, since Modify on the directory includes create.
    if (-not (Test-Path -LiteralPath $Path)) {
        [System.IO.File]::WriteAllText($Path, '')
    }
    $liveAcl = Get-Acl -LiteralPath $LiveEnvFile
    Set-Acl -LiteralPath $Path -AclObject $liveAcl
    [System.IO.File]::WriteAllText($Path, $text)
    return $Path
}

function Get-StagingLaunchEnvironment {
    <#
    .SYNOPSIS
        The three runtime-identity values for a staging child process.
    .DESCRIPTION
        CHILD-PROCESS ONLY. Machine scope is a single global namespace shared with
        the live runtime, so writing these values at machine scope would silently
        repoint the live release. The staging scheduled task sets them in its own
        .cmd launcher instead. Nothing here mutates machine scope.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $SourceDir,
        [Parameter(Mandatory)][string] $ReleaseSha,
        [Parameter(Mandatory)][string] $EnvFile
    )
    @{
        ATLAS_RUNTIME_SOURCE_DIR  = $SourceDir
        ATLAS_RUNTIME_RELEASE_SHA = $ReleaseSha
        ATLAS_RUNTIME_ENV_FILE    = $EnvFile
    }
}

function Test-Administrator {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
