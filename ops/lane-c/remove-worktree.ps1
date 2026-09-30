# Safe worktree removal. Usage: remove-worktree.ps1 -Path E:\ATLAS-worktrees\<name>
# Unlink junctions first; then Git's non-force removal refuses a dirty or unmerged tree.
param([Parameter(Mandatory)][string]$Path)
$full = (Resolve-Path $Path).Path
if ($full -notlike 'E:\ATLAS-worktrees\*') { throw "Refusing: $full is not under E:\ATLAS-worktrees" }
$status = @(git -C $full status --short)
if ($status.Count) { throw "WORKTREE_DIRTY:$full" }
$head = (git -C $full rev-parse HEAD).Trim()
git -C D:\ATLAS fetch -q origin
git -C D:\ATLAS merge-base --is-ancestor $head origin/main
if ($LASTEXITCODE -ne 0) { throw "WORKTREE_NOT_INTEGRATED:$head" }
$links = @(Get-ChildItem $full -Directory -Recurse -Depth 3 -Force -Attributes ReparsePoint -EA SilentlyContinue)
foreach ($l in $links) { cmd /c rmdir "$($l.FullName)"; "unlinked $($l.FullName)" }
$left = @(Get-ChildItem $full -Directory -Recurse -Depth 3 -Force -Attributes ReparsePoint -EA SilentlyContinue)
if ($left.Count) { throw "Links remain, not removing: $($left.FullName -join ', ')" }
git -C D:\ATLAS worktree remove $full
if (-not (Test-Path 'D:\ATLAS\atlas-client\node_modules\vite\client.d.ts') -or -not (Test-Path 'D:\ATLAS\atlas-server\node_modules\typescript')) { throw 'SHARED NODE_MODULES DAMAGED: run npm ci in D:\ATLAS and D:\ATLAS\atlas-server, then prisma generate --schema ../prisma/schema.prisma' }
"removed $full"
