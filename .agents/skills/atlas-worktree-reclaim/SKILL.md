---
name: atlas-worktree-reclaim
description: Inventory ATLAS worktrees and retire clean, integrated, inactive task worktrees under AGENTS.md §3. Use when disk space is low, when closing a lane (RETIRE_AFTER_INTEGRATION), or when asked to clean up worktrees. Not for runtime release directories.
metadata:
  short-description: Evidence-first ATLAS worktree retirement
---

# ATLAS worktree reclaim

Authority: `AGENTS.md` §3. Mechanics and history: `docs/reference/agent-worktree-lifecycle.md`.
This skill is the repeatable procedure. Run every Git command from the **shared** repository
(`D:/ATLAS`), never inside a target worktree.

## Scope — never touch

`D:/ATLAS`, Codex-managed worktrees (`~/.codex/worktrees/**`), every `*/ATLAS-runtime-*`
release directory (retention policy + frozen manifest + audits apply — a different cycle),
`D:/ATLAS-runtime-config`, PostgreSQL storage, companion repositories, `stakeholderFiles`,
backup/preservation directories. A registered total above 12 is **not** a reason to retire.

## 1. Inventory (read-only)

```bash
git fetch -q origin
git worktree list --porcelain
```

For each task worktree under `D:/ATLAS-worktrees` or `E:/ATLAS-worktrees`, record:
path, branch or detached, HEAD, complete `git -C <path> status --short`, and
`git merge-base --is-ancestor <HEAD> origin/main` (merged / not merged), plus the HEAD age.

## 2. Classify

| Class | Disposition |
|---|---|
| Dirty (any `status --short` line) | **Preserve** |
| HEAD not an ancestor of `origin/main` | **Preserve** (unintegrated or uncertain; tree-equivalence proof needs the owner) |
| Branch of an active stream, or the owner's closure is still open (e.g. integrated in the last few hours) | **Preserve** — that lane retires it |
| Clean + merged + inactive | Candidate |

## 3. Dependents — scan every root, not the target's root

A candidate is preserved if **anything links into it**. Check reparse points at the dependency
paths of every worktree root, every runtime root (`D:\`, `E:\` `ATLAS-runtime-*`), Codex
worktrees and `D:\ATLAS`:

```powershell
$sub = '', 'node_modules', 'atlas-server\node_modules', 'atlas-client\node_modules',
       'atlas-server\node_modules\.prisma', 'atlas-server\node_modules\@prisma'
# for each root r and sub s: Get-Item -LiteralPath (Join-Path r s) -Force;
# report items with the ReparsePoint attribute and their .Target
```

Then, per candidate, a full recursive reparse scan must be **empty**
(`cmd /c dir /s /b /al "<path>"`), and no process command line may reference the path
(`Get-CimInstance Win32_Process`).

## 4. Retire — one exact literal path per command

```bash
git worktree remove D:/ATLAS-worktrees/<exact-name>
git worktree prune
```

Never `--force`, never a glob, loop variable or computed path, never raw recursive deletion.
If `remove` refuses, stop and preserve that tree. Never delete a branch.

## 5. Verify and record

- Any junction whose anchor you preserved still resolves (e.g. `@prisma/client` exists through it).
- Live runtime untouched: `/api/v1/health` 200 **and** a DB-backed read (see `atlas-deploy`).
- Record free space before/after and the retired list in the lane's section of
  `docs/plans/live-state.md`, with the date and the evidence classes above.
