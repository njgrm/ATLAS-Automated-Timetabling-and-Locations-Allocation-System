# A9 c7 — rendered evidence on real staging data

Preview `http://127.0.0.1:5262` (vite dev, `VITE_ATLAS_API=http://127.0.0.1:5101/api/v1` → **staging API**,
origin asserted on every row below), session from `/__dev/staging-login`, **no credential file read**. Candidate
`fa57114c..e6b2cf63`, branch `work/a9-c7-home-room-picker`. Viewports 1366x768 and 1366x650. Screenshots in this
directory.

Data on screen: the real staging roster — 20 sections, 78 rooms (79 picker options including `Unassigned`),
`S.Y. 2023-2024 · ACTIVE`, `USING SAVED DATA`.

## FINAL state, candidate `61494f99` — measured after independent QA's two BLOCKING findings

Independent QA (`CORRECTION_REQUIRED`, 6/8, blocked 0, unperformed 0) found two defects this file had missed and
recorded two false measurements in shipped comments. Both defects are now closed, and the labels in the first table
below are corrected — **two rows I had called "the last visible row" were mid-panel rows**, which is precisely why
the bottom of the list was never rendered until QA reproduced it.

**F3 — the bottom-most row had a 0px room list. CLOSED.** QA measured row 20 `Silver` with the list at its maximum
scroll: trigger bottom 662, viewport 768 → cap 86px, which is exactly the popover's 86px of `shrink-0` chrome, so the
scroll viewport had `clientHeight 0` and the popover opened showing a search box, a footer and no rooms. After the
fix, at 1366x768 and at 1280x720: inline `height: 192px`, viewport `clientHeight 104 < scrollHeight 5448`,
**2 rooms on screen**, scrollable, clearing the header and `Sync sections`. **Disclosed: that row now opens
`side="top"`** — with only 86px beneath it, the 192px floor is what keeps the list non-empty, and the popover covers
nothing. It is the trade the correction packet asked for: a picker with zero rooms is never acceptable; an empty list
on the very last row of a bottom-scrolled list is.

**F4 — the table overflowed its panel and pushed the row's kebab off-screen. CLOSED.**

| Viewport | table `scrollWidth` | panel `clientWidth` | overflow | `DETAILS` header | kebab right vs panel right |
|---|---|---|---|---|---|
| 1366x768 | **1070** | **1070** | **0** | `Details`, not clipped | 1330 ≤ 1346 |
| 1280x720 | **984** | **984** | **0** | `Details`, not clipped | 1244 ≤ 1260 |

Home room cell exactly 200px, the shared trigger 168px inside it with its own truncation reaching an ellipsis rather
than pushing the column. `a9c7-11-TABLE-at-rest-*.png` is the page at rest at both widths.

## The packet's proof rows on the final candidate — relabelled by what was actually clicked

| Row | Viewport | `data-side` | Popover (top→bottom, height) | Clears header | Clears `Sync sections` | Inside viewport |
|---|---|---|---|---|---|---|
| `Aguinaldo` row 1, top of list | 1366x768 | `bottom` | 356→752, **396px** | yes | yes | yes |
| `Rizal` row 5, list scrolled to 400, trigger 301→337 | 1366x768 | `bottom` | 504→752, **248px** (centred to 464→500) | yes | yes | yes |
| **`Silver` row 20, the bottom-most row, list at max scroll 1511** | 1366x768 | **`top`** | 430→622, **192px** | yes | yes | yes |
| `Aguinaldo` row 1 | 1366x768 | `bottom` | 356→752, 396px | yes | yes | yes |
| `Rizal` row 5 | 1280x720 | `bottom` | 480→704, **224px** | yes | yes | yes |
| **`Silver` row 20, list at max scroll 1559** | 1280x720 | **`top`** | 382→574, **192px** | yes | yes | yes |
| row 1 (measured on `cb9d218e`) | 1366x650 | `bottom` | 356→634, 278px | yes | yes | yes |
| deep row (measured on `cb9d218e`) | 1366x650 | `bottom` | 445→634, 189px | yes | yes | yes |

Every row's viewport is `clientHeight < scrollHeight 5448`, so the 78-room list is reachable everywhere. Options
actually on screen: 5 at the top row, 3 mid-panel, 2 on the last row.

The measured cap equals `max(min(400, innerHeight − triggerBottom − 4 − 12 − 4), 192)` and is applied as a
**definite** inline `height` (`a9c7-09-*`, `a9c7-10-*`).

## The list scrolls — the R3 row, measured

```
open popover : body 400px, ScrollArea root 160px,
               viewport clientHeight 312 < scrollHeight 5448,  79 options  →  scrollable
scrolled end : viewport scrollTop 5136, last option on screen = "G10 Room 105 · Grade 10 Academic Wing"
```

Before R3 the same measurement read `clientHeight 5448 === scrollHeight 5448` — the list was clipped, not
scrollable, and 76 of 78 rooms were unreachable. That is the regression `docs/prompts/a9-c7-home-room-picker-r3-2026-09-29.md`
records, caused by replacing the body's definite `h-100` with a maximum.

## Stable row height across an assignment

`Luna`: **83px before, 83px after** assigning `Music Room`; the status line changed to
`Music Room · MAPEH and Wellness Hub` and the row did not move. The status line is a fixed `h-4` row with a
`truncate`d span.

## The list does not jump when a picker opens

Controlled: the section list scrolled to `scrollTop = 400` by hand, a **fully visible** row's picker clicked with a
normal click → `scrollTop` **stays 400**, popover opens `bottom` at 341→741.

