# A6 c8 — fix-doc item 39 (`/teaching-load` "More filters") and 17.1 (`/subjects` coverage count opens nothing)

Lane C packet, 2026-09-29 13:05. Source of the items: `docs/prompts/fixdocs-leftovers-2026-09-29.md`
(A6 section) and the operator's own `fix-2.docx` items 39 and 17.1. Live evidence
(`docs/reviews/codex-live-fixdocs-3216d383/report.md`): 39 **NOT FIXED**, 17.1 **NOT FIXED**.

Base SHA `94daebf7` (`origin/main` at packet authoring). Worktree
`E:/ATLAS-worktrees/lane-a6-c8-more-filters`, branch `work/a6-c8-more-filters`.
A5 c5 (`work/a5-c5-proof-fixes`) is NOT merged and touches `pages/TeachingLoad.tsx` only —
do not touch that file; every path below is disjoint from A5's.

**Both items are VISUAL + behavioural on `/teaching-load` and `/subjects`. They change no data,
no API, no auth and no route. Risk tier: MEDIUM (a control that opens a dialog is behaviour, not
copy), so one fresh QA over the exact range is required before integration.**

## 0. What the planner already measured (real staging data, 1366x768, loopback preview on :5277)

Do not re-derive these; use them. They are the reason the design below is what it is.

`[data-testid="teaching-load-primary-filters"]` **client width is 1078px**, not the ~1326px the
file's own comment claims. The page's left rail is 272px, so the toolbar's whole budget at 1366 is
1078px. Measured children of that row, left to right:

| control | width | x |
|---|---|---|
| search `div` | 240 | 272 |
| `Filter by status: All status` | 208 | 520 |
| `Filter by department: All departments` | 208 | 736 |
| `Filter by load: All loads` | 208 | 952 |
| `Sort teachers: Lowest load` | 208 | **272 (wrapped to line 2)** |
| `More filters` | 112 | 488 (line 2) |
| draft group (`ml-auto`) | 292 | 1058 (line 1) |

**So the row is already TWO rows at 1366, with or without the draft.** `flex-wrap` put `Sort` and
`More filters` on line 2. That is the real defect behind item 39: not only is there a menu, the
row does not fit.

Consequence for the arithmetic, and it is the load-bearing constraint of this packet:

- 4 pickers at `xl` (208) = 832, plus a 240 search = 1072, plus 5 gaps (40) = **1112 > 1078**.
  The four pickers **cannot** stay at `xl`.
- 4 pickers at `lg` (176) = 704, plus 240 search, plus 6 gaps (48) = 992, leaves **86px** for two
  labelled toggles. Two Radix switches alone are 72px. Not viable.
- The ONLY width that fits is content-sized. `pickerTriggerClass('auto')` is the shared variant for
  exactly this case — `ui/picker-trigger.ts` documents `auto` as "for a trigger whose LABEL IS
  DYNAMIC, so a fixed rectangle would either clip it or leave a gap beside it", and a server-supplied
  department label is the dynamic case. Measured default faces at `text-xs` Inter: `Status: All`
  ~110, `Department: All` ~128, `Load: All` ~98, `Sort: Load, low` ~134 = ~470 total. With the 240
  search and 6 gaps (48) that is 758, leaving **320px** for the two toggles at the default state.

## 1. Item 39 — no `More filters` menu; the two inclusion switches become direct toggles

The operator's own words, `fix-2.docx` item 39, bullets 2 and 3:

> **Completely remove the `[More filters]` trigger button from the DOM.** …
> Place all filter controls sequentially in one continuous horizontal bar
> (`flex flex-wrap items-center gap-2`): 1. Search Input … 6. **Toggle 1: `CROSS-DEPT` (compact
> toggle switch with text label)** 7. **Toggle 2: `UNMAPPED SPECIALIZATION` (compact toggle switch
> with text label)** … Style the two toggle switches compactly so their labels and switch tracks
> fit neatly at the end of the row without wrapping on desktop screens.

