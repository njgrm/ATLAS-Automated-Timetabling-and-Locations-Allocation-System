# UX Rehaul Prompt 12: Campus And Rooms Polish One-Shot

## Mission

Polish `/map` overview and editor as the SMART-family campus readiness workflow.

Keep the restored original/editor-style map visual, building view, zoom/pan behavior, and room schedule drilldown. Do not redesign the map away from that interaction model.

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
- `docs/prompts/ux-rehaul-06-sidebar-dashboard-map-workflow-repair-one-shot-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`
- `atlas-shared-browser-qa`

Inspect:

- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/components/campus-map/CampusMapOverview.tsx`
- `atlas-client/src/components/campus-map/CampusMapCanvasPreview.tsx`
- `atlas-client/src/components/RoomScheduleOverlay.tsx`

## Current UX Findings

- `/map` is now much closer to the desired original visual, but mode labels, selected-building summary, readiness chips, and editor task grouping can still be clearer.
- The campus map should feel like a scheduling readiness object, not an abstract graphics tool.
- Editor controls should stay grouped by task: Select, Draw, Rooms, Photo, History, Save.
- Room/building copy must stay plain: `Campus photo`, `Draw building`, `Capacity`, `Teaching room`, `Not used for scheduling`.

## Scope

Allowed source files:

- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/components/campus-map/*`
- `atlas-client/src/components/RoomScheduleOverlay.tsx` only for room drilldown copy/accessibility polish
- docs/evidence files

Do not change backend map APIs or generation logic.

## Mandatory Outcomes

### 1. Overview Mode Clarity

Keep `/map` default as read-first overview.

First viewport must show:

- title: `Campus and rooms`
- purpose: `Review buildings, teaching rooms, and room readiness before generation.`
- primary action: `Edit campus map`
- readable campus canvas
- selected building summary
- room readiness indicators

### 2. Building And Room Communication

Selected building view must clearly show:

- building name
- teaching-room count
- floors
- room readiness
- room click affordance
- latest schedule drilldown availability

Room labels must avoid `Unknown` and internal IDs when reference data is degraded.

### 3. Editor Task Grouping

Editor mode must organize controls as:

- Select
- Draw
- Rooms
- Photo
- History
- Save

Save state must be visible: `All changes saved`, `Unsaved changes`, `Saving...`.

Advanced placement fields must stay collapsed behind a shadcn/Radix primitive.

### 4. Zoom/Pan And Interaction QA

Verify:

- campus zoom buttons
- campus wheel zoom
- campus drag/pan
- building zoom buttons
- building wheel zoom
- building drag/pan
- room click opens schedule overlay

### 5. SMART Identity

Use token primary for selected/active state, not arbitrary building identity.

Keep palette calm and named.

Avoid hardcoded emerald for brand identity.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/map` desktop
- `/map` mobile portrait
- `/map?mode=editor` desktop
- room schedule overlay from building view

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-campus-overview-after.png`
- `qa-artifacts/playwright/20260530-admin-campus-room-overlay-after.png`
- `qa-artifacts/playwright/20260530-admin-campus-editor-after.png`
- `qa-artifacts/playwright/20260530-admin-campus-mobile-after.png`

## Required Output

Return files changed, interaction QA results, screenshots, build result, and `GO`/`NO-GO`.
