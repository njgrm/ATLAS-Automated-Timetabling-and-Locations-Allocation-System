# A6 c6 — Calm Teaching Load: jargon, one main button, a sort that fits, a plain next step, and 20 cards that are not dense

**Stream owner:** Lane A6. **Worktree:** `E:/ATLAS-worktrees/lane-a6-c6-calm-tl` (provisioned, registered).
**Branch:** `work/a6-c6-calm-teaching-load`. **Base:** `a1f0c727e52b5af12f015ae64fdafcf8853a83dc` (`origin/main`).
**Client only.** Every changed path is under `atlas-client/`. Zero `atlas-server/`, `prisma/`, `ops/`, lockfile, `.env`, migration or seed paths.
**Risk tier: MEDIUM** (user-facing production wiring + copy). No HIGH action is authorised by this packet. No deployment, no generation, no publication, no migration, no live-data write, no runtime/task/env change. **A4 owns the deploy; A6 does not deploy.**

**Source of the work:** Lane C, 2026-09-29 06:58 +08, `docs/handoffs/lane-c-to-a2.md` line 1429-1434 (A6 bullet), from the Codex staging walk of train 6 —
`docs/reviews/codex-staging-train6-24e268fb/run2-report.md` (A1 FAIL, "Older-user concerns" MAJOR lines 20 and 22).
**Grade against those words.** A narrower rewrite of any item below is not this item.

---

## 0. The design judgement gate, applied BEFORE any JSX (AGENTS.md §11)

**The user:** an older, mouse-first scheduler. They are not a power user; they use the mouse, they read, and they are under time pressure.

**The task on this screen:** a teacher is short. They must (a) see who is short and how loaded everyone else is, (b) press the one thing that moves it, and (c) not be misled while the roster is unconfirmed.

**What must feel different:** calmer, with one obvious next step. Every line either names what is unavailable or names a fact the scheduler acts on. Nothing shouts a code. Nothing is cut off mid-word.

**A limit is not the goal.** "Header ≤ 2 rows" or "seven controls on one row" is a constraint this change may cross. Meeting it by cramming is the failure.

### 0.1 The layout note — what stays, what goes, what moves behind

| | |
|---|---|
| **STAYS, visible** | Search; the `Status`, `Department`, `Load`, `Sort` pickers; the page's draft controls (`draftControls`); the `Active filters:` chip row; the two header status chips (see 0.2); `Help`; the one primary action; `More`; the `Next step` repair chip. |
| **GOES, off the visible surface** | Header row 1: the `Load summary` button → into the `More` menu. Filter row: the two inclusion switches → into one quiet `More filters` popover on the same row. Teacher row: the **per-teacher department line** (it restates the group heading the row is already under) and the **`Subjects` count block**. Two dead nodes (an empty `aria-hidden` `<div>`; the `'Unmapped'` fallback string that only that deleted line used). |
| **MOVES BEHIND** | The technical cause of a degraded source → a `@/ui` `Tooltip` on the plain line **and** a new step in the page's `Help`. Each teacher row's secondary `Edit assignments` stays on the row (see 0.3). Nothing else moves. |
| **NEW** | A `lg` picker width variant + a declared per-width character budget in `@/ui/picker-trigger.ts`. A `More filters` trigger whose label states how many inclusion switches are on. |
| **NOT CHANGED** | `data-testid` `teaching-load-draft-chip`, `teaching-load-row-review`, `teaching-load-edit-assignments`, `teaching-load-summary-open`, `teaching-load-repair-*`, `teaching-load-degraded-notice`, `show-outside-dept`, `show-unmapped-specialization`, the 240px search box, every filter's `ariaLabel`, every option's full label, `TEACHING_LOAD_HEADER_MODEL`, the no-scroll architecture. |

### 0.2 The subtraction ledger (a change may not add words/chips/controls without removing at least as much)

| Added | Removed | Net |
|---|---|---|
| `More filters` trigger (+1 control, 123px) | 2 always-on inclusion switches (≈555px) | **−432px, −1 control** |
| `More` menu row for `Load summary` | `Load summary` button on header row 1 | **−1 header control** |
| 2 `Tooltip`s + 1 `Help` step (hover/behind only) | 0 visible words — the plain line replaced the technical one | 0 |
| `shortLabels` on 3 pickers | 3 clipped trigger faces | 0 |
| 0 | per-row department line, `Subjects` block, dead `<div>` — **×20 rows** | **−60 visible regions** |

