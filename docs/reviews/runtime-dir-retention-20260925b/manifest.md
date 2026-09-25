# Runtime release-directory retention — frozen manifest (2026-09-25, reclaim B)

**Base ref:** `origin/main` `5c100ea6d385d162189ffceca0479db5793ef611`
**Policy:** `docs/reference/agent-worktree-lifecycle.md` — keep the live release, the two most recent
accepted releases, the two named last-resort artifacts (supervisor reset baseline + manual fallback), and
one real dependency source; retire rollback depth beyond that. A deep rollback is a **rebuild**. Any
reclaim still requires the frozen-manifest + pre-action audit.

**Trigger:** `E:` was at **44.63 GiB free — below the 50 GiB warning**; `AGENTS.md` §3 requires the
release-directory retention reclaim before the next release build. This is the reclaim deferred by the
2026-09-25 `82871619` deviation note in `docs/plans/live-state.md`.

Rows are removed one at a time, non-forced, from the exact literal path recorded here. No glob, no
computed path, no `--force`, no branch deletion.

## Keep-set (E:) — NOT retired

| Path | Role |
| --- | --- |
| `E:\ATLAS-runtime-supervised-ad8f9717-20260925` | **live release** (machine `ATLAS_RUNTIME_SOURCE_DIR`; supervisor `cli.mjs start` runs from here) |
| `E:\ATLAS-runtime-supervised-82871619-20260925` | rollback basis for the live release; browser-accepted (Lane C) |
| `E:\ATLAS-runtime-supervised-ff87b06b-20260925` | `82871619`'s rollback basis; previously LIVE |

## Out of scope — untouched

- `D:\ATLAS-runtime-supervised-20260912` (`9d293879…`) — supervisor reset baseline (last-resort artifact)
- `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0…`) — manual fallback (last-resort artifact)
- `D:\ATLAS-runtime-*`, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion repos, `D:\ATLAS`

## Retire rows (E:) — 12 registered worktrees

| # | Exact path | HEAD | `git status --short` | ancestor of `origin/main` | reparse/junction | active process |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `E:\ATLAS-runtime-supervised-002c8879-20260924` | `002c88793212709468843c10fc69aa09eef0eb46` | `?? ops/runtime/logs/` | yes | none | none |
| 2 | `E:\ATLAS-runtime-supervised-066da7a7-20260925` | `066da7a77b7ec63f5cacc27212788e1fbed88165` | `?? ops/runtime/logs/` | yes | none | none |
| 3 | `E:\ATLAS-runtime-supervised-37e0c85b-20260925` | `37e0c85bf80124d1071252956bfd7e94eb1f84c3` | `?? ops/runtime/logs/` | yes | none | none |
| 4 | `E:\ATLAS-runtime-supervised-426b6ac8-20260924` | `426b6ac8358bbdf10cc4289fdd34067ff88d0c81` | `?? ops/runtime/logs/` | yes | none | none |
| 5 | `E:\ATLAS-runtime-supervised-514be157-20260924` | `514be157632786e7cc66b0a4adf117826135a0ed` | `?? ops/runtime/logs/` | yes | none | none |
| 6 | `E:\ATLAS-runtime-supervised-70a51608-20260924` | `70a5160819349f5ea0742b839c11606e8408185d` | `?? ops/runtime/logs/` | yes | none | none |
| 7 | `E:\ATLAS-runtime-supervised-89295c27-20260925` | `89295c2785153787f5f50c93b17d97f881012169` | `?? ops/runtime/logs/` | yes | none | none |
| 8 | `E:\ATLAS-runtime-supervised-a5f7384e-20260925` | `a5f7384e61a24059cdeaadbfa279969877838e0f` | `?? ops/runtime/logs/` | yes | none | none |
| 9 | `E:\ATLAS-runtime-supervised-b6687fee-20260925` | `b6687feed22dbfdf47d71d08e1e2867ce9f613ea` | `?? ops/runtime/logs/` | yes | none | none |
| 10 | `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` | `c7fc0c955253b924fd880f346c23d428166437c6` | `?? ops/runtime/logs/` | yes | none | none |
| 11 | `E:\ATLAS-runtime-supervised-e475c673-20260925` | `e475c673e85fc8ca5a1bb055a7ff1819094b7d41` | `?? ops/runtime/logs/` | yes | none | none |
| 12 | `E:\ATLAS-runtime-supervised-e8553752-20260925` | `e8553752df97952652108027ace80c077c543e94` | `?? ops/runtime/logs/` | yes | none | none |

Every row's only non-clean path is the untracked runtime artifact `ops/runtime/logs/`; the product tree is
clean. `node_modules` / `dist` are gitignored and do not count as dirty.

## Flagged row — standalone clone, NOT authorised by this manifest

| Exact path | Type | HEAD | Note |
| --- | --- | --- | --- |
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | **standalone clone** (`.git` directory; not in `git worktree list`) | `4893cbdec2758fa9965a117a1988dee517718afb` | `git worktree remove` does not apply; the lifecycle doc permits `Remove-Item -LiteralPath … -Recurse -Force`, but `AGENTS.md` §3 says "never raw recursive deletion". **Default: DEFER** (own manifest + audit). |

## Method (per row)

1. Clear runtime state: remove the untracked `ops/runtime/logs/`; verify `git status --short` is empty.
2. `git worktree remove <exact-validated-path>` — non-forced, one row at a time.
3. After all rows: `git worktree prune`.
4. No branch deletion. Keep-set and out-of-scope paths untouched.

## Rebuild path

Every retire SHA is an ancestor of `origin/main`. Rebuild:
`git worktree add --detach <sha>` → install → `prisma generate` → server `tsc` + client `vite` build.

## Evidence basis

Read-only survey 2026-09-25: registration via `git worktree list --porcelain`; HEAD via `git rev-parse
HEAD`; status via complete `git status --short`; ancestry via `git merge-base --is-ancestor <sha>
origin/main`; reparse state via `Get-Item` `ReparsePoint` attribute on root/`atlas-server`/`atlas-client`
`node_modules`; junction-dependency sweep over `E:/ATLAS-worktrees`, `E:/ATLAS-runtime-supervised-*` and
`D:/ATLAS-worktrees` (**no** junction target lies inside any retire row); process scan via
`Get-CimInstance Win32_Process` command-line match (**no** process references any retire row).
