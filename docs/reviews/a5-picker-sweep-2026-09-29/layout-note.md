# A5 C3 slice B — layout note and subtraction ledger (the picker sweep)

**Cycle:** A5 C3 slice B, 2026-09-29. **Base:** `419277e4` (slice A shipped on `origin/main`).
**Packets:** `docs/prompts/a5-subjects-table-2026-09-29-r1.md` (R1) B1-B5, `-r2.md` (R2), `-r3.md` (R3).
**Written before any JSX**, per `AGENTS.md` §11 rule 2. It does **not** self-judge the design;
§11 rule 4's `REJECT_UX` gate is the planner's, against screenshots a reviewer who did not build
this takes.

---

## 0. The user this is for (§11 rule 1)

An **older, mouse-first scheduler**. On these five pages they came to **narrow a roster**: find
the teachers who need a load, the sections missing a room, the year to review. They arrived to
find that the same job — "narrow this list" — is a *different-shaped control* on every page:
a tall `h-10` rectangle on `/sections` and `/faculty`, a small shouted one on `/teaching-load`,
a tall form field in History, and a different one again in the grid. Some read only "All…", with
no name; some were SHOUTING at them in capitals.

What must feel different: **the same control, everywhere, that says what it is.** Not "five even
pickers" — that is a limit. The goal is a scheduler who stops noticing the controls and starts
reading the list.

## 1. The page being copied (§11 rule 5, R2-6)

**`/subjects`, as shipped in slice A at `419277e4`.** It is the one page in the product where
this job is already done: five filters, one shared primitive, one even width, one height shared
with the search box, each trigger naming itself (`Grade: All`), no search box on a short list.
Every conversion below is that page's control with **that page's own words** inside it.

The page's own vocabulary is what each conversion keeps. `All roster states` stays
`All roster states`; `With teaching load` stays `With teaching load`; `Grade taught` stays
`Grade taught`. What changes is the primitive, the chrome, and the self-naming — the words the
operator reads do not.

**Explicitly NOT copied:** `/timetable`'s header. The operator judged it *"regressed · messy"* on
2026-09-29 and R2-6 names it a counter-example, not a model. Nothing here copies its two-row
squeeze, its helper sentences or its chip stacking. Its **entity picker** is the reference for one
thing only — a compact trigger over a full option list (R3-1) — and that primitive is already
`@/ui/searchable-select`, which slice A reused rather than reinvented.

## 2. Regions — what stays, what goes, what moves behind something

### Region 1 — `/sections` grade / program / home-room filters
(`components/sections/SectionsFilterToolbar.tsx:29, 40, 52`)

- **STAYS:** all three filters, their `grid sm:grid-cols-3` layout, the `all` first option in
  each, the program-code legend line beneath them, and every option's own words.
- **GOES:** three Radix `@/ui/select` triggers at `h-10 text-sm` — a taller, larger-type control
  than every other filter in the product, and the reason the operator's roster looks like a
  different application.
- **MOVES BEHIND:** nothing. Each stays one click from the grid.
- **Also removed:** the `<details>`-free legacy was already clean; no change.

### Region 2 — `/faculty` roster filters (`pages/Faculty.tsx`)
- **STAYS:** all four filters, the `More filters` disclosure behaviour, the
  `data-testid="teachers-grade-filter"` handle, and every option word.
- **GOES:** four Radix triggers at `h-10 w-44 text-sm` / `h-10 w-36 text-sm` + a page-local
  `bg-background`. Extracted to `components/faculty/FacultyFilterRow.tsx` **in the same commit**
  (B3: the file is at the §8 cap).
- **MOVES BEHIND:** nothing new. The disclosure is untouched — it is a pre-existing, separate
  decision about how many filters are *always* visible, not about how a filter looks.

### Region 3 — `/teaching-load` primary filter bar
(`components/faculty-assignments/TeachingLoadFilterBar.tsx:151, 166, 184, 203`)
- **STAYS:** all seven controls in their fixed order, the two inclusion switches, the
  `data-testid="teaching-load-primary-filters"` cluster, the facet counts and disabled states,
  the draft controls, and the ~20 option labels.
- **GOES (B4):** the page-local `CONTROL_CHROME` string and the `font-bold uppercase
  tracking-tight` on four triggers **and** their option rows. This is the loudest surface in the
  product and it is a page-local look on a shared control — §8's exact defect.
- **MOVES BEHIND:** nothing. A4's FIX 39 removed the `More filters` disclosure here deliberately
  ("a filter an operator uses daily was two clicks away") and this slice does not undo that.
