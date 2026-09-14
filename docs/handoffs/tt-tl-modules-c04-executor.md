# TT-TL-MODULES-C04 — Executor Handoff

- Packet: `docs/prompts/timetable-teaching-load-modules-one-shot-c04-2026-09-13.md`
  (R1–R7), **operator dispatch supersedes** where they differ: implement only the
  non-D1 modules; class 5 (faculty availability) is DEFERRED on decision D1.
- Role: EXECUTOR. Returns `REVIEW_REQUIRED` only; no self-approval.
- Branch: `work/tt-tl-modules-c04`
- Base SHA: `d4e9dc8e07869725d4beb55b30c4502650597d24` (refreshed `origin/main`; the
  historical packet base `92c14f95` is SUPERSEDED and was not used).
- Product candidate SHA (commit containing the product source + tests):
  `6a8f471712eb51a6ff83549beb446bd6242dc5de`
- Handoff commit: this document is committed as the tip above the product
  candidate; its exact SHA is quoted in the executor's return message and is
  resolvable as `git log -1 --format=%H` on `work/tt-tl-modules-c04`. Its parent
  is the product candidate `6a8f4717`. (A commit cannot contain its own SHA
  without amending, which is forbidden.)
- Canonical directive: `D:/ATLAS/AGENTS.md`, LF-normalized SHA-256
  `0F6612BA7979DAE5DD275108B4BA9C8B6AEF346AA36F9C2CC44285C7B1A4AB72`
  (recomputed at execution and verified equal to the dispatch pin). The
  worktree-local tracked `AGENTS.md` is stale and was not modified or used as
  authority.

## 1. Exact changed paths (all owned)

Product (5 modified):
- `atlas-client/src/components/timetable/TacticalSandboxDock.helpers.ts`
- `atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`
- `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`

New tests (3):
- `atlas-server/src/__tests__/tt-tl-modules-contract.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-helpers.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-contract.test.ts`

Documentation (1, this handoff — separate commit):
- `docs/handoffs/tt-tl-modules-c04-executor.md`

No server product source was modified: R1 is verify-only (S3 already integrated
the guarded authority on this base).

## 2. Trace table (requirement → production path → negative control → verification)

| Req | Production path | Negative control | Verification command | Outcome |
|---|---|---|---|---|
| R1 | 6 mounted routes in `timetable-teaching-load-repair.router.ts` → `assertTeachingLoadWriteAuthority`; repair service consumes `isStrictlyPublishedSummary` | cross-school/stale/published refusals with zero dispatch (S3 M1–M6) | `npx tsx src/__tests__/tt-tl-authority-guard-c04.test.ts` (disposable DB) + `grep` consumption map | **PASS** — 46/46; helper imported at `timetable-teaching-load-repair.service.ts:28`, used :648/:1141/:1167; no local duplicate predicate |
| R2 | `TeacherDepartureRecoverySheet` + dock owner-repair preview/apply via workspace; `PublishedRevisionDialog` for published | refusal mapping / no-save-on-refusal; window validation; published path never calls direct commit | `npx tsx --test src/lib/__tests__/tt-tl-modules-helpers.test.ts src/lib/__tests__/tt-tl-modules-contract.test.ts` | **PASS** (33/33 across both suites) |
| R3 | dock `RedistributionSummaryCard` → `POST /faculty-assignments/coverage/rebalance-over-cap {previewOnly:true}` + `GET /faculty-assignments/reconciliation/readiness` | unresolved school/year ⇒ zero dispatch; no apply variant; routes to `/teaching-load` | helper tests + source-contract wiring test | **PASS (hermetic contract)** — request shape/gating proven; positive live response runtime-dependent (see §7) |
| R4 | dock `QualificationAuthorityModule` → `POST /faculty-assignments/department-authority/preview|apply` | apply blocked without server fingerprint; exact server confirmation phrase; typed refusal copy | helper tests (`buildQualificationApplyPayload`) + source-contract test | **PASS** — no capability-override calls |
| R5 | owned header region `TimetableSimpleHeader` + `timetableDriftRouting` domain hrefs (canonical homes) | published-mode drift affordance | source review | **VERIFIED in owned region; discovered non-owned gap in `SimpleDriftBanner` (see §5)** |
| R6 | `isDraftPublishedStrict` / `isRunPublishedStrict` single predicate; no retired path | no loose `publishedAt`/`publishedBy` decisions; no `reconciliation/apply`, `annual-teaching-load/apply`, `capability-overrides` | source-contract test + grep | **PASS** |
| R7 | availability class 5 deferred (D1); owned surfaces render an explicit deferred notice | no availability source/endpoint/fingerprint domain invented | source-contract test (`timetable-availability-deferred`) | **DEFERRED (D1)** — no authority invented |
| R8 | dock scope-clear effects + `workspaceScopeKey`; published gating; impact-before-commit | year/run/school change clears staged/preview/module state | helper `workspaceScopeKey` test + source-contract scope test | **PASS** (archived mode D4 does not exist and was not invented) |

