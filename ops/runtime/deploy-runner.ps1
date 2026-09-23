[CmdletBinding()]
param(
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string] $TargetSha,

    [ValidateScript({
        $path = [string]$_
        -not [string]::IsNullOrWhiteSpace($path) -and
        ($path -match '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))')
    })]
    [string] $TargetSourceDir,

    [ValidatePattern('^[0-9a-f]{40}$')]
    [string] $IncumbentSha,

    [ValidateScript({
        $path = [string]$_
        -not [string]::IsNullOrWhiteSpace($path) -and
        ($path -match '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))')
    })]
    [string] $IncumbentSourceDir,

    [ValidateScript({
        $path = [string]$_
        -not [string]::IsNullOrWhiteSpace($path) -and
        ($path -match '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))')
    })]
    [string] $EnvFile,

    [string] $TaskName = 'ATLAS-Runtime-Supervisor',
    [string] $AuditRoot = 'C:\ProgramData\ATLAS\release-audit',

    # -LiveStateRef: committed ref (default origin/main) from which the gate reads docs/plans/live-state.md.
    # Reading a committed ref keeps the pre-mutation check independent of any working tree.
    [string] $LiveStateRef = 'origin/main',

    [switch] $Execute
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string] $Message) { throw "DEPLOY_RUNNER_STOP: $Message" }

function Invoke-Native([string] $File, [string[]] $Arguments) {
    $output = & $File @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "$File failed with exit code $LASTEXITCODE." }
    return ($output -join "`n")
}

function Assert-Administrator {
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Fail 'An elevated Administrator PowerShell is required.'
    }
}

function Get-GitIdentity([string] $SourceDir, [string] $ExpectedSha) {
    $head = (Invoke-Native 'git' @('-C', $SourceDir, 'rev-parse', 'HEAD')).Trim()
    if ($head -cne $ExpectedSha) { Fail "Target HEAD does not equal the declared SHA." }
    $status = (Invoke-Native 'git' @('-C', $SourceDir, 'status', '--short')).Trim()
    if ($status) { Fail 'Target worktree is not clean.' }
    [pscustomobject]@{ SourceDir = $SourceDir; Sha = $head; Clean = $true }
}

function Save-SchtasksXml([string] $Name, [string] $Path) {
    # cmd redirection preserves the host's task-XML byte stream. Do not decode,
    # rewrite the declaration, or re-encode this file: this host declares UTF-16
    # while schtasks emits an ASCII-compatible stream and accepts that stream.
    $escaped = $Path.Replace('"', '""')
    & cmd.exe /d /c "schtasks /query /tn `"$Name`" /xml > `"$escaped`""
    if ($LASTEXITCODE -ne 0) { Fail "Unable to capture scheduled task XML for $Name." }
    if (-not (Test-Path -LiteralPath $Path)) { Fail 'Scheduled-task XML capture produced no file.' }
    [IO.File]::ReadAllBytes($Path)
}

function Replace-ByteSequence([byte[]] $XmlBytes, [byte[]] $OldBytes, [byte[]] $NewBytes) {
    $result = [Collections.Generic.List[byte]]::new()
    $matches = 0
    for ($i = 0; $i -lt $XmlBytes.Length;) {
        $same = $true
        if ($i + $oldBytes.Length -gt $XmlBytes.Length) { $same = $false }
        if ($same) {
            for ($j = 0; $j -lt $oldBytes.Length; $j++) {
                if ($XmlBytes[$i + $j] -ne $oldBytes[$j]) { $same = $false; break }
            }
        }
        if ($same) {
            $matches++
            $result.AddRange($newBytes)
            $i += $oldBytes.Length
        } else {
            $result.Add($XmlBytes[$i])
            $i++
        }
    }
    [pscustomobject]@{ Bytes = [byte[]]$result.ToArray(); Matches = $matches }
}

function Replace-TaskSourceBytes([byte[]] $XmlBytes, [string] $Incumbent, [string] $Target) {
    # Prefer the encoding proven by a BOM. Without a BOM, schtasks emits an
    # ASCII-compatible stream on this host; UTF-8 is also accepted for a
    # declaration/body pair that contains non-ASCII task metadata.
    $encodings = [Collections.Generic.List[Text.Encoding]]::new()
    if ($XmlBytes.Length -ge 2 -and $XmlBytes[0] -eq 0xff -and $XmlBytes[1] -eq 0xfe) {
        $encodings.Add([Text.Encoding]::Unicode)
    } elseif ($XmlBytes.Length -ge 2 -and $XmlBytes[0] -eq 0xfe -and $XmlBytes[1] -eq 0xff) {
        $encodings.Add([Text.Encoding]::BigEndianUnicode)
    } elseif ($XmlBytes.Length -ge 3 -and $XmlBytes[0] -eq 0xef -and $XmlBytes[1] -eq 0xbb -and $XmlBytes[2] -eq 0xbf) {
        $encodings.Add([Text.Encoding]::UTF8)
    } else {
        $encodings.Add([Text.Encoding]::ASCII)
        $encodings.Add([Text.Encoding]::UTF8)
    }
    foreach ($encoding in $encodings) {
        $replacement = Replace-ByteSequence $XmlBytes $encoding.GetBytes($Incumbent) $encoding.GetBytes($Target)
        if ($replacement.Matches -eq 2) { return $replacement.Bytes }
    }
    Fail 'Expected exactly two incumbent task-path references in the task XML encoding.'
}