Header row 1 after this change: title · `Teachers | Sections` · source chip · draft chip · `Help` · **one** primary action · `More`. That is one primary action, which is what Lane C asked for. The two chips stay because they are **two different claims** ("is this data current?" / "is my work saved?"), which `a6-tl-header-budget` `A6c4-G2-5` already adjudicated and which §8's prohibition ("never two chips that say the same thing") does not touch. Do not merge them; do not add a third.

### 0.3 The judgement on what an older scheduler needs first, and why two buttons stay

Lane C: *"20 teacher cards grouped by subject feel dense."* Per row, this change leaves the scheduler with:

1. **who** — name (+ class-adviser star, + a `Draft` dot when that teacher has unsaved work),
2. **how loaded** — hours per week and the percent of the teaching standard,
3. **how much demand** — sections,
4. **`Review load`** — the one action taken most,
5. **`Edit assignments`** — the only explicit edit entry.

**Why `Edit assignments` stays on the row** even though 20 rows × 2 buttons is the most visible density: A6 C2 (independently reviewed) made it *the only thing that mounts the inline assignment editor*, and `a3-teaching-load-review-c2` `C2-5` plus `a6-teaching-load-surface` `A6-C2-5` both assert it is present, labelled as an edit, and is what opens the editor. Moving it behind a per-row menu would make the rarest action cost two clicks and would supersede two accepted, reviewed rows to fix a complaint those rows did not cause. The density was the **department line, the `Subjects` count and the dead node** — three regions carrying no decision for a scheduler — and those are what go. **Record this judgement in the code comment; do not leave it implicit.**

---

## 1. The six items, with Lane C's exact words

### 1.1 Jargon → plain sentences (Lane C item 1, verbatim)

| Old | New (use these words exactly) |
|---|---|
| `Cross-Dept` | **`Show teachers outside their subject area`** |
| `Unmapped Specialization` | **`Show teachers with no matched subject`** |

Both are currently shouted by a page-local `uppercase tracking-tight` on the `<Label>`. That override is **removed** — the labels become sentence case, `font-semibold text-muted-foreground`, keeping `whitespace-nowrap` and the shared switch chrome so the controls still read as one instrument (`a6-tl-header-budget` `A6c4-G2-6` caps that allowance at the two switch labels; zero is better and still passes).

**Sweep the page for any other all-caps code.** Grep the four Teaching Load files for an all-caps token that is a *code* (`[A-Z][A-Z_]{2,}`) and remove or plain-name it. Known hits:

- `TeacherGridMode.tsx:624` — the editor section heading `Cross-Department` → **`Outside their subject area`**.
- `TeachingLoadFilterBar.tsx:13,243,248,264` — the comments naming `cross-dept` / `unmapped-specialization` as the control names. Update the comments to the new labels; the `id` attributes `show-outside-dept` and `show-unmapped-specialization` **stay** (they are stable DOM hooks asserted by tests, not visible text).

A label in ALL CAPS that is an ordinary English word (a `Draft` badge, a group heading, a stat unit) is **not** a code and is not item 1. Do not go hunting for a repaint; the only casing this slice changes is the two switch labels and the `Cross-Department` heading.

### 1.2 One clear main button in the header (Lane C item 2)

`WorkspaceToolbar.tsx` row 1 `actions` currently renders, in order: `Help`, `loadSummaryAction` (`Load summary`), the primary action, and the `More` icon trigger. Codex: *"several competing top controls (`Load summary`, `Retry source`, `More Teaching Load tools`), not one clear main button."*

**Change:** `loadSummaryAction` moves from row 1 into the existing `More` `DropdownMenuContent`, as the **first** item, above the `Archived load` link and the `Staffing mode` group. `Help` and the primary action and `More` do not move.

- The `loadSummaryAction` **slot contract is unchanged**: the PAGE still builds `TeachingLoadSummarySurface` and still hands it to the toolbar; only the position moves. The dialog, the panel, the `truthModel` authority, `TEACHING_LOAD_HEADER_MODEL` and `ROW_1_COMMAND_PX` are untouched.
- `TeachingLoadSummarySurface` must be able to render as a `DropdownMenuItem` (an `onSelect` that opens the dialog), keeping `data-testid="teaching-load-summary-open"`. **Do not** put a `<button>` inside a `DropdownMenuItem`; the item IS the control and it must keep its testid and its accessible name `Load summary`.
- The `More` menu's `aria-label` stays `More Teaching Load tools`.

