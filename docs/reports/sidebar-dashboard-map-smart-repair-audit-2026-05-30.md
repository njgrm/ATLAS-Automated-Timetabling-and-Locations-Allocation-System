# Sidebar, Dashboard Map, And Campus Editor SMART Repair Audit - 2026-05-30

## Verdict

Status: **NO-GO for continuing broad page rehaul before admin workflow repair**.

The dashboard has improved the most. Teacher/faculty pages have only marginal progress and are intentionally deferred for a later pass. Most other admin pages still read as older ATLAS/EnrollPro-era surfaces. The next repair should focus on the admin workflow shell, dashboard campus interface, and `/map` overview/editor because those surfaces shape the scheduling officer's first impression and navigation model.

## Evidence

- Tailnet URL: `https://njgrm.buru-degree.ts.net/`
- Admin credential used: `1000001 / AdminSY2026!`
- Token proof: `--primary = 360 75% 30%` on audited pages.
- Screenshots:
  - `qa-artifacts/playwright/20260530-nav-map-audit-admin-dashboard-desktop.png`
  - `qa-artifacts/playwright/20260530-nav-map-audit-admin-map-overview-desktop.png`
  - `qa-artifacts/playwright/20260530-nav-map-audit-admin-map-editor-desktop.png`
  - `qa-artifacts/playwright/20260530-nav-map-audit-admin-map-overview-mobile.png`
- Source inspected:
  - `atlas-client/src/components/app-shell/navigation.ts`
  - `atlas-client/src/components/app-shell/AppSidebar.tsx`
  - `atlas-client/src/pages/Dashboard.tsx`
  - `atlas-client/src/pages/MapEditor.tsx`
  - `atlas-client/src/components/CampusMapEditor.tsx`
  - `atlas-client/src/components/BuildingPanel.tsx`
  - `atlas-client/src/components/BuildingView.tsx`
  - `atlas-client/src/components/campus-map/CampusMapOverview.tsx`
  - `atlas-client/src/components/campus-map/campusMapPalette.ts`

## Findings

### Critical - Sidebar IA Is Not The Timetabling Workflow

Evidence:

- Current desktop sidebar order: `Dashboard -> School Setup -> Teacher Planning -> Campus -> Input Collection -> Build & Validate -> Advanced`.
- `Input Collection` contains standalone `Preferences` and `Room Requests` links.
- `Analytics` appears as a disabled/locked item under `Advanced`.

Impact:

- The sidebar reads like a module inventory rather than the operator's scheduling path.
- Preference collection and room requests become separate destinations even though they belong inside the Timetable workflow as queues, tabs, or contextual review panels.
- A disabled Analytics item adds clutter and communicates unfinished product surface.

Required correction:

- Reorder the admin sidebar around the real scheduling journey: Dashboard, Setup, Teachers and Rooms, Timetable, Review and Publish, Audit.
- Remove the disabled Analytics item from primary navigation.
- Remove standalone admin sidebar links for Preferences and Room Requests.
- Add Timetable-internal navigation for Preferences/Room Requests where the current `/timetable` experience already partially hosts the related work.

### Major - Dashboard Is Improved But Still Does Not Carry The Campus Interface Well Enough

Evidence:

- Dashboard first viewport is token-driven and runtime-aware.
- Campus readiness appears only as small stats and links (`Teaching Rooms`, `Buildings on campus`, checklist item).
- User direction: dashboard should still contain a map interface, but the current map-related presentation is outdated/subpar and must be updated.

Impact:

- The dashboard no longer overdoes the map, but it also does not yet provide a polished campus interface that helps the scheduling officer understand room readiness at a glance.
- Map readiness is split across multiple small cards instead of one modern, presentable campus object.

Required correction:

- Add a simplified dashboard campus/map preview component.
- Keep it non-editable on the dashboard: summary, clean mini-map/thumbnail, selected building or readiness summary, and one clear action into `/map`.
- Do not show zoom controls, raw floor grids, coordinate controls, or every building as a dense chip cloud in the dashboard.

