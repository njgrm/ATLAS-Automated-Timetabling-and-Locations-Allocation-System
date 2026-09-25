# Runtime release-directory retention — post-action report (2026-09-25, reclaim B)

- **Manifest (frozen):** `docs/reviews/runtime-dir-retention-20260925b/manifest.md` at `origin/main`
  `43d118bdc172967313590e7b1180b48dfa49b15c`.
- **Pre-action audit:** `ACCEPT_READY` 18/18/0/0, blocked 0, unperformed 0, no BLOCKING findings.
  The flagged standalone clone was ruled **DEFER**.
- **Executed:** the 12 registered-worktree rows removed **non-forced**, one row at a time, after clearing
  the untracked `ops/runtime/logs/` and verifying `git status --short` empty; then `git worktree prune`.
  Exact literal paths only; no `--force`, no glob, no computed path.

## Result

| Item | Before | After |
| --- | --- | --- |
| E: `ATLAS-runtime-supervised-*` release dirs | 16 | **4** (3 keep + 1 deferred) |
| E: free | 44.63 GiB | **60.79 GiB** (+16.16) |
| D: free | 60.84 GiB | 60.85 GiB (unchanged) |
| Registered worktrees (`D:\ATLAS`) | ~44 | 32 |
| Local branches | (not recorded pre-action) | 469 — **none deleted** |

Removed (12): `002c8879`, `066da7a7`, `37e0c85b`, `426b6ac8`, `514be157`, `70a51608`, `89295c27`,
`a5f7384e`, `b6687fee`, `c7fc0c95`, `e475c673`, `e8553752` (all registered worktrees, detached,
HEAD == recorded SHA, ancestor of `origin/main`).

## Keep-set intact (E:)

`ad8f9717` (**live**), `82871619` (rollback basis), `ff87b06b` (`82871619`'s rollback basis).

## Deferred (not removed)

- `E:\ATLAS-runtime-supervised-4893cbde-20260923` — **standalone clone**; `git worktree remove` does not
  apply and `AGENTS.md` §3 bars the raw recursive-delete mechanism in this pass. Needs its own frozen
  manifest + pre/post audit.

## Out of scope — untouched

- `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) — supervisor reset baseline.
- `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`) — manual fallback.
- `D:\ATLAS-runtime-*`, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion repos, `D:\ATLAS`.

## Live runtime unaffected

`supervisor-state.json` `state=running`, `releaseSha=ad8f9717…`; listeners 5001→15884 / 5174→86660;
`/api/v1/health` 200; `/api/v1/health/ready` 200. No restart, no cutover.

## Carried-forward non-blocking findings (audit)

- N1: manifest trigger figure 44.63 GiB vs live 44.04 GiB at audit time (both below the 50 GiB warning).
- N2: at the frozen base the live-state still labelled `ad8f9717` deployment-pending; the runtime is
  authoritative and `origin/main` has since advanced to `d7fd8f8d` which marks it LIVE.
- N3: `E:\ATLAS-worktrees\warning-readability-c01` is on disk with a `node_modules` junction into
  `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918` and is **not** registered in `git worktree list`
  (uncertain owner / unregistered leftover) — outside this manifest.
- N4: method soundness confirmed; the only untracked entry per row is `ops/runtime/logs/` (non-reparse).

No migration, generation, publication, live-data, or companion action occurred.
