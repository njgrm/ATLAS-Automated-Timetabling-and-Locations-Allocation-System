# A4 release 2026-09-28 #1 — deployment record

Packet: `docs/prompts/a4-release-2026-09-28-1.md` (Lane C). Planner: **A4**, release lane, ELEVATED, fresh session.
Live before: **`4c35cc8f808aad6d6e70f17920037d46d91bf10d`** (rollback basis, retained).
Live after: **`7590d485974337f834aa3972bb128090e6067b8d`**.

## 1. What shipped

| | |
|---|---|
| **Release branch** | `release/2026-09-28-1` |
| **Pinned release commit** | `7590d485974337f834aa3972bb128090e6067b8d` (merge) |
| **Parents (exactly two)** | `4c35cc8f808aad6d6e70f17920037d46d91bf10d` + `7caadf2d34a8924c6904c711261417842927e244` |
| **Merge base of the parents** | `6b1ec722d77c60c27903aed6b635867655d51523` |
| **Release worktree / live dir** | `E:\ATLAS-worktrees\lane-a4-release-20260928-1` (HEAD == pin, tracked tree clean) |
| **Included SHA** | **A3 `7caadf2d`** (c9 + c10) |
| **Dropped SHA** | none |
| **Not included** | A2's c11 (in progress, rides the next train) |
| **Merge conflicts** | **none** — clean auto-merge, no conflict markers, no `ls-files -u` |

## 2. Range enumeration (§13 — enumerated, not described)

`git diff --name-only 4c35cc8f..7590d485` = **70 files**.

| Area | Count |
|---|---|
| `atlas-client/src/components` | 42 |
| `atlas-client/src/pages` | 3 |
| `atlas-client/src/lib` | 6 |
| `atlas-client/src/ui` | 1 |
| `atlas-client/src/index.css` | 1 |
| `atlas-client/package.json` | 1 |
| `docs/**` | 15 |
| `AGENTS.md` | 1 |
| — of which test files | 14 |
| — of which **product** files | **39 (all under `atlas-client/src`)** |

**Zero** under `atlas-server/`, **zero** under `prisma/`, **zero** under `ops/`, **zero** `package-lock.json`,
**zero** `.env`, **zero** migrations, **zero** seed. Verified three ways:
`git diff --name-only 4c35cc8f..HEAD -- atlas-server prisma` → empty;
`… 6b1ec722..7caadf2d -- atlas-server prisma` → empty;
`… 4c35cc8f..7caadf2d -- atlas-server prisma` → empty.

This is a **client-only release**. There is no auth, role, permission, JWT or session delta.

**Clean-union proof:** `git diff 7caadf2d..7590d485` = **exactly 7 files, all `__tests__/`** — A2's B2 test
re-pointing fix. No assertion deleted or weakened. The product tree is otherwise identical to `7caadf2d`.

## 3. Gates run on the merged tree (before the cutover)

| Gate | Result |
|---|---|
| client `typecheck` | **1 error**, `timetable-truth-labels-a2.test.ts:523:32` TS2367 — **byte-identical on `4c35cc8f`, `7caadf2d` and the merge**; reproduced on the live release dir. Pre-existing baseline, not a merge regression. |
| 11 targeted A3 suites | **205 pass / 0 fail** (9+12+20+36+42+32+21+14+9+9+1). `test:a3-teachers-load` has 4 pre-existing `skipped`. |
| `test:client-suite` at the merge | **1211 tests, 1199 pass, 12 fail** |
| `test:client-suite` at live `4c35cc8f` | **1207 tests, 1195 pass, 12 fail** |
| **Difference set of failing test names** | **EMPTY in both directions** — the merge introduces **zero** new failures and fixes zero. The 12 are pre-existing on the live release. |
| `prisma generate` (repo-root schema) | OK, v6.19.2 |
| server build | rc=0 |
| client build (`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`) | rc=0, 3.7 MB dist, guard satisfied |

Every new/changed test file in the range is reachable from a committed `package.json` script in the same commit
(§11 "a test no gate runs is not evidence"): zero unreachable test files.

**My own measurement bug, corrected:** an early count read `(… | Measure-Object -Line).Count`, which returns **1**
for any input because the parenthesised pipeline yields a single object. It made the `atlas-server`/`prisma` delta
look like `1`. The direct `--name-only` runs above are the authority: **0**.

## 4. Deploy discriminator — verified to discriminate BEFORE the cutover

