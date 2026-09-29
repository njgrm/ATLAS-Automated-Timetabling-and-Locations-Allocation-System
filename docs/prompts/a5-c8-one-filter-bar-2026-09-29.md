# A5 c8 — one filter bar everywhere, dropdowns that fit (implementation packet)

Lane A5 implementation packet for section **A5 c8** of `docs/prompts/ui-foundation-2026-09-29.md`.
Governing sweep: `docs/reviews/codex-live-ux-sweep-e75d6b8f.md` (MAJORs on `/sections`, `/subjects`,
`/teachers`, `/teaching-load`). Walk standard: `docs/plans/codex-walk-standard.md` Part 2.
Risk: **MEDIUM** (a shared primitive; every roster page changes) → one executor, one fresh independent
QA over the immutable range, then planner integration. No HIGH action, no live data, no deployment.

Base: `316f967e` (main tip when this packet was written). Branch: `work/a5-c8-filterbar`.
Worktree: `E:\ATLAS-worktrees\lane-a5-c8-filterbar`. **One writer: Lane A5's executor. No other
agent writes in this worktree.**

## 1. Who this is for and what should feel different

The user is an older, mouse-first scheduler who narrows a long roster to the slice they need this
morning. Today, on four of the list pages, the filters they might want are behind a button they
have to find, and the visible value of a chosen filter is sometimes a cut-off word.

After this change every list page reads the same way: **search, then the filters, in one row that
wraps.** Nothing is concealed. Nothing is cut off. A second *line* of filters is fine — a second
*click* to discover a filter is not.

This is a layout-and-fit change. **If an edit here changes WHICH rows a value selects, it has
stopped being this change.** Every option list, value, `shortLabels` map, `ariaLabel`, `data-testid`,
`id` and predicate stays exactly as it is; only the CHROME, the WIDTH and the PLACEMENT move.

## 2. `@/ui/filter-bar.tsx` — NEW, the one filter bar

One component, one order, one geometry. Contract:

```
<FilterBar
  search={{ value, onChange, placeholder, ariaLabel }}
  onReset={...}          // optional; when omitted no reset control renders
  resetLabel="Reset"     // optional, defaults to "Reset"
  dataTestId="..."       // optional
>
  {/* FilterPicker / Switch / Button children, in reading order */}
</FilterBar>
```

- ONE row: `flex flex-wrap items-center gap-2`. Left-aligned. It wraps; it never scrolls and never
  clips. It is a `shrink-0` block in the page shell, never a scroll container — `AGENTS.md` §8's
  no-global-scrollbar rule is load-bearing and this component must not add a scroller.
- Search: exactly `w-[240px] shrink-0`, `Input` with `PICKER_CONTROL_HEIGHT_CLASS` (`h-9`) and a
  leading `Search` glyph at `left-3`. The search input MUST take its height from
  `PICKER_CONTROL_HEIGHT_CLASS` — never a second literal `h-9` typed at a call site.
  Its font size must be neutralised against `@/ui/input`'s own responsive pair
  (`text-base sm:text-sm`): pass an explicit `sm:text-xs` beside `text-xs` or the `sm:` variant
  wins at every viewport ≥640px. (A5 c7 recorded this exact trap in a measured row.)
- Every child control is `shrink-0`. Height, radius, border, case and search behaviour come from
  `@/ui`; a page passes a `width` VARIANT, never a class string (`AGENTS.md` §8).
- **No disclosure.** `FilterBar` has no overflow, no `More` button and no popover. If a page has
  more filters than fit, they wrap onto a second line.
- **No legend line inside the bar.** Where a page had a legend beneath the bar (see §3, `/sections`),
  it moves into a Tooltip on the control it explains.
- `onReset` renders ONE ghost `Button` at the END of the row, `h-9 shrink-0`, shown only while a
  filter is set, and it is the only such control in the product. Pages pass their existing handler
  and their existing wording (`Reset` / `Reset filters` / `Clear all`). It does not take a `flex-1`
  and does not push the row wide.

## 3. Every page, and what replaces what

