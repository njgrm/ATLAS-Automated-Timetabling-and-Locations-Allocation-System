# Copilot Execution Prompt: Phase 3 KPI Rerun + Root-Cause Gate

Run this after:
- `docs/prompts/phase3-placeholder-faculty-and-coverage-prompt.md`
- `docs/prompts/phase3-section-sync-program-parity-prompt.md`
- `docs/prompts/phase3-subject-sync-program-offerings-prompt.md`
- `docs/prompts/phase3-teaching-load-policy-alignment-prompt.md`
- `docs/prompts/phase3-specialization-mapping-cleanup-prompt.md`

## Goal
Run the first honest KPI gate for Phase 3 after timetable math, control state, room/cohort readiness, and faculty coverage have been repaired.

This prompt is the gate, not the broad implementation phase. If KPIs are still bad, the output must return a precise root-cause breakdown instead of forcing a false `GO`.

## Scope

In scope:
- fresh generation reruns
- KPI measurement
- live Tailnet verification of resulting generation metrics
- blocker classification for any remaining failures

Out of scope:
- major new feature work that should have been completed in the prior prompts

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase3-generator-readiness-sequence.md`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/scripts/validate-run-preferences.ts`

## Live Baseline To Beat
Use run `41` as the minimum baseline:
- `assignedCount = 939`
- `unassignedCount = 2661`
- `hardViolationCount = 731`
- `homeRoomSuccessRate = 19.42%`
- `SPECIALIZED_ROOM_UNAVAILABLE = 1930`
- `policyOrShiftWindowIncompatible = 2133`
- `termCounts = { term1: 939, term2: 0, term3: 0 }`

Also use run `52` as the post-repair comparison baseline where applicable:
- `assignedCount = 1121`
- `unassignedCount = 1451`
- `hardViolationCount = 610`
- `homeRoomSuccessRate = 32.11%`
- `SPECIALIZED_ROOM_UNAVAILABLE = 841`
- `policyOrShiftWindowIncompatible = 1044`
- `termCounts = { term1: 1121, term2: 0, term3: 0 }`

## Mandatory Behavior
- re-run any required upstream-aware refresh or mirror sync controls first if the live state depends on them:
  - `POST /api/v1/sections/sync`
  - `POST /api/v1/subjects/sync-offerings`
- run fresh generation after the prior Phase 3 repairs
- capture exact before/after KPI deltas
- classify remaining blockers by dominant root cause
- do not perform major speculative implementation in this prompt
- return `NO-GO` if the repaired system still fails Phase 3 targets

## Required Direction

### A. Measure the right things
- assigned count
- unassigned count
- hard violations
- home-room success rate
- dominant unassigned reasons
- dominant room-assignment reasons
- term distribution
- generation duration
- special-program section placement completeness where it still affects generation:
  - `homeRoomId`
  - `buildingZoneId`
- latest active special-program subject state after sync

### B. Classify failures honestly
If KPIs still fail, separate the remaining causes into categories such as:
- timetable math still infeasible
- room/specialized facility shortage
- policy/shift incompatibility
- cohort/readiness gap
- faculty/placeholder coverage gap
- tri-sem / term distribution bug
- special-program section placement gap
- special-program subject-model compression gap

Where useful, compare remaining blockers against the Grade 10 monitoring workbook as secondary operational evidence.
- Treat that workbook as a structural reference only.
- Do not treat quarter labels or monitoring-sheet formatting as the target ATLAS output contract.

### C. Only claim GO for the Phase 3 gate if the rerun actually earns it
- do not translate “better than before” into automatic success

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. trigger or verify `POST /api/v1/sections/sync` for `schoolId=1`, `schoolYearId=55`
2. trigger or verify `POST /api/v1/subjects/sync-offerings` for `schoolId=1`, `schoolYearId=55`
3. inspect `GET /api/v1/sections/summary/55?schoolId=1` for special-program parity and placement completeness
4. trigger or verify fresh generation run(s)
5. inspect latest run summary
6. inspect latest timetable/draft route as needed
7. compare directly against run `41`
8. compare directly against run `52`

## Verification Gates
- upstream/mirror refresh state confirmed before rerun
- fresh generation run completed
- exact KPI delta captured
- exact live endpoint evidence captured
- final blocker classification captured if `NO-GO`

## Evidence Update
Append evidence that records:
- exact runs used
- exact commands run
- exact live endpoints checked
- whether section sync and subject sync were rerun before the KPI pass
- special-program placement completeness findings for mirrored sections
- exact KPI before/after values
- final `GO` or `NO-GO`
- remaining blocker list if `NO-GO`

## GO / NO-GO
Return `GO` only if the fresh rerun demonstrates materially recovered generator behavior and no critical Phase 3 blocker remains open.

Return `NO-GO` if the KPIs still fail or if the root cause is still not isolated cleanly.