function Get-MachineIdentity([string] $ExpectedSource, [string] $ExpectedSha, [string] $ExpectedEnv) {
    $values = [Environment]::GetEnvironmentVariables('Machine')
    if ($values['ATLAS_RUNTIME_SOURCE_DIR'] -cne $ExpectedSource -or
        $values['ATLAS_RUNTIME_RELEASE_SHA'] -cne $ExpectedSha -or
        $values['ATLAS_RUNTIME_ENV_FILE'] -cne $ExpectedEnv) {
        Fail 'Machine runtime identity does not match the declared incumbent.'
    }
    [pscustomobject]@{
        SourceDir = [string]$values['ATLAS_RUNTIME_SOURCE_DIR']
        ReleaseSha = [string]$values['ATLAS_RUNTIME_RELEASE_SHA']
        EnvFile = [string]$values['ATLAS_RUNTIME_ENV_FILE']
    }
}

function Get-SharedRepositoryRoot([string] $WorktreeDir) {
    # The target is a registered worktree; its common git directory names the shared
    # repository whose committed refs carry the live-state file.
    $commonGitDir = (Invoke-Native 'git' @('-C', $WorktreeDir, 'rev-parse', '--git-common-dir')).Trim()
    if ([string]::IsNullOrWhiteSpace($commonGitDir)) {
        Fail "Unable to resolve the shared repository for target '$WorktreeDir'."
    }
    if (-not [IO.Path]::IsPathRooted($commonGitDir)) {
        $commonGitDir = Join-Path $WorktreeDir $commonGitDir
    }
    $root = Split-Path -Parent ([IO.Path]::GetFullPath($commonGitDir))
    if ([string]::IsNullOrWhiteSpace($root)) {
        Fail "Unable to resolve the shared repository root for target '$WorktreeDir'."
    }
    return $root
}

function Get-LiveStateText([string] $TargetSourceDir, [string] $Ref) {
    # Read the live-state file from a committed ref so the gate does not depend on any
    # working tree being clean or current. A missing ref, a missing file, or an empty
    # read is a hard failure, never a pass.
    $sharedRoot = Get-SharedRepositoryRoot $TargetSourceDir
    $text = Invoke-Native 'git' @('-C', $sharedRoot, 'show', "$($Ref):docs/plans/live-state.md")
    if ([string]::IsNullOrWhiteSpace($text)) {
        Fail "docs/plans/live-state.md is empty at ref '$Ref'."
    }
    return $text
}

function Get-LiveReleaseSection([string] $LiveStateText) {
    # The Live release section is the text between the '## Live release' heading and the
    # next '## ' heading. A missing heading yields no section, so the gate fails closed.
    if ([string]::IsNullOrEmpty($LiveStateText)) { return $null }
    $lines = $LiveStateText -split "\r?\n"
    $start = -1
    $end = $lines.Length
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($start -lt 0) {
            if ($lines[$i] -match '^##\s+Live release\s*$') { $start = $i }
        } elseif ($lines[$i] -match '^##\s') {
            $end = $i
            break
        }
    }
    if ($start -lt 0) { return $null }
    if ($end -le ($start + 1)) { return '' }
    return (($lines[($start + 1)..($end - 1)]) -join "`n")
}

function Assert-LiveReleaseRecorded([string] $LiveStateText, [string] $IncumbentSha, [string] $Ref = 'origin/main') {
    # Fail-closed pre-mutation gate: the currently live (incumbent) release must be named
    # in the Live release section of docs/plans/live-state.md before any cutover begins.
    # A prefix that appears only outside that section must not satisfy the gate.
    if ([string]::IsNullOrWhiteSpace($IncumbentSha) -or $IncumbentSha.Length -lt 8) {
        Fail "Incumbent release SHA '$IncumbentSha' cannot yield an 8-character prefix."
    }
    $prefix = $IncumbentSha.Substring(0, 8)
    $section = Get-LiveReleaseSection $LiveStateText
    if ($null -eq $section) {
        Fail "docs/plans/live-state.md at ref '$Ref' has no '## Live release' section naming incumbent release prefix '$prefix'."
    }
    if ($section -notmatch [regex]::Escape($prefix)) {
        Fail "docs/plans/live-state.md at ref '$Ref' does not name incumbent release prefix '$prefix' in its '## Live release' section."
    }
}

