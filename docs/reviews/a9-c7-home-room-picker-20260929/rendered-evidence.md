# A9 c7 — rendered evidence on real staging data

Preview `http://127.0.0.1:5262` (vite dev, `VITE_ATLAS_API=http://127.0.0.1:5101/api/v1` → **staging API**,
origin asserted on every row below), session from `/__dev/staging-login`, **no credential file read**. Candidate
`fa57114c..e6b2cf63`, branch `work/a9-c7-home-room-picker`. Viewports 1366x768 and 1366x650. Screenshots in this
directory.

Data on screen: the real staging roster — 20 sections, 78 rooms (79 picker options including `Unassigned`),
`S.Y. 2023-2024 · ACTIVE`, `USING SAVED DATA`.

## The packet's proof rows, all PASS on the final candidate `e6b2cf63`

| Row | Viewport | `data-side` | Popover (top→bottom, height) | Clears header | Clears `Sync sections` | Inside viewport |
|---|---|---|---|---|---|---|
| mid-list row, list scrolled to 400 | 1366x768 | `bottom` | 341→741, **400px** | yes | yes | yes |
| last visible row | 1366x768 | `bottom` | 396→752, **356px** | yes | yes | yes |
| row 1 (measured on `cb9d218e`, unchanged since) | 1366x768 | `bottom` | 356→756, **400px** | yes | yes | yes |
| row 1 | 1366x650 | `bottom` | 356→634, **278px** | yes | yes | yes |
| deep row | 1366x650 | `bottom` | 445→634, **189px** | yes | yes | yes |

The measured cap equals `min(400, innerHeight − triggerBottom − 4 − 12 − 4)` on every row, and is applied as a
**definite** inline `height` (`a9c7-07`, `a9c7-08`).

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
| `a9c7-08-LASTVISIBLE-row-opens-down.png` | last visible row, `side=bottom`, 356px, list scrollable |

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
