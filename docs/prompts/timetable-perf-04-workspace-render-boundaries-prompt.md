# Prompt 4 — Workspace State and Render Boundaries

## Objective

Prevent unrelated timetable surfaces from rerendering when selection, drag, preview, collaboration, or panel-local state changes.

## Preconditions

- Prompts 1–3 pass their interaction budgets.
- Prompt 0 Profiler scenarios can compare named surfaces.

## Required work

1. Split the monolithic workspace state/context output by ownership and update frequency.
2. Memoize stable Header, Left Rail, Center/Grid, Right Panel, overlay, and dialog context slices.
3. Pass primitives and stable callbacks where practical; avoid rebuilding giant argument objects on every root render.
4. Keep selection state scoped so only the old/new session cards and intended inspector surfaces commit.
5. Keep preview/loading state local to the feature that owns it and avoid a page-wide loading strip for unrelated work.
6. Isolate collaboration presence and remote selection updates from the grid when grid rendering does not depend on them.
7. Coalesce outbound rapid selection messages without losing the latest selection or accessibility feedback.
8. Remove the artificial fixed 180 ms pivot loading state; use real transition state only where measured work warrants it.
9. Preserve run selection, panel restoration, tutorial, pre-generation, manual edit, policy, map, request, and dialog behavior.

## Files to inspect first

- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceBody.tsx`
- `atlas-client/src/hooks/useTimetableCollaboration.ts`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`

## Acceptance gates

- Drag-over does not commit Header, Left Rail, Right Panel, dialogs, or non-grid center views.
- Selection commits only old/new session cards and intended inspector surfaces.
- Remote selection-only updates cause zero timetable-grid commits.
- Rapid local selection sends at most 10 collaboration selection events per second and always delivers the latest state.
- Pivot/filter changes have no artificial minimum delay.
- No interaction budget from Prompts 1–3 regresses by more than 10%.
- All workflow restoration and dialog tests pass.

## Verification

- Use named React Profiler boundaries and automated commit-count assertions for each Prompt 0 scenario.
- Stress presence updates while dragging and selecting.
- Test panel collapse/restore, manual edit, policy, map, and pre-generation transitions.
- Record before/after commit tables and GO/NO-GO evidence.

## Out of scope

- A visual redesign of the three-panel workspace.
- Changes to collaboration protocol semantics.
