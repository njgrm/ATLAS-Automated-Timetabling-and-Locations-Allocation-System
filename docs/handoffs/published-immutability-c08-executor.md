# PUBLISHED-IMMUTABILITY-C08 — Executor Progress Ledger

- Stream: `PUBLISHED-IMMUTABILITY-C08` (source-only, MEDIUM)
- Worktree: `E:/ATLAS-worktrees/published-immutability-c08`
- Branch: `work/published-immutability-c08`
- Base SHA: `47e062a32f04266acaf84ebf8662d6d397566fcd`
- Governing packet: `docs/prompts/published-immutability-c08-2026-09-16.md`
- Status: `REVIEW_REQUIRED`
- Final candidate SHA: recorded in the executor return (this ledger is a
  committed part of the candidate, so it cannot contain its own tip SHA).

## Objective

Make one published revision a historically reproducible artifact: after
publication, later changes to subject, faculty, room, building, section,
specialization, cohort, policy, special-event, term-authority, active-year, or
signatory records must not alter that revision's rendered public, authenticated,
archived, or exported truth.

## Design (unchanged from the reviewed candidate `309640e5`)

- Frozen snapshot stored in the base `PublishedScheduleRevision.metadata` JSON at
  key `publishedIdentitySnapshot`. **No migration, no new column/model/enum.**
- Built from a preflight read **inside the existing Serializable publication
  transaction**, after the existing freshness comparison. A covered-input change
  fails closed via `PUBLICATION_INPUTS_STALE` before anything is written.
- Frozen `displaySlots` / `specialEvents` are validated for mutual consistency at
  publish time (`PUBLICATION_SNAPSHOT_INCONSISTENT`, zero writes).
- Published payloads carry `snapshotState: 'FROZEN' | 'LEGACY_LIVE_PROJECTION'`
  plus a typed `snapshotGaps` list. Legacy publications are never reported as
  immutably reproduced.
- Frozen-first resolution on every published read and every official export.
  Archived/published term resolution uses the frozen `orderedTermContract`, never
  the live active-year mirror cache.
- Routine synchronization never sets a published run `FAILED` or clears its
  published markers; drift is recorded as a typed, audited successor condition.

## Changed paths (full candidate range)

Product source (commit `309640e5`):

