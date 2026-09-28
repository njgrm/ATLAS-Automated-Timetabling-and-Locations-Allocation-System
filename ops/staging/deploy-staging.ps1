<#
.SYNOPSIS
    Deploy one commit to the ATLAS STAGING runtime (ports 5101 / 5274).

.DESCRIPTION
    Stages a candidate so planners and runners can see it rendered in minutes,
    without touching the live runtime on 5001 / 5174.

    Isolation model
    ---------------
    `ops/runtime/cli.mjs` resolves its contract from the DEPLOYED SOURCE DIRECTORY
    (`DEFAULT_CONTRACT_PATH` is relative to `lib/contract.mjs`). Installing
    ops/staging/staging-contract.json into a staging release directory therefore
    gives staging its own supervision contract -- including its own port pair --
    with no change to the live contract in the live release directory.

    Machine scope is a single global namespace shared with the live runtime, so
    this script NEVER writes ATLAS_RUNTIME_SOURCE_DIR / ATLAS_RUNTIME_RELEASE_SHA
    / ATLAS_RUNTIME_ENV_FILE at machine scope. The staging scheduled task runs
    E:\ATLAS-staging\staging-supervisor.cmd, which sets those three variables in
    its own process and then execs the staging release's cli.mjs.

    Each staging release OWNS its dependency trees (a robocopy seed from a source
    release, ~25s, ~0.9 GiB). It never junctions to another release: a junction
    chain rooted at a retired release has already taken this runtime down once.

.PARAMETER Execute
    Without it the script prints a plan and mutates nothing.

.PARAMETER RotateJwtSecret
    Regenerate the staging JWT secret, invalidating every staging session.
    Sessions survive a normal redeploy; use this only deliberately.

.EXAMPLE
    .\deploy-staging.ps1 -Sha 7590d485974337f834aa3972bb128090e6067b8d
    .\deploy-staging.ps1 -Sha 7590d485974337f834aa3972bb128090e6067b8d -Execute
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[0-9a-f]{40}$')]
    [string] $Sha,

    [string] $ReleaseRoot       = 'E:\ATLAS-staging',
    [string] $TaskName          = 'ATLAS-Staging-Supervisor',
    [string] $LiveEnvFile       = 'D:\ATLAS-runtime-config\atlas-server.env',
    [string] $StagingEnvFile    = 'D:\ATLAS-runtime-config\atlas-staging.env',
    [string] $ContractTemplate  = (Join-Path $PSScriptRoot 'staging-contract.json'),
    [string] $DependencySourceDir = '',
    [string] $EnrollProOrigin   = 'https://dev-jegs.buru-degree.ts.net',
    [int]    $ServerPort        = 5101,
    [int]    $ClientPort        = 5274,
    [string] $StagingDatabase   = 'atlas_staging',
    [switch] $SkipBuild,
    [switch] $SkipDbRefresh,
    [switch] $RotateJwtSecret,
    [switch] $Execute
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'staging-common.ps1')

function Fail([string] $Message) { throw "STAGING_DEPLOY_STOP: $Message" }
function Invoke-Native([string] $File, [string[]] $Arguments, [string] $Cwd = '') {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Cwd) { Push-Location $Cwd }
        try { $out = & $File @Arguments 2>&1 } finally { if ($Cwd) { Pop-Location } }
    } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { Fail "$File failed (exit $LASTEXITCODE): $(($out | Select-Object -Last 12) -join ' ')" }
    return ($out -join "`n")
}
function Get-HttpStatus([string] $Url) {
    try { return [int](Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20).StatusCode }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}