So: both switches, on the row, no menu, no second band. Required edits in
`atlas-client/src/components/faculty-assignments/TeachingLoadFilterBar.tsx`:

1. **Delete the `<Popover>` block entirely** (trigger `data-testid="teaching-load-more-filters"`,
   the panel `data-testid="teaching-load-more-filters-panel"`, the `ListFilter` import if nothing
   else uses it, and the `inclusionCount` computation whose only consumer it was). The trigger must
   not exist in the DOM in any state. No "second row" wrapper is introduced — the row stays one
   `flex flex-wrap items-center gap-2` element.
2. **All four `FilterPicker`s move from `width="xl"` to `width="auto"`.** Do not rename a picker,
   do not add a per-option colour, do not shorten an option label. `FilterPicker` has no
   `className` prop, so this is the only lever and it is the shared variant — `AGENTS.md` §8 "One
   look per control" is satisfied because all four take the SAME variant, and `auto` cannot clip,
   so a long department name is no longer a silent-truncation risk.
3. **Search stays `w-[240px] shrink-0`.** Do not touch it. It is the operator's number
   (`w-[240px] (or max-w-[260px])`), it is a live committed assertion, and with `auto` pickers the
   row fits without changing it.
4. **The two switches render directly on the row, after `Sort` and before the draft group**, each
   in the file's existing `SWITCH_CHROME` box (reused, not restyled) with a real
   `<Label htmlFor>` as today. **Ids are unchanged**: `show-outside-dept` and
   `show-unmapped-specialization`.
5. **Visible labels get shorter; the full sentence moves to a `@/ui` `Tooltip` AND the switch's
   `aria-label`.** Use these visible labels:
   - `show-outside-dept` -> visible `Cross-subject`, tooltip/`aria-label`
     `Show teachers who teach a subject outside their subject area`
   - `show-unmapped-specialization` -> visible `No subject match`, tooltip/`aria-label`
     `Show only teachers whose subject is not in the catalog`
   Rationale to record in the file: A6 c6 replaced the shouted `CROSS-DEPT` / `UNMAPPED
   SPECIALIZATION` with plain sentences; at a 1078px row two 38- and 35-character sentences cannot
   sit beside four pickers, so the sentence is the `aria-label` and the Tooltip and the face is the
   shortest plain words that still say what the switch does. Sentence case, no `uppercase`, no
   `tracking-tight`. Do **not** put the tooltip inside the switch box — the Tooltip wraps the
   `SWITCH_CHROME` `div`, it does not replace it.
6. **The draft group keeps `ml-auto`** so `Save changes` stays hard right. It moves into a wrapper
   that also holds the two toggles, so the two toggles sit immediately left of the draft group and
   are not pushed off the row when a draft exists.
7. Update the file's own header comment. It currently narrates the "A6 c6 item 3 put the switches
   in a `More filters` popover" design at length, and that decision is now reversed by the
   operator. Replace it with the measured 1078px budget, the `auto` arithmetic, and the one-row
   claim. Do not leave a comment describing a control that no longer exists.
8. `showFilters` / `onToggleFilters` props: **leave them in the signature.** Not in scope, and
   callers still pass them.

### Tests for item 39 — the two live rows that now assert the opposite

Follow the file's own established convention, which is already written into
`a6-teaching-load-surface.test.tsx` and `a6-c6-calm-teaching-load.test.tsx`:
**mark the row `SUPERSEDED … RETAINED, NOT DELETED`, leave the old assertions visible in place, and
add the replacement test beside it.** `AGENTS.md` §16: corrections are additive, never subtractive.

