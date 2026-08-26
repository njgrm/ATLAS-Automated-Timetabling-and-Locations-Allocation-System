# Copilot Execution Prompt: Phase 3 Published Run Integrity Reconciliation One-Shot

## Objective

Repair the live published-run integrity gap before ATLAS relies on public and faculty published schedule views for objective closure.

Current live truth is inconsistent:

- the public/faculty published schedule APIs return `PUBLISHED_RUN_NOT_FOUND`
- but the DB still contains runs with `summary.isPublished = true` and `publishedAt` set
- those same runs are stored as `status = FAILED`

This pass must reconcile that contradiction and restore one trustworthy published-run contract.

## Out of Scope

Do not:

- redesign the new public schedule page
- redesign the faculty schedule page
- reopen unrelated generation heuristics or teaching-load work
- claim final Objective `1.4` closure in this pass

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/phases/phase-5-publish.md`
- `docs/phases/publish-readiness-implementation-plan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- latest audit note that:
  - live public published endpoints return `404`
  - DB contains published-marked runs with `FAILED` status

Inspect directly:

- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/routes/published-schedule.router.ts`
- any publish-related scripts or diagnostics already present

## Facts To Treat As Settled

- live public endpoints currently return `PUBLISHED_RUN_NOT_FOUND`
- live DB contains at least these published-marked runs:
  - run `18`, `schoolYearId=55`, `status=FAILED`, `isPublished=true`, `publishedAt` set
  - run `14`, `schoolYearId=1`, `status=FAILED`, `isPublished=true`, `publishedAt` set
- the current published schedule service only accepts runs where:
  - `status = COMPLETED`
  - and `summary.isPublished = true`

## Required Product Outcome

By the end of this pass:

1. published-run truth is internally consistent
2. invalid `FAILED + published` run states are reconciled
3. public/faculty published views no longer rely on contradictory DB state
4. the system can truthfully say either:
   - there is a valid published run and here it is
   - or there is no valid published run after reconciliation

## Required Implementation Scope

### A. Diagnose and classify invalid published states

Required:

- inspect how `FAILED` runs became `isPublished=true`
- determine whether these are:
  - legacy drift
  - publish-path bug residue
  - manual data contamination

Preserve diagnostics in the result.

### B. Reconcile invalid published runs

Required:

- define and implement the source-of-truth rule for valid published runs
- repair or quarantine invalid `FAILED + published` states
- do not silently hide the issue without fixing the data contract

Expected direction:

- a run should not be treated as published if it is not valid under the current publish contract

### C. Protect the contract going forward

Required:

- ensure future publish operations cannot leave behind contradictory `FAILED + published` state
- if necessary, harden publish-path state transitions or validation

### D. Verify public/faculty published truth after reconciliation

Required:

- after reconciliation, verify whether:
  - latest published view now resolves correctly
  - or a truthful no-published state remains

Both outcomes are acceptable, but the system must be internally consistent.

## Runtime and Docs Rules

- controllers remain transport-only
- business logic stays in `/services`
- if published truth behavior changes, update:
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `ATLAS-PUBLIC-API.md` if contract wording needs clarification
  - `docs/verification/evidence-log.md`

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- direct DB verification of published-run state before and after
- Tailnet verification required

### Required Tailnet proofs

1. Re-check `GET /api/v1/schools/1/schedules/published`
2. Re-check at least one scoped published endpoint:
   - `/published/sections/:sectionId`
   - `/published/faculty/:facultyId`
3. Report whether the truthful result after reconciliation is:
   - valid published schedule available
   - or no valid published schedule remains

## Required Output

Return:

1. root-cause summary for `FAILED + published` drift
2. files changed
3. reconciliation rule implemented
4. before/after DB truth summary
5. before/after public endpoint behavior
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- published-run truth is internally consistent after the pass
- invalid published flags on failed runs are reconciled
- public/faculty dissemination surfaces now reflect the reconciled truth honestly
