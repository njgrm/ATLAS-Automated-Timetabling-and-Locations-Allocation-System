# Prompt 2 — Indexed and Lazy Live Conflict Engine

## Objective

Make live conflict feedback overlap-correct and fast by reusing indexes and calculating detailed inspector content only for the active destination.

## Preconditions

- Prompt 1 render containment passes.
- Prompt 0 conflict timing and allocation baseline exists.

## Required work

1. Replace exact `day-start-end` conflict lookup as the sole collision truth with tested interval-overlap logic.
2. Build reusable per-day indexes for section, room, faculty, and daily workload when the underlying entries/version changes.
3. Separate compact cell state from detail:
   - compact state: clean, warning, blocked, self, and stable identity codes;
   - active detail: human-readable reasons, displaced sessions, and suggested next action.
4. Calculate detailed conflict content only for the hovered, focused, or selected target.
5. Do not rebuild the indexes while the pointer crosses cells.
6. Preserve all faculty-option, source-entry exclusion, daily-load, special-event, section, room, and hard/soft behavior.
7. Add deterministic scale tests for 1,000 entries, 60 visible slots, and representative faculty-option counts.
8. Use a worker or transition only if profiling after indexing still exceeds budget; document data-copy overhead and accessibility behavior if used.

## Files to inspect first

- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/lib/timetable-utils.ts`
- existing timetable conflict/preview test suites

## Acceptance gates

- Conflict activation p95 ≤16 ms at the agreed scale.
- Active-cell detail p95 <4 ms.
- Index build occurs only when entries or relevant policy/reference versions change.
- Heap allocation caused by drag conflict activation is <1 MB on the target scenario.
- Partial overlap, containment, shared boundary, source-entry exclusion, special event, room, section, faculty, alternative faculty, and daily-load tests pass.
- Live client indications agree with authoritative server preview for the sampled candidate matrix.
- No stale conflict detail is shown after rapid source or target changes.

## Verification

- Run unit/property tests for interval overlap.
- Compare client compact/detail output with server preview for representative clean, soft, hard, swap, and special-event cases.
- Re-run Prompt 0 drag and keyboard/tap scenarios.
- Record GO/NO-GO and allocation/timing evidence.

## Out of scope

- Changing server hard/soft constraint meaning.
- Hiding conflicts to meet a performance target.
