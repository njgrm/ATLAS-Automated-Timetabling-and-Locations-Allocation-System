# A5 C3 — layout note and subtraction ledger (`/subjects` + the picker sweep)

**Cycle:** A5 C3, 2026-09-29. **Base:** `f02ed64a` (branch also carries `2fc6f75c`).
**Written before any JSX**, per `AGENTS.md` §11 rule 2. **Packets:** `docs/prompts/a5-subjects-table-2026-09-29-r1.md` (R1),
`…-r2.md` (R2, supersedes R1 where they differ).
**Status:** executor's own note. It does **not** self-judge the design; §11 rule 4's `REJECT_UX`
gate is the planner's, against screenshots a reviewer who did not build this takes.

---

## 0. The user this is for (R2 rule 1)

An **older, mouse-first scheduler**. They came to `/subjects` to **find one subject and see
whether it is covered**. That is the task. Everything on the screen is either that task or noise
competing with it.

What must feel different: **calmer, and self-describing.** Today a scheduler meets five
rectangles that read `All Status / All Grades / All Programs / All Room Types / All terms` — the
filter's *name* is nowhere, so the only way to learn which rectangle is "Program" is to open it.
A scheduler's second, older mistake: reading `Science, Technology, and Engineering` as a room
problem, and `OWNER_DEPT:MAPEH` as a department. Those are the four defects §11's own preamble
names, on this screen, verbatim.

"Five even filters" (R1 J3) is a **limit, not the goal.** Meeting it by cramming, truncating or
tiny type is the failure mode. Where the letter and the intent disagreed I followed the intent
and said so — §6.

---

## 1. Reference pages being copied (R2 rule 5, R2-6)

| Surface | Copied from | Why that one |
|---|---|---|
| **Filter control look** | the **Section** and **Teacher** pickers | The operator's own frame (`lane-c-to-a2.md`, 2026-09-29 00:15): *"Subject dropdowns look different from the Section and Teacher dropdowns"*, and *"the search box and the Section/Teacher pickers elsewhere are rounded rectangles"* while the subject filters were not. Rounded rectangle, not pill. |
| **Picker primitive** | `@/ui/searchable-select`, as `/timetable`'s entity picker already uses it | §8 "One look per control". Already proven on a long list with a real search box. |
| **Self-naming pattern** | `/timetable`'s `Schedule for` + entity picker pair (`SimpleHeaderHelpers.tsx:206-240`) | The one place a picker already carries its own name and passes it as `ariaLabel` (LANE-C C03 B11). Copied as a *pattern*, not as a layout. |
| **Table row shape** | `SubjectRow.tsx`'s **existing** geometry, subtracted from | R2-6: the action cell and grade chips were accepted in c2b. Not re-laid out. |

**Explicitly NOT copied:** the `/timetable` **header**. The operator judged it *"regressed · messy"*
on 2026-09-29 and it is a named counter-example (R2-6). Nothing here copies its two-row squeeze,
its helper sentences, or its chip stacking. I read it only for the picker primitive and the
label pattern.

---

## 2. Regions — what stays, what goes, what moves behind something

### Region 1 — `/subjects` filter row (the toolbar cluster)

- **STAYS:** all six controls. `Search` + `Status` + `Grade` + `Program` + `Room type` + `Term`,
  in that order, in the one `flex flex-wrap items-center gap-2.5` cluster; the `h-9` height; the
  `w-[240px]` search box; the conditional `Reset`; the `flex-wrap` backstop. The **Term** filter
  is retained on A3-C9's own reasoning (deleting a working planning filter to satisfy a
  compaction request is a silent capability regression) and R1 does not re-open it.
- **GOES:** the five `@/ui/select` (Radix) triggers; the page-local `COMPACT_SELECT` string
  (`SubjectFilterToolbar.tsx:63-64`); the five uneven widths `w-40 w-24 w-28 w-36 w-28`
  (`w-40`/`w-24`/`w-28`/`w-36`/`w-28` = 160/96/112/144/112px). One width class replaces all five.
- **MOVES BEHIND:** nothing is added to a disclosure. Per R2-5 the **option-list search box is
  not shown for a short list** (≤ 8 options) — so for `Grade` (5), `Term` (data-derived) and
  usually `Program` (6) the popover opens straight onto the options, one click fewer. The
  threshold is a named constant in `@/ui`, not a literal at any call site.
- **LEAK REMOVED:** the `sm:text-sm` on `@/ui` `Input` that made the rendered search box 14px
  while its own class list said `text-xs`. The measured search height and the five trigger
  heights now come from **one** exported token, not two hand-matched literals (R1 J3).

### Region 2 — table row, col 1 (subject identity)

