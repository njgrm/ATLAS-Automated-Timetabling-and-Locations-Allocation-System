# PUBLISHED-IMMUTABILITY-C08 — Published revision as a historically reproducible artifact

- Cycle/stream: `PUBLISHED-IMMUTABILITY-C08`
- Kind: `CYCLE` (source-only)
- Risk tier: `MEDIUM` source; generation/publication remain separately gated `HIGH`
- Base/authority pin: `origin/main` = `c950e6944f148343b8c864bea5aa080bd6a19426`
- Directive pin: `origin/main:AGENTS.md` LF-normalized SHA-256
  `ffd1452004753aa0f2b7ef21d990cb1df6e540c2850155b30dece990b8b82bd5`
  (read the raw `origin/main:AGENTS.md`, not a stale worktree copy)
- Writable worktree: `E:/ATLAS-worktrees/published-immutability-c08`
- Branch: `work/published-immutability-c08`
- Disposition: `RETIRE_AFTER_INTEGRATION`
- Recommended executor reasoning: `high` (do not use `max`)

## 0. Planner reconnaissance note (read before starting)

The operator cited a completed read-only `PUBLISHED-IMMUTABILITY-ARCHIVE-AUDIT-C07`
as primary evidence. **No such artifact exists in `origin/main`, in any branch, in
the machine register (`docs/plans/atlas-delivery-cycles.json`), or under either
worktree root.** It is a missing process artifact, not a source blocker: the
planner independently re-derived the defect set from source (2026-09-16) and every
material claim reproduced. Do not claim the C07 audit as evidence anywhere. Cite
the recon rows below instead.

## 1. Objective

Make one published revision a historically reproducible artifact. After
publication, later changes to subject, faculty, room, building, section,
specialization, cohort, policy, special-event, term-authority, active-year, or
signatory records must not alter that revision's rendered public, authenticated,
archived, or exported truth — for the frozen fields defined in §3.

## 2. Recon-confirmed defects (all independently verified against `c950e694`)

| ID | Defect | Evidence |
|---|---|---|
| D1 | No frozen display-identity snapshot exists. Published reads resolve subject/section/faculty/room/building/specialization/cohort names **live** at read time. | `atlas-server/src/services/published-schedule.service.ts:640-676`; `loadReferenceMaps` `:343-409` |
| D2 | Special events and scheduling policy are read **live** at published-read time; only display slots are frozen (`summary.timetableDisplaySlots`). Frozen slots can therefore contradict live special events. | `published-schedule.service.ts:532-539`, `:682-692` |
| D3 | No legacy-snapshot state. A publication without a frozen snapshot silently renders live values while claiming to be the published truth. | no such branch exists; `resolvePublishedRun` `:174-243` |
| D4 | Official exports rehydrate human-readable identity from live Prisma for every output. | `workbook-export.service.ts:255-280`, `:350-360`; `teacher-program-export.service.ts:403-420`, `:521-530`, `:641`; `room-program-export.service.ts:196-200`; `class-program-matrix.service.ts:235-256` |
| D5 | Archived/non-active years cannot resolve a term at all, so every per-term archived read and **every** official export fails closed. | `academic-term.service.ts:101` requires `isActive && !isArchived && termContractCache`; every export route calls `resolveRequestedTermIndex` (`generation.router.ts:652,717,796,895,996`) |
| D6 | `GET /schools/:schoolId/schedules/published/:termId` consumes the path segment as `schoolYearId`. | `published-schedule.router.ts:428,441` → `published-schedule.service.ts:514` signature `(schoolId, schoolYearId, ...)` |
| D7 | Active-year metadata: `isActiveSchoolYear` derives from a possibly-null active-year election and is computed inconsistently across the base and explicit-year route families; archived years are not specially excluded from the read-side election. | `published-schedule.service.ts:299,321-322`; overrides `published-schedule.router.ts:282-283,375-376,397-398,419-420`; `resolveActiveSchoolYearId` `:61-75` |
| D8 | Routine faculty sync can silently unpublish a published run **and** set it `FAILED`. | `faculty.service.ts:759-769` → `generation.service.ts:1583-1630` (`:1609-1612` `status:'FAILED'`; `:1614-1620` clears markers; `:110-114` nulls `isPublished/publishedAt/publishedBy`); marker test `:93-98` |
| D9 | Signatory/presentation is time-bound but the export path must still resolve it for archived years. | `export-presentation.service.ts:252-283`, `:292-312`, `:327-339` |