The 88 shared chunk filenames are byte-identical on both sides and must **never** be used as a discriminator
(independently recounted: **57 shared `.js`**, 57/57 identical; ~40 are lucide icon stubs, 17 are non-trivial app
chunks such as `proxy`, `chunk-UVKPFVEO`, `core.esm`, `utils`, `api`, `auth`). They are identical *because zero
server files changed* — which is correct, and precisely why they prove nothing.

| Marker | New build | Old build | Discriminates |
|---|---|---|---|
| `Create temporary teacher` | `Faculty-CosE5PS7.js` | **absent from all chunks** | yes |
| `Workload Audit Summary` | `TeachingLoad-B0oz109a.js` | **absent from all chunks** | yes |
| `workload-audit-back` (data-testid) | `TeachingLoad-B0oz109a.js` | **absent from all chunks** | yes |
| `Refresh roster` | **absent** | `Faculty-BKKOdXoo.js` | yes (inverted) |
| `Refresh teacher list` | present | present | **NO — do not use** |

**A marker was falsified before it could be used.** The first packet named `workload audit` (lowercase). That
phrase is in **zero** chunks in the new build, **zero** in the old, and **zero** source files — the real label is
`Workload Audit Summary`. A pre-action reviewer caught it. Executing the row literally would have produced a false
negative on a sound release.

**Post-cutover, over HTTP from the Tailnet origin:** served `index.html` references `index-D-9pvysa.js` (the
incumbent served `index-DLDFGXbV.js`, which now **404s**); the three new-only markers are present in the served
chunks; the old-only `Refresh roster` is absent.

## 5. Cutover — and the deviation that is recorded rather than substituted

A2's prior cutover used the repo's own `ops/runtime/deploy-runner.ps1` with `-LiveStateRef` and its fail-closed
`Assert-LiveReleaseRecorded` gate. **A4 did not use the runner.** The literal steps performed were:

1. Identified the supervisor tree from the process table: supervisor **22900**, children **69040** (5001) and
   **62656** (5174). PID 17496 (`dist/server.js`, parent 24348) is unrelated and was **left untouched**.
2. `taskkill /PID 22900 /T /F` → all 6 processes terminated; **0 listeners** on 5001/5174; 0 supervisor processes;
   task state `Ready`. (An out-of-process `cli.mjs stop` does not quiesce the resident supervisor.)
3. Machine scope: `ATLAS_RUNTIME_SOURCE_DIR` → `E:\ATLAS-worktrees\lane-a4-release-20260928-1`;
   `ATLAS_RUNTIME_RELEASE_SHA` → `7590d485974337f834aa3972bb128090e6067b8d`. Verified
   `releaseSha == git -C <sourceDir> rev-parse HEAD` → **True**.
4. Re-registered scheduled task `ATLAS-Runtime-Supervisor` with its action repointed to the new release's
   `ops\runtime\cli.mjs`; `/create … /f` returned **SUCCESS**.
5. `schtasks /run /tn ATLAS-Runtime-Supervisor`; both listeners up by attempt 2 (~8 s).

**Recorded literally, not assumed:** the task XML declares `encoding="UTF-16"` and I wrote UTF-8 bytes; on this
host registration **succeeded unmodified in the declaration** (exit 0). The deploy-facts note about UTF-8
registration failing concerns *rewriting the declaration*, which I did not do.

**§6 stale-env trap, live again:** the post-action QA's own inherited `Env:` pointed at a **third** release
(`lane-a2-release-9b28c572`), not even the rollback basis. Every identity decision in this cycle came from
machine scope, the task action, the listener command lines and `cli.mjs status` with env injected explicitly.

## 6. Deployment acceptance — result

Pre-action review: GATE A **7/7/0/0** (source range sound), GATE B **15/1/0/0** → `CORRECTION_REQUIRED` on the
acceptance matrix only. Four packet corrections, each applied and verified by a discriminating command:
D6 marker replaced; `/map` browser row added; token/primitive blast radius rows added; c10 §4 deferral recorded
with a named owner. No source byte changed.

Post-action QA (fresh, independent): **19 mandatory rows, 15 passed, 0 blocked, 0 unperformed**, verdict
`PLANNER_DECISION_REQUIRED` — release confirmed live and serving, **no BLOCKING defect**.

