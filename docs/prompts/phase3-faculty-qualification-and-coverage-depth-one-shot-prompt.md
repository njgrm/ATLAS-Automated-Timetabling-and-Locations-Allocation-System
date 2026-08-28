# Copilot Execution Prompt: Phase 3 Faculty Qualification + Coverage Depth One-Shot

## Goal
Repair the remaining faculty-feasibility blocker cluster before another broad closure-style generator pass.

This prompt exists because the latest evidence shows:
- `LACKING_FACULTY` is flat at `68`
- `NO_QUALIFIED_FACULTY` remains a large unassigned reason mass
- travel and idle pressure are still high

So the next leverage point is no longer generic generator reruns.
It is qualification depth and feasible candidate-pool design.

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-post-run68-faculty-feasibility-assessment-2026-05-19.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- any qualification / assignment / placeholder coverage tests

## Baseline To Use
Use `run 68` as the main baseline:
- `assigned=2277`
- `unassigned=1199`
- `hard=1072`
- `homeRoom=46.43`
- `policyBlocked=1430`
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=368`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=723`

Also treat these as fact:
- `NO_QUALIFIED_FACULTY` remains one of the largest unresolved unassigned reason classes in the recent evidence
- stakeholder PDFs allow partial teacher attribution on section-facing master schedules
- but internal scheduling still needs real qualified assignment feasibility

## Scope
In scope:
- qualification coverage depth
- candidate-pool broadening where justified
- placeholder overlay rules for unresolved specialist demand
- travel/idle-aware faculty feasibility
- fresh rerun and comparison against run `68`

Out of scope:
- broad output-label changes
- broad room-demand reset rollback
- campus remap work
- speculative SSE architecture redesign

## Mandatory Behavior
1. Audit the unassigned reason mix with emphasis on:
   - `NO_QUALIFIED_FACULTY`
   - `LACKING_FACULTY`
   - thin single-qualified-candidate subjects
2. Identify where the current qualification contract is too narrow or too shallow.
3. Determine whether the highest leverage repair is in:
   - alias/qualification mapping depth
   - faculty-subject grade scope
   - section relevance matching
   - placeholder overlay rules
   - travel-aware candidate ordering
   - a combination of those
4. Implement the smallest coherent repair set.
5. Re-run generation.
6. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not solve this by only hiding teacher names in output.
- Preserve the lighter master-schedule teacher visibility contract.
- Improve internal feasibility:
  - real qualified candidates
  - or explicit placeholder overlays where evidence justifies them
- Avoid repairs that improve raw coverage but worsen travel/idle badly unless there is a clear net closure gain.

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- targeted tests for touched qualification/assignment logic
- fresh generation rerun
- exact delta versus `run 68`

At minimum capture deltas for:
- `assignedCount`
- `unassignedCount`
- `hardViolationCount`
- `LACKING_FACULTY`
- `NO_QUALIFIED_FACULTY` if available in diagnostics
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- `policyBlockedCount`
- `homeRoomSuccessRate`

## GO Criteria
Return `GO` only if:
- faculty-feasibility blockers materially improve from run `68`
- `LACKING_FACULTY` and/or `NO_QUALIFIED_FACULTY` contract pressure shrinks materially
- travel/idle does not regress so badly that the gain is meaningless

Return `NO-GO` if:
- the faculty blocker set remains mostly flat
- or the repair just shifts pressure to worse travel/idle with no material closure gain

## Final Output Required
Return:
1. before-state summary
2. faculty-feasibility findings
3. files changed
4. verification results
5. exact KPI deltas versus `run 68`
6. final `GO` or `NO-GO`
