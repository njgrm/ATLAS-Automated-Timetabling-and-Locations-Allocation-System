# Prompt 1 — Drag Render Containment and Stable Grid DOM

## Objective

Remove pointer-frequency full-grid and full-workspace commits while preserving drag, keyboard, touch, accessibility, conflict styling, and drop correctness.

## Preconditions

- Prompt 0 has a reproducible baseline.
- A representative dataset and drag path are fixed for before/after comparison.

## Required work

1. Profile and replace the `TimetableGrid` drop-target state pattern that rerenders the full table for every crossed cell.
2. Ensure only the previous and current active target cells update during ordinary pointer movement.
3. Stabilize cell/session props, data objects, and handlers so memoized cells and session cards can bail out.
4. Localize ephemeral grid hover/drag state; Header, Left Rail, Right Panel, dialogs, and unrelated center views must not receive pointer-frequency updates.
5. Prevent rail drop-zone setters from doing pointer-loop work when their semantic state has not changed.
6. Profile a timetable-specific collision strategy and droppable registration boundary. Preserve accessible hit targets and all valid destinations.
7. Keep grid cell DOM stable across drag start/end. Replace per-cell tooltip subtree swapping with one shared active-target conflict surface or an equivalent measured design.
8. Remove no functionality and do not weaken collision or conflict validation.

## Files to inspect first

- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/hooks/useTimetableDragDrop.ts`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/DraggablePinWrappers.tsx`

## Acceptance gates

- Pointer-move scripting + render p95 <8 ms on the agreed profile.
- A 10-second drag sustains at least 55 FPS with no long task >50 ms.
- React Profiler shows only the previous/current target cells commit for a normal crossed-cell transition.
- Header, Left Rail, Right Panel, and dialogs do not commit on normal grid crossing.
- Drag start/end commits are each ≤16 ms at the target dataset size.
- Mounted conflict tooltip/detail content is constant-sized, not proportional to conflicted cells.
- Pointer, keyboard, and touch placement tests pass.
- Screen-reader labels and focus behavior remain correct.

## Verification

- Compare exactly the Prompt 0 drag path and dataset.
- Include React commit flamegraphs/exports and browser trace evidence.
- Add regression assertions that detect broad component commits or excessive long tasks.
- Record GO/NO-GO in `docs/verification/evidence-log.md`.

## Out of scope

- Changing conflict semantics or network preview/commit behavior.
- Replacing the full timetable layout or design identity.
