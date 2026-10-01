TIER: T2   OWNER: Setup   BASE: a68c21b3   WORKTREE: E:\ATLAS-worktrees\lane-setup-p04a   BRANCH: work/lane-setup-p04a
ACCEPTANCE (operator's words, verbatim; do not restate): "considerations of well being, stuff like pregnancy, injury, or ailments that would place these teachers teaching area in the ground floor only to avoid having to go up and down the stairs. I noticed that this is not in the current teacher's concerns page, and I think it was at some point in time, we'll have to return this as well."
CONTEXT: The teacher portal is retired and the SMART add-on is cancelled: the SCHEDULER records these needs for a teacher;
  teachers submit nothing. The server already stores per-teacher flags (preference.router.ts / preference.service.ts:
  pregnancySupport, physicalAilmentSupport, avoidUpperFloors, minimizeTravelTime; schema avoid_upper_floors). The UI was
  dropped from Teacher Concerns in bf13c50d8 (29 Sep, "drop the ceremony"); the old section survives unused in
  atlas-client/src/components/faculty-preferences/DesktopPreferencesLayout.tsx. Decisions 5 (receipt), 10 (dialog width),
  11 (no second confirm) apply.
DELIVERABLE: on the Teacher Concerns page, the scheduler can open a teacher and tick ONE plain need: "Ground floor only"
  with a reason (Pregnancy / Injury / Illness or ailment / Other, optional short note). Saving sets avoidUpperFloors=true
  plus the matching reason flag; it shows a plain receipt and Undo. Teachers with the need show a small "Ground floor"
  badge in the list. Plain words, no jargon; the reason is private to schedulers (no reason text in any public or
  printed schedule).
OWNED FILES: atlas-client/src/pages/TeacherConcerns.tsx, atlas-client/src/components/faculty-shared/*, new files under
  atlas-client/src/components/faculty-preferences/, their tests. Server only if the existing route cannot save the flags
  for a scheduler (then stop: NEEDS_DECISION).
TESTS PIN BEHAVIOUR, NOT WORDING (see PLANNERS.md template).
FORBIDDEN: generator changes (that is p04b), migrations, writes on live, other lanes' files.
DONE MEANS: PLANNERS.md template (failing test first, focused + full suites, typecheck with no error outside the
  baseline, 1366x768 screenshot of Teacher Concerns with one teacher marked, DESIGN.md checklist).
REPORT BLOCK: as PLANNERS.md.