Order and wording of the filters are the page's own. Only placement, chrome and disclosure change.

| Page | Today | After |
|---|---|---|
| `/subjects` | `AdminSearchFilterToolbar` with the disclosure props passed **inert** (`filtersOpen={false}`, `onToggleFilters={() => {}}`, `primaryFilterCount={1}`) purely so the shared component's `overflowChildren` is empty and the disclosure cannot render | `FilterBar` directly. Delete the inert-prop workaround and its comment. `SubjectFilterToolbar` keeps every picker, its `ROOM_TYPE_SHORT_LABELS`, its merged `SubjectStatusFilter`, its `dataTestId`s and its `subjects-reset-filters` button's meaning (`FilterBar`'s `onReset`). |
| `/sections` | `SectionsFilterToolbar` renders `grid-cols-3` on `sm:` and a `program-code-legend` `<p>` beneath the bar | `FilterBar`. The three pickers are `width="auto"` siblings in the one wrapping row, left-aligned, in the same order (Grade, Program, Home room). **The program-code legend moves into a Tooltip on the `Program` picker** (new `hint` prop, §4). Delete the legend `<p>` and its `data-testid="program-code-legend"` only if you also repoint every test that reads it to the new tooltip text; otherwise keep the testid on the tooltip trigger wrapper. |
| `/teachers` (`Faculty.tsx`) | `AdminSearchFilterToolbar` with no `primaryFilterCount`, so `FacultyFilterRow` is the single OVERFLOW child → a real `More filters` button, and the four roster filters are behind it | `FilterBar` with `FacultyFilterRow`'s four pickers as children. `FacultyFilterRow` keeps its own props and every `data-testid`; its own `Reset filters` button is replaced by `FilterBar`'s `onReset` so there is one reset control, not two. Delete `showFilters` / `onToggleFilters` state if nothing else reads them. |
| `/teaching-load` (By-teacher view) | `TeachingLoadFilterBar` — already one wrapping row, but it ALSO renders a second row of `text-[11px] font-bold uppercase` `Badge` chips plus a `Clear all` button, and a `Reset` is not on the row | `FilterBar`. Keep the search, `Status`, `Department`, `Load`, `Sort` and the two inclusion switches, in that order, and `FilterBar`'s single `onReset` (`Clear all`). **DELETE the active-filter Badge row**: it is a second visual row whose every chip restates a value the adjacent trigger already shows, which is the "two chips that say the same thing" §8 forbids. Keep the `sr-only` `role="status"` announcement and the `!policyReady` notice — they are a different job. Keep both switch `id`s (`show-outside-dept`, `show-unmapped-specialization`), their tooltips and the draft controls' `ml-auto` group. |
| `/teaching-load/history` | `TeachingLoadHistoryView` — three `FilterPicker`s, a `Find a teacher` `Input`, and an `Archived year` face Lane C measured at 128px wide with a 186px scroll width | `FilterBar` with the three pickers (`width="auto"`), the search, and the existing `teaching-load-history-search` input. The `Archived year` trigger is the packet's named symptom: its face must fit with no ellipsis (§4). The totals line, the empty state and the read-only notice stay. |
| `/room-schedules` | A `SearchableSelect` whose trigger width follows the room list, plus other page controls | The room picker becomes a `FilterBar` child (`width="auto"`, `name="Room"`, so the face reads `Room: …` and the two are never confused with the `Term`/`Year` pickers elsewhere). It is the only filter on this page, so it is the only child. If the page has a second control that acts as a filter, it joins the same row. |
| `/timetable` | `TimetableToolbar` — a horizontal `overflow-x-auto` strip of raw Radix `@/ui/select` at `h-7 w-32`, an entity `SearchableSelect` at `h-7 w-60`, a bare `<span>Term</span>` label, and a `Filters` **disclosure popover** holding `Program`, `Entry type` and the attention-type chips | `FilterBar` with: view mode, `Schedule for` (the entity picker), `Term`, `Program`, `Entry type` and the attention-type chips — all inline, all `h-9`, no disclosure, no `overflow-x-auto` strip, no bare `<span>` label (the `Term` prefix is the picker's own `name`). Tabs, the grid, `data-tutorial="grid-controls"`, `data-testid="timetable-term-filter"` and `data-testid="timetable-filters-trigger` callers are preserved: keep the term testid, and if a row reads `timetable-filters-trigger` move it to the bar's container. |
| `/faculty/concerns` | `Search a teacher by name.` in an `Input` isolated far below the header, in its own look | `FilterBar` with that same input as its search, in the common bar position below the page title/status strip. Placeholder wording is normalised to the shared form (`Search teacher…`); the disabled/empty placeholders (`Teacher roster unavailable`, `No teachers loaded`) stay, because they are honest states. |

Also: `AdminWorkspace.tsx` — delete the `More filters` trigger and the overflow panel from
`AdminSearchFilterToolbar` **and** the `Narrow long lists` help step that tells a user to find a
`More filters` button. If `AdminSearchFilterToolbar` has no remaining consumer after the above, delete
the component and its file section rather than leaving a second filter bar in the codebase; if it does,
it must render `FilterBar`'s geometry. **No page may end up with two filter-bar implementations.**

## 4. Selects and pickers fit their text

`@/ui` changes, in `@/ui/picker-trigger.ts`, `@/ui/filter-picker.tsx`,
`@/ui/searchable-select.tsx` and `@/ui/select.tsx`:

1. **`auto` width variant gets a floor and a ceiling.** `auto` becomes
   `w-auto min-w-32 max-w-[22rem]` (8rem / 22rem, the packet's own numbers). `min-w-*` and `w-*` are
   different tailwind-merge groups, so a floor stated IN the variant governs the width — do not
   reintroduce the removed `min-w-[160px]` bug that made every variant inert.
2. **A long face WRAPS inside its box; it never spills and never ellipsises.** The `auto` trigger
   therefore carries `h-auto min-h-9 items-center py-1` (one line when it fits, two when it must) and
   its label span carries no `truncate` and no `whitespace-nowrap`. This is the exact defect Lane C
   recorded on `/sections`: "Home room: Home room assigned spills outside its select". The
   `whitespace-nowrap` that `auto` carried for a DYNAMIC label is what lets a face run past its own
   border; it is replaced, not kept.
3. **Menu content is at least as wide as the trigger**, and never narrower than 18rem:
   `PopoverContent` keeps `w-[var(--radix-popover-trigger-width)]` and gains `min-w-72`
   (`min-width` is a floor, so this is `max(trigger, 18rem)`) plus a viewport cap
   `max-w-[min(28rem,calc(100vw-2rem))]`.
4. **Menu items wrap; they do not truncate.** In `SearchableSelect`, `<span className="truncate">` on
   an option row is GONE: the row goes `items-start` and the label gets
   `whitespace-normal break-words text-left`. Every option label stays readable in full.
5. **The menu opens downward with collision padding**: `side="bottom"`, `align="start"`,
   `collisionPadding={8}` (already present) and Radix's `avoidCollisions` left on so it shifts inside
   the viewport rather than escaping it. The `PopoverContent` is portalled (already true).
6. **The same two rules for the Radix `@/ui/select`**: `SelectTrigger` loses
   `[&>span]:line-clamp-1` (that is a truncating clamp, and it is the ellipsis Lane C measured), and
   its label span becomes `whitespace-normal break-words text-left`; `SelectContent`'s viewport keeps
   `min-w-(--radix-select-trigger-width)` and gains `max-w-[min(28rem,calc(100vw-2rem))]`.
7. **A tooltip-capable picker, for the code legend that is leaving the bar.** `FilterPicker` gains
   ONE optional prop, `hint?: string`, which renders its `SearchableSelect` trigger inside a
   `@/ui` `Tooltip` (with `TooltipProvider`) whose content is that string. Absent `hint` renders
   byte-for-byte what it renders today. No `title` attribute, no raw `<details>` (`AGENTS.md` §8).
   Keep the picker's own `aria-label` unchanged; the tooltip is `aria-describedby` at most, or purely
   visual.

## 5. Tests — a new gate, wired in the same commit

`AGENTS.md` §11: "A test no gate runs is not evidence." Add the test file AND the `package.json`
script entry in the SAME commit.

`atlas-client/src/ui/__tests__/a5-c8-filter-bar-contract.test.tsx`, plus a script entry in
`atlas-client/package.json` named for what it polices (e.g. `test:ux-filter-bar`), and wire it into
the client suite the existing `a5-c3-picker-contract.test.tsx` runs from. It must fail, on the BASE
commit, for the reasons the packet names — the test is a gate on this change, not a description of it.
Rows:

- **Source-scan rows (real, not invented):** no `More filters` string anywhere in
  `atlas-client/src/`; no `truncate` inside `searchable-select.tsx` option rows; no `line-clamp-1` on
  `SelectTrigger`; no `overflow-x-auto` on a filter row.
- **Structural rows:** `FilterBar` renders search + children in one `flex flex-wrap items-center gap-2`
  row; the search input carries `PICKER_CONTROL_HEIGHT_CLASS` and a `w-[240px]` wrapper; the reset
  control appears only when a filter is set and is the LAST child; no `FilterBar` renders a button
  whose text contains `More`; the `auto` variant string contains `min-w-32` and `max-w-[22rem]`.
- **Behaviour rows (real surface, §11):** every page's filter bar is reachable with no extra click —
  for `/sections`, `/subjects`, `/teachers` and `/teaching-load`, assert that the filter value a user
  would want to set is present in the DOM on first render (it was behind a disclosure before). Use
  the REAL option lists those pages pass, not retyped fixtures.
- **Preservation rows:** every existing `data-testid` / `id` named in §3 still renders
  (`teachers-grade-filter`, `subjects-status-filter`, `subjects-room-type-filter`,
  `subjects-program-filter`, `teaching-load-primary-filters`, `teaching-load-inclusion-switches`,
  `show-outside-dept`, `show-unmapped-specialization`, `timetable-term-filter`,
  `teaching-load-history-year-picker`, `teaching-load-history-search`,
  `teaching-load-filter-announcement`).
- Re-run and keep green: `a5-c3-picker-contract.test.tsx`, `a5-p3-picker-guard.test.ts`, the
  Subjects suites, `a3-teachers-load-a3.test.tsx`, `a3-c10-tl-header-density.test.ts`, the
  timetable/room-schedules suites that reach the moved controls, and the full client suite
  (`npm test` in `atlas-client`). Plus `npm run test:encoding` at the repo root.

## 6. Explicitly OUT of scope (another lane owns these)

- **A7 c8's type scale** (`--text-xs` → 14px, every `text-[9-12px]` → `text-xs`, the size ratchet).
  A7 has its own worktree and its own push window. Do NOT change font sizes, `--theme` tokens or
  `index.css` here, and do not re-pin A7's ratchet tests. If a file you touch still has a
  `text-[11px]`, leave it for A7 and say so in the handoff. Exception: text you DELETE (the
  `text-[11px]` Badge row in §3) is removed as part of this change.
- The sidebar brand truncation, the sections double-scroll/paginator, the duplicate `CLOSE PROFILE` /
  `Close` dialog controls, and the modal primitive: Codex-sweep MINORs owned by other lanes. List
  them in the handoff; do not touch them.
- Anything on the server, any data, any migration, any deployment.

## 7. Definition of done for the executor

1. `npm test` in `atlas-client` green, `npm run test:encoding` green, client `tsc` and build green.
2. The new test file is reachable from a committed `package.json` script **in the same commit**.
3. Committed as ONE review candidate on `work/a5-c8-filterbar`, conventional-commit message
   `feat(filter-bar): one wrapping filter bar everywhere, dropdowns that fit`, pushed.
4. `git stash list` empty, `git status --short` empty, no untracked residue, no helper scripts left
   in the worktree.
5. Handoff: one page — base/candidate SHA, exact changed paths, the decisive commands with their
   results, the test row tallies, and every place you deviated from this packet with the reason.
