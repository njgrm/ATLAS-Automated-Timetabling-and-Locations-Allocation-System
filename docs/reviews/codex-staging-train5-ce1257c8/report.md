A pass 0/4 · flow: departments set n · placeholders 25 · TL applied y · generated n · published n

Build ce1257c8; staging origin asserted on every visited page: http://127.0.0.1:5274. Viewport requested 1366x768. No production origin or login encountered.

Part A
A1 FAIL — Teaching Load showed “Guided mode is active” (after 1.2 s).
A2 FAIL — School Year Setup uses jargon: “EnrollPro”, “ATLAS”, “ATLAS is on 2022-2023”, and “School year status”. It otherwise uses mostly plain sentences.
A3 FAIL — School Year Setup labelled 2029-2030 (schoolYearId=8) “Past school years”; /timetable?schoolYearId=8 said “Past school year” but then “You cannot open that school year... it has no timetable to show.” No Generate/Edit/Publish was reachable, but it did not show that year's timetable.
A4 FAIL — Suggestion (2.5 s) proposed 25 “TEMPORARY SUBSTITUTE” rows, yet did not say “N classes still need a real teacher.” It did not say “No classes to fill.”

Results
Faculty: FAIL/blocked for requested department repair. Screen showed 20 active teachers, not the expected 23; no rows #3/#20/#33 or missing-department marker were visible. Department required opening each person's profile; sampled profile showed “DEPARTMENT Filipino”. Teacher list settled after 6 s and warned “Using saved data”. No department was changed.
Teaching Load: suggestion review passed as an interaction: 239 covered rows; 0 uncovered; 25 new temporary-substitute assignments; 2 proposed moves; 9 unresolved imbalance; 11 above standard; 0 over hard cap. “Apply suggested Teaching Load” completed in 3 s and returned “ATLAS Teaching Load draft Saved”; Save Changes was disabled because it had auto-saved. The available placeholder wording was generic “Temporary substitute”, not a named “MAPEH Teacher (to be hired)”.
Timetable: blocked; not generated/published. Exact headline: “438 setup items must be fixed before a timetable can be made.” Exact recurring blockers: “A session could not be placed with the current setup”; “Some schedule information is missing or incomplete”; “A scheduling rule needs a decision before a schedule can be made.” Generate was disabled: “Setup inputs for the active school year are not ready yet.” Published section/placeholder-teacher check unperformed because no timetable exists.

Bugs
BLOCKER | Timetable | After applying the Teaching Load suggestion, open Class Schedule. | Observed: Generate is disabled with 438 setup items, largely repeated generic messages and links to forbidden School Year Setup. Expected: an actionable, deduplicated explanation of the actual blocking prerequisites, without routing the operator toward forbidden actions.
BLOCKER | Faculty | Open Teachers for S.Y. 2022-2023. | Observed: 20 active teachers and no visible missing-department rows #3/#20/#33; expected outage fixture states 23 teachers and three repairable missing departments.
MAJOR | Teaching Load | Select Suggest assignments and wait for preview. | Observed: 25 temporary-substitute rows but no “N classes still need a real teacher” message. Expected: that staffing warning while substitutes are proposed.
MAJOR | Archived timetable | Open /timetable?schoolYearId=8 from School Year Setup's “Past school years”. | Observed: past-year heading followed by no timetable. Expected: that archived year's read-only timetable.
MINOR | Teaching Load | Open page. | Observed: “Guided mode is active”, contrary to release check; it also adds a dense, technical queue before the work area. Expected: no Guided mode wording.

Older-user concerns
BLOCKER | Timetable | “438 setup items must be fixed before a timetable can be made.” | Group duplicates by cause and say the one next safe step; do not show hundreds of repeated entries.
MAJOR | Faculty | “Using saved data... Reconnect or sync before relying on this roster for final setup.” | Say whether it is safe to make today’s department repair, then show the three affected teachers directly.
MAJOR | Teaching Load | “REAL TEACHERS FIRST, THEN SUBSTITUTES” / “Temporary substitute”. | Label each placeholder plainly, e.g. “MAPEH teacher to be hired — not a real person yet”.
MAJOR | Teaching Load | “Guided mode is active”. | Remove it; lead with “Choose a teacher or section”.
MINOR | School Year Setup | “EnrollPro”, “ATLAS”, “School year status”. | Use “school records” and “this timetable” or define the names once.
MINOR | Timetable | “A session could not be placed with the current setup”. | Name the class, missing item, and a single safe place to fix it.