### Gates

| Gate | Command | Raw tally | Outcome |
|---|---|---|---|
| Server type-check | `npx tsc --noEmit` | exit 0 | PASS |
| Server build | `npm run build` | exit 0 | PASS |
| Client type-check | `npx tsc --noEmit` | exit 0 | PASS |
| Client build | `npm run build` | exit 0 (`✓ built in 2.11s`) | PASS |
| Client operator UX | `npm run test:timetable-operator-ux` | 58/58, 0 fail | PASS |
| New client helpers | `npx tsx --test src/lib/__tests__/tt-tl-modules-helpers.test.ts` | 19 tests, 19 pass, 0 fail | PASS |
| New client contract | `npx tsx --test src/lib/__tests__/tt-tl-modules-contract.test.ts` | 14 tests, 14 pass, 0 fail | PASS |
| New server contract | `npx tsx src/__tests__/tt-tl-modules-contract.test.ts` (disposable DB) | 21 passed, 0 failed | PASS |
| S3 authority suite | `npx tsx src/__tests__/tt-tl-authority-guard-c04.test.ts` (disposable DB) | 46 passed, 0 failed | PASS |
| TL write authority | `npx tsx src/__tests__/teaching-load-write-authority.test.ts` (disposable DB) | `PASS`, exit 0 | PASS |
| TL reconciliation (pre-existing) | `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` | 112 PASS / 9 FAIL / 1 FATAL, exit 2 | PRE-EXISTING (see §6) |
| TL reconciliation route (pre-existing) | `npx tsx src/__tests__/teaching-load-reconciliation-route.test.ts` | 46 PASS / 3 FAIL / 1 FATAL, exit 2 | PRE-EXISTING (see §6) |
| Diff whitespace | `git diff --check` | exit 0 | PASS |
| Staged whitespace | `git diff --cached --check` | exit 0 | PASS |
| Test removal audit | `git diff --diff-filter=D --name-only` | empty; no test file modified, only added | PASS |

Known pre-existing absent-file suite (per dispatch): `npm run test:timetable-conflict`
references `timetable-live-conflict.test.ts` / `tactical-sandbox-dock-helpers.test.ts`,
which are absent at this base. Not created, not run — recorded as pre-existing.

## 3. Production-shape parity row

| Field | Value |
|---|---|
| Real producer | `timetable-teaching-load-repair.service.ts` (`previewTeachingLoadRepair` → `sourceFingerprint`; `applyTeachingLoadRepair` → CAS + fingerprint + qualification) |
| Real consumer | `TacticalSandboxDock` owner-repair preview/apply; `TeacherDepartureRecoverySheet` reassignment; new redistribution/qualification modules |
| Conservation invariant | one repair preview authorizes at most one apply; receiver qualification, run version, and covered-input fingerprint all survive preview→apply or the write fails closed with zero ownership/FacultySubject/run/edit/audit writes |
| Negative control | C2 room interleave between preview and apply ⇒ `409 TEACHING_LOAD_REPAIR_STALE`, protected tables byte-identical; C1 unqualified receiver ⇒ `409 TEACHING_LOAD_QUALIFICATION_MISSING`, zero writes; C3 published run ⇒ `409 RUN_ALREADY_PUBLISHED`, zero writes |
| Result | PASS — `tt-tl-modules-contract.test.ts` 21/21 on the disposable DB |

No shape-translating client change could alter canonical authority: the client
module layer only builds canonical request shapes and maps typed refusals.

## 4. Environment and disposable-database discipline

- Disposable database: `atlas_restore_drill_20260914_d2805da5`
  (classification: **disposable**; host `localhost:5432`). Schema applied with
  `npx prisma migrate deploy --schema=../prisma/schema.prisma` (45 public tables,
  3 `_prisma_migrations`). The configured `.env` database was never the mutation
  target; `.env` is gitignored and was never staged or printed.
- Teardown: `DROP DATABASE atlas_restore_drill_20260914_d2805da5 WITH (FORCE)`.
  Post-drop `SELECT count(*) FROM pg_database WHERE datname = 'atlas_restore_drill_20260914_d2805da5'`
  returned `0` — **zero residue**. Two unrelated disposable databases from other
  streams (`atlas_restore_drill_20260911_uxc01rc6e5ba0d`,
  `atlas_restore_drill_20260912_rrtc80be4ffb`) were observed and left untouched.