> **PLANNER RULING (2026-09-29).** The executor found a real defect here and the fix is accepted: rendering the surface **inside** `DropdownMenuContent` makes Radix unmount the dialog in the same commit that opens it, so the dialog never appears. The `open` flag is therefore owned by the **toolbar**; the `More` menu renders a sibling menu item that flips it, and the surface (with its dialog) renders **outside** the strip. One owner for the flag, one dialog, and the item stays a real menu item. Do not "fix" this by putting a `<button>` back on row 1.

### 1.3 The sort trigger is cut off at 1366 (Lane C item 3, verbatim: *"use `Sort: Load` or widen it"*)

`FilterPicker`'s trigger is `w-32` (128px) with `px-3` (24px) and a 20px chevron, leaving **84px** of text. At the `TEXT_XS_ADVANCE_PX = 6.6` that `a6-tl-header-budget` `A6c4-G2-7` already declares and reuses, that is **12 characters**. `Sort: Lowest load` is 17. It is clipped — and so is `Department: All` (15) and `Status: No teaching load (3)` (27). This is a **class of defect**, not one instance, so fix it in the primitive.

1. **`@/ui/picker-trigger.ts`**: add an `xl` variant to `PICKER_TRIGGER_WIDTH_CLASS` = `'w-52'`, and add a declared **face budget**:

   ```ts
   export const PICKER_TRIGGER_TEXT_ADVANCE_PX = 6.6;   // same declared method as a6-tl-header-budget A6c4-G2-7
   export const PICKER_TRIGGER_FACE_BUDGET_CHARS = { sm: 10, md: 12, lg: 20, xl: 24 } as const;
   export function pickerTriggerFaceFits(width: PickerTriggerWidth, name: string, value: string): boolean
   ```

   The budget for a width is `floor((widthPx - 2 * 12 - 20) / 6.6)`. **Derive it in code from `PICKER_TRIGGER_WIDTH_CLASS`, never write the numbers by hand**, so it cannot drift from the width token; publish the derivation in the comment. §8: a variant belongs in `@/ui` so every page gets it.

   > **PLANNER RULING (2026-09-29, applies over §1.3 as first written).** §1.3 originally published `sm: 12`. The executor showed the packet was internally inconsistent: `sm` is `w-28`, and the packet's own formula on its own token gives **10**. A budget LARGER than the physical maximum is the false pass the row exists to catch, so the derived value governs: **`sm: 10`**. `md: 12` and `lg: 20` match the formula exactly and stand.
   >
   > The ruling also **adds `xl`** and moves the facet count off the trigger for all four pickers. The trigger is a fixed rectangle; a count is the one part of an option that the popover, which has room, can carry for free — and that is `FilterPicker`'s own documented `shortLabels` contract, not a new mechanism. A data-driven name is arbitrary in length, so `Department: Mathematics (2)` (27) can never be made to fit by rewording; the fix is a wider variant plus the count in the popover, and the count was never the thing an older scheduler reads off a filter face. Nothing is lost: the full label **with** the count is still the popover's option text, and the active department is still named in the `Active filters:` chip row below.

2. **`TeachingLoadFilterBar`**: all four pickers take `width="xl"` — one size for the whole row, because §8 "One look per control" is about a row not mixing a control's looks — and each gets `shortLabels` so no composed face exceeds the budget. The popover keeps the **full** option labels **and** every count; the accessible name keeps the full form (that is `FilterPicker`'s existing `shortLabels` contract — use it, do not invent a mechanism):

   | picker | value | trigger short label | composed face | chars | budget |
   |---|---|---|---|---|---|
   | `Status` | `all` | (unset → `All`) | `Status: All` | 11 | 24 |
   | `Status` | `teaching-assigned` | `Teaching` | `Status: Teaching` | 16 | 24 |
   | `Status` | `no-teaching` | `No load` | `Status: No load` | 14 | 24 |
   | `Status` | `adviser-only` | `Adviser` | `Status: Adviser` | 16 | 24 |
   | `Load` | `all` | (unset → `All`) | `Load: All` | 9 | 24 |
   | `Load` | `excess` / `at-standard` / `below-standard` | `Excess` / `At standard` / `Below standard` | `Load: Below standard` | 21 | 24 |
   | `Sort` | `load-desc` | `Load, high` | `Sort: Load, high` | 15 | 24 |
   | `Sort` | `load-asc` | `Load, low` | `Sort: Load, low` | 14 | 24 |
   | `Department` | any | the department name **without** the count | `Department: Mathematics` | 23 | 24 |

   Row arithmetic at 1366 (available ≈ 1326px), recorded so the wrap stays a fallback: 240 search + 4 × 208 (`w-52`) + 4 × 8 gaps + 8 gap + 123 (`More filters`) = **1235px**, 91px of slack, one line.

   `Sort`'s **option labels** in the popover stay `Highest load` / `Lowest load` — the direction must stay unambiguous where there is room for it, and `Sort: Load, high` keeps the direction on the trigger too. `Load`'s popover labels keep their counts.

