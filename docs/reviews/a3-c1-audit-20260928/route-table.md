# A3 c1 — item 0 graded route table (non-timetable half)

**Written 2026-09-28 01:05 +08 by Planner A3. Base `origin/main` `025ac7d8`.**

## Read this first: four of the packet's five columns are UNGRADED, and why

The packet's item 0 asked for a **live** graded route table on the Tailnet at 1366x768, in one
browser session, and said *"commit the table before fixing."* I could not get browser custody, so
**the browser columns below are `UNGRADED`, not graded from memory and not estimated.**

**The custody trail, in full, because it is the evidence:**

| Time (+08) | Event | Evidence |
|---|---|---|
| 22:46 | Lane A2 writes `.browser-lock` | lock file content, read directly |
| 23:01–23:49 | A3 polls; lock still A2, younger than the packet's 45-min line | 10 consecutive 60s polls, no change |
| 23:26 | **A2 restarts its browser without re-stamping the lock** | 9 `chrome` processes, `StartTime 2026-09-27 23:26:04` |
| 23:49 | A3 overwrites the lock — 63 min stale by the packet's own rule | lock file, content recorded |
| 00:18, 00:19 | A3 `playwright_browser_resize` **fails twice** | `Browser is already in use for C:/Users/njgro/.config/opencode/playwright-profile` |
| 00:20 | A3 probes again: 9 chrome procs still live, started 23:26 | `Get-Process chrome` |
| 00:20 | **A3 yields**, writes the yield into the lock, restores A2's claim | lock file, content recorded |

**My overwrite was correct by the file and wrong in effect.** The packet's 45-minute staleness rule
is written against the lock *file*, and the file was 63 minutes stale. But a live browser that had
been running for 52 minutes is stronger evidence of activity than a stale timestamp, and `AGENTS.md`
§12 says **one agent per browser profile at a time** — that rule outranks the lock heuristic. A2 was
driving; I yielded. **`AGENTS.md` §16 says corrections are additive, so the overwrite is recorded
here rather than deleted.**

**What this costs the packet, stated plainly:** items **0** (this table), **2** (the graded
walkthrough), **4** (`#52` Building view) and **5** (**B5**, the load-bearing swap-Cancel
zero-change control) are `BLOCKED(BROWSER_CUSTODY)`. **B5 has now been owed for two consecutive
overnight cycles and was never performed in either.** It is the single most valuable unperformed row
in this lane and it is a live-data-adjacent control, so it should be run by whoever holds custody
next, not waived.

**A candidate, not an excuse, for the next holder:** A2's browser goes idle between its own
acceptance batches. The lock is the right signal; the browser process is the better one. A rule
worth adopting: *treat a live browser process as authoritative over the lock timestamp, and require
an agent to re-stamp the lock whenever it restarts its browser* — because A2's 40-minute gap
between stamping and restarting is exactly what produced this collision.

## What IS measured: the title pattern, per page, on `origin/main` `025ac7d8`

This is a real rendered-DOM fact, and it is the one part of item 0 that did not need a browser
because it is a property of the component tree rather than of the painted screen.

| Route | Page component | Title owner | Pattern | Grade |
|---|---|---|---|---|
| `/` | `pages/Dashboard.tsx` | own `<h1>` in the gradient hero | **branded hero** (exempt, pinned) | B |
| `/sections` | `pages/Sections.tsx` | `AdminWorkspaceFrame` → `AdminWorkspace.tsx:178` | **compact strip** | C |
| `/subjects` | `pages/Subjects.tsx` | `AdminWorkspaceFrame` | **compact strip** | C |
| `/subjects/requirements`, `/subjects/decision-workspace` | `RetiredRequirementsRedirect` | — | retired tombstone, chrome override only | n/a |
| `/teachers` | `pages/Faculty.tsx` | `AdminWorkspaceFrame` | **compact strip** | C |
| `/teaching-load` | `pages/TeachingLoad.tsx` | `WorkspaceToolbar` → `:166` | **compact strip (2nd variant)** | C |
| `/teaching-load/history` | `faculty-assignments/TeachingLoadHistoryView.tsx` | `PageHeader` | **card** | B |
| `/map` | `pages/MapEditor.tsx` (3 `PageHeader` refs) + `campus-map/CampusMapOverview.tsx` | `PageHeader` | **card** | B |
| `/audit` | `pages/Audit.tsx` | `PageHeader` | **card** | B |
| `/admin/year-setup` | `pages/AdminYearSetup.tsx` | `PageHeader` | **card** | B |
| `/faculty/concerns` | `pages/TeacherConcerns.tsx` | `PageHeader` | **card** | B |
| `/faculty/preferences` | `pages/OfficerPreferences.tsx` | `PageHeader` | **card** | B |
| `/faculty/room-preferences` | `pages/OfficerRoomPreferences.tsx` | `PageHeader` | **card** | B |
| `/timetabling/how-it-works` | `pages/HowItWorks.tsx` | `PageHeader` | **card** | B |
| `/schedules`, `/room-schedules` | `pages/RoomSchedules.tsx` | — | **A2's** — not graded, not A3's | — |
| `/timetable/**` incl. `/timetable/setup`, `/timetable/exports` | — | — | **A2's** — see the scope conflict below | — |

**Every non-timetable route now has exactly one real page-level `<h1>`.** That is the S-a outcome and
it is verified by a committed, gate-registered suite (`test:a3-page-title-c1`, 14 controls, three of
them proven discriminating by independent mutation). **What is *not* achieved is one pattern: there
are still three densities** — card (9 pages), compact strip A (3 pages), compact strip B (1 page) —
plus the branded hero on `/`. Consolidating strips A and B is the next stream and is **not** done.

