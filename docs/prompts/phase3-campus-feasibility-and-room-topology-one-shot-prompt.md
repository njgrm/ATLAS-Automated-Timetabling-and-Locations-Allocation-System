# Copilot Execution Prompt: Phase 3 Campus Feasibility + Room Topology One-Shot

## Goal
Repair the remaining campus/room drift that is likely still inflating:
- `SPECIALIZED_ROOM_UNAVAILABLE`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- home-room mismatch against stakeholder reality

This is not a null-placement prompt.
Placement persistence is already repaired.
This prompt is about whether the persisted campus/room contract is still too generic and too stakeholder-inaccurate to support a healthy run.

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-post-one-shot-drift-assessment-2026-05-19.md`
- `prisma/seed.js`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/room-schedule.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- map/building/room services and any room typing helpers

## Goal State
Reduce topology-driven feasibility drift by making the live room/section model more stakeholder-faithful where the artifacts are strong enough, while keeping ATLAS school-agnostic and auditable.

## Known Facts To Treat As Fact
- active special-program placement fields are no longer null
- current campus topology still uses generic seeded buildings
- stakeholder occupancy artifacts prove numbered-building and mixed-building placement patterns
- current run `55` still shows:
  - `UNASSIGNED_SECTION=606`
  - `SPECIALIZED_ROOM_UNAVAILABLE=864`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=785`
- room count is not yet proven to be the main shortage
- topology and room-ownership assumptions are the stronger suspects

## Scope
In scope:
- campus topology fidelity where supported by stakeholder artifacts
- room typing / specialized-room ownership assumptions
- section-to-building and room-zone contract if it still depends on generic proxies
- minimal coherent seed/runtime/overlay repairs needed to reduce topology-driven drift
- fresh Tailnet rerun and direct comparison against run `55`

Out of scope:
- broad subject normalization work
- broad faculty-load policy redesign
- tri-sem logic repair

## Mandatory Behavior
1. Audit stakeholder room/building evidence against live ATLAS building, room, and section placement state.
2. Identify the strongest topology drifts that plausibly inflate:
   - specialized-room scarcity
   - faculty travel distance
   - section placement mismatch
3. Implement the smallest coherent repair path.
4. Re-run generation after the topology repair.
5. Return `NO-GO` if the rerun still shows no meaningful movement against the topology-driven blocker classes.

## Required Direction
- Prefer auditable mapping/overlay or seed/runtime correction over hidden inference.
- Do not pretend the office occupancy files are complete enough for a full blind import if they are not.
- Use stakeholder artifacts strongly where explicit:
  - Grade 7
  - Grade 10
- Be more conservative where artifacts are partial:
  - Grade 8
  - Grade 9

## Verification Requirements
You must verify:
- touched server build/typecheck
- touched client build/typecheck if applicable
- Tailnet sections summary
- Tailnet map/building/room state as needed
- direct DB proof for affected room/building/section placement records
- fresh generation run
- exact delta versus run `55` for:
  - `UNASSIGNED_SECTION`
  - `SPECIALIZED_ROOM_UNAVAILABLE`
  - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
  - `homeRoomSuccessRate`

## GO Criteria
Return `GO` only if:
- topology repair is persisted and auditable
- at least one of the topology-driven KPI classes improves materially from run `55`
- the resulting campus/room contract is more stakeholder-faithful without hardcoding the school into unreusable logic

Return `NO-GO` if:
- the repair stays mostly cosmetic
- or topology-driven blockers do not materially move

## Final Output Required
Return:
1. before-state summary
2. topology drift findings
3. files changed
4. verification results
5. exact KPI deltas versus run `55`
6. final `GO` or `NO-GO`
