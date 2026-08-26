# Copilot Execution Prompt: Phase 3 Teaching Load Staffing Truth And Auto-Fill Fix One-Shot

## Objective

Fix the remaining `Teaching Load` staffing-truth and automation blockers without doing a UX redesign.

This pass is for backend truth, staffing guidance, and live automation reliability only.

The page currently has two serious non-UX blockers:

1. `POST /api/v1/faculty-assignments/auto-fill` still fails live with a transaction-abort path.
2. `report/staffing-needs` still overstates recoverability by showing spare capacity from departments that may not actually be qualified or policy-allowed to absorb the shortage.

Do not do a broad frontend redesign in this pass.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- any shared types used by:
  - `coverageTotals`
  - `staffingReport`
  - `Auto-Fill`

## Live Facts To Treat As Settled

- `Teaching Load` summary currently reports:
  - `assignedPairs=726`
  - `rawAssignedPairs=960`
  - `unassignedPairs=236`
  - `rawUnassignedPairs=2`
- live uncovered rows currently include:
  - `SCI_ES = 82`
  - `STE_ROBOTICS = 2`
  - `TLE_FCS_EXP = 54`
  - `SCI_CHEM = 35`
  - `ENG = 23`
  - `FIL = 22`
  - `MATH = 12`
  - `AP = 6`
- live staffing-needs currently reports:
  - raw completeness:
    - `236` rows
    - `53100` minutes
    - `885` hours
  - concurrent weekly shortage:
    - `201` rows
    - `45225` minutes
    - `753.8` hours
    - `25.1` hires
- this raw-vs-concurrent split is directionally correct and must be preserved
- `POST /api/v1/faculty-assignments/auto-fill` still fails live with:
  - `500 SERVER_ERROR`
  - Prisma transaction path at `teaching-load-automation.service.ts:701`
  - Postgres `25P02 current transaction is aborted`

## Scope

### In Scope

#### A. Fix live Auto-Fill

Required:

- make `POST /api/v1/faculty-assignments/auto-fill` work live again
- fix the transaction-abort pattern around `tx.subjectSectionOwnership.create(...)`
- do not rely on catch-and-continue behavior inside a poisoned Postgres transaction
- use a safe persistence strategy so duplicate ownership conflicts do not abort the rest of the run
- preserve the invariant that Auto-Fill must not overwrite an existing ownership row

#### B. Make staffing-needs operationally truthful

Required:

- preserve the current raw-vs-concurrent shortage split
- keep current rotation-family shortage adjustment behavior unless you discover a concrete live defect
- fix `internalCrossTrainees` so it only reports departments that are actually plausible recovery candidates
- do not count spare capacity from unrelated departments as meaningful recovery guidance
- the recovery guidance must respect current qualification/ownership rules, including multi-owner cases like `STE_ROBOTICS`

#### C. Stop collapsing the shortage into one misleading primary department

Required:

- do not pretend the current live shortage is only a `SCIENCE` problem when the uncovered mix spans multiple departments
- if a top-level department field remains, it must be clearly framed as the dominant bucket, not the whole shortage
- the report contract must stay understandable for the UI layer

#### D. Improve recoverability classification

Required:

- clearly distinguish:
  - uncovered rows
  - concurrently missing weekly hours
  - recoverable with currently qualified active teachers
  - not recoverable under current qualification/ownership constraints
- if the current staffing report contract cannot express this cleanly, extend it minimally and consistently

#### E. Keep current subject and rotation gains

Required:

- do not recreate umbrella `TLE`
- do not regress `STE_ROBOTICS` multi-department ownership support
- do not reintroduce placeholder masking
- do not break the current teacher-side rotation-family load math

### Out Of Scope

Do not:

- do a broad `Teaching Load` visual redesign
- change `Subjects` or `Teachers` page layout
- reopen department-baseline subject-contract work beyond preserving current gains
- claim full page closure from this pass alone

## Required Tailnet Verification

You must run and report all of these after implementation:

1. `POST /api/v1/faculty-assignments/auto-fill`
   - prove it no longer returns `500`
   - report whether it created assignments, preserved assignments, or left unresolved rows

2. `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
   - capture current uncovered rows for:
     - `SCI_ES`
     - `STE_ROBOTICS`
     - `TLE_FCS_EXP`
     - `SCI_CHEM`
     - `ENG`
     - `FIL`
     - `MATH`
     - `AP`

3. `POST /api/v1/faculty-assignments/report/staffing-needs`
   - show:
     - raw uncovered rows
     - concurrent shortage
     - recoverable guidance
   - prove the cross-department recovery guidance is qualification-aware and not just generic spare-capacity math

4. `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
   - verify summary still aligns with the current active truth model after the fix

If any required Tailnet test is missing, return `NO-GO`.

## Required Output

Return:

1. files changed
2. Auto-Fill root-cause fix
3. staffing report truth-model changes
4. qualification-aware recovery guidance changes
5. exact Tailnet tests run
6. live results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if all are true:

- `POST /faculty-assignments/auto-fill` works live
- raw-vs-concurrent shortage split is preserved
- staffing guidance no longer implies unrelated spare capacity is a valid recovery path
- multi-department cases like `STE_ROBOTICS` still respect the corrected ownership model
- no current rotation-family truth is regressed
- all required Tailnet tests were actually run after the change
