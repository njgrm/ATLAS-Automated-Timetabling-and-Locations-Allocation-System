# RUNTIME-DIR-RECLAIM-C01 — post-action report

**Cycle:** runtime release-directory reclaim. **Author:** Lane A. **Date:** 2026-09-23.
**Manifest:** `docs/reviews/runtime-reclaim-20260923/manifest.md` (frozen `d5c73fc0`, corrected `4f911381`).
**Verdict:** executed and independently verified. **Pre-action audit** `CORRECTION_REQUIRED` 5/9 (six rows
moved out of the set; correction applied subtractively). **Post-action audit** zero blocking findings,
**8/8 rows passed**.

## What was removed — 7 rows, ~4.9 GiB

| # | Path | Class | Method |
|---|---|---|---|
| 1 | `D:\ATLAS-runtime-supervised-131baab7-20260918` | worktree | logs-cleared → junctions unlinked → `git worktree remove` (non-forced) |
| 2 | `D:\ATLAS-runtime-supervised-3c4cc3cd8d7d-20260918` | worktree | as above |
| 3 | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` | worktree | as above |
| 4 | `D:\ATLAS-runtime-supervised-798cd78356ef-20260918` | worktree | as above |
| 5 | `D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` | worktree | as above |
| 6 | `D:\ATLAS-runtime-supervised-6cc202b7-20260922` | clone | empty reparse scan → deleted |
| 7 | `E:\ATLAS-worktrees\c01r-release-20260921` | stray clone | empty reparse scan → deleted |

Procedure exactly as manifest §7: the sanctioned removal of each worktree's untracked
`ops/runtime/logs/`; `cmd /c rmdir` on every junction (link only — never `Remove-Item -Recurse` on a
reparse point); non-forced `git worktree remove`; one `git worktree prune`; clone rows gated on an empty
`cmd /c dir /s /b /al` scan. **No `--force` was used anywhere, no glob or computed path was used, and no
branch was deleted.**

## Measured results

| Metric | Before | After | Expected |
|---|---|---|---|
| Registered worktrees | 83 | **78** | −5 (the five worktree rows) |
| Local branches | 347 | **347** | unchanged |
| `D:` free | 16.82 GiB | **20.37 GiB** | +3.55 (predicted ≈3.89; N4 variance) |
| `E:` free | 50.25 GiB | **51.27 GiB** | +1.02 (predicted ≈1.00) |
| Junction targets present | 7 | **7** | none lost |
| Release dirs on `D:` | 36 | **30** | 24 preserved + 6 targets |

All 7 junction targets still exist **with their dependency trees intact** (`atlas-server\node_modules` 206
entries and a generated Prisma client in every target), and no remaining link points at a removed row.

## Live runtime — untouched

The live serving release is **`89012430`** at `E:\ATLAS-runtime-supervised-89012430-20260923` (not
`7ac28124`, which this cycle's earlier work deployed — see N5). Post-action: HEAD `89012430`, task action
and Start-In unchanged, machine `ATLAS_RUNTIME_SOURCE_DIR`/`RELEASE_SHA` unchanged, authoritative state
`releaseSha=89012430` / `state=running`, listeners **5001→57424 / 5174→57980**, `/api/v1/health` 200,
`/api/v1/health/ready` 200 `{"database":"ok"}`, DB-backed `GET /api/v1/subjects?schoolId=1` 200, Tailnet
200, served entry `/assets/index-CUAuiR-h.js` present in that release's own `dist`.

## Disclosed deviation — preserve-class inconsistency (audit C3)

**Three of the five removed worktree rows were formerly deployed live releases**, cited as such in
historical documents:
- `74c1f12a5c06` — `docs/reviews/current-source-live-deploy-c01/evidence.md:12` (machine
  `ATLAS_RUNTIME_SOURCE_DIR` incumbent);
- `131baab7` — `docs/prompts/year10-gen-readiness-config-c01-2026-09-18.md:22` ("Live release");
- `f0d65a53` — `docs/handoffs/ux-rehaul-handoff.md:33` ("Live deployed release").

Manifest §6's literal gate named only `live-state`, so these passed it; six other rows were moved to §8 for
the same *class* of evidence, and four historical live releases (`3d916b26`, `80acdc25`, `714fadf7`,
`d3e9dfef`) were preserved. **The gate was therefore applied inconsistently, and this report records it
rather than leaving it silent.**

Adjudicated **`NON_BLOCKING`** by the post-action audit on all three decisive tests:
- **Not a current anchor:** none is named as a rollback/fallback basis in `live-state`; the current chain
  (`d9a6aa53` + deeper) and the live `89012430` exclude all three.
- **No pending packet depends on them:** every referencing packet is executed/closed.
- **Not the only copy:** `131baab7d68f`, `74c1f12a5c06`, `f0d65a531e34`, `3c4cc3cd8d7d`, `798cd78356ef` all
  resolve as commit objects in `D:\ATLAS` and are ancestors of `origin/main`. Only rebuildable `dist` was
  lost. Rebuild: `git worktree add --detach <path> <sha>` → `npm ci` (root + both packages) →
  `prisma generate --schema=../prisma/schema.prisma` from `atlas-server` → both builds with
  `VITE_ENROLLPRO_URL` exported.

## Findings from the post-action audit

- **N3 (observation, pre-existing, not attributable to this cycle).** `8eb0511baa53\atlas-client\node_modules`
  is an **empty real directory**, and the client junctions of `405e5b18 → 20f07f59 → 78be1b760e40 →
  8eb0511baa53` resolve into it. The deep **server** tree and its Prisma client survived intact, which a
  recursive junction-follow would have destroyed. **Flagged for the operator:** the client-side dependency
  chain rooted at `8eb0511baa53` was already hollow before this cycle.
- **N4.** `D:` freed 3.55 GiB against a 3.89 GiB prediction — directory-accounting/NTFS slack. No evidence
  of incomplete removal (all 7 paths verifiably gone).
- **N5 (corrected).** `live-state` still named `7ac28124` as the current release; the actual live release is
  `89012430`, deployed by another lane without a register update. Corrected in this closure.

## Corrections applied with this report

`live-state`: current release corrected to `89012430` with the drift disclosed; the resolved stray-clone
removal request struck from "Decisions awaited"; the stray-clone blocker marked resolved.
`planner-session-handoff`: the same removal request struck and the clone's `PRESERVE_FOR_DECISION` note
marked executed. Manifest §8 heading corrected to its actual 30-directory list.

## Successors — not in this cycle

1. **Collapse the five-deep junction chain** rooted at `8eb0511baa53` — it needs its own analysis (and now
   also the N3 empty-client-target defect), because each link is a live target for the link above it.
2. **The remaining ~26 GiB** of `D:\ATLAS-runtime-*` is rollback anchors, junction targets, historical live
   releases and the live release. Further reclaim means retiring rollback capability — a separate operator
   decision, not hygiene.
3. The 82 registered worktrees and the `E:\ATLAS-worktrees` population are out of scope.