- `atlas-server/src/services/published-identity-snapshot.service.ts` (new)
- `atlas-server/src/services/publication-contract.service.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/academic-term.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/class-program-slot.service.ts`
- `atlas-server/src/services/workbook-export.service.ts`
- `atlas-server/src/services/room-program-export.service.ts`
- `atlas-server/src/services/class-program-matrix.service.ts`
- `atlas-server/src/services/teacher-program-export.service.ts`
- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/routes/generation.router.ts`

Tests:

- `atlas-server/src/__tests__/published-immutability-c08.test.ts` (new; `309640e5`, `18201e4f`, `3b7ce200`)
- `atlas-server/src/__tests__/publication-contract-readiness.test.ts`
- `atlas-server/src/__tests__/tt-output-c03r-route.test.ts`
- `atlas-server/src/__tests__/timetable-output-export-c03.test.ts`
- `atlas-server/src/__tests__/tt-output-c05-beneficiary-parity.test.ts`

Ledger:

- `docs/handoffs/published-immutability-c08-executor.md` (this file)

## Completion work in this pass

### 1. Mutant observability (commit `3b7ce200`)

Wraps the T1/T2/T3 frozen-term reads and the post-synchronization-drift read in
the C08 suite so a mutant yields a named control `[FAIL]` and a `[SUMMARY]`
instead of aborting with `[FATAL]`. Positive assertions are unchanged; the
baseline remains `passed=105 failed=0`.

### 2. Read/export fixture alignment (this commit)

The C08 frozen-first read/export contracts require a published payload to carry
the resolved display identity (the real `getPublishedFacultySchedule` producer
always emits subject `code`/`name`, section `name`/`gradeLevel`/`gradeLevelName`,
room `name`/`buildingName`). Three historical fixtures hand-rolled id-only
published payloads, so the frozen-first projection rendered deterministic
placeholders and the suites failed. `publication-contract-readiness.test.ts`
also lacked the `policySpecialEvent` delegate that the new in-transaction
snapshot build reads. The fixtures now mirror the real producer (production-shape
equivalence) and the partial read stub implements the delegate.

Base-vs-candidate bisect (C08 product files reverted to `47e062a3`, then
restored byte-exactly) proved every one of these was a C08-introduced regression,
not a pre-existing failure:

| Suite | base `47e062a3` | candidate before repair |
|---|---|---|
| `tt-output-c05-beneficiary-parity.test.ts` | 11/11 pass | 10/11 (M10 DOCX weekday compaction) |
| `timetable-output-export-c03.test.ts` | 8/8 pass | 1 fail at `:174` (placeholder identity) |
| `tt-output-c03r-route.test.ts` | 15/15 pass | 4 pass / 11 fail (500 from the missing revision delegate) |
| `publication-contract-readiness.test.ts` | — | `[FATAL]` in `buildPublishedIdentitySnapshot` |

## Gate results (§6, exactly 26 `MANDATORY_SOURCE` rows)

All commands run from `atlas-server` unless noted. Database-backed rows used only
guarded `atlas_restore_drill_*` disposable databases.

| # | Gate | Decisive command | Result |
|---|---|---|---|
| 1 | Disposable-PG fixture: real publish + 10 mutation categories + frozen equivalence | `npx tsx src/__tests__/published-immutability-c08.test.ts` | **PASS** `[SUMMARY] passed=105 failed=0` |
| 2 | Archived/all-term reads + every official export succeed | same suite | **PASS** (archived all-term 18 sessions; T1/T2/T3 reads; summary/class/room/matrix/teacher exports) |
| 3 | T1/T2/T3 rotation + full ordinary-term parity | same suite | **PASS** (see per-term counts) |
| 4 | `:termId` never selects a school year; mounted route semantics | same suite | **PASS** (200 term read; 400 `TERM_INDEX_OUTSIDE_CONTRACT`; 400 `INVALID_TERM_INDEX`; 404 cross-school) |
| 5 | Faculty sync cannot unpublish/orphan; drift non-destructive + audited | same suite | **PASS** (`status COMPLETED`, markers preserved, 1 drift audit, revision intact) |
| 6 | Anonymous public routes expose only published data; cross-school fail closed | same suite | **PASS** (200 anonymous, 18 entries, no `inputSnapshot`; `PUBLISHED_RUN_NOT_FOUND`) |
| 7 | Replay: no duplicate revision/audit/notification | same suite | **PASS** (1 revision, 1 audit, artifact unchanged) |
| 8 | Failed publication writes nothing (zero residue) | same suite | **PASS** (`PUBLISH_BLOCKED_HARD_VIOLATIONS`; `{revisions:0,audits:0,published:0}`) |
| 9 | Disposable DB cleanup proof | same suite | **PASS** (DB dropped/asserted absent; 0 fixture residue in the configured source DB) |
| 10 | M1 live subject lookup restored → control fails | `npx tsx <suite>` | **PASS** see mutant table |
| 11 | M2 live faculty lookup | `npx tsx <suite>` | **PASS** see mutant table |
| 12 | M3 live room/building lookup | `npx tsx <suite>` | **PASS** see mutant table |
| 13 | M4 live section lookup | `npx tsx <suite>` | **PASS** see mutant table |
| 14 | M5 live special-event lookup | `npx tsx <suite>` | **PASS** see mutant table |
| 15 | M6 frozen term contract removed | `npx tsx <suite>` | **PASS** see mutant table |
| 16 | M7 `:termId` reinterpreted as `schoolYearId` | `npx tsx <suite>` | **PASS** see mutant table |
| 17 | M8 faculty-sync unpublication restored | `npx tsx <suite>` | **PASS** see mutant table |
| 18 | M9 current-year `isActiveSchoolYear=false` | `npx tsx <suite>` | **PASS** see mutant table |
| 19 | M10 archived export uses current term authority | `npx tsx <suite>` | **PASS** see mutant table |
| 20 | `publication-contract-readiness.test.ts`, `publication-contract-postgres-concurrency.test.ts` | `npx tsx <file>` (concurrency under a provisioned disposable DB) | **PASS** readiness `publication contract readiness: all checks passed` exit 0; concurrency exit 0 (`zeroWrites: true`, both advisory-lock SQLSTATE 42883 negative controls, initial/revision/stale-token concurrency counts) |
| 21 | Published-revision + effective-date + revision-CAS suites | gate-20 suites + `npx tsx src/lib/__tests__/published-revision-client.test.ts` (atlas-client) | **PASS** readiness covers `createPublishedScheduleRevision` effective-date/CAS/chain-causality/stale-token; concurrency covers real-PG revision CAS; client `4/4 pass, 0 fail` |
| 22 | Public-read suites incl. `derived-demand-correction-c01r2.test.ts` | `npx tsx src/__tests__/derived-demand-correction-c01r2.test.ts` (disposable DB) | **PASS** `tests 7, pass 7, fail 0, skipped 0`; disposable dropped |
| 23 | Export suites | `tt-output-c05-beneficiary-parity.test.ts`, `tt-output-c05r1-teacher-program.test.ts`, `timetable-output-export-c03.test.ts`, `tt-output-c03r.test.ts`, `tt-output-c03r-route.test.ts` | **PASS** 11/11, 11/11, 8/8, 13/13, 15/15 |
| 24 | `export-presentation-*.test.ts` + `rr-ux01-rollover-history.test.ts` | `npx tsx <file>` | **PASS** schema-guard-c06b 2/2, route 9/9, postgres 1/1, `RR-UX01 … : PASS` |
| 25 | `atlas-server` `tsc` build **and** `atlas-client` `vite build` | `npm --prefix atlas-server run build`; `npm --prefix atlas-client run build` | **PASS** server exit 0; client `built in 22.11s` exit 0 (chunk-size warnings only) |
| 26 | Built-server startup + `.js` runtime-import proof; `git diff --check`; `workflow:verify` | `node atlas-server/dist/server.js` (isolated port + disposable DB); import scan; `git diff --check`; `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json` | **PASS** — see below |

Gate 26 evidence:

- Built server on isolated port `5199` with a disposable `DATABASE_URL`:
  `listening: true`, `healthStatus: 200`, `aliveBeforeSettle: true`,
  `aliveAfterSettle: true`, `dbConnectedLog: true`
  (`[ATLAS] Server listening on http://localhost:5199`, `[prisma] ✔ DB connected`),
  disposable dropped and asserted absent. The shared 5001/5174 supervisor
  runtime was not touched.
