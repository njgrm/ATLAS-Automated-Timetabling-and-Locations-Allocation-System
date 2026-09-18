#requires -Version 5.1
<#
  ATLAS supervised-runtime log viewer.

  The supervisor runs as SYSTEM in the background and merges BOTH children's
  stdout/stderr into one file, prefixing each line with [server] or [client].
  This viewer tails that file in an interactive console window so the operator
  can actually watch the client and server.

  Read-only. It never starts, stops, restarts, or modifies the runtime; closing
  the window only stops the tail, the runtime keeps running.

  The log location is resolved from the machine environment so the viewer always
  follows the currently deployed release.
#>
[CmdletBinding()]
param(
	[ValidateSet('all', 'server', 'client')]
	[string]$Stream = 'all'
)

$sourceDir = $env:ATLAS_RUNTIME_SOURCE_DIR
if ([string]::IsNullOrWhiteSpace($sourceDir)) {
	Write-Host 'ATLAS_RUNTIME_SOURCE_DIR is not set; cannot locate the supervisor log.' -ForegroundColor Red
	Write-Host 'Set it to the deployed release directory and reopen this window.' -ForegroundColor DarkGray
	return
}

$log = Join-Path $sourceDir 'ops/runtime/logs/atlas-supervisor.log'
if (-not (Test-Path -LiteralPath $log)) {
	Write-Host "Supervisor log not found at: $log" -ForegroundColor Red
	Write-Host 'The supervised runtime may not have started yet.' -ForegroundColor DarkGray
	return
}

$title = switch ($Stream) {
	'server' { 'ATLAS SERVER' }
	'client' { 'ATLAS CLIENT (production host)' }
	default { 'ATLAS SUPERVISED RUNTIME (server + client)' }
}
try { $Host.UI.RawUI.WindowTitle = "$title  -  $log" } catch { }

Write-Host "=== $title ===" -ForegroundColor Cyan
Write-Host "release : $sourceDir" -ForegroundColor DarkGray
Write-Host "log     : $log" -ForegroundColor DarkGray
Write-Host 'following (tail 60). Ctrl+C or close this window to stop watching; the runtime is unaffected.' -ForegroundColor DarkGray
Write-Host ''

if ($Stream -eq 'all') {
	Get-Content -LiteralPath $log -Wait -Tail 60
} else {
	Get-Content -LiteralPath $log -Wait -Tail 60 | Where-Object { $_ -match "\[$Stream\]" }
}
