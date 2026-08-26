# Dashboard + Campus Map SMART Identity Audit - 2026-05-29

## Scope

This audit reviews the post-rehaul ATLAS admin dashboard and campus map surfaces against the new SMART-family UX/UI identity direction. It focuses on the user's concern that the dashboard still does not feel like the same system as SMART, especially in small visual and interaction patterns.

Routes audited locally:

- `/` as direct ATLAS admin
- `/map` as direct ATLAS admin

Credentials used:

- Admin: `1000001`

Evidence captured:

- `qa-artifacts/playwright/20260529-admin-dashboard-desktop-smart-audit.png`
- `qa-artifacts/playwright/20260529-admin-campus-map-desktop-smart-audit.png`

Mobile note: the shared browser session did not shrink below a 1056px effective viewport during this pass, so real mobile portrait evidence remains pending. Do not claim mobile GO from this audit.

## Executive Verdict

`NO-GO` for SMART identity alignment.

The dashboard is more usable than the earlier KPI-wall version and now has a clear next action, but it still feels like a separate ATLAS/EnrollPro admin console rather than a SMART sibling system. The largest causes are the blue active navigation, EnrollPro platform affordances, command-center copy, amber CTA dominance, and an overly technical campus map preview.

The campus map should be treated as a redesign target, not a polish pass. It currently mixes a map editor, building inventory, room utilization, and floor-plan browser into both the dashboard and `/map`. That makes the product feel powerful but not simple, familiar, or SMART-like.

## What Improved

- The dashboard now has a visible next action: `Sections not loaded yet` with `Check sections`.
- The previous equal-weight KPI wall has been reduced into a compact stat strip.
- Setup progress is easier to scan than before.
- `/audit` crash work appears to have unblocked dashboard-adjacent navigation, though `/audit` was not the focus of this audit.
- `Dashboard.tsx` is now below the 1000-line threshold at 804 lines.

## Findings

### Major 1 - The shell still broadcasts the wrong product family

Affected route: `/` and `/map`

Evidence:

- Active sidebar pill renders as blue (`rgb(36, 99, 235)`).
- `atlas-client/src/index.css` still defaults `--accent` to blue (`221 83% 53%`).
- SMART's reference identity uses emerald as primary (`oklch(0.696 0.17 162.48)`).
- Sidebar still exposes `Back to EnrollPro` as a persistent platform item.

User impact:

The app still reads as an EnrollPro-adjacent admin system, not a SMART sibling. Even if the dashboard content improves, the first identity signal is the shell, and that signal is currently blue/admin/platform-oriented.

Recommendation:

- Change default ATLAS rehaul accent to SMART emerald/theme-primary, with school override support still preserved.
- Replace persistent `Back to EnrollPro` with a less dominant system-switcher pattern or hide it under user/menu context.
- Use SMART-like rounded nav pills, but with emerald active state and warmer portal labels.
- Reframe the shell as `Scheduling Portal`, not `ATLAS + Platform`.

### Major 2 - Dashboard copy is clearer, but still feels like an operations console

Affected route: `/`

Current copy:

- `Scheduling command center`
- `Good afternoon. Let's build this term's timetable.`
- `Your next step`
- `Sections not loaded yet`

User impact:

The next action is visible, but the page still talks like a command system. SMART pages feel more like role portals: teacher/registrar/admin context first, then work cards. ATLAS should keep scheduling authority but soften the dashboard frame.

Recommendation:

- Replace `Scheduling command center` with `Scheduling Portal` or `School Timetable Workspace`.
- Make the first viewport use a SMART-style role header:
  - `Scheduling Portal`
  - `Build and publish the school timetable`
  - `Next: Check sections before generation`
- Keep operational precision in secondary text, not the headline.

### Major 3 - The primary CTA uses warning color as the dominant brand cue

Affected route: `/`

Evidence:

- `NextActionPanel` uses amber ring/background and an amber primary button for setup-blocked states.
- The visible first action is orange/amber, while SMART's identity cue is emerald/theme-primary.

User impact:

The dashboard's most important visual signal becomes warning/orange instead of system identity. It looks like an alert panel more than a SMART-style task card.

Recommendation:

- Use emerald/theme-primary for the main CTA even when the task is setup-related.
- Represent the blocker with a small warning badge or status row inside the card.
- Use SMART-like white task card with emerald action, not a tinted amber panel.

### Major 4 - The stat strip is compact, but still reads as admin metrics instead of work objects

Affected route: `/`

Current strip:

- `Subjects 22`
- `Teachers 151`
- `Sections - Enrollment data cannot be reached`
- `Buildings 12`
- `Teaching rooms 157 160 total`

User impact:

