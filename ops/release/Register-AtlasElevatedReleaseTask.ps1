[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)] [ValidatePattern('^[0-9a-fA-F]{40}$')] [string] $ApprovedSha,
    [Parameter(Mandatory)] [ValidatePattern('^[A-Za-z]:\\ATLAS-runtime-supervised-[0-9a-fA-F]{12}-[0-9]{8}$')] [string] $ReleaseRoot,
    [switch] $Register
)

$ErrorActionPreference = 'Stop'
$TaskName = 'ATLAS-Approved-Release'
if (-not $Register) { throw 'Registration is opt-in. Re-run with -Register after reviewing the exact task action.' }
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'An elevated PowerShell is required to register the task.'
}
if ($ReleaseRoot -notmatch "-$($ApprovedSha.Substring(0, 12))-\d{8}$") { throw 'ReleaseRoot is not prefixed by the approved SHA.' }
if ($TaskName -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$') { throw 'TaskName contains unsupported characters.' }

$installRoot = Join-Path $env:ProgramData 'ATLAS\release-runner'
$installedRunner = Join-Path $installRoot 'elevated-release-runner.mjs'
$sourceRunner = Join-Path $PSScriptRoot 'elevated-release-runner.mjs'
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
$existingHash = if (Test-Path -LiteralPath $installedRunner) { (Get-FileHash -LiteralPath $installedRunner -Algorithm SHA256).Hash } else { $null }
$sourceHash = (Get-FileHash -LiteralPath $sourceRunner -Algorithm SHA256).Hash
if ($existingHash -and $existingHash -ne $sourceHash) { throw 'Protected runner already exists with a different hash; refusing replacement.' }
if (-not $existingHash) { Copy-Item -LiteralPath $sourceRunner -Destination $installedRunner -Force }
if ((Get-FileHash -LiteralPath $installedRunner -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Protected runner hash verification failed after installation.' }
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($identity in @('NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
}
Set-Acl -LiteralPath $installRoot -AclObject $acl
$fileAcl = New-Object System.Security.AccessControl.FileSecurity
$fileAcl.SetAccessRuleProtection($true, $false)
foreach ($identity in @('NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
    $fileAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'None', 'None', 'Allow')))
}
Set-Acl -LiteralPath $installedRunner -AclObject $fileAcl
$unexpectedAcl = @(Get-Acl -LiteralPath $installedRunner | Select-Object -ExpandProperty Access | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference -notin @('NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators') })
if ($unexpectedAcl.Count -gt 0) { throw 'Protected runner ACL grants access outside SYSTEM and Administrators.' }

$node = (Get-Command node.exe -ErrorAction Stop).Source
$taskAction = "`"$node`" `"$installedRunner`" --mode preflight --sha $ApprovedSha --release-root `"$ReleaseRoot`""
$task = New-ScheduledTaskAction -Execute $node -Argument "`"$installedRunner`" --mode preflight --sha $ApprovedSha --release-root `"$ReleaseRoot`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2)
$trigger.Enabled = $false
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$definition = New-ScheduledTask -Action $task -Trigger $trigger -Principal $principal -Settings $settings -Description 'ATLAS manually-triggered, preflight-only release gate. Cutover requires a separate approved HIGH packet.'
if ($PSCmdlet.ShouldProcess($TaskName, "Register disabled SYSTEM highest-privilege task: $taskAction")) {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        $existingAction = $existingTask.Actions | Select-Object -First 1
        $expectedArgs = "`"$installedRunner`" --mode preflight --sha $ApprovedSha --release-root `"$ReleaseRoot`""
        if ($existingAction.Execute -ne $node -or $existingAction.Arguments -ne $expectedArgs) { throw "Task '$TaskName' already exists with a mismatched action; refusing overwrite." }
        Write-Output "Verified existing enabled on-demand task '$TaskName'; no overwrite performed."
    } else {
        Register-ScheduledTask -TaskName $TaskName -InputObject $definition | Out-Null
        Write-Output "Registered enabled on-demand task '$TaskName' with its trigger disabled. It does not start automatically."
    }
}
