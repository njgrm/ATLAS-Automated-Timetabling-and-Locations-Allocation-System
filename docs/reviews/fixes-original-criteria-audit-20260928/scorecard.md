# ATLAS-FIXES (34 items) judged live against the ORIGINAL acceptance criteria — 2026-09-28 ~11:00 +08

Source of criteria: `D:/ATLAS/ATLAS-FIXES-CODEX-PLANNER-HANDOFF.md` (operator's review handoff; untracked in the repo).
Live `a1db27d5`, https://njgrm.buru-degree.ts.net, 1366x768, Lane C `atlas-browser-qa` (Claude in Chrome), read-only.
**Why this exists:** A3's ledger rewrote each item into a narrower "next action" and graded against that, mostly in
source and tests. The operator's team saw the critical problems still live. This scorecard judges only the original text.

| Result | n | Items |
|---|---|---|
| MET | 15 | 02, 04, 05, 09, 13, 17, 18, 19, 21, 23, 30, 31, 32, 33A, 33B |
| PARTIAL | 6 | 03, 07, 14, 15, 16, 26 |
| NOT MET | 6 | 01, 10, 11, 22, 24, 25 |
| UNPERFORMED | 5 | 06, 08, 12, 20, 29 |
| SOURCE_GAP | 3 | 27, 28, 34 |

## Not met / partial — live evidence

| FIX | Original ask | Live |
|---|---|---|
| 01 | Room picker must not detach during outer scroll | Popover for "G8 Room 203" froze at y≈175 while the table scrolled, floating over Rizal/Maka-Diyos |
| 03 | Widen the picker; no clipping | Fixed ≈350 px (not content-adaptive); no clipping in the case tested |
| 07 | No badge/title/utilisation collision on room cards | OK at 94 % zoom; other zooms not stress-tested |
| 10 | Titles ~14–16 px, badges ~11–12 px | SPS/SPA badges **9.6 px** |
| 11 | No premature truncation; two lines allowed | "Makakal…" (Makakalikasan) ellipsised on one line in the G8 Room 103 card |
| 14 / 16 | More viewport; compact header, fewer clicks | `/teaching-load` first data row at **≈430 px of 768** under 7 stacked rows (title+draft status, tabs, % staffed chips, summary bar, Next Step banner, search/filters, group header) |
| 15 | Status, Room Type, Grade, Program directly visible | Room Type and Program still behind "More filters"; `/subjects` first row at **354 px** under 4 rows |
| 22 | Uppercase all teacher names (display layer) | "AGUILAR, CARLO MIGUEL" beside "Alcantara, Roberto" |
| 24 | "Create temporary teacher (Teacher X)" / "Refresh teacher list" | Menu reads "Add temporary" / "Refresh roster" |
| 25 | Review load opens in-page, no navigation | Navigates to `/teaching-load?facultyId=1&task=review` |
| 26 | Remove the permanent inspector; add an audit-summary modal (total/balanced/underloaded/overloaded) | Sidebar gone; "Review teachers" opens a single-teacher modal, not the summary |

Also: no teacher shows as a class adviser anywhere ("No adviser section assigned." on profiles); the cause is under
investigation. `subagent_tokens`: 131,230 + 127,085 + 113,287.
