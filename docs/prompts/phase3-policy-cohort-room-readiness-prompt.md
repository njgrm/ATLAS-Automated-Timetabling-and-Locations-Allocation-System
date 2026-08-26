# Copilot Execution Prompt: Phase 3 Policy + Cohort + Room Readiness Repair

Run this after:
- `docs/prompts/phase3-template-capacity-and-controls-prompt.md`

## Goal
Repair the persisted control state and room/cohort readiness gaps that still make live generation behave as if core scheduling infrastructure is missing.

This prompt exists because the live DB scan showed:
- no persisted `SchedulingPolicy` row for `schoolYearId=55`
- no active `InstructionalCohort` rows
- no persisted TLE ownership fields in `SectionMirror`
- all rooms still have `isSharedFacility = false`

## Scope

In scope:
- active-school-year scheduling policy bootstrap
- grade/program shift-window persistence alignment
- cohort readiness and TLE ownership readiness
- room shared-facility readiness where needed for generation realism
- live Tailnet verification of the repaired data/control state

Out of scope:
- Teacher X workflow UI
- final KPI closure claim

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/verification/evidence-log.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/cohort.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`

## Live Facts To Treat As Fact
- persisted `SchedulingPolicy` row for `schoolYearId=55`: missing
- active `InstructionalCohort` rows: `0`
- `SectionMirror` persisted rows do not yet store TLE ownership fields
- `SectionSnapshot` currently exposes no populated TLE specialization ownership fields
- rooms flagged `isSharedFacility=true`: `0`
- latest run has `SPECIALIZED_ROOM_UNAVAILABLE = 1930`

## Persisted-State Integrity Rule
This prompt is about **persisted readiness**, not only runtime fallback behavior.

If an API route returns a valid policy or readiness response by synthesizing defaults in service code, that does **not** satisfy this prompt by itself.

For `GO`, you must prove the repaired state exists in the database where the prompt expects persistence:
- `SchedulingPolicy` row exists for `schoolId=1`, `schoolYearId=55`
- `GradeShiftWindow` rows are persisted for the active school year
- `InstructionalCohort` rows are persisted if they are expected for the current dataset
- room shared-facility flags are persisted where required by the active contract

If the runtime looks healthy but the state is still synthetic or non-persisted, return `NO-GO`.

## Mandatory Behavior
- audit persisted control/readiness state first
- repair only the missing or incoherent pieces needed for realistic generation
- if upstream TLE ownership is absent, distinguish between:
  - missing upstream data
  - missing persistence/mapping in ATLAS
- verify the result live before claiming success

## Control Adjustment Allowance
You are explicitly allowed to:
- bootstrap a default `SchedulingPolicy` row for the active school year
- persist grade/program shift-window defaults needed by the repaired math
- adjust room-readiness flags such as `isSharedFacility` when they are part of the intended contract

## Required Direction

### A. Bootstrap scheduling policy for the active school year
- ensure `schoolId=1`, `schoolYearId=55` has a persisted policy row
- make the resulting defaults coherent with the active grade/program window model
- prove the row exists in the database, not just through an API fallback response

### B. Repair cohort and TLE readiness
- determine whether `InstructionalCohort` rows should already exist for the live dataset
- if they should, create or sync them
- if they should not yet exist because upstream detail is absent, prove that explicitly and keep the generator from pretending otherwise

### C. Repair room readiness data
- if shared-facility protection is part of the active contract, make the data reflect that
- ensure specialized-room pressure is not being worsened by missing room metadata

### D. Keep the control model coherent
- policy row, shift windows, room flags, and cohort readiness must agree with the timetable shape repaired in Prompt 1

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. verify persisted policy existence through the relevant policy surface or API
2. verify shift-window state for the active school year
3. verify room/shared-facility effects through runtime/API evidence
4. verify whether cohort/TLE readiness is now real, absent by design, or still broken

## Persistence Verification Requirement
In addition to live API/Tailnet checks, verify the persisted data directly from the local DB-connected runtime for:
- `SchedulingPolicy`
- `GradeShiftWindow`
- `InstructionalCohort`
- any new `SectionMirror` persistence fields added in this pass
- room `isSharedFacility` flags if touched

Do not treat a successful API response alone as proof of persistence.

## Verification Gates
- touched build/typecheck
- diagnostics on touched files
- explicit before/after persisted-state summary for policy, windows, rooms, and cohorts
- live Tailnet verification of the repaired state
- direct DB-connected verification that the intended persisted rows now exist

## Evidence Update
Append evidence that records:
- exact missing state found
- exact repairs made
- exact files changed
- exact commands run
- exact live checks performed
- whether upstream data was truly absent or merely not persisted
- final `GO` or `NO-GO`

## GO / NO-GO
Return `GO` only if the active school year now has a coherent persisted control/readiness state for policy, windows, and the relevant room/cohort metadata.

Return `NO-GO` if generation still relies on obviously missing persisted control state or if upstream/readiness ambiguity remains unresolved.
