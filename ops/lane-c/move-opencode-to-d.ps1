# Moves OpenCode's data and planner scratch from C: to D: and leaves junctions at the old paths (2026-09-30: C: filled).
# Run only with every opencode process closed (desktop app and the :4097 serve).
$ErrorActionPreference = 'Stop'
if (Get-Process opencode, OpenCode -EA SilentlyContinue) { throw 'OpenCode is still running: close the desktop app and the :4097 serve first.' }
$pairs = @(
  @{ From = "$env:USERPROFILE\.local\share\opencode"; To = 'D:\opencode-data\share' },
  @{ From = "$env:LOCALAPPDATA\Temp\opencode";         To = 'D:\opencode-data\temp' }
)
foreach ($p in $pairs) {
  $item = Get-Item $p.From -Force -EA SilentlyContinue
  if ($item -and $item.Attributes -band [IO.FileAttributes]::ReparsePoint) { "$($p.From) already linked"; continue }
  New-Item -ItemType Directory -Force $p.To | Out-Null
  if ($item) {
    robocopy $p.From $p.To /E /MOVE /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE) for $($p.From); nothing linked" }
    if (Test-Path $p.From) {
      if (@(Get-ChildItem $p.From -Recurse -Force -File -EA SilentlyContinue).Count) { throw "Files left in $($p.From); not linking" }
      Remove-Item $p.From -Recurse -Force
    }
  }
  cmd /c mklink /J "$($p.From)" "$($p.To)" | Out-Null
  "$($p.From) -> $($p.To)"
}
$db = 'D:\opencode-data\share\opencode.db'
if (Test-Path $db) { '{0:N1} GB opencode.db now on D:' -f ((Get-Item $db).Length / 1GB) }
'C: free {0:N1} GB' -f ((Get-PSDrive C).Free / 1GB)
