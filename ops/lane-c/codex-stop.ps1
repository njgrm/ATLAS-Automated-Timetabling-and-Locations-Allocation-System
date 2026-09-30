# Stops only Codex CLI jobs (the codex binary / codex.js), never an opencode planner whose prompt mentions Codex.
# 2026-09-29: a broad 'codex'+'exec' match also killed planner A5 c6 mid-step.
Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'codex.exe') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match '@openai[\/]codex[\/]bin[\/]codex\.js"?\s+exec') } | Where-Object { $_.CommandLine -notmatch 'opencode' } | ForEach-Object { "stop $($_.ProcessId) $($_.Name)"; & taskkill /T /F /PID $_.ProcessId *> $null }