Preserved strengths (must not regress): run-wide zero-hard-blocker gate;
actor-school authorization; `Serializable` transaction + `pg_advisory_xact_lock`
+ run-version CAS; replay idempotency; exactly one publication audit and one
notification; draft/published separation; revision effective-date overlay;
frozen signatory revision; no public draft/policy/internal-run leakage.

## 3. Frozen snapshot design (mandatory)

### 3.1 Location — no migration

Store the frozen snapshot in the **base `PublishedScheduleRevision.metadata`
JSON** under a single key `publishedIdentitySnapshot` on the revision whose
`reason === 'INITIAL_PUBLICATION'` / `changeSummary.publicationBase === true`.
`published_schedule_revisions.metadata` is nullable `JSONB`
(`prisma/migrations/0000_clean_baseline/migration.sql:592`) and
`resolvePublishedRun` already validates and returns that base revision
(`published-schedule.service.ts:240-243`). **Do not add a column, model, enum,
or migration.** If, after reading the real publish path, you conclude a schema
change is genuinely unavoidable, STOP and return
`PLANNER_DECISION_REQUIRED` with the exact evidence; do not add schema work.

### 3.2 Snapshot contract

```ts
type PublishedIdentitySnapshot = {
  schemaVersion: 1;
  capturedAt: string;                 // ISO; the publication instant
  inputFingerprint: string;           // same fingerprint already persisted at publish
  orderedTermContract: {
    format: 'TRIMESTER' | 'QUARTERS';
    terms: { identity: string; displayLabel: string; order: number }[];
    activeTermOrder: number | null;
  };
  subjects:  Record<string, { code: string; name: string }>;
  faculty:   Record<string, { externalId: string | null; employeeId: string | null;
                              displayName: string | null; firstName: string | null;
                              lastName: string | null; isPlaceholder: boolean }>;
  sections:  Record<string, { externalId: string | null; name: string; gradeLevelId: number | null;
                              gradeLevelName: string | null; programType: string | null;
                              programCode: string | null; programName: string | null }>;
  buildings: Record<string, { name: string }>;
  rooms:     Record<string, { name: string; type: string; floor: string | null;
                              buildingId: number | null; buildingName: string | null }>;
  specializations: Record<string, { code: string; label: string | null }>;
  cohorts:   Record<string, { cohortCode: string | null; name: string | null;
                              specializationCode: string | null; specializationName: string | null }>;
  displaySlots: { key: string; label: string; startTime: string; endTime: string;
                  order: number; kind: string }[];
  specialEvents: { eventType: string; label: string; gradeGroup: string | null;
                   programType: string | null; startTime: string; endTime: string;
                   sortOrder: number; dayOfWeek: string | null }[];
  policy: Record<string, unknown>;    // the presentation-relevant SchedulingPolicy projection
};
```

Map keys are the numeric ids as strings (JSON object keys). Capture **only**
identities actually referenced by the published entries plus every special event
and display slot needed by the artifact; do not capture whole tables.

### 3.3 Atomicity

The snapshot must be computed from a preflight read, then bound to the same
transaction that persists the publication, using the **existing** freshness
fingerprint. If any covered input changed between preflight and the write, fail
closed with a typed error and zero writes — never attach a snapshot derived from
older data. Reuse `runSerializablePublicationTransaction`
(`serializable-transaction-retry.ts:34-40`) and the existing advisory lock and
run-version CAS (`publication-contract.service.ts:172,386-390`).

### 3.4 Snapshot consistency gate

