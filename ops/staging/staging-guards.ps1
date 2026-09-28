<#
.SYNOPSIS
    Fail-closed guards for the ATLAS staging deploy lane. Pure: nothing here
    reads, writes, creates, stops or starts anything.

.DESCRIPTION
    Three classes of guard, each of which the 2026-09-28 independent review
    (docs/reviews/a4-staging-review-20260928/codex-review.md) found as a BLOCKING
    defect in deploy-staging.ps1:

      1. -TaskName is a machine-scope scheduled task name. Scheduled tasks are ONE
         global namespace shared with the live runtime, so naming the live task
         would stop it and then overwrite it with `schtasks /create /f`. The live
         task is never a participant. Hard deny-list plus a positive allow-rule,
         both case-insensitive, both applied to a leading-`\`-stripped value.

      2. -ReleaseRoot and -StagingEnvFile are write targets. Unrestricted, a live
         release root, the shared repo root, or the live env file can be supplied
         and written. Both are compared on the RESOLVED full path, so `..`
         segments, a trailing separator, a sibling directory whose name merely
         starts with the pinned root (`E:\ATLAS-staging-evil`), a relative path, a
         wildcard and a UNC path are all refused on the value that would actually
         be used.

      3. A companion origin VALUE must never reach deploy output. Origin values
         reach operator terminals, review artifacts, transcripts and handoffs, and
         a Vite build override is exactly the kind of value that grows a query
         string or a token. Output reports KEY NAMES and presence only.

    Every refusal is a plain `TOKEN: <detail>` message. deploy-staging.ps1 routes
    it through its own `Fail` helper so the caller always sees the identical
    `STAGING_DEPLOY_STOP: <TOKEN>: <detail>` contract no matter which guard fired,
    and the tests can assert on a stable token instead of prose.

.NOTES
    Dot-source this file; do not execute it. The tests load it directly to
    exercise the guards as pure functions, which is the documented non-mutating
    entry point when a guard must be proved without a full script invocation.
#>
Set-StrictMode -Version Latest

function Get-StagingGuardPolicy {
    <#
    .SYNOPSIS
        The pinned staging lane constants. Deliberately NOT parameters: a value an
        override can change is not a pin.
    #>
    [CmdletBinding()]
    [OutputType([pscustomobject])]
    param()

    [pscustomobject]@{
        # The one tree a staging release may ever be written into.
        ReleaseRoot = 'E:\ATLAS-staging'

        # Positive allow-rule for -TaskName. Case-insensitive prefix.
        TaskNamePrefix = 'ATLAS-Staging'

        # Hard deny-list, compared case-insensitively against the value with any
        # leading '\' stripped. ATLAS-Runtime-Supervisor is the live supervisor
        # (AGENTS.md 6 and 13); ATLAS-DevServer-Temp2 is the legacy live dev task
        # named in the delivery register.
        LiveTaskNames = @(
            'ATLAS-Runtime-Supervisor'
            'ATLAS-DevServer-Temp2'
        )

        # -StagingEnvFile must be exactly this leaf, and must never be this one.
        StagingEnvLeaf = 'atlas-staging.env'
        LiveEnvLeaf    = 'atlas-server.env'
    }
}

function Resolve-StagingPinnedPath {
    <#
    .SYNOPSIS
        Resolve one parameter to a normalised, local, absolute path, or throw.
    .DESCRIPTION
        Normalisation order is deliberate: reject the unsafe SHAPES first (a
        relative or UNC or wildcard value must never be silently resolved against
        the process working directory, which is not the pinned root), then
        resolve with GetFullPath so `..` and a trailing separator are collapsed
        before any caller compares. Returns the resolved path with no trailing
        separator, so 'E:\ATLAS-staging' and 'E:\ATLAS-staging\' compare equal.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)][AllowEmptyString()][AllowNull()][string] $Path,
        [Parameter(Mandatory)][string] $Token
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Token : the path is empty or whitespace-only; a pinned local absolute path is required."
    }
    $trimmed = $Path.Trim()
    if ($trimmed.IndexOfAny(@('*', '?')) -ge 0) {
        throw "$Token : '$Path' contains a wildcard; a literal path is required, never a glob."
    }
    if ($trimmed.StartsWith('\\') -or $trimmed.StartsWith('//')) {
        throw "$Token : '$Path' is a UNC or device path; a local absolute path is required."
    }
    if ($trimmed -notmatch '^[A-Za-z]:[\\/]') {
        throw "$Token : '$Path' is not a local absolute path (expected a drive-rooted path such as 'E:\ATLAS-staging'); relative paths are refused because they would resolve against the process working directory."
    }

    $full = $null
    try { $full = [System.IO.Path]::GetFullPath($trimmed) }
    catch { throw "$Token : '$Path' is not a resolvable path ($($_.Exception.Message))." }

    $normalized = $full.TrimEnd('\')
    if ([string]::IsNullOrEmpty($normalized)) {
        throw "$Token : '$Path' does not resolve to a usable path."
    }
    return $normalized
}

function Assert-StagingTaskName {
    <#
    .SYNOPSIS
        Fail closed unless -TaskName is a staging task name.
    .OUTPUTS
        The trimmed name to use, so a stray surrounding space cannot reach
        schtasks as part of the task name.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param([Parameter(Mandatory)][AllowEmptyString()][AllowNull()][string] $Name)

    $policy = Get-StagingGuardPolicy

    if ([string]::IsNullOrWhiteSpace($Name)) {
        throw "TASK_NAME_EMPTY : -TaskName is empty or whitespace-only. The live task is never a participant in a staging deploy; pass a task name starting with '$($policy.TaskNamePrefix)'."
    }

    $normalized = $Name.Trim().TrimStart('\')

    foreach ($live in $policy.LiveTaskNames) {
        if ($normalized -ieq $live) {
            throw "TASK_NAME_LIVE_DENYLIST : -TaskName '$Name' names the live runtime task. The live task is never a participant in a staging deploy: this script refuses to end, stop or overwrite it. Pass a task name starting with '$($policy.TaskNamePrefix)'."
        }
    }

    if (-not $normalized.StartsWith($policy.TaskNamePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "TASK_NAME_NOT_STAGING : -TaskName '$Name' is not a staging task. The live task is never a participant in a staging deploy; -TaskName must start with '$($policy.TaskNamePrefix)'."
    }
    # A prefix test alone would also accept 'ATLAS-Staging-Supervisor-evil', so the
    # accepted shape is the lane name plus AT MOST ONE instance segment:
    # 'ATLAS-Staging' or 'ATLAS-Staging-Supervisor'. Anything deeper is refused.
    if ($normalized -notmatch ('^{0}(-[A-Za-z0-9_]+)?$' -f [regex]::Escape($policy.TaskNamePrefix))) {
        throw "TASK_NAME_NOT_STAGING : -TaskName '$Name' is not a staging task name. The live task is never a participant in a staging deploy; -TaskName must be '$($policy.TaskNamePrefix)' or '$($policy.TaskNamePrefix)-<instance>'."
    }

    return $normalized
}

function Assert-StagingReleaseRoot {
    <#
    .SYNOPSIS
        Fail closed unless -ReleaseRoot resolves inside the pinned staging root.
    .DESCRIPTION
        The comparison is `equal to root` OR `starts with root + '\'`, both
        case-insensitive on the RESOLVED path. Appending the separator before the
        prefix test is what refuses `E:\ATLAS-staging-evil`: a bare StartsWith on
        `E:\ATLAS-staging` would accept that sibling.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param([Parameter(Mandatory)][AllowEmptyString()][AllowNull()][string] $Path)

    $policy = Get-StagingGuardPolicy
    $root   = Resolve-StagingPinnedPath -Path $policy.ReleaseRoot -Token 'STAGING_ROOT_ANCHOR_INVALID'
    $full   = Resolve-StagingPinnedPath -Path $Path -Token 'RELEASE_ROOT_NOT_ABSOLUTE'

    $underRoot = ($full -ieq $root) -or $full.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $underRoot) {
        throw "RELEASE_ROOT_OUTSIDE_STAGING : -ReleaseRoot '$Path' resolves to '$full', which is not under the pinned staging root '$root'. Staging never writes a live release directory, the shared repo root, or a sibling directory whose name merely starts with 'ATLAS-staging'."
    }

    return $full
}

