# DEMAND-C01 Executor Handoff — Canonical Derived Demand Authority

- Stream: `DEMAND-C01`
- Worktree: `D:\ATLAS-worktrees\derived-demand-c01`
- Branch: `work/derived-demand-c01`
- Base SHA: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (`origin/main`)
- Candidate SHA: this commit (resolve with `git -C D:\ATLAS-worktrees\derived-demand-c01 log -1 --format=%H`)
- Status: `REVIEW_REQUIRED` (never `GO`)
- Risk tier: `MEDIUM` (source wiring; no schema/live mutation)
- QA bundle: `EXTERNAL_QA_BUNDLE` enabled — QA may branch `review/derived-demand-c01-<candidate-short>` and commit exactly `docs/reviews/derived-demand-c01/qa-bundle.md`.

## Objective delivered

One deterministic, read-only derived-demand contract is now the sole current-year
demand authority, and the three named consumers use it:

1. `derived-demand.service.ts` derives demand from the sole active non-archived
   EnrollPro year + verified ordered term structure, active section mirrors, and
   ATLAS Subject scheduling metadata (`schedulingDisposition`, grade/program
   scope, rotation family + order, `minMinutesPerWeek`). It emits
   `school/year/term/subject/section` timetable identities and unique
   `school/year/subject/section` Teaching Load pairs, one SHA-256 semantic
   revision, and typed blockers.
2. `teaching-load-reconciliation.service.ts` builds its demand graph and source
   revision from the derived contract (`derivedDemandRevision`).
3. `timetable-demand.service.ts` builds insertion lines from the derived
   contract (`derivedDemandRevision`, `derivedDemandBlockers`).
4. `generation.service.ts` passes the derived contract to the scheduler as
   `demandOverride`; `runHybridScheduler` uses `input.demandOverride ?? computeDemand(...)`,
   so the current-year path no longer calls legacy `computeDemand()`. The run
   summary records `derivedDemandRevision`.

Current-year reads no longer select `SchoolYearOffering`,
`OfferingTermAssignment`, or `SchoolYearTermConfig` as authority.

## Exact changed paths

