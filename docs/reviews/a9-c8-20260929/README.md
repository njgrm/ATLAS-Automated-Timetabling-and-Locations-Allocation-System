# A9 c8 — evidence (lane `a9-c8`, 2026-09-29)

Range `24401f0b..8d740f8b` (round 1) plus the round-1 correction commit on top; the tip is named
in the handoff. `24401f0b..HEAD` is four commits, the first of which is the packet commit
`e7583433` (planner-authored, in the range) and the rest this lane's.

Preview: `scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port 5241` (round 1)
and `-Port 5242` (the correction round), each proxied to the **staging** API. Viewport
**1366x768**, asserted on every row below: `window.location.origin === "http://127.0.0.1:5241"`
(round 1) and `"http://127.0.0.1:5242"` (correction round) — loopback staging previews, never
5001/LIVE.

## 1. Screenshots (real staging data, school 1, S.Y. 2023-2024, run 347)

| File | Page | What it shows |
| --- | --- | --- |
| `a9c8-01-dashboard.png` | `/` 1366x768 | `Teaching Rooms 78 of 78 · Ready to be used for classes`; `Setup readiness 7 OF 10 READY · 3 STEPS TO GO` (no "could not check"); `Timetable made and checked → 6 problems must be fixed across the whole timetable before it can go out` |
| `a9c8-01b-dashboard-full.png` | `/` full page | the campus panel: `Buildings 8 · Teaching rooms 78 of 78 · 1 building have no rooms · Selected building: Speech Lab — It has no rooms yet. Add the rooms that are used for classes.` |
| `a9c8-02-map.png` | `/map` 1366x768 | `78 of 78 teaching rooms are ready to be used for classes.`; map toolbar with **no** `100%`; `Speech Lab — It has no rooms yet. Add the rooms that are used for classes.` |
| `a9c8-03-map-room-readiness.png` | `/map`, problems region | `1 building has no room marked for classes.` (was `58 rooms need something fixed, in 7 buildings.`) |
| `a9c8-04-timetable.png` | `/timetable` 1366x768 | `6 Must fix, 696 advisories — this schedule cannot be published yet.` |
| `a9c8-05-dashboard-pending.png` | `/` with the readiness read delayed 12 s | no `ATLAS COULD NOT CHECK`, no `0 OF 10 READY`, no next-step card, four neutral `Checking source` footers, one reading line |
| `a9c8-06-blocked-before.png` | `/` with `/auth/me` intercepted so the actor school is unresolvable — **the QA F-A defect, on the round-1 tip** | `Teaching Rooms 0 of 0` · `Subjects 0` · `Teachers 0` beside "We could not confirm your school" |
| `a9c8-07-blocked-after.png` | the same interception, on the correction | `Teaching Rooms —` · `Subjects —` · `Teachers —` · `Sections —`, no number anywhere |

## 1b. QA round 1 (`CORRECTION_REQUIRED`, 36 mandatory / 34 passed) and what this round did

* **F-A (BLOCKING).** Reproduced on the round-1 tip, and it was **wider than the report**: the
  room tile printed `0 of 0` *and* `Subjects 0` *and* `Teachers 0`; only `Sections` was safe, and
  only because it separately tested `sectionCount === null`. All three were the same
  hand-rolled ternary. Fix: one exported pure `dashboardTileValue` decides every tile's figure
  — a figure is printed only when a measured value exists (`loading` → `…`; `reading`,
  `!available` or `measured == null` → `—`), while a **measured zero still prints `0`**, because
  0 is a fact and `null` is the absence of one.
* **F-B (NON_BLOCKING).** The F2 guard now matches the URL alone (`/runs\/latest\/violations/`)
  instead of `atlasApi\.get[^;\n]*violations`, which a re-typed generic full of semicolons walks
  through. Four re-typings are pinned in `F2_RE_TYPED`, and the old pattern is asserted to MISS
  the one QA used while the new one catches it.
* **F-D (NON_BLOCKING).** The header above names the delivered tip and the true commit count.

## 2. Before / after on screen