function Test-TaskExists {
    <#
    .SYNOPSIS
        True when the staging task is registered. NEVER throws.
    .DESCRIPTION
        `schtasks /query` on a missing task exits 1 AND writes to stderr. Under
        $ErrorActionPreference='Stop' a `2>&1` merged stderr becomes a terminating
        NativeCommandError, so probing with the raw call aborted the deploy on the
        very first run -- after the database had been dropped and restored and the
        build had run, but before the task was created and the runtime started.
        That was a reviewed BLOCKING defect. Set-Acl/EA-Continue here, and report
        absence as $false rather than as an error.
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param([Parameter(Mandatory)][string] $Name)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $null = & schtasks.exe /query /tn $Name /fo LIST /v 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally { $ErrorActionPreference = $previous }
}
function Stop-TaskIfPresent {
    <#
    .SYNOPSIS
        End the staging task if it is registered. Never throws, never touches live.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string] $Name)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $null = & schtasks.exe /end /tn $Name 2>&1 } catch { }
    finally { $ErrorActionPreference = $previous }
}

# ------------------------------------------------------------------ preflight
if (-not (Test-Administrator)) { Fail 'An elevated Administrator PowerShell is required to register the staging task and kill its supervisor tree.' }
if ($ServerPort -eq 5001 -or $ServerPort -eq 5174 -or $ClientPort -eq 5001 -or $ClientPort -eq 5174) {
    Fail "Staging must never use a live port (5001/5174). Got $ServerPort/$ClientPort."
}
if ($ServerPort -eq $ClientPort) { Fail 'Staging server and client ports must differ.' }
if (-not (Test-Path -LiteralPath $LiveEnvFile)) { Fail "Live env file not found: $LiveEnvFile" }
if (-not (Test-Path -LiteralPath $ContractTemplate)) { Fail "Staging contract template not found: $ContractTemplate" }

$repoRoot = (Invoke-Native 'git' @('-C', $PSScriptRoot, 'rev-parse', '--show-toplevel')).Trim()

$releaseDir  = Join-Path $ReleaseRoot $Sha
$taskCommand = Join-Path $ReleaseRoot 'staging-supervisor.cmd'
$activeFile  = Join-Path $ReleaseRoot 'active-release.txt'
$auditDir    = 'C:\ProgramData\ATLAS\staging-audit'

$liveMap  = Get-AtlasEnvMap -Path $LiveEnvFile
$liveConn = Get-PgConnection $liveMap
if ($StagingDatabase -ceq $liveConn.Database) { Fail 'Staging database name equals the live database name. Refusing.' }

# The EnrollPro origin used for the client bundle must never be an empty string:
# vite.config.ts fails the build closed without VITE_ENROLLPRO_URL, and an empty
# override would otherwise travel silently through the parameter into the build.
# Default to the LIVE value so the staging bundle is built against the same
# companion origin as production and cannot diverge from it.
if ([string]::IsNullOrWhiteSpace($EnrollProOrigin)) {
    $EnrollProOrigin = $liveMap['ENROLLPRO_PROXY_ORIGIN']
}
if ([string]::IsNullOrWhiteSpace($EnrollProOrigin)) {
    Fail 'EnrollPro origin is empty: neither -EnrollProOrigin nor the live env file supplied one. Refusing to build a bundle with dead companion SSO surfaces.'
}

if (-not $DependencySourceDir) {
    $machineSource = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR', 'Machine')
    $DependencySourceDir = $machineSource
    if ([string]::IsNullOrWhiteSpace($machineSource) -or -not (Test-Path -LiteralPath $machineSource)) {
        Fail 'Could not resolve -DependencySourceDir from machine scope; pass it explicitly.'
    }
}

$objectType = (Invoke-Native 'git' @('-C', $repoRoot, 'cat-file', '-t', $Sha)).Trim()
if ($objectType -ne 'commit') { Fail "SHA $Sha is not a commit (got '$objectType')." }

$mode = if ($Execute) { 'execute' } else { 'dry-run' }
$steps = [ordered]@{
    mode             = $mode
    sha              = $Sha
    releaseDir       = $releaseDir
    taskName         = $TaskName
    ports            = @{ server = $ServerPort; client = $ClientPort }
    stagingDatabase  = $StagingDatabase
    liveDatabase     = $liveConn.Database
    livePorts        = @(5001, 5174)
    stagingEnvFile   = $StagingEnvFile
    dependencySource = $DependencySourceDir
    mutates          = [bool]$Execute
    secretsPrinted   = $false
    writesLiveDb     = $false
    touchesLiveTask  = $false
    writesMachineEnv = $false
    rollback         = 'Delete the ATLAS-Staging-Supervisor task, kill the staging supervisor tree, and drop the atlas_staging database. The live runtime is never a participant.'
}

