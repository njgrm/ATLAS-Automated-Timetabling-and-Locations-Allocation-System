Pages audited 8 · REJECT_UX: Sections, Teacher Concerns, Faculty Preferences, Room Preferences, Room Schedules, Campus & Rooms, How Scheduling Works · worst page: Teacher Concerns

Audit conditions: build 24e268fb; authenticated existing Brave profile; read-only; origin asserted on every route as http://127.0.0.1:5274; 1366x768.

## Part A

### Dashboard (/)
Purpose after 10 seconds: see where the timetable setup stands and take the next step. Scores: next 4/5; calm 3/5; plain words 3/5; tedious work 4/5.
Worst: “Hard-violation count unavailable” — say what is unavailable and what the scheduler should check. “Derived demand prepared (input milestone)” — say “classes needed are calculated.” “6 OF 10 READY” — name the missing six beside the count.

### Sections (/sections) — REJECT_UX
Purpose: check class sections and give each a home room. Scores: next 3/5; calm 2/5; plain words 3/5; tedious work 2/5.
Worst: “Using saved data” / “last safe section mirror” — one plain warning: “These are saved sections; confirm sync before changing rooms.” “Home-room edits can be queued” — say whether a click will actually save. “20 need rooms” beside 20 repeated row selectors — offer one guided assign-and-review flow.

### Teacher Concerns (/faculty/concerns) — REJECT_UX
Purpose: record one teacher’s unavailable times, preferred times, notes, and room requests. Scores: next 2/5; calm 1/5; plain words 1/5; tedious work 2/5.
Worst: “Active ordered term unresolved” — show the selected school term or one clear “Choose term” action. “Paint AGUILAR, CARLO MIGUEL's weekly windows” over 48 quarter-hour rows — start with simple weekday/time ranges and an optional detailed grid. “Only a reviewed authority binds generation” — say “Your entries will be used only after the scheduler approves them,” and show who approves.

### Faculty Preferences (/faculty/preferences) — REJECT_UX
Purpose: cannot tell; it says “Faculty Preferences” but shows “Missing 46” and “No teachers found.” Scores: next 1/5; calm 3/5; plain words 3/5; tedious work 1/5.
Worst: “Missing 46” plus “No teachers found” — load the 46 teachers or explain the data error. “Submitted / Draft / Missing / All” — add a sentence saying what each status means. “Select All Missing” — replace with “Ask all 46 teachers for preferences,” with a visible list first.

### Room Preferences (/faculty/room-preferences) — REJECT_UX
Purpose: cannot tell; it only reports a missing timetable run. Scores: next 1/5; calm 4/5; plain words 3/5; tedious work 1/5.
Worst: “Cannot load room requests” — say whether requests are missing or this page is unavailable. “No active draft timetable run is available for this school year” — room needs belong before generation, not behind it. “Retry” — offer “Record room needs” or link to the correct pre-generation page.

### Room Schedules (/room-schedules) — REJECT_UX
Purpose: look up a room, teacher, or section timetable for a term. Scores: next 2/5; calm 3/5; plain words 2/5; tedious work 2/5.
Worst: “Use the selector above, then keep Latest selected unless you are checking a known Run ID” — hide run IDs in an advanced history choice. “Schedule view term” and “Schedule download term” — one selected term should drive both. “No completed generation runs found” — give a clear link/action to generate or say “No timetable has been made yet.”

### Campus & Rooms (/map) — REJECT_UX
Purpose: check buildings and rooms are ready for lessons. Scores: next 3/5; calm 2/5; plain words 3/5; tedious work 3/5.
Worst: “78/103” — label it “78 of 103 teaching rooms ready.” “Needs rooms” for a building with “0 teaching rooms out of 20 total rooms” — state the consequence and one fix. A 103-room readiness list — group unavailable rooms by building and show only problems first.

### How Scheduling Works (/timetabling/how-it-works) — REJECT_UX
Purpose: explain how setup, preferences, generation, review, and publishing fit together. Scores: next 4/5; calm 3/5; plain words 2/5; tedious work 4/5.
Worst: “Constraint weights (0–100)” — move this technical tuning to advanced help. “soft-violation score” — say “how many preferences the draft could not meet.” “COMMIT” — say “Apply this change”; keep the jargon glossary optional.

