# Runtime release-directory retention — successor manifest 20260926a

**Cycle:** successor reclaim required before the isolated `116a7658` F1/F2 release build. **Base:**
current `origin/main` before the target record commit. **Trigger:** E: is below the §3 50 GiB warning
(current preflight 45.71 GiB free; D: 60.67 GiB). Reclaim C was discharged only for the prior
`861d89a2` build and is not reused.

**Policy:** keep live `861d89a2`, rollback `eb0e3038`, the second-most-recent accepted release
`c5e167d7`, the frozen donor `5c100ea6`, the D: last-resort artifacts, and the deferred standalone
clone `4893cbde`. Retire only rollback depth beyond that. Rows are removed one at a time, exact
literal paths, non-forced, no branch deletion.

## Retire row

| Path | HEAD | Status | Ancestor | Reparse | Borrower | Size |
|---|---|---|---|---|---:|---:|
| `E:\ATLAS-runtime-supervised-ad8f9717-20260925` | `ad8f971787cd004d9aeb040d362a9acd3e290074` | `?? ops/runtime/logs/` only | yes | none | 0 | 1.46 GiB |

## Keep / out of scope

- Live `E:\ATLAS-runtime-supervised-861d89a2-20260925`.
- Rollback `E:\ATLAS-runtime-supervised-eb0e3038-20260925`.
- Second accepted release `E:\ATLAS-runtime-supervised-c5e167d7-20260925`.
- Donor `E:\ATLAS-runtime-supervised-5c100ea6-20260925`.
- `E:\ATLAS-runtime-supervised-4893cbde-20260923` standalone clone, deferred to its own manifest.
- D: runtime/config/PostgreSQL, `D:\ATLAS`, all lane worktrees, and all other release directories.

## Method

1. Re-verify exact HEAD, complete status only `?? ops/runtime/logs/`, ancestry, no reparse dependency,
   no borrower, and not the active machine source.
2. Remove only `ops/runtime/logs/` after confirming it is not the active supervisor state.
3. `git worktree remove <exact path>` without force; then `git worktree prune`.
4. Record E: free space after removal. No branch deletion, no raw recursive deletion, no computed paths.

A fresh independent pre-action audit must return `ACCEPT_READY` with `passed == total`, `blocked: 0`,
`unperformed: 0` before any removal. A fresh post-action audit must verify the keep set, retired path,
branch refs, capacity, live `861d89a2` identity/health, and zero residue.
