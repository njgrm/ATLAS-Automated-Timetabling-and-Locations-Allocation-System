A pass 4/5 · B pass 0/4 · BLOCKERS: 0 · verdict: GO

Build under test: e9ddda71. Staging only: http://127.0.0.1:5274 (window.location.origin asserted on every visited page). Viewport 1366x768. No production origin or login encountered. Slow pages: School Year Setup 10 s; Teaching Load 10 s then one reload; Subjects 10 s then one reload; Timetable 10 s then one reload.

Part A
A1 PASS — /admin/year-setup rendered readable content after 10 s; “Every school year in ATLAS” listed 2031-2032, 2030-2031 and 2029-2030, each with “Open timetable”. No action pressed.
A2 FAIL — no “Guided mode” and the header is two rows, but the only shortage line is “25 classes still need a real teacher.”, not a plain per-subject shortage. “Cover these classes” was not available; the page instead says “Review subject coverage”.
A3 PASS — /subjects shows “Grade: All”; rows use subject names (for example “Araling Panlipunan”), not row codes; visible program chips are BEC, STE, SPA and SPS.
A4 PASS — /teachers shows “ACTIVE TEACHERS 20” for S.Y. 2022-2023. Melchora Aquino, Apolinario Mabini and Jose Rizal do not appear in the 20-row roster.
A5 PASS — mouse navigation Subjects -> Sections -> Teachers -> Timetable immediately replaced old content with each destination’s loading/content state; no old page remained under the new URL.

Part B
B1 Teaching Load — FAIL. 4 clicks to assign: “Review subject coverage” -> Aguinaldo -> MAPEH “SET OWNER” -> DOMINGO, ANGELICA MAE. It visibly changed to “Draft — not saved” and removed Aguinaldo from the Needs staffing list. I could not complete the requested explicit unassign or “Cover these classes” preview/apply because neither control is present; leaving the page discarded the unsaved draft. Undo/cancel: no visible undo in the Sections view. Confusing words: “Next step Last saved data — Assign teachers to open classes Unverified”.

B2 Timetable — FAIL. No usable timetable. After 10 s plus one reload, the primary action is disabled: “Generate schedule — Setup inputs for the active school year are not ready yet.” The page says “468 setup items to fix” and “No timetable yet.” Generation, move, swap, lock, clash warning and undo/revert could not be exercised. Undo/cancel: none applicable. Confusing words: “See what to fix: No 2022-2023 timetable yet”.

B3 Teacher Concerns — FAIL. 0 editing clicks: term-bound writes are disabled before a teacher can be selected. Screen confirmation: “Active ordered term unresolved” and “Writes stay disabled rather than defaulting to Term 1.” No unavailable/preferred windows, note, save or reload persistence test possible. Undo/cancel: none applicable. Confusing words: “Active term verification not requested.”

B4 Room Schedules — FAIL. 0 schedule lookups/print attempts: no timetable from B2 and the page says “Term not verified”; term picker disabled. Rooms list reports “78 rooms available”, but room/teacher/section schedules and meaningful download/print verification are unavailable. Undo/cancel: not applicable. Confusing words: “Choose one term” beside an unavailable term.

Bugs
MAJOR — Timetable — Open /timetable on the active year, wait 10 s and reload once. Observed: no timetable and disabled generator with “468 setup items to fix”. Expected: a usable existing timetable or a clearly actionable, runnable generation path in staging.
MAJOR — Teacher Concerns — Open /faculty/concerns. Observed: “Active ordered term unresolved” disables all writes, preventing availability/note save and persistence checking. Expected: resolved active term or an actionable recovery path before the operator reaches the form.
MAJOR — Teaching Load — Open /teaching-load and review coverage. Observed: generic “25 classes still need a real teacher.” and no “Cover these classes” control/preview. Expected: per-subject plain shortage and a preview-before-apply coverage action.
MINOR — Teaching Load — Assign MAPEH in Aguinaldo. Observed: the draft confirmation is visible, but the assigned section disappears from the filtered list and there is no visible Undo in that view. Expected: an obvious Undo/Unassign beside the confirmation.

Older-user concerns about the controls
MAJOR — “468 setup items to fix”: give the first fix, owner and a button that opens that exact fix; do not make a veteran scheduler decode a total.
MAJOR — “Active ordered term unresolved” / “Active term verification not requested”: show the selected year and term problem in plain words with a safe re-check result, before presenting disabled editing.
MAJOR — “25 classes still need a real teacher.”: say which subject and how many, e.g. “MAPEH: 18 classes need a teacher”, with a direct coverage button.
MINOR — “Next step Last saved data — Assign teachers to open classes Unverified”: replace stacked status jargon with “Using saved roster; changes in EnrollPro may not be included.”
MINOR — “SET OWNER” / “CHANGE OWNER”: use “Assign teacher” / “Change teacher”; “owner” is technical and ambiguous in a school setting.
MINOR — “Choose one term” while the term control is disabled: state why it is unavailable and how to restore it.
