# Lane C overnight live findings — 2026-09-28 (live `d31bfacb`)

Runner: Lane C `atlas-browser-qa` on Claude in Chrome. Origin https://njgrm.buru-degree.ts.net. Read-only.

| Row | Live answer (quoted) | Verdict | Owner |
|---|---|---|---|
| #53 map tiles (01:35) | Campus map (More › Tools › "Campus map"): Grade 7 Wing "0% FILLED", Grade 8 Wing "0% FILLED", Grade 9 Wing "0% FILLED", Grade 10 Wing "0% FILLED", Speech Lab "0% FILLED", while GR7 - Luna has a full Term 2 week in G7 Room 103. (ss_1861piib9) | **FAIL** — `1e417694` fixed Building view only; the map tile path still prints a fabricated 0% | A3 |
| #53 Building view (01:35) | Grade 7 Academic Wing rooms: "G7 Room 401 — Classroom / Capacity: 45 / n/a", "G7 Room 103 … n/a", "G7 Room 105 … n/a". "n/a" has no label; room 103 is occupied all week. (ss_9672lmlyg) | **FAIL (UX)** — honest but unlabelled, and it contradicts the map's "0%" for the same building. Show the real use ("32 of 40 periods used") or a labelled "Use: not available yet" | A3 |
| #52 (01:35) | First render of `/timetable/map` from More shows the previous GR7 - Luna class grid (Mon–Fri TLE/SCIENCE/MAPEH) for ~2 s before the map. (ss_2662embwr) | **FAIL** — show a loading state, not the stale grid | A3 (A2 if the route shell is timetable-owned) |
| B5 / Fix 29 (01:45) | Teaching Load › Review teachers › AGUILAR panel › swap icon "Swap Mabini from DELA CRUZ, ELAINE MARIE to the current teacher" → modal "Move Mabini to this teacher?" (28 words: "…Confirming removes it from them and assigns it to the teacher you are editing. It is a draft until you save."), buttons Cancel / Move class. Cancel → after reload Mabini still DELA CRUZ; AGUILAR 15.0h·50%, 4 sections; "No draft changes yet." (ss_9606srb0y) | **PASS**. Minor: the body does not restate the subject or grade | A3 |

Grades for older, mouse-first users: the meaning of the number is not obvious; the map tiles have a colour cue but
Building view rooms have none; the wording is short, but the missing label costs clarity.

`subagent_tokens`: 89,509 (map) + 84,758 (B5).

## A3 demo walkthrough, sections 1–5 (02:00–02:15, 1366x768, read-only; `subagent_tokens` 171,647)

Stumbles: 1.1 the Dashboard has a page-level scroll at 1366x768; 1.4 the hero says "Scheduling Dashboard" while the
sidebar and breadcrumb say "Dashboard"; 2.2 no visible room-map control on a Sections row (it is behind the home-room
dropdown → "Browse Interactive Map"); 2.3 map cards show only "CAPACITY 45", no use; 3.2 Subjects shows raw text
"OWNER_DEPT:AP", "STE_APPLIED_CHEM", "Saved term contract failed its semantic revision check"; 5.1 "Open map" gave no
visible canvas and no loading state; 5.4 not reached. Passes: 2.4 room-swap confirmation clear (~30 words); 2.5
Cancel = zero change; 3.1 filters visible; 4.2–4.5 teacher profile and workload dialog clear, with the grade colour
cues; 5.2 Campus & Rooms rooms read "Unavailable", not a bare 0% (contrast: the timetable Campus map tiles still read
"0% FILLED", above).

**Top 10 for older users, ranked by demo impact (for A3):**
1. One page name: "Dashboard" everywhere (the hero says "Scheduling Dashboard").
2. No page-level scroll on the Dashboard at 1366x768.
3. A visible "View room map" button on each Sections row.
4. Room map cards: show use beside capacity ("Used 32 of 40 periods") so "is this room free?" is answered in place.
5. Subjects: plain sentences for the four raw strings ("Science & Technology track", "Some room needs are unusual",
   "Could not reach the enrolment system", "Rechecking last year's schedule data").
