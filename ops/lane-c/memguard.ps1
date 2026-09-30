# Lane C memory guard: every 15 s, kill any node process over 4 GB private memory that is not a live/staging server. Logs kills.
$log = 'D:\ATLAS-lane-c\memguard.log'
function Cut([string]$s, [int]$n) { if (-not $s) { return '' }; $s = $s -replace '\s+', ' '; if ($s.Length -gt $n) { return $s.Substring($s.Length - $n) }; return $s }
Add-Content -Path $log -Value ("{0} guard started pid {1}" -f (Get-Date -Format 'HH:mm:ss'), $PID)
while ($true) {
  try {
    foreach ($pr in @(Get-Process node -EA SilentlyContinue)) {
      if ($pr.PrivateMemorySize64 -lt 4GB) { continue }
      $ci = Get-CimInstance Win32_Process -Filter "ProcessId=$($pr.Id)" -EA SilentlyContinue
      $cmd = [string]$ci.CommandLine
      if ($cmd.Contains('server.js') -or $cmd.Contains('ATLAS-staging') -or $cmd.Contains('lane-a4-release')) { continue }
      $gb = [math]::Round($pr.PrivateMemorySize64 / 1GB, 1)
      Stop-Process -Id $pr.Id -Force -Confirm:$false -EA SilentlyContinue
      $line = '{0} KILLED pid {1} {2} GB :: {3}' -f (Get-Date -Format 'HH:mm:ss'), $pr.Id, $gb, (Cut $cmd 200)
      Add-Content -Path $log -Value $line; Write-Output $line
    }
  } catch { Add-Content -Path $log -Value ("{0} guard error: {1}" -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) }
  Start-Sleep -Seconds 15
}
