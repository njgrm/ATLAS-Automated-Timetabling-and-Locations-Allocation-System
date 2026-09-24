# Runtime release-directory retention — frozen manifest (2026-09-24)

**Base ref:** `origin/main` `ac151be284d67e83c75b7d1e17a8dbbb8f1691fe`
**Policy:** `docs/reference/agent-worktree-lifecycle.md` — *keep the live release, the two most
recent accepted releases, the two named last-resort artifacts (supervisor reset baseline + manual
fallback), and one real dependency source; retire rollback depth beyond that. A deep rollback is a
**rebuild**. Any reclaim still requires the frozen-manifest + pre-action audit.*

This manifest is frozen before any removal. Rows are removed one at a time, non-forced, from the
exact literal path recorded here. No glob, no computed path, no `--force`, no branch deletion.

## Keep-set (E:) — NOT retired

| Path | Role |
| --- | --- |
| `E:\ATLAS-runtime-supervised-002c8879-20260924` | **live release** (deployed 2026-09-24; `ATLAS_RUNTIME_SOURCE_DIR`) |
| `E:\ATLAS-runtime-supervised-70a51608-20260924` | **current rollback basis** (ACCEPTED) |
| `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` | accepted |
| `E:\ATLAS-runtime-supervised-514be157-20260924` | accepted |
| `E:\ATLAS-runtime-supervised-426b6ac8-20260924` | accepted |

Conservative: the policy minimum is live + two most recent accepted (3); this manifest keeps 5.

## Out of scope — untouched

- `D:\ATLAS-runtime-supervised-20260912` (`9d293879…`) — supervisor reset baseline (last-resort artifact)
- `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0…`) — manual fallback (last-resort artifact)
- `D:\ATLAS-runtime-*`, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion repos, `D:\ATLAS`

## Retire rows (E:) — registered worktrees

| # | Exact path | Type | HEAD | `git status --short` | ancestor of `origin/main` | reparse/junction | active process |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `E:\ATLAS-runtime-supervised-d7082c9d-20260924` | registered worktree | `d7082c9db134f26e0f3f1e5fa01d470cb9b34093` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 2 | `E:\ATLAS-runtime-supervised-22d1f5a8-20260924` | registered worktree | `22d1f5a8a341bf426a91df5a7ea6c01acd4862d2` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 3 | `E:\ATLAS-runtime-supervised-014b4b4c-20260924` | registered worktree | `014b4b4c6ef1112f544589f7245e5b662103d9a1` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 4 | `E:\ATLAS-runtime-supervised-09b898e6-20260924` | registered worktree | `09b898e6b7550528ee450abd4d9925fb422a240e` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 5 | `E:\ATLAS-runtime-supervised-6e9c87e7-20260924` | registered worktree | `6e9c87e7360960b3820849dfd8a07b0dac47cfc8` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 6 | `E:\ATLAS-runtime-supervised-0232bf9c-20260923` | registered worktree | `0232bf9cd1524038e2853bf2be468d2d90466854` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 7 | `E:\ATLAS-runtime-supervised-89012430-20260923` | registered worktree | `8901243054cbbb03b3c67c2bcb933cb06ccf3014` | `?? ops/runtime/logs/` (1 row) | yes | none | none |
| 8 | `E:\ATLAS-runtime-supervised-7ac28124-20260923` | registered worktree | `7ac2812449984f7a21c5effb4b6e77c6dcedb2eb` | `?? ops/runtime/logs/` (1 row) | yes | none | none |

Every row's only non-clean path is the untracked runtime artifact `ops/runtime/logs/`; the product
tree is clean. `node_modules` / `dist` are gitignored and do not count as dirty.

## Flagged row — standalone clone, NOT authorised by this manifest

| Exact path | Type | HEAD | Note |
| --- | --- | --- | --- |
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | **standalone clone** (`.git` directory; `--git-common-dir` = `.git`; absent from `git worktree list`) | `4893cbdec2758fa9965a117a1988dee517718afb` | `git worktree remove` does not apply. The lifecycle doc permits `Remove-Item -LiteralPath "<exact path>" -Recurse -Force`, one row at a time, gated on a reparse-free scan; `AGENTS.md` §3 says *"never raw recursive deletion"*. **Default if unresolved: DEFER.** |

## Method (per row)

1. Clear runtime state: remove the untracked `ops/runtime/logs/`; verify `git status --short` is empty.
2. `git worktree remove <exact-validated-path>` — non-forced, one row at a time.
3. After all rows: `git worktree prune`.
4. No branch deletion. Keep-set and out-of-scope paths untouched.

## Rebuild path

Every retire SHA is an ancestor of `origin/main`. Rebuild:
`git worktree add --detach <sha>` → install → `prisma generate` → server `tsc` + client `vite` build.

## Evidence basis

Read-only survey 2026-09-24: registration via `git worktree list --porcelain`; HEAD via
`git rev-parse HEAD`; status via complete `git status --short`; ancestry via
`git merge-base --is-ancestor <sha> origin/main`; reparse state via `Get-Item` `ReparsePoint`
attribute on root/`atlas-server`/`atlas-client` `node_modules`; process scan via
`Get-CimInstance Win32_Process` command-line match. One junction exists under `E:/ATLAS-worktrees`
(`warning-readability-c01\atlas-server\node_modules` → `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918\...`)
and points into a **D:** directory that is out of scope — no retire row is a junction target.
