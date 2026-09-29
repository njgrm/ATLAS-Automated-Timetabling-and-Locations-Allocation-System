# Live timetable drill for the demo video (Lane C, 2026-09-29 19:00)

Runs on LIVE right after train 10 is live (A8 c3 generate-with-gaps is needed). Live data is test data (operator); this
drill may generate, edit, save preferences and publish through the UI only. Rollover stays paused. Runner: Codex, @Brave
'Your Brave', origin asserted, 1366x768, never type credentials. Lane C takes a pg_dump backup first
(`scratchpad/livedump.cjs`). Every problem found goes to its owner the same hour; fixes ship in train 11 (21:00) or 12 (00:30).

## Why the preference test needs set-up (checked on live, read-only, 19:00)
Live has **no usable teacher preferences**: one DRAFT availability row with 0 slots. Generation reads only REVIEWED rows
(`faculty-availability.service.ts:346`): UNAVAILABLE = hard exclusion (`schedule-constructor.ts:1831-1856, 2072-2080`),
PREFERRED = soft ranking only (`:1858-1863, 2229-2231`). No screen shows whether preferences were kept (gap, owner below).

## Step 0 — preferences (Teacher Preferences page, before generating)
Pick 3 real teachers with load. Enter and SUBMIT, then REVIEW (approve) through the page:
- T1: UNAVAILABLE all of Friday afternoon. T2: UNAVAILABLE Monday first two periods. T3: PREFERRED mornings only.
Record each teacher's name and exact slots. Note every word/step that is confusing for an older scheduler.

## Step 1 — generate
Class Schedule for 2023-2024 Term 1: run generation through the normal button. Record: blockers shown (words), time taken,
the result summary (placed / unplaced / advisories), how to-be-hired classes are shown.

## Step 2 — preferences kept?
From the generated timetable (teacher view): T1 has NO class Friday afternoon; T2 has NO class Monday periods 1-2
(hard: any violation is a BLOCKER). T3: count morning vs afternoon classes (soft; report the ratio). Say whether any
screen tells the scheduler this.

## Step 3 — every control accounted for
First build the inventory from the page itself: every button, menu item (open every menu: Daily tasks, Expert tools,
Help & display, Tools, Schedule data), tab, view switch, filter, dialog, drawer, drag target on /timetable, in the draft
and (after Step 5) the published state. One row each. Then exercise each one:
works / broken / confusing, exact on-screen words, screenshot. Must include: view by section/teacher/room, day options,
manual edit (move a class by drag and drop, a move that clashes: is the clash explained and blocked or confirmed?),
swap two classes, place an unassigned class, undo/redo, lock/pin, conflict list and repair guide, edit draft, discard
draft (on a copy only: generate again after), schedule history/runs, export centre (every export: open the file, check
grades 7-10, names, totals), print dialog, publish readiness, publish. Run `scripts/qa/ux-audit.js` with each dialog open.
Count: inventory n · works n · broken n · confusing n. No control may be left unlisted.

## Step 4 — the other pages are complete
Walk-standard Part 2 on every page, plus: each page shows real 2023-2024 data (no empty or placeholder sections, no dead
buttons, numbers agree across pages: Dashboard vs page, Teachers vs Teaching Load vs Subjects vs Class Schedule).

## Step 5 — publish (only if Steps 1-3 have no BLOCKER)
Publish through the page; check the words about to-be-hired classes, then the published view and public schedule.

## Report
Line 1: `drill · prefs hard kept y/n · controls n/works n/broken n/confusing n · MAJOR n · BLOCKER n · verdict`.
Then per step. Evidence under `codex-qa/live-drill/`.

## Owners for gaps already known
- No screen shows whether preferences were kept → **A2 c17** (train 12): generated-run summary line "Teacher
  preferences: 2 of 2 unavailable times kept · 5 of 7 preferred times met", with a list per teacher.