| Row | Result |
|---|---|
| D1 identity | PASS — `releaseSha` == pin, new sourceDir, task action repointed, both ports owned by new children |
| D2 liveness | PASS 200 |
| D3 DB-backed readiness | PASS 200 `checks.database: ok` |
| D4 production host | PASS 200, `artifact` names the new dist |
| D5 public API matrix | PASS — all 3 paths 200 on the Tailnet origin |
| D6 discriminator | PASS — non-vacuous, all four markers behave as specified |
| D7 zero-write | **PARTIAL** — see below |
| B1 Codex smoke | 8/9 routes render; origin asserted first |
| B2–B10 browser rows | 8 screens PASS, no global scrollbar except `/` (see F1); `/specialization-mapping` does not exist (F2) |
| T1 global token | PARTIAL — repaint live (`--muted-foreground: 215 16% 42%`), contrast 5.15–5.67:1, all above AA; **call-site count 1322, not the 1313 claimed** (file count 213 confirms) |
| T2 shared dialog | PASS — close X visible, ~6:1 |

**D7 is PARTIAL and permanently so.** What passed: **zero** non-GET requests in the new release's supervisor log;
`_prisma_migrations` = **11**, exactly matching the 11 migration directories on disk, so **no migration was
applied**; `audit_logs` = **459**; **zero** audit rows after `2026-09-28T08:19:14Z`, the newest row of any kind
being a `LOCAL_LOGIN_SUCCESS` ~2.6 h *before* cutover. What could not be done: I captured **no pre-cutover
`audit_logs` baseline**, so a true before/after comparison on that table is unavailable and is now
**unrecoverable for this release**. This is a defect in my own pre-flight. It is recorded as PARTIAL, **not** as
inapplicable, and **not** waived by a substituted argument. **Durable fix: the next A4 packet must capture the
zero-write baseline before quiescing the supervisor.**

## 7. Findings carried forward (all NON_BLOCKING, none fixed here — A4 does not edit product code)

- **F1 — live Dashboard violates §8: a global browser scrollbar (1958 > 768).** Found independently by the
  post-action QA **and** by the fresh Codex smoke. Attributed, not assumed: `Dashboard.tsx`, `ui/sidebar.tsx` and
  `AppShell` are **unchanged** by this range, and the layout CSS is identical in old and new builds. **Pre-existing,
  not a regression.** It needs an owner in a product lane. **A4 did not absorb it.**
- **F2 — `/specialization-mapping` is not a route.** `App.tsx` declares no such route and no nav link targets it;
  `pages/SpecializationMapping.tsx` is unreachable tracked code, in this build and the previous one. This was an
  error in **my** acceptance screen set.
- **F3 — `cli.mjs status` reports `live: false` for both children while the runtime is healthy.** `getStatus()`
  reads an in-memory map that is empty when `status` runs out-of-process. A false-outage trap of exactly the kind
  that caused a 2026-09-26 misdiagnosis. Health was proven over HTTP independently.
- **F4 — pre-existing** blank line at EOF in `docs/reviews/reclaim-a2-c10-20260928/frozen-manifest.md`.
- **F5 — live observation, not a regression:** `/teaching-load` renders "EnrollPro could not be reached; saved
  sections used" and `/sections` "Saved section mirror; source not fully verified" — degraded operation, consistent
  with `ENROLLPRO-PROXY-RECOVERY-LIVE` remaining unapproved.
- Counting methods are now pinned so a later reader cannot re-derive a different number: shared `.js` chunks **57**;
  `text-muted-foreground` **1322 occurrences / 213 files**; `ui/dialog` direct importers **42** (43 including
  tests). `index.css`'s own comment claims "1292 across 190 files", which matches **none** of these readings.

## 8. Capacity and worktrees

- `E:` free: **38.0 GiB** before the cycle → **36.47 GiB** after the build. Above the §3 25 GiB warn line
  throughout, so **no reclaim was triggered and none was performed.** The whole build cost ~1.5 GiB as predicted.
- Dependency trees were **copied** into the release directory (~0.87 GiB), not junctioned, per the
  release-hygiene rule that a release owns its tree.
- **Worktree disposition:** `lane-a4-release-20260928-1` = **`KEEP_ACTIVE`** — it is the **live runtime source
  directory**; retiring it would take the runtime down. This **supersedes the packet's step-6 wording**, which
  says "retire release worktree": the live release lives in its release directory, and A2's identical packet
  wording did not retire `lane-a2-release-4c35cc8f` either.
- `lane-a2-release-4c35cc8f` = **`KEEP_ACTIVE`** as the **rollback basis** (retained, startable).
- `lane-a3-c10-s2-roomcards` = **PRESERVE_FOR_DECISION** (A3's, untouched per packet).
