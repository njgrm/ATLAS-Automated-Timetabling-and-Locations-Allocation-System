# Copilot Execution Prompt: Phase 3 Room-Demand Contract + Master-Schedule Visibility One-Shot

## Goal
Reset the remaining room-demand contract drift so ATLAS matches the stakeholder school's actual class-program behavior more closely.

This prompt exists because the stakeholder PDFs show a strongly section-home-room-centric master schedule, while the live ATLAS contract still over-assumes specialized rooms for a large share of demand.

This pass should also clarify teacher visibility rules between:
- section-facing master schedules
- room schedules
- teacher-facing schedules

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `docs/analysis/phase3-post-one-shot-drift-assessment-2026-05-19.md`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- timetable/review output surfaces
- room schedule output surfaces
- faculty-facing schedule output surfaces

## Known Facts To Treat As Fact
- placement persistence is already repaired
- stakeholder-facing label normalization is already repaired
- stakeholder PDFs do not strongly evidence per-subject room switching
- current live regular template still pushes `2160` non-classroom minutes out of `3420`
- latest run `55` still shows:
  - `SPECIALIZED_ROOM_UNAVAILABLE=864`
  - `UNASSIGNED_SECTION=606`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=785`

## Scope
In scope:
- subject room-demand defaults
- classroom/home-room-first scheduling contract
- explicit exception model for truly room-bound subjects
- master-schedule teacher visibility rules
- fresh generation rerun after the contract reset

Out of scope:
- broad campus import/remap work
- tri-sem term distribution repair
- broad SSE orchestration design

## Mandatory Behavior
1. Audit the current active subject/template room-demand contract against the stakeholder PDFs.
2. Identify which room-type assumptions are probably over-modeled for class-program generation.
3. Implement the smallest coherent contract reset so master schedule generation is classroom/home-room default unless explicit room-binding is actually justified.
4. Clarify output behavior:
   - master schedule may omit teacher names where stakeholder output does
   - teacher-facing schedules must still keep teacher-specific assignment visibility
5. Re-run generation and compare directly against run `55`.

## Required Direction
- Do not delete the ability to use specialized rooms.
- Move specialized-room demand from broad default assumption toward explicit configuration/exception where justified.
- Do not collapse all schedule surfaces into one visibility policy.
- Keep teacher-specific visibility for teacher-facing schedules even if section-facing master schedule stays simpler.

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- fresh generation rerun
- exact delta versus run `55` for:
  - `SPECIALIZED_ROOM_UNAVAILABLE`
  - `UNASSIGNED_SECTION`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
  - `homeRoomSuccessRate`
- teacher visibility behavior on:
  - section-facing timetable/master schedule
  - teacher-facing schedule surfaces

## GO Criteria
Return `GO` only if:
- room-demand contract is materially less over-specialized
- specialized-room scarcity shrinks materially from run `55`
- teacher visibility policy is explicit and correctly split by surface

Return `NO-GO` if:
- the room-demand contract remains mostly unchanged
- or the rerun shows no meaningful reduction in specialized-room pressure

## Final Output Required
Return:
1. before-state summary
2. room-demand drift findings
3. files changed
4. verification results
5. exact KPI deltas versus run `55`
6. final `GO` or `NO-GO`
