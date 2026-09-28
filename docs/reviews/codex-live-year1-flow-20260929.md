flow: TL applied yes · generated no · published no

Results

- Live origin asserted on Dashboard, Teaching Load, and Timetable: `https://njgrm.buru-degree.ts.net` (no port); viewport 1366x768; active school year 2022-2023.
- Teaching Load: suggestion reviewed and applied; page showed `ATLAS Teaching Load draft Saved`. Preview proposed 264 new assignments: 239 real-teacher suggestions, 25 temporary substitutes, 0 still unresolved. Saved summary: 264 classes needing a teacher, 239 with a teacher, 25 still without a teacher; 11 teachers above the 30h standard (+56.3h), 0 above the 40h hard cap. Suggestion became ready in about 1.6s; apply settled in about 4.1s. Toast: `Suggested Teaching Load applied with 25 class rows still needing review.`
- Timetable: no schedule existed. Generation was disabled, so no generation duration, review totals, publication, or the requested 2-section/2-teacher post-publication checks are available. Timetable initially settled in about 4.4s; no individual observed page wait exceeded 3s. ATLAS reported 468 setup items; examples: `A session could not be placed with the current setup`, incomplete Term 1 data, and scheduling rules needing a decision. No setup, policy, room, EnrollPro, teacher-profile, Sync, Archive, or Reset action was taken.

Bugs

1. BLOCKER — Timetable — Open Class Schedule for active S.Y. 2022-2023, wait for readiness, then select `See what to fix`. Observed: `Generate schedule` is disabled and 468 blockers prevent a timetable from being made; most reported items repeat and point to forbidden Year Setup/Teaching Load actions. Expected: a ready authorized yearly flow can generate, review, and publish, or the blocker groups the root causes and clearly identifies a permitted owner/action.
2. MAJOR — Teaching Load — Select `Suggest assignments`, wait for the preview. Observed: the modal heading says `No classes to fill for this school year` and says `ATLAS found no classes to fill`, while the same modal says `264 NEW ASSIGNMENTS`, `239 REAL-TEACHER SUGGESTIONS`, and `25 TEMPORARY SUBSTITUTE`. Expected: one consistent result statement.
3. MAJOR — Teaching Load — Apply the displayed suggestion, then open `Load summary`. Observed: preview says `0 STILL UNRESOLVED`; after apply, summary says `25 without a teacher` and the toast says 25 rows need review, without explaining the difference. Expected: totals reconcile or the page plainly explains what “temporary substitute” and “still without a teacher” mean.

Older-user concerns

1. Timetable — The sentence `468 setup items must be fixed before a timetable can be made` gives one large scary number but shows a long repeating list. Fix: group duplicates by cause, show counts, and say who must fix each group.
2. Timetable — `A session could not be placed with the current setup` does not say which class/subject/room is at fault for most entries. Fix: use plain specifics, e.g. “Grade 10 Pearl: no suitable room for Science,” with one safe next step.
3. Timetable — `A scheduling rule needs a decision before a schedule can be made` is technical and routes to forbidden Year Setup. Fix: say what decision is missing and label its required owner; do not make the operator hunt through setup.
4. Teaching Load — `No classes to fill for this school year` contradicts `264 NEW ASSIGNMENTS`. Fix: replace the headline with the actual result, such as “264 classes can be assigned; 25 need substitute review.”
5. Teaching Load — `REAL TEACHERS FIRST, THEN SUBSTITUTES`, `KEPT EXISTING`, and `STILL UNRESOLVED` are not explained in everyday school-scheduler language. Fix: give a short key beside the totals and state whether each class is ready for timetable generation.
6. Teaching Load — Confirmation is split between `ATLAS Teaching Load draft Saved` and a fleeting toast about 25 rows. Fix: show a durable plain confirmation with assigned, substitute-review, unresolved, and overload totals plus an undo/review route.
