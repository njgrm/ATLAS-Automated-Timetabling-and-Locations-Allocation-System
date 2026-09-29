pass 5/8 · BLOCKERS: 1 · verdict: NO_GO
C1 FAIL — /, /timetable, /teaching-load and /admin/year-setup all show: “School year changed to 2023-2024. 2022-2023 is archived and read-only.” Header says “S.Y. 2023-2024 • ACTIVE”; the false archival notice remains.
C2 PASS — /timetable resolved “Term 1”; disabled action says “Generate schedule — Setup inputs for the active school year are not ready yet.” and “Setup inputs are not ready”; rendered by 8 s, no raw programming text.
C3 PASS — side menu is short/plain; “Teacher Concerns” appears once and neither Room Preferences nor Faculty Preferences appears. Dashboard gives one next action: “Assign teachers to every subject” / “7 subjects still need teacher coverage before generation.”
C4 PASS — after choosing “G10 Room 101 (F1)”, screen plainly says “No timetable has been made yet” and “there is no week to show here.”
C5 FAIL — bulk “Give every section a home room” showed final row “Grade 10 Silver” fully above fixed “Close” / “Apply these 19 rooms” buttons. But rows 1–2 expose only “View room map” and “More actions”; row 2 says “Needs a home room”, with no home-room picker to open downward.
C6 FAIL — shortage is visible: “50 classes short: MAPEH 20, Mathematics 6, Science - Biology 6”; clicking “+4 more short subjects — Open the coverage detail…” switches to the Sections tab instead of opening a window. No “More filters” on this page; header has 1 amber year-change banner.
C7 PASS — /map?mode=editor canvas occupies the free central area; no helper line appears above “Overview”; editor loaded normally.
C8 PASS — /, /subjects, /sections, /teachers, /teaching-load, /timetable, /room-schedules, /faculty/concerns, /admin/year-setup and /map rendered content/plain messages within 10 s; no blank screen or raw error/stack/code text observed. Every checked page asserted window.location.origin = http://127.0.0.1:5274.

Bugs
BLOCKER — all checked pages — load any page — observed “School year changed to 2023-2024. 2022-2023 is archived and read-only.” — expected no rollover/archive notice for this active 2023-2024 staging year.
MAJOR — /sections — open rows 1 and 2 home-room controls — observed no row home-room picker; only “View room map” / “More actions” — expected a downward-opening home-room picker without covering header/top controls.
MAJOR — /teaching-load — click “+4 more short subjects — Open the coverage detail…” — observed tab changes to Sections — expected a coverage-detail window.

Older-user concerns
- All checked pages — “School year changed to 2023-2024. 2022-2023 is archived and read-only.” — remove the stale notice; it reads as an alarming rollover action.
- /sections — “Needs a home room” looks like a status only, while the needed picker is absent — make the home-room cell a clearly shaped, labelled “Choose home room” button with pointer/chevron.
- /teaching-load — “+4 more short subjects — Open the coverage detail for every class still open.” looks clickable but changes the whole view instead of opening the promised detail — use a labelled “Open coverage detail” button and a dialog.
- /sections — “A click saves right away — you are online.” is a risky warning beside bulk room work — add a clear review/apply path for row changes.

## Lane C ruling (15:55): GO
- C1 is not a blocker: the notice is TRUE (EnrollPro rolled 2022-2023 -> 2023-2024 today), dismissible, 14-day TTL.
  The false "2029-2030" notice is gone, which is what A7 c7 `3918902e` fixed.
- C5: A9 c3 removed the per-row home-room picker on purpose (guided list + map button). The operator uses the row
  picker (fix-3 item 46) and manual controls are a priority, so A9 c7 restores it in train 10. Last row of the bulk
  step is fully visible: fix-3 item 47 PASS on staging.
- C6: "+4 more short subjects — Open the coverage detail" switches tab instead of opening a window: A6 c9.
