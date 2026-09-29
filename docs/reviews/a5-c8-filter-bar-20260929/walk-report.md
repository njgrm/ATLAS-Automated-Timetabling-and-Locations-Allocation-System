# A5 c8 rendered proof — one filter bar everywhere, dropdowns that fit

Planner browser pass, Lane A5, 2026-09-29 ~19:55–20:20 (Asia/Manila).
Standard: `docs/plans/codex-walk-standard.md` Part 2 (whole-app sweep) + `scripts/qa/ux-audit.js`.
Subject: candidate `ef1547cf` (`work/a5-c8-filterbar`), base `316f967e`.

**Harness.** `vite preview` of the candidate's own production build
(`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net npm run build`, built in 12.19s), started with
`scripts/dev/start-preview.ps1 -ClientDir E:\ATLAS-worktrees\lane-a5-c8-filterbar\atlas-client -Port 5288`.
That script points the axios base AND the dev proxy at the **staging** API `http://127.0.0.1:5101/api/v1`
(`AGENTS.md` §5). Session: `http://127.0.0.1:5288/__dev/staging-login` (server-side staging sign-in;
no credential typed, no credential read, live `:5001`/`:5174` never contacted).

**Line 1: `pass 11/11 · MAJOR 0 (in this change's scope) · MINOR 4 · viewport 1366x768 · verdict GO`.**

**Correction round 1 (planner, after QA `CORRECTION_REQUIRED`, 2026-09-29 ~21:40).** Three changes to this
report, all recorded rather than quietly made:
1. **The `/timetable` row is now PERFORMED, not unperformed.** QA was right that an unperformed label is
   not a classification the packet permits. The cause of the earlier "Your schedule is still loading" is
   now known: `/timetable` opens in the **Simple** layout, and `TimetableToolbar` renders only in the
   **Expert** layout (`ScheduleReviewWorkspace.tsx:752-776` branches on `layoutMode`). The page had a run
   all along (Run 347). With the layout set to Expert — the same preference the page's own `Simple view`
   button writes — the migrated bar renders and is measured below. It is a **deployment-acceptance
   clause** for LIVE acceptance, and the rendered row below is its candidate-side evidence.
2. **The `ux-audit.js` capture is now committed** as `ux-audit-1366x768.json`, per page, with every
   threshold and counter the script's own.
3. **A lost `§` was restored** in `a6-c6-calm-teaching-load.test.tsx:492` (`AGENTS.md` 16) -> (`AGENTS.md`
   §16), found by QA. A whole-range non-ASCII inventory diff (base vs candidate, per file) found that one
   real loss; the other deltas are superseded comment blocks that were deliberately removed. QA's second
   reported loss, `pages/Faculty.tsx` `§8's` -> `8's`, does **not** exist: line 44 reads
   `under §8's 1000-line cap` and a sign-by-sign scan of every touched file finds no bare `AGENTS.md` N`
   citation. Recorded because a false blocking finding costs a round.

`window.location.origin` on every row: `http://127.0.0.1:5288` (isolated loopback preview of the
candidate build — labelled **isolated**, not live acceptance, per `AGENTS.md` §12).
`innerWidth x innerHeight` asserted `1366x768` on every page before the audit ran.

## Part 1 — the packet's own rows