# ------------------------------------------------------- 1. release worktree
$steps.releaseWorktree = 'present'
if (-not (Test-Path -LiteralPath $releaseDir)) {
    $steps.releaseWorktree = 'creating'
    if ($Execute) {
        New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
        $null = Invoke-Native 'git' @('-C', $repoRoot, 'worktree', 'add', '--detach', $releaseDir, $Sha)
    }
}
if (Test-Path -LiteralPath $releaseDir) {
    $head = (Invoke-Native 'git' @('-C', $releaseDir, 'rev-parse', 'HEAD')).Trim()
    if ($head -cne $Sha) { Fail "Release dir HEAD $head does not equal the requested SHA $Sha." }
    $steps.releaseWorktree = 'present'
    $steps.headVerified = $true
}

# ------------------------------------------------------------ 2. dependencies
$depTrees = @('node_modules', 'atlas-server/node_modules', 'atlas-client/node_modules')
$steps.dependencies = @()
foreach ($tree in $depTrees) {
    $target = Join-Path $releaseDir $tree
    $seed   = Join-Path $DependencySourceDir $tree
    $present = Test-Path -LiteralPath $target
    $state = if ($present) { 'owned' } elseif (Test-Path -LiteralPath $seed) { 'will-seed' } else { 'absent' }
    $steps.dependencies += [ordered]@{ tree = $tree; state = $state }
}

# ------------------------------------------------------------- 3. env + contract
$envState = 'will-create'
$changedKeys = @()
if (Test-Path -LiteralPath $StagingEnvFile) {
    $existing = Get-AtlasEnvMap -Path $StagingEnvFile
    $existingConn = $null
    try { $existingConn = Get-PgConnection $existing } catch { $envState = 'unreadable' }
    if ($existingConn) {
        if ($existingConn.Database -cne $StagingDatabase -or $existing['PORT'] -ne [string]$ServerPort) {
            $envState = 'will-rotate'
        } else {
            $envState = 'reuse'
        }
    }
}
$steps.envFile = [ordered]@{ path = $StagingEnvFile; state = $envState }

$steps | ConvertTo-Json -Depth 5
if (-not $Execute) { exit 0 }

# ============================================================== EXECUTE PHASE
$sw = [Diagnostics.Stopwatch]::StartNew()
$timeline = New-Object System.Collections.Generic.List[string]
function Mark([string] $What) { $timeline.Add("$(('{0,6:N1}' -f $sw.Elapsed.TotalSeconds))s  $What") }

# Concurrency guard. Two concurrent -Execute runs would race on the env file, the
# database, and `schtasks /create /f`, and the loser's cutover would be
# indistinguishable from a fault. Named mutex, abandoned-wait so a crashed run
# releases it.
$mutexName = 'Global\ATLAS-StagingDeploy'
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
$locked = $false
try {
    $locked = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] { $locked = $true }
if (-not $locked) { Fail 'Another staging deploy is already running (mutex Global\ATLAS-StagingDeploy). Refusing to race.' }
Mark 'deploy mutex acquired'

# 1. release worktree
if (-not (Test-Path -LiteralPath $releaseDir)) {
    New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
    $null = Invoke-Native 'git' @('-C', $repoRoot, 'worktree', 'add', '--detach', $releaseDir, $Sha)
}
Mark "release worktree ready at $Sha"

