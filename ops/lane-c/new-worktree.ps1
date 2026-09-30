# Pinned executor worktree. Usage: new-worktree.ps1 -Name lane-<owner>-<packet> [-Base <sha>]
# Creates E:\ATLAS-worktrees\<Name> on branch work/<Name> from origin/main (or -Base), and junctions the shared
# node_modules so no install is needed. Remove it ONLY with remove-worktree.ps1 (it unlinks the junctions first).
param([Parameter(Mandatory)][string]$Name, [string]$Base = '')
$ErrorActionPreference = 'Stop'
$wt = "E:\ATLAS-worktrees\$Name"
if (Test-Path $wt) { throw "$wt exists" }
git -C D:\ATLAS fetch -q origin
if (-not $Base) { $Base = (git -C D:\ATLAS rev-parse origin/main).Trim() }
git -C D:\ATLAS worktree add -q -b "work/$Name" $wt $Base
foreach ($d in 'node_modules', 'atlas-client\node_modules', 'atlas-server\node_modules') {
  if (Test-Path "D:\ATLAS\$d") { cmd /c mklink /J "$wt\$d" "D:\ATLAS\$d" | Out-Null }
}
"$wt on work/$Name at $($Base.Substring(0,8))"
