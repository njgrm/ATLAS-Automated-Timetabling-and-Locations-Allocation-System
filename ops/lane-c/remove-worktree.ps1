# Safe worktree removal. Usage: remove-worktree.ps1 -Path E:\ATLAS-worktrees\<name>
# 2026-09-30 17:11: `git worktree remove --force` followed node_modules junctions into D:\ATLAS and emptied the shared
# root and atlas-server node_modules (a bash fsutil check missed them). Unlink every reparse point first, then remove.
param([Parameter(Mandatory)][string]$Path)
$full = (Resolve-Path $Path).Path
if ($full -notlike 'E:\ATLAS-worktrees\*') { throw "Refusing: $full is not under E:\ATLAS-worktrees" }
$links = @(Get-ChildItem $full -Directory -Recurse -Depth 3 -Force -Attributes ReparsePoint -EA SilentlyContinue)
foreach ($l in $links) { cmd /c rmdir "$($l.FullName)"; "unlinked $($l.FullName)" }
$left = @(Get-ChildItem $full -Directory -Recurse -Depth 3 -Force -Attributes ReparsePoint -EA SilentlyContinue)
if ($left.Count) { throw "Links remain, not removing: $($left.FullName -join ', ')" }
git -C D:\ATLAS worktree remove --force $full
if (-not (Test-Path 'D:\ATLAS\atlas-client\node_modules\vite\client.d.ts') -or -not (Test-Path 'D:\ATLAS\atlas-server\node_modules\typescript')) { throw 'SHARED NODE_MODULES DAMAGED: run npm ci in D:\ATLAS and D:\ATLAS\atlas-server, then prisma generate --schema ../prisma/schema.prisma' }
"removed $full"
