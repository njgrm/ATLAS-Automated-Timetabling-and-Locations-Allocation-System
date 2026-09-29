# A7 C9 — re-fit: baseline vs. after

Base `3b010e74` · candidate `fcff27cb` (fix `d8d83b78` + gate correction `fcff27cb`) ·
branch `work/a7-c9-refit` · worktree `E:/ATLAS-worktrees/lane-a7-c9-refit`

Rendered proof: vite dev preview of THIS worktree on `http://127.0.0.1:5257` (hot-reloaded, never
restarted), session via `/__dev/staging-login`, real staging data, viewport **1366x768**,
`window.location.origin` asserted on every row (`http://127.0.0.1:5257`).
`scripts/qa/ux-audit.js` pasted verbatim from disk into the page context on every page and again with
every dialog/menu open.

**Clip definition used here** (the packet's): an element with `overflow: hidden` (or `overflow-y: hidden`)
where `scrollHeight > clientHeight + 2` and it has text, ignoring `.sr-only` and elements 1px tall.
Reported twice: `clippedBadges` counts only elements carrying `data-slot="badge"` (the comparable number
against the baseline), `clippedAll` counts every such element on the page.

## 1. The before/after table

| Page | audit `major` before → after | clipped chips before | **clipped chips after** | badges on the page | line boxes |
|---|---|---|---|---|---|
| `/` | 0 → **0** | 3 | **0** | 7 | all `14px` |
| `/admin/year-setup` | 0 → **0** | 1 | **0** | 4 | all `14px` |
| `/sections` | 3 → 17 † | 1 | **0** | 86 | all `14px` |
| `/subjects` | 4 → 20 † | 1 | **0** | 68 | all `14px` |
| `/teachers` | 6 → 16 † | 1 | **0** | 80 | all `14px` |
| `/teaching-load` | 0 → **0** | 1 | **0** | 12 | all `14px` |
| `/teaching-load/history` | 0 → **0** | 2 | **0** | 3 | all `14px` |
| `/faculty/concerns` → `/faculty/preferences` | 0 → **0** | 1 | **0** | 3 | all `14px` |
| `/map` | 0 → **0** | 104 | **0** | 166 | all `14px` |
| `/room-schedules` | 0 → **0** | 1 | **0** | 2 | all `14px` |
| `/timetable` | 0 → **0** | 1 | **0** | 10 | all `14px` |
| **total** | | **119** | **0** | | |

† **The three `major` counts that rose are not this change, and the packet predicted one of them.**
`major = mojibake + moreFilters + overflowing + sideways + count(sub-12px text)`. On those three pages the
rise is entirely `smallText` entries under 12px, which are the pre-existing `rem` population
(`/sections` 147 cells under 16px, `/subjects` 138, `/teachers` 130) plus the one `More filters`
disclosure on `/sections` and `/teachers` — all three explicitly **out of scope** below. The packet's own
`/subjects` row says "4 (20 at longer settle)": at the longer settle this walk uses, my number is 20, i.e.
the same measurement the planner already recorded, and the difference from 3/4/6 is how much data had
loaded. Nothing in this diff changes a font size, a cell, or a page's markup: the whole diff is one
`line-height: 1` class on badges, one class name added to the primitive, and three `py-*`/height fixes.
`/subjects` sub-12px faces measured after: 9.6 / 10.4 / 11.2px — **unchanged, not grown, not worsened**.

## 2. The mechanism, proved in a real Tailwind build

The diagnosis was that `cn()` runs `tailwind-merge`, and in Tailwind v4 a `text-*` SIZE utility emits
both `font-size` and `line-height`, so twMerge treats `text-xs` as conflicting with the `leading-*` group
and deletes the primitive's `leading-none`. The rendered `class` attribute of the `Admin` chip on `/`
carries the proof in one line — `leading-none` is GONE (twMerge removed it) and `badge-line-box`
SURVIVED (twMerge does not know the name):

```
inline-flex h-5 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border py-0.5
badge-line-box whitespace-nowrap … mt-0.5 min-h-5 w-fit border-purple-200 bg-purple-50 px-1
text-xs font-bold text-purple-700
```

and the computed style on that same chip — a consumer that re-states `text-xs`, the exact case that used
to clip:

```
font-size 14px   line-height 14px   clientHeight 18   scrollHeight 18   -> not clipped
```

`/map` is the same measurement at population scale: **166 of 166 badges compute to `line-height: 14px`,
and 0 are clipped** (161 room-status chips, of which 20 read `Ready`; the baseline counted 104 clipped
there at a shorter settle).

## 3. Root cause 2 — the static `py-*` sweep

Static sweep for `<Badge … py-…>` across `atlas-client/src`, comment-stripped, tag-scoped:

| | count |
|---|---|
| `<Badge>` tags in production carrying a `py-*` | **25** |
| **fixed** (box + padding did not add up) | **3** |
| judged already-correct, unchanged | **22** |

**Fixed (3):**

| Site | Before | After | Why |
|---|---|---|---|
| `pages/Dashboard.tsx:603` (`dashboard-active-term`) | `px-2.5 py-1.5` on the primitive's `h-5` = 6px content box for a 14px face | `h-7 px-2.5`, no `py` | the house idiom already on the same page at `:586` |
| `pages/Dashboard.tsx:641` (`dashboard-source-health-panel`) | same | same | same |
| `pages/Audit.tsx:757` (`/audit` header source pill) | `px-3 py-1` on `h-5` = 10px content box | `py` dropped, primitive's `py-0.5` | 14px content box; pill stays 20px |

**Judged already-correct (22), with the arithmetic:** `CampusMapOverview.tsx:730` and
`CampusReadinessCard.tsx:607` (`h-5 py-0` = 18px), `RoomSchedulePreview.tsx:106`
(`py-0`, 9px face), `FacultyProfileSheet.tsx:184` (`py-0.5` = 14px, 11.2px face), `:209` (`h-6 py-0.5` =
18px), `:321` (`h-5 py-0.5` = 14px, 14px face), `WorkloadInspector.tsx:243` (`py-0.5` = 14px),
`ScheduleMobileCards.tsx:74` and `ScheduleTimetableGrid.tsx:177` (`py-0` = 18px), `SmartPageShell.tsx:83`
(`min-h-8 py-1` — a floor, not a fixed box, so it grows), `SubjectFormModal.tsx:858` and `:872`
(`py-0.5` = 14px), `QuickPlaceSummaryModal.tsx:102` and `:137` (`py-0` = 18px), `ManualEditPanel.tsx:588`,
`:597`, `:657`, `:658`, `:659` (`py-0`, 8.8px face = 18px), `RoomScheduleOverlay.tsx:370` (`py-0` = 18px),
`SchedulingPolicyPane.tsx:821` (`py-0`, 10px face = 18px), `MapView.tsx:156` (`py-0` = 18px).

`/audit` is the one site the rendered walk could never have found: the pill is in the `/audit` header, a
page outside the Part 2 list. It is the reason the sweep is a gate (`A7C9-3`) rather than a claim.

## 4. Dialogs, menus and dropdowns, audited with each open

Every row: `major` as reported, `mojibake` 0, `overflowing` 0, `pageScrollsSideways` false,
**`clippedBadges` 0**.

| Opened | Page | `major` | clipped badges |
|---|---|---|---|
| `Current Term Readiness` popover (the pill I changed) | `/` | 0 | 0 |
| `Source connection is ready` popover (the pill I changed) | `/` | 0 | 0 |
| `School year status` popover | `/` | 0 | 0 |
| row-size filter dropdown (`10 25 50 100`) | `/sections` | 1 † | 0 |
| first-row dialog (`Aguinaldo — Class coverage, teacher assignments…`) | `/sections` | 1 † | 0 |
| grade filter dropdown (`All grades GR7 GR8 GR9 GR10`) | `/subjects` | 20 † | 0 |
| status filter dropdown (`All status / Teaching assigned (20) / …`) | `/teaching-load` | 0 | 0 |
| row-size filter dropdown | `/teachers` | 1 † | 0 |
| first-row dialog (`M— — TO BE HIRED, MAPEH`) | `/teachers` | 11 † | 0 |
| grade filter dropdown (`GRADE 10 ACADEMIC WING / G10 Room 101 (F1) …`) | `/room-schedules` | 0 | 0 |
| `Inspect Rooms` room-status list (166 badges) | `/map` | 0 | 0 |
| room-status filter (`All rooms 103`) | `/map` | 0 | 0 |
| header `More` menu (`More items below. Scroll down to see all of them.`) | `/timetable` | 0 | 0 |

† again entirely the out-of-scope `More filters` + pre-existing sub-12px `rem` text; the audit's `major`
rose or fell between these rows only with which rows of the table had scrolled into the viewport.

**UNPERFORMED (1):** `/subjects` first-row dialog. Subjects renders cards, not table rows — zero
`button`/`a` controls exist inside any `tbody tr` on that page, and 7 card controls were tried without a
`role="dialog"` appearing. The page and its filter dropdown were audited; the row dialog was not
reached, and I am not claiming it as passed.

## 5. Screenshots (1366x768)

`docs/reviews/a7-c9-refit/shots/` — 01 dashboard, 02 admin-year-setup, 03 sections, 04 subjects,
05 teachers, 06 teaching-load, 07 teaching-load-history, 08 faculty-concerns, 09 map, 10 room-schedules,
11 timetable, 12/13/14 the three Dashboard popovers, 15/16/17 filter-open and row-dialog per page,
18 teaching-load filter, 19 room-schedules filter, 20 map Inspect Rooms, 21 timetable More menu,
23 map room-status filter.

Checked on each: **no** text outside its box, **no** "…" in any trigger, menu item, chip or header, **no**
garbled characters, **no** horizontal scrollbar (`pageScrollsSideways: false` on every row), **no** footer
covering content. The pills read whole: `Admin`, `Checking source`, `Year aligned`, `Active Term: T1`,
`Live source`, `Rooms loaded`, `Fix rooms first`, `Needs rooms`, `View only`, `13% full`, `GR7`.

## 6. Gates

| Gate | Command | Result |
|---|---|---|
| New gate | `npx tsx --test src/lib/__tests__/a7-c9-refit.test.ts` (in `atlas-client`) | **4/4 pass** |
| Same gate, base source | see the failing-first record in the handoff | **3 of 4 fail** |
| Encoding | `npm run test:encoding` (repo root) | **1/1 pass** |
| Client suite | `npm run test:client-suite` (in `atlas-client`) | 1322 tests, 1280 pass, **42 fail — all 42 identical at base `3b010e74`** (base run: 1318/1275/**43**; the one difference is my own test file being unnamed by the base `package.json`). Failing rows only after this candidate: **0**. |
| Whitespace | `git diff --check` | clean |
| Tailwind build | real `@tailwindcss/node` compile in `A7C9-2` | `.badge-line-box.badge-line-box{line-height:1}` emitted, specificity 20 > `.text-xs` 10 |

The 42 pre-existing failures are timetable/teaching-load source-contract rows (`tt-warning-surface-realism-c07b`,
`ux-r03e-timetable-runs-setup`, `a2-c11-s2-header-banners`, `timetable-dynamic-workspace-*`,
`tt-source-freshness-client-c04`, `tt-tl-modules-c04r1-*`, …). None is badge-, index.css-, Dashboard- or
Audit-related, and this candidate changes no assertion and deletes no test.

## 8. Integration state — the concurrent-lane merge was NOT run

`git merge` and `git push` are both denied to this executor's permission set, so the packet's
"merge `origin/main` before you start and again immediately before you commit" did not happen. Nothing was
worked around. What that costs, measured rather than assumed:

- `origin/main` has moved **75 paths** since the base `3b010e74`.
- **Two of my five edited files were also changed on `main`:** `atlas-client/package.json` (main added
  one script, `test:a3-c16-no-codes`; `test:client-suite` itself is **unchanged** on main) and
  `atlas-client/src/pages/Audit.tsx` (main's hunks are at ~line 136 and ~line 491, an unrelated region;
  my hunk is at ~line 757). Both are expected to merge cleanly per hunk, but the planner must confirm it.
- **`main` still carries the `/audit` header pill with `px-3 py-1`** (verified with
  `git show origin/main:atlas-client/src/pages/Audit.tsx`). If a merge ever resolves that file by taking
  one side wholesale, the 10px content box comes back and `A7C9-3` fails — which is the gate doing its
  job, not a silent regression.
- `atlas-client/src/index.css`, `ui/badge-variants.ts` and `pages/Dashboard.tsx` are untouched on `main`
  since the base, so the primitive fix and both Dashboard pills carry over with no conflict.

## 9. Measured, NOT fixed (out of scope, per the packet)

- **2 `More filters` disclosures** — `/sections` and `/teachers`, one each. A5 c8's row. Confirmed
  present; not touched.
- **Sub-12px `rem` text on `/subjects`** — 9.6 / 10.4 / 11.2px faces (`ACTIVE SUBJECTS`, grade badges,
  `Owned by …`, `TERM 1`). Measured identical to the pre-existing population; not grown, not worsened.
  c8 re-fit row 2. `/sections` (147 cells under 16px) and `/teachers` (130) carry the same class of
  pre-existing `rem` text.
- **Sidebar chrome, pre-existing, on every page including pages with no badges:** the brand block
  (`ATLAS High School / SCHEDULING PORTAL / S.Y. 2023-2024 • ACTIVE`) is clipped at the top of the
  viewport (`clientHeight` 48 / `scrollHeight` 63) and each nav link carries 3px of hidden line box
  (`32/35`). That is the whole of the residual `clippedAll: 13–14` on every page. It is not a
  `data-slot="badge"` element, it is identical on `/room-schedules` (2 badges) and `/` (3 badges), and
  nothing in this diff touches the sidebar. **Owner's call, not this lane's.**
- **`palette-slate400-step2-a3-s-f.test.ts` is RED on the base commit, before this change.**
  It pins the LF-normalised SHA-256 of `atlas-client/src/index.css`; the pin
  `27d6cde6b5307facf1fcc7cea51af798f340214c3890e1bfbc5254a033313940` already did not match the file at
  `3b010e74` (measured `b6670d1c4c396d207b1f824444f481b88708fd21dc9db9468d4c083d0e63fd6d`), and
  `npm run test:a3-palette-slate400-s-f` fails there with *"src/index.css changed again since A3-C9
  correction 3"*. c8's `a528caa6` moved `index.css` and did not repin. It is not in `test:client-suite`,
  so it does not affect the row above, and **it still needs a repin by its owner** — a file outside this
  lane's write scope. Editing `index.css` again does not create that debt; it was already there.
