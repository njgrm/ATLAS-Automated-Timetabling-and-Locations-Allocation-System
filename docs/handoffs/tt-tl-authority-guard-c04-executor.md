# TT-TL-AUTHORITY-GUARD-C04 — executor handoff

Role: EXECUTOR (lane S3). Status: `REVIEW_REQUIRED`. No self-approval, merge,
or push.

- Base SHA: `e3882ca0356e04545fadaa9dbfa5cd1261ba64b5`
- Worktree: `D:\ATLAS-worktrees\tt-tl-authority-guard-c04`
- Branch: `work/tt-tl-authority-guard-c04`
- Candidate SHA: the commit containing this file (reported in the executor
  return; this artifact is part of that commit).
- Canonical directive: `D:/ATLAS/AGENTS.md`, LF-normalized SHA-256
  `84047C3FCB54D78ED9DC71B8B009DE1209B15EE2D6BA317D73D2B3F2DD193149`
  (recomputed and matched at execution time).
- Governing packet: `docs/prompts/timetable-teaching-load-authority-guard-c04-2026-09-13.md`.

## Changed paths

- `atlas-server/src/routes/timetable-teaching-load-repair.router.ts`
- `atlas-server/src/services/timetable-teaching-load-repair.service.ts`
- `atlas-server/src/services/reconciliation.service.ts`
- `atlas-server/src/services/reconciliation-classifier.ts`
- `atlas-server/src/__tests__/tt-tl-authority-guard-c04.test.ts` (new)
- `docs/handoffs/tt-tl-authority-guard-c04-executor.md` (this file)

No client, warning-authority, Teaching Load suggestion/proposal, register,
runtime-map, `CHANGELOG.md`, migration, or companion-repository file was touched.

## Trace table

