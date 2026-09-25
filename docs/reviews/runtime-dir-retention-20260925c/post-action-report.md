# Runtime release-directory retention reclaim C — post-action report (2026-09-25)

**Verdict: `ACCEPT_READY` — 17/17 passed, 0 blocked, 0 unperformed.** Fresh post-action wave
audit closed the frozen manifest at `9a14295a`. No deployment, runtime restart, database, task,
environment, or companion action occurred.

## Retired rows

| Path | HEAD | Result |
|---|---|---|
| `E:\ATLAS-runtime-supervised-82871619-20260925` | `82871619de4a031ba0d79c116db67b2fef00e2b2` | Removed non-forced; logs cleared; worktree pruned |
| `E:\ATLAS-runtime-supervised-ff87b06b-20260925` | `ff87b06bfb33dee5817a357ad0080d9338c5106e` | Removed non-forced; logs cleared; worktree pruned |

Both were registered worktrees, ancestors of `origin/main`, had no reparse/junction dependency and
no process borrower. Their stale `supervisor-state.json` files named dead PIDs and were not live
state. No branch was deleted; both commits remain reachable ancestors and remote Lane C refs.

## Keep set verified

- Live: `E:\ATLAS-runtime-supervised-eb0e3038-20260925` (`eb0e3038`).
- Rollback depth: `c5e167d7` and `ad8f9717` preserved.
- Dependency donor: `5c100ea6` preserved and clean.
- Standalone clone `E:\ATLAS-runtime-supervised-4893cbde-20260923` preserved and explicitly
  deferred to its own manifest/audit; it is not a registered worktree and was not raw-deleted.
- D: supervisor reset baseline, manual fallback, runtime config, PostgreSQL storage, `D:\ATLAS`,
  all lane worktrees, and the runtime release set were untouched.

## Capacity and live identity

- E: free space: **44.73 GiB → 47.80 GiB** (approximately 3.07 GiB reclaimed); D: 60.67 GiB.
- E: remains below the 50 GiB warning but far above the 25 GiB fail-closed line. The §3 reclaim
  obligation is discharged once; this post-reclaim reading is the accepted capacity recheck for the
  `861d89a2` build.
- Live identity was re-proved from machine environment, scheduled task action, process tree,
  listeners, active state, `/api/v1/health`, `/api/v1/health/ready`, DB-backed subjects read, and
  `/__host/live`: all identify `eb0e3038` on supervisor-owned ports 5001/5174.

## Residuals

- The three historical stash entries dated 2026-09-18/19 predate this reclaim; count unchanged.
- Keep-set stale state files remain on disk but are not authoritative; future identity checks must
  use machine env + task action + process tree + listeners, never a bare `cli.mjs status` from a
  keep row.
- `4893cbde` remains `PRESERVE_FOR_DECISION` for a future standalone-clone manifest.
- The reclaimed E: volume remains below the warning line; do not run another reclaim loop for the
  same trigger. A later accepted deployment may displace `ad8f9717` under a new manifest.

**Post-action audit model:** `opencode-go/space-bunny-free`.
