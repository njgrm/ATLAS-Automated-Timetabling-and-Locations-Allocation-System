# Copilot Execution Prompt: Phase 3 Slot-Fit + Fallback + Pre-Closure One-Shot

## Goal
Execute the strongest remaining Phase 3 repair pass by combining:
1. slot-fit and packing contraction
2. unresolved cohort fallback completion
3. final contraction of `UNASSIGNED_SECTION` and `hardViolationCount`
4. a strict pre-closure rerun gate

This prompt exists because the latest evidence shows:
- faculty qualification mass improved materially
- specialized-room scarcity is no longer the dominant blocker
- but `NO_AVAILABLE_SLOT` is now the clearest remaining blocker mass

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-post-run72-final-blocker-assessment-2026-05-19.md`
- `docs/analysis/phase3-post-run68-faculty-feasibility-assessment-2026-05-19.md`
- `docs/analysis/phase3-post-run64-drift-assessment-2026-05-19.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/hybrid-scheduler.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/subject.service.ts`
- any packing / fallback / cohort / term tests touched recently

## Baseline To Use
Use `run 72` as the main live baseline:
- `assigned=2309`
- `unassigned=1167`
- `hard=1039`
- `homeRoom=46.50`
- `policyBlocked=383`
- `cohortized=8`
- `term={2228,37,44}`
- `SPECIALIZED_ROOM_UNAVAILABLE=128`
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=372`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=731`
- `NO_AVAILABLE_SLOT=987`
- `NO_QUALIFIED_FACULTY=180`

Also treat these as fact:
- unresolved cohort fallback rows remain `8`
- room-demand reset was directionally correct and should not be broadly reverted
- lighter teacher visibility on section-facing master schedules is already correct and should not be reopened

## Stakeholder Direction To Preserve
- preserve classroom/home-room-first master scheduling
- preserve full-day baseline and protected block awareness
- preserve reduced unnecessary room switching
- preserve lighter teacher attribution on section-facing master schedules

## Scope
In scope:
- slot-fit and packing contraction
- unresolved cohort fallback resolution
- final contraction of:
  - `UNASSIGNED_SECTION`
  - `hardViolationCount`
  - `NO_AVAILABLE_SLOT`
  - `FALLBACK_UNRESOLVED`
  - `policyBlockedCount`
  - travel/idle pressure where it is directly affected
- fresh rerun and strict `GO/NO-GO`

Out of scope:
- broad placement-null repair
- broad room-demand reset rollback
- subject-label/output rework
- speculative SSE redesign

## Mandatory Behavior

### Phase A: Slot-Fit and Fallback Audit
1. Audit the current unresolved reason mix with emphasis on:
   - `NO_AVAILABLE_SLOT`
   - `FALLBACK_UNRESOLVED`
   - the remaining `8` unresolved cohort rows
2. Determine whether the dominant remaining drift is in:
   - packing order
   - day/slot fit
   - fallback path limits
   - cohort-slot resolution
   - a combination of those

### Phase B: Repair
1. Implement the smallest coherent repair set that attacks:
   - slot scarcity
   - unresolved cohort fallback
   - final hard/unassigned contraction
2. Do not reopen already-closed label, placement, or room-demand scopes without hard evidence.

### Phase C: Rerun and Gate
1. Re-run generation.
2. Capture exact deltas versus `run 72`.
3. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not treat faculty shortage as the only or primary remaining blocker unless the rerun proves it.
- Prefer reducing actual unresolved mass over producing cosmetic metric wins.
- If the `8` unresolved cohort rows are not the main blocker, say so explicitly and show the larger remaining slot-fit mass.
- Avoid repairs that materially worsen stakeholder-faithful schedule shape.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries.
- If you discover a safe local regression during this pass, fix it and log it explicitly.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- targeted tests for touched packing / fallback / cohort logic
- fresh sync/refresh if needed
- fresh generation rerun
- exact delta versus `run 72`

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
- `NO_AVAILABLE_SLOT`
- `NO_QUALIFIED_FACULTY`
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- remaining unresolved cohort row count
- whether `FALLBACK_UNRESOLVED` shrank materially

## GO Criteria
Return `GO` only if:
- the rerun materially improves the post-`run 72` blocker set
- `hardViolationCount` trends down materially from `1039`
- `UNASSIGNED_SECTION` trends down materially from `1167`
- `NO_AVAILABLE_SLOT` contracts materially
- remaining unresolved cohort/fallback rows are materially reduced or cleanly isolated to a final small cluster

Return `NO-GO` if:
- the blocker set remains mostly flat
- or the repair merely shifts pressure without meaningful pre-closure contraction

## Final Output Required
Return:
1. before-state summary
2. blocker findings by cluster
3. files changed
4. verification results
5. exact KPI deltas versus `run 72`
6. final `GO` or `NO-GO`