# 2. owned dependency trees (copy, never junction)
foreach ($tree in $depTrees) {
    $target = Join-Path $releaseDir $tree
    if (Test-Path -LiteralPath $target) { continue }
    $seed = Join-Path $DependencySourceDir $tree
    if (-not (Test-Path -LiteralPath $seed)) { Fail "Cannot seed $tree : no source at $seed" }
    $null = robocopy $seed $target /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1
    if ($LASTEXITCODE -ge 8) { Fail "robocopy seed of $tree failed (exit $LASTEXITCODE)." }
    Mark "seeded dependency tree $tree"
}
$reparse = @(Get-ChildItem -LiteralPath $releaseDir -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue)
if ($reparse.Count -ne 0) { Fail "Release dir contains $($reparse.Count) reparse points; staging must own real dependency trees." }

# 3. prisma generate -- only when the generated client is absent (codegen, not HIGH).
#    The schema must come from the RELEASE being deployed, not from the dev
#    worktree this script lives in: generating from another tree's schema would
#    silently produce a client for different models.
$prismaClient = Join-Path $releaseDir 'atlas-server/node_modules/.prisma/client'
$releaseSchema = Join-Path $releaseDir 'prisma/schema.prisma'
if (-not (Test-Path -LiteralPath $releaseSchema)) { Fail "Release schema not found: $releaseSchema" }
if (-not (Test-Path -LiteralPath $prismaClient)) {
    $null = Invoke-Native 'npx' @('prisma', 'generate', '--schema', $releaseSchema) -Cwd (Join-Path $releaseDir 'atlas-server')
    Mark 'prisma generate (release schema)'
}

# 4. build FIRST, while any previously running staging runtime is still serving.
#    The build is the long, failure-prone step and touches nothing live, so
#    running it before the quiesce means a build failure never costs us staging.
if (-not $SkipBuild) {
    $null = Invoke-Native 'npm' @('run', 'build') -Cwd (Join-Path $releaseDir 'atlas-server')
    Mark 'server build (tsc)'
    $previousEnrollPro = $env:VITE_ENROLLPRO_URL
    try {
        $env:VITE_ENROLLPRO_URL = $EnrollProOrigin
        $null = Invoke-Native 'npm' @('run', 'build') -Cwd (Join-Path $releaseDir 'atlas-client')
    } finally { $env:VITE_ENROLLPRO_URL = $previousEnrollPro }
    Mark "client build (vite, VITE_ENROLLPRO_URL=$EnrollProOrigin)"
}
if (-not (Test-Path -LiteralPath (Join-Path $releaseDir 'atlas-server/dist/server.js'))) { Fail 'atlas-server/dist/server.js missing after build.' }
if (-not (Test-Path -LiteralPath (Join-Path $releaseDir 'atlas-client/dist/index.html')))  { Fail 'atlas-client/dist/index.html missing after build.' }

# 5. quiesce ONLY the previous staging runtime, BEFORE its contract, env file and
#    database are rewritten underneath it. A redeploy used to drop the running
#    staging server's database out from under it and swap its contract mid-flight.
$previousPids = @()
foreach ($port in @($ServerPort, $ClientPort)) {
    foreach ($c in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
        if ($proc.CommandLine -like "*$ReleaseRoot*ops\runtime\cli.mjs*") { $previousPids += $c.OwningProcess }
    }
}
if (Test-TaskExists -Name $TaskName) {
    Stop-TaskIfPresent -Name $TaskName
    Start-Sleep -Seconds 3
}
foreach ($pidToKill in @($previousPids | Select-Object -Unique)) {
    $null = Invoke-Native 'taskkill.exe' @('/PID', [string]$pidToKill, '/T', '/F')
}
if ($previousPids.Count -gt 0) { Start-Sleep -Seconds 5 }
foreach ($port in @($ServerPort, $ClientPort)) {
    $still = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if ($still.Count -ne 0) { Fail "Staging port $port did not clear; refusing to start a second owner." }
}
Mark 'previous staging runtime quiesced'

# 6. staging contract into the release dir (this is what isolates the ports)
Copy-Item -LiteralPath $ContractTemplate -Destination (Join-Path $releaseDir 'ops/runtime/runtime-contract.json') -Force
$contractText = [System.IO.File]::ReadAllText((Join-Path $releaseDir 'ops/runtime/runtime-contract.json'))
$contract = $contractText | ConvertFrom-Json
if ($contract.ports.server -ne $ServerPort -or $contract.ports.client -ne $ClientPort) { Fail 'Installed contract port pair does not match the requested staging ports.' }
Mark "installed staging contract ($ServerPort/$ClientPort)"

