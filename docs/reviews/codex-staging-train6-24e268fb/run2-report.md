A pass 1/5 · design: TL 2/2/2/1, TT 1/4/3/1, SUBJ 2/3/3/1, YS 1/1/1/1 · REJECT_UX: /teaching-load, /timetable, /subjects, /admin/year-setup

Part A
A1 FAIL — no “Guided mode” seen, but Teaching Load has several competing top controls (“Load summary”, “Retry source”, “More Teaching Load tools”), not one clear main button. No observed cut-off “Review staff work…” text. After 10 s + one reload it ended at saved-data/source-check state.
A2 FAIL — filters do say “Grade: All”; no “OWNER_DEPT” was visible, but the subject table had no loaded rows after 10 s + one reload, so codes/program chips/all-program visibility cannot be verified.
A3 FAIL — comparison cannot be made: Subjects shows same-style select filters, but Sections exposes only “More filters”; Teachers and Teaching Load were source-check/saved-data states. No label ending “…” observed at 1366×768.
A4 FAIL — S.Y. 2022-2023 is shown, but suggestion/apply could not run: Teaching Load says “Using the last saved data — no live Teaching Load source is available” and disables editing after the prescribed retry. No honest after-apply count or plain failed-apply message could be verified.
A5 PASS — Teachers says “ACTIVE TEACHERS 20” for 2022-2023. Listed: 20; Melchora Aquino, Apolinario Mabini, Jose Rizal: none shown.

Bugs
BLOCKER — /admin/year-setup — open local page, wait 10 s, reload once. Observed “Verifying session… Checking your sign-in” indefinitely, with no setup content. Expected the staged operator to reach a readable School Year Setup page without any forbidden action.
BLOCKER — /timetable — open Class Schedule, wait 10 s, reload once. Observed “Loading timetable: navigation is ready now; the grid fills as soon as the latest run resolves.” with no grid. Expected a usable timetable or a plain, actionable failure.
BLOCKER — /teaching-load — open page, wait 10 s, reload once. Observed “Using the last saved data — no live Teaching Load source is available” and disabled review/save actions. Expected available staging data to run and review the 2022-2023 suggestion.
MAJOR — /subjects — open page, wait 10 s, reload once. Observed source-check/saved-data state and an empty table. Expected subject rows so code hiding and program-chip behavior can be verified.
MAJOR — route changes — click Subjects, Sections, Teachers, or Class Schedule. Observed the new URL while prior-page content persisted during loading (for example, /teachers initially displayed Sections). Expected route content to replace promptly or a page-specific loading state.

Older-user concerns
BLOCKER — Every key page — “Working from saved data” gives no clear next step or person to call; say what is unavailable and offer one safe retry.
BLOCKER — School Year Setup — “Verifying session… Checking your sign-in” leaves the operator stranded; show a time limit and plain recovery action.
MAJOR — Teaching Load — “CROSS-DEPT” and “UNMAPPED SPECIALIZATION” are unexplained jargon; use “Show teachers outside their subject area” and “Show teachers with no matched subject.”
MAJOR — Timetable — “latest run resolves” is technical and passive; say “Your schedule is still loading. Try again in a moment.”
MAJOR — Teaching Load — 20 teacher cards grouped by subject, several filters, and multiple top tools feel dense before a teacher can do useful work.
MAJOR — Subjects — an empty table under “Checking source” invites guessing; keep a single clear progress panel until rows are ready.
MINOR — Navigation — “Class Schedule” and the requested “Timetable” use different names; choose one familiar term throughout.
