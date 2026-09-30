# Step 2 of a release (NOT elevated). Files a request for the elevated "ATLAS Release" task and waits for its result.
# Usage: release-request.ps1 -Dir <prepared tree> [-Mode release|dry-run] [-OperatorSaidShip] [-TimeoutMinutes 12]
# Preconditions it checks: the tree is prepared (both dists, clean, at its SHA), the target prefix AND the incumbent
# (rollback) prefix are written in '## Live release' of docs/plans/live-state.md on origin/main, and live is quiet
# (live-use-check.ps1) unless the operator wrote "ship" (-OperatorSaidShip).
# Output: the task's result JSON. Exit 0 only when status is LIVE (or DRY_RUN_OK).
param(
  [Parameter(Mandatory)][string]$Dir,
  [ValidateSet('release', 'dry-run')][string]$Mode = 'release',
  [switch]$OperatorSaidShip,
  [int]$TimeoutMinutes = 12
)
$ErrorActionPreference = 'Stop'
$repo = 'D:\ATLAS'
$box = 'C:\ProgramData\ATLAS\release'
$full = (Resolve-Path $Dir).Path
if ($full -notlike 'E:\ATLAS-worktrees\lane-a4-release-*') { throw "REFUSED: $full is not a release tree" }
$sha = (git -C $full rev-parse HEAD).Trim()
if (git -C $full status --porcelain --untracked-files=no) { throw 'REFUSED: release tree is dirty' }
foreach ($f in 'atlas-server\dist\server.js', 'atlas-client\dist\index.html') { if (-not (Test-Path (Join-Path $full $f))) { throw "REFUSED: missing $f (run release-prepare.ps1)" } }

git -C $repo fetch -q origin
$incumbent = [Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA', 'Machine')
$section = ((git -C $repo show origin/main:docs/plans/live-state.md) -join "`n") -replace '(?s)^.*?\n## Live release\s*\n', '' -replace '(?s)\n## .*$', ''
foreach ($p in @($sha.Substring(0, 8), $incumbent.Substring(0, 8))) {
  if ($section -notmatch [regex]::Escape($p)) { throw "REFUSED: '## Live release' on origin/main must name $p (target and rollback basis). Commit and push it first." }
}
if ($Mode -eq 'release' -and -not $OperatorSaidShip) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'ops\lane-c\codex\live-use-check.ps1') | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'REFUSED: live is in use or not proven quiet (live-use-check.ps1). Ask the operator.' }
}

if (Test-Path "$box\inbox\request.json") { throw 'REFUSED: a request is already pending' }
$id = "$(Get-Date -Format yyyyMMdd-HHmmss)-$($sha.Substring(0,8))"
$req = [pscustomobject]@{ id = $id; mode = $Mode; sha = $sha; dir = $full; incumbentSha = $incumbent; requestedAt = (Get-Date).ToString('o'); requestedBy = $env:USERNAME }
$tmp = "$box\inbox\request.$id.tmp"
$req | ConvertTo-Json -Compress | Set-Content -Encoding utf8 $tmp
Move-Item $tmp "$box\inbox\request.json"
"requested $id ($Mode $($sha.Substring(0,8)) over $($incumbent.Substring(0,8))); the task polls every minute"

$result = "$box\results\$id.json"
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while (-not (Test-Path $result)) {
  if ((Get-Date) -gt $deadline) { throw "TIMEOUT: no result for $id after $TimeoutMinutes min. Check $box\logs and whether the task is registered." }
  Start-Sleep -Seconds 10
}
$r = Get-Content $result -Raw
$r
if (($r | ConvertFrom-Json).status -notin @('LIVE', 'DRY_RUN_OK')) { exit 1 }
