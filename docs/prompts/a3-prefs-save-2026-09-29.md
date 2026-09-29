# A3 p1 — Teacher Preferences cannot be saved (demo BLOCKER)

Issued by Lane C, 19:55. Live `e75d6b8f` AND staging `cd542245` (train 10), 1366x768, officer account: open Teacher
Preferences, pick a teacher (e.g. AGUILAR, CARLO MIGUEL). The Available/Preferred/Unavailable grid shows, but the
"Anything else" box and **Save are disabled**; the only reason on screen is the room-need sentence "There is no timetable
built yet, so there is no class to move…", which is about a different section. School Year Setup on live says
"Active school year: 2023-2024 · TERM 1, verified live from EnrollPro". Live DB: `faculty_availabilities` has 1 DRAFT row,
0 slots; `school_year_term_configs` has only one row, for school_year_id 8 (not the active year).

Code: `pages/TeacherConcerns.tsx:330-331` `writesDisabled = termUnresolved || actorSchoolId == null || schoolYearId ==
null || selectedFacultyId == null`; `termUnresolved` comes from `resolveVerifiedActiveTermIndex(context.activeTerm)`
(`timetablePrefetch.ts:46`, `academic-term.ts:30`: needs verified + termIndex + orderedTerms containing it). Find which
input is null on real staging data (log the resolved context in a test, not in the UI), and fix the cause — likely the
ordered terms / term config for the active year (id-space: mirror id vs EnrollPro id) rather than the page.

Done when, on real staging data at 1366x768: a scheduler picks a teacher, marks Friday afternoon Unavailable and mornings
Preferred, types a note, presses Save, reloads, and sees it kept; submit/review works through the page; the reviewed
availability is what generation reads (`faculty-availability.service.ts:346`) — prove with one staging generation that
the Unavailable slot stays empty. When writes ARE disabled, the page says the real reason in plain words next to Save.
Receipts rule (`docs/plans/codex-walk-standard.md`): after Save/Review the page says what was saved and that it will be
used by the next timetable. `ux-audit.js` 0 MAJOR, `test:encoding` green. Commit and push wip every 30 min.