## The route table, in the packet's shape

Columns the packet asked for: Route · Task the scheduler came to do · Words on first screen · Verbs ·
Status cues · Clicks to finish · Grade · Top 3 stumbles. **Words, verbs, status cues, clicks and
stumbles are all per-screen observations and every one is `UNGRADED`** — I will not invent them.

| Route | Task the scheduler came to do | Words | Verbs | Status cues | Clicks | Grade | Top 3 stumbles |
|---|---|---|---|---|---|---|---|
| `/` | See the school year, term, and whether the year is ready | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. hero says `Scheduling Dashboard`, sidebar + breadcrumb say `Dashboard` 2. hero chips pushed down by a header card *(reverted in `23f0495b`)* 3. UNGRADED |
| `/sections` | Give a section its room; swap or unassign a room | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **C** (source-only) | 1. `text-slate-900` title, off-token 2. compact strip, not the card pattern 3. UNGRADED |
| `/subjects` | Maintain the teaching catalog | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **C** (source-only) | 1. `text-slate-900` title 2. compact strip 3. UNGRADED |
| `/teachers` | Review a teacher's load | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **C** (source-only) | 1. `text-slate-900` title 2. compact strip 3. **row 16 risk: this page must keep >1 roster row visible** |
| `/teaching-load` | Review and repair the year's load | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **C** (source-only) | 1. second compact-strip variant, different from `/teachers` 2. **row 14 risk: no page scrollbar** 3. UNGRADED |
| `/teaching-load/history` | Compare against last year | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. UNGRADED 2. UNGRADED 3. UNGRADED |
| `/map` | See which rooms are usable | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. **`#53` — all rooms read `Not available`/`n/a` until `1e417694` is deployed** 2. renders 0 canvases until *Open map* is clicked 3. **#52 unperformed** |
| `/audit` | Check what changed and who did it | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. **no `<h1>` at all while loading** (a transient splash `<h1>` was correctly demoted to `<p>`) 2. UNGRADED 3. UNGRADED |
| `/admin/year-setup` | Set the active school year | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. renders nothing without an admin session 2. UNGRADED 3. UNGRADED |
| `/faculty/concerns` | Resolve a teacher concern | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. was already the reference implementation 2. UNGRADED 3. UNGRADED |
| `/faculty/preferences` | Set the officer's own preferences | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. UNGRADED 2. UNGRADED 3. UNGRADED |
| `/faculty/room-preferences` | Decide room requests | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. UNGRADED 2. UNGRADED 3. UNGRADED |
| `/timetabling/how-it-works` | Understand what ATLAS will do | UNGRADED | UNGRADED | UNGRADED | UNGRADED | **B** (source-only) | 1. UNGRADED 2. UNGRADED 3. UNGRADED |

**Grades are source-only and provisional.** `B`/`C` are about the *title pattern*, which is what I
could measure. They are **not** the packet's full rubric grade, which needs words, verbs, cues and
clicks. **A real grade needs a browser.**

## The largest measured finding of the night, and why I did not act on it

**229 raw neutral colour classes across 34 non-timetable client files.**

```
text-slate-500  76      text-slate-800  20      text-gray-900   8
text-slate-900  50      text-slate-700  18      text-gray-600   8
text-slate-600  26      text-slate-400  17      text-gray-800   7
                                   text-slate-300  4      text-gray-500   6
```

**The repo already has a rule against exactly this, and the rule only checks three files.**
`atlas-client/src/lib/__tests__/ux-r01-shared-chrome.test.tsx`:

- line 62 — `assert.doesNotMatch(html, /(?:text|bg|border)-(?:slate|zinc|gray)-/)` against rendered
  `SmartLoadingState` / `SmartEmptyState` / `SmartDegradedState` / `SmartErrorState`.
- line 92 — `assertSharedChromeSources` applies the same ban to **three** files: `PageHeader`, one
  card, `SmartShell`.

So the contract is *"no raw neutrals in shared chrome"* and the enforcement is *"three files."*
`AdminWorkspaceFrame` at `AdminWorkspace.tsx:178` renders its `<h1>` in **`text-slate-900`** — a raw
neutral, on `/sections`, `/subjects` and `/teachers`, three of the four demo screens — and no test
sees it.

**Why this is the top-ranked next stream and why I did not run it tonight:** this is a 229-occurrence
visual change across 34 files. Its entire verification is *does it still read correctly and is the
contrast still sufficient* — a question only a rendered screen at 1366x768 can answer, across a
dark/light surface the earlier c0 handoff already recorded as **not** reliably light-only. **Making
it blind, with no browser custody, would be exactly the kind of unreviewable change my own directive
warns about**, and it would land on the same pages as the two accepted density rows.

The right shape is a **ratchet, not a sweep**: an inventory control that reports the per-file count
and fails only if the total *rises*, then sweep file by file with a browser in hand, each step
individually revertible. That is stream **S-e** and it is the first thing the next session should
dispatch.

## Scope conflict in the packet, decided and recorded

Packet item 1 names `/setup` and `/exports` sub-pages as A3's. **Those are `/timetable/setup` and
`/timetable/exports`** — registered `element: null` children of `/timetable` at `App.tsx:234` and
`:232`, with chrome overrides `'Class Schedule' / 'Setup'` and `'Class Schedule' /
'Download schedules'` in `navigation.ts`. They sit inside the packet's own out-of-bounds list
(`/timetable*`, `components/timetable/**`). **Excluded — A2's.** A3 did the equivalent work on
A3-owned chrome instead. Recorded rather than silently dropped.
