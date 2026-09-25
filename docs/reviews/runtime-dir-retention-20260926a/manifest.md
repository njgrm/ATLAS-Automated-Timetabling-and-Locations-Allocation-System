# Runtime release-directory retention — successor manifest 20260926a

**Cycle:** successor reclaim required before the isolated `116a7658` F1/F2 release build. **Base:**
current `origin/main` before the target record commit. **Trigger:** E: is below the §3 50 GiB warning
(current preflight 45.71 GiB free; D: 60.67 GiB). Reclaim C was discharged only for the prior
`861d89a2` build and is not reused.

**Policy:** keep live `861d89a2`, rollback `eb0e3038`, the second-most-recent accepted release
`c5e167d7`, the frozen donor `5c100ea6`, the D: last-resort artifacts, and the deferred standalone
clone `4893cbde`. Retire only rollback depth beyond that. Rows are removed one at a time, exact
literal paths, non-forced, no branch deletion. Pre-reclaim capacity is E: 45.72 GiB / D: 60.67 GiB;
retiring 1.46 GiB projects E: approximately 47.18 GiB, still below the 50 GiB warning but far above the
25/15 GiB fail-closed lines. The successor obligation is therefore discharged only for the single
release build that immediately follows this reclaim (the `116a7658` F1/F2 build). Because the
post-reclaim figure remains below 50 GiB, any second release build — including the `9f42190e` build —
re-triggers §3 and requires its own fresh successor manifest and pre-action audit. The post-action
capacity reading must be recorded rather than treated as a new reclaim loop.

`ad8f9717` is retained by `refs/heads/fix/departure-load-transfer` and
`refs/remotes/origin/fix/departure-load-transfer`, and is an ancestor of `origin/main` and `116a7658`;
the removal destroys no Git object.

## Retire row

| Path | HEAD | Status | Ancestor | Reparse | Borrower | Size |
|---|---|---|---|---|---:|---:|
| `E:\ATLAS-runtime-supervised-ad8f9717-20260925` | `ad8f971787cd004d9aeb040d362a9acd3e290074` | `?? ops/runtime/logs/` only | yes | none | 0 | 1.46 GiB |

## Pre-delete safety capture

The retire row's `ops/runtime/logs/supervisor-state.json` was read before any removal. Its verbatim contents are:

```json
{
  "contractVersion": 1,
  "stream": "RUNTIME-SUPERVISION-C01",
  "releaseLabel": "atlas-d44f29e0",
  "productPin": "d44f29e04d359ad9b18e4443b0fd4fed1daeaecd",
  "releaseSha": "ad8f971787cd004d9aeb040d362a9acd3e290074",
  "sourceDir": "E:\\ATLAS-runtime-supervised-ad8f9717-20260925",
  "state": "running",
  "startedAt": "2026-09-25T09:12:06.947Z",
  "updatedAt": "2026-09-25T09:12:06.947Z",
  "ownedPids": {
    "server": 15884,
    "client": 86660
  },
  "previous": null
}
```

Verbatim file size: **477 bytes**. SHA-256:
`0FE85443150AFED160173A5CF426E4E5C869095B4FF27150BDF3E9AFA7ACFFB0`.

PIDs `15884` and `86660` are absent. The authoritative live triple is machine
`ATLAS_RUNTIME_SOURCE_DIR=E:\ATLAS-runtime-supervised-861d89a2-20260925`, scheduled-task action
`node ...\861d89a2-20260925\ops\runtime\cli.mjs start` (Running), and the 861 supervisor process tree
`85536 -> 36120/62504`. The retire row's `state: running` is a stale superseded record under §6, not
evidence of activity. This capture is retained before the logs directory is removed.

## Keep / out of scope

- Live `E:\ATLAS-runtime-supervised-861d89a2-20260925`.
- Rollback `E:\ATLAS-runtime-supervised-eb0e3038-20260925`.
- Second accepted release `E:\ATLAS-runtime-supervised-c5e167d7-20260925`.
- Donor `E:\ATLAS-runtime-supervised-5c100ea6-20260925`.
- `E:\ATLAS-runtime-supervised-4893cbde-20260923` standalone clone, deferred to its own manifest.
- D: runtime/config/PostgreSQL, `D:\ATLAS`, all lane worktrees, and all other release directories.
- The `ad8f9717` browser rows B1/B2 remain **UNPERFORMED**, owned by Lane C; they bind release behavior,
  not this directory, and are **not discharged** by this reclaim. This manifest supersedes the prior
  `PRESERVE_FOR_DECISION` disposition recorded for that directory.

## Method

1. Re-verify exact HEAD, complete status only `?? ops/runtime/logs/`, ancestry, no reparse dependency,
   no borrower, and not the active machine source.
2. Remove only `ops/runtime/logs/` after confirming it is not the active supervisor state.
3. `git worktree remove <exact path>` without force; then `git worktree prune`.
4. Record E: free space after removal. No branch deletion, no raw recursive deletion, no computed paths.

A fresh independent pre-action audit must return `ACCEPT_READY` with `passed == total`, `blocked: 0`,
`unperformed: 0` before any removal. A fresh post-action audit must verify the keep set, retired path,
branch refs, capacity, live `861d89a2` identity/health, and zero residue. It must also reconcile
`docs/plans/live-state.md` so the retired `ad8f9717` rollback-basis row is marked retired (while its B1/B2
rows remain UNPERFORMED and owned by Lane C) and records the measured post-reclaim E: free figure.
