# Phase 3 Generator Readiness Sequence

Use this sequence for the newly reframed Phase 3 stream:
- Teacher X placeholders
- generator-readiness repairs
- KPI recovery with the real school-year dataset

## 2026-05-21 Reset

The old cohort/TLE split prompt chain is now superseded for one major reason:
- MATATAG direction now says Grade 9 and 10 TLE rotate by term like the lower grades
- EnrollPro has already removed TLE split metadata from the active section feed

So any prompt that still optimizes TLE cohort fallback is solving a stale contract.

## Why this sequence exists
The live DB scan on `2026-05-17` showed the main KPI blockers are not only faculty shortage.

The real dependency order is:
1. timetable math must fit actual template capacity
2. policy / shift / room-readiness data must exist and be coherent
3. TLE must be reset from stale cohort logic to section-scoped term rotation
4. Teacher X and subject-coverage gaps can then be repaired on top of a feasible schedule shape
5. only then should KPI rerun and closure gating happen

## Key Live Facts To Treat As Fact
- `REGULAR` template is overloaded by `1020` minutes/week
- `STE` template is overloaded by `330` minutes/week
- no persisted `SchedulingPolicy` row exists for `schoolYearId=55`
- no active `InstructionalCohort` rows exist for `schoolYearId=55`
- `0` placeholder faculty rows currently exist
- `11` active subjects currently have zero faculty assignments
- latest live run `41` has:
  - `assignedCount = 939`
  - `unassignedCount = 2661`
  - `hardViolationCount = 731`
  - `homeRoomSuccessRate = 19.42%`
  - `SPECIALIZED_ROOM_UNAVAILABLE = 1930`
  - `policyOrShiftWindowIncompatible = 2133`
  - `termCounts = { term1: 939, term2: 0, term3: 0 }`

## Completed Prompt Gates
- `phase3-template-capacity-and-controls-prompt.md`: `GO`
- `phase3-policy-persistence-fix-prompt.md`: `GO`
- `phase3-policy-cohort-room-readiness-prompt.md`: `GO`
- `phase3-section-sync-program-parity-prompt.md`: `GO`
- `phase3-subject-sync-program-offerings-prompt.md`: `GO`
- `phase3-teaching-load-policy-alignment-prompt.md`: `GO`
- `phase3-specialization-mapping-cleanup-prompt.md`: `GO`
- `phase3-schoolwide-day-shape-alignment-prompt.md`: `GO`
- `phase3-special-program-placement-contract-prompt.md`: `GO`
- `phase3-placeholder-faculty-and-coverage-prompt.md`: `GO`

## Superseded Historical Chain
- `phase3-cohort-packing-and-kpi-one-shot-prompt.md`
- `phase3-faculty-feasibility-and-final-contraction-one-shot-prompt.md`
- `phase3-slot-fit-fallback-and-preclosure-one-shot-prompt.md`

These remain useful as historical evidence, but their TLE-cohort assumptions are now stale after the `2026-05-21` reset.

## Remaining Recommended Run Order
1. `execute @file:phase3-subject-qualification-reset-one-shot-prompt.md`
2. `execute @file:phase3-shell-process-ia-one-shot-prompt.md`
3. `execute @file:phase3-post-qualification-reset-generation-gate-one-shot-prompt.md`

## Rule
Do not jump straight to KPI reruns before the qualification contract and scheduler shell reflect the real workflow.

If the qualification reset prompt fails, fix that contract first instead of trying to tune generator outputs around stale specialization-based qualification logic.

## Control Adjustment Allowance
Phase 3 is explicitly allowed to adjust controls when needed to make the timetable feasible, including:
- template `periodsPerDay`
- template `periodLengthMinutes`
- subject `minMinutesPerWeek`
- persisted scheduling policy defaults for the active school year
- grade/program shift-window configuration
- protected schedule blocks such as reading/intervention windows where evidence requires them

These changes must be evidence-driven and logged, not guessed.