6. The teacher row's "Review load" navigates away while "Profile" opens a dialog: one pattern (a dialog).
7. **Opening the workload dialog silently switches Teaching Load into a draft with Save enabled.** A user "just
   looking" can save by accident. Enter draft only on a real change. (HIGH; truthfulness)
8. **Sections "HOME ROOMS 20/20" while 5 rows read "Needs home room".** The counter and the rows disagree. (HIGH)
9. Campus "Open map": a loading state and a faster first paint.
10. One word for "not enough hours" (the page mixes "Below standard", "% OF STANDARD" and "wide span").

## After the `a1db27d5` cutover (07:00)

| # | Finding | Severity |
|---|---|---|
| L1 | **A cutover appears to sign every browser out.** Both the A2 Playwright profile (B9–B22 all NEEDS_SESSION after `a1db27d5`) and Lane C's Chrome profile (redirected to `/login` at 07:00, signed in at 01:35) lost their "remember me" session across the cutover. Lane C saw the same after `c5a9e832` on 2026-09-27. If sessions do not survive a server restart, a deploy during the demo signs the presenter out. A2: confirm whether the session store or signing secret changes per release. | HIGH (demo risk; verify) |

Rows B9–B22 on `a1db27d5` are UNPERFORMED (no session in either profile). `subagent_tokens` 65,581.

## Morning live checks on `a1db27d5` (09:30–09:45, Lane C Chrome, GR7 - Luna)

**Term 2 Monday displaced:** 6:00–6:45 empty (TLE on Tue–Fri), MAPEH at Mon 6:45, SCIENCE at Mon 7:30; Terms 1/3 intact.
Schedule history reads "Nothing to show yet …"; no run number or state label on the page. → A2 c6 item 1.

| Row | Verdict | Evidence |
|---|---|---|
| B9 | **FAIL** | Warnings chip T1 52 / T2 48 / T3 48; publish panel says "Warnings to review (whole year): 48" |
| B10 | **FAIL** | No run/state line in the page header; "Generated schedule · run 321" only inside the publish panel |
| B11 | UNPERFORMED | No badge pair found; published run not reachable in the view |
| B12/B15 | PASS | Build dialog ≈42 words, one close control |
| B13 | PASS | "Problems listed below are scoped to TERM 2; the publish gate above is always the whole year." |
| B16, B20, B22 | UNPERFORMED | not reached (budget) |
| B17 | PASS | headings "Schedule actions", "Daily tasks (4 items)", "Expert tools (3 items)"; cue "More items below. Scroll down to see all of them."; 673.6 px |
| B18 | **FAIL** | menu says "Generate"; dialog title and button say "Build a new draft" |
| B19 | FAIL (UX) | banner still shows on this run: "School information changed after this schedule was made. The current schedule stays unchanged while you review school information. · checked Xs ago" |
| B21 | PASS | visible "1 warning"; name "Select MAPEH for GR7 - Luna, Tue 7:30 AM, 1 warning" |

Header audit: "Class Schedule" twice; the "Active Term: T2" chip sits beside an independent Term selector; six rows of
messages and controls before the grid. `subagent_tokens` 92,153 + 100,995.

## Home-room hover (`/sections`, 10:35, live `a1db27d5`)

Operator report: the home-room dropdown "glitches while hovering". Runner (synthetic hover, Aguinaldo and Bonifacio
rows): no hover-triggered height change, no scroll event, no second layer, no console output. **But the list has mixed
row heights:** vacant rooms are ~37.6 px tall; occupied rooms are ~53.6 px tall and two-line ("Used by Aguinaldo" plus an
orange "Room already has a home section") on a dark-red background. Scanning or moving the mouse across mixed heights
reads as the list jumping. **Fix (A3):** one row height for every option, and occupancy as a single-line right-aligned
badge (e.g. "Used by Aguinaldo") with a calm cue, not a second line; keep the confirmation on selecting an occupied
room. If the operator still sees a flicker with a real mouse, capture a short screen recording; synthetic hover may
miss pointer-driven re-renders. (ss_50077xaye, ss_6805zs8uv; `subagent_tokens` 78,809)