## Part B — Teacher Concerns deep look

Teacher sampled: AGUILAR, CARLO MIGUEL. In conversation order: choose teacher; choose marking mode Available, Preferred, or Unavailable; mark weekly time windows (or open “Quick Fill”); enter “Notes for the scheduler”; enter “Room requests”; then Save draft and Submit for review (both disabled because the active term is unresolved).

The availability/preferred facts also belong conceptually on Faculty Preferences, which is a separate page but showed no teachers. Room needs also appear to belong on Room Preferences, a second separate page that was unavailable without a draft run. Teacher Concerns cannot record “teacher needs room X for class Y” as usable timetable data: its only room field is free-text “Room requests,” and the page states: “there is no separate room-request write path.”

## Part C — Room Schedules deep look

“What is in Room 101 on Tuesday?”: 3 clicks (Rooms, room selector, “G7 Room 101 (F1)”). Not answered: “Schedule not available — No completed generation runs found for this school/year.” Confusing on the way: ambiguous “Room 101” (several grade wings), “Showing TERM 1,” “Schedule view term,” “Schedule download term,” “Latest,” and “Run ID.”

“Where is Ms. FERNANDEZ, JANELLA MARIE at 10:00 on Monday?”: 3 clicks (Teachers, teacher selector, name). Not answered for the same no-run message. Confusing: subject-grouped name picker (AP/ENG/ESP etc.), “Latest,” “Run ID,” and separate term controls.

“What is Grade 7 Aguinaldo’s week?”: 3 clicks (Sections, section selector, Aguinaldo). Not answered for the same no-run message. Confusing: the selector says only “Aguinaldo” after a Grade 7 group, term remains “TERM 1,” and “Latest/Run ID” is unexplained.

## Part D — demo walk-through gaps

Set up school year: Dashboard names “Year, terms” and links an internal “/admin/year-setup,” but there is no “School Year” item in the side menu. Not findable without help: dead end.

Check subjects: Subjects. Findable: yes.

Check teachers: Teachers. Findable: yes.

Record each teacher’s concerns: Teacher Concerns. Findable: yes, but the unresolved-term gate and quarter-hour paint grid stop a smooth conversation.

Record preferred room for a class: two competing pages, Teacher Concerns and Room Preferences. Not findable as a trustworthy task: Teacher Concerns is only free text; Room Preferences requires a draft run.

Build teaching load: Teaching Load. Findable: yes.

Generate timetable: Class Schedule. Findable: yes, although “Class Schedule” does not say “make timetable.”

Review timetable: Class Schedule and Room Schedules compete. A first-time user can find both but cannot tell which is the review step.

Look up room/teacher/section schedule: Room Schedules. Findable: yes; currently a dead end before a completed run.

Share or print: no obvious side-menu destination. “Download schedules” is inside Room Schedules, but “Export CSV” is disabled and there is no visible print/share path. Not findable without help.

## Top 10 fixes before the demo

1. Teacher Concerns - replace free-text room requests with teacher + class/subject + required room structured fields that generation reads.
2. Room Preferences - make it usable before generation; do not require a draft run to record inputs.
3. Faculty Preferences - fix “Missing 46” / “No teachers found” so the core list actually appears.
4. Teacher Concerns - resolve/select the active term before presenting disabled save and submit controls.
5. Teacher Concerns - replace the default 15-minute paint grid with simple weekday/time ranges and presets.
6. Dashboard/side menu - add a clear School Year & Terms page entry.
7. Room Schedules - use one plainly labelled term selector; hide Run ID under schedule history.
8. Class Schedule/Room Schedules - give review, lookup, print, and share distinct plain-language navigation labels.
9. Sections - turn 20 repeated “Choose home room” controls into a guided bulk assignment/review.
10. Campus & Rooms - lead with grouped room problems and a plain “78 of 103 rooms ready” summary.