Frozen `displaySlots` and frozen `specialEvents` must be captured from one
consistent source snapshot and must not contradict. A Monday-only Flag
Ceremony/HGP row stays a day-scoped overlay on its underlying configured period
and must never appear as an added ordinary slot (`lib/policy-special-events.ts`).
Reject a publish whose frozen special events contradict its frozen display slots
with a typed blocker and zero writes.

### 3.5 Resolution rule (reads, exports, revisions)

1. If the published base revision carries a valid `publishedIdentitySnapshot`,
   every frozen field resolves from it — **never** from live tables.
2. If it does not, return the honest typed state
   `snapshotState: 'LEGACY_LIVE_PROJECTION'` (see §4.3). Never claim frozen
   reproduction while reading live values.
3. Revisions (`PublishedScheduleRevision` effective-date overlay) continue to
   overlay entry changes onto the frozen base snapshot **without** mutating the
   source `GenerationRun`. Keep `REVISION_ENTRY_FIELDS` semantics
   (`published-schedule.service.ts:105-156`).
4. A frozen field absent from the snapshot key set (new entity introduced after
   publication) renders the existing deterministic placeholder
   (`SUBJECT_<id>` etc.) and reports the gap in a typed `snapshotGaps` list; it
   must not silently read the live row.

## 4. Required corrections (each is a REQUIRED acceptance outcome)

### 4.1 Freeze identity at publication (covers D1)
Write the §3.2 snapshot atomically during publication for: subject id/code/name;
faculty id/external identity/employee identity/display name/placeholder state;
section id/external identity/name/grade/program; room id/name/type/floor and
building id/name; specialization code/label; cohort id/name; display slots;
special events; policy; ordered-term contract.

### 4.2 Freeze term/display/event contract (covers D2)
The snapshot carries the ordered-term contract, selected-term identity, display
slots, breaks, Flag Ceremony/HGP overlay, and special events used by the
artifact. Frozen slots and frozen special events must not contradict (§3.4).

### 4.3 Frozen-first reads + legacy state (covers D1, D3)
`published-schedule.service.ts` (and every read consumer) resolves frozen values
first. Published payloads gain an explicit `snapshotState` field:
`'FROZEN' | 'LEGACY_LIVE_PROJECTION'`. Legacy publications must not be reported
as immutably reproduced. Frozen-first applies to subject, section, faculty,
room, building, specialization, cohort, display slots, special events, and
policy.

### 4.4 Preserve effective-dated revision behavior (covers D-revision)
Revisions overlay changes onto the frozen publication snapshot without mutating
the source `GenerationRun`; effective-date selection and revision CAS behavior
are unchanged.

### 4.5 Current-year route metadata (covers D7)
- A read of the runtime-active, non-archived school year reports
  `isActiveSchoolYear: true` and `isHistorical: false`.
- A read of any other year reports `isHistorical: true` and
  `isActiveSchoolYear: false`.
- An archived year is **never** elected current, and an ambiguous/no active-year
  election must not silently mark the true active year historical.
- Both the base route family and the explicit `school-years/:schoolYearId`
  family must agree for the same scope.

### 4.6 Correct `:termId` route family (covers D6)
`/api/v1/schools/:schoolId/schedules/published/:termId` and its
`/sections/:sectionId`, `/faculty/:facultyId`, `/rooms/:roomId` siblings:
`termId` is **term identity within the resolved published school year**, never a
`schoolYearId` alias. Resolve it through the frozen ordered-term contract of the
resolved published run, then filter entries to that term. Invalid, absent, or
out-of-contract terms fail closed with a typed error (reuse the
`academic-term.service.ts` codes: `INVALID_TERM_INDEX`,
`TERM_INDEX_OUTSIDE_CONTRACT`, `TERM_STRUCTURE_UNAVAILABLE`,
`TERM_FILTER_NOT_READY`). No client caller exists today
(`atlas-client/src` has none), so this redefinition is safe; add mounted route
tests.

### 4.7 Archived reads and exports (covers D5)
Archived publications must be:
- readable all-term (no `termIndex`);
- readable by every frozen ordered term;
- exportable by term for section/class, teacher, room, summary workbook, and
  matrix.

