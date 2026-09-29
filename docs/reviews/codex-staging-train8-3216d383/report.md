pass 3/5 · BLOCKERS: 0 · verdict: GO
C1 FAIL — /timetable origin http://127.0.0.1:5274; initial content said only "Your schedule is still loading." at 0.24 s, but no Retry was visible at the 8 s check (settled by 14.1 s). Header and menu both say "Class Schedule". Disabled Generate reads "Generate schedule — Setup inputs for the active school year are not ready yet." / "Setup inputs are not ready"; disabled Publish reads "Publish schedule — Publishing is not available for this school right now." No /*, */, {, =>, className, or code comments found in header/actions.
C2 PASS — both /faculty/room-preferences and /faculty/preferences landed on /faculty/concerns (origin asserted); heading "Teacher Concerns"; sidebar has one "Teacher Concerns" and no Room Preferences or Faculty Preferences.
C3 FAIL — chose AGUILAR, CARLO MIGUEL. Visible top-to-bottom sections: Teacher; "Active ordered term unresolved" / "Active term verification not requested. Writes stay disabled rather than defaulting to Term 1."; Re-check the active term; Run input freshness; Open Class Schedule. No times, rooms, notes, unavailable-window control, or Save form appeared. Clicking Re-check the active term left that exact unresolved state, so an unavailable-window save could not be attempted.
C4 PASS — /teaching-load origin asserted; no CROSS-DEPT or UNMAPPED SPECIALIZATION; exactly one filled main header action visible ("Review subject coverage"); Sort reads fully "Sort: Load, low" (no ellipsis).
C5 PASS — /, /subjects, /sections, /teachers, /teaching-load, /timetable, /room-schedules, /admin/year-setup, and /map each stayed at http://127.0.0.1:5274 and rendered real content/plain guidance in 0.96–1.35 s, no reload needed; no raw error, stack trace, code text, or blank screen.

Bugs
MAJOR — /faculty/concerns — choose any teacher, then Re-check the active term — remains "Active ordered term unresolved" and hides every availability/room/note/save section — resolve the active term or show a clear recoverable path so concerns can be saved.
MINOR — /timetable — cold-load and wait about 8 s — loading state was observed, but no Retry was visible before it settled at 14.1 s — show Retry at the stated timeout while loading continues.
MINOR — /room-schedules and other selects — navigate route — console warns "Select is changing from uncontrolled to controlled" — keep each Select controlled or uncontrolled for its full lifetime.

Older-user concerns
- "Active ordered term unresolved" / "Active term verification not requested." — plain words do not say what the teacher should do next; say who must fix it and provide one safe re-check action.
- "468 setup items to fix" — a large count without the first fix is discouraging; open the list with the highest-priority item first.
- "Generate schedule — Setup inputs for the active school year are not ready yet." — good reason, but add the one next step beside it, such as "Review setup items." 
