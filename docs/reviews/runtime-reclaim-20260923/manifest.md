# RUNTIME-DIR-RECLAIM-C01 — frozen pre-action manifest

**Cycle:** runtime release-directory reclaim. **Author:** Lane A (primary planner). **Date:** 2026-09-23.
**Base:** `origin/main` = `8901243054cbbb03b3c67c2bcb933cb06ccf3014` (at manifest authoring).
**Risk:** destructive filesystem action over release/rollback artifacts. Not a live-data, schema,
generation, publication or runtime-process mutation.

## 0. Authority

The operator granted an explicit exception for this reclaim on 2026-09-23, covering both removal modes
that the standing rules forbid: a **sanctioned logs-clearing step** (every release directory carries the
runtime's untracked `ops/runtime/logs/`, which blocks a non-forced `git worktree remove`) and **removal of
non-worktree directories** (the release directories that were created as standalone clones). The operator
delegated the safety determination for the unintegrated-looking clones and it is recorded in §4.

`AGENTS.md` §3 lists `D:/ATLAS-runtime-*` on the never-retire list. This cycle applies the operator's
exception to that line **only** for directories that pass every gate in §5. Nothing else in the
never-touch list is in scope (§8).

## 1. Stages

1. **Frozen manifest** — this file, committed before any mutation.
2. **Independent pre-action audit** — a fresh auditor verifies §3–§6 against the live filesystem.
3. **Guarded removal** — exact literal paths only, no globs, no `--force`, procedure in §7.
4. **Post-action audit** — independent verification of §9.

No mutation may begin until stage 2 returns clear.

## 2. Method and its known failure modes

All measurements were taken on the live host on 2026-09-23. **Two measurement bugs were found and
corrected during this investigation; both are recorded because they changed the conclusion:**

- **B1 — ancestry was measured in the wrong repository.** `git -C <release dir> merge-base --is-ancestor
  <head> origin/main` was run *inside each clone*, where `origin/main`'s tip object frequently does not
  exist, so the command errored and was read as "not an ancestor". This produced a false
  "6 unintegrated clones / ~11.2 GiB of unreproducible content" classification. Corrected by running the
  check in the shared repo (`D:\ATLAS`). Result: **every directory is integrated** (§4).
- **B2 — worktree-vs-clone was matched with the wrong separators.** `git worktree list` prints `D:/…`
  while the probe used `D:\…`, so every directory was misread as a clone. Corrected: **26 are registered
  worktrees, 10 are clones, 1 is the config directory.**

Consequence: the pre-action audit must re-derive every row independently rather than trusting this table.

## 3. Measured state

- 37 entries match `D:\ATLAS-runtime-*`: **36 release directories + `ATLAS-runtime-config`**, totalling
  **45.99 GiB**. `D:` free at measurement: **16.82 GiB** (1.82 GiB above the §3 fail-closed line).
- Classes: **27 registered detached worktrees**, **9 standalone clones**, 1 config directory. (Corrected
  after the pre-action audit; the earlier 26/10 split was a B2-class error.)
- Dirty content: exactly `?? ops/runtime/logs/` for every worktree sampled and every reclaim candidate
  (`LOGS-ONLY`); `6cc202b7-20260922` is clean.
- No release directory has an active process (`node.exe` command lines matched none of the 37 paths).

## 4. Recoverability — the safety determination

> **Every one of the 37 directories is built from a commit that is an ancestor of `origin/main`, and every
> one of those commit objects exists in the shared repository `D:\ATLAS`.**

Therefore no directory holds unique content. Deleting one loses only its built `dist` artifacts and the
convenience of an instant rollback — never the source. Recovery is `git worktree add --detach <new path>
<sha>` followed by the documented release build (`npm ci` at root + both packages, `prisma generate
--schema=../prisma/schema.prisma` from `atlas-server`, then the two builds with
`VITE_ENROLLPRO_URL` exported).

Also verified benign:
- **The 3 stashes belong to `D:\ATLAS`, not to the release directories.** `refs/stash` is shared across
  linked worktrees, so every worktree reports 3 and the clones report 0. Removing a worktree does not
  touch them. This was checked because a per-directory stash would be work that exists nowhere else.
- **No clone is a junction target**, so no dependent breaks (§5).

## 5. Junction analysis (target vs contained)

Ten directories carry junctions. Five are **targets** and five are **bearers only**:

```
131baab7 ──▶ 405e5b18 ──▶ 20f07f59 ──▶ 78be1b760e40 ──▶ 8eb0511baa53
3c4cc3cd8d7d ──▶ { E:/ATLAS-worktrees/ux-quickfix-c01 , 0eb3b67fe94c }
74c1f12a5c06 ──▶ { E:/ATLAS-worktrees/ux-quickfix-c01 , 0eb3b67fe94c }
798cd78356ef ──▶ { E:/ATLAS-worktrees/ux-quickfix-c01 , 0eb3b67fe94c }
f0d65a531e34 ──▶ { E:/ATLAS-worktrees/ux-quickfix-c01 , 4ce73d157f9a }
```

- **Targets (must be preserved, no exception):** `405e5b18`, `20f07f59`, `78be1b760e40`, `8eb0511baa53`,
  `0eb3b67fe94c`, `4ce73d157f9a`, and the external `E:/ATLAS-worktrees/ux-quickfix-c01`. Deleting a target
  breaks `@prisma/client` for its dependents at once — the failure mode that previously took the live
  runtime down. This is a five-deep chain; it is not collapsed by this cycle.
- **Bearers only (removable):** `131baab7`, `3c4cc3cd8d7d`, `74c1f12a5c06`, `798cd78356ef`, `f0d65a531e34`.
  Their links are removed with `rmdir` (link only) **before** the directory is touched, and each target is
  re-verified to exist immediately afterwards.

## 6. Reclaim set — 5 worktrees + 1 mislabeled clone + 1 stray clone (~4.9 GiB)

**Corrected after the pre-action audit (`CORRECTION_REQUIRED`, 5/9).** Six rows were removed from the
frozen set — `5a333c74`, `434b2a81`, `4c7c0bd9`, `74999168`, `d50dde64`, `c93dd2ee` — because they are
named in `live-state` or in evidence documents as available/startable rollback bases or deployed releases.
The original §6 gate was falsified for them; they now sit in §8. **Nothing was added to the set**, and the
audit independently cleared the seven rows below as mechanically safe.

Every row: integrated (§4), inactive, not a junction target, not named as a live/rollback/fallback anchor
anywhere under `docs/`, and `LOGS-ONLY` (or clean).

| # | Exact path | Class | HEAD | GiB | Junction role |
|---|---|---|---|---|---|
| 1 | `D:\ATLAS-runtime-supervised-131baab7-20260918` | worktree (detached) | `131baab7` | 0.58 | bearer → `405e5b18` |
| 2 | `D:\ATLAS-runtime-supervised-3c4cc3cd8d7d-20260918` | worktree | `3c4cc3cd` | 0.58 | bearer → E: worktree, `0eb3b67fe94c` |
| 3 | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` | worktree | `74c1f12a` | 0.58 | bearer → E: worktree, `0eb3b67fe94c` |
| 4 | `D:\ATLAS-runtime-supervised-798cd78356ef-20260918` | worktree | `798cd783` | 0.58 | bearer → E: worktree, `0eb3b67fe94c` |
| 5 | `D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` | worktree | `f0d65a53` | 0.58 | bearer → E: worktree, `4ce73d157f9a` |
| 6 | `D:\ATLAS-runtime-supervised-6cc202b7-20260922` | clone | `7dbb3b90` | 0.97 | none |
| 7 | `E:\ATLAS-worktrees\c01r-release-20260921` | stray clone (not a worktree) | `beedb104` | ~1.0 | none |

Row 6 carries identity drift (the directory name says `6cc202b7`, HEAD is `7dbb3b90`); its content is
already present at the named fallback `D:\ATLAS-runtime-supervised-7dbb3b90-20260922`, which is preserved.
Expected yield: **≈3.89 GiB on `D:` (16.82 → ≈20.7 GiB) and ≈1.00 GiB on `E:`**.

## 7. Removal procedure (guarded)

**Worktrees (rows 1–6):**
1. `Remove-Item -LiteralPath "<exact path>\ops\runtime\logs" -Recurse -Force` — the sanctioned
   logs-clearing step. Then require `git -C "<exact path>" status --short` to be **empty**; abort the row
   if it is not.
2. For each junction in the row: `cmd /c rmdir "<exact link path>"` — **link only, never `Remove-Item
   -Recurse` on a junction**. Then require every target in §5 to still exist; abort the whole cycle if any
   target is missing.
3. `git worktree remove "<exact path>"` — **non-forced**. If Git refuses, leave the directory in place and
   record it; never escalate to `--force`.
4. `git worktree prune` once at the end.

**Clones (rows 6–7):** `git worktree remove` does not apply. Removal is
`Remove-Item -LiteralPath "<exact path>" -Recurse -Force` on the exact literal path — no globs, no
computed paths, one row at a time, with the §4 recovery statement recorded first. **Before each clone
removal**, require `cmd /c "dir /s /b /al <exact path>"` to return **empty** — PowerShell 5.1 recursion can
follow a reparse point (audit N4). Abort that row if it does not. Re-verify every §5 target after each
clone removal.

**No branch is deleted by this cycle.** Every branch ref is left untouched.

## 8. Preserve set (24 directories + config) — do not touch

| Group | Directories | Reason |
|---|---|---|
| Named rollback/fallback anchors | `d9a6aa53`, `28f6f03f`, `1fdab989`, `e78d4473`, `11e8778f`, `7dbb3b90`, `d4c9f391`, `d92facfa`, `ecff1d7e`, `a02884ff`, `5f5c6c4f`, `20260912` (`9d293879`), `fallback-d44-20260912` (`d44f29e0`) | The fast rollback path named in `live-state` |
| Anchors found by the pre-action audit (moved out of §6) | `434b2a81`, `4c7c0bd9` (`live-state:105`), `74999168` (deployed; post-action QA 8/8 — `live-state:143,301`), `d50dde64` (`ux-r03c-one-shot/evidence.md:6` rollback basis), `c93dd2ee` (`live-state:142`), `5a333c74` (deployed release whose directory is cited by `aims-smart-term-aware-published-schedule-handoff-2026-09-22.md`) | Named as available/startable rollback bases or deployed releases |
| Junction **targets** | `8eb0511baa53`, `78be1b760e40`, `20f07f59`, `405e5b18`, `0eb3b67fe94c`, `4ce73d157f9a` | Deleting one breaks a dependent's `@prisma/client` |
| Retained build artifact | `54dce67b` | Its `ENROLLPRO-PROXY-RECOVERY-LIVE` packet is **SUPERSEDED** (audit N2); retained conservatively as a build artifact |
| Historical live releases with acceptance evidence | `3d916b26`, `80acdc25`, `714fadf7`, `d3e9dfef` | Deploy lineage referenced by acceptance records |
| Never touch | `ATLAS-runtime-config` | `AGENTS.md` §3 |
| Out of scope, preserved | `E:\ATLAS-runtime-supervised-89012430-20260923` (**live serving release** — task action/workdir, machine env, listeners 5001→57424 / 5174→57980, authoritative state `releaseSha=89012430…`), `E:\ATLAS-runtime-supervised-7ac28124-20260923` (prior release; its state file is a stale `running` record whose PIDs no longer listen) | Live release / custody |

Also untouched: `D:\ATLAS`, PostgreSQL storage, companion repositories, `stakeholderFiles`, and every
preservation/backup directory.

## 9. Verification plan (post-action)

1. `git worktree list` shows exactly **5** fewer registrations (27 → 22), `git worktree prune` reports no
   dangling entry, and no `.git/worktrees/<name>` entry remains for a reclaimed row.
2. Every §5 target still exists — explicit `Test-Path` on all 7, including the E: worktree — and a
   post-action reparse re-scan of all remaining release directories finds no link into a reclaimed row.
3. `D:` free space increases by ≈ **3.89 GiB** (expected 16.82 → ≈ 20.7 GiB); `E:` by ≈ 1.00 GiB.
4. **Live runtime untouched:** the live serving release `89012430` keeps its listeners, its
   `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA`, and its supervisor task action/workdir
   unchanged; `/api/v1/health` + `/api/v1/health/ready` (`database:"ok"`) + DB-backed
   `GET /api/v1/subjects?schoolId=1` + Tailnet 200; and the served entry chunk still byte-identical to that
   release's own `atlas-client/dist` build.
5. Branch count unchanged (before/after), and the preserved anchors still startable in place.
6. No remaining reference to any reclaimed path anywhere under `docs/` (not only `live-state`); the
   reclaim is recorded in `live-state` and in the post-action report.

## 10. Out of scope / successors

- **Collapsing the five-deep junction chain** rooted at `8eb0511baa53` — it needs its own analysis because
  every link is a live target for the link above it.
- **The remaining ~31 GiB** of `D:\ATLAS-runtime-*` is rollback anchors, junction targets, historical live
  releases and the live release. Reclaiming further means retiring rollback capability, which is a
  separate operator decision, not a hygiene task.
- The 82 registered worktrees and the `E:\ATLAS-worktrees` population are **not** in scope.
