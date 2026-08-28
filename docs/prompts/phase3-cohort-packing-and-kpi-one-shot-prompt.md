# Copilot Execution Prompt: Phase 3 Cohort Fallback + Packing + KPI One-Shot

## Goal
Attack the remaining post-`run 64` Phase 3 blockers in one strong-model pass by combining:
1. cohort slot fallback repair
2. policy/packing contraction
3. faculty movement/idle feasibility tightening
4. fresh KPI rerun gate

This prompt exists because:
- term collapse is already repaired
- cohortization is no longer zero
- specialized-room scarcity is no longer the dominant blocker
- but `hardViolationCount`, `UNASSIGNED_SECTION`, `policyBlockedCount`, and faculty movement pressure remain too high

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `docs/analysis/phase3-post-run64-drift-assessment-2026-05-19.md`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/scripts/validate-run-preferences.ts`
- any cohort, fallback, or packing-related test files

## Baseline To Use
Use `run 64` as the main live baseline:
- `assigned=2270`
- `unassigned=1206`
- `hard=1079`
- `homeRoom=51.11`
- `policyBlocked=1466`
- `cohortized=8`
- `term={2187,39,44}`
- `SPECIALIZED_ROOM_UNAVAILABLE=127`
- `FACULTY_EXCESSIVE_IDLE_GAP=363`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=842`

Also treat these verified facts as fact:
- remaining unassigned cohort rows: `8`
- their current shape: `NO_AVAILABLE_SLOT` with room reason `FALLBACK_UNRESOLVED`
- room-demand reset was directionally correct and should not be broadly reverted without hard evidence

## Stakeholder Direction To Preserve
- keep section-home-room/classroom-default intent for master scheduling
- keep full-day baseline and protected block awareness
- do not optimize by reintroducing blanket specialized-room assumptions
- avoid solutions that increase unnecessary teacher movement across the day

## Scope
In scope:
- cohort fallback completion for the remaining unresolved cohort demand
- policy/packing logic that reduces `UNASSIGNED_SECTION` and `hardViolationCount`
- faculty movement/idle-aware feasibility tightening
- fresh rerun and strict KPI gate

Out of scope:
- broad output-label work
- placement-null repair
- broad campus remap
- speculative SSE-level redesign

## Mandatory Behavior
1. Audit the remaining blocker set from `run 64`.
2. Deep-inspect the remaining unresolved cohort rows and identify the true slot/fallback failure pattern.
3. Determine whether the highest leverage fix is in:
   - cohort fallback logic
   - sequence packing
   - policy-window fit
   - travel-aware faculty assignment ordering
   - a combination of those
4. Implement the smallest coherent repair set that attacks those drifts together.
5. Re-run generation.
6. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not spend this pass on already-closed concerns:
  - subject-label normalization
  - raw specialized-room scarcity as the primary problem
  - generic term-collapse debugging
- Explicitly explain whether the `8` unresolved cohort rows were the main blocker or just a symptom.
- Prefer repairs that reduce:
  - `UNASSIGNED_SECTION`
  - `hardViolationCount`
  - `policyBlockedCount`
  - `FACULTY_EXCESSIVE_IDLE_GAP`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
without undoing the room-demand reset.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries.
- If you discover a safe local regression while repairing this pass, fix it and log it explicitly.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- targeted tests for any new cohort/fallback/term behavior you change
- fresh sync/refresh if needed
- fresh generation rerun
- exact delta versus `run 64`

At minimum capture deltas for:
- `assignedCount`
- `unassignedCount`
- `hardViolationCount`
- `homeRoomSuccessRate`
- `policyBlockedCount`
- `cohortizedClassCount`
- `termCounts`
- `SPECIALIZED_ROOM_UNAVAILABLE`
- `LACKING_FACULTY`
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`

Also report:
- remaining unresolved cohort row count
- whether `FALLBACK_UNRESOLVED` shrank materially

## GO Criteria
Return `GO` only if:
- the rerun materially improves the post-`run 64` blocker set
- `hardViolationCount` trends down from `1079`
- `UNASSIGNED_SECTION` trends down from `1206`
- remaining unresolved cohort/fallback rows are materially reduced or cleanly isolated

Return `NO-GO` if:
- the rerun does not materially reduce the main blocker set
- or the repair merely shifts pressure without improving closure readiness

## Final Output Required
Return:
1. before-state summary
2. blocker findings by cluster
3. files changed
4. verification results
5. exact KPI deltas versus `run 64`
6. final `GO` or `NO-GO`
