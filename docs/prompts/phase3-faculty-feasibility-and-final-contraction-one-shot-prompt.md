# Copilot Execution Prompt: Phase 3 Faculty Feasibility + Final Contraction One-Shot

## Goal
Execute the remaining Phase 3 closure-prep work in one strong-model pass by combining:
1. faculty qualification and coverage-depth repair
2. travel/idle-aware assignment feasibility tightening
3. final contraction of the remaining blocker mass
4. fresh rerun and strict `GO/NO-GO`

This merged prompt exists because recent evidence shows the remaining blockers are now tightly coupled:
- `LACKING_FACULTY` remains flat
- `NO_QUALIFIED_FACULTY` remains a major unresolved reason class
- travel and idle pressure are still high
- broad blocker contraction should happen immediately after faculty-feasibility repair, not as a separate request

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
- `docs/analysis/phase3-post-run68-faculty-feasibility-assessment-2026-05-19.md`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/hybrid-scheduler.ts`
- any touched qualification / assignment / fallback / generation tests

## Baseline To Use
Use `run 68` as the main live baseline:
- `assigned=2277`
- `unassigned=1199`
- `hard=1072`
- `homeRoom=46.43`
- `policyBlocked=1430`
- `cohortized=8`
- `term={2196,37,44}`
- `SPECIALIZED_ROOM_UNAVAILABLE=127`
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=368`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=723`

Also treat these as fact:
- `NO_QUALIFIED_FACULTY` remains one of the largest unresolved unassigned reason classes in recent evidence
- the remaining `8` unresolved cohort rows are real but are not the only remaining blocker mass
- stakeholder PDFs support lighter teacher attribution on section-facing master schedules
- stakeholder PDFs do not justify leaving internal qualification feasibility unresolved

## Stakeholder Direction To Preserve
- keep classroom/home-room-default master scheduling
- keep the lighter teacher-visibility contract on section-facing master schedules
- keep teacher-specific visibility on teacher-facing schedules
- avoid solving feasibility by reintroducing broad specialized-room assumptions

## Scope
In scope:
- qualification coverage depth
- candidate-pool broadening where justified
- placeholder overlay rules for unresolved specialist demand
- travel/idle-aware faculty feasibility
- final contraction of:
  - `UNASSIGNED_SECTION`
  - `hardViolationCount`
  - `policyBlockedCount`
  - `LACKING_FACULTY`
  - `NO_QUALIFIED_FACULTY`
  - `FACULTY_EXCESSIVE_IDLE_GAP`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
  - remaining cohort fallback pressure
- fresh rerun and final `GO/NO-GO`

Out of scope:
- broad output-label changes
- placement-null repair
- broad room-demand reset rollback
- campus remap work
- speculative SSE-level redesign

## Mandatory Behavior

### Phase A: Faculty Feasibility Repair
1. Audit the current unassigned reason mix with emphasis on:
   - `NO_QUALIFIED_FACULTY`
   - `LACKING_FACULTY`
   - thin single-qualified-candidate subjects
2. Identify where the qualification contract is too narrow or too shallow.
3. Determine whether the highest-leverage repair is in:
   - alias/qualification mapping depth
   - faculty-subject grade scope
   - section relevance matching
   - placeholder overlay rules
   - travel-aware candidate ordering
   - a combination of those
4. Implement the smallest coherent faculty-feasibility repair set.

### Phase B: Final Blocker Contraction
1. Use the post-faculty-feasibility state as the working sub-baseline inside the same pass.
2. Identify the smallest remaining high-leverage contraction opportunities in:
   - `UNASSIGNED_SECTION`
   - `hardViolationCount`
   - `policyBlockedCount`
   - travel/idle pressure
   - remaining cohort fallback pressure
3. Implement only the coherent final repair set.

### Phase C: Rerun and Gate
1. Re-run generation.
2. Capture exact deltas versus `run 68`.
3. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not solve this by only hiding teacher names in output.
- Do not reopen already-closed placement/label/room-demand scopes without hard evidence.
- Improve internal feasibility with:
  - real qualified candidates
  - better assignment depth
  - or explicit placeholder overlays where evidence justifies them
- Avoid repairs that improve one blocker while making travel/idle or hard unresolved counts meaningfully worse unless there is a clear net closure gain.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries.
- If you discover a safe local regression while repairing this pass, fix it and log it explicitly.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- targeted tests for any touched qualification / assignment / fallback / generation logic
- fresh sync/refresh if needed
- fresh generation rerun
- exact delta versus `run 68`

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
- `NO_QUALIFIED_FACULTY` if available in diagnostics
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- remaining unresolved cohort row count
- whether `FALLBACK_UNRESOLVED` shrank materially

## GO Criteria
Return `GO` only if:
- the rerun materially improves the post-`run 68` blocker set
- `hardViolationCount` trends down materially from `1072`
- `UNASSIGNED_SECTION` trends down materially from `1199`
- `LACKING_FACULTY` and/or `NO_QUALIFIED_FACULTY` contract pressure shrinks materially
- travel/idle does not regress so badly that the gain becomes meaningless
- remaining unresolved cohort/fallback rows are materially reduced or cleanly isolated

Return `NO-GO` if:
- the blocker set remains mostly flat
- or the repair merely shifts pressure without improving closure readiness

## Final Output Required
Return:
1. before-state summary
2. faculty-feasibility findings
3. final blocker-contraction findings
4. files changed
5. verification results
6. exact KPI deltas versus `run 68`
7. final `GO` or `NO-GO`
