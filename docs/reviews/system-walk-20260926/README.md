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
| [04](04-what-others-see.md) | dashboard, teacher, public, audit, companions | **four surfaces give four answers to "is it published?"**; public page shows Term 1, and changing the term drops the selected section |

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
3. Public page: diagnose Term 1 (04 #2); keep a valid section when the term changes (`PublicPublishedSchedule.tsx:523`).
4. Review-issues "Must fix" wording (timetable walk #2). The unnamed-violation guard landed on `main` as `9b1ec14a` (not yet live).
5. Drift banner squeezed to one word wide at 390 px; Runs flashes "No generation runs yet" while loading (both from the A2 handoff).
6. The offline school-year record failing its semantic check (01 #1), a term-authority question.

**Planner A — shell, setup, load, audit, companions**
1. Faculty Preferences count vs list (02 #1).
2. One shared outage banner with the saved date, modelled on Teaching Load's (01 #4, 02 keep list); the dashboard must not say "Synced" during an outage (04 #9).
3. Audit "67 blockers" vs readiness "0 Must fix": decide the meaning with A2 (04 #4).
4. Companion links: EnrollPro link feedback when down; SMART and AIMS entry points (04 #6).
5. Raw codes outside the timetable: `OWNER_DEPT:*`, subject codes on public cells, run ids in notifications (01 #3, 04 #8).
6. Setup has no next step (01 #5); under-load has no count (02 #3); year-setup waits forever (01 #2).

**Operator decisions:** lunch-window and 180-minute blocks soft or blocking; Undo in Simple; constraint severity D1–D3; what "blocker" means across audit and readiness.

**Superseded after an authenticated re-check** (`docs/handoffs/planner-a2-timetable-browser-qa-handoff-2026-09-26.md`, accepted 2026-09-26): 03 #2 Policies and 04 #5 Help were not reproduced; 03 #3 Draft is intentional; 04 #3 narrowed to the term switch dropping the section. That handoff is the ordered A2 work list and acceptance packet; it also covers 390×844, which this walk could not reach.

## Cost (`subagent_tokens`)

Timetable 68,237 (blocked, no sign-in) + 132,100; walk 1 100,450; walk 2 91,745; walk 3 119,321 + verification 126,060; walk 4 116,126. **Total 754,039.**
