# Prompt UX-02 — Scheduler Setup Simplification

## Objective

Make setup and data-readiness pages understandable without removing operator capability.

## Target Routes

- `/`, `/teachers`, `/subjects`, `/sections`, `/teaching-load`, `/map`.

## Implementation Directive

1. Give each route one obvious next action tied to readiness.
2. Replace large dashboard metric cards with a compact inline readiness summary where metrics support decisions; keep one task-first readiness card.
3. On Teachers, Subjects, and Sections, show basic search and one or two essential filters. Move advanced filters to a labeled popover.
4. Replace walls of compact filter buttons with project `Select`, segmented tabs, or popovers based on choice count.
5. Make tables readable at desktop and replace horizontal-table dependence on narrow screens with cards or focused detail sheets.
6. Separate list browsing from complex detail/coverage analysis so the primary table is not carrying every workflow.
7. Reframe Teaching Load around guided readiness: choose teacher or section, review assigned load, fix one issue, save with visible confirmation. Keep expert batch tools behind progressive disclosure.
8. Keep Campus Map read-first. Organize edit mode by Select, Draw, Rooms, Photo, History, Save and surface explicit saved/unsaved state.
9. Extract pages approaching 1,000 lines into route-local components before extending them.

## Copy Rules

- Prefer “teacher,” “class,” “room,” “school year,” and “needs attention.”
- Explain sync source and stale state without exposing adapter or persistence jargon.

## Exit Gate

GO when a first-time scheduler can identify the next setup task within five seconds, complete it by keyboard, recover from invalid/missing data, and use each route at 375px without page-level horizontal overflow.
