pages 11 · wrong values 12 · contradictions 6 · garbled 0 · ux-audit MAJOR 37

Live read-only audit, 2026-09-29. Every recorded page asserted `window.location.origin === https://njgrm.buru-degree.ts.net` and `1366x768`. The supplied audit script failed because this page replaces global `parseFloat` with a non-function; its otherwise identical audit was rerun with `Number.parseFloat`. No state-changing control was used.

## Wrong values

| Page/dialog | Exact text | Rule broken | Severity |
|---|---|---|---|
| School Year Setup | `2031-2032 is a past year that you have not kept as history yet.` | A saved-data year in the future of 2026-09-29 cannot be a past year. | BLOCKER |
| School Year Setup | `2030-2031 is a past year that you have not kept as history yet.` | Same future-date violation. | BLOCKER |
| School Year Setup | `2029-2030 is already kept as history.` | Same future-date violation. | BLOCKER |
| Archived Teaching Load | `Read-only history — 2029-2030` / `Archived year: 2029-2030` | Saved history is future-dated. | BLOCKER |
| Sections | `GR7`, `GR8`, `GR9`, `GR10` | Raw grade codes are displayed rather than the school’s grade values 7–10. | MAJOR |
| Teachers | `WITH LOAD 34/34` | It counts all 34, including `Temporary teachers 14`; placeholders must not count as staffed/covered. | BLOCKER |
| Teachers | `STE_APPLIED_PHYS 1, STE_RESEARCH 1`; `TLE_ICT_EXP`; `SCI_BIO` | Raw internal subject codes appear on-screen. | MAJOR |
| Subjects | `Full coverage` for subjects whose displayed coverage is supplied by temporary teachers | A placeholder is explicitly “not a real teacher”; it cannot establish full real-teacher coverage. | BLOCKER |
| Teaching Load | `72 classes short: MAPEH 20, Science - Biology 8, Mathematics 6` and `72 classes still need a real teacher.` | This conflicts with the displayed “full coverage” catalogue state. Acting on either can produce the wrong staffing decision. | BLOCKER |
| Dashboard | `Timetable made and checked` is shown in the readiness list | `/timetable` says `No 2023-2024 timetable yet`. | BLOCKER |
| Campus & Rooms | `Room readiness 0 rooms need something fixed, in 1 building.` | A building with zero rooms and a selected building that “Needs rooms” is itself an unresolved readiness condition. | MAJOR |
| Dashboard / Campus & Rooms | `100%` beside `0 teaching rooms ready` (dashboard selected Speech Lab) | A 100% readiness value beside zero usable teaching rooms is misleading on its face. | MAJOR |

## Contradictions

| Fact | Value A @ where | Value B @ where | Which is right if known |
|---|---|---|---|
| Timetable existence | `Timetable made and checked` @ Dashboard | `No 2023-2024 timetable yet` @ Class Schedule | Class Schedule is the direct schedule state; dashboard value is wrong. |
| Staffing/coverage | `MISSING COVERAGE 0` and repeated `Full coverage` @ Subjects | `72 classes still need a real teacher` @ Teaching Load | Teaching Load explicitly excludes temporary substitutes; its shortage is the decision-safe value. |
| Teacher staffing total | `WITH LOAD 34/34` @ Teachers | `Temporary teachers 14` / `72 classes still need a real teacher` @ Teachers / Teaching Load | Do not count placeholders: no evidence supports 34 real staffed teachers. |
| Room denominator | `Teaching Rooms 78/103` @ Dashboard | `78 of 78 teaching rooms are ready` @ Campus & Rooms | Not resolvable from screen; the readiness denominator is inconsistent. |
| Room readiness | `7 ready · 1 building have no rooms` @ Dashboard | `0 rooms need something fixed, in 1 building` @ Campus & Rooms | The building with no rooms is unresolved; zero-needed is wrong. |
| Historical date | active 2023-2024 @ shell/year setup | “past”/archived 2029-2030 through 2031-2032 @ Year Setup/History | 2029–2032 are future relative to audit date; labels/data are wrong. |

## ux-audit summary and MAJOR items

Numbers are `major / mojibake / moreFilters / overflowing / smallText / tableCellsUnder16 / truncated`.

| Page | Numbers |
|---|---|
| `/` | 1 / 0 / 0 / 0 / 38 / 0 / 8 |
| `/admin/year-setup` | 1 / 0 / 0 / 0 / 31 / 0 / 6 |
| `/sections` | 10 / 0 / 1 / 0 / 40 / 147 / 7 |
| `/subjects` | 15 / 0 / 1 / 0 / 40 / 138 / 34 |
| `/teachers` | 7 / 0 / 1 / 0 / 40 / 130 / 38 |
| `/teaching-load` | 1 / 0 / 0 / 0 / 40 / 0 / 9 |
| `/teaching-load/history` | 1 / 0 / 0 / 1 / 24 / 0 / 8 |
| `/faculty/concerns` | 0 / 0 / 0 / 0 / 18 / 0 / 5 |
| `/map` | 1 / 0 / 0 / 0 / 33 / 0 / 6 |
| `/room-schedules` | 0 / 0 / 0 / 0 / 22 / 0 / 5 |
| `/timetable` | 0 / 0 / 0 / 0 / 27 / 0 / 7 |

MAJOR items: `More filters` is visible on Sections, Subjects, and Teachers; text below 12px occurs on every nonzero-major page (e.g. School Year Setup `ADMIN ONLY` 10.4px; Sections `GR7` 11px; Subjects grade/program chips 9.6px; Teachers `Temporary` 10.4px; Teaching Load `3` 10px; Map `100%` 11px); History’s `Archived year: 2029-2030` combobox needs 186px inside a 126px box. Mojibake was zero on all captured loaded pages.

## Scope limitation

The requested scripted page sweep completed only at loaded-page level. The supplied audit script was retained in the browser session and JSON captured for each page, but the audit tab had to be created after the existing user tab could not be claimed; I did not complete the requested dialog-by-dialog sweep (three teacher profiles/reviews, staffing windows/suggestion, two concerns, or room/teacher/section pickers). Thus this is a confirmed defect report, not evidence that no further defects exist.