- **STAYS:** the bold subject name as the row's title; the `Active` / `Archived` badge.
- **GOES (R1 A2):** the `<code>` subject-code chip, and with it its `TooltipProvider` /
  `Tooltip` / `TooltipTrigger` / `TooltipContent` wrapper, its `tabIndex={0}`, its 40-word
  `aria-label`, and its four-line explanatory tooltip. Same in `SubjectMobileCard.tsx:66`.
- **MOVES BEHIND:** nothing. The code is not relocated — on this screen a scheduler reads the
  name, and the code is an identifier for curriculum requirements and EnrollPro records, not for
  the person deciding whether a subject is covered. It remains on the edit form.
- **No `title=` replaces it** (§8).

### Region 3 — table row, col 2 (grade + program)

- **STAYS:** the grade chips, byte-identical geometry, byte-identical `GRADE_COLORS` tokens
  (`GR7` green, `GR8` yellow, `GR9` red, `GR10` blue, §8). The `No grades` fallback. The
  chip geometry the program chips now reuse.
- **GOES (R1 A3):** `programFullLabel(code)` as a visible line — `Regular Program`,
  `Science, Technology, and Engineering` — and the `"{n} programs"` count.
- **MOVES BEHIND:** the **full** program name moves into an `@/ui` `Tooltip` on each chip
  (`Tooltip`, not `HoverCard` — R2-5/J4: `@radix-ui/react-hover-card` is not a dependency and
  adding one is a lockfile change outside this slice's authority; §8 permits `Tooltip` and
  forbids only raw `title=`). Short label = the operator's own abbreviation from
  `PROGRAM_SCOPE_OPTIONS` (`REGULAR→BEC`, `STE`, `SPA`, `SPS`, `OTHER→Other`), falling back to
  `programShortLabel` for a code that list does not carry (`SPJ`, `SPFL`, `SPTVE`).
- **COLOUR:** `PROGRAM_SCOPE_BADGE[code]`, and a neutral token for an unmapped code. No new palette.

### Region 4 — table row, col 4 (room need)

- **STAYS:** the room-type line; the `+N features` link; the `AccessibleInfo` affordance; the
  `Owned by ` prefix. One fact per line, already true; the cell is not re-laid out.
- **GOES (J7):** the trailing `department` / `departments` noun, and the `and` conjunction.
  `ownerDepartmentRead` becomes a comma list of names, so the line reads `Owned by AP, MAPEH`
  rather than `Owned by Araling Panlipunan and MAPEH departments`. The all-or-nothing naming rule
  in `subject-feature-presentation.ts` is unchanged — an unexpandable code still shows its own
  code, which is exactly what makes `AP, MAPEH` come out right.
- **GOES (J6):** the literal `OWNER_DEPT:` from the `AccessibleInfo` detail sentence. The detail
  now reads `ATLAS records the owning codes as AP and MAPEH.` — the codes are the diagnostic; the
  `OWNER_DEPT:` prefix is storage syntax, so no information is lost. Page scope is exact (R2-2):
  `SubjectRow.tsx`, `SubjectMobileCard.tsx`, `SubjectCoverageSheet.tsx`, and the presentation
  helper. `ownerDepartmentPhrase` keeps its stored-marker behaviour for the A3-C4-1c controls.
- **NOT RE-FIXED (R2-4):** `ac8adf09` already fixed the **primary** ownership line
  (`SubjectRow.tsx:124`, `:230`). I leave it alone; §6 records how it is proved instead.

### Region 5 — mobile card

- **STAYS:** name, `Active`/`Archived`, `Grade level`, `Coverage`, `Review coverage`, `More`.
- **GOES:** the `<code>` chip line; the ` · {programCopy}` join onto the grade value.
- **MOVES:** programs get **their own line** of chips, the same chips as the desktop row — they
  are no longer a second fact welded onto the grade line.

### Regions 6-10 — the swept pages (R1 B2/B4)

Per-page detail is the BEFORE/AFTER table in
`docs/reviews/a5-picker-sweep-2026-09-29/picker-inventory.md`. Summary of what leaves each:

| Page | Goes | Stays (own vocabulary) |
|---|---|---|
| `/sections` | three Radix triggers, `h-10 text-sm` | `All Grades`, `All Programs`, `All home-room states`, the program-code legend line |
| `/faculty` | four Radix triggers, `h-10 w-44 text-sm` / `w-36` | `All roster states`, `All load states`, `With teaching load`, `All Departments`, `Grade taught`; `data-testid="teachers-grade-filter"` |
| `/teaching-load` (filter bar) | four Radix triggers, the page-local `CONTROL_CHROME`, and `font-bold uppercase tracking-tight` on the triggers **and** their option items | `All status`, `No teaching load`, `Adviser only`, `All departments`, `All loads`, `Highest load`, `Lowest load`; the two inclusion switches; the draft controls |
| `/teaching-load` (grid mode) | `w-45 h-10 … uppercase tracking-tight` | `activeFilterLabels.all / unassigned / constrained` |
| `/teaching-load` (history) | `min-h-11` chrome | the `Archived school year` `<Label>`, `data-testid="teaching-load-history-year-picker"`, `id="teaching-load-history-year"`, and the `— no annual Teaching Load` option suffix |