- `atlas-server/src/services/derived-demand.service.ts` (new)
- `atlas-server/src/services/timetable-demand.service.ts`
- `atlas-server/src/services/teaching-load-reconciliation.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/hybrid-scheduler.ts`
- `atlas-server/src/__tests__/derived-demand-authority.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `CHANGELOG.md`
- `docs/handoffs/derived-demand-c01-executor.md`

## Parallel collision boundary — observed

No edits to `teaching-load-automation.service.ts`,
`teaching-load-suggestion-proposal.service.ts`, Teaching Load suggestion/apply
tests or UI, Dashboard files, `atlas-migrate.ts` / migration-guard tests,
Curriculum Requirements / Decision Workspace client UI, schema, or migrations.
No `PLANNER_DECISION_REQUIRED` collision occurred.

## Decisive checks (all run in this worktree)

| Check | Command | Result |
|---|---|---|
| Derived authority (hermetic, 10 proofs) | `npx tsx src/__tests__/derived-demand-authority.test.ts` | 10 pass / 0 fail |
| Teaching Load reconciliation (hermetic + disposable-PG fixture, zero residue) | `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` | 168 passed / 0 failed; fixture cleanup zero residue |
| TT-C02 insertion/demand | `npx tsx src/__tests__/timetable-ttc02-insertion.test.ts` | pass / fail 0 |
| Term-Subject authority | `npx tsx src/__tests__/term-subject-authority.test.ts` | pass / fail 0 |
| TERM-CONSUME-C02 | `npx tsx src/__tests__/term-contract-atlas-consumption-c02.test.ts` | pass / fail 0 |
| Timetable candidate domain | `npx tsx src/__tests__/timetable-candidate-domain.test.ts` | pass / fail 0 |
| Generation passive Teaching Load | `npx tsx src/__tests__/generation-passive-teaching-load.test.ts` | PASS |
| Server typecheck | `npx tsc --noEmit` | exit 0 |
| Server production build | `npm run build` (`tsc` → `dist`) | exit 0 |
| Built-server health + route mount (isolated port, rollover disabled) | `PORT=5099 ROLLOVER_AUTO_SYNC_ENABLED=false node dist/server.js`; `GET /api/v1/health`; `GET /api/v1/generation/1/8/unassigned-workflow/summary` | health `200 {"status":"ok","service":"atlas"}`; route `401` (mounted, not 404); server alive after requests |
| Whitespace | `git diff --check` | exit 0 |

## Exact derived totals

- Disposable fixture (TL reconciliation Part B fixture school/year): derived
  demand = 4 unique Teaching Load pairs (`MATH`/`ENG` × sections 101/102),
  expanded to 12 timetable lines (`4 × 3` ordered terms). Fixture is created and
  removed with a proven zero-residue assertion.
- Read-only live preview (school `1`, active year `9` / `2030-2031`,
  `TRIMESTER`, terms `T1`,`T2`,`T3`): revision
  `0C1137084B5A95A348DC3CB130C5F8C7742546BB9ABD207C7E6AFD5F83F82624`,
  `totalPairs = 265`, `totalLines = 555`, `totalsByTerm = { T1: 925, T2: 925, T3: 925 }`.
  The probe performed zero writes; no live row was created, updated, or deleted.

## Evidence mapping (prompt items 1–10)

1. All-term coverage + stable ordering — `derived-demand-authority.test.ts` test 1.
2. Science/TLE rotation ordering — test 2.
3. Reference-only/HG zero demand — test 3.
4. Exact grade/program scope + inactive exclusion — test 4.
5. Missing term structure + malformed/incomplete rotation fail closed — test 5.
6. Same-count semantic edits change revision; read-order permutations do not — test 6.
7. Offering rows cannot change the derived result; offering-reading mutant diverges — test 7.
8. All three consumers agree on revision and line/pair totals — test 8 (plus production projections).
9. Generation assembly receives the override; `computeDemand()` not consulted — test 9.
10. Zero-write passive reads with write-recorder positive control — test 10
    (plus TL reconciliation Part B preview zero-write on a disposable PG fixture).

## Remaining risks

- `NON_BLOCKING`: `pre-generation-draft.service.ts` still calls legacy
  `computeDemand()`. It is outside the prompt's named consumer list and belongs
  to the successor generation-readiness (`GEN-C02`) stream.
- `NON_BLOCKING`: the scheduler's term lane model is `1|2|3`; a `QUARTERS`
  rotation with `modularOrder > 3` is not representable in the scheduler's
  modular lane. Pre-existing scheduler limitation, not introduced here.
- `NON_BLOCKING`: TERM-CONSUME-C02 cache validation is JSON stringify
  order-sensitive over a JSONB column. The disposable-PG fixture computes a
  jsonb-stable semantic revision. The cache mechanism itself is unchanged by
  this stream.
- `NON_BLOCKING`: `timetable-demand` lines synthesize `offeringId = 0`,
  `offeringVersion = 0`, and `classification = 'CORE'`; the insertion consumer
  does not read these fields (verified by call-site inspection).
- `BLOCKING`: none identified for source acceptance.

## Not performed (per prompt)

No merge/rebase/amend/force-push, no Teaching Load reconciliation, no generation,
no publication, no deployment, no port 5001 restart, and no live-data mutation.
`git diff --check` is clean on the committed range.

# DEMAND-C01R — Derived Demand Authority Closure (correction commits)

- Correction base: `eae274bf457946894e9ba63c4b601861e8abff03`
- Original base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6`
- New candidate SHA: this commit (resolve with `git -C D:\ATLAS-worktrees\derived-demand-c01 log -1 --format=%H`)
- Review range: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...<new-candidate>`
- Status: `REVIEW_REQUIRED` (never `GO`)

## Corrections delivered

1. **Per-scope rotation completeness** — `validateRotationMetadata(subjects, termCount, activeScopes)` validates every active normalized grade/program scope independently; a family present in a scope must cover every ordered term `1..termCount` (`ROTATION_INCOMPLETE`); equal orders in disjoint scopes are not collisions; a globally complete family cannot hide a scoped gap.
2. **Ordered-term preservation** — the scheduler term model is widened to term indices `1..4` (`TRIMESTER`/`QUARTERS`); the `modularOrder > 2 → 3` collapse is removed. A verified fourth term reaches the constructor as term 4.
3. **Complete semantic revision** — `DERIVED_DEMAND_V2` binds ordered terms, sections, Subject scheduling semantics, `periodLengthMinutes`, `preferredRoomType`, and `requiredFeatures`.
4. **Transaction-consistent term authority** — `buildDerivedDemand` reads `EnrollProSchoolYearMirror.termContractCache` exclusively through the supplied data-context client (no global Prisma, no live EnrollPro network call); a canonical revision is recomputed because JSONB reorders keys. Live-vs-persisted divergence requires the explicit rollover/sync action.
5. **Generation/publication freshness** — a `derivedDemand` freshness domain binds the canonical revision; legacy `SchoolYearTermConfig`/`SchoolYearOffering`/`OfferingTermAssignment` are removed from current-year authority; publication revalidates derived authority inside its Serializable transaction and supports `QUARTERS`.
6. **Timetable fail-closed** — summary/preview expose `derivedDemandRevision` and propagate typed `DERIVED_DEMAND_BLOCKED`; `toSchedulerDemandOverride` fails closed with a typed drift blocker on missing section/Subject projection data and asserts exact projection parity.

## Ten controls (RED→GREEN)

`atlas-server/src/__tests__/derived-demand-correction-c01r.test.ts` — 10/10:

1. family missing position 2 → `ROTATION_INCOMPLETE`
2. disjoint-scope order reuse allowed; scoped gap/duplicate fails
3. four-term family reaches the constructor with term 4 preserved
4. `periodLengthMinutes` changes revision + session count; read-order stable
5. room semantics change the derived revision and the freshness domain
6. trap client governs every persisted term read; zero network
7. legacy transition rows never stale; ordered terms do
8. Timetable summary returns the canonical revision and a typed blocker
9. projection fails closed on missing section/Subject; exact parity enforced
10. one canonical revision flows through snapshot, Timetable, TL preview, and authority service

Plus `teaching-load-reconciliation.test.ts` binds `preview.derivedDemandRevision` to the authority revision through the real TL preview entry point (disposable PG fixture, zero residue).

## Focused gate results

- `derived-demand-authority.test.ts` 10/0; `derived-demand-correction-c01r.test.ts` 10/0
- `teaching-load-reconciliation.test.ts` 170/0 zero residue
- TT-C02, term-subject-authority, term-contract C02, timetable-candidate-domain all `fail 0`
- generation-passive Teaching Load `PASS`; publication-contract-readiness exit 0
- `tsc --noEmit` 0; `npm run build` 0; built-server health 200 / route 401 mounted / alive; `git diff --check` 0

## Live read-only evidence

- School 1, active year 9 (`2030-2031`): `buildDerivedDemand` → `ok:false`, blocker `TERM_STRUCTURE_UNAVAILABLE` (no persisted verified term snapshot exists); `buildCanonicalTimetableDemand` → `derivedDemandRevision:null`, blocker `TERM_STRUCTURE_UNAVAILABLE`, `totalLines:0`. This is the intended fail-closed behavior pending the explicit rollover/sync action; zero writes were performed.

## Remaining risks

- `NON_BLOCKING`: `pre-generation-draft.service.ts` still uses legacy `computeDemand()` (successor `GEN-C02`).
- `NON_BLOCKING`: upstream `enrollpro-term-contract.service.ts` cache validation remains JSONB order-sensitive; this stream consumes the persisted structure with a canonical revision rather than editing that TERM-CONSUME-C02 file.
- `BLOCKING`: none identified for source acceptance.

## Not performed

No Teaching Load reconciliation, generation, publication, deployment, port 5001 restart, schema/migration change, companion-system edit, amend, rebase, merge, or push. Live active-year derived reads are read-only and fail closed.

# DEMAND-C01R2 � Ordered-Term Consumer Closure (correction commits)

- Correction base: `422460fa98d6d2e686d134b996a029cf1c0b939b`
- Original base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6`
- Review range: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...<new-candidate>`
- Status: `REVIEW_REQUIRED` (never `GO`)
- Risk tier: `MEDIUM` (source; no schema/live mutation)

## Corrections delivered

1. **One ordered-term model** � `atlas-server/src/services/academic-term.service.ts` centralizes syntactic parse (`1..4`), exact-contract semantic validation, `loadVerifiedOrderedTermContract`, and `resolveRequestedTermIndex` (explicit numeric reads work while active is unavailable; `active` fails closed with `TERM_FILTER_NOT_READY`). No clamp/cycle/default/relabel/drop.
2. **Generation/review reads** � `getLatestRunViolations`/`getRunViolations` validate the requested term against the verified contract; summary/class-program exports resolve `active` through the persisted verified authority; workbook export no longer calls the live active-term adapter.
3. **Publication/revision authority** � initial publication validates every run entry against the verified contract term count (`PUBLICATION_TERM_INDEX_OUTSIDE_CONTRACT`, zero writes); published revisions load the contract from the supplied transaction client and reject out-of-contract source/previous/next terms (`REVISION_TERM_INDEX_OUTSIDE_CONTRACT` / `REVISION_ENTRY_TERM_OUTSIDE_CONTRACT`, zero writes).
4. **Public/privileged published reads** � expose Q4 and resolve `active` from the persisted verified contract.
5. **Timetable client** � exact ordered labels projected through `runtime/context` (`orderedTerms`/`termFormat`/`termCount`); bounded numeric term type, Q4 toolbar/state/pivots, exact-label rendering with `T1`/`T2`/... fallback, and repair-to-`all` on school/year/contract change.
6. **Honest snapshot version** � generation input snapshot `schemaVersion: 2` with required domains; schema-v1 ? `UNKNOWN`/`SNAPSHOT_VERSION_MISMATCH`, never fresh.

## RED-to-GREEN evidence

- `atlas-server/src/__tests__/derived-demand-correction-c01r2.test.ts` � 7/7 (controls 1�10; 4/5/6 on a disposable quarterly PostgreSQL fixture with zero residue).
- `atlas-client/src/lib/__tests__/academic-term.test.ts` � 4/4 (control 7a�7d).
- Regression: derived-demand authority/C01R, term-subject authority, term-contract C02, cache instrumentation 32/0, timetable candidate/insertion, passive Teaching Load, publication readiness, Teaching Load reconciliation 170/0; server+client `tsc`/build; built-server health 200 / term-filtered route 401 mounted / alive; `git diff --check` 0.

## Remaining risks

- `NON_BLOCKING`: `publication-contract-postgres-concurrency.test.ts` needs an explicitly disposable database not provisioned here; its fixture was updated to a persisted quarterly contract cache and v2 snapshot, and its target guard was not weakened, but the suite was not run in this environment.
- `NON_BLOCKING`: `pre-generation-draft.service.ts` still uses legacy `computeDemand()` (successor `GEN-C02`).

## Not performed

No Teaching Load reconciliation, generation, publication, revision, deployment, port 5001 restart, schema/migration change, companion-system edit, amend, rebase, merge, or push. No live-data mutation; the disposable PostgreSQL fixture rows were fully removed with a zero-residue assertion.
