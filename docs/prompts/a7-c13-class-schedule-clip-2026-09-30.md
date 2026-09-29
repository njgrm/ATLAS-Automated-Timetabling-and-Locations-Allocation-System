# A7 c13 — Class Schedule clipping and the Warning list that is not what it says

**Owner:** A7 (Class Schedule layout and words) · **Executor:** `atlas-executor-ds` · **Worktree:** `E:/ATLAS-worktrees/lane-a7-c13-clip` · **Branch:** `work/a7-c13-class-schedule-clip` · **Base:** `607f2363` (origin/main)

## Why (the operator's words)

Codex walked train 13 staging at 1366x768, Class Schedule, Term 1, Draft Run 350, section **GR7 - Luna** (2026-09-30 05:55) and found text **cut off with an ellipsis**. The operator treats clipped text on the Class Schedule as a release blocker.

> **Fix: no text on the Class Schedule is ever cut off with an ellipsis; it wraps.**

The user on this screen is an older, mouse-first scheduler. A sentence that ends in `…` reads as a defect, not as a density choice. Where the text is one the user must read to act (what changed, which ceremony occupies the slot, who teaches the class, what the drawer asks them to confirm), it must **wrap**. §8 forbids a cut-off sentence.

**One candidate, one commit per item.** Five items below, five commits, one branch.

## Boundaries (hard)

- **Client-only.** Files under `atlas-client/src/**`. No `atlas-server/**`, no `prisma/**`, no `ops/**`, no migration.
- **No live writes, no deploy, no publish.** Do not touch the supervisor, ports 5001/5174, staging, the database, or any `.env`.
- Do not edit `CHANGELOG.md`, the register, or `docs/handoffs/` — the planner owns those.
- Do not change behaviour other than what each item says. No renames, no refactors beyond the named lines, no new `@/ui` primitives.

## Required outcome, item by item

Each item: **reproduce first as a failing test against the current tree, then fix, then the test passes.**

### Item 1 — commit: `fix(timetable): the change-notice sentence wraps instead of clipping`

**Seen:** `Teaching Load and Te…` in the Simple header.

**Evidence:** `atlas-client/src/components/timetable/simple/SimpleChangeNotice.tsx:166`. The sentence span carries `lg:truncate lg:whitespace-nowrap`, so at 1366 px the sentence `Teaching Load and Teacher availability changed since this schedule was made.` (built by `changeNoticeSentence`, `SimpleChangeNotice.tsx:67`) is cut with an ellipsis.

**Fix:** the sentence wraps. Remove `lg:truncate lg:whitespace-nowrap` and keep it readable at `lg` (`break-words`, `min-w-0`). The header must stay calm: it stays **≤ 2 rows**; the sentence may take two lines inside its own row, it must not push `Term`, the picker or the primary onto a third region. Do not reintroduce an ellipsis anywhere else in this row.

