# Runtime retention successor reclaim 20260926a — post-action report (2026-09-26)

**Physical reclaim: `ACCEPTED`; post-action audit: `CORRECTION_REQUIRED` 12/14, 0 blocked, 0 unperformed.**
The two documentation rows were corrected additively after the audit; no evidence was deleted. Per the
audit's §11 disposition, the deterministic docs corrections clear the gate without a second audit round.

## Action

Retired exactly `E:\ATLAS-runtime-supervised-ad8f9717-20260925` at
`ad8f971787cd004d9aeb040d362a9acd3e290074`:

1. `Remove-Item -LiteralPath "...\ops\runtime\logs" -Recurse -Force`
2. `git -C D:\ATLAS worktree remove "E:\ATLAS-runtime-supervised-ad8f9717-20260925"`
3. `git -C D:\ATLAS worktree prune`

All exited 0. No force, glob, computed path, branch deletion, raw recursive tree deletion, runtime
restart, database/task/env mutation, or companion action occurred.

## Post-action evidence

- Retired path absent from disk, worktree registry, and `.git/worktrees`; 33 registered worktrees remain.
- Keep set intact: live `861d89a2`, rollback `eb0e3038`, second accepted `c5e167d7`, donor `5c100ea6`,
  deferred standalone clone `4893cbde`.
- Branch refs `fix/departure-load-transfer` and `origin/fix/departure-load-transfer` still resolve to
  `ad8f9717`; the commit remains an ancestor of `origin/main` and `116a7658`.
- E: free **45.71 → 47.23 GiB**; D: **60.67 GiB**. The 47.23 figure is still below the 50 GiB warning;
  it discharges §3 only for the next single `116a7658` build. A second build, including `9f42190e`,
  requires a fresh successor manifest and audit.
- Live `861d89a2` identity/health unchanged: supervisor tree `85536 -> 36120/62504`, listeners 5001/5174,
  health 200, readiness `database:"ok"`, DB-backed subjects read 200.
- Three pre-existing stash entries remain untouched; no new stash/reflog residue.

## Register reconciliation

The live-state register now marks `ad8f9717` **RETIRED 2026-09-26**, records that its directory is not a
usable rollback target, preserves the B1/B2 browser rows as **UNPERFORMED** and owned by Lane C, and marks
the earlier `82871619`/`ff87b06b` directories retired by reclaim `20260925c`. The measured 47.23/60.67
post-reclaim reading is recorded; older 45.72, ~47.18, 47.45, and 49.55 figures are explicitly superseded.

## Evidence note

The pre-action audit verdict and executor removal handoff were session-returned rather than committed as
separate capsule files before the action. Their decisive rows are preserved here with the exact commands and
results above; this report does not retroactively claim a capsule that was not committed.
