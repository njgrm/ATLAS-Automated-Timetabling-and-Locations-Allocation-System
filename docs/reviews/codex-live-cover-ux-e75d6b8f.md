surfaces 7 · clicks-to-cover-with-real-teacher 0 (blocked: no open class is reachable) · cross-dept control: FOUND at /teaching-load Teachers filter, “Cross-subject” · verdict REJECT_UX

Scope: read-only Brave audit of https://njgrm.buru-degree.ts.net only. Every visited page asserted `window.location.origin === "https://njgrm.buru-degree.ts.net"`. The connected browser did not honor the requested 1366x768 override (reported 1536x679); screenshots therefore show that actual viewport. No save, apply, create, delete, or assignment action was taken; opened panels/dialogs were closed.

1. Teaching Load header and staffing controls — [01-teaching-load-overview.png](shots/01-teaching-load-overview.png)
Shows: “72 classes short: MAPEH 20, Science - Biology 8, Mathematics 6 · 29 Sept roster”; “Cover these classes”; “Next step — to be hired, MAPEH is still a temporary substitute”; “72 classes still need a real teacher”; “Cross-subject”; “No subject match”. “Suggest assignments” and “Cover these classes” look like primary actions, but were unavailable during source checking.
MAJOR — header promises 72 short classes while the workflow is disabled/using “last saved roster”; the warning, badge, disabled-looking actions and status messages compete in one thin band. Fix: one plain source-status banner, then either a usable list or one disabled primary action with the exact recovery condition.
MINOR — “Cross-subject” is a tiny unlabeled switch next to filters; it looks like a display filter, not permission to cover another department. Fix: label it “Include qualified teachers from other subjects” and explain its effect.

2. Suggested-assignment review — [02-suggested-assignments-review.png](shots/02-suggested-assignments-review.png)
Shows: “Checking Teaching Load suggestion”; “REAL TEACHERS FIRST, UP TO 30H/WEEK”; “PREVIEW FIRST”; “NO TEACHING LOAD ROWS WERE SAVED BY OPENING THIS REVIEW”; “Apply suggested Teaching Load”. A completed pass also said “264 KEPT EXISTING”, “0 REAL-TEACHER SUGGESTIONS”, “0 TEMPORARY SUBSTITUTE”, “0 STILL UNRESOLVED” while the page still said 72 need a real teacher.
MAJOR — contradictory shortage and preview totals make the review unsafe to trust; “Apply” remains present beside a checking state. Fix: suppress Apply and show one reconciled count until the source is current.
MINOR — two visible “Close” controls duplicate the escape route. Fix: one standard top-right Close plus one footer Cancel.

3. Sections / open-class route — [03-sections-needs-staffing.png](shots/03-sections-needs-staffing.png)
Shows: “Filter: Needs staffing”, “No sections match Needs staffing”, “No section currently matches Needs staffing. Switch to All sections to review every section.” “Show all sections” reveals 20 sections, all “STAFFED”, although the header still says 72 need real teachers.
MAJOR — zero open classes means no “Assign teacher”/“Cover” control and no path to give a real teacher to one class (0 clicks possible). Placeholders are apparently counted as staffed here. Fix: make “Needs staffing” include “to be hired” assignments and open the affected subject row directly.
MINOR — “Show all sections” is a detour from a dead-end state and does not explain why 72 conflicts with zero. Fix: state “72 are covered by temporary placeholders; show them”.

4. Teacher cards and temporary records — [04-teachers-roster.png](shots/04-teachers-roster.png)
Shows 34 teachers and “Temporary teachers 14”. Placeholders lead the roster: “— TO BE HIRED, MAPEH”, “1 — TO BE HIRED, TEACHER”, etc., each tagged “Temporary”, with “Review temporary” and “Profile”. Real teachers follow. Cards expose “Review load” and “Edit assignments”; edit expands inline with “QUALIFIED SUBJECTS”, “UNASSIGN ALL”, and “UNASSIGN GRADE”.
MAJOR — 14 to-be-hired records are sorted before real people, the opposite of a last-resort staffing decision; red “Review temporary” actions dominate the first screen. Fix: always list real teachers first and put a collapsed “Temporary placeholders — last resort (14)” section at the bottom.
MAJOR — “UNASSIGN ALL” and “UNASSIGN GRADE” sit inside a per-teacher editor with no safe visual separation from review. Fix: move destructive actions into an Advanced menu and make the normal action “Cover an open class”.
MINOR — compact grade-number badges and “Any grade/Wide span” badge noise are hard to scan; upper-case names and mixed information density feel bureaucratic. Fix: use one readable qualification line: “Can cover: Grade 7–10 · Filipino, Reading”.

5. Review load — [01-teaching-load-overview.png](shots/01-teaching-load-overview.png)
Opening “Review load” for REYES, JANELLA MARIE opens “STAFF WORKLOAD AUDIT”, a staff-wide modal with 20 people, despite the label implying one teacher. It says “Narrowed to REYES…” but the whole roster remains.
MAJOR — label/action mismatch adds a large modal before a scheduler can judge one candidate. Fix: open that teacher’s concise load card first; offer “View staff-wide audit” separately.

6. Teacher profile / permission location — [04-teachers-roster.png](shots/04-teachers-roster.png)
A real profile shows “DEPARTMENT Filipino”, “SUBJECTS 2”, assigned subjects and sections, hours, and “CLOSE PROFILE”. No edit control, “can teach outside their department” setting, or subject-permission control appears. “REVIEW TEMPORARY” appears as non-action-like text in a permanent teacher’s profile.
MAJOR — no discoverable place to grant a qualified teacher another subject/department. Fix: add “Teaching permissions” on the profile with “May cover other subjects” and a subject checklist.
MINOR — “REVIEW TEMPORARY” reads as a button/section but has no clear relevance for a permanent teacher. Fix: remove it or replace it with a specific temporary-assignment warning only when applicable.

7. Subjects / coverage — [subjects-overview.png](shots/subjects-overview.png)
Shows 21 active subjects, “MISSING COVERAGE 0”, each row’s “TEACHER COVERAGE” (for example “Owned by AP, MAPEH”, “Full coverage”) and “Review coverage”. There is no visible chooser of teachers from other departments; the coverage-review interaction was not consistently reachable while the live source was checking.
MAJOR — ownership text is descriptive, not a scheduler control; it cannot authorize a real teacher outside the owning department. Fix: in “Review coverage”, show eligible real teachers across departments first, labeled “Subject match” or “Cross-subject qualified”; put placeholders last.
MINOR — “Full coverage” conflicts with the Teaching Load shortage language, creating the same false reassurance. Fix: distinguish “real-teacher coverage” from “temporary coverage”.

Redesign brief
1. On an affected class, show one calm button: “Cover this class”.
2. Open a small panel headed with section, subject, grade, weekly hours, and why it is open.
3. List real teachers first, ranked by subject match, free capacity, then cross-subject qualification.
4. Label a cross-department candidate plainly: “Qualified for this subject · Home: Filipino”.
5. One click selects a teacher; show the new weekly hours and any clash in plain language.
6. Keep “to be hired” in a collapsed final row: “No real teacher available — temporary placeholder”.
7. Never call a placeholder “staffed” or “full coverage”.
8. Use one Confirm assignment action only after review; Cancel/Escape always leave no draft.
9. Keep source freshness in one small banner; do not mix incompatible counts.
10. Let Subjects and Teacher profile both edit the same visible teaching-permission list.
