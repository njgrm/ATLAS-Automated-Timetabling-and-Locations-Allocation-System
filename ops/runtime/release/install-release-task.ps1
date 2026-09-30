# One-time setup, run by the OPERATOR in an elevated PowerShell. Re-run it to pick up a reviewed change to
# release-task.ps1 or deploy-runner.ps1 (the task never runs the repo copies, so an agent commit cannot change
# what runs as SYSTEM).
#   powershell -ExecutionPolicy Bypass -File D:\ATLAS\ops\runtime\release\install-release-task.ps1
$ErrorActionPreference = 'Stop'
$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this in an elevated (Administrator) PowerShell.' }
$box = 'C:\ProgramData\ATLAS\release'
foreach ($d in 'bin', 'inbox', 'results', 'logs') { New-Item -ItemType Directory -Force "$box\$d" | Out-Null }
Copy-Item "$PSScriptRoot\release-task.ps1" "$box\bin\release-task.ps1" -Force
Copy-Item "$PSScriptRoot\..\deploy-runner.ps1" "$box\bin\deploy-runner.ps1" -Force
# bin: Administrators and SYSTEM only. inbox: the operator's account may write requests. results/logs: readable.
$user = "$env:USERDOMAIN\$env:USERNAME"
icacls "$box\bin" /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
icacls "$box\inbox" /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' "${user}:(OI)(CI)M" | Out-Null
icacls "$box\results" /grant "${user}:(OI)(CI)RX" | Out-Null
icacls "$box\logs" /grant "${user}:(OI)(CI)RX" | Out-Null
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$box\bin\release-task.ps1`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -StartWhenAvailable
Register-ScheduledTask -TaskName 'ATLAS Release' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
"Installed. Task 'ATLAS Release' polls $box\inbox every minute as SYSTEM, running the pinned copies in $box\bin."
