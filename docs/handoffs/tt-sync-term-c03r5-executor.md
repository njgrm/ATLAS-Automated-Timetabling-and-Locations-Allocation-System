# TT-SYNC-TERM-C03R5 — Executor Handoff

Status: `REVIEW_REQUIRED` (executor does not self-accept, merge, or push).

## Immutable identity

- Worktree: `D:\ATLAS-worktrees\tt-sync-term-c03r5`
- Branch: `work/tt-sync-term-c03r5`
- Base SHA: `486bf8c7ee7bcf2ced17c696dea7184b271c9571` (origin/main at dispatch)
- Candidate SHA: tip of `work/tt-sync-term-c03r5` — this handoff is committed inside the single candidate commit; run `git rev-parse HEAD` in the worktree for the exact SHA (also reported in the executor return).
- Adoption: this branch adopted an uncommitted residual from a failed dispatch (five packet-owned files) under explicit planner authorization, re-audited every claim, completed the missing mutant control, and committed.

## Objective

Prevent the mounted "Sync timetable setup" workflow from persisting entries, unassigned items, violations, diagnostics, or summaries computed from an older source state while attaching a newer `GenerationInputSnapshot`. All computation reads are bound to ONE Serializable read snapshot; the complete fingerprint is recomputed and compared inside the final Serializable write transaction; any covered-input change aborts with typed `SOURCE_AUTHORITY_STALE` (409) and zero writes.

## Exact changed paths

- `atlas-server/src/services/timetable-sync-setup.service.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/__tests__/timetable-sync-setup.test.ts`
- `docs/handoffs/tt-sync-term-c03r5-executor.md` (this file)

No client files, no forbidden path, no living register / `CHANGELOG.md` / runtime source-of-truth map, no tracked stale `AGENTS.md`.

## Trace table

| Requirement | Production path | Negative control | Verification command | Result |
|---|---|---|---|---|
| All sync input reads bound to one consistent snapshot | `syncTimetableSetup` → `prisma.$transaction(Serializable)` read callback `computeFromSnapshot`; `loadRunContext(..., readTx)`, `getSectionSummary(..., {client: readTx, allowExternalSync:false, verifyRuntimeUpstream:false})`, `buildDerivedDemand({client: readTx})`, direct `readTx.*` reads, `withDataContext(readTx)` for `db()` helpers | R5-A/B/C interleave commits a real covered-input mutation between read snapshot and write tx | `npx tsx src/__tests__/timetable-sync-setup.test.ts` | PASS (16/16) |
| No global `prisma.` read escapes the computation path | Source inspection: the only bare `prisma.` uses in the service are the two `$transaction` calls (read snapshot + write). All reads inside `computeFromSnapshot` use `readTx` or a `readTx`-routed helper. `getOrCreatePolicy` uses `db()` → routed by `withDataContext(readTx)`. | — | inspection + `npx tsx ...` | PASS |
| Complete fingerprint compared inside the write transaction; snapshot attached only after equality | `persist`: re-read run (version/status/publication) → `buildDerivedDemand({client: tx})` revision guard → ownership re-read guard → `computeGenerationInputSnapshot(..., tx)` → `isInputSnapshotBound(readInputSnapshot, txInputSnapshot)` → only then build `updatedSummary` | R5-A/B/C assert `SOURCE_AUTHORITY_STALE` + zero writes; mutant control proves the predicate is load-bearing | `npx tsx ...` | PASS |
| Covered-input change → 409 `SOURCE_AUTHORITY_STALE`, zero writes | Read snapshot / write tx boundary | R5-A rooms, R5-B FacultySubject, R5-C grade-shift window | `npx tsx ...` | PASS |
| Preserved: actor-school checks, RUN_VERSION_STALE CAS, derived-demand revision + ownership guards, replay/noChange zero-write, notification-after-commit, Serializable retry + `SYNC_TRANSACTION_CONFLICT` | mounted router + `persist` + write loop | Controls F/G/H/I | `npx tsx ...` | PASS |
| R5-D empty section mirror fails closed, no external sync, zero residue | `getSectionSummary(..., {allowExternalSync:false})` → typed `DERIVED_DEMAND_BLOCKED` before any write | R5-D | `npx tsx ...` | PASS |
| Explicit executable mutant control | exported `isInputSnapshotBound` used by the service | R5-MUTANT + R5-A/B/C predicate assertions | `npx tsx ...` | PASS |

