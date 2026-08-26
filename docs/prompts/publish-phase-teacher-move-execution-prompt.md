# Copilot Execution Prompt: Publish Phase Foundation + Teacher-Move Policy Toggle

## Goal
Advance ATLAS into the publish lifecycle with the minimum set of correctness-first changes needed to support schedule dissemination, while making the teacher-move policy explicit and continuously visible.

Primary outcomes:
- update the seeded building/room inventory to match the occupancy-plan room counts,
- introduce a publish-phase teacher-move policy toggle,
- make teacher-move state visible in the header at all times,
- keep policy editing in the policy panes, not hidden behind the header alone.

## Scope
In scope:
- Building seed alignment to the occupancy-plan room counts.
- Publish-phase policy surface for teacher-move vs room-stay behavior.
- Header-level persistent policy visibility.
- Policy-pane control for editing the teacher-move mode.
- Publish workflow wiring needed to consume the policy state.

Out of scope:
- Full publish UI redesign.
- New schedule-generation algorithms.
- Faculty portal or student/public view redesign.
- Non-publish timetable polish that does not affect correctness.

## Required Decision
Use a dual-surface pattern for teacher-move:
- **Header:** show the current teacher-move state persistently and plainly.
- **Policy panes:** allow the officer to edit the mode and supporting policy details.

Rationale:
- The setting changes how schedulers interpret occupancy and room ownership, so it must not disappear into a deep configuration pane.
- The header should answer "Are sections staying put or moving with teachers?" at a glance.
- The policy pane should remain the only place where the setting is changed, so the header stays informative rather than interactive clutter.

## Required Files to Read First
- `phasePlan.md`
- `docs/phases/phase-4-review.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `prisma/seed.js`
- `prisma/schema.prisma`
- `atlas-client/src/pages/*` related to review/publish policy surfaces
- `atlas-server/src/services/*policy*`
- `atlas-server/src/routes/*publish*`
- `atlas-server/src/routes/*generation*`

## Context From Stakeholder Files
- Occupancy-plan docs indicate room-structured classrooms with sections assigned to rooms and teacher movement constrained by lab/specialty classes.
- The seeded building inventory should reflect the real room counts shown in the occupancy-plan documents.
- Teacher-move behavior is a publish/review policy concern, not just a room preference.

## Implementation Batches

1. **Seed Alignment**
   - Update the building seed room inventory to match the occupancy-plan room counts.
   - Keep room names and teaching/non-teaching classifications consistent with existing scheduling semantics.
   - Do not introduce new school-specific branching.

2. **Teacher-Move Policy Model**
   - Add or extend the publish-phase policy state to represent teacher-move behavior.
   - Preserve a clear boolean or enum-based representation that can be consumed consistently by backend and frontend.
   - Keep the policy scoped by school and term/school year as required by the existing architecture.

3. **Header Visibility**
   - Surface the current teacher-move mode in the publish/review header.
   - Keep the state readable at a glance on both desktop and mobile.
   - Do not bury the state inside tooltip-only or hover-only affordances.

4. **Policy Pane Editing**
   - Place the control for changing teacher-move mode in the policy panes.
   - Make the control explicit, labeled, and tied to the publish context.
   - Use plain-language copy that explains the effect on room occupancy and section movement.

5. **Publish Wiring**
   - Ensure publish-related validation and summary surfaces reflect the teacher-move setting.
   - Keep the publish path behaviorally correct for lab/ICT/TLE-type classes that must move rooms.
   - Ensure the state is visible in any confirmation or summary view before publish.

## Acceptance Targets
- The header always shows the current teacher-move mode.
- The policy pane is the only place where the mode is changed.
- The publish flow reflects the selected mode before publish confirmation.
- The building seed inventory matches the occupancy-plan room counts.
- The change does not regress schedule review, generation, or publish blockers.

## Verification Requirements
- Run the relevant build and tests for seed, policy, and publish slices.
- Add or update tests covering:
  - default teacher-move mode,
  - editing the mode in the policy pane,
  - header reflection of the active mode,
  - publish summary rendering of the mode,
  - seed/building count alignment.
- If a manual QA surface exists, confirm the header state is visible without opening nested controls.

## Evidence Logging
- Update `docs/verification/evidence-log.md` with:
  - changed files,
  - verification commands,
  - pass/fail results,
  - any remaining publish blockers.

## Output Required From Implementer
1. Context summary for the publish-phase policy change.
2. File-by-file change summary.
3. Verification results.
4. Evidence-log update confirmation.
5. Final GO/NO-GO decision with blockers, if any.