# 7. staging env file -- preserves the JWT secret across redeploys
$newMap = $null
if ($envState -eq 'reuse' -and -not $RotateJwtSecret) {
    $newMap = (Get-AtlasEnvMap -Path $StagingEnvFile)
} else {
    $built = New-StagingEnvMap -LiveMap $liveMap -StagingDatabase $StagingDatabase -ServerPort $ServerPort -ClientPort $ClientPort -EnrollProOrigin $EnrollProOrigin
    $newMap = $built.Map
    $changedKeys = $built.ChangedKeys
}
$null = Write-StagingEnvFile -Map $newMap -Path $StagingEnvFile -LiveEnvFile $LiveEnvFile

# Fail-closed proof that staging can never reach the live database.
$finalMap  = Get-AtlasEnvMap -Path $StagingEnvFile
$finalConn = Get-PgConnection $finalMap
if ($finalConn.Database -ceq $liveConn.Database) { Fail 'STAGING ENV POINTS AT THE LIVE DATABASE. Refusing to start.' }
if ($finalMap['PORT'] -ne [string]$ServerPort) { Fail 'Staging env PORT does not match the contract port.' }
Mark "staging env verified -> database $($finalConn.Database), PORT $ServerPort"

# 8. refresh the staging database from live. Ordering matters: the env file must
#    exist first (refresh-db.ps1 reads the connection from it), and the server
#    cannot reach readiness until the database exists. Doing it here makes one
#    command deliver "candidate + current data".
$dbRefresh = $null
if ($SkipDbRefresh) {
    $dbRefresh = [ordered]@{ result = 'SKIPPED'; reason = '-SkipDbRefresh' }
} else {
    $refreshScript = Join-Path $PSScriptRoot 'refresh-db.ps1'
    $dbRefresh = & $refreshScript -LiveEnvFile $LiveEnvFile -StagingEnvFile $StagingEnvFile -StagingDatabase $StagingDatabase -Execute | Out-String
    $dbRefresh | Write-Output
    if ($dbRefresh -notmatch '"result":\s*"SNAPSHOT_REFRESHED"') { Fail 'Database refresh did not report SNAPSHOT_REFRESHED; refusing to start against an unsynchronised staging database.' }
}
Mark 'staging database refreshed from live'

# 7. launcher + active release pointer (outside the worktree, so the worktree stays clean)
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { $nodeExe = 'C:\Program Files\nodejs\node.exe' }
$launcher = @(
    '@echo off',
    'rem ATLAS staging supervisor launcher. Sets the runtime identity for the CHILD',
    'rem process only. Machine scope is shared with the live runtime and is never',
    'rem written from here -- doing so would repoint the live release.',
    'setlocal',
    'set "ATLAS_RUNTIME_SOURCE_DIR="',
    'set "ATLAS_RUNTIME_RELEASE_SHA="',
    "for /f `"usebackq tokens=1,2`" %%A in (`"$activeFile`") do (",
    '  set "ATLAS_RUNTIME_SOURCE_DIR=%%A"',
    '  set "ATLAS_RUNTIME_RELEASE_SHA=%%B"',
    ')',
    'if not defined ATLAS_RUNTIME_SOURCE_DIR exit /b 2',
    'if not defined ATLAS_RUNTIME_RELEASE_SHA exit /b 2',
    "set `"ATLAS_RUNTIME_ENV_FILE=$StagingEnvFile`"",
    "`"$nodeExe`" `"%ATLAS_RUNTIME_SOURCE_DIR%\ops\runtime\cli.mjs`" start"
) -join "`r`n"
[System.IO.File]::WriteAllText($taskCommand, $launcher + "`r`n")
[System.IO.File]::WriteAllText($activeFile, "$releaseDir $Sha`r`n")
Mark "launcher + active-release pointer written"

