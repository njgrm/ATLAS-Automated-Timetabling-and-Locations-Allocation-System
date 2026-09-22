[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)] [ValidatePattern('^[0-9a-fA-F]{40}$')] [string] $ApprovedSha,
    [Parameter(Mandatory)] [ValidatePattern('^[A-Za-z]:\\ATLAS-runtime-supervised-[0-9a-fA-F]{12}-[0-9]{8}$')] [string] $ReleaseRoot,
    [string] $TaskName = 'ATLAS-Approved-Release',
    [switch] $Register
)

$ErrorActionPreference = 'Stop'
if (-not $Register) { throw 'Registration is opt-in. Re-run with -Register after reviewing the exact task action.' }
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'An elevated PowerShell is required to register the task.'
}
if ($ReleaseRoot -notmatch "-$($ApprovedSha.Substring(0, 12))-\d{8}$") { throw 'ReleaseRoot is not prefixed by the approved SHA.' }
if ($TaskName -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$') { throw 'TaskName contains unsupported characters.' }

$runner = Join-Path $PSScriptRoot 'elevated-release-runner.mjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$taskAction = "`"$node`" `"$runner`" --mode preflight --sha $ApprovedSha --release-root `"$ReleaseRoot`""
$task = New-ScheduledTaskAction -Execute $node -Argument "`"$runner`" --mode preflight --sha $ApprovedSha --release-root `"$ReleaseRoot`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2)
$trigger.Enabled = $false
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$definition = New-ScheduledTask -Action $task -Trigger $trigger -Principal $principal -Settings $settings -Description 'ATLAS manually-triggered, preflight-only release gate. Cutover requires a separate approved HIGH packet.'
if ($PSCmdlet.ShouldProcess($TaskName, "Register disabled SYSTEM highest-privilege task: $taskAction")) {
    Register-ScheduledTask -TaskName $TaskName -InputObject $definition -Force | Out-Null
    Write-Output "Registered disabled on-demand task '$TaskName'. It does not start automatically."
}