### Critical - `/map` Overview Is Read-First But Still Too List-Like And Not Map-Led

Evidence:

- `/map` default overview exists and uses heading `Campus and rooms`.
- First viewport is mostly cards and a building grid. The campus photo/map preview is not the dominant object.
- Building cards expose every building at once, which becomes crowded quickly.

Impact:

- The surface is functionally better than editor-first, but visually it still feels like a setup list rather than a polished campus interface.
- It lacks the modern, easy-to-understand map presentation the user expects.

Required correction:

- Make the map/campus preview the main object.
- Put building selection and building summary into a side panel or bottom sheet pattern.
- Keep building grid/list secondary and searchable/filterable if needed.

### Critical - `/map?mode=editor` Still Feels Technical And Crowded

Evidence:

- Editor first text sample includes: `Building Details`, `ROOM LABEL PREFIX`, `COLOR`, `ADVANCED PLACEMENT`, `NUMBER OF FLOORS`, many room rows, and `Delete building`.
- Editor has `nativeDetailsCount=1` and `titleAttrs` for color swatches (`Slate`, `Stone`, `Sky`, `Emerald`, `Amber`, `Rose`, `Violet`).
- Source still includes drag/resize/coordinate tooltip language and implementation-heavy canvas details.

Impact:

- The page quickly becomes dense and operator-hostile.
- It exposes implementation concepts before the user has a simple mental model: choose a building, edit rooms, save changes.
- Native details/title attributes violate current design rules.

Required correction:

- Split editor UI into clear panels: Canvas, Building Summary, Rooms, Advanced Placement.
- Keep advanced placement collapsed with a shadcn/Radix primitive, not native `<details>`.
- Replace title attributes with `Tooltip` plus `aria-label`.
- Make delete actions low hierarchy and confirmed.

### Major - Building View And Room Presentation Still Look Rough

Evidence:

- `BuildingView.tsx` uses a schematic roof/floor/canvas rendering with many room blocks, utilization bars, abbreviated labels, and dense color semantics.
- Room rows in the editor are presented as long dense lists after the building form.

Impact:

- The building view feels technical and crowded, especially when many rooms exist.
- It does not yet match the calmer SMART-family card/object model.

Required correction:

- Redesign building view as a presentable building summary first, with rooms grouped by floor and compact readable room cards.
- Use floor tabs or segmented controls when the building has multiple floors.
- Use room type/status badges sparingly and consistently.
- Preserve grade colors only when grade meaning is displayed.

### Major - Campus Palette Still Treats Color As A User-Facing Feature Too Early

Evidence:

- Palette includes named swatches `Slate`, `Stone`, `Sky`, `Emerald`, `Amber`, `Rose`, `Violet`.
- Swatch labels are exposed via native `title` attributes in the editor.
- `campusMapPalette.ts` comments still say selected/ready slots pull SMART/ATLAS emerald identity.

Impact:

- Color still risks feeling like decoration instead of information architecture.
- The comments and token direction can reintroduce green-as-brand confusion.

Required correction:

- Use muted campus color defaults and token primary only for selected state.
- Use names like Neutral, Academic, Lab, Workshop, Admin only if the color maps to room/building meaning.
- Remove emerald-as-identity wording from palette comments.

## Scope Recommendation

Next prompt should **not** tackle teacher/faculty pages. It should focus on:

1. Admin sidebar IA simplification.
2. Dashboard campus/map preview.
3. `/map` overview redesign.
4. `/map` editor simplification.
5. Building view and building-details presentation.
6. Design-token cleanup for campus-map palette and copy.

## GO / NO-GO

Current admin workflow/map state: **NO-GO**.

Use the paired prompt `docs/prompts/ux-rehaul-06-sidebar-dashboard-map-workflow-repair-one-shot-prompt.md` for the repair pass.