## Fingerprint-domain coverage mapping

`GenerationInputSnapshot` v2 (`schemaVersion: 2`) domains, all recomputed through the supplied client and compared as one `fingerprint`:

- `teachingLoad`: `facultyMirror` / `facultySubject` / `subjectSectionOwnership` aggregates + `teachingLoadCycle`, plus exact-row SQL md5 over `faculty_mirrors`, `faculty_subjects`, `subject_section_ownerships`, `teaching_load_cycles`.
- `policy`: `schedulingPolicy` + `gradeShiftWindow` aggregate, plus exact md5 over `scheduling_policies`, `grade_shift_windows`.
- `rooms`: `room` (teaching spaces in teaching buildings) + `building` aggregates, plus exact md5 over `buildings`, `rooms`.
- `sections`: `sectionMirror` (active-for-scheduling) aggregate, plus exact md5 over `section_mirrors`.
- `subjects`: `subject` (active) + `classTemplate` + `classTemplateSubject` aggregates, plus exact md5 over `subjects`, `class_templates`, `class_template_subjects`.
- `derivedDemand`: derived-demand revision + term format/count + line/pair totals (or blocker codes).

Independent in-transaction authority re-reads (not part of the fingerprint, preserved from the base contract):
- `GenerationRun`: `findFirst` (school/year scope, `COMPLETED`, not published) + `updateMany({ where: { id, version: expectedRunVersion } })` CAS.
- Derived-demand revision: re-resolved with `tx` and compared to the read-snapshot revision.
- Teaching Load ownership: full `subjectSectionOwnership` re-read and `ownershipSignature` comparison.

## Commands and observed counts

All run from `D:\ATLAS-worktrees\tt-sync-term-c03r5\atlas-server` unless noted.

