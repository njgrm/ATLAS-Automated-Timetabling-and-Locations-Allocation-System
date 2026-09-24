# Runtime release-directory retention — post-action report (2026-09-24)

- **Manifest (frozen):** `docs/reviews/runtime-dir-retention-20260924/manifest.md` at `origin/main`
  `f2b047e21d7a734d357285fcd06f43c3d1744be7`.
- **Pre-action audit:** `ACCEPT_READY` 56/56/0/0, blocked 0, unperformed 0, no BLOCKING findings.
  The flagged standalone clone was ruled **DEFER**.
- **Executed:** the 8 registered-worktree rows removed **non-forced**, one row at a time, after
  clearing the untracked `ops/runtime/logs/` and verifying `git status --short` empty; then
  `git worktree prune`. Exact literal paths only; no `--force`, no glob, no computed path.

## Result

| Item | Before | After |
| --- | --- | --- |
| E: `ATLAS-runtime-supervised-*` release dirs | 14 | **6** |
| Registered worktrees (`D:\ATLAS`) | 70 | **62** |
| E: free | 41.74 GiB | **52.86 GiB** (+11.12) |
| D: free | 37.84 GiB | 37.85 GiB (unchanged) |
| Local branches | (not recorded pre-action) | 400 — **none deleted** |

Removed (8): `d7082c9d`, `22d1f5a8`, `014b4b4c`, `09b898e6`, `6e9c87e7`, `0232bf9c`, `89012430`,
`7ac28124` (all registered worktrees, detached, HEAD == recorded SHA, ancestor of `origin/main`).

## Keep-set intact (E:)

`002c8879` (**live**), `70a51608` (current rollback), `c7fc0c95`, `514be157`, `426b6ac8`.

## Deferred (not removed)

- `E:\ATLAS-runtime-supervised-4893cbde-20260923` — **standalone clone**; `git worktree remove` does
  not apply, and `AGENTS.md` §3 "never raw recursive deletion" bars the `Remove-Item -Recurse` path
  in this pass. It needs its own frozen manifest + pre-action audit + post-action audit + empty
  reparse scan. Substance is otherwise safe (ancestor of `origin/main`; status only
  `?? ops/runtime/logs/`; zero reparse points; no owning process).

## Out of scope — untouched

- `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) — supervisor reset baseline.
- `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`) — manual fallback.
- `D:\ATLAS-runtime-*`, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion repos, `D:\ATLAS`.
- The junction target `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\atlas-server\node_modules`
  (verified present after the removals).

## Live runtime unaffected

`supervisor-state.json` `state=running`, `releaseSha=002c8879…`; listeners 5001→56236 / 5174→54932;
`/api/v1/health` 200; Tailnet `/api/v1/health` 200.

## Carried-forward non-blocking findings (future lane, not this retention set)

- Non-registered E: dirs `warning-readability-c01` and `ux-quickfix-c01` are junction borrower/host
  for the `0eb3b67fe94c` D: release tree — no impact on this set.
- Uncertain-owner dirs for a future decision: `E:\ATLAS-scratch\ufr-c01`; non-registered D: runtime
  dirs `434b2a81`, `4c7c0bd9`, `74999168`, `c93dd2ee`, `d50dde64`.
- Manifest header "Base ref `ac151be2…`" is the survey base, not the frozen commit `f2b047e2`.

No migration, generation, publication, live-data, or companion action occurred.
