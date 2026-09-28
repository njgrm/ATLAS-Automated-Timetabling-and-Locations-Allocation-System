# A5 packet — Subjects page: filters + table readability (operator 2026-09-29, two screenshots)

Fresh session. Read AGENTS.md §8 **One look per control** + **Header budget**, and `docs/handoffs/lane-c-to-a2.md`
posts 2026-09-29 00:10 and 00:15 (picker sweep starts on `/subjects`). This packet is the `/subjects` slice of that sweep.

Filters: same `@/ui` picker as /timetable and /teaching-load; each filter names itself untruncated (no `All...`); same
height as search; even widths.
Table (operator: "subjects table is bad right now"):
- Subject codes are exposed as chips (`AP`, `DEVL_READING`, `ENG`) — drop the code chip from the row; the name is enough.
- Program coverage: show the program chips themselves, ABBREVIATED as schedulers know them (e.g. `STE`, `SPA`, `SPJ`,
  `BEC`) — never "4 programs" hiding them, and never the spelled-out "Science, Technology, and Engineering" for one.
  Abbreviation comes from the program code already in data; a HoverCard may give the full name.
- Room need: no raw `OWNER_DEPT:AP` strings anywhere (your earlier OWNER_DEPT work — confirm it covers this cell:
  "Owned by OWNER_DEPT:AP, OWNER_DEPT:MAPEH" is live now). Say `Owned by AP, MAPEH` or move ownership out of Room need.
- Keep rows calm: one line per fact, no stacked sentences.
Tests failing-first; screenshots 1366x768 + 1920x1080 in docs/reviews/. Then continue the picker sweep to Sections,
Faculty, Teaching Load (report a before/after table) and add the vitest guard. One background server, stopped when done.
Push to main after QA; post ready-for-release. Do not end the run to wait for Lane C.
