# Worktree And Dependency-Tree Lifecycle

Referenced by `AGENTS.md` §3. **Read this before creating, retiring, or cleaning up any
worktree, release directory, or dependency tree.** `AGENTS.md` remains the authority; this
file holds the mechanics so the directive stays short.

## Roots and capacity

- `E:/ATLAS-worktrees` is the root for every new planner, executor, QA, audit, and
  integration worktree. `D:/ATLAS-worktrees` is legacy-retention only — no new worktree
  there without an explicit operator decision. Branches, commits and pushed artifacts
  preserve history; retaining every checkout does not.
- Before creating a worktree, installing dependencies, or starting a heavy build, record the
  target volume's free space. On `D:`, **warn below 25 GiB, fail closed below 15 GiB** —
  PostgreSQL lives on `D:`, so database headroom is part of the gate.
- Keep at most **12 active task worktrees** across both roots. Integration worktrees count
  and must not persist as historical evidence.
- **The cap is on *active* worktrees — never on the registered total.** `git worktree list`
  necessarily includes trees that must be preserved by rule: dirty worktrees, unmerged
  candidates, `node_modules` junction anchors, the never-retire `D:\ATLAS-runtime-*` release
  trees, Codex-managed worktrees, and `D:/ATLAS` itself. A registry count above 12 is therefore
  **not** a blocker and is never a reason to retire something uncertain. Observed 2026-09-21:
  exactly this misreading — reading the cap as a registry total — stalled Lane B's integration
  when the correct reading would have let it proceed immediately. If capacity genuinely
  pressures a lane, ask the planner to free space through the audited reclaim path; do not
  retire on your own authority.

## Disposition

Every handoff states one: `KEEP_ACTIVE`, `RETIRE_AFTER_INTEGRATION`, or
`PRESERVE_FOR_DECISION`. Retire a candidate's clean inactive worktrees in the same closure
that integrates and pushes it.

## Before retiring anything, record

Exact path, branch or detached state, HEAD, the complete `git status --short`, ancestry or
tree-equivalence evidence, and any active process using it.

**Preserve every dirty worktree, unintegrated candidate, active stream, and uncertain
owner.**

## Retiring

`git worktree remove <exact-validated-path>` then `git worktree prune`.

Never `--force`, never raw recursive deletion, never a glob or a computed path. Retirement
never authorises branch deletion.

## Never retire or modify

`D:/ATLAS`, Codex-managed worktrees, `D:/ATLAS-runtime-*`, `D:/ATLAS-runtime-config`,
PostgreSQL storage, companion repositories, `stakeholderFiles`, or preservation/backup
directories.

## Dependency trees

- **Do not chain `node_modules` junctions across releases.** Junction only to a *stable*
  target: a chain rooted at a retired release breaks `@prisma/client` for every release at
  once, which has already taken the live runtime down. Each release owns its dependency tree
  or junctions to one that will not be retired.
- Never run an install through a shared junction, and never count or delete its target
  during cleanup.
- A release that is a rollback basis is a do-not-retire dependency: record it in
  `docs/plans/live-state.md` when a deployment makes it one.