**Correction to my own R2 finding, recorded rather than quietly dropped:** the "one click sends the list from 400 to
0" that I reported in `a9-c7-home-room-picker-r2-2026-09-29.md` was a **measurement artefact** — Playwright's
`locator.click()` runs `scrollIntoViewIfNeeded`, and the rows I clicked were partially cut off at the top of the
panel. No product jump exists. R2's code change (`focus({ preventScroll: true })` and the reveal confined to the
picker's own scroll root) is harmless and defensible, but it is **not** a proven fix and must not be cited as one.

## Screenshots

| File | What it shows |
|---|---|
| `a9c7-01-sections-1366x768.png` | the page: 20 rows, one outlined picker per row, status line under each, guided step still primary |
| `a9c7-02-row1-opens-down.png` | row 1 popover opening **down**, header and toolbar clear |
| `a9c7-03-FAIL-row3-flips-up.png` | **the defect this packet fixed** — row 3 opening UP over `NEED ROOMS 19`, `Give 19 sections a home room` and `Sync sections` (`bc2237f0`) |
| `a9c7-04-row3-opens-down-after-r1.png` | the same row after R1: `side=bottom`, 543→752, 209px, nothing covered |
| `a9c7-05-last-visible-row-opens-down.png` | last visible row, 1366x768, `side=bottom`, 504→752, 248px |
| `a9c7-06-ROW1-assigned-opens-down-1366x768.png` | assigned row, popover down |
| `a9c7-07-MIDLIST-row-opens-down-list-stays-put.png` | mid-list row at list `scrollTop 400`, `side=bottom`, 400px, list scrollable |
| `a9c7-08-LASTVISIBLE-row-opens-down.png` | **mislabelled by me — this is `Gold`, a mid-panel row**, not the last visible one |
| `a9c7-09-BOTTOMMOST-row-1366x768.png`, `…-1280x720.png` | the genuine bottom-most row `Silver` at both widths: 192px, 2 rooms on screen, scrollable, opens upward |
| `a9c7-10-MIDPANEL-row-1366x768.png`, `…-1280x720.png` | mid-panel row `Rizal` at both widths: `side=bottom`, 248px / 224px |
| `a9c7-11-TABLE-at-rest-1366x768.png`, `…-1280x720.png` | the page at rest after the width fix: `DETAILS` in full, both row actions inside the panel |

## Disclosed: staging data this session changed, and two behaviours worth another lane

**1. Staging's home-room assignments were changed by this browser session.** Staging showed **1 of 20** sections
assigned (`Aguinaldo → G7 Room 104`) when this cycle started. It now shows **20 of 20** assigned. The intended
change was one row (`Luna → Music Room`) for the row-height proof; the rest, including a bulk-shaped set of exactly
the 19 sections that needed rooms, appeared during my restore attempts, and I could not attribute them to a single
click with the evidence I kept. Every request in this session's network log went to `http://127.0.0.1:5101` — the
**staging** API. Nothing was sent to live (5001) or to the Tailnet origin. Staging is re-streamed from live on every
deploy, so A4's next train restores it; no cleanup action is owed by this lane, and **no attempt to restore it by
hand was made after this point** (reason in item 2).

**2. Choosing `Unassigned` in a row picker issues no network request.** Three attempts to clear `Luna` produced no
PUT — the request log shows only `GET /api/v1/sections/summary/2` and `GET /api/v1/sections/home-rooms/2` — and the
row kept its room. This is **pre-existing** and not introduced here: `SectionRoomPicker`'s `Unassigned` option and
`Sections.tsx`'s `handleHomeRoomChange` are untouched by this range (`git diff fa57114c..e6b2cf63` covers only the
popover geometry, the measurement, the row cell and the test rows). Route it to whoever owns the home-room write
path; it is **not** fixed by this packet.

**3. `/enrollpro-api/settings/public` returns 502** on every load of the preview. That is the known EnrollPro proxy
gap tracked as `ENROLLPRO-PROXY-RECOVERY-LIVE` (A4, not approved); it is unrelated to this change and the page works.

**4. The roster moved under this session, on its own.** Between the two final screenshots the room assignments and the
enrolled counts changed again (rows moved to `G7 Room 201`, `G7 Room 102`, `G7 Room 101`; `HOME ROOMS 20/20`), and
the page showed `CHECKING SOURCE` / `Saving is paused while ATLAS checks the roster`. This is the staging re-stream
A9 c5 recorded, not this lane. It is also why the pre-existing roster (1 of 20 assigned) has not been restored by
hand and does not need to be: staging is re-streamed from live on every deploy.

## Follow-up rows carried out of this cycle

1. **The status line duplicates the control's label.** With a room set, the row prints `G7 Room 201 · Grade 7 …`
   inside the button and again beneath it (`a9c7-11-TABLE-at-rest-1366x768.png`). It is packet-mandated — the A3 C4
   suites assert that wording and the packet forbade changing it — so it is not this candidate's defect, but it is the
   obvious subtraction for the owning lane and it costs a second line in every row.
2. **Choosing `Unassigned` issues no request** (item 2 above) — route to the home-room write-path owner.
3. **The page header is four rows above the table**, over §8's two-row budget, and with `HOME ROOMS 20/20` the guided
   step has nothing to do. Pre-existing (A9 c3/c6), outside this packet.
4. **`docs/reference/ux-communication-rubric` does not exist** in the repo although AGENTS.md and my own packet cite
   it. QA scored the design gate against the criteria enumerated in the directive's design judgement gate instead.