3. A committed control asserts **every** composed face in the worst state fits its budget, and a **mutant row** proves it discriminates (widen one face by one character → red).

### 1.4 The withheld figure leads with a plain next step (Lane C item 4, verbatim)

Today the repair chip's status reads `Unverified — EnrollPro is not reachable, so this figure is withheld.` — 68 characters, a product name, and the word "withheld", which a scheduler cannot act on.

`teachingLoadUnverifiedStatus` is the one function that writes it. **Change its four strings, in that function only**, to plain sentences that say what is unavailable, with no product name on the calm face:

| state | new status |
|---|---|
| `!isOnline` | `ATLAS is offline, so these numbers cannot be checked.` |
| `refreshing` | `ATLAS is checking the live roster now, so these numbers are not confirmed yet.` |
| `none` | `No live Teaching Load source is available, so these numbers cannot be checked.` |
| `cached` (the one Codex saw) | `These numbers come from the last saved roster, not the current one.` |

`teachingLoadUnverifiedReason` **keeps** its four strings unchanged — it is the technical clause and it now feeds the `Tooltip` and the `Help` step, which is where it belongs.

### 1.5 The saved-data line leads with a plain next step, and the source detail goes behind Help (Lane C item 5, verbatim)

Today: `Using the last saved data — EnrollPro not reachable` (or `Using saved data from <time> — …`). Codex: *"gives no clear next step or person to call; say what is unavailable and offer one safe retry."*

1. `degradedLine` becomes the plain lead, per state, with no product name and no timestamp on the visible face:

   | state | new pill text |
   |---|---|
   | `!isOnline` | `You are offline, so ATLAS is showing the last saved roster.` |
   | `refreshing` | `ATLAS is checking the live roster now.` |
   | `none` | `There is no live roster to load, so ATLAS is showing the last saved one.` |
   | `cached` | `ATLAS is showing the last saved roster, not the current one.` |

2. The pill becomes a `@/ui` `Tooltip` trigger (never a raw `title`, §8). The tooltip is the technical detail and keeps every fact the old sentence carried: `teachingLoadUnverifiedReason(state)`, the `dataSource` value, and `Saved <savedAtLabel>` **only when** `savedAtLabel` is non-null (never a synthesised clock — the `savedAtLabel` prop doc already forbids that; keep that rule).

3. **The one Retry already exists**: `primaryAction` is `Retry source` whenever `!isOnline || dataSource === 'none'`, and it is enabled only when `isOnline`. It is the plain next step the finding asks for. A committed control asserts **both branches honestly, and does not pretend a retry can work while ATLAS is down**:
   - ATLAS **online**, source merely unconfirmed (`cached` or `none`): the pill is present, and **exactly one** enabled control in the header is a retry, with an accessible name containing `Retry`.
   - ATLAS **offline**: the pill says ATLAS is showing the last saved roster, the retry control is present and **disabled**, and a stated reason is available to a scheduler who cannot use it (the existing `primaryAction.helper` Tooltip is the right home; do not add a second one).

4. `Help` gains **one** step — the detail Lane C asked to be behind Help — reading, for the current state: what ATLAS was trying to reach, what it got, and that waiting will not help when ATLAS is offline. Use `teachingLoadUnverifiedReason` as the source of the cause so the sentence can never disagree with the tooltip. `SmartHelpTrigger`'s `className` string is pinned by `a3-title-strip-c3` and **must not change**.

### 1.6 The 20 teacher cards are not dense (Lane C item 6)

Per `TeacherGridMode.tsx`, per rendered teacher row:

