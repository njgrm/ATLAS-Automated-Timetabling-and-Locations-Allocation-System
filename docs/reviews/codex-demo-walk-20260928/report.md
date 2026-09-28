19 issues: 2 B / 5 M / 12 m across 12 pages

Audit conditions: existing `Your Brave` profile; `https://njgrm.buru-degree.ts.net` asserted on every screen; 1366x768; one hard reload; read-only. All inspected routes remained on that origin. Excluded: `/timetable*`, `/teaching-load`, and `/schedules` (Room Schedules).

| route | issue | severity | what good looks like |
|---|---|---:|---|
| `/` Dashboard | Says “Schedule is published” and “Verified live readiness data” while its own readiness is 5/10 or 6/10, its hard-violation state alternates between unavailable and “149 warnings acknowledged,” and linked setup is incomplete. | M | Show one stable, dated source of truth and plainly distinguish a published historical schedule from current setup readiness. |
| `/` Dashboard | “Open schedules” appears in two places and the lifecycle/readiness stack competes with the declared single “next step”; small letter-spaced/all-caps helper labels slow scanning. | m | Present one primary action and collapse secondary lifecycle detail behind clear, sentence-case labels. |
| `/` Dashboard | “1 building have no rooms” is grammatically wrong and the tile’s 78/103 and “6 ready” are not explained. | m | Use plain language and name exactly what each room count represents. |
| `/sections` | Direct entry first showed a blank content pane with no loading cue before the table settled. | M | Keep a visible skeleton or “Loading sections…” state until the roster is ready. |
| `/sections` | The wide table hides the Details/actions column at 1366px; a bottom horizontal scrollbar is required. | m | Keep the primary row action visible or use a compact card/detail pattern before horizontal scrolling. |
| `/subjects` | Room needs expose stored values such as `OWNER_DEPT:AP` and `OWNER_DEPT:MAPEH`; the page admits it has no plain name. | m | Translate stored codes to readable room/department names and reserve codes for optional detail. |
| `/subjects` | The right-side Review/action control is clipped, with a horizontal scrollbar below the rows. | m | Keep the row action in view at the supported desktop viewport. |
| `/teachers` | The same name, GARCIA, ANNA PATRICIA, appears once with 18.8/30h and once with “No load,” so the roster cannot be trusted at a glance. | M | De-duplicate or visibly distinguish identities, then show one authoritative load. |
| `/teachers` | “Below standard” is repeated as a status without explaining whether it is a problem, target, or harmless load gap. | m | State the target and the practical next step in ordinary scheduling language. |
| `/faculty/concerns` | “Active ordered term unresolved” disables the intended workflow, despite the shell/Dashboard showing active year 2031-2032 and Term T2. | B | Resolve and display the selected year/term consistently, or give a single recoverable action and reason. |
| `/faculty/room-preferences` | Empty state is reached with Submitted and Pending filters already selected, but it does not say that these filters are excluding other requests. | m | Say “No submitted, pending requests” and offer a clear-all-filters control. |
| `/faculty/room-preferences` | “Current working schedule Version 7,” “active run,” and collaborator count lead the page although there are zero requests. | m | Lead with “No room requests” and place version/collaboration detail in a secondary status line. |
| `/map` | Dashboard says 78/103 teaching rooms and 6 ready; this page totals 15 Ready + 63 Needs section + 25 Unavailable (=103). | M | Use the same named categories and totals on both pages, with one link to the source list. |
| `/map` | “Edit rooms,” “Edit map,” and “Open map” are competing routes from the same overview, while “Fix rooms first” gives no one next action. | m | Provide one clearly named primary action that opens the exact room-fixing workflow. |
| `/audit` | “81 readiness blockers must be fixed before scheduling review is reliable” directly conflicts with Dashboard’s published/verified state. | M | Explain the scope/date of the audit versus the published schedule, or remove the contradictory success claim. |
| `/audit` | “Average roster load: 56.6%” has no target, meaning, or decision attached to it. | m | Label the target/range and say whether this percentage needs action. |
| `/admin/year-setup` | The page remains “Checking/Waiting for EnrollPro school year status” and says the active year is unresolved while the header says it is active. | B | Either resolve the status or show a specific retry/error and a safe next action; never contradict the global year. |
| `/admin/year-setup` | A “Year setup” link points to the current page beside Preview, creating a duplicate/dead-looking control. | m | Remove the self-link or replace it with a useful, distinct destination. |
| Notifications popover on `/` | Recent notices expose raw operations/IDs (`MOVE_ENT...`, `entry-321::t2`) and long notices are clipped in the narrow popover. | m | Use a scheduler-readable summary, subject/section names, and an expandable detail view. |
| Accessibility menu on `/` | No issue observed: text-size controls are exposed with usable accessible names; the small popover covers only a limited portion of the header. | — | Retain this simple, reversible control. |
| `/not-found` | No issue observed: it names the bad address, explains that nothing else opened, and offers one Dashboard return path. | — | Retain this direct recovery state. |

## Top 15 for the demo

1. **B — Teacher Concerns:** active term is unresolved, so a core teacher-input workflow is unavailable despite T2 being shown as active elsewhere.
2. **B — School Year Setup:** the admin recovery page is stuck waiting for EnrollPro while contradicting the global active-year badge.
3. **M — Dashboard:** “published/verified” beside incomplete or unavailable readiness makes the first screen untrustworthy.
4. **M — Audit:** 81 blockers versus “Schedule is published” leaves a veteran scheduler unsure whether the timetable is safe.
5. **M — Campus & Rooms:** room totals and readiness disagree with the Dashboard, so users cannot tell what needs fixing.
6. **M — Teachers:** duplicate GARCIA, ANNA PATRICIA records give mutually incompatible loads.
7. **M — Sections:** a blank, unlabelled first paint can look like a failed page rather than normal loading.
8. **m — Subjects:** raw `OWNER_DEPT` codes leak implementation language into room decisions.
9. **m — Room Preferences:** selected filters can make a non-empty queue look empty.
10. **m — Notifications:** raw entry IDs and clipped messages do not tell a scheduler what changed.
11. **m — Dashboard:** too many lifecycle/readiness elements and duplicate “Open schedules” compete with “Your next step.”
12. **m — Campus & Rooms:** three overlapping map/edit entry points force a choice before the user knows the difference.
13. **m — Sections:** primary row actions disappear beyond a horizontal scrollbar.
14. **m — Subjects:** review controls are clipped at the right edge of the table.
15. **m — Teachers:** unexplained “Below standard” labels make normal load review sound like a defect.