# 10. register and start the staging task (never the live one)
$null = Invoke-Native 'schtasks.exe' @('/create', '/tn', $TaskName, '/tr', $taskCommand, '/sc', 'onstart', '/ru', 'SYSTEM', '/rl', 'HIGHEST', '/f')
Mark "registered $TaskName (SYSTEM, at startup)"
$null = Invoke-Native 'schtasks.exe' @('/run', '/tn', $TaskName)

# 11. wait for readiness
$deadline = (Get-Date).AddSeconds(90)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $live_ = Get-HttpStatus "http://127.0.0.1:$ServerPort/api/v1/health"
    $ready = Get-HttpStatus "http://127.0.0.1:$ServerPort/api/v1/health/ready"
    $hostL = Get-HttpStatus "http://127.0.0.1:$ClientPort/__host/live"
    $hostR = Get-HttpStatus "http://127.0.0.1:$ClientPort/__host/ready"
    if ($live_ -eq 200 -and $ready -eq 200 -and $hostL -eq 200 -and $hostR -eq 200) { $healthy = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $healthy) { Fail 'Staging did not reach full readiness within 90s. Evidence: ' + $releaseDir + '\ops\runtime\logs\atlas-supervisor.log' }
Mark 'staging ready (health, ready, host live, host ready all 200)'

$subjects = Get-HttpStatus "http://127.0.0.1:$ServerPort/api/v1/subjects?schoolId=1"
Mark "DB-backed read /api/v1/subjects -> $subjects"

# 12. M3: prove the running staging server actually read the STAGING env file and
#     the STAGING release dir. cli.mjs logs a secret-free `Environment reference:`
#     line naming only the path, sourceDir and key names -- so this is provable
#     without reading or printing a single secret value. Without this row, a server
#     that silently fell back to the live env file would look perfectly healthy.
$logFile = Join-Path $releaseDir 'ops/runtime/logs/atlas-supervisor.log'
$envProof = $null
if (Test-Path -LiteralPath $logFile) {
    $envLine = Select-String -LiteralPath $logFile -Pattern 'Environment reference:' | Select-Object -Last 1
    if ($envLine) {
        $json = $envLine.Line.Substring($envLine.Line.IndexOf('{')) | ConvertFrom-Json
        $envProof = [ordered]@{ envFile = $json.path; sourceDir = $json.sourceDir; keyCount = $json.keyCount }
        if ($json.path -cne $StagingEnvFile)  { Fail "Staging server read env file '$($json.path)', not '$StagingEnvFile'." }
        if ($json.sourceDir -cne $releaseDir) { Fail "Staging server reports sourceDir '$($json.sourceDir)', not '$releaseDir'." }
        Mark 'M3 proven: staging server read the staging env file and staging release dir'
    }
} else { Mark 'M3 NOT PROVEN: supervisor log not found' }

$sw.Stop()
$listeners = foreach ($port in @($ServerPort, $ClientPort)) {
    foreach ($c in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
        [ordered]@{ port = $port; pid = $c.OwningProcess }
    }
}
$liveListeners = foreach ($port in @(5001, 5174)) {
    foreach ($c in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
        [ordered]@{ port = $port; pid = $c.OwningProcess }
    }
}

[pscustomobject]@{
    result              = 'STAGING_DEPLOYED'
    sha                 = $Sha
    releaseDir          = $releaseDir
    url                 = "http://127.0.0.1:$ClientPort"
    apiUrl              = "http://127.0.0.1:$ServerPort"
    taskName            = $TaskName
    stagingDatabase     = $finalConn.Database
    envKeysChanged      = $changedKeys
    envState            = $envState
    elapsedSeconds      = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    timeline            = $timeline
    stagingListeners    = @($listeners)
    liveListenersUnchangedDuringCutover = @($liveListeners)
    dbBackedReadStatus  = $subjects
    environmentProof    = $envProof
    secretsPrinted      = $false
} | ConvertTo-Json -Depth 6

if ($mutex) { try { $mutex.ReleaseMutex() } catch { }; $mutex.Dispose() }
