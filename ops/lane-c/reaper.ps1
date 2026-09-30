# Kills any planner shell call (powershell/pwsh/bash child of an `opencode run` process) older than $Min minutes, whole tree.
# The tool call then returns an error and the planner continues, instead of hanging for hours (2026-09-29: ~9 planner-hours lost).
param([int]$Min = 20, [string]$Log = "$PSScriptRoot\reaper.log")
$all = Get-CimInstance Win32_Process
$runs = $all | Where-Object { $_.Name -eq 'opencode.exe' -and $_.CommandLine -match ' run ' }
foreach ($r in $runs) {
  foreach ($c in ($all | Where-Object { $_.ParentProcessId -eq $r.ProcessId -and $_.Name -match '^(powershell|pwsh|bash|cmd)\.exe$' -and $_.CommandLine -notmatch 'playwright|mcp' })) {
    $age = ((Get-Date) - $c.CreationDate).TotalMinutes
    if ($age -lt $Min) { continue }
    $cmd = ($c.CommandLine -replace '\s+', ' '); $cmd = $cmd.Substring(0, [Math]::Min(200, $cmd.Length))
    $lane = if ($r.CommandLine -match 'Lane C, [0-9:]+: ([A-Za-z0-9]+ ?c?[0-9]*)') { $Matches[1] } else { "run $($r.ProcessId)" }
    & taskkill /T /F /PID $c.ProcessId *> $null
    $line = '{0:yyyy-MM-dd HH:mm} REAPED {1} pid {2} after {3:N0} min: {4}' -f (Get-Date), $lane, $c.ProcessId, $age, $cmd
    Add-Content -LiteralPath $Log -Value $line; Write-Output $line
  }
}
# Token relays: a QA subagent served the staging session token on :5399 with CORS * (2026-09-29 15:20). Kill any
# node whose command line names a relay/token server, wherever it was started.
foreach ($t in ($all | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'relay|token-server' })) {
  & taskkill /T /F /PID $t.ProcessId *> $null
  $line = '{0:yyyy-MM-dd HH:mm} REAPED token relay pid {1}: {2}' -f (Get-Date), $t.ProcessId, $t.CommandLine
  Add-Content -LiteralPath $Log -Value $line; Write-Output $line
}
# Live runs as SYSTEM and cannot be raised from here, so keep every user-owned planner/test/browser process at
# BelowNormal; live then wins the CPU (2026-09-29: 5.5 s event-loop stalls on live while planners built and tested).
foreach ($p in Get-Process -Name opencode, node, chrome, chromium, headless_shell, tsc, esbuild, codex -ErrorAction SilentlyContinue) {
  try { if ($p.PriorityClass -eq 'Normal' -or $p.PriorityClass -eq 'AboveNormal') { $p.PriorityClass = 'BelowNormal' } } catch { }
}
