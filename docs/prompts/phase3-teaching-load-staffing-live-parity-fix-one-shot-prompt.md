# Copilot Execution Prompt: Phase 3 Teaching Load Staffing Live-Parity Fix One-Shot

## Objective

Close the specific live gaps left by `phase3-teaching-load-staffing-reconciliation-one-shot-prompt.md`.

This is a narrow parity pass, not a broad redistribution pass.

The live Tailnet state now proves three remaining misses:

1. `STE_ROBOTICS` still does not support multi-department baseline qualification (`SCI` + `TLE`)
2. staffing-needs reporting still does not match live coverage truth for subjects like `SCI_ES`
3. `Teaching Load` still has identity/copy drift in the left rail and selected-teacher header

This pass must fix those live mismatches and prove them on Tailnet before returning.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-staffing-blocker-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-discrepancy-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/routes/subject.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- any subject DTO / type files carrying `allowedOwnerDepartments`

## Live Facts To Treat As Settled

- Umbrella `TLE` is already gone from the live subject catalog.
- Active live TLE rows are only:
  - `TLE_AFA_EXP`
  - `TLE_ICT_EXP`
  - `TLE_FCS_EXP`
- Live coverage still shows:
  - `SCI_ES = 0 / 82`
  - `SCI_CHEM = 47 / 82`
  - `TLE_FCS_EXP = 4 / 58`
  - `FIL = 60 / 82`
  - `STE_ROBOTICS = 0 / 2`
  - `HG = 82 / 82`
- Live `STE_ROBOTICS` currently still returns:
  - `ownerDepartment = SCI`
  - `allowedOwnerDepartments = ["SCI"]`
- Live staffing-needs report currently surfaces only Robotics and still omits `SCI_ES`.
- `Teaching Load` still exposes employee ID too prominently and still has mojibake in the selected-teacher header.

## Scope

### In Scope

#### A. Robotics multi-department baseline fix

Required:

- make `STE_ROBOTICS` baseline-qualified for both `SCI` and `TLE`
- ensure the live subject payload reflects that
- ensure all relevant qualification helpers treat either department as baseline-qualified:
  - `Teaching Load`
  - auto-fill
  - staffing-needs report
  - recovery / redistribution
  - schedule-constructor fallback qualification checks

#### B. Staffing-needs live parity fix

Required:

- make staffing-needs reporting align with live uncovered coverage truth, not just a narrowed primary-shortage bucket
- if `SCI_ES` remains `0 / 82`, it must appear in the staffing-needs output
- if `SCI_CHEM`, `TLE_FCS_EXP`, or `FIL` still remain uncovered, they must not be silently hidden
- keep the improved real-minute arithmetic
- if the UI still wants one primary headline, add a separate explicit list of all uncovered live blocker subjects so the report cannot look contradictory

#### C. Teacher identity and copy cleanup

Required:

- in `Teaching Load` left rail:
  - prioritize specialization as the secondary identity
  - demote or remove employee ID from the visible row content
- in selected-teacher header:
  - remove mojibake
  - keep specialization and department readable
  - do not foreground employee ID over scheduler-relevant identity
- in staffing modal copy:
  - do not phrase the model as specialization-gated if department-set baseline is now the active rule

#### D. Tailnet verification discipline

Required:

- do not stop at build success
- do not return `GO` unless the changed live Tailnet behavior is explicitly re-probed after implementation
- include the exact live endpoint probes and the key returned facts

### Out Of Scope

Do not:

- reopen umbrella `TLE`
- attempt a full new staffing redistribution wave
- redesign unrelated pages
- claim broader staffing closure for `SCI_ES`, `SCI_CHEM`, `TLE_FCS_EXP`, or `FIL` unless the live data really changes

## Required Tailnet Tests

You must run and report all of these after implementation:

1. `GET /api/v1/subjects?schoolId=1`
   - prove `STE_ROBOTICS.allowedOwnerDepartments` includes `TLE`
   - prove umbrella `TLE` is still absent

2. `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
   - capture current uncovered truth for:
     - `SCI_ES`
     - `SCI_CHEM`
     - `TLE_FCS_EXP`
     - `FIL`
     - `STE_ROBOTICS`

3. `POST /api/v1/faculty-assignments/report/staffing-needs`
   - prove the report includes `SCI_ES` if it remains uncovered
   - prove Robotics is no longer treated as SCI-only if the contract changed
   - prove shortage math is still based on real subject minutes

4. One `Teaching Load` UI or API-level verification showing the revised teacher identity output
   - specialization visible
   - no mojibake in selected-teacher header
   - no unnecessary employee-ID emphasis

If any one of these is not tested live, return `NO-GO`.

## Required Output

Return:

1. files changed
2. Robotics ownership-baseline fix
3. staffing-needs report parity fix
4. teacher identity and copy cleanup
5. exact Tailnet tests run
6. key live results from each test
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if all are true:

- live `STE_ROBOTICS.allowedOwnerDepartments` includes `TLE`
- umbrella `TLE` remains absent
- staffing-needs output no longer contradicts live uncovered coverage for `SCI_ES`
- the staffing report still uses real-minute math
- the `Teaching Load` identity/copy cleanup is visible in live behavior
- all required Tailnet tests were actually run after the code changes