function Assert-StagingEnvFilePath {
    <#
    .SYNOPSIS
        Fail closed unless -StagingEnvFile is the staging env file and nothing else.
    .DESCRIPTION
        The default `D:\ATLAS-runtime-config\atlas-staging.env` is the valid
        answer and stays valid: the staging launcher already points at that path
        and relocating it would orphan the running staging runtime. What is refused
        is any other leaf, and above all the live `atlas-server.env`, whose
        DATABASE_URL, JWT_SECRET and companion credentials would be overwritten.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory)][AllowEmptyString()][AllowNull()][string] $Path,
        [string] $LiveEnvFile = ''
    )

    $policy = Get-StagingGuardPolicy
    $full   = Resolve-StagingPinnedPath -Path $Path -Token 'STAGING_ENV_NOT_ABSOLUTE'
    $leaf   = [System.IO.Path]::GetFileName($full)

    if ($leaf -ieq $policy.LiveEnvLeaf) {
        throw "STAGING_ENV_LIVE_LEAF : -StagingEnvFile '$Path' is the LIVE environment file. Staging has its own env file ('$($policy.StagingEnvLeaf)'); writing the live file would repoint the live runtime's database, JWT secret and companion credentials."
    }
    if ($leaf -ine $policy.StagingEnvLeaf) {
        throw "STAGING_ENV_LEAF_MISMATCH : -StagingEnvFile '$Path' has leaf '$leaf'; it must be exactly '$($policy.StagingEnvLeaf)'."
    }

    if (-not [string]::IsNullOrWhiteSpace($LiveEnvFile)) {
        $liveFull = Resolve-StagingPinnedPath -Path $LiveEnvFile -Token 'LIVE_ENV_NOT_ABSOLUTE'
        if ($full -ieq $liveFull) {
            throw "STAGING_ENV_IS_LIVE_ENV : -StagingEnvFile '$Path' resolves to the live environment file '$liveFull'. Staging must never write the live environment file."
        }
    }

    return $full
}

function Format-EnrollProClientBuildMark {
    <#
    .SYNOPSIS
        The timeline line for the client build, carrying the Vite override's KEY
        NAME and presence only -- never its value.
    .DESCRIPTION
        The single line this replaces interpolated the companion origin into the
        deploy timeline, which is copied into review artifacts, transcripts and
        handoffs. The origin is still fully effective: it is exported into
        $env:VITE_ENROLLPRO_URL for the build exactly as before. Only the
        reporting changed.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param([AllowEmptyString()][AllowNull()][string] $Origin)

    $presence = if ([string]::IsNullOrWhiteSpace($Origin)) { 'false' } else { 'true' }
    return "client build (vite, VITE_ENROLLPRO_URL key set: $presence)"
}