The frozen `orderedTermContract` in the snapshot is the term authority for
published/archived consumers. Add a frozen-contract path to term resolution so a
published run never depends on the live `EnrollProSchoolYearMirror`
active/non-archived cache (`academic-term.service.ts:101`). Live/active-year
resolution is still used for unpublished/draft work. Archived export must not
fall back to live term authority.

### 4.8 One frozen truth for every official output (covers D4)
Public schedule; authenticated faculty schedule; Section/Class Program; Teacher
Program; Room Program; Summary workbook; class-program matrix. Each must consume
the frozen snapshot for published runs. No output may independently rehydrate
human-readable identities from current authority tables for a published run.
Exports for unpublished/draft runs keep live resolution.

### 4.9 Synchronization must never erase history (covers D8)
Routine faculty/subject/room/policy synchronization must never set a published
run to `FAILED` or `isPublished: false`. Fix
`invalidateStaleCompletedRuns` (`generation.service.ts:1583-1630`) so a run
carrying published markers is excluded from the destructive path and instead
records a typed, audited successor condition (drift marker) while preserving
`status`, `isPublished`, `publishedAt`, `publishedBy`, and the published
revision. Unpublished COMPLETED runs keep today's invalidation behavior. Do not
regress the intentional supersession path (`publication-contract.service.ts:314-324`).

### 4.10 Preserve existing strengths
§2 "Preserved strengths" — prove each still holds.

## 5. Mandatory failing-first controls

Build a **real three-term disposable-PostgreSQL fixture**: one year-long `MATH`
plus term rotations `BIO`/`CHEM`/`PHYSICS` (T1/T2/T3). Publish it through the
real production entry point (`publishSchedule` / the mounted publish route).
Capture every read and official output. Then, one category at a time, mutate and
assert byte/semantic equivalence for every frozen field:

1. Subject labels/codes.
2. Faculty labels and identities.
3. Room/building/floor/type.
4. Section name/grade/program.
5. Specialization/cohort.
6. Scheduling policy, special events, display-slot sources.
7. Active-year election.
8. Ordered-term cache.
9. Signatory active configuration.
10. Faculty-synchronization inputs.

Only intentionally request-time fields (requested date, effective revision
selection) may change. Additionally prove:

- T1/T2/T3 retain correct rotations **and** full ordinary-year subjects (MATH
  present in every term; BIO only in T1, CHEM only in T2, PHYSICS only in T3).
- Archived per-term reads and every official export succeed.
- `:termId` never selects a school year.
- Faculty sync cannot unpublish or orphan the revision.
- Anonymous public routes expose only published data.
- Cross-school reads fail closed.
- Replay creates no duplicate revision, audit, or notification.
- Failed publication writes nothing (zero residue on a rejected publish).
- Disposable database cleanup leaves zero residue (assert the DB is dropped).

### Mutants (each must make a committed decisive control fail, then be restored byte-exactly)

- M1 restore one live subject lookup in a published read;
- M2 restore one live faculty lookup in a published read;
- M3 restore one live room/building lookup in a published read;
- M4 restore one live section lookup in a published read;
- M5 restore live special-event lookup in a published read;
- M6 remove the frozen term contract from the snapshot (published/archived term resolution must fail closed);
- M7 reinterpret `:termId` as `schoolYearId`;
- M8 restore faculty-sync unpublication;
- M9 force current-year `isActiveSchoolYear = false`;
- M10 allow an archived export to use current term authority.

Record each mutant's failing control, exact file/line, and byte-exact restore.

## 6. Gates — exactly 26 `MANDATORY_SOURCE` rows, 0 `MANDATORY_LIVE`

The stream record predeclares `plan = { MANDATORY_SOURCE: 26, MANDATORY_LIVE: 0,
DEFERRED_EXTERNAL: 0 }`. Record exactly these 26 rows; a declared gate may not be
dropped or renumbered.

