# Step 1 of a release (NOT elevated). Builds a release tree for one main SHA and proves both builds exist.
# Usage: release-prepare.ps1 [-Sha <40-hex>]   (default: origin/main)
# Output: one JSON line { sha, dir, reused, serverDist, clientDist, seconds }. Exit 1 on any failure.
# Rule 19: a release without atlas-server/dist/server.js AND atlas-client/dist/index.html is never offered.
param([string]$Sha = '')
$ErrorActionPreference = 'Stop'
$t0 = Get-Date
$repo = 'D:\ATLAS'
git -C $repo fetch -q origin
if (-not $Sha) { $Sha = (git -C $repo rev-parse origin/main).Trim() }
if ($Sha -notmatch '^[0-9a-f]{40}$') { throw "Sha must be 40 lowercase hex: $Sha" }
git -C $repo merge-base --is-ancestor $Sha origin/main
if ($LASTEXITCODE -ne 0) { throw "REFUSED: $Sha is not on origin/main" }

$dir = "E:\ATLAS-worktrees\lane-a4-release-$(Get-Date -Format yyyyMMdd)-$($Sha.Substring(0,8))"
$existing = Get-ChildItem 'E:\ATLAS-worktrees' -Directory -Filter "lane-a4-release-*-$($Sha.Substring(0,8))" -EA SilentlyContinue | Select-Object -First 1
if ($existing) { $dir = $existing.FullName }
$serverDist = Join-Path $dir 'atlas-server\dist\server.js'
$clientDist = Join-Path $dir 'atlas-client\dist\index.html'

function Invoke-Step([string]$Where, [string]$Exe, [string[]]$ArgList) {
  Push-Location $Where
  try {
    # npm uses stderr for advisory warnings. Do not turn a successful native exit into a PowerShell terminating error.
    $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Exe @ArgList 2>&1 | Out-Host; $exitCode = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previousPreference }
    if ($exitCode -ne 0) { throw "$Exe $($ArgList -join ' ') failed in $Where ($exitCode)" }
  }
  finally { Pop-Location }
}

$reused = $false
if ((Test-Path $serverDist) -and (Test-Path $clientDist) -and ((git -C $dir rev-parse HEAD).Trim() -eq $Sha) -and -not (git -C $dir status --porcelain --untracked-files=no)) {
  $reused = $true
} else {
  if (-not (Test-Path $dir)) { git -C $repo worktree add -q --detach $dir $Sha; if ($LASTEXITCODE -ne 0) { throw 'worktree add failed' } }
  if ((git -C $dir rev-parse HEAD).Trim() -ne $Sha) { throw "REFUSED: $dir is not at $Sha" }
  # Each release owns its dependencies (no junctions into shared trees; agent-runtime-deploy-facts.md).
  foreach ($d in @($dir, "$dir\atlas-server", "$dir\atlas-client")) {
    $nm = Join-Path $d 'node_modules'
    if ((Test-Path $nm) -and ((Get-Item $nm -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "REFUSED: $nm is a junction" }
    Invoke-Step $d 'npm.cmd' @('ci', '--no-audit', '--no-fund')
  }
  Invoke-Step "$dir\atlas-server" 'npx.cmd' @('prisma', 'generate', '--schema', '../prisma/schema.prisma')
  Invoke-Step "$dir\atlas-server" 'npm.cmd' @('run', 'build')
  $env:VITE_ENROLLPRO_URL = 'https://dev-jegs.buru-degree.ts.net'
  Invoke-Step "$dir\atlas-client" 'npm.cmd' @('run', 'build')
}
if (-not (Test-Path $serverDist)) { throw "NO_SERVER_DIST: $serverDist" }
if (-not (Test-Path $clientDist)) { throw "NO_CLIENT_DIST: $clientDist" }
[pscustomobject]@{ sha = $Sha; dir = $dir; reused = $reused; serverDist = $true; clientDist = $true; seconds = [int]((Get-Date) - $t0).TotalSeconds } | ConvertTo-Json -Compress
