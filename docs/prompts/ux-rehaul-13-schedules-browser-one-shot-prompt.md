# UX Rehaul Prompt 13: Schedules Browser One-Shot

## Mission

Redesign `/schedules` as the schedule browser for rooms, teachers, and sections.

This route is implemented by `RoomSchedules.tsx`, but the user-facing page should not feel like a room-only utility. It should feel like the review/publish schedule browser in the sidebar.

Do not touch `/timetable`.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect:

- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/components/room-schedules/*`
- `atlas-client/src/components/RoomScheduleOverlay.tsx`
- route definitions for `/schedules` and `/room-schedules`

## Current UX Findings

- Live sampling showed `/schedules` starts with mode buttons and `Select a room to view its schedule`, but the selector does not get enough hierarchy.
- The page lacks a visible page heading/purpose in the sampled accessible state.
- `Latest` vs `Run ID` is not explained.
- `Rooms`, `Teachers`, and `Sections` feel like raw toggles rather than a coherent schedule browser.

## Scope

Allowed source files:

- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/components/room-schedules/*`
- shared UI components if needed
- docs/evidence files

Do not change latest-run APIs, published schedule APIs, timetable workspace, or generation logic.

## Mandatory Outcomes

### 1. Page Header And Purpose

Add a clear header:

- title: `Schedules`
- purpose: `Browse the latest room, teacher, and section schedules.`
- source summary: latest completed run or selected run ID

### 2. Mode Selection As A Real Task Choice

Make mode controls understandable:

- `Rooms` -> inspect room use and conflicts
- `Teachers` -> inspect teacher daily load
- `Sections` -> inspect section timetable

Use segmented controls/tabs from `@/ui/*`.

### 3. Entity Selector Hierarchy

The selector must be impossible to miss.

When no entity is selected, show a guided empty state:

- what to choose
- why it matters
- how to proceed

Consider a default selection if there is an obvious safe option, but do not hide the selection model.

### 4. Explain Source Controls

Clarify:

- `Latest` means the newest completed generation run
- `Run ID` means inspect a specific run for troubleshooting

If `Run ID` is invalid, show inline validation and disable refresh.

### 5. Schedule State Quality

Improve loading/empty/error states for:

- no generation runs
- selected entity has no schedule
- reference data unavailable
- conflicts present

### 6. Responsive Layout

Keep local scroll.

Avoid horizontal page overflow.

The schedule grid may scroll internally where needed, but the page itself should remain controlled.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/schedules` desktop
- `/schedules` mobile portrait
- room mode with selected room
- teacher mode
- section mode
- latest vs run ID controls

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-schedules-empty-after.png`
- `qa-artifacts/playwright/20260530-admin-schedules-room-after.png`
- `qa-artifacts/playwright/20260530-admin-schedules-mobile-after.png`

## Required Output

Return files changed, schedule-browser behavior, source-control copy, screenshots, build result, and `GO`/`NO-GO`.