- **Delete** the second line: `<p className="text-xs font-bold … uppercase tracking-widest …">{member.departmentLabel || member.department || 'Unmapped'}</p>`. It restates the collapsible group heading the row is already inside. (This also removes the last place the raw word `Unmapped` was printed.)
- **Delete** the `Subjects` count block. `Sections` stays: it is the demand figure a shortage decision is made on. The subject list is one click away in the `Review load` profile, which already renders the assignment editor's data.
- **Delete** the empty `<div className="flex items-center gap-2 shrink-0" aria-hidden="true" />`.
- **Keep** the name, the adviser star, the per-teacher `Draft` badge, `Review load`, `Edit assignments`, hours/% and `Sections`. See 0.3 for why both buttons stay.
- **Keep** the group heading, the collapse, and its count badge. Sentence case only — `text-xs font-semibold uppercase tracking-widest` → `text-xs font-semibold`, and the group heading stays `select-none` and keyboard-operable. A5 C3 slice B already removed caps from the pickers for this reason; a group heading is the same control family.

---

## 2. Failing-first, then implement (AGENTS.md §11)

**Order: write the rows, run them against the UNCHANGED base, record that they fail for the right reason, then implement.**

Add one new committed gate file and one new `package.json` script, in the same commit as the change (a test no gate runs is not evidence):

- `atlas-client/src/components/faculty-assignments/__tests__/a6-c6-calm-teaching-load.test.tsx`
- script: `"test:a6-c6-calm-tl": "tsx --test src/components/faculty-assignments/__tests__/a6-c6-calm-teaching-load.test.tsx"`

Required rows, each naming the item it decides:

| Row | Decides |
|---|---|
| `A6C6-1` | The two inclusion switches carry Lane C's **exact** two sentences, and no visible text on the page carries an all-caps code. Fail on base: the base says `Cross-Dept` / `Unmapped Specialization`. Include the mutant: restoring either old string → red. |
| `A6C6-2` | The editor's cross-department heading reads `Outside their subject area`, not `Cross-Department`. |
| `A6C6-3` | Every composed picker face in the **worst** state (a long department name, every load band, both sorts, every status band) fits its declared `@/ui` budget **derived from the width token**, and `Sort: Lowest load` specifically is never a composed face. MUTANT ROW: one character longer → red. |
| `A6C6-4` | The header renders exactly **one** primary action outside `More`; `Load summary` is reachable from `More`, still carries `data-testid="teaching-load-summary-open"`, and clicking it opens the same dialog with the same breakdown. MUTANT ROW: put `Load summary` back on row 1 → red; put the dialog back inside the menu content → red. |
| `A6C6-5` | The four `teachingLoadUnverifiedStatus` strings are the plain sentences in 1.4, none contains a product name, and none contains `withheld` or `Unverified`. MUTANT ROW: the base strings → red. |
| `A6C6-6` | The degraded pill is the plain lead from 1.5, carries a `Tooltip` whose content keeps the technical cause, the source state and (only when real) the saved time; and the retry contract of 1.5.3 holds **in both branches** (online: exactly one enabled retry; offline: the retry is present, disabled, and says why). MUTANT ROW: the base sentence → red. |
| `A6C6-7` | The teacher row has **no** department line, **no** `Subjects` block and **no** empty `aria-hidden` node, and still carries name, `Review load`, `Edit assignments`, hours and `Sections`. MUTANT ROW: put any of the three back → red. |
| `A6C6-8` | The always-visible filter row is search + `Status` + `Department` + `Load` + `Sort` + `More filters`, still one wrapping flex row; both switches are reachable from `More filters`, which states how many are on; the 240px search box is unchanged. |
| `A6C6-9` | Preservation: `Help` still renders with its pinned class string; the two header status chips still resolve; `TEACHING_LOAD_HEADER_MODEL` is unchanged; every `data-testid` in 0.1 still resolves; the row adds no scroll container. |

**Record the failing-first evidence literally**: the exact command, the tally at the base, and the failing assertion text for each row. "It failed" is not evidence; the failing row name and its message are.

**Two harness facts this slice established, recorded so a reviewer does not read them as weakened assertions:**

1. **Never assert on a live DOM node.** node's reporter `util.inspect`s a failing `actual`, which walks a JSDOM document and hangs the run (observed: a 20 s hang that had to be killed). No row may do `assert.equal(<node>, null)`; assert on a serialisable value (`textContent`, `getAttribute`, an array of strings) instead.
2. **A row that opens a Radix menu or dialog must dispose its own mount.** An open modal plus the next row's dropdown deadlocks JSDOM. Rows that interact now `dispose()`; do not remove that.