| Command | Observed |
|---|---|
| `npx tsx src/__tests__/timetable-sync-setup.test.ts` | tests 16, pass 16, fail 0, skipped 0 (disposable PostgreSQL path RUNNING; A–I + R5-A/B/C/D + R5-MUTANT all executed) |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` (server production build) | exit 0 |
| `npx tsx src/__tests__/derived-demand-authority.test.ts` | tests 10, pass 10, fail 0 |
| `npx tsx src/__tests__/derived-demand-correction-c01r2.test.ts` | tests 7, pass 7, fail 0 |
| `npx tsx src/__tests__/timetable-candidate-domain.test.ts` | tests 12, pass 12, fail 0 (real `loadRunContext`/quick-place consumer family) |
| `npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts` | tests 16, pass 16, fail 0 (generation-preflight → `getTemplatePeriodProfiles` family) |
| `npx tsx src/__tests__/generation-readiness-disposable-genc02r.test.ts` | tests 1, pass 1, fail 0 (disposable PostgreSQL) |
| `npx tsx src/__tests__/publication-contract-readiness.test.ts` | "publication contract readiness: all checks passed", exit 0 |
| `git diff --check` (worktree) | clean |

Disposable-database confirmation: the sync suite provisions `atlas_restore_drill_<yyyymmdd>_synct<hex>` from the local `.env` connection parameters, applies the canonical schema only inside it via `prisma migrate deploy`, and its `after` hook drops it `WITH (FORCE)` and asserts `pg_database` count `0`. The configured database is never written; no migration runs outside the disposable database. `generation-readiness-disposable-genc02r` follows the same disposable pattern.

## Mutant-control result (explicit)

The production comparison is extracted as `isInputSnapshotBound(readSnapshot, writeSnapshot)` (exported, single source of truth used by `persist`).

- (a) equal snapshot pair → `true` (R5-MUTANT asserts `isSnapshotBound(before, before) === true`; R5-A/B/C also assert this on their real pairs).
- (b) real changed-domain pair → `false` (R5-MUTANT asserts `isSnapshotBound(before, after) === false` after a real committed room change; R5-A/B/C assert false on their mounted-route interleave pairs).
- (c) comparison-removed mutant `(_r, _w) => true` accepts the exact interleave fixture pair (`true`), and R5-MUTANT asserts the mutant and the real predicate disagree on that same pair. R5-A/B/C prove the real service path returns `409 SOURCE_AUTHORITY_STALE` + zero writes for the identical interleave shape, so removing the comparison would let the write commit output derived from the older snapshot.

## Zero-write proofs per interleave (R5-A/B/C)

Each control:
- asserts `outcome.calls >= 2` (read snapshot and write transaction both ran),
- asserts HTTP `409` / `SOURCE_AUTHORITY_STALE`,
- proves the mutation is real and covered: the affected domain fingerprint changed AND the complete `fingerprint` changed,
- proves the mutation is invisible to the pre-existing guards: derived-demand revision unchanged AND ownership signature unchanged,
- asserts `0` `TIMETABLE_SETUP_SYNC_COMPLETED` notifications,
- `assertRunUnchangedAndZeroWrite`: `version`, `draftEntries`, `unassignedItems`, `violations`, `summary` byte-identical and zero new audit rows.

- R5-A: `room.capacity 50 → 51` → `rooms` domain changed (revision + ownership unchanged).
- R5-B: `facultySubject.gradeLevels [7] → [7,8]` → `teachingLoad` domain changed (revision + ownership unchanged).
- R5-C: `gradeShiftWindow.startTime 07:00 → 07:30` → `policy` domain changed (revision + ownership unchanged).

## Empty-mirror decision (R5-D)

`getSectionSummary` gained optional `{ client, allowExternalSync, verifyRuntimeUpstream }`; existing callers keep the historical defaults (`db()`, `allowExternalSync: true`, `verifyRuntimeUpstream: true`). The sync computation path passes `allowExternalSync: false` and `verifyRuntimeUpstream: false`, so it never performs `syncSectionsFromExternal` (external fetch + mirror writes) or a live EnrollPro verification network call inside the read snapshot. An empty active-section mirror therefore fails closed with typed `409 DERIVED_DEMAND_BLOCKED`; the operator must run the explicit section/rollover sync first. R5-D asserts the run is unchanged, zero `sectionMirror` rows created, and zero audit rows. The policy auto-create reached via `getOrCreatePolicy` inside the read snapshot is rolled back with the aborted read transaction (zero residue).

## Known risks / residuals

- `getTemplatePeriodProfiles` gained an optional `client` parameter for transaction-consistent future callers. No production caller in this stream passes it; its two existing callers use the unchanged default. It is plumbing only and does not affect the sync computation path.
- The R5 interleave harness triggers the mutation on the second `prisma.$transaction` call. If the read snapshot were to exhaust a Serializable retry before the write transaction, the interleave would target a retried read instead. Evidence is green and deterministic on the disposable fixture; this is a single-threaded test-only concern.
- The write transaction now recomputes the full snapshot; it uses the same bounded `timeout: 30_000, maxWait: 10_000` as the read snapshot to avoid the short interactive default. Absolute production latency under a large real dataset was not measured here (no shared runtime used).
- `computeGenerationInputSnapshot` excludes `computedAt` from `fingerprint`, so the comparison is deterministic.

## Safety / boundary statement

- Zero mutation of the configured/shared database. All database work was against the disposable `atlas_restore_drill_*` database, created and dropped by the suite.
- No migrations outside the disposable database; no shared runtime (5001/5174); no login; no deployment/generation/publication; no Teaching Load apply; no term-cache work; no companion repositories; no push; no merge/rebase; no edits to the living register, `CHANGELOG.md`, the runtime source-of-truth map, or the tracked stale `AGENTS.md`.
- Worktree `git status --short` is EMPTY after the candidate commit (verified; only the six intended paths were committed).