| # | Requirement | Production path | Negative control | Verification | Status |
|---|---|---|---|---|---|
| 1 | Privileged actor + positive actor school == request school + requested year is the sole active non-archived year, before service dispatch | `timetable-teaching-load-repair.router.ts` `assertTimetableTeachingLoadAuthority` → canonical `assertTeachingLoadWriteAuthority` (`faculty-assignment.service.ts`) on all six routes | Mounted matrix: missing token, invalid token, non-privileged, missing school, cross-school, historical, archived, zero-active, ambiguous-active, malformed scope; cross-school + nonexistent run returns `SCHOOL_MISMATCH` (not `RUN_NOT_FOUND`); zero `scheduling_policy` row after rejections = zero service dispatch | `tt-tl-authority-guard-c04.test.ts` M1 | PASS |
| 2 | Canonical receiver qualification/department/program authority before `FacultySubject`/ownership creation | `assertReceiversQualified` → `evaluateTeachingLoadReceiverQualification`; called in `prepareRepair` (preview) and inside the apply transaction before `applyCanonicalOwnership` | FIL receiver for a MATH subject rejected `409 TEACHING_LOAD_QUALIFICATION_MISSING`, zero ownership/FacultySubject rows; evaluator differential (FIL tier null, MATH tier 2); base run accepts it (failing-first) | M3 + base export run | PASS |
| 3 | Repair output bound to the complete source snapshot + run version; covered-input interleave fails typed stale before ownership/run/audit/notification writes | `prepareRepair` captures `sourceFingerprint`; preview returns it; apply recomputes `computeGenerationInputSnapshot(tx)` and compares before `applyCanonicalOwnership`; run-version CAS retained | Room interleave between preview and apply with the preview fingerprint → `409 TEACHING_LOAD_REPAIR_STALE`, byte-identical ownership/run/edit/audit/cycle/policy tables, zero notification events | M4 + M5 | PASS |
| 4 | Retire the phantom `applyRunReconciliation` mutation (no `APPLIED`, no fabricated version) | `reconciliation.service.ts` `applyRunReconciliation` throws `410 RECONCILIATION_APPLY_RETIRED`; `/reconciliation/apply` route removed; preview now returns `nonAuthorizing:true`/`applyRetired:true` | `POST .../reconciliation/apply` → 404; direct service call → typed retired code; no audit row | M6 | PASS |
| 5 | Annual Teaching Load change apply retired when no production caller (or fully guarded); no ignored version/fingerprint param | `/annual-teaching-load/apply` returns `410 ANNUAL_TEACHING_LOAD_APPLY_RETIRED`; `applyAnnualTeachingLoadChange` throws the same; the ignored `_expectedSubjectSectionOwnershipVersions` parameter is removed | Mounted annual apply → 410 with zero writes | M6 | PASS |
| 6 | All publication-state decisions use strict `isPublished === true` | `isStrictlyPublishedSummary` exported from `reconciliation.service.ts`; used there and in the repair service's `prepareRepair` preflight + apply/current-run checks | superseded (`isPublished:false` + markers) reconciliation preview → 200 (unpublished rules); `isPublished:true` reconciliation preview and repair preview → 409 `RUN_ALREADY_PUBLISHED`; predicate unit true/false | M2 | PARTIAL — see BLOCKING risk R1 |
| 7 | Compatible with locked successor `TT-TL-MODULES-C04` (consume, don't reimplement) | Adds `sourceFingerprint` to the preview result and `expectedSourceFingerprint` (optional, backward compatible) to the apply request; exposes the canonical strict predicate | current client request shape (no fingerprint) still applies successfully | M5b | PASS |
| 8 | Production-shape parity for changed route/persisted shapes | Real producer `computeGenerationInputSnapshot`; real consumers `compareCurrentInputsForRun` (freshness) and the client stale banner. Conservation: the persisted post-write `inputSnapshot` fingerprint still reflects post-write state; the new pre-write fingerprint is a guard only. Shape changes are additive fields (`sourceFingerprint`, `nonAuthorizing`, `applyRetired`) | M4 room interleave proves the guard fails closed on the real producer output | M4 | PASS |

## Mounted authority matrix (M1) — write tallies

Rejections return canonical typed codes and perform zero service dispatch
(proved by `scheduling_policy.count === 0` after every rejection, since any
dispatch through `previewTeachingLoadRepair`/`applyTeachingLoadRepair` calls the
policy resolver; and by `ownership`/`facultySubject` being unchanged).

| Row | Result |
|---|---|
| missing token | 401 `NO_TOKEN` |
| invalid token | 401 `INVALID_TOKEN` |
| non-privileged (`faculty`) | 403 `FORBIDDEN` |
| missing actor school | 403 `ACTOR_SCHOOL_REQUIRED` |
| cross-school actor | 403 `SCHOOL_MISMATCH` |
| cross-school + nonexistent run | 403 `SCHOOL_MISMATCH` (no dispatch; a dispatched request would be `RUN_NOT_FOUND`) |
| malformed schoolId / runId | 400 `INVALID_PARAM` |
| missing year mirror | 404 `YEAR_MIRROR_NOT_FOUND` |
| zero-active year | 409 `ACTIVE_YEAR_UNAVAILABLE` |
| historical year | 409 `INACTIVE_HISTORICAL_YEAR` |
| ambiguous active set | 409 `ACTIVE_YEAR_AMBIGUOUS` |
| archived year | 409 `ARCHIVED_YEAR_READ_ONLY` |
| same-school/current-year | 200 (preview proceeds) |

## Decisive evidence (this worktree, this session)

- `npx tsc --noEmit` (atlas-server): 0 errors.
- `npm run build` (atlas-server): exit 0.
- `npx tsx src/__tests__/tt-tl-authority-guard-c04.test.ts`: **46 passed, 0
  failed**; disposable fixture school/year fully cleaned (`zero residue = 0`).
- Failing-first (base `e3882ca0` export run of the same suite): missing-school,
  cross-school, historical, archived, and zero-active requests all dispatched
  (200 / 404) and created a `scheduling_policy` row; the strict predicate export
  is absent (FATAL at M2). Proves the new controls are load-bearing.
- `npx tsx src/__tests__/teaching-load-write-authority.test.ts`: PASS (exit 0).
- `npx tsx src/__tests__/timetable-sync-setup.test.ts`: 16 pass, 0 fail.
- Built-server mount smoke (isolated port 5399, `ROLLOVER_AUTO_SYNC_ENABLED=false`):
  `/api/v1/health` 200; `POST .../teaching-load-repairs/preview` no token 401;
  `POST .../annual-teaching-load/apply` no token 401; health 200 after; log
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`.
- `git diff --check`: exit 0.

## Known risks

- **BLOCKING (R1 — cross-lane integration dependency, req 6 superseded-repair
  path).** `manual-edit.service.ts` is owned by lane S2; its shared
  `isPublishedSummary`/`assertRunIsEditable` (lines 400-411) still refuses a run
  with `isPublished:false` + retained `publishedAt`/`publishedBy` markers when
  `loadRunContext` is called. My lane fixed every publication-state decision in
  its own files (strict preflight in `prepareRepair`, strict apply/current-run
  checks, strict reconciliation preview) and proved the requirement through the
  reconciliation preview route and the predicate, but the TL repair *positive*
  superseded-run path cannot be proven in isolation until S2 R9 lands. Exact
  companion change: S2 `TT-WARNING-AUTHORITY-C04` R9 must make
  `manual-edit.service.ts:400-411` use `summary.isPublished === true`. Do not
  waive this control; the planner integrates S2+S3 before that path is complete.
- **NON_BLOCKING.** Pre-existing failures in `teaching-load-reconciliation.test.ts`
  and `teaching-load-reconciliation-route.test.ts` (apply inserts 0 ownership
  rows). Neither file imports any file changed by this packet (they exercise the
  canonical `teaching-load-reconciliation.service`), and the route failure is
  already recorded as pre-existing in the living register (TL-RR01). With the
  full local `.env` loaded, the system-token rows pass; only the insert/replay
  expectation remains.
- **NON_BLOCKING.** `package.json`'s `test:timetable-quick-place` points at
  `src/__tests__/timetable-quick-place.test.ts`, which is absent at this base.
  This packet does not touch `timetable-quick-place.service.ts`, so the quick-place
  contract is unaffected.
- **NON_BLOCKING.** `reconciliation-classifier.ts` `OUTCOME_RANK` had
  non-existent keys under an unchecked cast; corrected to the real outcome keys.
  Dead ordering helper only.
- **NON_BLOCKING.** Database evidence used the repo's established disposable
  fixture pattern (unique timestamped fixture school + zero-residue cleanup)
  against the local PostgreSQL instance. Live school data was never read or
  written; the shared `.env` database was not reset or schema-mutated. The
  packet's "do not use the shared/live `.env` database" is satisfied by fixture
  isolation and zero residue, not by a separate server instance.

## No-mutation statement

No live/shared-data write, Teaching Load apply, generation, publication,
deployment, service restart, migration, schema change, login, companion-repo
edit, merge, rebase, or push was performed. All database activity was confined
to disposable fixture rows created and removed within the test, with a
zero-residue assertion. Worktree `node_modules` and generated Prisma client are
gitignored local build artifacts; `git status --short` lists only the changed
paths above.

`REVIEW_REQUIRED`