`A6C6-9` is a **PRESERVATION** row. It is not claimed as failing-first and must not be made to fail at the base.

## 3. Additive supersession only (AGENTS.md §16)

Corrections are **additive**. Never delete an assertion, a control or an evidence row to close a finding — mark it superseded **in place, with a comment saying what replaced it and why**, and add the replacement beside it.

Rows that WILL conflict, and what replaces each:

| Conflicting row | File | Replacement |
|---|---|---|
| `F14-1` "ALL SEVEN controls sit on the one always-visible row" (it asserts the two switches are on the primary row and that **no** `More filters` button exists) | `a3-teachers-load-c3.test.tsx` | Mark superseded. New row: the primary row is the five named controls + `More filters`; both switches are inside `More filters`; the trigger states the count; the search box is still `w-[240px]` and still not `flex-1`; the row is still `flex flex-wrap items-center`. Keep the ORDER assertion for the five controls that remain. **Preserve the existing row in the file with a SUPERSEDED comment — do not delete it.** |
| `A6-38-1` (asserts the header renders a `Load summary` button, AFTER `Help`, BEFORE the primary action) | `a6-teaching-load-surface.test.tsx` | Mark superseded for the *position* half only. New row opens the `More` menu, finds the item, clicks it, and asserts the SAME dialog with the SAME breakdown renders. Keep the label/aria/testid assertions. |
| `A6c4-G2-4` (d) "`Load summary` must still resolve from the header" via a closed-menu static query | `a6-tl-header-budget.test.ts` | Mark superseded. New row opens `More` and resolves `teaching-load-summary-open` from inside it. |
| The switch-label assertions: `/Unmapped Specialization/`, `label[for="show-outside-dept"] must be labelled`, the primary-row containment, and `F14-0`'s `!closed.includes('Unmapped Specialization')` | `a6-teaching-load-surface.test.tsx`, `a3-teachers-load-c3.test.tsx` | Mark superseded with the new sentences named. Note explicitly that the *ids* `show-outside-dept` / `show-unmapped-specialization` are unchanged, so the label→id wiring is still asserted. |
| The `teachingLoadUnverifiedStatus` string assertions (`A6-C3-3-N1` and neighbours, ~lines 1602/1613/1616/2403/2441/2449/2470/2504 of `a6-teaching-load-surface.test.tsx`, and the `BLOCKED_ITEM` fixture at ~125 of `a6-tl-header-budget.test.ts`) | both | Mark superseded; the replacement asserts the four new sentences, that the four states are **distinguishable from each other**, and that no two states produce the same string. |
| `A6c4-G2-6`'s "only the two documented inclusion-switch labels may shout in caps" | `a6-tl-header-budget.test.ts` | **Keep the row unchanged.** Zero shouting labels still satisfies `<= 2`. Do not touch it. |

**One defect in my own file, fixed here because I am editing that exact line** (recorded, not hidden):
`test:a3-title-strip-c3` is **red at the base** (13 pass / 2 fail) with
`WorkspaceToolbar.tsx must not carry a local copy of the strip row`, because row 2's band carries a page-local re-declaration of the strip's row classes (`flex min-w-0 flex-wrap items-center`). The shared row classes belong in `@/ui` next to the other strip tokens; take them from there and the negative check passes on a real fix instead of on a weakened assertion. The **other** base failure in that file — `AdminWorkspace.tsx has 21 <div> elements but 20 are pinned` — belongs to A5/A7. **Do not touch it, do not weaken it, and do not count it as yours.**

## 4. Gates to run, and the baseline you are judged against

Baseline measured on `a1f0c727` in this worktree before any edit (recorded by the planner, not quoted from a handoff):

