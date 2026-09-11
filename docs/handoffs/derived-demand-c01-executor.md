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