- Explicit ESM-safe relative-import scan over the 12 changed server source
  files: `relative_import_specifiers=75  without_.js=0`.
- `git diff --check`: exit 0.
- `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json`:
  exit 0, `"errors": []`.

## Per-term counts (real `publishSchedule`, all three terms)

| Term | MATH | BIO | CHEM | PHYS | Total entries |
|---|---|---|---|---|---|
| T1 | 5 | 1 | 0 | 0 | 6 |
| T2 | 5 | 0 | 1 | 0 | 6 |
| T3 | 5 | 0 | 0 | 1 | 6 |
| All-term | 15 | 1 | 1 | 1 | **18** |

`G03` codes: T1 `BIO,MATH,MATH,MATH,MATH,MATH`; T2
`CHEM,MATH,MATH,MATH,MATH,MATH`; T3 `MATH,MATH,MATH,MATH,MATH,PHYS`. MATH is
present in every term and BIO/CHEM/PHYS leak outside T1/T2/T3 by zero.

## Frozen-authority matrix

Each of the ten §5 mutation categories was applied live after publication and
every consumer was asserted byte/semantically stable (4 controls each = 40 PASS):

| Category | published payload | export context | class-program matrix | teacher program |
|---|---|---|---|---|
| 1 subject labels/codes (M1) | PASS | PASS | PASS | PASS |
| 2 faculty labels/identities (M2) | PASS | PASS | PASS | PASS |
| 3 room/building/floor/type (M3) | PASS | PASS | PASS | PASS |
| 4 section name/grade/program (M4) | PASS | PASS | PASS | PASS |
| 5 specialization/cohort (M5) | PASS | PASS | PASS | PASS |
| 6 policy/special events/display-slot sources (M5) | PASS | PASS | PASS | PASS |
| 7 active-year election + ordered-term cache | PASS (archived year never elected current; frozen contract resolves) | PASS | PASS | PASS |
| 8 ordered-term cache (cleared + archived) | PASS | PASS | PASS | PASS |
| 9 signatory active configuration | PASS | PASS | PASS | PASS |
| 10 faculty-synchronization inputs | PASS | PASS | PASS | PASS |