| Item | Before (`origin/main`, live/staging) | After (candidate) |
| --- | --- | --- |
| F1 pending | `0 OF 10 READY · 1 STEP TO GO · 9 ATLAS COULD NOT CHECK` + `ATLAS could not check these` + a `Add subjects` next step, over a read in flight | `Checking source. This list appears as soon as the check finishes.` — one line, no count, no next-step card, tiles read `Checking source` in neutral grey |
| F1 failed | `ATLAS could not check these`, retry only in the page header | unchanged wording **plus** a `Check again` button on that heading |
| F2 | row fed by a second `runs/latest/violations` read; could read `made and checked` | `6 problems must be fixed across the whole timetable before it can go out` — the same 6 and 696 `/timetable` shows |
| F3 | `Teaching Rooms 78/103`, `7 ready`, `100%`, `0 teaching rooms ready` | `78 of 78` (Dashboard tile **and** campus panel), no `7 ready`, no `100%`, `It has no rooms yet. Add the rooms that are used for classes.` |
| F3 grammar | `1 building have no rooms` | `1 building has no rooms` — **in source**; the rendered string stays `have` until the **server** half is deployed (staging runs the old server) |
| F4 | `58 rooms need something fixed, in 7 buildings.` and `0 rooms need something fixed, in 1 building` | `1 building has no room marked for classes.` |

## 3. Failing-first, F1 (literal)

`npx tsx --test src/lib/__tests__/tmp-a9c8-f1-probe.test.ts` (a temporary probe, not committed, deleted after the run):

* with the eight changed production files restored from `origin/main` → `tests 1 / pass 0 / fail 1`,
  `AssertionError: a pending read must never be reported as a failed one`;
* on the candidate → `tests 1 / pass 1 / fail 0`.

The committed regression is the same assertion inside `src/lib/__tests__/a9-c8-dashboard-truth.test.ts`
(reachable from `npm run test:a9-c8-dashboard-truth`).

## 4. Commands run, with results

| Command | Result |
| --- | --- |
| `npm run test:a9-c8-dashboard-truth` | 13 / 13 |
| `npm run test:a9-c3-sections-rooms` | 17 / 17 |
| `npm run test:dashboard-truth-c01` | 20 / 20 |
| `npm run test:uxc01r` | 38 / 38 |
| `npm run test:derived-setup-ux` | 23 / 23 |
| `npm run test:a3-c11-campus` | 13 / 13 and 6 / 6 |
| `npm run test:a9-c4-map-fit` | 10 / 10 |
| `npm run test:ux-guardrails` (gate reachability) | 31 / 31 |
| `npm run test:encoding` (repo root) | 1 / 1 |
| `npm run test:a9-c6-room-filters` | 17 / 19 — **2 pre-existing failures**, see below |
| `npx tsc --noEmit` (atlas-client) | 5 pre-existing errors, none in a changed file |

**The two pre-existing failures.** They assert a per-row status `Badge` class of
`shrink-0 gap-1 text-[11px] ${copy.className}` and a `truncate text-[11px] text-muted-foreground`
locator. `git show origin/main:atlas-client/src/components/campus-map/RoomReadinessList.tsx`
line 493 reads `shrink-0 gap-1 text-xs` and contains no `text-[11px]` at all, so neither
assertion can pass on the base revision either. They are in the per-room roster row, which
this correction does not touch. The one `roomProblemSummary` expectation in that file **was**
corrected, additively, and its reason is recorded at the assertion.

## 5. `scripts/qa/ux-audit.js` in the page context, 1366x768

`major: 0` on all three pages. Nothing under 14px on anything this change touched: the only
sub-14px text is `Help` (12.8px, pre-existing hero control) on `/`, and `Edit maps` /
`Edit rooms` (12.8px) on `/map` and `Edit draft` / `Discard draft` (12.8px) on `/timetable` —
all pre-existing and none of them changed here. `overflowing: 0`, `mojibake: 0`,
`moreFilters: 0`, `pageScrollsSideways: false` everywhere. The `truncated` and
`smallTargets` lists are the app shell's sidebar/header (identical on all three pages) and
the timetable grid; `major` counts none of them.
