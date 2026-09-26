# System walk — whole-product UX QA of live `26f7c907` (2026-09-26)

A read-only walk of every ATLAS surface on the live Tailnet release, judged as a veteran school scheduler
would judge it, by the Claude Code QA session (operator role change, 2026-09-26). Claude in Chrome,
operator session, 1536×730. EnrollPro's host was down throughout. Nothing was created, saved, generated or
published.

| Walk | Surfaces | Worst finding |
|---|---|---|
| [timetable](../timetable-live-walk-20260926/findings.md) | `/timetable` | 100/194 warnings unnamed (being fixed by Planner A) |
| [01](01-year-setup.md) | year setup, subjects, sections, teachers, rooms | saved school-year record fails its own check, so setup cannot resolve the year offline |
| [02](02-teaching-load.md) | Teaching Load, faculty pages | Faculty Preferences: "Missing 42" over an empty list |
| [03](03-timetable-rest.md) | timetable sub-views, publish, export | **Room Schedules merges terms and reports false hard double-bookings** |
| [04](04-what-others-see.md) | dashboard, teacher, public, audit, companions | **four surfaces give four answers to "is it published?"**; public page shows Term 1, and its section picker is dead |

## The pattern

ATLAS rarely lacks the fact. It states the fact **differently on each page**. Examples: 0 Must fix vs 67
blockers vs 10 conflicts; published vs draft vs "Live"; Term 2 vs Term 1; "Synced from EnrollPro" vs "using
saved data"; three versions of the outage banner. Last night's plain-language cycles made the timetable
internally consistent. The next gain is **cross-page consistency**: one resolver per fact (lifecycle state,
blocker count, active term, source freshness), used by every page that shows it.

## Priority list (for the implementing planners)

**A2 — timetable and publication**
1. Room Schedules must pass the selected term (default active, never all). False conflicts today (03 #1).
2. One lifecycle statement shared by dashboard, timetable, `/my` and public: published (date, term) + draft in review (04 #1, 03 #4). Stop tagging draft rows "Live" (04 #7).
3. Public page: diagnose Term 1 (04 #2) and the dead section picker (04 #3).
4. Unnamed-violation guard (Planner A's in-flight candidate) + Review-issues "Must fix" wording (timetable walk #1–2).
5. The "Draft" tab showing an empty grid (03 #3); Policies not loading (03 #2).
6. The offline school-year record failing its semantic check (01 #1), a term-authority question.

**Planner A — shell, setup, load, audit, companions**
1. The Help button crash (04 #5).
2. Faculty Preferences count vs list (02 #1).
3. One shared outage banner with the saved date, modelled on Teaching Load's (01 #4, 02 keep list); the dashboard must not say "Synced" during an outage (04 #9).
4. Audit "67 blockers" vs readiness "0 Must fix": decide the meaning with A2 (04 #4).
5. Companion links: EnrollPro link feedback when down; SMART and AIMS entry points (04 #6).
6. Raw codes outside the timetable: `OWNER_DEPT:*`, subject codes on public cells, run ids in notifications (01 #3, 04 #8).
7. Setup has no next step (01 #5); under-load has no count (02 #3); year-setup waits forever (01 #2).

**Operator decisions:** lunch-window and 180-minute blocks soft or blocking; Undo in Simple; constraint severity D1–D3; what "blocker" means across audit and readiness.

**Not verified:** phone widths. Chrome's window cannot be resized below desktop in this environment, so a different method is needed (a real phone on the Tailnet, or a narrowed desktop window set by the operator).

## Cost (`subagent_tokens`)

Timetable 68,237 (blocked, no sign-in) + 132,100; walk 1 100,450; walk 2 91,745; walk 3 119,321 + verification 126,060; walk 4 116,126. **Total 754,039.**