**Failing-first:** a test that renders `SimpleChangeNotice` (or `changeNoticeSentence`'s row) and asserts the sentence element carries **no** `truncate`/`whitespace-nowrap` and does carry a wrap class, using the real sentence for 2 real changed areas (e.g. `['Teaching Load', 'Teacher availability']`), and re-asserting the historical 1-area and 3-area sentences still read correctly. If `a2-c11-s2-header-banners.test.tsx` / `a2-c12-header-two-rows.test.tsx` / `a2-header-budget-2026-09-29.test.tsx` pin `lg:truncate` on this span, update only that assertion and say so in the commit message; if they pin a row count, keep it green.

### Item 2 — commit: `fix(timetable): the flag/homeroom ceremony label wraps in the grid cell`

**Seen:** `Flag Ceremony / Homeroom …` in a grid cell.

**Evidence:** `atlas-client/src/components/timetable/TimetableGrid.tsx`:
- line 349 — `<span className="min-w-0 truncate">{eventName ?? 'Special Event'}</span>` (the ceremony-overlay label rendered inside the cell when the period also holds a class);
- line 368 — the same shape for the blocked-window overlap label;
- line 340 — the `Move here` cue, same `truncate` family in the same cell.

**Fix:** every one of these in-cell labels wraps (`break-words`), never an ellipsis. The cell already has `min-height`, so a taller cell is expected and correct.

**Failing-first:** render `TimetableGrid` with a day-scoped special-event slot whose `eventName` is long (use the real value `Flag Ceremony / Homeroom`) **and** a class entry in the same cell, then assert `[data-testid="timetable-ceremony-overlay-label"]` contains no `truncate` and contains a wrap class, and its text is the full event name. `ux-audit-findings-c01.test.tsx` already builds a `Flag Ceremony` slot at line 271 — extend it rather than inventing a fixture.

### Item 3 — commit: `fix(timetable): matrix and overflow-sheet class lines wrap instead of clipping`

**Seen:** `J. VILLANUEVA · Room 104 · …` (the class detail line). Lane C already changed the **table** grid cell subject and detail lines from `truncate` to `break-words` in `110cadd0` (`TimetableGrid.tsx:485,487,554`). **Reproduce before you change anything:** render the Class Schedule grid, matrix and overflow surfaces with a real run entry and find which component still cuts the detail line with an ellipsis. Fix **that**. The named candidates are:

- `atlas-client/src/components/timetable/ClassProgramMatrixView.tsx` — **matrix view**: line 217 (`subjectLabel`, `truncate`), line 220 (room · teacher, `truncate`), line 224 (`entryContextLabel`, `truncate`).
- `atlas-client/src/components/timetable/TimetableCellOverflowSheet.tsx` — the per-slot sheet: line 99 (subject, `truncate`), line 111 (`section · teacher · room`, `truncate`).
- the simple-mode grid: `TimetableGrid` with `simpleMode` (same cell, already `break-words`). If it renders clean, record that in the commit message — do not invent a change.

**Fix:** the detail/subject lines on these surfaces wrap.

**Failing-first:** one test that renders `ClassProgramMatrixView` (long subject + room + teacher; and `entryContextLabel` returning a long adviser string) and asserts no `truncate` and a wrap class on each of the three lines; plus a render of the overflow sheet row asserting its subject and `section · teacher · room` lines do not clip. If your reproduction shows the table cell still clipping, fix `TimetableGrid.tsx` and say so.

### Item 4 — commit: `fix(timetable): the task-drawer step text wraps instead of clipping`

**Seen:** the review drawer step `Confirm blockers are c…`.

**Evidence:** `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx:181` and `:184` — `<span className="truncate">{copy.stepOne}</span>` / `{copy.stepTwo}`. `copy.stepOne` for the publish task is `Confirm blockers are clear` (line 119).

**Fix:** both step spans wrap. Do not shorten the step wording. Keep `1.` / `2.` and the chevron; the steps region may grow a line.

**Failing-first:** render `TimetableTaskDrawer` with `task="publish"` and assert the step text `Confirm blockers are clear` is present in full and neither step span carries `truncate`.

### Item 5 — commit: `fix(timetable): Review warnings shows the warnings it counts, and says why an empty list is empty`

**Seen:** *Review warnings* opens a list whose chip reads **Warning (236)** and whose body then says **No matching violations**.

**Evidence (the bug):** `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx:245-248` — `onReviewIssues` sets `leftRailContentContext.setSeverityFilter('hard')` and then opens `review-issues`. When the run has 236 warnings and 0 must-fix problems, the rail is filtered to must-fix, finds none, and prints the generic `No matching violations` (`GeneratedRunRailPanels.tsx:286`) under a chip that says Warning (236). The chip counts come from the unfiltered `violations` (`GeneratedRunRailPanels.tsx:246-251`), so the two disagree.

**Fix, both halves:**
1. **Show the warnings.** Opening the list from *Review warnings* must leave the rail showing Warning-severity entries. `SimpleTaskDrawerHelpers.tsx:308` is that button; give it its own handler that sets the Warning filter (keep the blocker-group path at `SimpleTaskDrawerHelpers.tsx:231/234` setting the must-fix filter so "go to this blocker" still works).
2. **Say plainly why a filtered list is empty.** Replace the single generic `No matching violations` (`GeneratedRunRailPanels.tsx:280-287`) with an honest sentence that names the active filter and the hidden count, e.g. `No must-fix problems in this term. 236 warnings are hidden by this filter.` with one action to show them. Keep it one calm line; no new chip.

**Failing-first:** a test that (a) drives the *Review warnings* control and asserts the severity filter ends on Warning, and (b) renders `GeneratedViolationsPanel` with `violations` = 3 soft + 0 hard and a must-fix filter, asserting the empty body names the hidden count instead of `No matching violations`.

## Design intent (write it before the code)

Add a short layout note at the top of the first changed component file (3–6 lines): who reads this screen, what each clipped string means to them, and why wrapping (not shortening) is right. Follow §8: **subtract first** — a fix that only adds words to a region must remove at least as much. Name the page that does it best if you copy a pattern; invent no local variant.

## Tests and gates (literal commands, from the worktree root)

1. `npm --prefix atlas-client run typecheck`
2. New script in `atlas-client/package.json`: `"test:a7-c13-clip"` running your new test file(s). §11: a test no gate runs is not evidence — the script entry ships in the same commit as the test.
3. `npm --prefix atlas-client run test:a7-c13-clip`
4. Preservation: `npm --prefix atlas-client run test:ux-audit-findings` and `npm --prefix atlas-client run test:a7-c12-calm-header` and `npm --prefix atlas-client run test:ux-a2-c11-s2-header` and `npm --prefix atlas-client run test:ux-a2-c12-header-rows` and `npm --prefix atlas-client run test:ux-a2-header-budget` and `npm --prefix atlas-client run test:ux-tooltip-a7c10`.
5. `git diff --check`

Record what you actually ran and its literal result. If a preservation suite was already red on the base, prove it red on the base too and report `PRE-EXISTING` — never silently change an assertion to make it pass.

**Do not** run `vite preview`, `npm run dev`, or `node dist/server.js` in the foreground. Do not install dependencies. Do not `git stash`, rebase, or amend. Do not commit anything outside `atlas-client/**` plus the new prompt file.

## Handoff (one page, short)

Base SHA · candidate SHA · exact changed paths · the five commands run with their literal results · known risks each marked `BLOCKING`/`NON_BLOCKING` · verdict. No transcripts.