The strip is better than a KPI wall, but it still asks users to interpret system counts. SMART's stronger pattern is object cards tied to a role job: classes to update, deadlines, sections needing action, advisory status.

Recommendation:

- Convert metrics into readiness objects:
  - `Subjects ready`
  - `Teachers ready`
  - `Sections need attention`
  - `Rooms ready`
- Make each object state obvious: ready, needs attention, unavailable.
- Hide secondary math like `160 total` behind a details affordance.

### Critical 5 - Campus map preview overwhelms the dashboard and breaks SMART simplicity

Affected route: `/`

Evidence:

- Dashboard preview exposes building chips, floor plan, 24 room buttons, utilization placeholders, zoom tools, focus mode, and edit links.
- Source still embeds substantial map/canvas behavior in `Dashboard.tsx`, including Stage, building selection, focus mode, room inspector, and room schedule overlay.

User impact:

The dashboard starts task-first, then collapses into a detailed internal room-management tool. This is the strongest reason the page does not feel like SMART. SMART dashboard cards summarize work and take users to the right detail page; they do not embed the full editor/browser experience inside the dashboard.

Recommendation:

Redesign dashboard campus map as a simple SMART-like card:

- Header: `Campus and rooms`
- Status: `12 buildings · 157 teaching rooms ready`
- Next action: `Review campus map`
- Optional small static thumbnail or simplified campus silhouette
- Three readiness chips maximum:
  - `Buildings ready`
  - `Rooms ready`
  - `Home rooms assigned` or `Needs section data`
- No zoom buttons, floor-plan grid, room buttons, or room utilization inside the dashboard default view.

Move detailed floor plans to `/map` only.

### Critical 6 - `/map` is an editor-first tool, not a campus map experience

Affected route: `/map`

Evidence:

- First viewport shows toolbar controls: `Select`, `Add Building`, `Zoom In`, `Zoom Out`, `Reset View`, `Background`, `Undo`, `Redo`, `Save Changes`.
- Right panel immediately exposes fields: `Name`, `Short Code`, `Color`, `X`, `Y`, `Width`, `Height`, `Number of floors`, room CRUD, and `Delete Building`.
- Building colors are hard-coded rainbow values, with blue first: `#2563eb`, `#059669`, `#ea580c`, etc.

User impact:

For a scheduler, this feels like a design/CAD admin tool rather than a school map. For a future unified SMART/ATLAS system, it looks visually and behaviorally unlike SMART's role-card pattern.

Recommendation:

Split campus map into two modes:

1. `Campus Overview` default mode
   - Read-first, school-branded, SMART-like page.
   - Shows campus map, building cards, room readiness, and schedule relevance.
   - Primary action: `Edit campus map` for authorized users.

2. `Map Editor` advanced mode
   - Contains draw/select/upload/undo/redo/save controls.
   - Keeps X/Y/width/height behind `Advanced placement` disclosure.
   - Uses plain labels: `Building name`, `Room label`, `Floors`, `Teaching building`.

### Major 7 - Map colors fight both DepEd semantics and SMART identity

Affected route: `/` and `/map`

Evidence:

- Building/editor palette uses blue, emerald, orange, purple, red, cyan, gold, indigo.
- Dashboard map shows large saturated blocks in mixed colors.
- SMART identity depends on calm slate/white surfaces with emerald active state.

User impact:

The map becomes a rainbow technical canvas. It is visually loud and disconnected from the rest of a unified SMART-style system.

Recommendation:

- Use a muted campus-map palette by default.
- Reserve strict DepEd grade colors only where grade-level meaning is explicit.
- Use emerald only for active/selected/ready states, not as one arbitrary building fill among many.
- Use color swatches with names, not hex-like raw color decisions.

### Major 8 - Technical and implementation language remains in the map editor

Affected route: `/map`

Examples:

- `Short Code`
- `stable seeded-map matching`
- `X`, `Y`, `Width`, `Height`
- `Cap:`

User impact:

These are implementation/model concepts, not school-user concepts. They make ATLAS feel like an internal tool and break the SMART-like simplicity goal.

Recommendation:

- Main path labels:
  - `Short Code` -> `Room label prefix`
  - `stable seeded-map matching` -> hide in advanced help
  - `X/Y/Width/Height` -> `Advanced placement`
  - `Cap:` -> `Capacity`
- Keep raw placement values only in an expandable advanced section.

### Major 9 - Several controls still rely on raw buttons or `title`

Affected route: `/` and `/map`

Evidence:

- `Dashboard.tsx` uses raw `<button>` in `RoomInspectorPanel` and `BuildingInspectorPanel`.
- Dashboard focus controls still use `title="Exit focus mode"` and `title="Focus on selected building"`.
- `BuildingPanel.tsx` still uses `title="Delete Room"` and `title="Delete Building"`.