| # | Gate | Decisive command |
|---|---|---|
| 1 | C08 disposable-PG fixture: real publish + all 10 mutation categories + frozen equivalence | new `published-immutability-c08*.test.ts` |
| 2 | Archived/all-term published reads and every official export succeed | same suite |
| 3 | T1/T2/T3 rotation + full ordinary-term parity | same suite |
| 4 | `:termId` never selects a school year; mounted route semantics | same suite |
| 5 | Faculty sync cannot unpublish/orphan; drift is non-destructive + audited | same suite |
| 6 | Anonymous public routes expose only published data; cross-school fail closed | same suite |
| 7 | Replay: no duplicate revision/audit/notification | same suite |
| 8 | Failed publication writes nothing (zero residue) | same suite |
| 9 | Disposable DB cleanup proof (database dropped) | same suite |
| 10 | Mutant M1 live subject lookup restored → control fails | suite/mutant log |
| 11 | Mutant M2 live faculty lookup | suite/mutant log |
| 12 | Mutant M3 live room/building lookup | suite/mutant log |
| 13 | Mutant M4 live section lookup | suite/mutant log |
| 14 | Mutant M5 live special-event lookup | suite/mutant log |
| 15 | Mutant M6 frozen term contract removed | suite/mutant log |
| 16 | Mutant M7 `:termId` reinterpreted as `schoolYearId` | suite/mutant log |
| 17 | Mutant M8 faculty-sync unpublication restored | suite/mutant log |
| 18 | Mutant M9 current-year `isActiveSchoolYear=false` | suite/mutant log |
| 19 | Mutant M10 archived export uses current term authority | suite/mutant log |
| 20 | Publication suites: `publication-contract-readiness.test.ts`, `publication-contract-postgres-concurrency.test.ts` | `npx tsx <file>` in `atlas-server` |
| 21 | Published-revision + effective-date + revision-CAS suites | `npx tsx <file>` |
| 22 | Public-read suites incl. `derived-demand-correction-c01r2.test.ts` published reads | `npx tsx <file>` |
| 23 | Export suites: `tt-output-c05-beneficiary-parity.test.ts`, `tt-output-c05r1-teacher-program.test.ts`, `timetable-output-export-c03.test.ts`, `class-program-matrix` suite | `npx tsx <file>` |
| 24 | `export-presentation-*.test.ts` + `rr-ux01-rollover-history.test.ts` (preserved) | `npx tsx <file>` |
| 25 | `atlas-server` `tsc` build **and** `atlas-client` `vite build` | `npm --prefix atlas-server run build`; `npm --prefix atlas-client run build` |
| 26 | Built-server startup + explicit `.js` runtime-import proof; `git diff --check` clean; `npm run workflow:verify` exit 0 | `node atlas-server/dist/server.js`; `git diff --check`; `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json` |

Every mutant must make a committed decisive control fail and be restored
byte-exactly; record the failing control and the restore evidence.

## 7. Boundaries (forbidden)

No live login, deployment, restart, runtime/task/env change, shared/live DB
write, live generation, publication, rollover, migration, schema action, or
companion-repository edit. Companion repositories are `READ_ONLY`. Do not edit
the living register (`docs/plans/atlas-delivery-cycles.json` / `.generated.md`)
or `phasePlan.md`. Do not introduce a migration. No `prisma db push`,
`migrate reset`, or force-reset against any target.

## 8. Return contract

Commit the candidate on `work/published-immutability-c08` and return
`REVIEW_REQUIRED` with: base SHA, candidate SHA, exact changed paths, the
requirement→production-path→negative-control→verification trace table with each
row PASS/BLOCKED/DEFERRED, per-term counts, frozen-authority matrix, mutant
results, disposable-DB cleanup proof, and remaining risks classified
`BLOCKING`/`NON_BLOCKING`. Classify material claims as `REQUIREMENT`,
`CURRENT_STATE`, `SUCCESSOR`, or `HISTORICAL`. A `CURRENT_STATE` claim that is
still listed as unfinished successor work fails QA. Do not self-approve, merge,
or push.