- The new server contract suite hard-fails if `DATABASE_URL` does not name an
  `atlas_restore_drill_*` database, so it cannot silently target the dev DB.

## 5. Discovered non-owned findings (report only; NOT fixed)

1. **`SimpleDriftBanner.tsx` exposes Sync in published mode.** The banner renders
   `timetable-simple-sync-setup` and the "Sync with setup" action without any
   `isPublished` input, even though `deriveSimpleCapabilities` labels the
   lifecycle `published`. The owned header region was left as-is (it cannot
   change a non-owned component). R5's published-mode drift wording requirement
   is therefore **NON_BLOCKING for the owned diff but incomplete globally**.
   Successor needed owning
   `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`
   (and `SimpleHeaderHelpers`/capability plumbing if the gate must be read).
2. **Capability-override endpoints lack actor-school scope.** `GET/PUT/DELETE
   /faculty-assignments/capability-overrides` and their service functions take no
   `actorSchoolId` and call no `rejectSchoolScopeConflict`, so cross-school
   override reads/writes are reachable. Per dispatch, no client call was wired
   to those endpoints (not even reads) and those files were not edited. Successor
   needed owning `faculty-assignment.router.ts` / `faculty-assignment.service.ts`.

## 6. Pre-existing failures (reproduced, not fixed)

`teaching-load-reconciliation.test.ts` (112 PASS / 9 FAIL / 1 FATAL):
- `[FAIL] MATH:102 and ENG:101 inserted (expected 2, got 0)`
- `[FAIL] unqualified ENG owner moved to qualified ENG faculty (expected 8, got undefined)`
- `[FAIL] one retained (expected 1, got 0)` / `[FAIL] one moved (expected 1, got 0)`
- `[FAIL] two inserted (expected 2, got 0)` / `[FAIL] four ownership rows after apply (expected 4, got 0)`
- `[FATAL] TypeError: Cannot read properties of undefined (reading 'facultyId')` at
  `teaching-load-reconciliation.test.ts:1032`

`teaching-load-reconciliation-route.test.ts` (46 PASS / 3 FAIL / 1 FATAL):
- `[FAIL] first apply executes writes (expected false, got true)`
- `[FAIL] one ownership inserted through the route (expected 1, got 0)`
- `[FAIL] ownership row created through the route (expected 1, got 0)`
- `[FATAL] TypeError: Cannot read properties of null (reading 'sectionIds')` at
  `teaching-load-reconciliation-route.test.ts:244`

Classification: **pre-existing**. Neither test file was modified by this
candidate (verified: only added files appear in the diff), and **no server
product source was changed**, so both suites execute identical base bytes. The
failures match the S3 handoff "Known risks" note for this line of development.

## 7. Known risks

- **NON_BLOCKING (R3 runtime-dependence):** the redistribution card's positive
  live response depends on upstream faculty/section context and a persisted
  effective workload policy. The hermetic contract (request shape, zero-dispatch
  gating, read-only construction, canonical blocker surfacing) is proven; the
  positive live payload was not exercised (no live/runtime/browser authority in
  this packet). Labeled hermetic-only.
- **NON_BLOCKING (published-mode drift banner):** see §5.1 — requires non-owned
  ownership to close.
- **NON_BLOCKING (capability-overrides scope):** see §5.2 — pre-existing, outside
  owned paths; no client wiring added.
- **NON_BLOCKING (refactor):** to respect the mandatory 1000-line component limit,
  `StagedRepairReview`, `TeacherCandidateList`, and `OwnerSourceMismatchNotice`
  were extracted unchanged from `TacticalSandboxDock.tsx` into the owned
  `TacticalSandboxDock.parts.tsx` (dock now 996 lines). Behaviour is preserved;
  no assertions or tests were removed.
- **BLOCKING:** none identified within owned scope.
- **DEFERRED (D1):** class 5 faculty availability. No availability source,
  endpoint, fingerprint domain, or repair module was invented; owned surfaces
  render an explicit deferred state.

## 8. No-mutation statement

No live/shared data write, Teaching Load apply, generation, publication,
deployment, runtime/process action, migration or schema apply against the
configured database, login, browser use, companion-repo edit, merge, rebase,
amend, or push was performed. The only database activity was against the
uniquely named disposable database, which was dropped with zero residue. The
living register, runtime source map, `CHANGELOG.md`, and every forbidden path
were not touched.

## 9. Return

`REVIEW_REQUIRED`