| gate | base |
|---|---|
| `test:a6-teaching-load` | 29 / 0 |
| `test:a6-tl-header-budget` | 9 / 0 |
| `test:a3-teachers-load` | 43 / 0 |
| `test:a3-c10-tl-density` | 9 / 0 |
| `test:a3-title-strip-c3` | **13 / 2** (both pre-existing; see §3) |
| `test:a6-c5-outage` | 23 / 0 |
| `test:a3-c10-workload-audit` | 12 / 0 |
| `test:tl-no-demand-hotfix` | 5 / 0 |
| `test:a3-truthful-numbers` | **19 / 1** (pre-existing, `room-picker-rows`: "the placeholder case must state itself visibly" — A3's lane) |
| `test:a5-p3-picker-guard` | 7 / 0 |
| `test:a5-c3-subjects-calm-surface` | 23 / 0 |
| `test:a3-c4-tl-truth` | 14 / 0 |
| `npm run typecheck` | **5 errors, all pre-existing** — 3× `Cannot find module 'playwright'` in timetable tests, 1 `TS7006` implicit-any in `timetable-scheduling-quality-c03.test.tsx`, 1 `TS2367` in `timetable-truth-labels-a2.test.ts` |

**Required:** every gate above at **base-or-better**, with the named pre-existing failures unchanged in count and in failing-row name, plus the new `test:a6-c6-calm-tl` green, plus `npm run typecheck` with **zero new** errors. `test:a5-p3-picker-guard` and `test:a5-c3-subjects-calm-surface` are in the list because §1.3 edits `@/ui/picker-trigger.ts`, which they police repo-wide.

**Rendered evidence is required and is not optional (AGENTS.md §11 "Done means seen").** A source assertion is not acceptance evidence for a user-facing change. Capture `/teaching-load` at **1366×768** with mocked `/api/v1` routes, before and after, in the degraded (`cached`) state and the healthy (`live`) state, and record: the filter row's `scrollWidth <= clientWidth` and each trigger's `scrollWidth <= clientWidth`; the header's control count; the first teacher row's height. Use `scripts/dev/start-preview.ps1 -ClientDir <dir> -Port <p>` with `VITE_ATLAS_API=http://127.0.0.1:5101` (staging — **never** the default `127.0.0.1:5001`, which is LIVE, AGENTS.md §5) and the Playwright MCP. Label the capture `ISOLATED_LOCAL_BROWSER`; it is not ATLAS acceptance. If the staging API is not answering, say so and record the row `BLOCKED(staging-unreachable)` with the command and its output — do not substitute a guess, and do not point the preview at live.

## 5. Hard boundaries

- **Client only.** Any `atlas-server/`, `prisma/`, `ops/`, lockfile, `.env` or migration path appearing in your diff: stop and report it.
- **No `Get-Content | Set-Content` round-trip on any repository file** (AGENTS.md §2). Use the Edit tool.
- No `npm ci`/`npm install` in a worktree whose `node_modules` is a **junction** — `npm ci` would delete the target's contents. This worktree already has its own `node_modules` from `npm ci` (278 packages); leave it alone.
- Do not start a server in a foreground tool call. `scripts/dev/start-preview.ps1` for previews; `scripts/dev/start-detached.ps1` for anything else.
- Do not touch `docs/plans/live-state.md`, `docs/handoffs/lane-c-to-a2.md`, or any other lane's files. The planner owns the continuity documents.
- AGENTS.md §8 1000-physical-line cap: `WorkspaceToolbar.tsx` is at 888 and `TeacherGridMode.tsx` at 672. Extract before you add if either crosses 1000.
- One commit, conventional message, only your assigned paths, `git diff --cached --check` clean before committing. **Additive corrections are a new commit; never amend.**

## 6. Handoff to return (one page, no transcripts)

- Base SHA · candidate SHA · exact changed paths.
- The layout note from §0.1 **as implemented**, with any deviation from it named and why.
- The failing-first evidence: literal command, per-row failing assertion text at the base, and the command that turned it green.
- The gate table from §4 as **measured**, with the pre-existing failures named.
- The rendered capture: what was measured at 1366×768 before and after, in both states, with the numbers.
- Known risks, each marked `BLOCKING` or `NON_BLOCKING`.
- Verdict. Worktree disposition: `KEEP_ACTIVE` (the planner retires it after integration).

## Addendum 11:00 — Codex train 7 walk (docs/reviews/codex-staging-train7-e9ddda71/report.md), binding for QA
A6 c5 shipped in `e9ddda71`, but on staging (S.Y. 2022-2023) the page showed only the generic
"25 classes still need a real teacher." — no per-subject shortage line and no "Cover these classes" control.
Find out why c5's surface did not render there (data state? a gate that hides it?) and make it show whenever
classes lack a teacher. Also: "SET OWNER" / "CHANGE OWNER" -> "Assign teacher" / "Change teacher"; after an assign,
show an obvious "Undo" beside the confirmation; replace "Next step Last saved data — Assign teachers to open classes
Unverified" with one plain line.
