# Lane C: dev servers a planner left in the foreground (the 2026-09-28 A6/A5/A3 hang). Excludes live and staging servers.
$now = Get-Date
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -match 'vite(\.js)?\S*\s+preview|vite\.js"?\s*$|npm-cli\.js.*\b(dev|preview)\b|dist[/\]server\.js' -and
  $_.CommandLine -notmatch 'ATLAS-staging|lane-a4-release' -and
  ($now - $_.CreationDate).TotalMinutes -gt 10
} | ForEach-Object {
  $cwd = ''; try { $cwd = (Get-Process -Id $_.ProcessId).Path } catch {}
  $cmd = ($_.CommandLine -replace '\s+', ' '); if ($cmd.Length -gt 110) { $cmd = $cmd.Substring(0,110) }
  'STUCK-SERVER pid {0} age {1}min :: {2}' -f $_.ProcessId, [int]($now - $_.CreationDate).TotalMinutes, $cmd
}
