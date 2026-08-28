# Copilot Execution Prompt: Phase 3 Generation Feasibility + Term Distribution One-Shot

## Goal
Repair the remaining deep generation-contract drift after placement persistence and output normalization are already closed.

This prompt targets the remaining `NO-GO` cluster:
- post-room-demand template and scheduling-contract infeasibility
- high policy-block pressure
- cohorts persisted but not consumed
- thin faculty feasibility and worsening travel pressure
- tri-sem term distribution collapse

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-post-one-shot-drift-assessment-2026-05-19.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `docs/prompts/phase3-room-demand-contract-and-master-schedule-one-shot-prompt.md`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/scripts/validate-run-preferences.ts`
- any cohort or term-distribution logic used in generation

## Run This After
- `phase3-room-demand-contract-and-master-schedule-one-shot-prompt.md`

## Known Facts To Treat As Fact
- placement persistence is already `GO`
- stakeholder-facing label normalization is already `GO`
- room-demand reset is already `GO` for prompt scope
- the latest one-shot rerun still ended overall `NO-GO`
- run `55` showed:
  - `UNASSIGNED_SECTION=606`
  - `SPECIALIZED_ROOM_UNAVAILABLE=864`
  - `LACKING_FACULTY=68`
  - `FACULTY_EXCESSIVE_IDLE_GAP=334`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=785`
  - `policyBlockedCount=1245`
  - `cohortCount=4`, `cohortizedClassCount=0`
  - `term1=1990`, `term2=0`, `term3=0`
- run `56` after the room-demand reset showed:
  - `SPECIALIZED_ROOM_UNAVAILABLE=190`
  - `UNASSIGNED_SECTION=1004`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=863`
  - `homeRoomSuccessRate=51.63`
  - `assignedCount=2266`
  - `hardViolationCount=1004`
- this means specialized-room scarcity is no longer the leading blocker class
- the next pass must explain why classroom-default rooming improved home-room success but worsened hard unresolved and travel pressure

## Scope
In scope:
- template-capacity and schedule-shape feasibility after the room-demand reset
- policy-block pressure
- cohort consumption
- faculty feasibility depth where it affects generation, especially travel and unresolved demand after classroom-default rooming
- tri-sem / term distribution runtime behavior
- fresh Tailnet rerun and exact delta capture

Out of scope:
- stakeholder-facing label normalization
- basic placement-null repair
- broad SSE orchestration design

## Mandatory Behavior
1. Audit the current generator contract against the live blocker set from run `55`.
2. Use run `56` as the immediate post-room-demand baseline and explain the regression shape, not just the older room-scarcity shape.
3. Isolate the most leverage-heavy remaining drifts in:
   - template math
   - policy-block pressure
   - cohort consumption
   - faculty feasibility
   - term distribution
4. Explicitly determine whether the room-demand reset exposed hidden blockers in:
   - teacher qualification/coverage depth
   - section packing and daily spread
   - policy-window fit
   - constructor term allocation logic
5. Implement the smallest coherent repair path that attacks those drifts directly.
6. Re-run generation.
7. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not run another generic KPI rerun without changing the actual generator contract.
- Do not claim success just because the rerun is marginally better.
- Treat `cohortizedClassCount=0` and `term2=0`, `term3=0` as serious drift signals, not cosmetic issues.
- Do not spend this pass trying to reintroduce broad specialized-room defaults just to make `SPECIALIZED_ROOM_UNAVAILABLE` look lower or higher.
- Assume the room-demand reset was directionally correct unless hard evidence proves otherwise.
- Use stakeholder artifacts as structural guidance, especially for:
  - protected blocks
  - full-day baseline shape
  - special-program late blocks

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- fresh sync/refresh if needed before rerun
- fresh generation run
- exact delta versus run `55`
- exact delta versus run `56`
- exact delta for:
  - `assignedCount`
  - `unassignedCount`
  - `hardViolationCount`
  - `homeRoomSuccessRate`
  - `SPECIALIZED_ROOM_UNAVAILABLE`
  - `LACKING_FACULTY`
  - `FACULTY_EXCESSIVE_IDLE_GAP`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
  - `policyBlockedCount`
  - `cohortizedClassCount`
  - `termCounts`

## Required Comparisons
At minimum, compare:
- `run 55` -> `run 56`
  - to explain what the room-demand reset changed
- `run 56` -> fresh rerun
  - to prove whether the deeper generator-contract repair actually helped

## GO Criteria
Return `GO` only if:
- the rerun materially improves the generator contract beyond run `56`
- term distribution is no longer collapsed to term 1 only, or the remaining blocker is isolated to one sharply defined final cluster
- the pass reduces at least one of the now-dominant post-room-demand blocker classes without simply reverting the room-demand reset

Return `NO-GO` if:
- term distribution remains collapsed
- cohortized demand still remains zero
- or the rerun shows no meaningful contraction in the main blocker set after the room-demand reset

## Final Output Required
Return:
1. before-state summary
2. root-cause findings by generator-contract cluster, including what run `56` revealed
3. files changed
4. verification results
5. exact KPI deltas versus runs `55` and `56`
6. final `GO` or `NO-GO`
