# System walk 3 — the rest of the timetable, and generate → publish → export (2026-09-26)

**Release:** `26f7c907`. **Method:** two read-only `atlas-browser-qa` runs on Claude in Chrome at 1536×730.
The first run (11 rows) read five pages before they finished loading and reported them empty. A second run
(V1–V8) waited up to 25 s and took screenshots, and it **corrected** those rows. Only verified facts are
used below. Console: 0 errors. **Perspective:** a veteran scheduler taking a draft to official printouts.

## Verdict

**Room Schedules reports hard double-bookings that the timetable says do not exist.** `G7 Room 103` shows
"10 conflicts". Its inspector reads "Room Time Conflict — multiple classes occupy this room at the same
time." and "Teacher Time Conflict — a teacher is double-booked in this slot.", listing **3× AP / Luna /
FERNANDEZ and 3× MATH / Luna / AQUINO at Mon 9:45–10:30**. Meanwhile Publish Readiness says "Whole year: 0
Must fix". Three copies of each class in one slot is the signature of **three terms stacked into one
view**. The code confirms it: the page fetches `/room-schedules/…/rooms/:id?source=…` **without
`termIndex`** (`RoomSchedules.tsx:227-231`), and the server keeps "the existing all-term read behavior" when
it is absent (`room-schedule.service.ts:228-239`). A scheduler shown this would stop the release, or start
"fixing" conflicts that are not real. It also breaks the timetable term invariant: a view must never mix
terms.

The rest is slower and more confusing than it is broken. Setup takes about 13 s, Runs about 18 s, and
Policies never finished loading in 25 s. The "Draft" tab shows an empty grid where the main view shows
classes. Nothing on the main page says whether you are looking at the draft or at what teachers see.

## Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **False hard conflicts in Room Schedules (terms merged).** Details above. The page has a term selector only for *download* ("Choose one term"), none for viewing. Fix: send the selected term (default the active term, never all) and show it in the header. The same check applies to the Teachers and Sections tabs on this page. | V8, code | **BLOCKING** (trust + §7 invariant) |
| 2 | **Policies does not load.** `/timetable/policies` showed "Loading policy workspace…" after 18–25 s of polling, and no policy control ever appeared. Needs one timed reload to separate "very slow" from "stuck". Either way, a scheduler cannot open the rules. | V3 | HIGH (verify) |
| 3 | **"Draft" shows an empty timetable.** The `Draft` tab (`/timetable/pre-generation`, "Working schedule draft") shows 0 classes for Term 2 / GR7 - Luna, while `Schedule` shows the full week for the same selection. To a scheduler, "my draft is empty" means work was lost. If this view means *before generation*, name it that; if it is the draft, it must show the draft. | V5 | HIGH (confusion) |
| 4 | **Which schedule is live is never said.** Runs lists 318 (Latest/Reviewing, v1), 317 (v2), 316 (v1), 315 (v3), 314 (v3), all "Finished". None is marked *published* or *what teachers see*, and "v1/v2/v3" is unexplained. The main page has no draft/published label, and "Publish schedule" is an always-enabled red button. | V2, X1 | HIGH |
| 5 | **Slow pages.** Setup about 13 s, Runs about 18 s behind "Loading runs…", Policies over 25 s. The main `/timetable` opens in about 3 s. These are sub-views of the same mounted workspace (`App.tsx:148-177`), so the delay is their own data, not the shell. | V1–V3 | MEDIUM |
| 6 | **Engine text in Room Schedules.** "Run #318 · COMPLETED", "Utilization: 44.44%", "Occupied: 1800/4050 min". The source mode "Enter a valid Run ID" asks a scheduler for a database id. Plain version: "Latest schedule (generated 25 Sep, 4:13 PM) · room in use 30 of 67.5 hours (44%)". | P8 | MEDIUM |
| 7 | **Help lives at a different address and uses the old words.** `/timetable/how-it-works` silently returns to `/timetable`; the page is at `/timetabling/how-it-works`. Its glossary teaches "DRAFT, RUN, VIOLATION, FOLLOW-UP, PREVIEW, COMMIT" and "hard constraints (red)", while the timetable now says "Must fix". | P7 | LOW |
| 8 | **Manual Edit has no way in.** Reachable only by typing the URL. Its empty state is good ("Select a class on the schedule grid first, then open Move, Change room, or Swap…" + "Back to Schedule"), so this is only a dead page if someone bookmarks it. | V4 | LOW |

## Keep

- **Views agree for a real class:** GR7 Luna, Thu 10:45, ENG, RAMOS, CAMILLE JOY, G7 Room 103 shows the same on the Section view, the room's schedule and the teacher's schedule.
- **The download dialog is the best-explained screen in the product:** "Choose Word for official printable forms or Excel for editable working schedules. Downloads use one completed run and one ordered term. Selecting several items creates one ZIP package." Word is the default, Section is the default scope, and the footer confirms "1 selected · 2031-2032 · Term 2". "Header and signatories" is there, as an official form needs.
- The Setup check says what it does: "ATLAS is checking the school year and schedule information. No changes are made by this check."
- `/schedules` and `/room-schedules` are the same page. The first run's "No rooms are available yet" was a load-timing artifact, not a defect.

## Note on method

The first run's false "empty page" rows cost 119,321 tokens. The verification run cost 126,060 (107 tool calls). From here on every walk waits for loading text to clear and takes a screenshot per page. Slow loads are recorded as findings, not read through.

## Hand-off

All eight findings are timetable work and go to **A2**. Finding 1 comes first; it touches the §7 term invariant, so load `atlas-timetable-invariants`.
