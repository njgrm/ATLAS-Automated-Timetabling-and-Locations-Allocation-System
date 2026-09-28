A: met 0 / partial 2 / not met 12 · B: pass 0 / fail 0 / unperformed 5

Live audit: Brave `Your Brave`, 1366x768, hard-reloaded once; every opened route asserted `https://njgrm.buru-degree.ts.net`. Read-only only. Browser console had no error entries on the inspected routes.

## A. Follow-up and new-item audit

| item | screen/route | live verdict | covered by A3 ledger? | observed vs requested | likely component/file area |
|---|---|---|---|---|---|
| 7.1 | Assign Home Room > Building Interior View (`/sections`) | NOT_MET | partly | `Sampag...` still truncates in G9 Room 401 and empty rooms show neither the requested permanent meter track nor 0% tooltip. | `BuildingView` room-card/chip and utilization-meter render |
| 9.1 | Subjects (`/subjects`) | PARTIAL | partly | The EnrollPro strip and More filters are gone and Room/Program are direct, but both `All Status` and `All statuses` remain. | Subjects filter toolbar / `Subjects.tsx` |
| 10.1 | Assign Home Room > Building Explorer (`/sections`) | NOT_MET | partly | Building labels remain small/light with loose rows; the selected parent is not consistently the requested 14px dark, strongly weighted trigger treatment. | `BuildingView` Building Explorer list |
| 16.1 | Teaching Load (`/teaching-load`) | NOT_MET | partly | The detached bottom-right `Review teachers` control remains, while the teacher cards have no inline `Review load` control that opens a workload dialog. | Teaching Load teacher-list row and review-dialog wiring |
| 17.1 | Subject coverage (`/subjects`) | NOT_MET | partly | The centered fixed dialog still has header grade chips and `ASSIGNED SECTIONS`; sections retain repeated `GRx Name` text and no visible resize handle. | Subject coverage dialog / assigned-teacher cards |
| 23.1 | Teacher Profile (`/teachers`) | NOT_MET | partly | The profile dialog computes `resize: none`; subject codes are 10.4px, normal weight, rather than the requested 12–14px medium treatment. | Teacher profile dialog / `FacultyProfileSheet` |
| 24.1 | Teachers header (`/teachers`) | NOT_MET | partly | `Review teachers` and `More` persist; actions remain in the menu as `Create temporary teacher (Teacher 47)` and `Refresh teacher list`, not direct `Teacher X` / `Update teacher list` header buttons. | Teachers header action bar / roster action labels |
| 34 | Sections and Subjects sort headers (`/sections`, `/subjects`) | NOT_MET | no — NEW | Hover produces a tooltip node but no visible dark bubble at either table header, consistent with the requested clipping/invisible-tooltip defect. | shared `DataTableHeader` / sortable-header tooltip |
| 35 | Teachers sort headers (`/teachers`) | NOT_MET | no — NEW | Hover over `Teacher` produces an accessible tooltip but no visible readable tooltip; it was neither removed nor visibly portal-stacked. | shared `DataTableHeader` / sortable-header tooltip |
| 36 | Campus map editor (`/map?mode=editor`) | NOT_MET | no — NEW | The rightmost building cards are visibly clipped beneath the inspector rather than contained in an auto-grown/full workspace canvas. | campus-map editor canvas/board and drag bounds |
| 37 | Campus & Rooms (`/map`) | NOT_MET | no — NEW | `Overview`, `Edit map`, `Help`, and `Open map` remain; Room readiness appears before the hidden campus map and the old helper copy remains. | Campus & Rooms overview/header/layout |
| 38 | Teaching Load (`/teaching-load`) | NOT_MET | no — NEW | The inline `Teaching Load summary` remains in the header strip; there is no `Load summary` modal trigger. | Teaching Load summary region/header actions |
| 39 | Teaching Load (`/teaching-load`) | NOT_MET | no — NEW | Search is wide, `More filters` remains, and only Status/Department/Load are visible; requested sort and two direct toggles are still hidden. | Teaching Load filter toolbar |
| 40 | Teaching Load (`/teaching-load`) | NOT_MET | no — NEW | The sticky bottom `DRAFT STATUS` footer with Undo last/Discard draft/Save remains; controls were not moved to the toolbar and no save-confirmation modal is exposed. | Teaching Load draft footer, history actions, save dialog |
| 41 | Subjects (`/subjects`) | PARTIAL | partly | Filters are direct and the green strip is absent, but the duplicate status filters remain and the desktop row is not the requested compact search-plus-four-select layout. | Subjects filter toolbar / `Subjects.tsx` |

## Grouping for disjoint planner lanes

- **Planner 1 — Sections/map primitives:** 7.1, 10.1, 34 (Sections half), 36, 37. Keep `BuildingView` room cards/explorer separate from campus-map editor/overview where possible.
- **Planner 2 — Subjects:** 9.1, 17.1, 34 (Subjects half), 41. Shared areas are the Subjects filter toolbar and the Subject coverage dialog.
- **Planner 3 — Teachers/Teaching Load:** 16.1, 23.1, 24.1, 35, 38, 39, 40. Split Teachers header/profile from Teaching Load only after extracting the shared sortable-header tooltip work.
- **Shared component:** 34 and 35 both require one owner for the sortable table header/tooltip primitive; do not make route-local tooltip fixes.

## B. A3 re-baseline §2 exact rows

| re-baseline row | result | evidence / constraint |
|---|---|---|
| 2.1 FIX-06 building-canvas pan bounds | UNPERFORMED | Opened the read-only map and reset several four-floor grade wings, but did not complete the prescribed 2-floor and 5-floor, 60/80/100%, plus explorer-route matrix. |
| 2.2 FIX-08 Clear Selection semantics | UNPERFORMED | The required `Confirm Assignment` null-selection check could silently unassign a room, which is a prohibited live-data change. |
| 2.3 FIX-12 Confirm Assignment feedback | UNPERFORMED | The prescribed confirm/double-click/offline sequence sends a live room-assignment mutation. |
| 2.4 FIX-20 subject save confirmation | UNPERFORMED | The prescribed submit and duplicate-code failure checks create/attempt live subject records. |
| 2.5 FIX-29 swap confirmation | UNPERFORMED | The prescribed confirm/double-click checks execute a live Teaching Load draft swap. |