User impact:

This violates the project's UI primitive/accessibility standard and misses the polished SMART-like interaction feel. Tooltips and accessible labels should be consistent, not browser-default title hints.

Recommendation:

- Replace raw buttons with local `Button` primitives.
- Replace `title` attributes with `Tooltip` plus `aria-label` where the visible text is not enough.
- Keep destructive actions visible, confirmed, and consistently styled.

### Major 10 - `AppShell.tsx` still violates the 1000-line rule

Affected file: `atlas-client/src/components/AppShell.tsx`

Measured line counts:

- `AppShell.tsx`: 1064 lines
- `Dashboard.tsx`: 804 lines
- `CampusMapEditor.tsx`: 846 lines
- `BuildingPanel.tsx`: 926 lines
- `MapEditor.tsx`: 218 lines

User impact:

The dashboard cannot fully feel like SMART while the shell remains both oversized and visually mixed. Shell refactor is identity work, not just maintainability work.

Recommendation:

- Execute the shell refactor prompt before more dashboard polish.
- Extract sidebar, mobile top bar, navigation config, user menu, and route transition.
- During extraction, swap the default accent and active state to SMART emerald.

## Recommended Redesign Direction

### Dashboard

Target feel: SMART teacher dashboard, translated to scheduling.

First viewport structure:

1. Shell title: `Scheduling Portal`
2. Page title: `Build and publish the school timetable`
3. Primary task card: `Next: Check sections`
4. Readiness object row:
   - `Subjects ready`
   - `Teachers ready`
   - `Sections need attention`
   - `Rooms ready`
5. Two lower work cards:
   - `Schedule readiness`
   - `Campus and rooms`

Style requirements:

- Emerald active/primary state.
- White cards on light slate/soft emerald background.
- Rounded pills like SMART, but not huge decorative cards.
- No orange primary CTA.
- No embedded room-grid browser on the dashboard.

### Campus Map

Target feel: school campus overview first, editor second.

Default `/map` structure:

1. Header: `Campus and Rooms`
2. Summary: `Review buildings, teaching rooms, and home-room readiness.`
3. Primary action: `Edit campus map`
4. Secondary action: `Review rooms`
5. Main split:
   - left: simplified campus map canvas
   - right: selected building card with room summary and readiness
6. Advanced editor only after pressing `Edit campus map`.

Editor mode structure:

- Segmented mode control: `Select`, `Draw`, `Rooms`, `Photo`
- Toolbar grouped by task, not flat buttons.
- Save status in top-right: `All changes saved`, `Unsaved changes`, `Saving...`
- Advanced placement section collapsed by default.
- Delete actions at bottom with explicit confirmation.

## Priority Implementation Order

1. Shell identity reset
   - Change default accent from blue to SMART emerald.
   - Remove or demote `Back to EnrollPro` from persistent sidebar.
   - Finish `AppShell.tsx` extraction below 1000 lines.

2. Dashboard campus-card simplification
   - Remove canvas/floor-plan browser from dashboard first view.
   - Replace with SMART-like campus readiness card.
   - Extract remaining dashboard map code into dedicated components or move it fully to `/map`.

3. Dashboard task-card polish
   - Convert amber primary action to emerald primary plus warning status.
   - Rewrite `Scheduling command center` to portal/workspace language.
   - Convert metrics into readiness objects.

4. Campus map two-mode redesign
   - Add default read/overview mode.
   - Keep current editor behind explicit `Edit campus map` mode.
   - Move technical fields into advanced disclosure.

5. Accessibility cleanup
   - Replace remaining raw buttons and `title` attributes in dashboard/map surfaces.
   - Add tooltip/aria-label patterns for icon-only controls.
   - Capture real mobile portrait and landscape screenshots after shared-browser viewport issue is resolved.

## GO / NO-GO

Current gate: `NO-GO`.

Reason:

- SMART identity is not yet consistent in the shell or dashboard.
- Campus map preview overwhelms the dashboard.
- `/map` defaults to an editor-first technical workflow.
- AppShell still exceeds the 1000-line rule.
- Mobile evidence is incomplete because the shared browser did not shrink below 1056px.

Prompt-scope GO would require:

- Emerald SMART-like primary/active state visible in shell and dashboard.
- Dashboard first viewport reads as a scheduling portal, not an admin command center.
- Dashboard campus section becomes summary/action card only.
- `/map` has a read-first campus overview and explicit advanced editor mode.
- No raw buttons or `title`-only affordances remain in touched dashboard/map controls.
- Desktop and real mobile screenshots captured after changes.