`/timetable` is **not touched** — it is already the reference (R1 J1), and its entity picker must
keep its search box (R2-5).

---

## 3. Subtraction ledger (`AGENTS.md` §11 rule 3)

Counts are per rendered unit. "Words" = visible text tokens in that region; "chips" = visible
badge/chip elements; "controls" = interactive elements.

### 3.1 Region 1 — filter row

| | before | after | Δ |
|---|---|---|---|
| controls | 6 (+`Reset` when active) | 6 (+`Reset` when active) | **0** |
| words | 11 | 17 | **+6** |
| distinct widths | 5 (`160/96/112/144/112px`) | 1 (`208px`) | **−4** |
| pill/rounded-rect mismatch vs Section+Teacher | 5 controls wrong | 0 | **−5** |
| hidden extra click per short list | — | −1 click on `Grade`/`Program`/`Term` | **−1 click** |

**The +6 words is a region where I added visible words and removed fewer words than I added, and
this is the explicit reason the packet gives for it (rule 3's escape clause).** R1 A1: *"each
filter self-naming (`Grade: All grades`, never a bare `All…`)"*, and the operator's 00:15 words:
*"two filters read only `All...` (truncated, no label — nobody can tell what they filter)"*. A
filter that does not name itself is not a filter the older user can use. No control is added, none
is removed, and the five uneven widths collapse to one. The 6 added words buy five controls that
can be identified without opening them.

### 3.2 Region 2 — row col 1, subject identity

| | before | after | Δ |
|---|---|---|---|
| chips | 2 (`FIL10` + `Active`) | 1 (`Active`) | **−1** |
| focusable elements | 2 (badge is not; the `<code>` had `tabIndex={0}`) | 0 | **−1 in the tab order, per row** |
| `@/ui` affordances | 1 `Tooltip` | 0 | **−1** |
| words | name + 1 code token | name | **−1** |

Pure subtraction. Nothing moves behind anything.

### 3.3 Region 3 — row col 2, grade + program

| | before | after | Δ |
|---|---|---|---|
| 1 program scope (the common case) | 1 line, 2 words (`Regular Program`) | 1 chip, 1 token (`BEC`) | **−1 word, 0 chips** |
| 2 scopes | 1 line, 2 words (`2 programs`) | 2 chips, 1 line | **0 words, +1 chip** |
| 3 scopes | 1 line, 2 words (`3 programs`) | 3 chips, 1 line | **0 words, +2 chips** |
| lines | 1 | 1 | **0** |

**The multi-scope chip count is the one place I add a visible element**, and the reason is R1 A3
verbatim: *"never `"{n} programs"`, never the spelled-out full name as the visible label"* — the
operator's own screenshot complaint was *"spelled-out program names"*. `2 programs` tells a
scheduler nothing about which programs; two chips labelled `BEC` and `STE` tell them everything
in the same single line. The full name is not lost, it is one hover away in a `Tooltip`. The
chips reuse the grade chips' geometry, so col 2 is now one visual language rather than a text
line under some chips.

### 3.4 Region 4 — row col 4, room need

| | before | after | Δ |
|---|---|---|---|
| primary ownership line (`AP`+`MAPEH`) | `Owned by Araling Panlipunan and MAPEH departments` — 6 words | `Owned by AP, MAPEH` — 4 tokens | **−2** |
| primary ownership line (single named dept) | `Owned by Araling Panlipunan department` — 4 words, ungrammatical | `Owned by Araling Panlipunan` — 3 words | **−1** |
| detail sentence (unmapped) | `ATLAS records the owning code as OWNER_DEPT:MAPEH.` — 7 tokens incl. a raw storage enum | `ATLAS records the owning code as MAPEH.` — 6 | **−1, and no raw code** |
| detail sentence (named) | `It is owned by the Araling Panlipunan department. ATLAS records this as OWNER_DEPT:AP.` | `ATLAS records the owning code as AP.` | **−8** |
| raw `OWNER_DEPT:` occurrences on `/subjects` | 1 (detail) | **0** | **−1** |
| lines | 2-3 | 2-3 | **0** |

Pure subtraction, and the "no raw codes" axis of the rubric is discharged outright.

### 3.5 Region 5 — mobile card

| | before | after | Δ |
|---|---|---|---|
| chips | 2 (`FIL10` + status) | 1 (status) | **−1** |
| words | name + code + grades + program (4-6) | name + grades (2-3) | **−1 to −3** |
| facts per line | grade line carried **2** (grade + program) | 1 | **−1** |

### 3.6 Whole-screen tally — `/subjects`, 1366x768

| | before | after | Δ |
|---|---|---|---|
| filter-row words | 11 | 17 | **+6** |
| words per table row (1 scope, AP+MAPEH, 1 feature) | 21 | 17 | **−4** |
| chips per table row (1 scope) | 3 | 2 | **−1** |
| focusable elements per row | 1 | 0 | **−1** |
| raw storage enums anywhere on the screen | 1 | 0 | **−1** |
| **10-row screen, whole first screen** | 11 + 210 = **221** | 17 + 170 = **187** | **−34 words** |

The filter row is net +6 **once**; the row is net −4 and the row repeats. On any real catalog the
screen is a net subtraction of words, a net subtraction of focusable elements, and a net
subtraction of raw codes. Clicks to reach a grade: 2 (open, choose) → 2, and the popover now opens
straight onto the options with no search box to aim at first.

### 3.7 Swept pages

Each swept page is net-zero in **controls** (same filters, new primitive) and net-negative in
**chrome**: `/teaching-load`'s filter bar drops 4 page-local `CONTROL_CHROME` applications and
~20 `uppercase tracking-tight` applications, `/sections` drops 3 mismatched `h-10 text-sm`
triggers, `/faculty` drops 4 `h-10 text-sm bg-background` triggers. The 1 filter each page gains
in *visible words* is the self-naming, and it is the same +1-per-filter trade as Region 1, for
the same reason, on the operator's own instruction.

---

## 4. What I am deliberately **not** doing

- **Not re-laying out the table row** (R2-6). The action cell and grade chips were accepted in
  c2b.
- **Not re-fixing the primary ownership line** (R2-4). `ac8adf09` did it. I prove it and report.
- **Not touching `/timetable`** (R1 J1, R2-5).
- **Not touching `pages/TeachingLoad.tsx`** — 962 physical lines, 38 to the cap, and A6's.
- **Not touching `SubjectFormModal.tsx:855`** (R2-2). It still prints the stored marker in its
  own `@/ui` tooltip; that is a different task on a different screen and is reported as a named
  NON_BLOCKING follow-up, not claimed as fixed.
- **Not adding a `More` disclosure** to the filter row. Nothing is being hidden there, so there
  is nothing to disclose.
- **Not adding a `HoverCard`** (J4/R2-5). `Tooltip` is the existing `@/ui` primitive.

## 5. Failure modes this design could still hit, stated before it happens

1. **Wrapping.** With R1 A1's longer `Room type: All room types`, five equal 208px triggers plus
   the 240px search do not fit the ~1054px content width at 1366 and the cluster wraps to two
   calm lines (3 + 2). That is accepted: §11 rule 1 says a literal limit met by cramming fails,
   and a clean 3+2 wrap with nothing truncated is not cramming. The operator's own shorter
   example (`Grade: All`, `Program: All` — `lane-c-to-a2.md` 00:15) would keep the cluster on
   **one** line. I implemented R1 A1 as written and flag the shorter form as a decision for Lane
   C's older-user walk (§6).
2. **Truncation.** The `Program` chip set is the widest cell content. If a subject's chips
   overflow, they wrap within col 2 rather than truncating — the row is a flex column.
3. **A3's `PROGRAM_SCOPE_BADGE` is a page-local palette entry for a non-`REGULAR` code.** The
   neutral fallback covers unmapped codes; it is a token, not an invented colour.

## 6. Decisions flagged for the reviewer / Lane C (not self-judged)

| # | Decision | Reason | Ask |
|---|---|---|---|
| D1 | `Room type: All room types` etc. — R1 A1's **longer** labels, at one even `w-52`, wrapping 3+2 at 1366 | R1 A1's settled form; the operator's own example is the shorter `Grade: All` | Lane C: is one wrapped line calmer than five shorter triggers on one line? |
| D2 | Search box suppressed for ≤ 8 options (R2-5) | A 5-option `Grade` list gains nothing from a search box and the box is one more thing to aim at | Lane C, in the older-user walk |
| D3 | `Tooltip` not `HoverCard` for the full program name (J4) | `@radix-ui/react-hover-card` is not a dependency; adding one is a lockfile change outside this slice | accept as a recorded substitution |
| D4 | Subject code removed from the row with nothing behind it (A2) | It is an identifier for curriculum requirements and EnrollPro records, not for the coverage decision; it stays on the edit form | accept the loss of the tab stop |
