# System walk 4 — dashboard, teacher view, public schedule, audit, companions (2026-09-26)

**Release:** `26f7c907`. **Method:** read-only `atlas-browser-qa` on Claude in Chrome, 1536×730, operator
session, with the wait-for-loading rule. Tally **7 observed / 1 blocked (SSO) / 0 unperformed**. EnrollPro is
down. **Perspective:** the scheduler, and also the principal, a teacher and a parent who see the result.

## Verdict

**Each surface tells a different story about the same schedule.** The dashboard says "Schedule is
published — Faculty and students can see the timetable" (Phase 5/5). The timetable shows run 318 in
review with "Publish schedule". The teacher's own page shows "Review draft ready … Draft schedules may
still change" with every class tagged "Live". The **public page shows TERM 1** while the active term is
Term 2. The audit page says **"67 readiness blockers must be fixed"**, while the timetable says "0 Must
fix" and the dashboard says "9 OF 10 READY". Each may be defensible in isolation (there *is* a schedule
published on 23 Sep and a new draft in review), but no page says so. A principal asking "is the timetable
done?" gets four answers. Two public-facing defects make it worse: selecting a section on the public page
does nothing, and the Help button does nothing (once it crashed to an error page).

## Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **No single answer to "what is published, and what is in progress?"** Dashboard: "Schedule is published… Phase 5/5 Published", "Timetable generated and reviewed — 584 warnings acknowledged". Timetable: run 318 "Latest/Reviewing", 194 warnings, "Publish schedule". Teacher `/my`: "Schedule review is in progress. Draft schedules may still change." Notifications: "Official schedule has been publish… 9/23/2026". The dashboard needs one line naming both: *Published: 23 Sep (Term …). New draft in review: 25 Sep, not yet visible to teachers.* | P1, P2, P4, X1 | **BLOCKING** (trust) |
| 2 | **Public schedule shows Term 1.** `/public/schedules` shows a "TERM 1" chip, "Official schedule", "Published schedule view / Live publish", while the school's active term is Term 2. Either the 23 Sep publication covers Term 1 only, which the page should say ("Term 2 not yet published"), or the public page defaults to Term 1, which breaks the timetable term invariant ("never Term 1 by default"). Diagnose read-only first. | P5 | HIGH (possible §7) |
| 3 | **Public page: picking a section does nothing.** Clicking "Luna, GR7, 40 classes, Regular" left the detail pane on "Aguinaldo", twice. `/public/schedule` redirects to `?sectionId=143` (Aguinaldo). This is the page a parent uses. | P5 | HIGH |
| 4 | **Audit contradicts readiness.** `/audit`: "Blockers: 67", "Needs fixes before scheduling — 67 readiness blockers must be fixed before scheduling review is reliable.", with groups "Fix teacher assignments 28" (e.g. "CRUZ, PAOLO BENJAMIN is assigned to TLE Exploratory - ICT… Required: ICT. Current record: TLE"), "Resolve section gaps 36" and "Check rooms and facilities 3". Timetable readiness: "0 Must fix". Dashboard: "9 OF 10 READY". If these 67 are real, the timetable's "ready" is wrong. If they are advisory, "blockers" is the wrong word. Also, `/audit` is named like an activity log but is a readiness report, and there is no who-changed-what log anywhere. | P3 | HIGH |
| 5 | **Help is broken.** The header "Help" button opened nothing; one click left the tab on an internal error page until `/` was reloaded. The guide exists only at `/timetabling/how-it-works` by typed URL. | P7 | HIGH (crash) |
| 6 | **Companion apps are not reachable.** The only link found is the profile menu's "Back to EnrollPro" (`https://dev-jegs.buru-degree.ts.net/dashboard`). Clicking it did nothing visible, no tab and no error, even though EnrollPro is down and a clear "EnrollPro is unreachable" message is owed. No SMART or AIMS link appears anywhere in the shell, dashboard or menus, although two-way SSO with all three is a stated objective. | P6 | MEDIUM (HIGH for the demo objective) |
| 7 | **The teacher's page tags draft classes "Live".** Every class row on `/my` carries "Live" under a banner saying the draft may still change. A teacher will read "Live" as final. | X1 | MEDIUM |
| 8 | **Codes and ids reach parents and teachers.** Public cells show "TLE_ICT_EXP", "SCI_BIO". Notifications show "Generation run #318 completed…", "ATLAS server recovered from a inte…" (grammar, and a server event shown to a scheduler), in US date format "9/25/2026, 9:28:27 PM". The audit shows "Average roster load: 55.6%". | P3–P5 | MEDIUM |
| 9 | **The dashboard claims a sync during the outage.** "Teachers 42 (Synced from EnrollPro)", while every other page says it is using saved data because EnrollPro cannot be reached. Also "1 building have no rooms", and the campus widget opens on "Speech Lab… 0 teaching rooms ready". | P1 | LOW |

## Keep

- The dashboard answers "where are we?" at a glance with four counts and a phase, and its cards carry actions ("Open schedules").
- The teacher's page is warm and useful: "Welcome back, Rizal," the load tiles, "Nothing needs your attention.", and a class list with day, time and room. The request model is explained: "Free slots create move requests. Occupied slots create swap requests for scheduler review."
- The public page has the right shape: a section list with grade/program filters, a count ("40 published classes are shown") and an "Official schedule" label.
- Notifications are not marked read just by opening the panel.

`subagent_tokens`: 116,126 (64 tool calls).

## Hand-off

- **A2 (timetable / publication):** findings 1, 2, 3 and 7. Findings 2 and 3 need read-only diagnosis first.
- **Planner A (shell, dashboard, audit, companions):** findings 4, 5, 6, 8 and 9. Finding 5 comes first because it crashes. Finding 4 needs a decision on what "blocker" means across audit and readiness. That decision is shared with A2.