- **NOT IN SCOPE:** `pages/TeachingLoad.tsx` (A6's, 962 lines) and the optional-inclusion
  switches, which are switches, not pickers.

### Region 4 — `/teaching-load` grid-mode filter (`SectionGridMode.tsx:216`)
- **STAYS:** the filter, `activeFilterLabels` verbatim, the search box beside it.
- **GOES (B4):** `w-45 h-10 … uppercase tracking-tight` and the `ListFilter` icon inside the
  trigger — the icon is the one thing that made this control *look* different from the four
  beside it in Region 3, and the shared trigger has its own chevron.
- **MOVES BEHIND:** nothing.

### Region 5 — `/teaching-load` history year picker (`TeachingLoadHistoryView.tsx:165`)
- **STAYS:** the picker, the visible `<Label htmlFor="teaching-load-history-year">Archived school
  year</Label>`, the `id`, the `data-testid="teaching-load-history-year-picker"`, and the
  `— no annual Teaching Load` option suffix.
- **GOES:** `min-h-11`, which made one control in a form taller than every other field beside it.
- **MOVES BEHIND:** nothing. This one already named itself with a real `<Label>`; the
  self-naming rule adds a second, redundant name inside the trigger, and that redundancy is
  recorded as a cost below rather than hidden.

---

## 3. Subtraction ledger (§11 rule 3)

### 3.1 What leaves each region — the honest count

| Region | Controls | Words/case removed | Look overrides removed | Controls added | Words added |
|---|---|---|---|---|---|
| 1 `/sections` (3) | 3 → 3 | 0 | 1 (`h-10 text-sm`) | **0** | **0** (labels are the page's own) |
| 2 `/faculty` (4) | 4 → 4 | 0 | 1 (`h-10 … bg-background`) | **0** | **0** |
| 3 `/teaching-load` (4) | 4 → 4 | 0 | **~24** (`CONTROL_CHROME` ×4 + `uppercase tracking-tight` ×~20) | **0** | **0** |
| 4 grid mode (1) | 1 → 1 | 0 | **2** (`uppercase tracking-tight`, the `ListFilter` glyph) | **0** | **0** |
| 5 history (1) | 1 → 1 | 0 | 1 (`min-h-11`) | **0** | **0** |
| **Total** | **13 → 13** | **0** | **≈29** | **0** | **0** |

**Not one visible word is added anywhere in this slice, and no control is added.** The §11 rule-3
concern — "a change may not add visible words, chips, lines or controls to a region without
removing at least as much" — does not arise, because the ledger is zero on both sides of the
word/control columns. That is the point of R2's instruction to keep each page's own vocabulary:
the sweep is a *uniformity* change, not a copy change.

> **CORRECTION ROUND 1 — "0 words added" survives, but only because the one place it did NOT hold
> is now corrected.** The history-year picker's unset face read a hard-coded `All` and its
> `placeholder` could never render, so this slice *had* removed words an operator needs
> (`Choose an archived year`). With the `@/ui` fix — unset shows `All` when the list has an `all`
> member, the caller's `placeholder` when it does not — that control reads
> `Archived year: Choose an archived year` again, and the zero holds honestly. A ledger that
> counted zero while the trigger was lying about its own state was zero for the wrong reason.

### 3.1a The removed Load colours were not merely a look override — they were teaching the wrong cue

Recorded here because QA's finding is better than the reason I gave, and the ledger should carry
the better reason.

The first candidate justified dropping the three policy-band option colours
(`text-amber-700` / `text-emerald-700` / `text-sky-700`) on the grounds that carrying them would
mean a look prop on the shared primitive for one page, which is the defect this sweep exists to
remove. That is true and it was sufficient. It is not the strongest argument.

**The colours were also inconsistent with the product's own cue.** The removed mapping had
`at-standard → emerald` and `below-standard → sky`, while the product's own
`StackedWorkloadBar.tsx:50-55` maps those two the other way round. So a scheduler reading a
faculty row all day was being taught, by the filter dropdown, **the opposite** of the cue she
learns everywhere else — and the words in the option (`Excess`, `At standard`, `Below standard`)
carry the same fact without a legend to misread. Removing them was not only tidier; it was
removing a contradiction. Any future request to restore them should start from
`StackedWorkloadBar`, not from this file.

### 3.2 The one place words DO go, and why it is a net subtraction

Three of the thirteen triggers previously rendered a bare value with no name of its own:
`/faculty`'s `Grade taught` trigger (its value, not its name, is what you see) and
`/teaching-load`'s `Department` and `Load` triggers. Under R3-1 they become `Grade: All`,
`Department: All`, `Load: All`.

| | before | after | Δ per trigger |
|---|---|---|---|
| `/faculty` grade | `Grade taught` (the name) or `All grades` (the value) | `Grade: All` | **0 or +1** |
| `/teaching-load` department | `Department` / `All departments` | `Department: All` | **0** |
| `/teaching-load` load | `Load` / `All loads` | `Load: All` | **0** |
| `/teaching-load` status | `Status` / `All status` | `Status: All` | **0** |
| `/sections` home room | `All home-room states` | `Home room: All` | **0** |

The count is **0 for every trigger whose value already read `All …`** — the name is paid for by
collapsing the value to `All`, exactly as R3-1 does on `/subjects`. The single exception is
`/faculty`'s grade trigger when nothing is chosen, which gains one word (`Grade: All` in place of
`Grade taught` is +1 at the widest reading, and −1 against the value it used to show). **Ten of
thirteen triggers are word-neutral and the remaining three move by at most one word**, against
~29 look overrides removed and the single most shouted filter surface in the product brought
down to sentence case.

### 3.3 What this buys the scheduler, stated as an outcome not a count

- `/sections`, `/faculty`, `/teaching-load` and `/timetable` are now **one control**. An older
  user who learned `Grade: All` on `/subjects` meets the same rectangle everywhere, at one
  height, with one click to open.
- **Case is uniform.** Sentence case everywhere; a scheduler no longer has to read four filters
  shouted at her and two whispered.
- **One fewer target on every short list.** R2-5: `Grade` (5 options), `Roster state` (4),
  `Load` (5) and `Archived year` open straight onto their options with no search box to aim at.
- **One width across the sweep**, so a filter row's shape is predictable before you read it.

## 4. What I am deliberately **not** doing

- **Not re-opening the `More filters` disclosure** on `/faculty` or `/teaching-load`. How many
  filters are always visible is a separate decision from how a filter looks; A4 removed
  `/teaching-load`'s deliberately and the operator screenshotted the result approvingly.
- **Not touching** `pages/Sections.tsx`, `pages/TeachingLoad.tsx`, any
  `components/sections/*Map*` (A3's), the `/timetable` `SearchableSelect` call site, or
  `SubjectFormModal.tsx`. Named out of scope.
- **Not renaming one option label.** `All home-room states` becomes the trigger's *value* `All`
 ; the option list still says `All home-room states` in full.
- **Not creating a second picker variant.** The sweep reuses `FilterPicker` and
  `@/ui/picker-trigger` as shipped. If a page needed a different look, the variant would go in
  `@/ui` so every page gets it (§8) — none needed one, so none was added.
- **Not adding a `More` menu, a Tooltip, or a detail affordance anywhere.** Nothing in this slice
  is hidden, so there is nothing to hide it behind.

## 5. Failure modes I can name before they happen

1. **The `uppercase` removal is visible.** `/teaching-load`'s filter labels stop shouting. That
   is the intended change and it is a real before/after for the reviewer to judge — it is not a
   no-op cosmetic.
2. **Option rows lose `uppercase` too.** They were part of the same page-local class. The
   *labels* are unchanged; only their case changes.
3. **`SectionGridMode` loses its `ListFilter` icon.** One fewer glyph inside the trigger, so it
   matches the three beside it. The shared trigger carries its own chevron.
4. **The history picker's trigger now names itself as well as its `<Label>`.** Redundant, and
   recorded in §3.2 rather than hidden: a filter that names itself on one surface and not
   another is the defect this whole cycle exists to remove.
5. **TRUNCATION IS THE AXIS MOST LIKELY TO FAIL, and this note should not assume it fits.**
   The shared trigger is a fixed **128px** box, and this sweep made the visible faces **longer**
   than several of the columns they replaced: `/sections`' Home-room filter used to own a
   ~340px grid column reading `All home-room states` and now reads `Home room: All` in 128px;
   `/teaching-load`'s `All status` in 160px becomes `Status: All` in 128px. And
   `searchable-select.tsx:260` puts `truncate` on the label span, so an over-long face is
   ellipsised rather than wrapped or pushed.
   By hand the longest swept face is `Home room: All` at ~66px of text inside ~86px of content
   box (128 less border, `px-3`, and the chevron), so it should fit — **but that is arithmetic, not
   a measurement, and font metrics are exactly the kind of thing a class list cannot decide.**
   No browser row exists for `/sections`, `/faculty` or `/teaching-load`; the reviewer scored
   *no truncation*, *nothing cramped* and *case/weight harmony* UNSCOREABLE without a 1366
   render, and D1 (losing UPPERCASE) is by definition a pixel judgement. **The planner runs
   that gate; I have not assumed it passes, and this paragraph exists so the reviewer knows the
   axis I would fail first.**
5. **R2-5's search box must not appear on any swept list.** The longest is `/faculty`'s
   department list, which is data-derived and can exceed 8. Where it does, the box appears and
   that is the rule working, not a regression. The B5 guard asserts no swept *short* list
   suppresses the box by accident and no long one loses it.

## 6. Decisions flagged for the planner / Lane C (not self-judged)

| # | Decision | Reason | Ask |
|---|---|---|---|
| D1 | `/teaching-load` filter labels drop from UPPERCASE to sentence case | R1 B4 removes the page-local look override; §8 forbids a local look on a shared surface | Judge it in the before/after: this is the single biggest visual delta in the slice |
| D2 | `/faculty`'s grade trigger shows `Grade: All` (R3-1) in place of `Grade taught` / `All grades` | R3-1 settled; one word, net-neutral against the value it replaced | Accept, or rule that `/faculty` keeps `Grade taught` as its value wording |
| D3 | `SectionGridMode`'s `ListFilter` glyph is dropped | It is the marker of the mismatch; the shared trigger has a chevron | Accept the lost glyph |
| D4 | The history picker is named twice (visible `<Label>` + self-naming trigger) | Consistency beat terseness; a filter that names itself on one surface and not another is the defect | Accept the redundancy |
