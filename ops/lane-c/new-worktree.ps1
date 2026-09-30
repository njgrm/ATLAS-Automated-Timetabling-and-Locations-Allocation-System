# Pinned executor worktree. Usage: new-worktree.ps1 -Name lane-<owner>-<packet> [-Base <sha>]
# Creates E:\ATLAS-worktrees\<Name> on branch work/<Name> from a pinned origin/main SHA.
# Dependency junctions point only at real D:\ATLAS directories and are removed before retirement.
param([Parameter(Mandatory)][string]$Name, [string]$Base = '')
$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw "INVALID_WORKTREE_NAME:$Name" }
foreach ($driveName in 'C','E') {
  $freeGiB = (Get-PSDrive -Name $driveName).Free / 1GB
  if ($freeGiB -lt 15) { throw "INSUFFICIENT_DISK_${driveName}:$([math]::Round($freeGiB,1))GiB" }
  if ($freeGiB -lt 25) { Write-Warning "LOW_DISK_${driveName}:$([math]::Round($freeGiB,1))GiB" }
}
$wt = "E:\ATLAS-worktrees\$Name"
if (Test-Path $wt) { throw "$wt exists" }
git -C D:\ATLAS fetch -q origin
if (-not $Base) { $Base = (git -C D:\ATLAS rev-parse origin/main).Trim() }
git -C D:\ATLAS cat-file -e "$Base^{commit}"
git -C D:\ATLAS worktree add -q -b "work/$Name" $wt $Base
foreach ($d in 'node_modules', 'atlas-client\node_modules', 'atlas-server\node_modules') {
  $donor = "D:\ATLAS\$d"
  if (Test-Path -LiteralPath $donor) {
    if ((Get-Item -LiteralPath $donor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw "DEPENDENCY_DONOR_IS_REPARSE_POINT:$donor"
    }
    cmd /c mklink /J "$wt\$d" "$donor" | Out-Null
  }
}
"$wt on work/$Name at $($Base.Substring(0,8))"
