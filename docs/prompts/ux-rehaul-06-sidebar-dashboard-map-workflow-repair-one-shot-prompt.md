# UX Rehaul Prompt 06: Sidebar + Dashboard Map + Campus Editor Workflow Repair One-Shot

## Mission

Repair the admin scheduling officer experience after the first SMART rehaul passes.

The dashboard is the only surface that has materially improved so far. Teacher/faculty work is explicitly out of scope for this pass. Focus on the admin shell/navigation, dashboard campus interface, `/map` overview, `/map` editor, and building/room presentation so ATLAS feels like a modern SMART-family scheduling portal rather than an older EnrollPro-style admin module collection.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/reports/ux-ui-smart-redesign-progress-audit-2026-05-30.md`
- `docs/reports/sidebar-dashboard-map-smart-repair-audit-2026-05-30.md`

Inspect directly:

- `atlas-client/src/components/app-shell/navigation.ts`
- `atlas-client/src/components/app-shell/AppSidebar.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/components/CampusMap.tsx`
- `atlas-client/src/components/campus-map/CampusMapOverview.tsx`
- `atlas-client/src/components/campus-map/campusMapPalette.ts`
- Existing `/timetable` page/components that can host Preferences and Room Requests as internal workflow tabs or queues.

SMART references:

- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/AdminLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/Dashboard.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/index.css`
- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx`

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-shared-browser-qa/SKILL.md`

Use Context7 for shadcn/Radix primitives if introducing or changing Tabs, Tooltip, Popover, Accordion, Dialog, Sheet, segmented controls, or ScrollArea behavior.

## Design Contract

- SMART-family means token-driven school branding, light slate/white surfaces, clear hierarchy, rounded nav pills, task-first cards, and role-specific portal framing.
- Do not hardcode SMART emerald as ATLAS brand identity. Use `--primary`, `--accent`, `--sidebar-primary`, `bg-primary`, `text-primary`, `ring-primary`, and `shadow-primary-glow`.
- On Tailnet HNHS, primary brand surfaces must render maroon.
- Emerald is allowed only for universal success/correctness states such as ready, done, active school year, and zero blockers.
- Preserve ATLAS scheduling language: sections, subjects, teachers, rooms, timetable, generation, review, publish.
- Do not introduce SMART grading language.
- Do not redesign teacher/faculty pages in this pass except for removing admin-sidebar links that pointed to admin-facing preference/request routes.

## Hard Scope

Allowed source files:

- `atlas-client/src/components/app-shell/navigation.ts`
- `atlas-client/src/components/app-shell/AppSidebar.tsx`
- `atlas-client/src/components/AppShell.tsx` only if route labels/mobile drawer behavior must align with the nav changes
- `atlas-client/src/pages/Dashboard.tsx`
- new or changed files under `atlas-client/src/components/dashboard/*`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/components/CampusMap.tsx`
- new or changed files under `atlas-client/src/components/campus-map/*`
- `/timetable` page/components only to add internal navigation entry points for Preferences and Room Requests
- `docs/reference/atlas-runtime-source-of-truth-map.md` only if route/source ownership changes
- `docs/verification/evidence-log.md`
- `CHANGELOG.md`

Do not change backend APIs, Prisma schema, scheduler algorithms, auth behavior, or faculty/public UX beyond navigation relocation.

## Mandatory Outcomes

### 1. Simplify And Reorder Admin Sidebar

Target sidebar order:

1. Dashboard
2. Setup
   - Sections
   - Subjects
3. Teachers and Rooms
   - Teachers
   - Teaching Load
   - Campus and Rooms
4. Timetable
   - Timetable
   - Schedules
5. Review and Publish
   - Audit

Required:

- Remove the standalone `Input Collection` group.
- Remove standalone admin sidebar links for `Preferences` and `Room Requests`.
- Remove locked/disabled `Analytics` from the primary sidebar.
- Keep faculty `/my/*` bottom navigation unchanged for now.
- Ensure mobile drawer uses the same simplified admin nav.

### 2. Move Preference And Room Request Entry Points Into Timetable

Required:

- Add Timetable-level entry points for preference collection and room requests as tabs, segmented controls, cards, or queues inside the timetabling workflow.
- If the existing `/timetable` already partially hosts this work, consolidate around that instead of adding new sidebar links.
- Keep routes working if current URLs are still used, but do not advertise them as primary sidebar destinations.
- Use plain labels: `Preference collection`, `Room requests`, `Review requests`, `Schedule inputs`.

### 3. Keep And Revamp Dashboard Campus Interface

Required:

- Dashboard must include a campus/map interface, not just a text link.
- Replace scattered map stats with a single modern `CampusReadinessCard` or equivalent.
- Show a simplified campus preview or thumbnail, a concise readiness summary, and a selected-building or next-action summary.
- Primary action: `Review campus map`.
- Secondary action: `Edit rooms` or `Open map editor`.
- Do not show zoom controls, raw building coordinate controls, full floor grids, room utilization placeholders, or every building chip in the dashboard default view.

### 4. Redesign `/map` Overview As The Main Campus Experience

Required first viewport:

- Header: `Campus and Rooms`.
- Supporting copy: `Review buildings, teaching rooms, and room readiness before generation.`
- Primary action: `Edit campus map`.
- Main object: clean map/campus preview, not a plain grid of cards.
- Secondary panel: selected building summary with teaching rooms, floor count, readiness, and room review action.
- Building list/grid is secondary and should not dominate the first viewport.

### 5. Simplify `/map?mode=editor`

Required:

- Editor mode remains explicit.
- Toolbar grouped by task: Select, Draw, Rooms, Photo, History, Save.
- Save state visible: `All changes saved`, `Unsaved changes`, `Saving...`.
- Right panel begins with Building Summary and Rooms.
- Advanced placement is collapsed by default with shadcn/Radix primitive, not native `<details>`.
- Delete building is low hierarchy and confirmed.
- No native `title` attributes.
- Icon-only controls must use `Button` plus `Tooltip` and `aria-label`.

### 6. Revamp Building View And Room Presentation

Required:

- Replace rough/technical building view presentation with a calm, readable building object.
- Group rooms by floor using Tabs or segmented controls for multi-floor buildings.
- Show room cards with room name, type, capacity, and scheduling status in plain language.
- Use room type/status colors sparingly.
- Use strict DepEd grade colors only when grade-level meaning is being encoded.

### 7. Clean Campus Palette And Copy

Required:

- Replace rainbow-first swatches with calm, named campus tokens.
- Token primary is for selected/active state, not arbitrary building color.
- Remove comments or copy that describe emerald as SMART/ATLAS identity.
- Primary-path copy replacements:
  - `Short Code` -> `Room label prefix`
  - `Cap:` -> `Capacity`
  - `Background` -> `Campus photo`
  - `Add Building` -> `Draw building`
  - `X`, `Y`, `Width`, `Height`, `Rotation` -> keep under `Advanced placement`
  - seeded/stable matching copy -> remove from primary path

### 8. Preserve Layout And File-Size Rules

Required:

- No touched React component file may exceed 1000 lines.
- Keep dashboard and map surfaces inside local scroll regions.
- Do not create global browser scrollbars on desktop workbench pages.
- Use existing `@/ui/*` primitives for changed controls.
- Avoid nested cards and decorative hero blocks.

## Verification Requirements

Commands:

- `npm --prefix atlas-client run build`

Line count checks:

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- every new extracted component

Browser checks:

- `/` desktop and mobile portrait
- `/map` desktop and mobile portrait
- `/map?mode=editor` desktop
- `/timetable` desktop after adding internal preference/request entry points

Tailnet checks:

- Use `https://njgrm.buru-degree.ts.net/`.
- Log in directly as `1000001 / AdminSY2026!`.
- Capture `--primary`, dashboard primary action background, sidebar active background, and map selected state color.
- On HNHS Tailnet, brand surfaces must be maroon/token-derived, not green.

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-sidebar-workflow-after.png`
- `qa-artifacts/playwright/20260530-admin-dashboard-campus-preview-after.png`
- `qa-artifacts/playwright/20260530-admin-map-overview-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-map-editor-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-map-overview-mobile-after.png`
- `qa-artifacts/playwright/20260530-admin-timetable-inputs-after.png`

## Required Output

Return:

1. Files changed.
2. Sidebar before/after IA summary.
3. Dashboard campus interface summary.
4. `/map` overview/editor summary.
5. Building view and room presentation summary.
6. Token/color changes.
7. Line count table.
8. Accessibility and primitive-compliance notes.
9. Screenshot evidence.
10. Build/test results.
11. `GO` or `NO-GO`.

## GO Condition

Return `GO` only if:

- Admin sidebar is simplified, chronological, and free of locked Analytics.
- Preferences and Room Requests are no longer primary sidebar links and are reachable inside Timetable workflow UI.
- Dashboard still includes a campus/map interface, but as a clean readiness preview rather than a crowded editor/browser.
- `/map` defaults to an overview-led campus experience.
- `/map?mode=editor` is simpler, task-grouped, and avoids native title/details controls.
- Building view and room presentation are plain-language and presentable.
- Brand identity remains token-driven and HNHS Tailnet renders maroon primary surfaces.
- Build passes and required screenshots are captured.

Return `NO-GO` if any Critical item remains unresolved or evidence is incomplete.