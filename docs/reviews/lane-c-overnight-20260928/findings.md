# Lane C overnight live findings — 2026-09-28 (live `d31bfacb`)

Runner: Lane C `atlas-browser-qa` on Claude in Chrome. Origin https://njgrm.buru-degree.ts.net. Read-only.

| Row | Live answer (quoted) | Verdict | Owner |
|---|---|---|---|
| #53 map tiles (01:35) | Campus map (More › Tools › "Campus map"): Grade 7 Wing "0% FILLED", Grade 8 Wing "0% FILLED", Grade 9 Wing "0% FILLED", Grade 10 Wing "0% FILLED", Speech Lab "0% FILLED", while GR7 - Luna has a full Term 2 week in G7 Room 103. (ss_1861piib9) | **FAIL** — `1e417694` fixed Building view only; the map tile path still prints a fabricated 0% | A3 |
| #53 Building view (01:35) | Grade 7 Academic Wing rooms: "G7 Room 401 — Classroom / Capacity: 45 / n/a", "G7 Room 103 … n/a", "G7 Room 105 … n/a". "n/a" has no label; room 103 is occupied all week. (ss_9672lmlyg) | **FAIL (UX)** — honest but unlabelled, and it contradicts the map's "0%" for the same building. Show the real use ("32 of 40 periods used") or a labelled "Use: not available yet" | A3 |
| #52 (01:35) | First render of `/timetable/map` from More shows the previous GR7 - Luna class grid (Mon–Fri TLE/SCIENCE/MAPEH) for ~2 s before the map. (ss_2662embwr) | **FAIL** — show a loading state, not the stale grid | A3 (A2 if the route shell is timetable-owned) |

Grades for older, mouse-first users: the meaning of the number is not obvious; the map tiles have a colour cue but
Building view rooms have none; the wording is short, but the missing label costs clarity.

`subagent_tokens`: 89,509.
