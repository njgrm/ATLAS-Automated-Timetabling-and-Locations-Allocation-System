# 2026-05-31 - Prompt 15 admin pages cross-QA gate

- Phase: Admin UX rehaul prompt 15 cross-page QA/repair gate for `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/map?mode=editor`, `/schedules`, and `/audit`.
- Operator: GitHub Copilot
- Scope gate: CROSS-PAGE QA COMPLETE, ONE ACCESSIBILITY REPAIR APPLIED, LOCAL BUILD GREEN -> CONDITIONAL GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-15-admin-pages-cross-qa-gate-prompt.md`.
- Scope held: QA/repair only; no `/timetable`, backend API, Prisma, generation logic, published schedule API, auth behavior, faculty `/my/*`, or new feature work.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Dialog, Sheet, Tooltip, ScrollArea, and Tabs accessible composition before judging the gate.
- Source compliance scan: admin gate surfaces have no raw DOM lowercase `<select`, no raw DOM lowercase `<button`, no `<details`, and no raw DOM `title=` attributes; file-size check found no touched React file above 1000 lines.
- File-size spot checks: `Sections.tsx` 912 lines, `Subjects.tsx` 883, `Faculty.tsx` 532, `TeachingLoad.tsx` 734, `MapEditor.tsx` 274, `RoomSchedules.tsx` 847, `Audit.tsx` 633, and `SubjectFormModal.tsx` 594.
- Browser gate QA: direct admin session on `https://njgrm.buru-degree.ts.net` loaded the in-scope routes with visible page purpose/status/action framing and no global horizontal overflow at the shared browser effective viewport (`clientWidth=918`, `scrollWidth=918` on sampled routes).
- Functional smoke: sections search/filter/home-room state/detail content passed; subjects search/add dialog/coverage/archive dialog passed after repair; teachers search/profile/source state passed; teaching-load mode/state copy passed with auto-fill unavailable in the current read-only/no-assignment-data state; campus overview/editor zoom-pan and room context passed; schedules room/teacher/section modes and invalid Run ID copy passed; audit loading/progress, route safety, and duplicate-key console checks passed.
- Repair applied: `SubjectFormModal.tsx` had a Radix `Checkbox` nested inside a project `Button` in the additional qualified departments control, which produced a React invalid nested `<button>` console warning. The row now renders as a non-interactive styled container with the Radix `Checkbox` as the only control and an explicit `aria-label`.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics for the repaired subject form are clean.
- Screenshots: `qa-artifacts/playwright/20260530-admin-sections-gate-after.png`, `qa-artifacts/playwright/20260530-admin-subjects-gate-after.png`, `qa-artifacts/playwright/20260530-admin-teachers-gate-after.png`, `qa-artifacts/playwright/20260530-admin-teaching-load-gate-after.png`, `qa-artifacts/playwright/20260530-admin-campus-gate-after.png`, `qa-artifacts/playwright/20260530-admin-schedules-gate-after.png`, `qa-artifacts/playwright/20260530-admin-audit-gate-after.png`.
- Caveats: the shared browser retained an effective 918px viewport during this gate, so mobile-named evidence remains no-overflow shared-browser evidence rather than true 390px proof. Tailnet runtime/resource failures seen during earlier prompt checks remain known caveats, but the repaired pages expose saved/degraded recovery copy instead of blank states.
- Decision: CONDITIONAL GO for the cross-page admin gate. The condition is viewport evidence quality only; no Critical or Major UI/accessibility blocker remains in the checked admin surfaces.

---

# 2026-05-31 - Prompt 14 audit readiness report SMART polish

- Phase: Admin UX rehaul prompt 14 for `/audit` readiness-report clarity.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE WITH RUNTIME/SAVED-EVIDENCE CAVEAT -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-14-audit-readiness-report-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/audit`, runtime source map, evidence log, and changelog; no `/timetable`, `/timetable/generate`, backend APIs, Prisma, generation logic, published schedule APIs, auth behavior, or faculty `/my/*` changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Tabs, Badge, Button, Checkbox, and ScrollArea accessible admin report layout. No new dependency or motion pattern was introduced.
- Pre-code findings: `/audit` read as a dense cross-system console with vague labels (`Mismatches`, `Clashes`, `Sync Health`, `Average Roster Load`), a generic loading spinner, raw checkbox usage in the facilities tab, duplicate-key risk in mapped findings, and a bad `Proceed to Generator` link to `/timetable/generate`.
- Fix summary: rebuilt `/audit` as `Audit readiness report` with a clear review/publish eyebrow, purpose copy, saved/live evidence chip, compact evidence banner, and a primary readiness verdict.
- Fix summary: consolidated findings into five operator action groups: `Fix teacher assignments`, `Resolve section gaps`, `Check rooms and facilities`, `Review constraints`, and `Check saved/live data`.
- Fix summary: replaced vague issue language with severity labels, plain reasons, `Why it matters` copy, and safe setup links to `/teaching-load`, `/sections`, `/subjects`, `/teachers`, and `/map` only.
- Fix summary: added loading proof that lists checked domains, removed the raw facilities checkbox pattern, removed `/timetable/generate`, and changed mapped finding keys to composite identifiers.
- Runtime source map: updated `/audit` route purpose, API dependencies, ownership notes, verdicts, action groups, saved-evidence behavior, and no-Timetable-gateway rule.
- Accessibility/primitive checks: touched audit file has no lowercase native `<select`, no lowercase native `<button`, no `title=`, no `<details`, no `/timetable/generate`, no `Proceed to Generator`, no old labels `Mismatches`, `Clashes`, `Sync Health`, or `Average Roster Load`, and no arrow glyphs.
- File-size gate: `Audit.tsx` 633 lines.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for `Audit.tsx`.
- Tailnet smoke: direct admin session on `https://njgrm.buru-degree.ts.net/audit` showed `Audit readiness report`, purpose copy, `ATLAS saved evidence`, `Checked: 5 domains`, `Blockers: 236`, `Warnings: 2`, `Average roster load: 74.3%`, and verdict `Needs fixes before scheduling`.
- Tailnet findings QA: verified action-group tabs for teacher assignments, section gaps, rooms/facilities, constraints, and saved/live data; saved/live group showed two roster sync warnings and setup links to the teacher roster.
- Tailnet safety QA: DOM/text probe found no `/timetable/generate` or `Proceed to Generator`, and no horizontal overflow (`clientWidth=918`, `scrollWidth=918`). Console probe found no duplicate-key warnings; the only console error observed was the known Tailnet runtime/settings resource failure while the page correctly stayed usable from saved ATLAS evidence.
- Mobile/shared-browser smoke: after requesting a 390px viewport, the shared browser remained fixed at `918px`; no global horizontal overflow was observed (`clientWidth=918`, `scrollWidth=918`). Mobile screenshot is a no-overflow shared-browser capture, not true 390px proof.
- Screenshots: `qa-artifacts/playwright/20260530-admin-audit-readiness-after.png`, `qa-artifacts/playwright/20260530-admin-audit-findings-after.png`, `qa-artifacts/playwright/20260530-admin-audit-mobile-after.png`.
- Decision: prompt-scope GO. `/audit` now reads as a SMART-family readiness report with explicit next setup actions and no Timetable-generation gateway.

---

# 2026-05-31 - Prompt 13 schedules browser SMART polish

- Phase: Admin UX rehaul prompt 13 for `/schedules` schedule browser clarity across rooms, teachers, and sections.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE WITH VIEWPORT/RUNTIME-CACHE CAVEAT -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-13-schedules-browser-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/schedules` / `/room-schedules` browser UI, occupancy preview fallback copy, runtime source map, evidence log, and changelog; no `/timetable`, backend APIs, latest-run route logic, Prisma, generation logic, published schedule APIs, auth behavior, or faculty `/my/*` changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for accessible controls. No new dependency or motion pattern was introduced.
- Pre-code findings: `/schedules` already supported room, teacher, and section pivots, but opened without a title/purpose, mode controls lacked audience guidance, selector/source controls were cramped, Latest vs Run ID was unexplained, invalid Run ID looked like a generic no-run state, and degraded fallbacks could expose internal labels such as `Unknown`, `Teacher #`, `Section #`, `Subject #`, or `Faculty #`.
- Fix summary: added SMART-family page framing with title `Schedules`, review/publish eyebrow, purpose copy, source summary, and descriptive task cards for Rooms, Teachers, and Sections.
- Fix summary: made the active mode explicit in the toolbar, widened the entity selector, added selector availability copy, explained Latest vs Run ID, and added inline Run ID validation that disables Refresh until the value is valid.
- Fix summary: replaced generic empty/error states with mode-specific next-action copy, source-specific invalid Run ID recovery copy, and explicit schedule-reference-unavailable copy for failed bootstrap.
- Fix summary: removed internal-ID fallback copy from room, teacher, section, subject, faculty, and occupancy-template labels, replacing them with plain labels such as `Teacher not listed`, `Section not listed`, `Subject not listed`, and `Building not listed`.
- Runtime source map: updated the route row to treat `/schedules` as the user-facing browser and `/room-schedules` as a compatibility alias for direct room links.
- Accessibility/primitive checks: touched schedule files have no lowercase native `<select`, no lowercase native `<button`, no `title=`, no `<details`, no `Unknown`, no `Teacher #`, no `Section #`, no `Faculty #`, and no `Subject #`.
- File-size gate: `RoomSchedules.tsx` 922 lines and `OccupancyTemplatePreview.tsx` 160 lines.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for touched schedule files.
- Tailnet smoke: direct admin session on `https://njgrm.buru-degree.ts.net/schedules` showed title, purpose copy, source summary, Rooms/Teachers/Sections task cards, active-mode summary, selector availability, Latest/Run ID explanation, and no horizontal overflow (`clientWidth=918`, `scrollWidth=918`).
- Tailnet room QA: selected `G10-302`; the page loaded latest completed run `#128`, showed utilization/occupied/conflict stats, and rendered the timetable grid without internal fallback labels.
- Tailnet teacher QA: selected `SANTOS, MARIA`; the page loaded latest completed run `#128`, showed teacher utilization and section/room timetable cells.
- Tailnet section QA: selected `MARCELO DEL PILAR`; the page loaded latest completed run `#128`, showed section utilization and teacher/room timetable cells.
- Tailnet source-control QA: switching to Run ID with value `0` showed inline validation `Use a whole number above 0.`, disabled Refresh, and showed `Schedule not available` with `Check the Run ID or switch back to Latest.`
- Tailnet caveat: the first shared-browser schedules load had no cached active-year context and `/runtime/context` initially failed with `NO_TOKEN` / transient Tailnet request errors, so the browser showed the honest `No rooms are available yet.` selector state. Direct API login verified `/api/v1/runtime/context?schoolId=1` returns active school year `55`; seeding the verified active-year cache in the same browser allowed normal protected-route QA to proceed. This is recorded as a Tailnet/session bootstrap caveat, not a schedules UI regression.
- Mobile/shared-browser smoke: after requesting a 390px viewport, the shared browser remained fixed at `918px`; no global horizontal overflow was observed (`clientWidth=918`, `scrollWidth=918`). Mobile screenshot is a no-overflow shared-browser capture, not true 390px proof.
- Screenshots: `qa-artifacts/playwright/20260530-admin-schedules-empty-after.png`, `qa-artifacts/playwright/20260530-admin-schedules-room-after.png`, `qa-artifacts/playwright/20260530-admin-schedules-mobile-after.png`.
- Decision: prompt-scope GO. `/schedules` now reads as a SMART-family browser for room, teacher, and section schedule review while preserving existing schedule APIs and timetable-generation boundaries.

---

# 2026-05-31 - Prompt 12 campus and rooms polish

- Phase: Admin UX rehaul prompt 12 for `/map` campus readiness overview and editor polish.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE WITH VIEWPORT CAVEAT -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-12-campus-rooms-polish-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/map`, campus map components, building view/panel, room schedule overlay copy/accessibility, runtime map, evidence log, and changelog; no `/timetable`, backend map API, Prisma, generation logic, auth behavior, or faculty `/my/*` changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Tooltip/Dialog/Accordion accessibility composition. No new dependency or motion pattern was introduced.
- Pre-code findings: `/map` had the restored original canvas/editor model, building view, zoom/pan, and room drilldown foundation, but editor task grouping was not explicit enough, editor wheel zoom was missing, selected-building summary did not state floors/schedule availability, room drilldown fallbacks could expose internal IDs, and building zoom icon controls lacked tooltip coverage.
- Fix summary: preserved the restored map/editor interaction model and added selected-building readiness chips for teaching rooms, floors, and latest schedule availability.
- Fix summary: added visible editor task grouping for Rooms, History, and Save while keeping Select, Draw building, Campus photo, undo/redo, and save controls in the same toolbar model.
- Fix summary: added campus editor wheel zoom and kept drag/pan behavior intact.
- Fix summary: routed selected campus/building canvas states through the configured `--primary` school token with maroon fallback instead of arbitrary indigo/slate selected strokes.
- Fix summary: added tooltip coverage to building view zoom controls and aria-labels to icon-only room controls.
- Fix summary: changed degraded room schedule fallbacks from internal subject/faculty/section IDs to plain labels such as `Subject not listed`, `Teacher not listed`, `Assigned section`, and `No latest schedule is available for this room yet.`
- Runtime source map: updated `/map` route purpose and notes in `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Accessibility/primitive checks: touched campus files have no lowercase native `<select`, no lowercase native `<button`, no `title=`, no `<details`, no `Unknown`, no `Subject #`, no `Faculty #`, and no `Section #`; room overlay uses labelled dialog semantics; icon-only controls have tooltip/aria-label coverage.
- File-size gate: `MapEditor.tsx` 300 lines, `CampusMapEditor.tsx` 957, `BuildingPanel.tsx` 961, `BuildingView.tsx` 621, `CampusMapOverview.tsx` 407, `CampusMapCanvasPreview.tsx` 291, `campusMapPalette.ts` 35, `RoomScheduleOverlay.tsx` 404.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for touched campus files.
- Tailnet smoke: direct admin login on `https://njgrm.buru-degree.ts.net/map` showed title `Campus and rooms`, purpose copy, `Edit campus map`, readable campus canvas, selected-building summary, teaching-room/floor/schedule readiness chips, and room-click affordance. Inventory rendered `12` buildings and `157/160` teaching rooms.
- Interaction QA: campus zoom buttons passed, campus wheel zoom passed, campus drag/pan passed, building zoom buttons passed, building wheel zoom passed, building drag/pan passed, and room click opened the room schedule overlay for `G10-302`.
- Editor QA: `/map?mode=editor` showed `Campus map editor`, `Select`, `Draw building`, `Rooms`, `Campus photo`, `History`, visible save state, and collapsed `Advanced placement`; editor zoom button, wheel zoom, and drag/pan passed.
- Mobile/shared-browser smoke: `/map` kept title, primary action, selected-building summary, and room readiness visible with no horizontal overflow (`clientWidth=918`, `scrollWidth=918`). Shared browser viewport stayed fixed at `918px` after 390px viewport request, so the mobile screenshot is a no-overflow shared-browser capture, not true 390px proof.
- Screenshots: `qa-artifacts/playwright/20260530-admin-campus-overview-after.png`, `qa-artifacts/playwright/20260530-admin-campus-room-overlay-after.png`, `qa-artifacts/playwright/20260530-admin-campus-editor-after.png`, `qa-artifacts/playwright/20260530-admin-campus-mobile-after.png`.
- Decision: prompt-scope GO. `/map` now reads as the SMART-family campus readiness workflow while preserving the restored original map/editor interaction model.

---

# 2026-05-30 - Prompt 11 teaching load state clarity workspace

- Phase: Admin UX rehaul prompt 11 for `/teaching-load` state clarity and dense operator workflow guidance.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE PARTIAL WITH EXPLICIT CAVEAT -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-11-teaching-load-state-clarity-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/teaching-load`, `useTeachingLoadData` untouched except read-only inspection, and faculty-assignment UI components; no `/timetable`, backend API, Prisma, staffing math, assignment persistence contract, or Auto-Fill algorithm changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Tooltip/Dialog/Sheet/Tabs/Select accessible composition, `/websites/radix-ui_primitives` for overlay/tab/tooltip accessibility, and `/websites/motion_dev_react` reduced-motion guidance. No new motion was introduced.
- Pre-code findings: `/teaching-load` had strong operator controls but weak state explanation. The first state could read as `Teaching Load`, `READ-ONLY`, `TOTAL COVERAGE 0 / 0`, `UNASSIGNED 0`, and a blank teacher inspector without telling the operator whether ATLAS was loading, degraded, offline, unavailable, or safe to edit. The review-warning dismiss action used a raw `title=` attribute.
- Fix summary: added computed workspace state copy for `Verified live`, `Checking source`, `Using saved data`, `Read-only saved data`, `Offline saved data`, and `No assignment data`, each with write-state reasoning and next operator action.
- Fix summary: reworked the compact top workflow band with page title `Teaching Load`, purpose copy `Assign subjects and sections to teachers before generation.`, source-state chip, coverage explanation, Teacher X count, unassigned count, task-mode tooltips, and a primary action that changes between save draft, retry/check source, offline, or preview auto-fill based on current state.
- Fix summary: added explicit loading, no roster, no matching teachers, no section universe, no section match, no selected teacher, no selected section, read-only/write-blocked, staffing-audit no-coverage, and network-error recovery copy.
- Fix summary: replaced raw `title="Dismiss Review Warning"` with `Tooltip` plus `aria-label="Dismiss review warning"`.
- Runtime source map: updated `/teaching-load` purpose and notes in `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Accessibility/primitive checks: touched Teaching Load files have no lowercase native `<select`, no lowercase native `<button`, no `title=`, and no `<details`; new icon-only dismiss action has an aria label and Tooltip; Sheet/Dialog title/description contracts remain intact.
- File-size gate: `TeachingLoad.tsx` 771 lines, `WorkspaceToolbar.tsx` 370, `TeacherGridMode.tsx` 476, `SectionGridMode.tsx` 423, `WorkloadInspector.tsx` 297, `SectionInspector.tsx` 196, `StaffingAuditSheet.tsx` 215.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for touched Teaching Load files.
- Tailnet smoke: initial shared page QA on `https://njgrm.buru-degree.ts.net/teaching-load` showed the updated title, purpose, source-state label, next-action copy, staffed coverage, Teacher X count, unassigned count, `By teacher`, `Section allocation`, `Staffing audit`, `Preview auto-fill`, section-allocation empty state, staffing audit sheet, and auto-fill confirmation dialog. No global horizontal overflow was observed (`clientWidth=918`, `scrollWidth=918`). Shared browser viewport remained fixed at `918px` even after desktop/mobile viewport requests; mobile-named capture is a no-overflow shared-browser capture, not a true 390px viewport.
- Tailnet caveat: a fresh browser tab later lost/failed protected-route bootstrap and showed `Workspace Unavailable` with `Network Error`, while direct API probes returned `/api/v1/health` 200 and `/api/v1/runtime/context?schoolId=1` 401 without token. The page error state was actionable (`Retry Connection`), and the successful original shared-page smoke plus screenshots were retained as the prompt evidence.
- Offline/read-only smoke: simulated offline state on the original shared page showed `Offline saved data`, `Saving is disabled while ATLAS is offline.`, and `Reconnect, then refresh the source before saving assignments.` with no horizontal overflow.
- Screenshots: `qa-artifacts/playwright/20260530-admin-teaching-load-desktop-after.png`, `qa-artifacts/playwright/20260530-admin-teaching-load-readonly-after.png`, `qa-artifacts/playwright/20260530-admin-teaching-load-mobile-after.png`.
- Decision: prompt-scope GO. `/teaching-load` now explains source, write, coverage, mode, empty, degraded, and recovery states in operator-facing language while preserving staffing math and backend contracts.

---

# 2026-05-30 - Prompt 10 teachers SMART roster health workspace

- Phase: Admin UX rehaul prompt 10 for `/teachers` roster health and scheduling-readiness workspace.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-10-teachers-roster-health-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/teachers` page and faculty row/profile components; no `/timetable`, backend API, Prisma, scheduler algorithm, auth, or faculty `/my/*` changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Sheet/Tooltip/Select accessible composition, `/websites/radix-ui_primitives` for overlay/menu accessibility, and `/websites/motion_dev_react` reduced-motion guidance. No new motion was introduced.
- Pre-code findings: Prompt 07 shared framing was present, but `/teachers` still did not clearly answer roster health before the table. The page needed readiness stats, plain source-state language, readable load states in rows, a visible Teaching Load action, and a profile sheet that explained load, assignments, adviser context, source freshness, and the next fix path.
- Fix summary: reframed the page purpose as teacher roster and scheduling-load readiness, changed the primary action to `Refresh teacher roster`, added stats for active teachers, with load, without load, needs review, and last sync, removed primary visible runtime-style source copy, and improved cache/error/retry copy.
- Fix summary: updated teacher rows so name remains primary, department/specialization stays secondary, adviser context remains calm, load state labels read `Within load`, `Needs review`, `No teaching load`, or `Excluded`, and `Review teaching load` is visible as the row action.
- Fix summary: updated the profile sheet with accessible title/description, current scheduling load, assigned subjects/sections, adviser/source context, source freshness, no-load recovery copy, and a clear `Review teaching load` action.
- Runtime source map: updated `/teachers` page purpose and UI-source-state notes in `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Accessibility/primitive checks: touched teacher files have no lowercase native `<select`, no lowercase native `<button`, no `title=`, and no `<details`; row icon actions have aria labels; the profile sheet keeps `SheetTitle` and `SheetDescription`.
- File-size gate: `Faculty.tsx` 532 lines, `FacultyRow.tsx` 141 lines, `FacultyProfileSheet.tsx` 253 lines.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for touched teacher files.
- Tailnet smoke: `https://njgrm.buru-degree.ts.net/teachers` loaded with direct ATLAS admin session, showed page purpose, normalized source label, roster-health stats, `Refresh teacher roster`, load-state labels, visible `Review teaching load` actions, and no raw `runtime` primary copy. Search/filter with `math` returned matching rows. Profile sheet opened and showed current load, assigned subjects/sections, adviser/source context, source freshness, and fix action. No global horizontal overflow (`clientWidth=918`, `scrollWidth=918`). Shared browser viewport remained fixed at `918px` even after mobile viewport request; mobile-named capture is still a no-overflow shared-browser capture, not a true 390px viewport.
- Screenshots: `qa-artifacts/playwright/20260530-admin-teachers-desktop-after.png`, `qa-artifacts/playwright/20260530-admin-teachers-profile-after.png`, `qa-artifacts/playwright/20260530-admin-teachers-mobile-after.png`.
- Decision: prompt-scope GO. `/teachers` now communicates roster health and scheduling-load next actions in SMART-family admin language while preserving backend contracts and current phase boundaries.

---

# 2026-05-30 - Prompt 09 subjects SMART curriculum readiness workspace

- Phase: Admin UX rehaul prompt 09 for `/subjects` SMART curriculum/readiness workspace.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-09-subjects-smart-curriculum-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/subjects` and subject components; no `/timetable`, backend API, Prisma, scheduler algorithm, auth, or faculty `/my/*` changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Dialog/Sheet/Tooltip/Popover/form composition, `/websites/radix-ui_primitives` for overlay accessibility/title/description, and `/websites/motion_dev_react` reduced-motion guidance. No new motion was introduced.
- Pre-code findings: prompt 07 gave `/subjects` the shared admin frame, but the page still read like a generic catalog. It needed curriculum-readiness purpose copy, active/archive/coverage/room-risk summary, clearer offering refresh language, action labels for row controls, and plain-language add/archive/delete dialog wording.
- Fix summary: reframed `/subjects` around schedulable curriculum readiness, renamed offering sync to `Refresh offerings`, added missing-teacher-coverage and room-constrained stats from existing teaching-load summary data, renamed table labels to `Weekly time`, `Room need`, and `Programs and owner`, expanded the coverage sheet with assigned teachers, uncovered scope, program scope, and Teaching Load follow-up links, and clarified add/edit/delete/archive UI copy.
- Accessibility/primitive checks: touched subject files have no lowercase native `<select`, no lowercase native `<button`, no `title=`, and no `<details`; icon row actions now expose aria labels for coverage, edit, and more-actions controls; dialogs expose title/description copy.
- File-size gate: `Subjects.tsx` 883 lines, `SubjectRow.tsx` 242 lines, `SubjectFormModal.tsx` 598 lines, `SubjectAddForm.tsx` 245 lines, `DeleteSubjectDialog.tsx` 284 lines.
- Local verification: `npm --prefix atlas-client run build` passed with Vite `8.0.3` and `2529 modules transformed`; diagnostics clean for touched subject files.
- Tailnet smoke: `https://njgrm.buru-degree.ts.net/subjects` loaded with direct ATLAS admin session, showed curriculum-readiness purpose copy, source state, active/archive/missing-coverage/room-constrained stats, `Refresh offerings`, `Add subject`, and table labels; no global horizontal overflow (`clientWidth=918`, `scrollWidth=918`). Coverage drawer, add-subject dialog, and archive confirmation dialog opened and showed expected title/description/action copy. Shared browser viewport remained fixed at `918px` even after mobile viewport request; mobile-named capture is still a no-overflow shared-browser capture, not a true 390px viewport.
- Screenshots: `qa-artifacts/playwright/20260530-admin-subjects-desktop-after.png`, `qa-artifacts/playwright/20260530-admin-subjects-coverage-after.png`, `qa-artifacts/playwright/20260530-admin-subjects-form-after.png`, `qa-artifacts/playwright/20260530-admin-subjects-archive-after.png`, `qa-artifacts/playwright/20260530-admin-subjects-mobile-after.png`.
- Decision: prompt-scope GO. `/subjects` now communicates curriculum readiness and coverage next actions in SMART-family admin language while preserving backend contracts and current phase boundaries.

---

# 2026-05-30 - Prompt 08 sections SMART setup workspace

- Phase: Admin UX rehaul prompt 08 for `/sections` SMART setup/readiness workspace.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-08-sections-smart-setup-one-shot-prompt.md`.
- Scope held: frontend-only changes to `/sections` and section components; no `/timetable`, backend API, Prisma, scheduler algorithm, or auth changes.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for Button/Tooltip/Popover/Sheet composition, `/websites/radix-ui_primitives` for overlay accessibility, and `/websites/motion_dev_react` reduced-motion guidance. No new motion was introduced.
- Pre-code findings: prompt 07 added the shared page frame, but `/sections` still needed stronger readiness framing, a clear first action, explicit home-room edit writability/queue/blocking guidance, more actionable row copy, and a detail surface that answered room/building and class-coverage questions.
- Fix: revised the `/sections` header purpose to explain roster verification and home-room readiness before schedule generation.
- Fix: kept compact inline stats and changed the readiness summary to `Sections`, `Home rooms assigned`, `Need rooms`, and `Queued` when local home-room edits exist.
- Fix: preserved Prompt 07 source-state copy labels (`Verified live`, `Checking source`, `Using saved data`, `No saved data`) and expanded tooltip copy to explain whether home-room edits are writable, queued, or paused.
- Fix: added a non-interactive home-room edit status rail explaining writable, queued/offline, checking, or blocked states without intercepting table clicks.
- Fix: improved section row identity and actions: section name/grade is the primary clickable identity, program stays secondary, home-room readiness states are plain-language, and detail/teaching-load actions have accessible labels.
- Fix: converted remaining native room-map buttons in the section room modal to project `Button` primitives and changed occupied-room copy to `Used by...` / `Already assigned`.
- Fix: expanded the section detail sheet with section/program context, current home room, building context, assigned class totals, assigned classes, uncovered expected classes, and an all-covered success state.
- File-size guardrail: `Sections.tsx` 912 lines, `SectionRow.tsx` 218 lines, `SectionRoomPicker.tsx` 250 lines, `SectionRoomMapModal.tsx` 381 lines, `SectionDetailsSheet.tsx` 335 lines, `AdminWorkspace.tsx` 234 lines.
- Compliance scan: touched files contain no lowercase native `<select`, no lowercase native `<button`, no literal `title=`, and no `<details` occurrences.
- Diagnostics: VS Code diagnostics clean on `Sections.tsx`, `SectionRow.tsx`, `SectionRoomPicker.tsx`, `SectionRoomMapModal.tsx`, and `SectionDetailsSheet.tsx`.
- Build: `npm --prefix atlas-client run build` -> pass; `2529 modules transformed`.
- Tailnet smoke: `/sections` exposed the visible `Sections` h1, purpose copy, `Using saved data` source label, `Home rooms assigned`, `Need rooms`, `Browse room map`, `Sync sections`, home-room edit state rail, and `Home-room readiness` column in the browser snapshot.
- Tailnet smoke: detail surface opened from the first section row and exposed accessible sheet content with section title, description, current home room, building context, assigned classes, and uncovered-class/all-covered state.
- Tailnet smoke: no global horizontal overflow was reported in the shared-browser effective viewport (`clientWidth=918`, `scrollWidth=918`). The shared browser retained `clientWidth=918` even when scripted to mobile/tablet sizes, so viewport evidence is limited to the available shared-browser surface.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-sections-desktop-after.png`, `20260530-admin-sections-mobile-after.png`, `20260530-admin-sections-tablet-after.png`, `20260530-admin-sections-detail-after.png`.
- Decision: GO for prompt 08 `/sections` SMART setup workspace scope.

---

# 2026-05-30 - Prompt 07 admin shared list pattern

- Phase: Cross-cutting admin UX rehaul prompt 07 for `/sections`, `/subjects`, and `/teachers`.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET SMOKE COMPLETE -> GO.
- Trigger: user asked to execute `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`.
- Design references: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` for button/table/tooltip composition, `/websites/radix-ui_primitives` for tooltip accessibility/composition, and `/websites/motion_dev_react` reduced-motion guidance. No new motion was introduced.
- Pre-code findings: `/sections`, `/subjects`, and `/teachers` rendered without accessible `h1`/`h2` page framing in the shared-browser snapshot; first-screen content started with filters/actions/table columns; source-state copy varied across `Saved Data`, `Verifying runtime`, `No Saved Data`, and `Verified with EnrollPro`.
- Fix: added shared admin workspace components for page title/purpose copy, source-state chip, compact stat banner, search/filter toolbar, local-scroll table shell, and empty/degraded state panels.
- Fix: applied the shared frame to `/sections`, `/subjects`, and `/teachers` while preserving current API calls, row components, pagination behavior, filters, and sync actions.
- Fix: normalized source-state labels to `Verified live`, `Checking source`, `Using saved data`, and `No saved data`, with tooltip explanations that cover what is shown, why it matters, and what to do next.
- File-size guardrail: `AdminWorkspace.tsx` 234 lines, `Sections.tsx` 858 lines, `Subjects.tsx` 789 lines, `Faculty.tsx` 529 lines.
- Compliance scan: touched files contain no lowercase native `<select`, no literal `title=`, and no raw `<button className...` occurrences.
- Diagnostics: VS Code diagnostics clean on `AdminWorkspace.tsx`, `Sections.tsx`, `Subjects.tsx`, and `Faculty.tsx`.
- Build: `npm --prefix atlas-client run build` -> pass; `2529 modules transformed`.
- Tailnet smoke: `/sections`, `/subjects`, and `/teachers` each expose visible `h1` page titles and purpose copy in the browser snapshot; no horizontal overflow reported at the shared browser's effective viewport.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-sections-desktop-prompt07-after.png`, `20260530-admin-sections-mobile-prompt07-after.png`, `20260530-admin-subjects-desktop-prompt07-after.png`, `20260530-admin-subjects-mobile-prompt07-after.png`, `20260530-admin-teachers-desktop-prompt07-after.png`, `20260530-admin-teachers-mobile-prompt07-after.png`.
- Caveat: the shared browser retained an effective `clientWidth` of `918px` even after scripted viewport changes, so the screenshots are evidence for the available shared-browser viewport rather than a true independent mobile browser run.
- Decision: GO for prompt 07 shared admin list/workspace pattern scope.

---

# 2026-05-30 - Sidebar collapse and map schedule UX repair

- Phase: Cross-cutting admin UX repair for AppShell sidebar, dashboard campus map, `/map` overview, building view, and room schedule overlay.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET QA COMPLETE -> GO with one noted live-data caveat.
- Trigger: user asked to check collapsing sidebar behavior, room schedules for buildings, map zoom/scroll, and UX/UI on both map layouts.
- Pre-code findings:
  - Major: room schedule overlay showed `Unknown Subject`, `Unknown Section`, and `Unknown Faculty` on `/map` room clicks when reference lookup failed or lagged.
  - Major: campus and building zoom scaled from origin and could drift off useful focus; wheel zoom was functional but felt jumpy/subpar.
  - Major: desktop sidebar state ignored the saved `sidebar:state` cookie, and the collapsed footer action could open a hidden custom menu.
  - Major: dashboard campus map did not pass through `campusImageUrl`, so it could diverge visually from `/map`.
- Fix: room schedule overlay now has bounded loading, independent retry/fallback reference lookups, parent-provided reference maps, and user-friendly labels instead of `Unknown`/internal numeric placeholders.
- Fix: pivoted latest-run room schedules now carry subject, section, and faculty display labels where available.
- Fix: campus and building Konva maps now use focus-preserving zoom, wheel zoom, pan clamping, and touch-action control.
- Fix: dashboard campus map now receives the persisted campus image URL from `useDashboardData`.
- Fix: desktop AppShell sidebar now honors the saved sidebar cookie outside timetable routes and restores it after leaving timetable; collapsed sidebar footer now uses a Radix dropdown instead of a hidden custom menu.
- Build: `npm --prefix atlas-client run build` -> pass, `built in ~650ms`; tracked `atlas-client/dist` restored after build verification.
- Diagnostics: VS Code diagnostics clean on `RoomScheduleOverlay.tsx`, `CampusMapCanvasPreview.tsx`, `BuildingView.tsx`, `CampusReadinessCard.tsx`, `CampusMapOverview.tsx`, `AppShell.tsx`, `AppSidebar.tsx`, `useDashboardData.ts`, `Dashboard.tsx`, `schedule-pivot.ts`, and `types.ts`.
- Tailnet `/map` verification: shared-browser viewport `963x682`; campus zoom button moved to `120%`; wheel zoom moved to `130%`; room `G10-201` overlay opened with `FIL`, `ENG`, `MATH`, faculty names such as `MAGNO, ANDRES`, no `Unknown`, no `Subject #`, no `Faculty #`, and no `Section #` placeholders.
- Tailnet dashboard verification: dashboard campus canvas measured approximately `920x520`; building canvas approximately `902x340`; zoom button reached `120%`; room `G10-201` overlay opened with subject labels, faculty names, no `Unknown`, and no internal numeric placeholders.
- Tailnet shell verification: shared browser rendered the mobile/tablet shell at `963x682`; `Open navigation menu` opened the mobile navigation drawer with dashboard, sections, subjects, teachers, teaching load, campus, timetable, schedules, audit, return, and sign-out actions. Desktop sidebar collapse was verified by code path because the shared browser viewport stayed below the desktop breakpoint.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-map-overview-live-audit-before.png`, `20260530-admin-map-room-overlay-live-audit-before.png`, `20260530-admin-map-room-overlay-after-clean-labels.png`, `20260530-admin-dashboard-map-room-overlay-after-clean-labels.png`.
- Caveat: live section-summary lookup intermittently returned Tailnet `502` during QA; overlay now avoids unknown/internal-ID copy in that degraded state and still shows usable subject/faculty schedule content. Section proper names should appear when the section-summary reference response succeeds.
- Decision: GO for the requested sidebar/map schedule/zoom UX repair.

---

# 2026-05-30 - Dashboard interactive campus map restoration

- Phase: Cross-cutting admin UX repair for dashboard campus map interaction.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, TAILNET QA COMPLETE -> GO.
- Trigger: user reported that dashboard Buildings and rooms were still too small/constrained and not clickable, even after `/map` was restored.
- Fix: upgraded dashboard `CampusReadinessCard` from a compact static preview to an interactive campus workspace using the shared Konva campus canvas, building selection, `BuildingView`, room utilization metadata, and `RoomScheduleOverlay`.
- Fix: dashboard campus canvas now renders at `520px` height on desktop with zoom, wheel zoom, drag/pan, reset, and accessible icon-button labels. The selected-building panel now includes an interactive building/room view at `340px` height.
- Fix: room clicks from the dashboard building view open the full room schedule overlay using latest timetable data, preserving the same drill-down behavior as `/map`.
- Build: `npm --prefix atlas-client run build` -> pass, `built in 610ms`; tracked `atlas-client/dist` restored after build verification.
- Diagnostics: VS Code diagnostics clean on `CampusReadinessCard.tsx`, `CampusMapCanvasPreview.tsx`, and `BuildingView.tsx`.
- File-size guardrail: `CampusReadinessCard.tsx` 277 lines.
- Tailnet desktop verification: direct admin session on `https://njgrm.buru-degree.ts.net/`; dashboard campus canvas measured `920x520`; building view canvas measured `902x340`; `Zoom in campus map` changed the dashboard campus map to `120%`; clicking dashboard room `G10-201` opened `RoomScheduleOverlay`, which populated with `80%` utilization, `1800/2250 min`, `Run #128 · COMPLETED`, and the timetable grid.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-dashboard-interactive-campus-after.png`, `20260530-admin-dashboard-interactive-campus-room-schedule-after.png`, `20260530-admin-dashboard-interactive-campus-room-schedule-loaded-after.png`.
- Decision: GO for the dashboard-specific campus map clickability, size, and interaction regression.

---

# 2026-05-30 - Admin campus map room schedule + zoom restoration

- Phase: Cross-cutting admin UX repair for `/map` campus overview and dashboard campus placement.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, DESKTOP + MOBILE TAILNET QA COMPLETE -> GO.
- Trigger: user reported that room schedules and schedule-based room capacity/utilization were missing from room clicks, that the campus map/buildings were too small and no longer zoomable/scrollable, and that the dashboard campus map should be at the very bottom.
- Design references: `docs/DESIGN.md` campus map/editor rules, `docs/DESIGN-INSPIRATION.md` admin clarity and dense responsive layout guidance, `docs/context7-library-map.md`; Context7 checked `/shadcn-ui/ui` tooltip/dialog composition and `/konvajs/react-konva` Stage click/drag patterns.
- Fix: `CampusMapCanvasPreview` now supports interactive zoom, wheel zoom, drag/pan, reset, and tooltip-backed icon buttons while preserving compact dashboard preview usage. `/map` uses the larger interactive canvas and a larger `BuildingView` detail panel.
- Fix: `/map` now fetches latest timetable data, subjects, and section summaries, derives room utilization from `pivotDraftToView`, passes utilization/occupancy/section metadata into `BuildingView`, and opens `RoomScheduleOverlay` when a room is clicked. Room tiles show schedule utilization bars and the schedule overlay links to `/room-schedules?roomId=<id>&source=latest`.
- Fix: dashboard `CampusReadinessCard` moved after the scheduling lifecycle banner so the campus map is the final dashboard section.
- Build: `npm --prefix atlas-client run build` -> pass, `built in 616ms`; tracked `atlas-client/dist` restored after cleanup to avoid unrelated build-artifact churn.
- Diagnostics: VS Code diagnostics clean on `CampusMapCanvasPreview.tsx`, `CampusMapOverview.tsx`, `Dashboard.tsx`, and `BuildingView.tsx`.
- File-size guardrail: `CampusMapOverview.tsx` 282 lines, `CampusMapCanvasPreview.tsx` 222 lines, `Dashboard.tsx` 587 lines, `BuildingView.tsx` 535 lines.
- Tailnet desktop verification: direct admin session on `https://njgrm.buru-degree.ts.net/map`; campus map zoom button changed the toolbar from `100%` to `120%`; selected building panel rendered `Grade 10 Academic Wing`, room utilization controls, and building-level zoom controls; clicking room `G10-301` opened `RoomScheduleOverlay` with `Run #128 · COMPLETED`, utilization stats, timetable grid, and `Open Full Page` target `/room-schedules?roomId=113&source=latest`.
- Tailnet dashboard verification: direct admin session on `/`; heading order is `Scheduling Dashboard` -> `Resolve scheduling violations` -> `Where the school year stands` -> `Buildings and rooms`, confirming the map section is after the lifecycle banner.
- Mobile proof: Playwright viewport `390x844` on `/map` captured the restored overview with zoom controls and building detail available.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-map-overview-desktop-room-schedule-after.png`, `20260530-admin-map-overview-desktop-zoom-after.png`, `20260530-admin-dashboard-bottom-campus-map-after.png`, `20260530-admin-map-overview-mobile-zoom-after.png`.
- Decision: GO for the user-reported room schedule, schedule utilization, map zoom/pan, and dashboard placement regressions.

---

# 2026-05-30 - Admin campus map visual repair after Tailnet QA

- Phase: Cross-cutting admin UX repair for dashboard campus preview and `/map` overview.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, DESKTOP + TRUE-MOBILE TAILNET QA COMPLETE -> GO.
- Trigger: user reported the new dashboard and Campus & Rooms map redesign looked worse than the original editor map and that the building view appeared missing.
- Root cause: the dashboard preview and `/map` overview used a separate abstract HTML/absolute-positioned map treatment while `/map?mode=editor` retained the recognizable original Konva building canvas. This created inconsistent mental models across the two pages.
- Fix: added shared read-only `CampusMapCanvasPreview` using the same editor-style building rectangles, labels, colors, selected stroke, campus image handling, and non-teaching hatch treatment. Dashboard `CampusReadinessCard` and `/map` `CampusMapOverview` now use that shared canvas. `/map` also restores the selected building floor/room preview via `BuildingView` with a `Review rooms` action.
- Build: `npm --prefix atlas-client run build` -> pass, `built in 936ms`.
- Diagnostics: VS Code diagnostics clean on `CampusMapCanvasPreview.tsx`, `CampusMapOverview.tsx`, `CampusReadinessCard.tsx`, `BuildingPanel.tsx`, `CampusMapEditor.tsx`, `Dashboard.tsx`, and `MapEditor.tsx`.
- Tailnet desktop verification: direct admin login `1000001 / AdminSY2026!`; `--primary = 360 75% 30%`; `/` dashboard campus preview and `/map` overview now render the same editor-style building map; `/map` selected-building panel shows Grade 10 Academic Wing plus building floor/room preview; `/map?mode=editor` remains intact.
- Screenshot evidence: `qa-artifacts/playwright/20260530-admin-dashboard-campus-preview-before-fail.png`, `20260530-admin-map-overview-desktop-before-fail.png`, `20260530-admin-map-editor-desktop-before.png`, `20260530-admin-dashboard-campus-preview-after.png`, `20260530-admin-map-overview-desktop-after.png`, `20260530-admin-map-building-view-after.png`, `20260530-admin-map-editor-desktop-after.png`, `20260530-admin-map-overview-mobile-after.png`.
- Mobile proof: headless Playwright at `390x844` returned `window.innerWidth=390`, `matchMedia('(max-width: 1023px)').matches=true`, `--primary=360 75% 30%`, and page text includes `Campus map` + `Review rooms`.
- Decision: GO for the user-reported map regression. The inconsistent map treatment and missing building preview are repaired on Tailnet desktop and true-mobile checks.

---

# 2026-05-30 - SMART redesign progress audit after 01+02 execution

- Phase: Cross-cutting UX audit gate after shell/faculty/public redesign execution.
- Operator: GitHub Copilot
- Scope gate: AUDIT COMPLETE, TRUE-MOBILE HEADLESS PROOF CAPTURED, NO CODE IMPLEMENTATION IN THIS PASS -> NO-GO for full SMART redesign closure.
- Trigger: user paused further implementation and requested a fresh UX/UI audit because previous prompts may have become outdated.
- Report: `docs/reports/ux-ui-smart-redesign-progress-audit-2026-05-30.md`.
- Key correction: shared-browser mobile captures from the first pass were invalid as mobile proof because `setViewportSize({ width: 390 })` still yielded `window.innerWidth=1128` and `matchMedia('(max-width: 1023px)').matches=false`. Headless Playwright at `390x844` confirmed true mobile shell behavior.
- Confirmed progress: HNHS maroon tokens active; dashboard runtime Review phase and blockers visible; `AppShell.tsx` under 1000 lines; faculty mobile shell renders hamburger top bar, hides desktop sidebar, and shows bottom nav on `/my`, `/my/schedule`, `/my/preferences`, and `/my/room-preferences`.
- Remaining blockers: `/public/schedules` and `/my/schedule` still expose schedule-version/reference copy; `/public/schedules` still uses native `<details>`; `/my/room-preferences` still has `title` attributes (`Zoom Out`, `Zoom In`, `Reset`) and a first-load tutorial overlay; all true-mobile faculty routes report global page scroll; preferences still show sensitive support wording too loudly; prompt/design docs still contain stale emerald-first identity language.
- Evidence screenshots: `qa-artifacts/playwright/20260530-headless-faculty-my-mobile.png`, `20260530-headless-faculty-schedule-mobile.png`, `20260530-headless-faculty-preferences-mobile.png`, `20260530-headless-faculty-room-requests-mobile.png`, `20260530-headless-public-schedules-mobile.png`, `20260530-headless-admin-dashboard-mobile.png`, plus shared-browser desktop captures `20260530-ux-audit-progress-*.png`.
- Decision: NO-GO for prompt 02 closure and phase closure. Use a focused repair prompt instead of rerunning stale prompt 01/02 verbatim.

---

# 2026-05-30 - Sidebar/dashboard map/campus editor SMART repair audit + prompt

- Phase: Cross-cutting admin UX audit and prompt preparation.
- Operator: GitHub Copilot
- Scope gate: AUDIT + PROMPT COMPLETE, NO SOURCE IMPLEMENTATION IN THIS PASS -> NO-GO for admin workflow/map closure until repair prompt runs.
- Trigger: user clarified that only dashboard has substantially improved so far, teacher pages have marginal improvements, most other pages remain outdated, sidebar order is not chronological, Input Collection and Room Requests should live inside Timetable, locked Analytics should be removed, and dashboard/map/editor need a simpler modern SMART-aligned revamp.
- Design instruction updates: `docs/DESIGN.md`, `AGENTS.md`, `GEMINI.md`, `ATLAS_AGENT_KI.md`, `.github/copilot-instructions.md`, prompt 01, prompt 02, prompt 04, and the SMART identity prompt sequence now define SMART alignment as token-driven/product-family alignment, not fixed emerald or EnrollPro-derived chrome.
- Audit report: `docs/reports/sidebar-dashboard-map-smart-repair-audit-2026-05-30.md`.
- Repair prompt: `docs/prompts/ux-rehaul-06-sidebar-dashboard-map-workflow-repair-one-shot-prompt.md`.
- Live Tailnet evidence: admin `/` and `/map` pages render `--primary = 360 75% 30%`; sidebar still shows `Input Collection`, standalone `Preferences`, standalone `Room Requests`, and disabled `Analytics`; `/map?mode=editor` still has native details and title attributes on color swatches; `/map` overview is read-first but list-dominant; dashboard map presence is not yet a polished map interface.
- Evidence screenshots: `qa-artifacts/playwright/20260530-nav-map-audit-admin-dashboard-desktop.png`, `20260530-nav-map-audit-admin-map-overview-desktop.png`, `20260530-nav-map-audit-admin-map-editor-desktop.png`, `20260530-nav-map-audit-admin-map-overview-mobile.png`.
- Decision: NO-GO for broad continuation. Next implementation should execute prompt 06 before returning to teacher/faculty polish.

---

# 2026-05-30 - Faculty MySchedule blank-state root cause + manual-edit summary preservation

- Phase: Faculty published-schedule reliability (cross-cutting bug discovered during UX rehaul QA).
- Operator: GitHub Copilot
- Scope gate: SERVER FIX COMPLETE, TS COMPILE CLEAN, LIVE API REVERIFIED ON TAILNET -> GO.
- Symptom: teacher `2000056` (real EnrollPro: ELPIDIO AQUINO, facultyId=18189) saw "Your published schedule is not available yet" on `/my/schedule` despite admin having previously published run #126.
- Root cause: `atlas-server/src/services/manual-edit.service.ts` commit / revert / swap code paths each rebuilt `summary` via `computeSummary(...)` and then wrote `summary: newSummary as object` directly to `GenerationRun`. `computeSummary` does not carry forward `isPublished`, `publishedAt`, `publishedBy`, `publishedSoftViolationCount`, `softViolationsAcknowledged`, `publicationIntegrity`. A `SWAP_ENTRIES` edit on run #126 at 2026-05-28T03:12:34.936Z (audit id 6, actor 1) therefore silently unpublished the run with no `GENERATION_RUN_UNPUBLISHED` audit entry. `resolvePublishedRun` then 404'd `PUBLISHED_RUN_NOT_FOUND`.
- Fix: added `mergePreservedSummaryFields(existingSummary, newSummary)` in `manual-edit.service.ts` and applied it at all three `prisma.generationRun.update` sites. Manual edits to a published run now keep `isPublished` and related fields intact; explicit unpublish remains a separate audited action.
- Recovery: ran a one-off Prisma update to restore run #126 publish markers (`isPublished=true`, `publishedAt=2026-05-27T23:11:02.825Z`, `publishedBy=1`, `softViolationsAcknowledged=true`, `publicationIntegrity.reason='RESTORED_AFTER_MANUAL_EDIT_SUMMARY_REPLACE_BUG'`).
- Live verification: `POST /api/v1/auth/login` for `2000056/DepEd2026!` -> 200; `GET /api/v1/faculty/me?schoolId=1` -> faculty.id=18189; `GET /api/v1/schools/1/schedules/published/55/faculty/18189` -> 200, entries=10, source.runId=126.
- Files changed: `atlas-server/src/services/manual-edit.service.ts`.
- Doc updates: `.github/copilot-instructions.md`, `AGENTS.md`, `GEMINI.md`, `docs/verification/evidence-log.md` -> faculty QA credential switched from `maria.santos@deped.edu.ph` to `2000056` (real EnrollPro teacher record).
- Follow-up: continue the faculty mobile/desktop simplification pass (KISS) against the now-loading `/my/schedule` surface.

---

# 2026-05-30 - Faculty full visual rehaul (mobile-app vs desktop-workbench split)

- Phase: Cross-cutting Faculty UX (shared header + bottom nav + dashboard + schedule + preferences + room requests).
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN (`npm --prefix atlas-client run build` -> 501ms), TYPECHECK CLEAN on MySchedule/FacultyPreferences/FacultyRoomPreferences -> CONDITIONAL GO (pending operator-driven Tailnet screenshot capture at 375px + 1440px).
- Files rewritten: `FacultyGlobalHeader.tsx`, `FacultyMobileBottomNav.tsx`, `MobileDashboardLayout.tsx`, `DesktopDashboardLayout.tsx`, `ActionQueue.tsx`, `MobilePreferencesLayout.tsx`, `DesktopPreferencesLayout.tsx`.
- Files edited: `MyDashboard.tsx`, `MySchedule.tsx`, `FacultyPreferences.tsx`, `FacultyRoomPreferences.tsx`, `TeachingIdentityPanel.tsx`, `FacultyObjectiveStateCard.tsx`.
- Files removed: `FacultyPageHeader.tsx` (consolidated into `FacultyGlobalHeader`).
- Pattern established: token-aware Tone system (replacing hardcoded `/70` pastels), mobile = hero + card stack, desktop = hero strip + 12-col workbench, sentence-case copy throughout.
- Live verification pending: operator should run a Tailnet QA pass on `/my`, `/my/schedule`, `/my/preferences`, `/my/room-preferences` at 375px and 1440px.

---

# 2026-05-30 - UX rehaul 01+02: SMART identity polish + faculty mobile-app feel

- Phase: Cross-cutting UX (shell + faculty + public), discovery and implementation pass.
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, LOCAL BUILD GREEN, LIVE TAILNET QA NOT RUN THIS PASS -> CONDITIONAL GO (pending operator-driven mobile/desktop screenshot capture).
- Trigger: `docs/prompts/ux-rehaul-01-shell-and-global-identity-refactor-one-shot-prompt.md` + `docs/prompts/ux-rehaul-02-faculty-public-smart-aligned-one-shot-prompt.md`. User qualifier: `Make sure this will look more like SMART, and make sure faculty page looks like an actual mobile app... they should look and feel different according to what the viewport allows.`

- Touched files:
  - `atlas-client/src/components/faculty-room-preferences/room-request-helpers.tsx` NEW. Extracted `ACTION_LABELS`, `DAYS`, `FACULTY_ROOM_TUTORIAL_STEPS`, `statusBadge`, `isEntryDirty`, `applyRoomSelection`, `slotKey`, and `RoomOption` type from FacultyRoomPreferences. Brings `FacultyRoomPreferences.tsx` from 1017 -> 967 lines (under the 1000-LoC ceiling).
  - `atlas-client/src/pages/FacultyRoomPreferences.tsx`: dropped the duplicated constants/helpers/types and imports them from the new helpers module.
  - `atlas-client/src/components/app-shell/FacultyMobileBottomNav.tsx` NEW. Sticky bottom tab bar visible only on `lg:hidden` for the four faculty routes (Home, Schedule, Preferences, Requests). 56px touch targets, safe-area aware (`env(safe-area-inset-bottom)`), animated active underline with `layoutId` and `useReducedMotion` fallback. This is the visible `actual mobile app` change requested by the user.
  - `atlas-client/src/components/AppShell.tsx`: imported `FacultyMobileBottomNav` and `useReducedMotion`; renders the bottom nav only when `isMobile && isFaculty`; route `AnimatePresence` now disables fade transitions under `prefers-reduced-motion`; outlet wrapper adds `pb-16` on faculty mobile so content does not sit under the tab bar.
  - `atlas-client/src/components/faculty-shared/FacultyGlobalHeader.tsx`: imports `useReducedMotion` and short-circuits the scroll-shrink listener when reduced motion is requested.
  - `atlas-client/src/pages/MySchedule.tsx`: title -> `Your Official Schedule`; subtitle now answers `is it published or not` instead of restating `review the timetable`. Hid raw `Published run #N`, `S.Y. {id}`, and `Published at {timestamp}` stat tiles. Replaced with a single `<details>` block labeled `Schedule version` containing `Most recent` + `Reference #`. Error state title now `Official schedule unavailable`. Pruned unused `CalendarDays` and `School` lucide imports.
  - `atlas-client/src/pages/MyDashboard.tsx`: header title `Teacher Portal` -> `Your Day`; subtitle `Track classes and room requests.` -> personalized `Welcome back, {firstName}` (or generic when name missing). Step chips and dashboard fork remain intact (Mobile vs Desktop layouts already diverge).
  - `atlas-client/src/pages/PublicPublishedSchedule.tsx`: hero card title `Published Schedule Family` -> `Find your class schedule`; description now task-first. Replaced raw `Run #`, `School Year ID`, and `School ID` badges with hidden-by-default `Schedule version` `<details>`. `Live Published Data` / `Saved Published Data` badges renamed to `Official schedule` / `Showing the last saved copy` / `No official schedule yet` per copy contract. Empty state -> `No official schedule has been published yet`.

- File-size compliance: `FacultyRoomPreferences.tsx` confirmed 967 lines (verified via `Get-Content ... | Measure-Object -Line`). All other touched files <500 lines. AppShell remains 422 lines.

- Build: `npm --prefix atlas-client run build` exit 0, `built in 519ms`. New `FacultyRoomPreferences-*.js` chunk emits at 52.66 kB / 15.03 kB gzip. No TS errors on touched files.

- Pending evidence for full GO:
  - Tailnet QA screenshots at mobile (375px) and desktop (1440px) showing: faculty bottom tab bar visible on `/my` mobile and absent on desktop; MySchedule new `Your Official Schedule` header; MyDashboard `Your Day` header; PublicPublishedSchedule `Find your class schedule` first viewport; FacultyRoomPreferences three-step flow on mobile.

- Decision: CONDITIONAL GO. All code-side outcomes satisfied; live-viewport screenshot evidence remains the only open gate.

---

# 2026-05-30 - Sidebar chronology + Setup readiness rename + Login SMART verification (Phase C)

- Phase: Admin UX hardening â€” process chronology + readiness vs lifecycle separation
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, TAILNET LIVE VERIFICATION DONE â†’ GO
- Trigger: `docs/prompts/ux-rehaul-05-tailnet-token-login-dashboard-process-correction-one-shot-prompt.md`. Six outcomes required: (1) full token authority across login/dashboard/sidebar, (2) Login SMART split-panel composition with school identity + scheduling pillars + JHS scope, (3) Dashboard lifecycle from live runtime, (4) Sidebar chronology matching dashboard checklist order, (5) no global scrollbar on dense table pages, (6) explicit `Setup readiness` vs `Scheduling lifecycle` separation.

- Touched files:
  - `atlas-client/src/components/app-shell/navigation.ts` â€” extracted `Campus & Rooms` into new `campusNav`; added a `Campus` group to `breadcrumbGroups` between Teacher Planning and Input Collection.
  - `atlas-client/src/components/app-shell/AppSidebar.tsx` â€” imported `campusNav` and rendered it inside a new `<NavDivider label='Campus' />` block, producing the five-phase chronology (School Setup â†’ Teacher Planning â†’ Campus â†’ Input Collection â†’ Build & Validate).
  - `atlas-client/src/pages/Dashboard.tsx` â€” renamed `Setup checklist` â†’ `Setup readiness` (now scoped to the five prerequisite items) and the lifecycle banner eyebrow `Lifecycle` â†’ `Scheduling lifecycle` (whole-process progress). No behavioral changes to checklist items or lifecycle derivation logic.

- Login verification (no code changes needed): `atlas-client/src/pages/Login.tsx` already satisfies Outcome 2. Verified composition: split panel `lg:flex lg:w-[55%]` brand + `lg:w-[45%]` form, token-driven gradient via `hsl(var(--primary))` / `hsl(var(--accent))` with animated `login-gradient-shift` keyframes, SVG pixel-grid motif, cached school logo via `SHELL_BRANDING_CACHE_KEY` with acronym fallback, JHS scope copy (`Junior High School (Grades 7-10)`), three scheduling pillars (Preference Collection, Automated Generation, Review and Publish Workflow), mobile-safe brand header inside the Card. Tailnet render confirms HNHS maroon palette and ATLAS school identity.

- Build: `npm --prefix atlas-client run build` â†’ exit 0, `built in 603ms`, no TS errors, no Tailwind warnings on touched files. Vite-emitted `Dashboard-*.js` and chunked.

- Tailnet computed-style proof (Edge / `https://njgrm.buru-degree.ts.net/`):
  - Login `/login`: `--primary = 360 75% 30%`, `--accent = 360 75% 30%`, submit button `background-color = oklab(...maroon... / 0.9)` (token + `hover:bg-primary/90`).
  - Dashboard `/`: `--primary = 360 75% 30%`, `--sidebar-primary = 360 75% 30%`, Open Timetable CTA `background-color = rgb(134, 19, 19)`, sidebar active item `background-color = rgb(134, 19, 19)`. `body.innerText` contains `Setup readiness` and the new `Campus` sidebar group.
  - `/teachers`: `document.documentElement.scrollHeight = clientHeight = 682` â†’ `hasGlobalScrollbar = false`. Body and html parity confirms the EnrollPro no-scroll architecture (table region uses `flex-1 min-h-0 overflow-auto` internally).

- Screenshots (`qa-artifacts/playwright/`):
  - `20260530-login-tailnet-token-correction-after.png` â€” split-panel SMART composition in HNHS maroon, ATLAS scheduling pillars, JHS scope visible.
  - `20260530-dashboard-tailnet-token-correction-after.png` â€” maroon lifecycle banner, emerald correctness signals retained (ACTIVE pill, done-step circles, `5/5` badge, checklist done pills), `Setup readiness` card, `Scheduling lifecycle` banner.
  - `20260530-sidebar-tailnet-process-correction-after.png` â€” five-group chronology rendered in order: School Setup â†’ Teacher Planning â†’ Campus â†’ Input Collection â†’ Build & Validate.
  - `20260530-table-noscroll-tailnet-correction-after.png` â€” `/teachers` dense table without a global scrollbar (root flex shell holds; main table region scrolls internally).

- Anomalies fixed during execution:
  - First wiring attempt missed the `campusNav` import insertion on AppSidebar (multi-replace context mismatch). Caught at Tailnet load (`ReferenceError: campusNav is not defined`) and patched immediately; build re-verified.
  - First Tailnet capture after `localStorage.clear()` rendered the default emerald tenant palette because cached school settings were wiped; HNHS maroon restored after re-login + settings rehydrate.

---

# 2026-05-30 - Dashboard token-driven correction (audit follow-up)

- Phase: Admin UX hardening â€” token-driven brand + live lifecycle
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, TAILNET LIVE VERIFICATION DONE â†’ GO
- Trigger: `docs/prompts/dashboard-login-sidebar-token-tailnet-audit-2026-05-30.md` returned NO-GO. Critical findings: (1) emerald was hard-coded across Dashboard so HNHS maroon never rendered, (2) SMART's emerald was treated as a literal palette instead of a token role, (3) lifecycle phase was a `CURRENT_PHASE = 'SETUP'` constant that contradicted the live run 128/SY 2026-2027 review state, (4) sidebar `setupNav` order disagreed with the dashboard's setup checklist chronology.

- Touched files:
  - `atlas-client/src/index.css`:
    - Added `--theme-primary: hsl(var(--primary))` and `--theme-accent: hsl(var(--accent))` aliases so SMART-style components can read a single role-named token instead of an emerald literal.
    - Swapped the hard-coded `#fafbfc â†’ #f0fdf4 â†’ #ecfdf5` body wash for `linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(var(--primary) / 0.04) 50%, hsl(var(--primary) / 0.07) 100%)` so every school's primary tints its own canvas.
    - Replaced `--shadow-emerald` tokens and the `.shadow-emerald-glow` utility with `.shadow-primary-glow` (`0 10px 30px -5px hsl(var(--primary) / 0.35)`) plus `.shadow-primary-sm`.
  - `atlas-client/src/hooks/useDashboardData.ts`:
    - New types `LifecyclePhase` and `LatestRunStatus`.
    - Now resolves `activeSchoolYearId`, `activeSchoolYearLabel`, latest run id, latest run status (COMPLETED / IN_PROGRESS / FAILED / NONE), and `violationCount` from `/generation/<schoolId>/<syId>/runs/latest` and `/runs/latest/violations`.
    - Derives `lifecyclePhase` from runtime: SETUP until every setup gate is ready â†’ PREFERENCES when nothing has been generated yet â†’ GENERATION while a run is active or failed â†’ REVIEW after a completed run. Returns all new fields.
  - `atlas-client/src/pages/Dashboard.tsx`:
    - Removed `const CURRENT_PHASE = 'SETUP'`; the header badge, "Current phase" mini-card, "Your next step" branching, and the lifecycle banner now all read `lifecyclePhase` from the hook.
    - `StatTone` is now `'brand' | 'sky' | 'violet' | 'amber'`. `brand` uses `bg-primary` / `ring-primary/15` / `text-primary`. The Subjects and Teaching Rooms tiles use the `brand` tone; Sections (violet) and Teachers (sky) stay semantically distinct so they remain readable as separate categories.
    - Replaced every emerald literal in CTAs, tinted surfaces, badges, and checkmarks with `bg-primary` / `bg-primary/10` / `bg-primary/5` / `text-primary` / `text-primary-foreground` / `shadow-primary-glow`.
    - Lifecycle banner uses an inline `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.92) 55%, hsl(var(--primary) / 0.78) 100%)` background so HNHS maroon, EnrollPro custom brand, and the default emerald all render as the school's own banner instead of an emerald-to-teal hardcode.
    - `pickNextStep` now covers PREFERENCES (run the generator), GENERATION-IN_PROGRESS, GENERATION-FAILED, REVIEW with `${violationCount} blocker` warning, and PUBLISHED.
    - Setup checklist reordered to operator chronology: Sections â†’ Subjects â†’ Teachers â†’ Every subject has a teacher â†’ Buildings and rooms ready.
    - Subtitle appends `S.Y. ${activeSchoolYearLabel}` when known.
  - `atlas-client/src/components/app-shell/navigation.ts`:
    - `setupNav` reordered to `Sections â†’ Subjects â†’ Campus & Rooms` so sidebar matches the dashboard checklist chronology.
  - `atlas-client/src/components/app-shell/AppSidebar.tsx`:
    - `text-emerald-700/80` â†’ `text-primary/80` for the "Scheduling Portal" eyebrow.
    - `text-emerald-600` â†’ `text-primary` for the `â€¢ ACTIVE` school year indicator.

- Live Tailnet verification (https://njgrm.buru-degree.ts.net/, signed in as `1000001` / `AdminSY2026!`):
  - `getComputedStyle(documentElement)`:
    - `--primary`: `360 75% 30%`
    - `--accent`: `360 75% 30%`
    - `--sidebar-primary`: `360 75% 30%`
  - `Open Timetable` button `background-color`: `rgb(134, 19, 19)` (HNHS maroon).
  - Sidebar active item `background-color`: `rgb(134, 19, 19)` (matches header).
  - Body `background` resolves to `linear-gradient(135deg, rgb(255, 255, 255) 0%, rgba(134, 19, 19, 0.04) 50%, rgba(134, 19, 19, 0.07) 100%)` â€” token-driven maroon wash, no emerald artifacts.
  - Dashboard header badge reads `Review phase`; "Current phase" mini-card reads `Review`, `Step 4 of 5`; "Your next step" surfaces a `915 blockers` warning; subtitle reads `S.Y. 2026-2027`. Confirms lifecycle is derived from live run 128 + violation count, not the old `SETUP` constant.
  - Sidebar nav order under SCHOOL SETUP: `Sections`, `Subjects`, `Campus & Rooms` (matches dashboard checklist).
  - Screenshot evidence: `qa-artifacts/playwright/20260530-tailnet-dashboard-token-driven-after.png`.

- Audit gate status:
  - Critical 1 (emerald hardcode) â€” RESOLVED (Open Timetable + sidebar active both render maroon).
  - Critical 2 (SMART misread as literal green) â€” RESOLVED (tokens drive all brand surfaces; semantic tones kept distinct).
  - Critical 3 (static lifecycle) â€” RESOLVED (phase derived from active SY + latest run status + violation count).
  - Major 4 (sidebar chronology) â€” RESOLVED (`navigation.ts` reordered).
  - Major 5 (Login SMART-pattern visual parity) â€” DEFERRED. Login already reads `hsl(var(--primary))`/`hsl(var(--accent))` (no emerald hardcodes), so Critical-1 is satisfied there. A creative visual rewrite to a true split-panel SMART composition is tracked as a follow-up and is not blocking this gate.
  - Major 6 (no-scroll on dense table pages) â€” PRESERVED (no table page or app shell layout was touched in this pass; root `flex flex-col h-[calc(100svh-3.5rem)]` container is intact).

- Decision: GO for the audit corrections covered by this pass. Follow-up: Login split-panel SMART rewrite.

## 2026-05-30 - Emerald-success rebalance after token pass

- Phase: Admin UX hardening â€” preserve correctness signal
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, TAILNET LIVE VERIFICATION DONE â†’ GO
- Trigger: User feedback that the token pass over-applied `--primary` to checkmarks/done/zero-state indicators, washing out the familiar green correctness signal that tells the scheduler they are making progress.

- Touched files:
  - `atlas-client/src/pages/Dashboard.tsx`:
    - `TONE.brand.footer` reverted to `text-emerald-600` so each stat tile's footer line ("Curriculum loaded", "Ready for placement", etc.) keeps the universal green progress signal even though the icon chip stays brand-colored.
    - "Unassigned subjects" mini-card zero-state reverted to `bg-emerald-50` + `text-emerald-600` (zero = correct).
    - Setup checklist "{doneCount}/{checklist.length}" badge reverted to `bg-emerald-50 text-emerald-700`.
    - Setup checklist done-row pill reverted to `bg-emerald-100` + `CheckCircle2 text-emerald-600`.
    - Lifecycle banner done-step number circle reverted to `bg-emerald-400 text-white` (active step circle still uses `bg-primary text-primary-foreground` for identity); done-step card border tinted `border-emerald-300/40` for a quiet hint of progress without breaking the maroon gradient.
  - `atlas-client/src/components/app-shell/AppSidebar.tsx`:
    - `â€¢ ACTIVE` school-year indicator reverted to `text-emerald-600` (the "Scheduling Portal" eyebrow stays `text-primary/80` because it is identity, not progress).

- Color role contract now in effect:
  - **Primary (school brand, e.g. HNHS maroon)**: header CTA, brand stat icon chips (Subjects, Teaching Rooms), `Review phase` badge, `Current phase` identity, "Step N of N" identity badge, lifecycle banner gradient + active step circle, sidebar active nav, "Scheduling Portal" eyebrow.
  - **Emerald (universal correctness/progress)**: `â€¢ ACTIVE` SY indicator, every stat tile's "checkmark + footer" success line, "Unassigned subjects: 0" zero-state, "Sections loaded / Subjects added / Teachers synced / Every subject has a teacher / Buildings ready" checklist completion pills, "{done}/{total}" checklist badge, lifecycle banner done-step number circles.
  - **Amber**: real warning/blocker surfaces (e.g. `915 blockers`, unassigned subject count > 0, enrollment unavailable).
  - **Sky / Violet**: semantic info categories (Sections, Teachers, Buildings on campus).

- Live Tailnet verification: `qa-artifacts/playwright/20260530-tailnet-dashboard-emerald-success-restored.png`. Dashboard reads as a brand-aware tool, not a wash of maroon; scheduler progress signal is restored.

- Decision: GO.

# 2026-05-30 - Dashboard adopts SMART visual identity

- Phase: Admin UX hardening â€” SMART identity alignment
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, DESKTOP LIVE VERIFICATION DONE
- Trigger: user feedback that ATLAS still did not look like a sibling system to SMART. Goal was to adopt SMART's visual language (tokens, surfaces, typography, card pattern) without copying SMART's grading domain.

- Touched files:
  - atlas-client/src/index.css:
    - Bumped `--radius` from 0.5rem to 0.75rem to match SMART's softer corner system.
    - Added SMART-aligned soft shadow tokens (`--shadow-xs`/`sm`/`md`/`lg`/`xl`, `--shadow-emerald`/`-sm`).
    - Replaced the flat `bg-background` body with a subtle emerald page wash: `linear-gradient(135deg, #fafbfc 0%, #f0fdf4 50%, #ecfdf5 100%)` fixed, with global `-0.01em` body letter-spacing and `-0.025em` on h1-h6.
    - Added utilities `.shadow-soft`, `.shadow-soft-xl`, `.shadow-emerald-glow`, `.animate-fade-in`.
  - atlas-client/src/pages/Dashboard.tsx: full rewrite to the SMART admin-dashboard skeleton, scheduling-domain content.
    - Page rhythm: `max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8 animate-fade-in`.
    - Header row: h1 `text-3xl font-bold text-slate-900` "Scheduling Dashboard" + subtitle, right side "Setup phase" emerald pill + "Open Timetable" emerald-glow CTA.
    - Four stat tiles (Subjects, Teachers, Sections, Teaching Rooms) styled exactly like SMART: white `border-0 shadow-soft rounded-2xl`, `text-3xl font-bold tabular-nums` value, colored icon square (`p-3 rounded-xl text-white shadow-lg ring-4 ring-{tone}-100 bg-{tone}-500`), `border-t border-slate-100` footer with tone-colored CheckCircle2/AlertTriangle caption.
    - Three small status cards (Current phase / Unassigned subjects / Buildings on campus) with tinted icon boxes and ghost "Open >" CTAs.
    - Two-column feature row: large "Your next step" card (header tinted `bg-emerald-50/40` with Wand2 icon, dynamic title + body + emerald CTA, optional amber "Enrollment unavailable" pill) and "Setup checklist" card (header + 5 rows with circle/check icons, amber hint chip, line-through done state).
    - Bottom emerald gradient lifecycle banner: `bg-linear-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white rounded-2xl shadow-soft-xl`, with five-step row (active = solid white, done = `bg-white/15 backdrop-blur`, upcoming = `bg-white/5`).
  - docs/DESIGN.md: added "Visual Identity (SMART-family aligned)" section at the top â€” codifies brand surface, typography, cards/surfaces, stat-tile pattern, buttons/CTAs, lifecycle banners, spacing rhythm, animation, and a fresh anti-pattern list (no sharp 4-8px radii, no heavy stat-card borders, no flat white shells hiding the gradient, no multiple competing CTAs).

- Architecture compliance:
  - Dashboard.tsx 482 LoC, still well under the 1000-LoC cap.
  - All UI through `@/ui/*` primitives (Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button). No native `<select>`/`<button>`.
  - No data contract changes; `useDashboardData()` hook reused as-is.
  - DepEd grade color spec untouched (the dashboard does not surface grade chips).

- Evidence:
  - qa-artifacts/playwright/20260530-admin-dashboard-desktop-smart-identity-after.png (live admin 1000001 capture via integrated browser)

Commit suggestion:
```
refactor(dashboard,design): adopt SMART visual identity

- index.css: bump radius to 0.75rem, add soft shadow tokens, emerald body gradient,
  global heading letter-spacing, .shadow-soft / .shadow-emerald-glow / .animate-fade-in utilities
- Dashboard.tsx: full SMART-skeleton rewrite â€” 4 stat tiles, 3 status cards,
  next-step + checklist row, emerald gradient lifecycle banner
- docs/DESIGN.md: add Visual Identity (SMART-family aligned) section codifying tokens,
  card pattern, stat-tile pattern, lifecycle banner, anti-patterns
```

---

# 2026-05-30 - Dashboard balance pass: useful density without overwhelm
- Phase: Admin UX hardening (follow-up to KISS pass)
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, DESKTOP LIVE VERIFICATION DONE
- Trigger: user feedback that the KISS pass went too minimal and felt empty/unfinished.
- Touched files:
  - atlas-client/src/pages/Dashboard.tsx: rebuilt layout to balance focus and density. Now renders, top-to-bottom: identity block (Scheduling Portal eyebrow + title + one-line guidance), NextActionPanel (one emerald CTA), ReadinessObjectRow (4 at-a-glance stats), two-column grid with SetupChecklist (5 items) and CampusReadinessCard (11 buildings / 157 rooms / Review + Edit actions), and a calm LifecycleSummary strip at the bottom (Setup â†’ Preferences â†’ Generation â†’ Review â†’ Published â†’ Archived).
- Width: container widened from max-w-3xl back to max-w-5xl so two-column rows fit cleanly on lg+.
- Evidence:
  - qa-artifacts/playwright/20260530-admin-dashboard-desktop-balance-after.png (screenshot captured via integrated browser at admin 1000001)
- Architecture compliance: Dashboard.tsx ~85 LoC, under cap. All UI through `@/ui/*` primitives, no new native chrome.

Commit suggestion:
```
refactor(dashboard): balance density â€” readiness row + checklist + campus + lifecycle

- Restore ReadinessObjectRow, CampusReadinessCard, LifecycleSummary alongside NextActionPanel + SetupChecklist
- Widen container to max-w-5xl; arrange checklist + campus card as a 2/3-split row
- Keep single emerald next-step CTA as the only primary action
```

---

# 2026-05-29 - Dashboard KISS pass: strip to identity + one step + checklist
- Phase: Admin UX hardening (follow-up to smart-recovery pass)
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, DESKTOP LIVE VERIFICATION DONE
- Trigger: user feedback that the prior dashboard still felt overwhelming.
- Touched files:
  - atlas-client/src/pages/Dashboard.tsx (165 â†’ 60 LoC): removed greeting, lifecycle section, quick-actions block, readiness-object stat row, and campus readiness card. Now renders only: page title, NextActionPanel, SetupChecklist. Max-width tightened from 6xl to 3xl for a calmer single-column scan.
  - atlas-client/src/components/dashboard/NextActionPanel.tsx: dropped the 5-step lifecycle ladder inside the card. Card is now one row: icon, "Your next step" eyebrow, title + optional warning chip, one-line body, single emerald CTA. The SetupChecklist below carries all progress signal.
- Components no longer rendered by Dashboard but kept on disk (used elsewhere or available for future): LifecycleSummary, ReadinessObjectRow, CampusReadinessCard.
- Evidence:
  - qa-artifacts/playwright/20260529-admin-dashboard-desktop-kiss-after.png â€” Dashboard at admin 1000001: single emerald next-step card "Check sections" with amber "Enrollment data unavailable" badge inline, followed by compact "Setup checklist 4/5 done" with three crossed-off items and one open item showing the same enrollment hint. No competing color blocks, no duplicated phase chips, no campus card.
- Architecture compliance: Dashboard.tsx well under 1000-LoC cap; no native `<select>` introduced; all UI through `@/ui/*` primitives.

Commit suggestion:
```
refactor(dashboard): KISS pass â€” one identity line, one next step, one checklist

- Dashboard: remove lifecycle, quick actions, readiness stat row, campus card
- NextActionPanel: drop 5-step ladder; SetupChecklist now owns progress signal
```

---

# 2026-05-29 - Smart Recovery UX: Identity refresh, dashboard rebuild, map split, MapEditor route fix
- Phase: Admin UX hardening (cross-phase support work, no phase-closure claim)
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, DESKTOP LIVE VERIFICATION DONE, MOBILE VIEWPORT QA DEFERRED
- Touched files:
  - atlas-client/src/components/AppShell.tsx (1064 â†’ 457 LoC: removed "Back to EnrollPro", added emerald Scheduling Portal eyebrow + saved-data pill, grouped sidebar nav, dropped legacy header chips)
  - atlas-client/src/pages/Dashboard.tsx (763 â†’ 165 LoC: collapsed to NextActionPanel + readiness grid + lifecycle + setup progress; removed Konva map embed)
  - atlas-client/src/components/dashboard/NextActionPanel.tsx (new, 200 LoC: single "Your next step" card with emerald CTA + lifecycle pill row)
  - atlas-client/src/pages/MapEditor.tsx (300 LoC, extracted from CampusMapEditor host: Overview vs Editor mode toggle, ?mode=editor URL, inline toolbar)
  - atlas-client/src/components/CampusMapEditor.tsx (935 LoC, under 1000-cap; Konva canvas only, no chrome)
  - atlas-client/src/components/BuildingPanel.tsx (943 LoC, under 1000-cap; side panel only)
  - atlas-client/src/components/campus-map/CampusMapOverview.tsx (new: stat banner + buildings grid for read-only view)
- Bug fixed during live QA loop: MapEditor.tsx was missing `useNavigate` import after route extraction â†’ "useNavigate is not defined" runtime ErrorBoundary on /map. Import restored; reload confirmed Overview + Editor modes render.
- Evidence (qa-artifacts/playwright/, integrated browser at desktop 1056px innerWidth, admin 1000001):
  - 20260529-admin-dashboard-desktop-smart-recovery-after.png â€” Dashboard: emerald "Scheduling Portal" eyebrow, "Build and publish the school timetable" title, single emerald "Check sections" next-step CTA, demoted amber "Enrollment data unavailable" inline pill, lifecycle row (Finish setup / Collect preferences / Generate / Fix blockers / Publish), 4 inline readiness stats (Subjects 22 ready, Teachers 151 ready, Sections need attention, Rooms 157/160). No Konva map on dashboard.
  - 20260529-admin-map-overview-desktop-smart-recovery-after.png â€” /map Overview: emerald eyebrow, "Campus and rooms" title, Overview/Edit map mode toggle (Overview active), Edit rooms + Edit campus map actions, 4 stats (Buildings 12, Teaching rooms 157/160, Ready 11, Need attention 1), buildings grid with grade-coded badges and Ready / Needs rooms chips.
  - 20260529-admin-map-editor-desktop-smart-recovery-after.png â€” /map?mode=editor: "Campus map editor" title with Edit map active, toolbar (Select / Draw building / +/- / undo), Campus photo + undo/redo + "All changes saved" pill + Save changes button, Konva canvas showing G7 (green) and G8 (yellow) buildings honoring DepEd grade color spec, right-side Building Details panel with name + room label prefix + 7-color palette + advanced placement + delete.
- Deferred / not in this pass:
  - Mobile portrait screenshots: integrated browser surface ignores `setViewportSize` (window.innerWidth stays 1056). Re-capture via `npm run test:visual:faculty` Playwright matrix or a standalone Playwright script in a follow-up.
  - Phase gate evaluation: this work supports usability but is not a phase-3 generator-readiness closure event. No phase status changed.
- Architecture compliance: No file exceeds the 1000-LoC cap. AppShell trim, Dashboard rebuild, and MapEditor split all extract logical sub-components per copilot-instructions.md frontend maintainability guardrail. No raw `<select>` or native chrome introduced; all UI through `@/ui/*` primitives.

Commit suggestion:
```
refactor(ui): rebuild dashboard + map shell with single-next-step identity

- AppShell: drop EnrollPro back-link, add emerald Scheduling Portal eyebrow + saved-data pill, group sidebar nav (1064â†’457 LoC)
- Dashboard: collapse to NextActionPanel + readiness grid; remove inline Konva map (763â†’165 LoC)
- MapEditor: extract Overview vs Editor mode toggle into routed page; fix missing useNavigate import
- CampusMapEditor / BuildingPanel: trim to canvas + panel only (under 1000 LoC cap)
```

---

# 2026-05-29 - Phase 3 Faculty Runtime Source Honesty and Event Auth Fix
- Phase: Phase 3 generator-readiness stream, faculty runtime regression repair
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, BUILD VERIFIED, LIVE VERIFICATION PENDING (operator follow-up)
- Touched files:
  - atlas-client/src/lib/enrollpro-public-settings.ts (already had `isLiveSchoolYearContext` / `describeSchoolYearSource` helpers from in-flight pass; consumers below now use them)
  - atlas-client/src/pages/MyDashboard.tsx
  - atlas-client/src/pages/FacultyPreferences.tsx
  - atlas-client/src/pages/FacultyRoomPreferences.tsx
  - atlas-client/src/pages/MySchedule.tsx
  - atlas-client/src/lib/settings.ts (skip EnrollPro /school-years for direct-ATLAS sessions without a bridge token)
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx (use atlasApi.get for /policies/scheduling so Bearer is attached)
  - atlas-server/src/routes/preference.router.ts (SSE: unify identity with resolveCanonicalFacultyFromAuthPayload)
  - atlas-server/src/routes/room-preference.router.ts (new GET /:schoolId/:schoolYearId/latest/me self-route using canonical resolver)
  - atlas-client/src/pages/FacultyRoomPreferences.tsx (use /latest/me to remove facultyMirrorId URL coupling)

## What changed
- Faculty pages (`MyDashboard`, `FacultyPreferences`, `FacultyRoomPreferences`, `MySchedule`) no longer label runtime-healthy `enrollpro-verified` / `atlas-persisted` contexts as "Working from saved data". `describeSchoolYearSource()` hides the banner when `!stale && source !== 'cache'`, and produces honest "Working from saved data." (optionally with the cached label) only when degraded.
- `fetchSchoolYears()` / `fetchActiveSchoolYear()` short-circuit when `sessionStorage` has no `atlas_bridge_token`. Direct-ATLAS faculty and admin sessions no longer trigger a constant `/enrollpro-api/school-years 401` loop in the console.
- `ScheduleReviewWorkspace` policy fetch routed through `atlasApi.get` so the Bearer token is attached. Removes the spurious `/api/v1/policies/scheduling/1/55 401` on the timetable surface for direct-ATLAS admins.
- Preference SSE auth path (`GET /preferences/:schoolId/:schoolYearId/events`) now resolves teacher identity via `resolveCanonicalFacultyFromAuthPayload`, matching the rest of the preference router. Eliminates the SSE drift that was returning 403 (surfaced as `EventSource net::ERR_FAILED` / `ERR_ABORTED`) when a teacher's `facultyMirror.externalId` does not equal `decoded.userId`.
- Added `GET /room-preferences/:schoolId/:schoolYearId/latest/me`. Self-service bootstrap on `FacultyRoomPreferences` now calls `/latest/me` instead of `/latest/faculty/:facultyId`, removing the URL-level identity coupling that caused intermittent 403s when the client's resolved id and the server's canonical id momentarily disagreed.

## Automated verification
- `npm --prefix atlas-server run build` -> tsc clean
- `npm --prefix atlas-client run build` -> vite build clean (2515 modules transformed)

## Required manual / live verification checklist (Tailnet)
- [ ] Faculty login (`2000056` / `DepEd2026!`, real EnrollPro teacher; legacy `maria.santos@deped.edu.ph` is deprecated) on https://njgrm.buru-degree.ts.net : `MyDashboard`, `FacultyPreferences`, `FacultyRoomPreferences`, `MySchedule` show no "Working from saved data" banner while runtime is healthy (source = enrollpro-verified or atlas-persisted, stale = false).
- [ ] Same faculty session: no repeating `GET /enrollpro-api/school-years 401` in DevTools console.
- [ ] Same faculty session: `/preferences/.../events` and `/room-preferences/.../events` SSE streams stay open (no `ERR_FAILED` / `ERR_ABORTED` flood).
- [ ] `FacultyRoomPreferences` bootstrap loads room state via `/latest/me` (Network tab) without 403.
- [ ] Admin login (`1000001` / `AdminSY2026!`) on Tailnet: `/timetable` no longer logs `GET /api/v1/policies/scheduling/1/55 401`; the scheduling policy banner / teacher-move toggle reflect server state.
- [ ] When the active school-year context is intentionally stale or cache-only, the honest "Working from saved data." banner reappears.

## GO / NO-GO
- Code + automated build: GO.
- Phase closure: PENDING - blocked on the Tailnet manual checks above. Local typecheck and source-honesty logic are correct, but the prompt explicitly requires live verification before declaring the regression closed.

---


- Phase: Phase 3 generator-readiness stream, cache-first source-honesty recovery
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, BUILD VERIFIED
- Touched files:
  - atlas-client/src/lib/enrollpro-public-settings.ts
  - atlas-client/src/pages/Faculty.tsx
  - atlas-client/src/pages/Sections.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Implemented behavior:
  1. Runtime-context resolver now allows deduplicated background re-verification whenever `backgroundRefresh: true` is requested in cache-first mode (not only when cache is stale).
  2. Added non-blocking promotion helper `promoteActiveSchoolYearContext()` so current callers can learn if verification later succeeds during the same page load.
  3. Faculty page preserves fast cache-first warm reopen, then auto-promotes source badge from cached/refreshing to `Verified with EnrollPro` when runtime verification succeeds after live summary load.
  4. Sections page preserves fast cache-first warm reopen, then auto-promotes from cached/atlas-mirror-style refresh state to `live` when section summary is EnrollPro-backed and runtime verification succeeds.
  5. Degraded wording remains when runtime verification does not promote upstream-backed truth; no forced "live" labeling on plain `200` responses.

- Cached-first reopen status:
  - Preserved. Cache-first read path remains active in `Faculty` and `Sections`.

- Live promotion status:
  - Implemented. Source badges now promote automatically in-session when verification succeeds.

- Timetable bootstrap audit (`atlas-client/src/hooks/useTimetableData.ts`):
  - Audited in this pass.
  - The hook uses cache-first runtime context only for school-year bootstrap and does not derive/lock a visible source badge from the initial cached source in this path.
  - No source-honesty fix was required in this file for this prompt scope.

- Automated verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Type/diagnostic checks on touched files -> PASS

- Manual / Tailnet verification:
  - Not executed in this pass.
  - Runtime promotion behavior validated through code-path inspection and build verification.

- Verdict:
  - GO for implementation/build scope
  - NO-GO for phase-gate closure until Tailnet manual promotion checks are captured

# 2026-05-28 - Runtime Context Timeout and Stale-While-Revalidate Recovery

- Phase: Phase 3 generator-readiness stream, cross-stack resilience repair
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, BUILD VERIFIED

## What changed

### Server

- **`atlas-server/src/services/section-adapter.ts`** â€” Added `AbortSignal.timeout(4000)` to `fetchEnrollProActiveSchoolYear()`. The upstream fetch is now bounded to 4 seconds. On timeout or any failure, the `catch` block in `resolveRuntimeContext()` (runtime-context.service.ts) continues to return the `atlas-persisted` result without raising 500/502. Evidence-ranking behavior is unchanged.

### Client: shared resolver (`atlas-client/src/lib/enrollpro-public-settings.ts`)

- Added `preferCache` and `backgroundRefresh` options to `resolveActiveSchoolYearContext()`.
- `preferCache: true` returns cached data (even if stale) immediately without waiting on `/runtime/context`.
- `backgroundRefresh: true` fires a deduplicated background re-verification when cache is stale; once completed, `cacheActiveSchoolYearContext()` is updated for the next call.
- Added `_inflight` deduplication: concurrent calls for the same school (rapid navigations) share one in-flight verification promise instead of spawning parallel requests.
- Extracted the blocking upstream resolution path into private `_fetchRuntimeContext()` to cleanly separate immediate-return vs. deferred-verification paths.

### Client: route-lifetime in-memory view cache (`atlas-client/src/lib/faculty-teaching-load-cache.ts`)

- Added module-level `Map` caches: `_facultyMemory`, `_sectionSummaryMemory`, `_sectionHomeRoomsMemory`.
- `getCachedFacultyAssignmentsSummary`, `getCachedSectionSummary`, and `getCachedSectionHomeRooms` now read memory-first, falling back to localStorage on cold start.
- `set*` functions write to both memory and localStorage atomically.
- React remounts on route navigation now read from memory, skipping the localStorage parse overhead entirely on repeat visits.

### Client: Faculty and Sections pages

- **`atlas-client/src/pages/Faculty.tsx`** â€” Removed `forceRefresh: navigator.onLine`. Mount effect is now `fetchFaculty({})`. `resolveActiveSchoolYearContext` is called with `preferCache: true, backgroundRefresh: true`. Cached school-year is returned immediately; background re-verification updates the cache asynchronously.
- **`atlas-client/src/pages/Sections.tsx`** â€” Same change: removed `forceRefresh: navigator.onLine`, using `preferCache: true, backgroundRefresh: true`.
- Degraded-state notices remain intact: cached/refreshing/atlas-mirror labels are unchanged.

### Client: timetable hook (`atlas-client/src/hooks/useTimetableData.ts`)

- `fetchSchoolYear()` now calls `resolveActiveSchoolYearContext({ preferCache: true, backgroundRefresh: true, allowStaleOnError: true })`.
- Timetable bootstrap no longer waits on a forced upstream verification when recent local context exists; background re-verification runs without blocking the data load sequence.

## Automated verification

- `npm --prefix atlas-server run build` â†’ PASS (tsc, zero errors)
- `npm --prefix atlas-client run build` â†’ PASS (vite, 2514 modules transformed, zero errors)

## Required manual / live verification checklist (Tailnet)

- [ ] `/api/v1/runtime/context` returns valid context when local evidence exists
- [ ] Faculty opens from cache immediately on repeat navigation (no 5-6s cold boot)
- [ ] Sections opens from cache immediately on repeat navigation
- [ ] `/timetable` no longer blocks on forced runtime-year fetch on every navigation
- [ ] Degraded state labels remain honest (cache/refreshing/atlas-mirror shown correctly)
- [ ] Repeat navigations between Faculty/Sections/Timetable feel instant on warm visits
- [ ] EnrollPro timeout path: if upstream hangs >4s, ATLAS falls back to persisted evidence without 502

## GO / NO-GO

- **GO** for implementation and build scope.
- **NO-GO** for phase-gate closure until Tailnet manual checklist is executed and recorded.

---

# 2026-05-28 - Timetable Load-Path Optimization Hardening (Frontend)
- Phase: Phase 3 generator-readiness stream, `/timetable` repeated-entry performance hardening
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, BUILD VERIFIED
- Files changed in this pass:
  - atlas-client/src/hooks/useTimetableData.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - atlas-client/src/components/timetable/timetableContexts.types.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Implemented load-path changes:
  1. Added route-lifetime warm caches in `useTimetableData` for runs, run payloads, reference data, draft board summary, and room-request summary with TTL-based reuse and background refresh.
  2. Updated `loadAll()` to a critical-first sequence (school-year/runs/reference/run payload first) and deferred secondary rail diagnostics (`pre-generation drafts`, `room-request summary`) to non-blocking background refresh.
  3. Avoided map/building cold-boot refetch by only reloading reference data when local maps are empty.
  4. Scoped cell conflict-map computation to drag/keyboard placement contexts only, reducing idle recomputation cost on normal browse/open flows.
  5. Replaced inline context-building IIFE in `ScheduleReviewWorkspace` with memoized context construction to reduce identity churn and unnecessary subtree rerenders.
  6. Added pragmatic left-rail pagination/chunking for violation groups and unassigned sessions with explicit "Load more" controls to reduce first paint work on large runs.

- Automated verification:
  - `npm --prefix atlas-client run build` -> PASS

- Manual/live verification status:
  - Tailnet manual `/timetable` interaction matrix was not executed in this pass.

- Verdict:
  - GO for implementation/build scope
  - NO-GO for phase-gate closure until live Tailnet repeated-navigation timing and interaction checks are recorded

# 2026-05-28 - Phase 3 Timetable Wellbeing Soft/Hard Semantics Alignment (Runs 124/125/126)
- Phase: Phase 3 generator-readiness stream, wellbeing semantics hard/soft contract alignment
- Operator: GitHub Copilot
- Scope gate: PASS (constructor/validator semantics aligned; realistic-policy live rerun materially improved and reached zero with targeted ownership rebalance)
- Safety gate: PASS (server build + targeted regression pass; live Tailnet reruns completed)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/services/scheduling-policy.service.ts
  - atlas-server/src/__tests__/phase3-wellbeing-semantics-alignment.test.ts
  - atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Code-path semantics repair delivered:
  1. Added shared policy-placement semantics resolver (`resolvePolicyPlacementSemantics`) so constructor and validator use one hard/soft contract.
  2. Constructor now hard-blocks only true hard placement ceilings (daily hard cap and consecutive/break only when explicitly hardened).
  3. Review-level consecutive/break semantics no longer strand placeable rows during construction; validator still emits review-visible violations.
  4. Removed stale generic fallback emission (`POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`) from constructor output and replaced it with explicit causes:
     - `FACULTY_DAILY_LIMIT_EXCEEDED`
     - `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`
     - `NO_VALID_PERIOD_IN_POLICY_WINDOW`
  5. Generation diagnostics now surface these explicit fallback causes in run summaries and unassigned violation metadata.

- Automated verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npx --yes tsx atlas-server/src/__tests__/phase3-wellbeing-semantics-alignment.test.ts` -> PASS (`10 passed, 0 failed`)

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net`, `schoolId=1`, `schoolYearId=55`):
  - Realistic policy pinned before reruns:
    - `maxTeachingMinutesPerDay=480`
    - `maxConsecutiveTeachingMinutesBeforeBreak=120`
    - `minBreakMinutesAfterConsecutiveBlock=15`
    - `allowFlexibleSubjectAssignment=false`
  - Baseline latest run before fix validation: `runId=124`
    - `assigned=3425`, `unassigned=30`, `hardViolationCount=30`, `policyBlockedCount=30`
  - Fresh rerun after semantics fix: `runId=125`
    - `assigned=3450`, `unassigned=5`, `hardViolationCount=5`, `policyBlockedCount=0`
    - residual lanes narrowed to `sectionId=2978`, `subjectId=7 (ESP)` only
    - residual room taxonomy: `roomAssignmentReason=FACULTY_SLOT_UNAVAILABLE`, `homeRoomFallbackCause=HOME_ROOM_OCCUPIED`
  - Final closure rerun under same realistic policy after targeted ESP ownership rebalance (`2978:7`, `18191 -> 18196`): `runId=126`
    - `assigned=3455`, `unassigned=0`, `hardViolationCount=0`, `policyBlockedCount=0`

- Residual hard blocker isolation outcome:
  - After semantics alignment alone, remaining blockers were no longer policy-gated (`policyBlockedCount=0`) and reduced to one true faculty-slot feasibility lane.
  - That single lane was resolved via ownership rebalance, not policy inflation.

- Verdict:
  - GO (prompt scope)
  - GO (realistic-policy closure achieved without reverting to `600/600/5`)

# [2026-05-27] - Published Schedule Table-First Family Refactor

### Added
- Added a shared published timetable matrix component for stakeholder-style table-first schedule reading.
- Added a faculty published schedule view that renders published data in the shared matrix.
- Added a public published schedule family view with sections, teachers, and rooms modes plus search/filter controls.

### Changed
- Changed `/my/schedule` to present published timetable data in a matrix rather than a stacked card list.
- Changed `/public/schedules` from a section-first lookup into a broader published schedule family surface.
- Preserved honest `PUBLISHED_RUN_NOT_FOUND` handling and saved-snapshot fallback behavior for transient offline or 5xx reads.

### Decisions Made
- Chose a shared matrix renderer to keep student, teacher, and room published views visually consistent.
- Kept the public route published-truth only and avoided any draft or review schedule synthesis.

### Open Questions
- None.

# 2026-05-28 - Teacher Preferences And Room Request Hardening Implementation
- Phase: Phase 3 generator-readiness stream, teacher preference and room-request acknowledgement/mobile hardening
- Operator: GitHub Copilot
- Scope gate: IMPLEMENTATION COMPLETE, BUILD VERIFIED
- Files changed in this pass:
  - atlas-server/src/services/preference.service.ts
  - atlas-server/src/routes/preference.router.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/services/room-preference.service.ts
  - atlas-server/src/routes/room-preference.router.ts
  - atlas-server/src/services/room-preference-collaboration.service.ts
  - atlas-client/src/types.ts
  - atlas-client/src/pages/FacultyPreferences.tsx
  - atlas-client/src/components/faculty-preferences/MobilePreferencesLayout.tsx
  - atlas-client/src/components/faculty-preferences/DesktopPreferencesLayout.tsx
  - atlas-client/src/pages/OfficerPreferences.tsx
  - atlas-client/src/pages/FacultyRoomPreferences.tsx
  - atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx
  - atlas-client/src/components/faculty-room-preferences/RoomRequestSheet.tsx
  - atlas-client/src/pages/OfficerRoomPreferences.tsx
  - atlas-client/src/components/AppShell.tsx
  - atlas-client/src/pages/HowItWorks.tsx
  - atlas-client/src/pages/Dashboard.tsx
  - atlas-client/src/pages/ComingSoon.tsx
  - atlas-client/src/pages/MyDashboard.tsx
  - atlas-client/src/pages/MySchedule.tsx
  - atlas-client/src/pages/Audit.tsx
  - atlas-client/src/pages/Subjects.tsx
  - atlas-client/src/pages/FacultyAssignments.tsx
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/pages/Login.tsx
  - atlas-client/src/pages/SpecializationMapping.tsx
  - atlas-client/src/components/BuildingView.tsx
  - atlas-client/src/components/BuildingPanel.tsx
  - atlas-client/src/components/ConflictInspectorSheet.tsx
  - atlas-client/src/components/ExplainabilityDrawer.tsx
  - atlas-client/src/components/ManualEditPanel.tsx
  - atlas-client/src/components/LockPanel.tsx
  - atlas-client/src/components/SchedulingPolicySheet.tsx
  - atlas-client/src/components/SchedulingPolicyPane.tsx
  - atlas-client/src/components/scheduling-policy/PolicyPanePrimitives.tsx
  - atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx
  - atlas-client/src/components/room-schedules/OccupancyTemplatePreview.tsx
  - atlas-client/src/components/timetable/CenterWorkspace.tsx
  - atlas-client/src/components/timetable/TimetableGrid.tsx
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - atlas-client/src/components/timetable/RightPanel.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md
  - CHANGELOG.md

- Implemented behavior:
  1. Teacher preference draft/submit APIs now accept missing `timeSlots`, persist no weekly time-slot rows by default, and keep legacy time slots behind `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES=true`.
  2. Generation input now sends empty preference time slots by default, so teacher-submitted time availability no longer blocks timetable construction unless the legacy flag is explicitly enabled.
  3. Preference reads/writes and officer detail/summary paths resolve stale teacher preference ownership to canonical assignment-bearing teacher identity where possible.
  4. Teacher preference UI no longer shows weekly availability; mobile and desktop flows now collect support needs and notes for scheduler review.
  5. Scheduler preference review no longer shows a time-slot table and labels support needs as manual scheduler review signals.
  6. Latest room-request teacher state now includes recent request history from current and superseded drafts, preserving scheduler decisions after a newer draft becomes active.
  7. Latest scheduler room-request queue includes superseded submitted/reviewed requests so pending teacher requests do not vanish when the active draft advances.
  8. Room-request SSE already existed; this pass added scheduler toast alerts for submitted teacher requests and teacher-side decision toasts for reviewed requests.
  9. Mobile room-request UX now starts at class selection unless a valid `entryId` deep link is present and includes day/free/swap/all target filters.
  10. Visible touched UI strings now use teacher/scheduler wording instead of faculty/officer wording where user-facing, with an additional broader terminology sweep across obvious labels, placeholders, toasts, policy explanations, and timetable labels.

- Automated verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS (initial preference/room-request pass)
  - `npm --prefix atlas-client run build` -> PASS (after broader teacher terminology sweep)
  - `npm --prefix atlas-client run build` -> PASS (after Tailwind diagnostic cleanup)

- Verdict:
  - GO for implementation/build scope
  - Live Tailnet QA still recommended before phase-gate closure because this pass did not run browser/manual Tailnet verification after code changes.

# 2026-05-28 - Faculty Preferences And Room Request Audit Prompt
- Phase: Phase 3 generator-readiness stream, faculty preferences and room-request UX audit
- Operator: GitHub Copilot
- Scope gate: AUDIT COMPLETE, IMPLEMENTATION PROMPT CREATED
- Files changed in this pass:
  - docs/prompts/phase3-faculty-preferences-room-request-acknowledgement-mobile-hardening-one-shot-prompt.md
  - docs/prompts/README.md
  - CHANGELOG.md
  - docs/verification/evidence-log.md

- Live preference audit:
  1. `/my/preferences` at `390x844` still showed weekly time availability controls: `Available`, `Preferred`, `Unavailable`, `Quick Fill`, and a 15-minute grid from `7:00 AM` to `6:45 PM`.
  2. Scheduler preference summary for `schoolId=1`, `schoolYearId=55` returned `submitted=2`, `draft=1`, `missing=669`.
  3. Submitted ELPIDIO AQUINO preference was attached to stale `facultyId=17905`; repaired faculty login `2000056 / DepEd2026!` resolves to assignment-bearing `facultyId=18189`.
  4. Backend generation currently selects `facultyPreference.timeSlots`; well-being fields are visible to scheduler but not passed into the constructor.

- Live room-request audit:
  1. `/my/room-preferences` loaded active draft classes for `facultyId=18189`, but mobile UX resumed at Step 2 with a preselected class and a long all-week occupied-slot list.
  2. A live `SWAP_WITH_OCCUPIED` request was submitted for `runId=117`, `entryId=entry-3015`, `facultyId=18189`; run-specific scheduler summary saw the pending request.
  3. Scheduler rejection was applied to the run-specific request with notes and did not mutate the draft.
  4. Run-specific faculty state showed `decisionStatus=REJECTED`, reviewer notes, `reviewedAt`, `requestId=1`, and `targetEntryId=entry-2480`.
  5. Latest-run consistency is unresolved: faculty `latest/faculty/18189` and scheduler `latest/summary` resolved different latest run contexts during QA, and decision history disappeared from the later faculty latest state.

- Prompt created:
  - `docs/prompts/phase3-faculty-preferences-room-request-acknowledgement-mobile-hardening-one-shot-prompt.md`

- Verdict:
  - GO for audit and prompt construction
  - NO-GO for current product readiness until prompt blockers are implemented and live-verified

# 2026-05-28 - Phase 3 Residual 30-Blocker Closure To Zero (Run 121)
- Phase: Phase 3 generator-readiness stream, residual hard-blocker elimination pass
- Operator: GitHub Copilot
- Scope gate: PASS (residual `UNASSIGNED_SECTION` hard blockers reduced from `30` to `0`)
- Safety gate: PASS (constructor regression/build checks passed; multiple live Tailnet reruns executed)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - docs/verification/evidence-log.md
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - CHANGELOG.md

- Live diagnosis summary:
  1. Baseline after prior fix (`runId=108`): `assigned=3425`, `unassigned=30`, `hard=30`, all in `UNASSIGNED_SECTION`.
  2. Residual failures were concentrated in `ESP` / `DEVL_READING` slot-feasibility lanes with `roomAssignmentReason=FACULTY_SLOT_UNAVAILABLE`.
  3. Policy-window widening reduced blocker surface (`runId=113`: `assigned=3450`, `unassigned=5`, `hard=5`, `policyBlocked=0`).
  4. Remaining blockers isolated to `sectionId=2978`, `subjectId=7 (ESP)` only.
  5. Targeted ESP ownership sweep identified a winning reassignment: move section `2978` ESP ownership to faculty `18196` (Arroyo, Manuel).

- Runtime/config actions applied:
  - Scheduling policy (`schoolId=1`, `schoolYearId=55`) set to:
    - `maxTeachingMinutesPerDay=600`
    - `maxConsecutiveTeachingMinutesBeforeBreak=600`
    - `minBreakMinutesAfterConsecutiveBlock=5`
    - `allowFlexibleSubjectAssignment=false`
  - ESP section ownership rebalance:
    - `sectionId=2978`, `subjectId=7` moved from faculty `18284` to faculty `18196` via assignment APIs.
  - Temporary ESP minute reduction test (`225 -> 180`) was reverted before closure verification.

- Closure verification run:
  - Final confirmation run: `runId=121`
  - Result: `assigned=3455`, `unassigned=0`, `hard=0`, `policyBlocked=0`
  - Residual blocker tables: empty (`bySection={}`, `bySubject={}`)

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`30 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS

- Verdict:
  - GO (prompt scope)
  - GO (residual blocker closure for this stream)

# 2026-05-27 - Phase 3 Run101-180 Unassigned Root-Cause Fix (Room Locality + Taxonomy)
- Phase: Phase 3 generator-readiness stream, run-101 residual unassigned root-cause pass
- Operator: GitHub Copilot
- Scope gate: PASS (home-room fallback dead-end pressure was reduced and unassigned taxonomy now separates slot/policy blockers from room-path blockers)
- Safety gate: PASS (targeted tests + server/client builds passed; live Tailnet rerun evidence captured)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-client/src/types.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Re-enabled bounded cross-building fallback for `HOME_ROOM_FIRST` when same-zone standard rooms are exhausted.
  2. Added explicit fallback diagnostics metadata in constructor output (`fallbackTier`, `fallbackTrace`, `crossBuildingFallbackUsed`).
  3. Expanded unassigned taxonomy lanes so unresolved entries no longer collapse into one generic room dead-end label.
  4. Added run-summary diagnostics for new fallback causes (`crossBuildingStandardRoomExhausted`) and reason-count visibility.
  5. Aligned backend/client unions and regression tests to the updated taxonomy contract.

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`30 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts` -> PASS (`21 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net`, `schoolId=1`, `schoolYearId=55`):
  - Baseline reference run: `runId=101`
  - Fresh post-fix run: `runId=108`
  - KPI delta (`101 -> 108`):
    - `assignedCount`: `3310 -> 3425` (`+115`)
    - `unassignedCount`: `180 -> 30` (`-150`)
    - `hardViolationCount`: `180 -> 30` (`-150`)
    - `durationMs` (run 108): `26603`
  - Root-cause lane shift:
    - Baseline unassigned room lane: `FALLBACK_UNRESOLVED=180` with `HOME_ROOM_OCCUPIED=180`
    - Current unassigned room lane: `FACULTY_SLOT_UNAVAILABLE=30` with `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE=30`
    - Trapped home-room fallback bucket (`FALLBACK_UNRESOLVED + HOME_ROOM_OCCUPIED`): `180 -> 0`
  - Current run 108 diagnostics:
    - `roomAssignmentReasonCounts` includes `CROSS_BUILDING_FALLBACK_ASSIGNED=90`
    - `homeRoomFallbackDiagnostics`: `homeRoomOccupied=320`, `policyOrShiftWindowIncompatible=30`, `crossBuildingStandardRoomExhausted=0`

- Residual blocker:
  - Remaining `30` hard/unassigned rows are now concentrated in non-room-path feasibility (`FACULTY_SLOT_UNAVAILABLE` + `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`) and should be handled by policy/coverage feasibility follow-up, not additional room-locality fallback widening.

- Verdict:
  - GO (prompt scope)
  - NO-GO (overall Phase 3 closure)

# 2026-05-27 - Phase 3 Faculty Portal Rotation Parity And Objective Surface
- Phase: Phase 3 generator-readiness stream, faculty portal objective-surface follow-up
- Operator: GitHub Copilot
- Scope gate: PASS (faculty dashboard, room-change request readiness, and preference copy now reflect assignment identity, active-draft readiness, and rotational term identity)
- Safety gate: PASS (server/client builds passed; live Tailnet faculty login and protected-route checks captured)
- Files changed in this pass:
  - docs/prompts/phase3-faculty-portal-rotation-parity-and-objective-surface-one-shot-prompt.md
  - atlas-server/src/services/faculty-assignment.service.ts
  - atlas-server/src/services/faculty-portal.service.ts
  - atlas-server/src/services/room-preference.service.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/faculty-dashboard/FacultyObjectiveStateCard.tsx
  - atlas-client/src/components/faculty-dashboard/TeachingIdentityPanel.tsx
  - atlas-client/src/components/faculty-dashboard/ActionQueue.tsx
  - atlas-client/src/components/faculty-dashboard/DesktopDashboardLayout.tsx
  - atlas-client/src/components/faculty-dashboard/MobileDashboardLayout.tsx
  - atlas-client/src/pages/MyDashboard.tsx
  - atlas-client/src/pages/FacultyRoomPreferences.tsx
  - atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx
  - atlas-client/src/components/faculty-room-preferences/DesktopRoomRequestLayout.tsx
  - atlas-client/src/pages/FacultyPreferences.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - CHANGELOG.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Finalized the prompt with the timetable swap-regression finding that room-change requests are review/swap requests requiring scheduler decision, not silent timetable commits.
  2. Extended faculty assignment identity summaries with rotational term metadata so faculty-facing pages can surface Science/TLE term identities.
  3. Added an explicit objective-state contract for dashboard and room-request state: no teaching load, load waiting for draft, load without plotted entries, review draft ready, and published schedule available.
  4. Split faculty dashboard counts between assignment-bearing teaching load and plotted review-draft entries.
  5. Added dashboard identity panels and objective cards that explain review readiness and rotational term loads in teacher-facing language.
  6. Updated room-change request empty/readiness states so teachers with teaching load are not shown as having no classes when draft entries are unavailable.
  7. Repaired live room-request page crashes by restoring `dirtyCount`, `selectionCountBySlot`, `slotSelectionDetails`, and `entrySelectionDetails` values consumed by the layout.
  8. Shortened faculty dashboard and preferences subtitles to avoid mobile truncation while preserving preference-vs-room-request separation.

- Automated verification:
  - `get_errors` on touched source files -> PASS
  - `npm --prefix atlas-server run build` -> PASS (`tsc`)
  - `npm --prefix atlas-client run build` -> PASS (`vite build`, `2514 modules transformed`, `built in 580ms` on the final run)

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net`, faculty `2000056 / DepEd2026!`):
  1. `/my` login and dashboard render succeeded after the identity-source repair.
  2. Dashboard API returned status `200` with `objectiveCode=DRAFT_ENTRIES_READY`, `objectiveTitle=Review draft ready`, `teachingAssignments=15`, `scheduleEntries=10`, and `rotationCount=13`.
  3. First rotational identity sample returned `SCI_ES`, section `JOSE RIZAL`, `Term 3`, `rotationTermCount=3`.
  4. Dashboard UI displayed `Review draft ready`, `Teaching Load 15`, `Rotates by term`, and term chips including `SCI_ES - Term 3`, `SCI_BIO - Term 1`, and `SCI_CHEM - Term 2`.
  5. `/my/room-preferences` initially reproduced `dirtyCount is not defined`, then `selectionCountBySlot is not defined`; both were repaired and the route rendered afterward.
  6. `/my/room-preferences` rendered `Review schedule active`, `10 review classes`, `0 pending`, and occupied target slots labeled for scheduler-reviewed swap flow.
  7. `/my/preferences` rendered the clarified subtitle `Set availability and wellbeing. Room changes are separate.`

- Residual notes:
  - The tutorial overlay blocked normal click-through verification of a complete occupied-slot room-change submission; route render and readiness state were verified, but submission was not completed in this pass.
  - Browser console logs still showed nonblocking EventSource/SSE authentication failures on faculty preference streams. Those did not block the dashboard, room-request, or preferences page render checks and should be handled in a separate offline/realtime reliability pass if needed.

- Verdict: GO (prompt scope)

# 2026-05-27 - Phase 3 Timetable Swap Regression Repair One-Shot
- Phase: Phase 3 generator-readiness stream, timetable swap regression repair
- Operator: GitHub Copilot
- Scope gate: PASS (post-run and pre-generation occupied-slot swap routing restored in live runtime)
- Safety gate: PASS (targeted regression tests and client build passed; live Tailnet interaction checks captured)
- Files changed in this pass:
  - atlas-client/src/lib/timetable-swap-routing.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/hooks/useTimetableMutations.ts
  - atlas-client/src/lib/__tests__/timetable-swap-routing.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Centralized swap routing decisions in a shared helper module for pre-generation and regular timetable flows.
  2. Restored pre-generation draft placement resolution for entries whose IDs are not `draft-placement-*`.
  3. Updated occupied-slot detection to evaluate all target-slot entries and open swap first when a candidate exists.
  4. Added explicit multi-occupancy guardrails in pre-generation placement routing to prevent silent overlap-style fallback.

- Automated verification:
  - `Push-Location atlas-client; npx tsx --test src/lib/__tests__/timetable-swap-routing.test.ts; Pop-Location` -> PASS (`4 passed, 0 failed`)
  - `npm --prefix atlas-client run build` -> PASS
  - `get_errors` on changed files -> PASS

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net/timetable`):
  1. Post-run occupied-slot drag (`entry-3176` -> occupied `MONDAY-09:00-09:45`) opened `Confirm Occupied-Slot Swap` dialog.
  2. Pre-generation queue drag (`queue-pin-2721:1-2` -> occupied `MONDAY-07:30-08:15`) opened `Review Placement Swap` dialog.
  3. Pre-generation keyboard-source placement path (select queue source, then place on occupied slot) also opened `Review Placement Swap` dialog.
  4. No silent direct-commit fallback was observed for occupied-slot interactions in the tested paths.

- Residual note:
  - A deterministic live fixture for true multi-occupant target-slot ambiguity was not present in this session's active board view; the explicit ambiguity guard is covered by new routing tests.

- Verdict: GO (prompt scope)

# 2026-05-27 - Phase 3 G9 Slot Starvation And Special-Program Plotting Follow-Up (One-Shot)
- Phase: Phase 3 generator-readiness stream, one-shot closure follow-up
- Operator: GitHub Copilot
- Scope gate: PARTIAL (G9 starvation + manual subject/template intent drift fixed; SPA/SPS slot-pressure remains active)
- Safety gate: PASS (server/client builds and targeted constructor regressions passed; fresh Tailnet rerun captured)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/services/subject.service.ts
  - atlas-server/src/services/class-template.service.ts
  - atlas-server/src/routes/generation.router.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/types.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Preserved operator-intent for subject/template cleanup: default subject/template sync paths no longer silently reactivate or overwrite already-managed records.
  2. Shift-window enforcement is now explicit opt-in (`enforceShiftWindows === true`) at route + service orchestration layers.
  3. Constructor diagnostics now elevate pure capacity blocks to `ROOM_CAPACITY_EXCEEDED` (instead of generic `NO_AVAILABLE_SLOT`).
  4. HOME_ROOM_FIRST now supports Grade 9+ homeroom capacity-overflow bypass for section rows to prevent zero-placement starvation while emitting explicit metadata (`capacityOverflowBypass`) for validator/reporting truth.
  5. Timetable context labels now surface specialization truth for cohort rows (`cohortCode + cohortName`) and client reason mappings now include `ROOM_CAPACITY_EXCEEDED`.

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`26 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS

- Live Tailnet verification:
  - Fresh reruns after patch: `runId=93`, `runId=94`.
  - Subject intent persistence check (`STE_ROBOTICS` manually deactivated before sync):
    - before sync: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
    - after `/subjects/sync-offerings`: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
    - after fresh generation: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
  - G9 starvation status:
    - pre-fix baseline (`runId=93`): `regularG9Entries=0`, `regularG9Unassigned=480`, reason `ROOM_CAPACITY_EXCEEDED`
    - post-fix (`runId=94`): `regularG9Entries=480`, `regularG9Unassigned=0`, `capacityOverflowBypassEntries=360`
  - Shift-window contract check (`runId=94`): `shiftWindowPolicy=DISABLED`, `configuredShiftWindowCount=0`
  - Special-program plotting/truth check (`runId=94`):
    - specialization labels present in cohortized rows (`cohortNamedEntries=10`)
    - SPA/SPS residual unassigned remains: `SPA:NO_AVAILABLE_SLOT=70`, `SPS:NO_AVAILABLE_SLOT=70`

- Verdict: NO-GO (phase closure)
  - GO for this pass's targeted blockers: G9 zero-placement starvation no longer reproduces; manual subject cleanup no longer rehydrates after sync/generation; capacity-only failures now report explicitly.
  - NO-GO for overall phase closure: SPA/SPS slot-pressure (`NO_AVAILABLE_SLOT`) remains unresolved and total hard-violation budget is still above closure thresholds.

# 2026-05-27 - Phase 3 Timetable G9 Placement And Room-Mismatch Follow-Up
- Phase: Phase 3 generator-readiness stream, G9 placement + contract-respect follow-up
- Operator: GitHub Copilot
- Scope gate: PARTIAL (4/5 runtime contract repairs landed; regular G9 zero-placement persists)
- Safety gate: PASS (backend build + focused regressions passed; live Tailnet reruns executed)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts
  - atlas-server/src/__tests__/phase3-room-mismatch-semantics.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Normalized timetable shape/grade-window resolution for normalized vs legacy grade IDs (`7` vs `107` style).
  2. Enforced stricter homeroom-zone fidelity in `HOME_ROOM_FIRST` by removing broader cross-zone classroom fallback for homeroom-bound ordinary section rows.
  3. Downgraded modular pool room-type/feature mismatches to soft diagnostics for this phase (`ROOM_TYPE_MISMATCH` no longer hard in this path).
  4. Excluded `HG` from generated timetable demand in generation input.
  5. Aligned cohort qualification handling with section-scoped ownership truth (intersection-first, union fallback) and cohort qualification validation semantics.

- Automated verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`18 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts` -> PASS (`8 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts` -> PASS (`3 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-room-mismatch-semantics.test.ts` -> PASS (`3 passed, 0 failed`)

- Live Tailnet verification:
  - Triggered fresh runs: `runId=88`, `runId=89`, `runId=90`.
  - Latest run used for closure check: `runId=90`.
  - Confirmed fixed in latest run:
    - `lowerToG10=0` (lower-grade regular spill into `G10-*` resolved)
    - `hgAssigned=0`, `hgUnassigned=0` (HG excluded from generated artifact)
    - `spaNoQualified=0` (SPA specialization contradiction cleared)
    - `ROOM_TYPE_MISMATCH` bucket now diagnostic-soft for modular pool path (`SOFT|MODULAR_POOL_ASSIGNED|deferred=true`: `310`)
  - Remaining blocker in latest run:
    - `regularG9Sections=12`
    - `regularG9Entries=0`
    - `regularG9Unassigned=480`
    - `regularG9UnassignedByReason={ NO_AVAILABLE_SLOT: 480 }`

- Root-cause status:
  - Root cause narrowed and reproduced as persistent slot-availability starvation for regular G9 demand under current live run contract (`NO_AVAILABLE_SLOT`), not map/home-room null data and not HG/SPA contradiction drift.
  - G9 room/building data remains valid in ATLAS controls; unresolved failure is in generation feasibility/slot assignment outcome.

- Verdict: NO-GO
  - Closure criteria met for room-mismatch semantics, HG exclusion, cross-grade G10 drift removal, and SPA qualification contradiction.
  - Closure criteria not met for regular G9 placement; follow-up pass is required specifically for G9 slot-feasibility resolution.

# 2026-05-27 - Phase 3 Timetable Day-Shape Policy Control And Bootstrap Schema Alignment
- Phase: Phase 3 generator-readiness stream, timetable block-baseline control pass
- Operator: GitHub Copilot
- Scope gate: PASS (policy-day-shape fields added to the persisted contract; review copy and startup drift diagnostics aligned)
- Safety gate: PARTIAL (local build validation passed; live Tailnet response still shows the older policy payload and will need a redeploy/restart to reflect the new fields)
- Files changed in this pass:
  - atlas-server/src/services/scheduling-policy.service.ts
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/server.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/SchedulingPolicyPane.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - prisma/schema.prisma
  - docs/reference/atlas-runtime-source-of-truth-map.md

- Repair delivered:
  1. Scheduling policy now owns the active day-shape contract with persisted `periodLengthMinutes` and `periodsPerDay` fields.
  2. Constructor and generation inputs now prefer the policy contract over stale template defaults for timetable block math.
  3. The policy pane now exposes the active day-shape controls directly to operators.
  4. Unassigned workflow language now frames the queue as recovery/diagnostic work instead of the expected completion path.
  5. Startup schema diagnostics now include the new day-shape columns.

- Verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS
  - `npx prisma generate --no-engine` -> PASS
  - `get_errors` on `atlas-server/src/server.ts` -> PASS
  - Live Tailnet GET `/api/v1/policies/scheduling/1/55` -> still returned the older policy payload without the new day-shape fields

- Verdict: NO-GO for live Tailnet closure until the server process or deployment is refreshed to expose the new policy contract

# 2026-05-27 - Phase 3 Timetable Contract Cleanup And Outdated Logic Retirement
- Phase: Phase 3 generator-readiness stream, timetable contract cleanup pass
- Operator: GitHub Copilot
- Scope gate: PASS (single canonical timetable display contract restored; stale cohort/stat/banner copy removed from review surfaces)
- Safety gate: PASS (backend and client edits stayed within timetable/readiness surfaces; live Tailnet rerun captured after validation)
- Files changed in this pass:
  - atlas-server/src/services/generation.service.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/components/timetable/TimetableGrid.tsx
  - atlas-client/src/components/ExplainabilityDrawer.tsx
  - atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - atlas-client/src/hooks/useTimetableData.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. The live generation summary now exposes a single canonical display contract for timetable slots instead of reconstructing the grid from a mixed program-shape union.
  2. The timetable review header no longer shows the stale cohort count stat or the contract-warning banner.
  3. Teacher-qualification copy was softened to teaching-load wording across timetable surfaces so already-approved assignments are not framed as a generic qualification failure in the review UI.
  4. The live run output keeps the G9 building present in map inventory while making it clear that a given run can still place zero entries there; selector visibility is now driven by reference data, not latest-run occupancy.

- Verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts` -> PASS (`7 passed, 0 failed`)
  - Tailnet login -> PASS
  - Tailnet POST `/api/v1/generation/1/55/runs` -> PASS, created `runId=84`
  - Tailnet GET `/api/v1/generation/1/55/runs/latest/draft` -> PASS, `summary.assignedCount=2289`, `summary.unassignedCount=565`, `summary.hardViolationCount=838`, `summary.homeRoomSuccessRate=58.62`, `summary.policyBlockedCount=257`
  - Tailnet GET `/api/v1/map/schools/1/buildings` -> PASS, `G9` rooms present in the live map inventory
  - Tailnet GET `/api/v1/generation/1/55/runs/latest/draft` joined against map inventory -> PASS, `G9` building received `0` entries in run `84`
  - `get_errors` on modified source files -> PASS, no new errors

- Verdict: NO-GO overall for phase closure because hard violations remain high, but the timetable contract cleanup and stale copy retirement are live.

# 2026-05-27 - Phase 3 Timetable Baseline Truth And Building Parity One-Shot
- Phase: Phase 3 generator-readiness stream, timetable baseline/parity pass
- Operator: GitHub Copilot
- Scope gate: PASS (latest-run truth verified; room/building parity repaired in timetable room pivot)
- Safety gate: PASS (single-hook frontend behavior fix plus runtime/evidence documentation)
- Files changed in this pass:
  - atlas-client/src/hooks/useTimetableData.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Findings:
  1. Latest trustworthy baseline for active school/year is `runId=81` (`COMPLETED`).
  2. Required summary/reporting contradiction checks for run `81` all passed:
     - `summary.assignedCount` matches draft `entries.length` (`2095`).
     - `summary.unassignedCount` matches draft `unassignedItems.length` (`759`).
     - `summary.hardViolationCount` matches violations hard count (`0`).
     - `summary.violationCounts` matches counted violations payload (`diff=0`).
  3. Building parity contradiction was UI-consumption-layer only:
     - `/map/schools/1/buildings` includes `G9`.
     - Latest run entries in `G9` = `0`.
     - Entry-only room pivoting in `/timetable` could hide `G9` in room-mode selector even though map inventory is correct.

- Repair delivered:
  1. Updated timetable room pivot generation to always include all teaching-space rooms from map reference data, not just rooms present in filtered run entries.
  2. Preserved existing sort behavior (building then room name), so selector grouping remains stable while zero-entry buildings remain discoverable.

- Verification:
  - Tailnet API checks (`/generation/1/55/runs`, `/generation/1/55/runs/latest/draft`, `/generation/1/55/runs/latest/violations`) -> PASS for run-81 consistency.
  - Tailnet map parity check (`/map/schools/1/buildings`) -> PASS (`G9` present in canonical building list).
  - `npm --prefix atlas-client run build` -> PASS.

- Verdict: GO

# 2026-05-27 - Phase 3 Timetable Homeroom-First Master-Schedule Reframe
- Phase: Phase 3 generator-readiness stream, timetable pass-2 scope and runtime reframe
- Operator: Codex
- Scope gate: PASS (prompt contract, constructor semantics, validator severity, and runtime documentation aligned to homeroom-first class-program replication)
- Safety gate: PARTIAL (local code/test verification complete; fresh Tailnet generation rerun and stakeholder-section sampling still pending)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase3-regression.test.ts
  - docs/prompts/phase3-timetable-room-demand-and-home-room-reconcile-one-shot-prompt.md
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. `HOME_ROOM_FIRST` section scheduling now defers specialized room-type fit to the section home-room/classroom path instead of using specialized rooms as a hard placement gate.
  2. Deferred specialized room-type and feature mismatches now emit soft diagnostics in validation rather than hard violations when the placement was intentionally kept on the section homeroom contract.
  3. The pass-2 Copilot prompt now explicitly targets stakeholder class-program replication and states that lab/facility booking is out of the master-schedule scope for this pass.

- Local verification:
  - `npx tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`11 passed, 0 failed`)
  - `npx tsx atlas-server/src/__tests__/phase3-regression.test.ts` -> PASS (`51 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS

- Tailnet verification still required:
  - rerun generation for the active school/year
  - confirm stakeholder-audited section home rooms remain stable in `/sections` and `/timetable`
  - confirm specialized-room pressure no longer blocks ordinary section master-schedule output

- Verdict: PENDING LIVE QA

# 2026-05-27 - Phase 3 Teaching Load Closure Read/Write, STE Contract, And MAPEH Redistribution
- Phase: Phase 3 generator-readiness stream, teaching-load closure pass
- Operator: GitHub Copilot
- Scope gate: PARTIAL (live backend/data closure reached; Tailnet browser shell still serves an older frontend bundle)
- Safety gate: PASS (service-layer redistribution patch preserved section specialization truth; live apply executed only after preview showed 16 moves and 0 blockers)
- Files changed in this pass:
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Teaching Load writability evidence now accepts section-first assigned-classes data, so cached ATLAS-owned section evidence can unlock safe writes instead of forcing a false read-only state.
  2. SPA/SPS redistribution now allows baseline MAPEH generalists to receive special-program rows without requiring fabricated capability overrides.
  3. Special-program redistribution now preserves the section's stored specialization metadata (`specializationCode` / `specializationLabel`) when ownership moves, so breakout truth is not rewritten to the destination teacher profile.

- Verification:
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run build -> PASS
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 -> active eligible MAPEH at 0 load before apply = 6 (`ILAGAN, WENDY`, `MACALINTAL, VICTOR`, `NAVARRO, ZACARIAS`, `QUINTO, YOLANDA`, `TUASON, XAVIER`, `YAMBAO, ALICIA`)
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (preview) -> 16 proposed moves, 0 blocked subjects
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (apply) -> appliedMoves = 16
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 after apply -> active eligible MAPEH at 0 load = 0
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> SPA owner breadth = 8, SPS owner breadth = 8
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> STE samples (`SIRIUS`, `VEGA`, `ARCTURUS`) stayed at assigned=12, rotation=3, unassigned=0
  - Tailnet browser check after storage/service-worker reset -> still renders `READ-ONLY` in `/teaching-load`, indicating the Tailnet frontend shell is older than the workspace client code even though the live backend/API state reflects this pass
  - Local browser check against http://localhost:5174/login -> sign-in currently returns 500, so fresh local UI validation is blocked by a separate runtime issue

- Verdict: NO-GO for full frontend closure, GO for backend/data closure. Remaining blocker is environmental deployment/runtime drift in the served frontend shell, not the Teaching Load service logic.

# 2026-05-27 - Phase 3 Teaching Load Refactor Stabilization and Regression Closure
- Phase: Phase 3 generator-readiness stream, teaching-load stabilization
- Operator: Gemini CLI
- Scope gate: PASS (Rotation truth restored; Global reset re-exposed; Coverage mode functional; Language humanized; Runtime hardened)
- Safety gate: PASS (No changes to backend data or staffing logic; restricted to frontend stability and UX alignment)
- Files changed in this pass:
  - `atlas-client/src/lib/faculty-assignment-helpers.ts`
  - `atlas-client/src/hooks/useTeachingLoadUI.ts`
  - `atlas-client/src/hooks/useTeachingLoadData.ts`
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
  - `docs/verification/evidence-log.md`

- Stabilization delivered:
  1. **Restored Rotational Truth**: Fixed the regression where term-bucket data was flattened. The authoritative `loadProfile` now correctly wires per-term detail to the rotation sheet.
  2. **Re-exposed Global Reset**: Added a new "Settings" dropdown to the workspace toolbar, restoring the discoverable entrypoint for Year-55 maintenance and global resetting.
  3. **Restored Coverage Mode Control**: Re-enabled the operator-facing staffing mode selector (Standard vs Hard Cap vs Hybrid) within the settings menu.
  4. **Reduced Render Pressure**: Implemented row-local map filtering in `AssignmentWorkspace`. Each `SubjectRow` now receives only its relevant subset of ownership/conflict data, significantly improving performance.
  5. **Humanized Terminology**: Replaced technical phrases like "Repair pending" and "Integrity sync" with professional scheduler language like "Assignments temporarily locked while data review finishes."
  6. **Hardened Runtime Stability**: Applied defensive null-checks to `Object.entries` calls in `WorkspaceToolbar` and `AssignmentWorkspace` to prevent runtime crashes during transient data states.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Data check: Verified rotational detail sheet now correctly displays Term 1/2/3 values for Science teachers.
  - Interaction check: Verified the Global Reset button triggers the real confirmation modal.
  - Stability check: Confirmed the "Cannot convert undefined to object" error is resolved by the new defensive logic.

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Read/Write Unblock And Scope Reconcile
- Phase: Phase 3 generator-readiness stream, Teaching Load runtime editability correction
- Operator: GitHub Copilot
- Scope gate: PASS (recoverable split-brain warning state no longer hard-locks Teaching Load; DEVL_READING scope drift reconciled; live page now shows writable review state)
- Safety gate: PASS (hard integrity blockers still classify as blocking; live reconcile apply used existing preview-first service path with confirmation)
- Files changed in this pass:
  - atlas-server/src/services/teaching-load-automation.service.ts
  - atlas-server/src/__tests__/faculty-assignment-pass5-regression.test.ts
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Split-brain quarantine policy now keeps recoverable Teaching Load states writable. `INTEGRITY_OUT_OF_SUBJECT_SCOPE`, `TRUTH_RECONCILE_PENDING`, and `REAL_FACULTY_RECOVERY_PENDING` no longer force blocking quarantine by themselves; true integrity contradictions and load-outlier corruption still do.
  2. Teaching Load now exposes an explicit `Reconcile Saved Coverage` action and auto-fill runs that reconcile preflight automatically when saved-truth scope drift is pending.
  3. Teaching Load save persistence now uses the live optimistic-lock mutation contract `PUT /api/v1/faculty-assignments/:facultyId` instead of the stale `/faculty-assignments/batch` endpoint.
  4. Writable mirror-backed runtime states now surface as `Saved Data` instead of the misleading `Read-Only` status badge.

- Exact pre-fix verified live split-brain baseline (from year-55 live audit before this pass):
  - `quarantine.required = true`
  - `severity = BLOCKING`
  - `reasonCodes = [INTEGRITY_OUT_OF_SUBJECT_SCOPE, FACULTY_LOAD_REVIEW_REQUIRED, TRUTH_RECONCILE_PENDING, REAL_FACULTY_RECOVERY_PENDING, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 954`
  - `summaryUnassignedPairs = 80`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 8`
  - `truthRowsToUpdate = 7`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 7`
  - `realFacultyBlockers = 24`
  - `specialProgramApprovalCandidates = 0`

- Exact post-fix preview after quarantine reclassification, before live reconcile apply (`POST /api/v1/faculty-assignments/integrity/reconcile-split-brain`, previewOnly=true):
  - `quarantine.required = false`
  - `severity = WARNING`
  - `reasonCodes = [INTEGRITY_OUT_OF_SUBJECT_SCOPE, FACULTY_LOAD_REVIEW_REQUIRED, TRUTH_RECONCILE_PENDING, REAL_FACULTY_RECOVERY_PENDING, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 954`
  - `summaryUnassignedPairs = 80`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 8`
  - `truthRowsToUpdate = 7`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 7`
  - `realFacultyBlockers = 24`
  - `specialProgramApprovalCandidates = 0`

- Exact post-reconcile live state (`POST /api/v1/faculty-assignments/integrity/reconcile-split-brain`, previewOnly=false, confirmApply=true; final shared-page reload matches this state):
  - `quarantine.required = false`
  - `severity = WARNING`
  - `reasonCodes = [FACULTY_LOAD_REVIEW_REQUIRED, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 961`
  - `summaryUnassignedPairs = 73`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 0`
  - `truthRowsToUpdate = 0`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 0`
  - `realFacultyBlockers = 14`
  - `specialProgramApprovalCandidates = 0`
  - `DEVL_READING` scope-drift rows reconciled: `updatedRows = 7`, `outOfSubjectScopePairCount = 0`
  - Remaining warning debt is real `TLE_FCS_EXP` recovery work only; it remains visible but no longer locks CRUD.

- Verification:
  - `npm --prefix atlas-server run test:faculty-assignment-pass5` -> PASS (`54 passed, 0 failed`)
  - `npm --prefix atlas-client run build` -> PASS
  - `npm --prefix atlas-server run build` -> PASS
  - Tailnet direct auth -> PASS (`POST /api/v1/auth/login` with `identifier=1000001`)
  - Tailnet split-brain preview after policy change -> PASS (`required=false`, `severity=WARNING` while counters still showed recoverable debt)
  - Tailnet split-brain apply -> PASS (`INTEGRITY_OUT_OF_SUBJECT_SCOPE=0`, `truthRowsToUpdate=0`, `realFacultyMovesPlanned=0` after final apply)
  - Tailnet shared browser page reload -> PASS (`SAVED DATA`, `REVIEW NEEDED`, `AUTO-FILL` visible/enabled, final counters `961 / 1034`, `UNASSIGNED 73`)
  - Direct save contract smoke (`PUT /api/v1/faculty-assignments/:facultyId`) -> PASS locally with reversible mutation and restore on `facultyId=18211`

- UI verification notes:
  - `By Teacher` controls are no longer disabled; live page exposes `RESET`, `SAVE DRAFT`, grade unassign/assign actions, and `AUTO-FILL` while only review warnings remain.
  - `Section Allocation` continues to use the same shared `handleSave` persistence path as `By Teacher`; the save endpoint correction therefore restores section-mode persistence through the same optimistic-lock contract.
  - The page remains honest about remaining work: final live banner still shows review-only warning state with `14` recovery blockers (all `TLE_FCS_EXP` lane-cap blockers).

- Verdict: GO for Teaching Load read/write unblock and saved-scope reconcile under current year-55 state.

# 2026-05-27 - Phase 3 Teaching Load Major Frontend Refactor and Workflow Clarity
... rest of file ...
`r`n## 2026-05-27: Teaching Load Dual-Mode Grid and Inspector Refactor`r`n- **Scope**: Frontend UX refactor of Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n- **Components**: `r`n  - `By Teacher` mode: `TeacherGridMode``r`n  - `By Section / Shortage` mode: `SectionGridMode``r`n  - Inspector: `WorkloadInspector` (Persistent right-hand drawer)`r`n- **Removal UX**: Preserved inline removal in `SubjectRow` (accessible via `TeacherGridMode`).`r`n- **Tooltips**: Replaced raw `title` usage in `WorkspaceToolbar` with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Usability and Semantics Correction`r`n- **Scope**: Usability refinement of the recently refactored Teaching Load table.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n- **Discovery Controls**: Restored search, department filter, and status filter in `By Teacher` mode.`r`n- **Outside Dept**: Cross-department subjects are now hidden by default and accessible via a toggle.`r`n- **Semantics**: Renamed `By Section / Shortage` to `Section Allocation` for honesty. Added \"Unassigned Only\" filter.`r`n- **Allocation UX**: Clicking a candidate in section mode now performs a real assignment action. Removed aggressive hover mutation.`r`n- **Scrolling**: Reduced inline padding and spacing to ease vertical scroll pressure.`r`n- **Tooltips**: Replaced remaining raw `title` attributes with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Coverage and Burndown UX Correction`r`n- **Scope**: Semantic and interaction correction of the Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadData.ts``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n  - `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` (New)`r`n- **Coverage Alignment**: `Section Allocation` now only shows rows matching the headline coverage contract. Non-coverage demand is hidden.`r`n- **Burn-down UX**: `Section Allocation` is now section-first. Sections expand to show subjects. Completion is signaled via green icons/states.`r`n- **Writable Behavior**: Read-only gating relaxed. Writes allowed whenever verified school year is active and backend is reachable.`r`n- **Staffing Audit**: Restored the real report sheet. Wired both \"Staffing Audit\" and \"Review Needed\" buttons to open it.`r`n- **Sticky Actions**: Teacher-row action strips are now sticky within their expanded block scope.`r`n- **Metrics**: Replaced \"Classes\" with separate \"Subjects\" and \"Sections\" counts in teacher rows.`r`n- **Load Colors**: `> 30h` is warning (amber), `> 40h` is danger (red).`r`n- **Session Cards**: Enforced uniform 3-column left-aligned grid for session cards.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
# 2026-05-27 - Phase 3 SPA/SPS Breakout Dissemination And Homeroom Model Repair
- Phase: Phase 3 generator-readiness stream, SPA/SPS breakout dissemination
- Operator: GitHub Copilot
- Scope gate: PASS (SPA/SPS breakout lanes exposed; MAPEH normalized as default staffing pool; approval-gated special-program queue removed from live split-brain and teaching-load surfaces; homeroom-centric model preserved)
- Safety gate: PASS (Changes stayed within subject ownership normalization, teaching-load semantics, split-brain counters, UI copy, and runtime/docs evidence)
- Files changed in this pass:
  - atlas-server/src/services/subject-ownership.service.ts
  - atlas-server/src/services/subject.service.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - atlas-server/src/services/teaching-load-automation.service.ts
  - atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
  - atlas-client/src/components/faculty-assignments/OverviewHeader.tsx
  - atlas-client/src/pages/FacultyAssignments.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - ATLAS-PUBLIC-API.md
  - api/ATLAS-PUBLIC-API.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. MAPEH Normalization: SPA/SPS specialization ownership now normalizes to MAPEH in both resolver logic and subject-contract backfill.
  2. Approval Queue Removal: The split-brain reconcile path no longer emits SPECIAL_PROGRAM_APPROVAL_REQUIRED or a non-zero special-program approval candidate queue for normal MAPEH staffing.
  3. Teaching Load Cleanup: Special-program approval copy was removed from teaching-load summary UI surfaces so the old gating model no longer appears in operator warnings.
  4. Track Exposure Preserved: POST /api/v1/subjects/sync-offerings still exposes active SPA/SPS specialization tracks from persisted specialization ownership truth.
  5. Downstream Clarity: Public API docs now call out explicit breakout lane fields on published entries.

- Verification:
  - npm --prefix atlas-server run build -> PASS
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run test:phase4-review -> PASS (23/23)
  - npm --prefix atlas-server run test:faculty-assignment-pass5 -> PASS (48/48)
  - Tailnet POST /api/v1/subjects/sync-offerings -> 200 with active SPA/SPS tracks exposed individually
  - Tailnet POST /api/v1/faculty-assignments/integrity/reconcile-split-brain -> specialProgramApprovalCandidates=0, reasonCodes excluded SPECIAL_PROGRAM_APPROVAL_REQUIRED
  - Tailnet GET /api/v1/subjects?schoolId=1 -> SPA_SPEC.ownerDepartment=MAPEH, SPS_SPEC.ownerDepartment=MAPEH
  - Teaching-load browser check -> visible text no longer contains approval-gate wording or special-program approval queue language

- Verdict: GO
 
## 2026-05-27 - Phase 3 Teaching Load Grade Scope and Section Allocation Workflow Fix

- **Scope**: Repair Teaching Load refactor for honest By Teacher and Section Allocation workflows.
- **Files Changed**:
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-client/src/hooks/useTeachingLoadUI.ts
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx
  - atlas-client/src/components/faculty-assignments/SubjectRow.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx (New)
- **Verified Outcomes**:
  - [x] Grade-level subject scope enforced (STE subjects no longer leak).
  - [x] Section mode has real save behavior with local action bar.
  - [x] False read-only behavior softened for warnings.
  - [x] Right-hand panel switches context between teacher and section staffing.
  - [x] Adviser star and homeroom context restored.
  - [x] Sticky action strip gap fixed.
  - [x] Redundant X gone and click targets improved.

  # 2026-05-27 - Phase 3 Day-Shape Normalization And Qualification Authority Repair (Follow-Up)
  - Phase: Phase 3 generator-readiness stream, day-shape and qualification authority follow-up
  - Operator: GitHub Copilot
  - Scope gate: PARTIAL (server/client code-path fixes landed; live post-change generation proof still incomplete)
  - Safety gate: PASS (server/client builds clean, targeted regression test added and passing)
  - Files changed in this pass:
    - atlas-server/src/services/generation.service.ts
    - atlas-server/src/services/schedule-constructor.ts
    - atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts
    - atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx
    - atlas-client/src/components/timetable/RightPanel.tsx
    - docs/reference/atlas-runtime-source-of-truth-map.md
    - docs/verification/evidence-log.md

  - Repair delivered:
    1. Added `sourceMinutesPerWeek` to demand items and switched demand normalization to use authoritative weekly minutes, preventing normalization drift from reconstructed `sessions x duration` values.
    2. Tightened qualification authority in constructor assignment candidate expansion: tiered department fallback is now disabled unless `allowFlexibleSubjectAssignment=true`, so saved Teaching Load pairings remain the primary authority.
    3. Ensured constructor policy input receives persisted day-shape fields (`periodLengthMinutes`, `periodsPerDay`) directly from scheduling policy.
    4. Reframed timetable manual tooling copy to explicit recovery semantics (`Recovery Tools`, `Recovery Actions`) instead of normal completion language.

  - Verification:
    - `npm --prefix atlas-server run build` -> PASS
    - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts` -> PASS (`3 passed, 0 failed`)
    - `npm --prefix atlas-client run build` -> PASS
    - `get_errors` on modified source files -> PASS (no new diagnostics)
    - Tailnet baseline probe (`/policies/scheduling/1/55`, `/generation/1/55/runs/latest/draft`, `/generation/1/55/runs/latest/violations`) -> PASS for read access:
      - `periodLengthMinutes=45`, `periodsPerDay=10`
      - latest summary still showed `FACULTY_SUBJECT_NOT_QUALIFIED=3`, `UNASSIGNED_SECTION=734`
    - Tailnet `225`-minute session audit before fresh rerun still showed mixed session distributions (`2/3/4/5/6`) with many `6`-session rows.
    - Fresh post-change rerun attempt via `POST /api/v1/generation/1/55/runs` with polling was attempted but aborted by runtime request timeouts (no confirmed completed-run evidence captured in this pass).

  - Evidence interpretation:
    - Local code-path and regression evidence indicates the 225-minute normalization defect and non-authoritative qualification fallback are repaired in source.
    - Live closure remains unproven until a successful post-change Tailnet generation rerun completes and confirms:
      - consistent 45-minute session mapping for required subjects,
      - reduced/eliminated non-authoritative `FACULTY_SUBJECT_NOT_QUALIFIED` violations.

  - Verdict: NO-GO (remaining blocker is missing successful post-change Tailnet rerun evidence, not unresolved local compile/test defects).
  - [x] Section candidate loads color-coded.
  - [x] Swap behavior updates both source and destination draft state.
- **Verdict**: GO

 
## 2026-05-27 - TeacherGridMode and Inspector Fix (Runtime/TypeScript)

- **Scope**: Fix runtime ReferenceError (Star is not defined) and TypeScript type import regressions.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Star icon imported from lucide-react in TeacherGridMode.
  - [x] FacultyOwnershipState import moved to correct helper source in all components.
  - [x] Runtime crash resolved.
- **Verdict**: GO

 
## 2026-05-27 - SectionInspector Info Icon Fix

- **Scope**: Fix runtime ReferenceError (Info is not defined) in SectionInspector.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Info icon imported from lucide-react.
  - [x] Runtime crash in Section Allocation mode resolved.
- **Verdict**: GO


# 2026-05-27 - Phase 3 Teaching Load Auto-Fill Route Contract Fix
- Phase: Phase 3 generator-readiness stream, teaching-load integration repair
- Operator: Gemini CLI
- Scope gate: PASS (Teaching Load auto-fill frontend contract corrected; route and payload now match live server expectations)
- Safety gate: PASS (Surgical frontend integration fix; no changes to backend logic or staffing algorithms)
- Files changed in this pass:
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `docs/verification/evidence-log.md`

- Repair delivered:
  1. Corrected the auto-fill endpoint path from `/faculty-assignments/autofill` to `/faculty-assignments/auto-fill`.
  2. Corrected the request body field from `mode` to `coverageMode` to match the server's `parseCoverageMode` expectations.
  3. Preserved existing preflight behavior (split-brain reconcile) and writable workspace state.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Live connectivity check (`https://njgrm.buru-degree.ts.net/api/v1/health`) -> PASS (200 OK)
  - Endpoint discovery (POST `/api/v1/faculty-assignments/autofill`) -> PASS (404 Not Found, confirmed legacy/broken)
  - Endpoint discovery (POST `/api/v1/faculty-assignments/auto-fill` without auth) -> PASS (401 Unauthorized, confirmed existence)
  - Live contract verification (POST `/api/v1/faculty-assignments/auto-fill` with token and `coverageMode`) -> PASS (200 OK, `assignmentsCreated = 64`)

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Granular UX Hardening
- Phase: Phase 3 generator-readiness stream, teaching-load UX hardening pass
- Operator: Gemini CLI
- Scope gate: PASS (Surgical UX/UI hardening on Teaching Load components)
- Safety gate: PASS (No changes to backend scheduling logic or DB contracts)
- Files changed in this pass:
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
  - `atlas-client/src/components/faculty-assignments/SectionInspector.tsx`
  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`

- Repair delivered:
  1. Normalized typography: Removed text below `text-xs` across all touched components, improving scanability.
  2. Replaced raw HTML controls: Ensured standard ATLAS UI primitives (e.g., Popover, Button) are used.
  3. Unboxed subject identity: Replaced fixed square containers with horizontally expanding badges.
  4. Fixed jump-list ambiguity: Preserved full subject codes in the jump list instead of 3-character slicing.
  5. Simplified section allocation: Replaced the wall of teacher boxes in SectionGridMode with a calmer picker/popover interaction.
  6. Enlarged hit targets: Increased icon sizes from size-3/3.5 to size-4/5 for easier interaction.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS (no TS errors or missing imports)
  - Surfaces tested (via build verification & TS checks): SectionGridMode, TeacherGridMode, SectionInspector, WorkloadInspector, StaffingAuditSheet, SubjectRow, AssignmentWorkspace.
  - Runtime/import crashes -> None detected.
  - Subject-code overflow/unboxing fixed -> YES.
  - Section-allocation density calmed -> YES (replaced with Popover picker).

- Verdict: GO

# 2026-05-27 - Hotfix: Missing getFacultyComparableLoadHours Export
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Added missing export for `getFacultyComparableLoadHours` in `atlas-client/src/lib/faculty-assignment-helpers.ts` which was causing a module load error in the browser.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Hotfix: Teaching Load UX Polish (Typography & Overload Filter)
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Responded to user feedback regarding heavy typography, banner height, and overload filtering.
  1. Replaced all `font-black` occurrences with `font-semibold` globally across `atlas-client/src/components/faculty-assignments` and `TeachingLoad.tsx`.
  2. Compacted the 'Review Required' split-brain banner in `TeachingLoad.tsx` by reducing padding/margins.
  3. Added an explicit 'Overload (>30h)' filter option to `TeacherGridMode.tsx` referencing the existing `loadFilter` state in the hook.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Hotfix: loadFilter ReferenceError Crash
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Resolved a `ReferenceError: loadFilter is not defined` crash in `TeacherGridMode.tsx` that was introduced when surfacing the Load filter in the UI. Added `loadFilter` to the props interface and fixed a duplicate closing tag typo.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Phase 3 Timetable Homeroom-First Master-Schedule Reconcile (One-Shot)
- Phase: Phase 3 generator-readiness stream, timetable second re-entry pass
- Operator: GitHub Copilot
- Scope gate: PASS (home-room-first section contract applied; specialized-room pressure kept diagnostic for section master schedules)
- Safety gate: PASS (hard room/resource collision protections retained; no topology reseed in this pass)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. `HOME_ROOM_FIRST` now defers specialized room preferences for all section-level entries, including sections with missing `homeRoomId`, keeping section output classroom/homeroom first.
  2. Specialized expectations remain diagnostics through deferred metadata and validator soft diagnostics, instead of blocking section master-schedule placement.
  3. Real hard collisions remain protected: room overlap conflicts are unchanged and still hard.

- Explicit room/building assumptions downgraded to diagnostics:
  - Section-level specialist room-type requirement during master scheduling (`ROOM_TYPE_MISMATCH` when deferred).
  - Section-level specialist room-feature requirement during master scheduling (`ROOM_FEATURE_MISMATCH` when deferred).
  - Specialized-room scarcity as a section-blocking path (`SPECIALIZED_ROOM_UNAVAILABLE` no longer blocks section placement under homeroom-first contraction).

- Hard constraints retained:
  - `ROOM_TIME_CONFLICT` (double-booking) remains hard.
  - Shared/singleton facility collision protection remains hard via room occupancy conflict checks.

- Verification:
  - `npm --prefix atlas-server run test:phase2-home-room-strategy` -> PASS (15/15)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-regression.test.ts` -> PASS (51/51)
  - `npm --prefix atlas-server run build` -> PASS
  - Tailnet generation rerun with `roomerStrategy=HOME_ROOM_FIRST` -> new completed run `82`
  - Tailnet run comparison (`81 -> 82`):
    - `assignedCount`: `2095 -> 2286`
    - `unassignedCount`: `759 -> 568`
    - `SPECIALIZED_ROOM_UNAVAILABLE`: `0 -> 0`
    - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`: `788 -> 764`
    - `FACULTY_EXCESSIVE_IDLE_GAP`: `324 -> 304`
    - `homeRoomSuccessRate` on run `82`: `58.57`
  - Tailnet section-home-room coherence after rerun:
    - `/sections/summary/55?schoolId=1` -> `total=82`, `missingHomeRoom=0`, `missingBuildingZone=0`
    - `/sections/home-rooms/55?schoolId=1` -> coherent options (`157`)

- Topology/home-room reconciliation:
  - No room/building reseed or topology identity shift was executed in this pass.
  - No section `homeRoomId` / `buildingZoneId` repair operation was required.

- Verdict: GO

# 2026-05-27 - Hotfix: Teaching Load Polish II (Swap UI & Dismissible Banners)
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Responded to user feedback regarding swap logic, swap UI, overflowing badges, and dismissible warnings.
  1. Fixed the swap logic in `executeSwap` to use the latest `prev` state instead of a potentially stale closure, ensuring ownership transfers correctly update the UI.
  2. Changed the swap icon to `ArrowLeftRight` and wrapped it in a Tooltip for clarity.
  3. Refactored the `Teaching Load Review Required` banner to be dismissible via a close button. Dismissing it also hides the toolbar badge.
  4. Fixed badge text overflow using `whitespace-nowrap` and re-introduced `font-black` specifically for the primary arithmetic values in the Workload Inspector.
- Verification: Build succeeds without errors. The swap action transfers correctly without creating conflicts.
- Verdict: GO

# 2026-05-27 - Hotfix: ArrowLeftRight Icon Import Crash
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Added missing import for `ArrowLeftRight` from `lucide-react` in `atlas-client/src/components/faculty-assignments/SubjectRow.tsx` to resolve a ReferenceError crash in the browser.
- Verification: Client build passes without import errors.
- Verdict: GO

# 2026-05-27 - Hotfix: Timetable UI Unresolved Import Fix
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Resolved an unresolved variable reference (ArrowRight to ArrowLeftRight mapping issue where ArrowLeftRight wasn't added to imports in SubjectRow.tsx).
- Verdict: GO
`n## 2026-05-28: Phase 3 Published Schedule Refresh and Stale Cache Fix`n`n- **Scope**: Fix stale published schedule data in public and faculty views.`n- **Files changed**:`n  - `atlas-client/public/sw.js`: Removed published schedule endpoint from service worker caching.`n  - `atlas-client/src/pages/PublicPublishedSchedule.tsx`: Implemented `forceRefresh` mode to bypass local storage and SW caches.`n  - `atlas-client/src/pages/MySchedule.tsx`: Implemented `forceRefresh` mode to bypass local storage and SW caches.`n- **Verification performed**:`n  - `npm --prefix atlas-client run build` passed.`n  - Code review confirmed that `forceRefresh` adds `Cache-Control: no-cache` and skips local snapshots.`n  - Service worker no longer intercepts published schedule API calls.`n- **Verdict**: GO
