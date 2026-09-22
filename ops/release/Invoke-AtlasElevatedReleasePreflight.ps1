[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidatePattern('^[0-9a-fA-F]{40}$')] [string] $ApprovedSha,
    [Parameter(Mandatory)] [ValidatePattern('^[A-Za-z]:\\ATLAS-runtime-supervised-[0-9a-fA-F]{12}-[0-9]{8}$')] [string] $ReleaseRoot
)

$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator and run this preflight again.'
}
$sha = $ApprovedSha.ToLowerInvariant()
$root = [IO.Path]::GetFullPath($ReleaseRoot)
$leaf = [IO.Path]::GetFileName($root.TrimEnd('\'))
if ($leaf -notmatch "^ATLAS-runtime-supervised-$($sha.Substring(0,12))-[0-9]{8}$") { throw 'ReleaseRoot must be the absolute supervised release directory for ApprovedSha.' }
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "ReleaseRoot does not exist: $root" }
$repoRoot = (& git.exe -C $root rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) { throw 'ReleaseRoot is not a Git checkout.' }
$head = (& git.exe -C $root rev-parse HEAD).Trim().ToLowerInvariant()
if ($head -ne $sha) { throw "ReleaseRoot HEAD '$head' does not exactly match ApprovedSha '$sha'." }
$runner = Join-Path $repoRoot 'ops\release\elevated-release-runner.mjs'
$manifest = Join-Path $repoRoot 'ops\release\release-runner-manifest.json'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Committed release runner is missing.' }
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'Committed release runner manifest is missing.' }
$manifestValue = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
$runnerHash = (Get-FileHash -LiteralPath $runner -Algorithm SHA256).Hash.ToLowerInvariant()
if ($runnerHash -ne $manifestValue.runnerSha256.ToLowerInvariant()) { throw 'Release runner hash does not match its committed manifest.' }
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw "Fixed Node path is missing: $node" }
$arguments = @($runner, '--mode', 'preflight', '--sha', $sha, '--release-root', $root)
if (($arguments -join ' ') -match '(?i)(migrate|db\s*push|db\s*reset|reset|seed|schema|prisma)') { throw 'The preflight argument set contains a forbidden database or schema operation.' }
Write-Output 'ATLAS elevated operator preflight: read-only; no task registration, cutover, database, or runtime mutation.'
& $node @arguments
if ($LASTEXITCODE -ne 0) { throw "Preflight failed with exit code $LASTEXITCODE." }