- `a6-teaching-load-surface.test.tsx` `A6-39-1b` ("five controls + `More filters`, and both
  switches inside it") is the row that must become the replacement target. It asserts
  `primary.querySelectorAll('#show-outside-dept, #show-unmapped-specialization').length === 0` and
  `trigger.textContent === 'More filters (2 on)'`. Supersede it and add `A6-39-1c`.
- `a6-c6-calm-teaching-load.test.tsx` opens the `More filters` popover to read the switch labels.
  Re-point it at the row itself, with the same SUPERSEDED/retained treatment.
- `a5-p3-picker-guard.test.ts` (~line 247) uses `/teaching-load`'s `More filters` trigger as its
  worked example of the `auto` variant. Re-point the example at a control that still exists and
  keeps the retired trigger visible as history.
- Check `a3-teachers-load-c3.test.tsx` and `a6-tl-header-budget.test.ts` for the same ids; they
  pass the props, so most likely they only need no change. Run them and see.

`A6-39-1c` must assert, by RENDERING the real component and finding controls by rendered text/test
id, never by reading the `.tsx`:
- no element in `document.body` reads `More filters`, and no
  `[data-testid="teaching-load-more-filters"]` or `-panel` exists in any state;
- both `#show-outside-dept` and `#show-unmapped-specialization` are inside
  `[data-testid="teaching-load-primary-filters"]` — i.e. on the ONE row, with no second row
  (`[data-testid="teaching-load-secondary-filters"]` still absent);
- DOM order on that row is: search, Status, Department, Load, Sort, then the two switch ids, then
  the draft group;
- each switch's `<label for>` exists and reads the new short label, and the switch's `aria-label`
  reads the full sentence;
- the old shouted wording `Cross-Dept` / `Unmapped Specialization` appears nowhere;
- all four pickers resolve the SAME shared width variant (`auto`) — assert each trigger carries
  `w-auto` and `whitespace-nowrap` and NOT `w-52` / `w-44`, and that
  `pickerTriggerFaceFits('auto', …)` is `true` for every composed face including the worst case
  `Department: Mathematics`;
- the bar still adds NO scroll container and the `sr-only` announcement still renders.
- Add a **load-bearing mutant control**: with the two switches passed `true`, assert the row
  reports them as ON in whatever way the implementation states it. If the implementation gives each
  toggle no count/label affordance (a switch's own track already states on/off, and that is
  sufficient), say so in the test and instead pin that **no** narrowing happens silently — the
  `sr-only` `filterAnnouncement` string must mention the active inclusion view whenever either
  switch is on. Decide which, and write down which and why in the test's comment. The honest
  minimum: the live `sr-only` announcement is the state channel, so assert it.

`a6-c6-calm-teaching-load.test.tsx` has a committed row capping capitalised words on a switch label
at two. The new labels are sentence case, so it is satisfied; say so where you touch it.

## 2. Item 17.1 — the coverage count must open the subject's coverage window

Reproduced on real staging data by the planner, `/subjects`, subject `ESP/GMRC`:

```
cell [data-testid="subject-coverage-cell-5"] text: "18/20 covered2 sections still need a teacher."
  -> <div slot="badge" aria-label="ESP/GMRC has partial section coverage">18/20 covered</div>
  -> <button> … the AccessibleInfo info icon …
click that button  -> [data-testid="subject-coverage-dialog"] count 0   (opens NOTHING)
click the row's "Review teacher coverage for ESP/GMRC" -> count 1      (works)
```

So the cell's only affordance is a dead info icon. The fix, in
`atlas-client/src/components/subjects/SubjectRow.tsx`:

1. **The coverage count itself becomes the control that opens the window.** Wrap the existing
   coverage `Badge` in a real `<button type="button">` that calls `onShowCoverage(subject)`, which
   is already a prop and already opens `SubjectCoverageSheet` (a read-only dialog: assigned
   teachers and uncovered grades, no writes — confirm that by reading it, do not assume).
2. **Subtract the dead `AccessibleInfo` icon from this cell.** It is the thing that was clicked and
   did nothing, and it states the same fact the dialog states. Its sentence moves onto the new
   button's `aria-label` and into a `@/ui` `Tooltip`:
   - missing coverage -> `2 sections still need a teacher. Click to see which.`
   - full coverage -> `All required sections have a teacher assigned.`
   Keep the badge's own `aria-label` (`ESP/GMRC has partial section coverage`) on the badge element
   so the status is still announced; the button's accessible name is the fuller sentence.
3. **The button keeps the badge's status colour** — the amber/green/red band is a DepEd-free
   semantic status colour that already exists on this cell, and the whole point of the column is
   that colour. Do not restyle it into a `@/ui` button variant; make it a `button` element that
   *looks* like the existing badge (same classes), with `hover:underline` / `focus-visible:ring` so
   it is discoverably clickable. The defect was "looks like data, does nothing", not "looks like
   data".
4. `Review` in the action cell (`onShowCoverage`) is **unchanged** — it is the row's labelled
   action and a committed surface. Two affordances for one window is not a duplicate *status*;
   do not delete it.
5. `SubjectMobileCard.tsx` has the same coverage badge shape on the mobile list. Check whether it
   has the same dead affordance; if it does, give it the same treatment in the same change. If it
   does not, leave it and say so.
6. Also check `pages/Subjects.tsx`'s `SubjectCatalogBody` for any other dead control on this page
   and report it rather than fixing it — this packet is two items, not a sweep.

### Tests for item 17.1

Add a new rendered test (do not weaken an existing one) in
`atlas-client/src/components/subjects/__tests__/`, reachable from a committed `package.json`
script in the same commit. Mount the real `SubjectRow`, find the coverage control **by its
rendered text** (`18/20 covered`), click it, and assert `onShowCoverage` was called with that
subject — plus a negative control: the "no coverage"/"full coverage" badges are equally clickable,
so clicking `Full coverage` also calls it. Assert no `title` attribute and no raw `<details>` is
introduced (`AGENTS.md` §8), and that the explanatory sentence is on an `aria-label`/Tooltip rather
than a `title`.

## 3. Gates the executor runs before handing back

- `cd atlas-client && npx tsc --noEmit -p tsconfig.json` (or the repo's own typecheck script) — clean.
- The focused suites: `a6-teaching-load-surface`, `a6-c6-calm-teaching-load`, `a3-teachers-load-c3`,
  `a6-tl-header-budget`, `a5-p3-picker-guard`, and the subjects suites you touch
  (`subjects-ux-a3`, `a5-subjects-c1`, `a5-c3-subjects-calm-surface`,
  `a5-c4-subjects-filter-disclosure`). All green, no skipped, no `.skip` added.
- `npm run test:ux-guardrails` if it exists and covers these files.
- `git diff --cached --check` clean; no stray files; `git status --short` shows only the intended
  paths.
- **Every new or changed test file must be reachable from a committed `package.json` script in the
  same commit.** Name the script and the command you ran.

Two LOW fixes the planner has already made in this worktree, on the same branch, already in the
tree — do not revert them and do not re-do them:
- `scripts/dev/start-preview.ps1`: `VITE_ATLAS_API` now carries the `/api/v1` prefix
  (`atlas-client/src/lib/api.ts` uses it as the axios BASE URL, so without it every request 404'd).
- `atlas-client/vite.config.ts`: `server.fs.allow` now covers `E:/ATLAS-worktrees` and `D:/ATLAS`,
  because a lane worktree's `node_modules` is a junction to a donor worktree and Vite 403'd every
  `@fontsource` file — the page rendered in a fallback font, which makes any width measurement a lie.

## 4. What the executor does NOT do

- No deploy, no publish, no migration, no live/staging data write, no generation, no login, no
  browser. Browser proof with real staging data is the planner's, after integration.
- No change to `pages/TeachingLoad.tsx`, `hooks/useTeachingLoadUI.ts`, `faculty-assignment-helpers.ts`
  or any `.ts` filter logic. This is a presentation change; the filter semantics must be identical
  before and after.
- No new `@/ui` width variant. `auto` already exists and already has a declared contract.
- Do not touch `docs/plans/live-state.md`; the planner owns it.
