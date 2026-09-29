# Starts ANY long-lived process (server, profiler, watcher) fully detached so a planner's shell call returns.
# Start-Process, [Diagnostics.Process]::Start and '&' all keep an opencode shell call open on Windows (2026-09-29);
# Win32_Process Create does not. Output goes to -Log. Optional -Port waits (max 60 s) for a listener.
#   powershell -File scripts/dev/start-detached.ps1 -Dir <cwd> -Command "node dist/server.js" -Log <file> [-Env 'PORT=5205;FOO=bar'] [-Port 5205]
param([Parameter(Mandatory)][string]$Dir, [Parameter(Mandatory)][string]$Command, [Parameter(Mandatory)][string]$Log, [string]$Env = '', [int]$Port = 0)
$sets = (($Env -split ';') | Where-Object { $_ -match '=' } | ForEach-Object { "set $_&& " }) -join ''
$cl = "cmd /c `"cd /d $Dir && $sets$Command > $Log 2>&1`""
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cl }
if ($Port -le 0) { "STARTED pid $($r.ProcessId) log $Log (stop with: taskkill /T /F /PID $($r.ProcessId))"; exit 0 }
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { "READY :$Port pid $($r.ProcessId) log $Log (stop with: taskkill /T /F /PID $($r.ProcessId))"; exit 0 }
  Start-Sleep -Seconds 2
}
"NOT_READY :$Port after 60 s; see $Log"; exit 1
