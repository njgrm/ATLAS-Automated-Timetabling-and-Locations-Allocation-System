# Runtime release-directory retention — frozen manifest C (2026-09-25)

**Cycle:** reclaim C before the `861d89a2` release build. **Base:** `origin/main`
`b7cd0ea6de11e2e61f6ee3aadc485a34bab102b6`. **Policy:**
`docs/reference/agent-worktree-lifecycle.md` — keep the live release, the two most recent accepted
releases/rollback basis, the two named last-resort artifacts, and one real dependency source; retire
rollback depth beyond that. This is a fresh survey: manifest B is stale after the `eb0e3038` cutover
and is not reused.

**Trigger:** E: is 44.73 GiB free, below the §3 50 GiB warning. The next `861d89a2` release build
must not start until this audited reclaim runs and capacity is rechecked. The two compliant rows
reclaim approximately 2.94 GiB, taking E: to approximately 47.67 GiB — still below the 50 GiB
warning but far above the 25 GiB fail-closed line, so the release build is unblocked by capacity.

Rows are removed one at a time, non-forced, from the exact literal paths below. No glob, computed
path, `--force`, or branch deletion.

## Keep set (E:) — NOT retired

| Path | Role |
|---|---|
| `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | **live release**; supervisor-owned 5001/5174 |
| `E:\ATLAS-runtime-supervised-c5e167d7-20260925` | current rollback basis |
| `E:\ATLAS-runtime-supervised-ad8f9717-20260925` | second-most-recent accepted release; recorded rollback basis (not yet displaced) |
| `E:\ATLAS-runtime-supervised-5c100ea6-20260925` | frozen dependency donor for the next release |

**Keep-set basis:** live `eb0e3038` is confirmed by the scheduled task, supervisor/server/host PIDs,
and active state; the two most recent accepted releases are `c5e167d7` (20:40) and `ad8f9717`
(17:12); the D: supervisor reset and manual fallback are the named last-resort artifacts; `5c100ea6`
is the one dependency source. Once `861d89a2` is deployed and accepted, `ad8f9717` drops from the keep
set and becomes retirable under a later manifest.

## Out of scope — untouched

- `D:\ATLAS-runtime-supervised-20260912` — supervisor reset baseline.
- `D:\ATLAS-runtime-fallback-d44-20260912` — manual fallback.
- `E:\ATLAS-runtime-supervised-4893cbde-20260923` (1.80 GiB) — standalone clone with its own `.git`,
  not a registered worktree; not live, not one of the two most recent accepted releases, not a
  last-resort artifact, and not the dependency source. `git worktree remove` does not apply and raw
  recursive deletion is prohibited by §3; **deferred to its own manifest and audit**.
- `D:\ATLAS-runtime-*`, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion repositories, `D:\ATLAS`,
  `E:\ATLAS-worktrees`, and every Lane A/B/C worktree.

## Retire rows (E:)

| # | Exact path | HEAD | status | ancestor of `origin/main` | reparse/junction | active borrower | size |
|---:|---|---|---|---|---|---:|---:|
| 1 | `E:\ATLAS-runtime-supervised-82871619-20260925` | `82871619de4a031ba0d79c116db67b2fef00e2b2` | `?? ops/runtime/logs/` only | yes | none | 0 | 1.46 GiB |
| 2 | `E:\ATLAS-runtime-supervised-ff87b06b-20260925` | `ff87b06bfb33dee5817a357ad0080d9338c5106e` | `?? ops/runtime/logs/` only | yes | none | 0 | 1.48 GiB |

The only non-clean path in each row is the untracked runtime log directory. No release process,
reparse point, or junction depends on these rows. Their product trees are clean and their SHAs are
ancestors of `origin/main`; the directories are rebuildable by detached worktree + dependency copy +
Prisma generate + builds.

## Method (per row, exact order)

1. Re-verify HEAD, complete `git status --short`, ancestry, no reparse dependency, and no process
   borrower. If any differs, stop the row and preserve it.
2. Remove the `ops/runtime/logs/` directory (untracked `supervisor-state.json` plus gitignored
   `atlas-supervisor.log`) after confirming it is not the active supervisor state for the live
   release. This is required for the non-forced `git worktree remove` to be legal.
3. `git worktree remove <exact-validated-path>` — non-forced, one row at a time.
4. After all rows, `git worktree prune` and record post-reclaim E: free space.
5. Never delete branches. Never touch the keep set or out-of-scope paths.

## Gate

A fresh independent pre-action auditor must review this manifest and return `ACCEPT_READY` with
`passed == total`, `blocked: 0`, `unperformed: 0` before the executor removes any row. A fresh
post-action auditor must verify the keep set, retired rows, branch refs, E: free space, live runtime
identity, and zero residue after removal. Any unexpected borrower, dirty tree, or live-state change
is an incident stop.