Plus `G01b` snapshot-consistency rejection and `G02` live-term-unavailable
(frozen path is load-bearing) controls.

## Mutant matrix M1–M10

Each mutant was applied at exactly one site, the suite was run whole
(`npx tsx src/__tests__/published-immutability-c08.test.ts`), the named control
was observed to `[FAIL]`, and the file was restored with
`git checkout -- <path>` followed by `git status --short` (empty) and
`git diff --stat` (empty).

| Mutant | Site (file:line at candidate) | Mutant edit | Failing decisive control (observed) | `[SUMMARY]` | Restore proof |
|---|---|---|---|---|---|
| M1 | `published-schedule.service.ts:628-637` (insert after the frozen/live `references` selection) | live `subject.findMany` override of `references.subjectById` on the frozen path | `[FAIL] G01 M1 subject labels/codes: published payload identity unchanged` | `passed=89 failed=16` | `git checkout -- …/published-schedule.service.ts`; `git status --short` empty |
| M2 | same site | live `facultyMirror.findMany` override of `references.facultyById` | `[FAIL] G01 M2 faculty labels/identities: published payload identity unchanged` | `passed=98 failed=7` | same |
| M3 | same site | live `room.findMany` override of `references.roomById` | `[FAIL] G01 M3 room/building/floor/type: published payload identity unchanged` | `passed=93 failed=12` | same |
| M4 | same site | live `sectionMirror.findMany` override of `references.sectionById`/`sectionNameById` | `[FAIL] G01 M4 section name/grade/program: published payload identity unchanged` | `passed=95 failed=10` | same |
| M5 | `published-schedule.service.ts:594` | `const mappedPublishedSpecialEvents = frozen` → `= false` (always live) | `[FAIL] G01 M5 policy/special events/display-slot sources: published payload identity unchanged` | `passed=102 failed=3` | same |
| M6 | `published-identity-snapshot.service.ts:634` | `terms: contract.terms.map(...)` → `terms: []` | `[FAIL] G01 frozen ordered-term contract has 3 terms` and `[FAIL] G01 archived per-term read resolves through the FROZEN ordered-term contract (error: TERM_INDEX_OUTSIDE_CONTRACT)` | `passed=84 failed=24` | `git checkout -- …/published-identity-snapshot.service.ts`; clean |
| M7 | `routes/published-schedule.router.ts:440` | `schoolYearId: activeSchoolYearId` → `schoolYearId: termId` | `[FAIL] G04 :termId route resolves the term, not a school year (expected 200, got 404)` | `passed=95 failed=10` | `git checkout -- …/published-schedule.router.ts`; clean |
| M8 | `services/generation.service.ts:1622` | restored the pre-C08 destructive branch (`status:'FAILED'` + `buildUnpublishedSummary` clearing `isPublished`/`publishedAt`/`publishedBy`) | `[FAIL] G05 faculty sync never sets the published run to FAILED (expected "COMPLETED", got "FAILED")` | `passed=97 failed=8` | `git checkout -- …/generation.service.ts`; clean |
| M9 | `services/published-schedule.service.ts:368` | `isActiveSchoolYear: isActiveYear` → `false` | `[FAIL] G18 runtime-active year reports isActiveSchoolYear=true (expected true, got false)` | `passed=104 failed=1` | `git checkout -- …/published-schedule.service.ts`; clean |
| M10 | `services/published-schedule.service.ts:853` | `if (snapshot) {` → `if (false) {` (frozen export-term shortcut bypassed) | `[FAIL] G02 archived export term resolves through the FROZEN ordered-term contract (error: TERM_STRUCTURE_UNAVAILABLE)` | `passed=100 failed=5` | `git checkout -- …/published-schedule.service.ts`; clean |