| # | Row | Result | Evidence |
|---|---|---|---|
| 1 | Every list page has ONE filter bar: search then every filter, one left-aligned row that wraps, `gap-2`, all controls 36px, search 240px | PASS on 7/7 pages that have filters | table below |
| 2 | No `More filters` disclosure and no popover anywhere in the product | PASS — `moreFilters: []` on all 11 pages | audit JSON below |
| 3 | No legend line inside the bar (`/sections` program codes) | PASS — the legend is gone from the bar and lives in a Tooltip on the `Program` trigger | `sections-1366.png` |
| 4 | Trigger width follows the selected label; floor 8rem, ceiling 22rem; no ellipsis, no spill | PASS — measured: `Grade: All` 128px (floor), `Home room: Home room assigned` **243px**, `Room: G10 Room 101 (F1)` 190px, `Status: Teaching` 144px; `spill = scrollWidth - clientWidth = 0` on every one | `sections-homeroom-set-1366.png`, `room-schedules-long-face-1366.png` |
| 5 | Menu content at least as wide as the trigger, never under 18rem | PASS — trigger 128px → panel 288px; trigger 136px → panel 288px; `listScrollWidth === listClientWidth` (286) on both, so no item is cut | `sections-program-open-1366.png`, `sections-homeroom-open-1366.png` |
| 6 | Menu items wrap instead of truncating | PASS — option rows compute `white-space: normal`; none reports `truncate` | same shots |
| 7 | Menu opens downward with collision padding, portalled | PASS — panel bottoms 400px / 320px against triggers at y≈168px; `PopoverContent` is portalled and `collisionPadding={8}` | same shots |
| 8 | The `Archived year: 2029-2030` ellipsis Lane C measured on `/teaching-load/history` | PASS — that control is now `School year: 2022-2023` at 188px, `spill = 0`, and its siblings (`Grade: No grades in this year` 215px, `Subject: No subjects in this year` 232px) show their full disabled reason in full | `tl-history-1366.png` |
| 9 | `npm run test:encoding` green | PASS (executor's run, repo root, 1/1) | executor report |

## Part 2 — the whole-app sweep: the filter-bar comparison table

One row per page. `origin` = `http://127.0.0.1:5288`, `viewport` = `1366x768` on all eleven.
"rows" is the number of distinct vertical offsets the bar's children occupy.

| Page | controls, in displayed order | search width | control height | gap / alignment | disclosure | legend in bar | bar box |
|---|---|---:|---:|---|---|---|---|
| `/subjects` | Search name or code… · Grade · Program · Status · Room · Term | 240px | 36px | 8px, left, 1 row | none | none | 1060×36 |
| `/sections` | Search sections… · Grade · Program · Home room | 240px | 36px | 8px, left, 1 row | none | none (Tooltip on `Program`) | 1060×36 |
| `/teachers` | Search teacher, department, or specialization… · Roster · Load · Department · Grade | 240px | 36px | 8px, left, 1 row | none | none | 1060×36 |
| `/teaching-load` (Teachers) | Search teachers… · Status · Department · Load · Sort · Cross-subject/No subject match · Discard/Save (draft) | 240px | 36px | 8px, left, wraps to 2 rows **with a draft present** | none | none | 1078×80 |
| `/teaching-load/history` | School year · Grade · Subject (no search slot on this read-only view) | n/a | 36px | 8px, left, 1 row | none | none | 1070×36 |
| `/room-schedules` | Show: · Rooms/Teachers/Sections (view) · Room · TERM 1 | n/a (no text filter) | 36px | 8px, left, 1 row | none | none | 1070×36 |
| `/faculty/concerns` | Search teacher… (the one searchable roster picker) | n/a | 36px | 8px, left, 1 row | none | none | 1062×36 |
| `/timetable` (Expert layout) | Show · Schedule for · Term · Program · Entry type · attention-type chips | n/a (no text filter) | 36px | 8px, left, 1 row of controls + the chip group on a second line | none | none | 1110×72 |
| `/admin/year-setup`, `/map`, `/` | no filter bar by design (setup wizard, map tabs, dashboard) | — | — | — | — | — | — |

**Consistency verdict.** Order, height (36px), gap (8px), left alignment, search width (240px) and the
absence of a disclosure are identical on every page that has a filter bar. The only rows that are not
one line are `/teaching-load` with a draft open (2 rows: filters, then the two inclusion switches plus
the draft group) — and that is the packet's own "one row that wraps" contract, with the draft group
kept right-aligned by its own `ml-auto`. The three `text-[11px]` active-filter chips that used to form a
third row on that page are gone.

## Per-page audit summary (ux-audit.js, every page, real staging data)

**Committed artefact: `ux-audit-1366x768.json`** — the script's own thresholds and counters, per page,
with `mojibake` / `moreFilters` / `overflowing` / `truncated` detail and a `u12Sample` for each page that
has any. `u12` = distinct visible text nodes under 12px. `over` = `overflowing`. `mojib` = mojibake hits.
Settled-state pass; the file records the load-state caveat.

| Page | mojibake | moreFilters | overflowing | sideways scroll | u12 | error boundary | note |
|---|---:|---:|---:|---|---:|---|---|
| `/` | 0 | 0 | 0 | no | 1 | none | 11px is one dashboard gauge value |
| `/admin/year-setup` | 0 | 0 | 0 | no | 0 | none | — |
| `/sections` | 0 | 0 | 0 | no | 16 | none | chips/badges/table, A7 c8's scale |
| `/subjects` | 0 | 0 | 0 | no | 20 | none | badges/grade chips, A7 c8's scale |
| `/teachers` | 0 | 0 | 0 | no | 15 | none | chips/table, A7 c8's scale |
| `/teaching-load` | 0 | 0 | 0 | no | 3 | none | — |
| `/teaching-load/history` | 0 | 0 | 0 | no | 0 | none | — |
| `/faculty/concerns` | 0 | 0 | 0 | no | 0 | none | — |
| `/map` | 0 | 0 | 0 | no | 19 | none | map labels, A7 c8's scale |
| `/room-schedules` | 0 | 0 | 0 | no | 0 | none | — |
| `/timetable` (Simple) | 0 | 0 | 0 | no | 0 | none | no `FilterBar` on this layout; see Part 2b |
| `/timetable` (Expert) | 0 | 0 | 0 | no | 7 | none | grid cell/legend type, A7 c8's scale; bar measured in Part 2b |

**Every `u12` is a font-size finding, and font size is A7 c8's lane, not this change's.** This
candidate does not touch `--theme`, `index.css` or any `text-[Npx]`, by packet §6. The audit's `major`
counter charges those pixels; they are recorded here as A7 c8's rows rather than as this change's
defects, and they are the reason the walk's own headline says `MAJOR 0 in this change's scope`.

## MINOR (listed, owner named, not blocking — per the walk standard)

1. **Sidebar rail truncation**, reported identically on `/`, `/admin/year-setup` and every other page:
   `ATLAS High School SCHEDULING PORTAL S.Y. 2023-2024` at 239px and the `NAVIGATION` group at 255px.
   Owner: the shell/AppShell lane. Recorded on live already (sweep MINOR), unchanged by this candidate.
2. **`/faculty/concerns` keeps a searchable combo-box rather than a plain search box.** The shared
   search slot is a plain `@ui` `Input`; converting a filters-as-you-type control into a text box that
   searches nothing would be a regression dressed as a refactor, so the page's own control became the
   bar's single child and gained the bar's row geometry, 36px height and bounded width. Recorded as an
   executor deviation with its reason; judgement owed by the reviewer.
3. **`/room-schedules` has no text-search slot** — it filters by view, room and term, and the only
   filter is the room picker. A search box was not added, because a control that searches nothing is
   worse than no control. Same judgement owed by the reviewer.
4. **The `Show:` label on `/room-schedules`** is a 16px-tall plain text label (not a control, not
   clickable). Pre-existing, untouched by this candidate.

## Part 2b — the `/timetable` row, resolved

`/timetable` opens in the **Simple** layout. `TimetableToolbar` — the component this change rewrote from
`h-7` + `overflow-x-auto` to a wrapping `h-9` `FilterBar` — renders in the **Expert** layout only
(`atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx:752-776` branches on `layoutMode`;
the header itself is mounted at line 787). The earlier capture read `Your schedule is still loading.`
because the Simple layout was resolving, not because staging lacked a run — it has one (Run 347).

With `localStorage['atlas_timetable_layout_mode'] = 'advanced'`, the same value the page's own
`Simple view` button writes, at 1366x768 on real staging data:

| Control | Width × height | `scrollWidth - clientWidth` |
|---|---|---:|
| `Show: Section` | 130×36 | 0 |
| `Schedule for: GR7 - Rizal · SPA` | **224**×36 | 0 |
| `Term: Term 1` | 128×36 | 0 |
| `Program: All` | 128×36 | 0 |
| `Entry type: All` | 129×36 | 0 |
| attention-type chip group | 671×28 | 0 |

Bar box `1110×72`, gap `8px`, left-aligned, `flex-wrap`; two visual lines because the chip group is a
child that does not fit beside five controls — the packet's own "one row that wraps". `[role=combobox]`
count on the page: 5, all 36px, all content-sized, none ellipsised. `More filters`: absent. Sideways
scroll: none. `data-tutorial="grid-controls"` (the guided-walk target) present. Grid rendered with
data (Run 347, `TLE` grid, Mon–Fri).
Screenshot: `shots/timetable-advanced-bar-1366.png`.

`Schedule for: GR7 - Rizal · SPA` at **224px** is the packet's item 2 in one number: the trigger follows
its content (`min-w-32` = 128px floor, content wider, `max-w-[22rem]` = 352px ceiling not reached), and
nothing is cut. The old fixed `w-60 … xl:w-80` rectangle could not have shown that entity name.

**Deployment-acceptance clause.** For LIVE acceptance, `/timetable`'s bar is a browser row on a
deployed build; this candidate-side evidence does not stand in for it (`AGENTS.md` §12). The Simple
layout has no `FilterBar` and this change did not add one there: its three pickers are the Simple
header's own controls, which were not in the packet's scope.

## Screenshots (all at 1366x768, real staging data, this candidate's build)

`shots/dashboard-1366.png`, `year-setup-1366.png`, `sections-1366.png`, `subjects-1366.png`,
`teachers-1366.png`, `teaching-load-1366.png`, `tl-history-1366.png`, `concerns-1366.png`, `map-1366.png`,
`room-schedules-1366.png`, `timetable-1366.png`, `timetable-1366-20s.png`, `timetable-advanced-bar-1366.png`,
plus open/selected states: `sections-program-open-1366.png`, `sections-homeroom-open-1366.png`,
`sections-homeroom-set-1366.png`, `teaching-load-long-face-1366.png`,
`room-schedules-long-face-1366.png`.

## Judged, not just seen (`AGENTS.md` §11 design judgement gate)

Scored against `ux-communication-rubric` on the before/after pair Lane C captured
(`docs/reviews/codex-live-ux-sweep-e75d6b8f.md`):

- **One primary action per screen** — unchanged and still true; the bar carries filters, not actions.
- **No truncation** — PASS. The two defects the sweep and Lane C's second check named by name
  (`Home room: Home room assigned` spilling outside its select; `Archived year: 2029-2030`
  ellipsised) are both closed, measured.
- **No jargon or raw codes in a control face** — PASS. Every filter face reads `Name: value` in the
  page's own words; the program-codes legend is a Tooltip, not a line of codes on the bar.
- **One status per fact** — IMPROVED. `/teaching-load`'s third row of `text-[11px]` chips, each
  restating a value the trigger beside it already showed, is deleted; the values live on the
  triggers and `Clear all` is the one reset control.
- **Controls match other pages** — PASS. Every picker is `@/ui/filter-picker` → `pickerTriggerClass('auto')`;
  the only per-page differences left are the option lists themselves.
- **Nothing cramped** — PASS. 8px gaps, one 36px row, 1060–1078px of bar inside a 1060–1078px content
  column, `flex-wrap` so a state that cannot fit wraps instead of clipping, and no scroll container
  was added anywhere.

No `REJECT_UX` finding. No "More filters" disclosure on a primary path, no clickable that looks like
plain text, no dialog footer covering content.

## What I did NOT do

- No server, data, migration, deployment, generation or publication action. No live listener touched.
  The loopback preview on `:5288` is the only process I started; the staging API on `:5101` was
  consumed read-only.
- No font-size or `--theme` change (A7 c8's lane) and no edit to any other lane's file.
- No fix for the four sweep MINORs this change does not own (sidebar brand, sections double-scroll,
  duplicate `CLOSE PROFILE`/`Close`, modal primitive) — listed above with owners.