function Get-SupervisorLineage([int[]] $Ports, [string] $Incumbent) {
    $listeners = foreach ($port in $Ports) { @(Get-NetTCPConnection -State Listen -LocalPort $port) }
    if ($listeners.Count -ne $Ports.Count) { Fail 'Expected exactly one listener for each supervised port.' }
    $processes = foreach ($listener in $listeners) {
        Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    }
    $parents = @($processes | Select-Object -ExpandProperty ParentProcessId -Unique)
    if ($parents.Count -ne 1) { Fail 'Supervised listeners do not share one parent.' }
    $supervisor = Get-CimInstance Win32_Process -Filter "ProcessId=$($parents[0])"
    if ($null -eq $supervisor -or $supervisor.CommandLine -notlike "*$Incumbent\ops\runtime\cli.mjs*") {
        Fail 'Listener parent is not the declared incumbent supervisor.'
    }
    [pscustomobject]@{ Ports = $Ports; ListenerPids = @($processes | Select-Object -ExpandProperty ProcessId); SupervisorPid = [int]$parents[0] }
}

function New-DeploymentPlan {
    param([string] $XmlPath, [string] $TargetXmlPath, [object] $Target, [object] $Machine, [object] $Lineage)
    [pscustomobject]@{
        mode = if ($Execute) { 'execute' } else { 'dry-run' }
        targetSha = $Target.Sha
        targetSourceDir = $Target.SourceDir
        incumbentSha = $Machine.ReleaseSha
        incumbentSourceDir = $Machine.SourceDir
        taskName = $TaskName
        taskXmlCapture = $XmlPath
        taskXmlTarget = $TargetXmlPath
        supervisorPid = $Lineage.SupervisorPid
        listenerPids = $Lineage.ListenerPids
        mutates = [bool]$Execute
        secretsPrinted = $false
        rollback = 'Restore captured task XML and the two captured machine runtime variables; restart the restored task only if cutover reached quiescence.'
    }
}

function Invoke-DeploymentRunner {
if ([string]::IsNullOrWhiteSpace($TargetSha) -or
    [string]::IsNullOrWhiteSpace($TargetSourceDir) -or
    [string]::IsNullOrWhiteSpace($IncumbentSha) -or
    [string]::IsNullOrWhiteSpace($IncumbentSourceDir) -or
    [string]::IsNullOrWhiteSpace($EnvFile)) {
    Fail 'Target SHA, target source, incumbent SHA, incumbent source, and env file are required.'
}
Assert-Administrator
$target = Get-GitIdentity $TargetSourceDir $TargetSha
$machine = Get-MachineIdentity $IncumbentSourceDir $IncumbentSha $EnvFile
$liveStateText = Get-LiveStateText $TargetSourceDir $LiveStateRef
Assert-LiveReleaseRecorded $liveStateText $IncumbentSha $LiveStateRef
$audit = Join-Path $AuditRoot "$($TargetSha.Substring(0, 8))-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force -Path $audit | Out-Null
$xmlPath = Join-Path $audit 'task-before.xml'
$targetXmlPath = Join-Path $audit 'task-target.xml'
$xmlBytes = Save-SchtasksXml $TaskName $xmlPath
$targetXmlBytes = Replace-TaskSourceBytes $xmlBytes.Clone() $IncumbentSourceDir $TargetSourceDir
[IO.File]::WriteAllBytes($targetXmlPath, $targetXmlBytes)
$lineage = Get-SupervisorLineage @(5001, 5174) $IncumbentSourceDir
$plan = New-DeploymentPlan $xmlPath $targetXmlPath $target $machine $lineage
$planPath = Join-Path $audit 'deployment-plan.json'
$plan | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $planPath

if (-not $Execute) {
    $plan | ConvertTo-Json -Depth 5
    exit 0
}

$oldSource = $machine.SourceDir
$oldSha = $machine.ReleaseSha
$quiesced = $false
$portsCleared = $false
try {
    Invoke-Native 'schtasks' @('/create', '/tn', $TaskName, '/xml', $targetXmlPath, '/f') | Out-Null
    [Environment]::SetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR', $TargetSourceDir, 'Machine')
    [Environment]::SetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', $TargetSha, 'Machine')
    Invoke-Native 'taskkill' @('/PID', [string]$lineage.SupervisorPid, '/T', '/F') | Out-Null
    $quiesced = $true
    Start-Sleep -Seconds 10
    $remainingListeners = foreach ($port in @(5001, 5174)) { @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) }
    if (@($remainingListeners).Count -ne 0) { Fail 'Supervisor ports did not clear after targeted task-tree shutdown.' }
    $portsCleared = $true
    Invoke-Native 'schtasks' @('/run', '/tn', $TaskName) | Out-Null
    [pscustomobject]@{ result = 'CUTOVER_STARTED'; releaseSha = $TargetSha; auditDirectory = $audit; plan = $planPath } | ConvertTo-Json -Depth 5
}
catch {
    [Environment]::SetEnvironmentVariable('ATLAS_RUNTIME_SOURCE_DIR', $oldSource, 'Machine')
    [Environment]::SetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', $oldSha, 'Machine')
    Invoke-Native 'schtasks' @('/create', '/tn', $TaskName, '/xml', $xmlPath, '/f') | Out-Null
    if ($quiesced -and $portsCleared) { Invoke-Native 'schtasks' @('/run', '/tn', $TaskName) | Out-Null }
    throw
}
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-DeploymentRunner
}