Post-matrix baseline on the restored tree: `[SUMMARY] passed=105 failed=0`.
No mutant failed to fail its control; there is no missing load-bearing control.

## Disposable-database zero-residue proof

- C08 suite `G09`: `disposable database atlas_restore_drill_20260916_c08228c8d dropped and asserted absent`; `zero C08 fixture residue in the configured source database (expected 0, got 0)`.
- Gate-20 concurrency suite: disposable provisioned by a temp-only driver, dropped after the run and asserted absent (`remaining=0`; the first `DROP … WITH (FORCE)` raced and a bounded retry completed it).
- Gate-22 `derived-demand-correction-c01r2`: `tests 7, pass 7, skipped 0`, disposable `dropped=true`.
- Regression-boundary reruns `term-cache-catchup-rrtc01` (1/1) and
  `generation-readiness-disposable-genc02r` (1/1): disposable `dropped=true`.
- Gate-26 built server: disposable `dropped=true`.
- Every database-backed suite ran only against guarded `atlas_restore_drill_*`
  databases; the configured source database was probed read-only and reported
  zero fixture residue.

## Preserved strengths (proven)

Run-wide zero-hard-blocker gate; actor-school authorization; `Serializable`
transaction + `pg_advisory_xact_lock` + run-version CAS; replay idempotency;
exactly one publication audit and one notification; draft/published separation;
revision effective-date overlay; frozen signatory revision; no public
draft/policy/internal-run leakage.

## Remaining risks

`BLOCKING`: none. All 26 mandatory source rows pass.

`NON_BLOCKING` (documented residuals):

1. School name and school-year label are not part of the §3.2 frozen snapshot
   contract and remain live-sourced.
2. Teacher-profile presentation fields (`plantillaPosition`, `designationTitle`,
   degrees, `avatarUrl`) remain live-sourced; the published teacher display name
   and employee id are frozen.
3. Class-program canonical template rows and adviser bindings are frozen as a
   documented extension beyond §3.2 so §4.8 holds for those outputs.
4. `tt-output-c05-beneficiary-parity.test.ts` M22 (`:377`) still uses an id-only
   published-payload stub. It passes because its assertions are structural; the
   fixture should be aligned with the real producer in a successor touch.
5. `publication-contract-postgres-concurrency.test.ts` requires an
   externally-provisioned disposable database and matching
   `PUBC01R_DISPOSABLE_DATABASE`; a first drop can race and needs a bounded retry.

## Claim classification

- `REQUIREMENT`: frozen-first reads/exports; archived term resolution through the
  frozen ordered-term contract; `:termId` is a term identity, never a
  `schoolYearId`; sync never unpublishes; legacy reports
  `LEGACY_LIVE_PROJECTION`; no migration.
- `CURRENT_STATE`: the candidate now passes all 26 §6 gates plus the C08 suite at
  105/0; the gate-20/23 fixture repairs are committed in this candidate.
- `SUCCESSOR`: live-sourced school name/year label (residual 1);
  teacher-profile presentation fields (residual 2); M22 stub alignment
  (residual 4).
- `HISTORICAL`: commits `309640e5` and `18201e4f`; the C07 read-only audit
  artifact cited by the operator does not exist (packet §0) and is not claimed.

## Return

`REVIEW_REQUIRED`.
