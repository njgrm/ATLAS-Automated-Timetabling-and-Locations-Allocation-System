# A5 C3 slice B — picker sweep: BEFORE / AFTER inventory

**Cycle:** A5 C3 slice B, 2026-09-29. **Base for both columns:** `419277e4`.
**Packets:** R1 B1-B5, R2 (R2-5 threshold, R2-6 references), R3 §1 (the self-naming rule).

**How the BEFORE column was derived.** Re-derived from source at `419277e4` with
`git show 419277e4:<path>`, **not** copied from R1's J1 table. That mattered once already: R1
J1 quoted `pages/Faculty.tsx` at 981 lines, QA measured 915, and the two are *both* true of
different things — **981 physical lines, 914 non-blank, 67 blank** (re-derived here by
`[System.IO.File]::ReadAllLines(...).Count` and by counting non-blank lines). A number quoted from
a packet is a claim; a number read from the tree at a named commit is evidence. §16.

Legend — **Self-naming** = the trigger's own text contains the filter's name (`Grade: All`)
rather than only a value. **Search box** = whether the option list shows the R2-5 search field.

---

## 1. `/sections` — `components/sections/SectionsFilterToolbar.tsx`

| # | Control | BEFORE `file:line` | BEFORE primitive | BEFORE trigger class | BEFORE w | BEFORE h | Self-naming | Search box | AFTER primitive | AFTER w | AFTER h | Self-naming | Search box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Grade | `SectionsFilterToolbar.tsx:29` | `@/ui/select` (Radix) | `h-10 text-sm` | grid col | **40px** | no (`All Grades`) | no (4 items) | `FilterPicker` | `w-32` (128) | **36px** | **yes** (`Grade: All`) | **no** |
| 2 | Program | `SectionsFilterToolbar.tsx:40` | `@/ui/select` | `h-10 text-sm` | grid col | **40px** | no (`All Programs`) | no (4 items) | `FilterPicker` | `w-32` | **36px** | **yes** (`Program: All`) | **no** |
| 3 | Home room | `SectionsFilterToolbar.tsx:52` | `@/ui/select` | `h-10 text-sm` | grid col | **40px** | no (`All home-room states`) | no (3 items) | `FilterPicker` | `w-32` | **36px** | **yes** (`Home room: All`) | **no** |

**Preserved:** the `grid sm:grid-cols-3` layout, the `all` first option in each list, the
`program-code-legend` line, and every option label (`All Grades`, `Grade {n}`, `All Programs`,
`Regular Program`, `All home-room states`, `Needs a home room`, `Home room assigned`).
New accessible names: `Filter by grade level`, `Filter by program scope`, `Filter by home-room state`.
**Δ height: −4px. Δ look overrides: 1 removed.**

## 2. `/faculty` — `pages/Faculty.tsx` → `components/faculty/FacultyFilterRow.tsx`

| # | Control | BEFORE `file:line` | BEFORE primitive | BEFORE trigger class | BEFORE w | BEFORE h | Self-naming | Search box | AFTER primitive | AFTER w | AFTER h | Self-naming | Search box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Roster state | `Faculty.tsx:756` | `@/ui/select` | `h-10 w-44 text-sm bg-background` | 176px | **40px** | no (`All roster states`) | no (3 options) | `FilterPicker` | `w-32` (128) | **36px** | **yes** (`Roster: All`) | **no** |
| 5 | Load state | `Faculty.tsx:766` | `@/ui/select` | `h-10 w-44 text-sm bg-background` | 176px | **40px** | no (`All load states`) | no (3 options) | `FilterPicker` | `w-32` | **36px** | **yes** (`Load: All`) | **no** |
| 6 | Department | `Faculty.tsx:777` | `@/ui/select` | `h-10 w-44 text-sm bg-background` | 176px | **40px** | no (`All Departments`) | **data-derived** | `FilterPicker` | `w-32` | **36px** | **yes** (`Department: All`) | **only above 8 departments** |
| 7 | Grade taught | `Faculty.tsx:787` | `@/ui/select` | `h-10 w-36 text-sm bg-background` | 144px | **40px** | name only (`Grade taught`) | no (5 items) | `FilterPicker` | `w-32` | **36px** | **yes** (`Grade: All`) | **no** |

**Preserved:** `data-testid="teachers-grade-filter"` on row 7; the `More filters` disclosure and
its `primaryFilterCount` behaviour; the conditional `Reset filters`; the conditional rendering of
row 6 (`departments.length > 0`). Every option label is the page's own.
**B3:** the four rows moved to `components/faculty/FacultyFilterRow.tsx` **in the same commit**.
`Faculty.tsx` **981 → 952 physical lines** (885 non-blank).

> **CORRECTION ROUND 1.** The first candidate said `949`, which was wrong. Re-derived two ways at
> this tip: `File.ReadAllLines(...).Count` gives **952 physical / 885 non-blank**, and
> `git cat-file -s` gives a 39 504-byte blob consistent with it. Both counters are recorded from
> here on, because a number quoted from memory is a claim and a number read from the tree is
> evidence — which is the lesson R1 J1's 981-vs-QA's-915 disagreement already taught this
> inventory. **`Faculty.tsx` at 952 physical is under §8's 1000-line cap**, with 48 lines of
> headroom; the extraction was required by the packet and by the arithmetic, not by a breach.
**Δ: 13 controls in, 13 out; 4 widths collapsed to 1; 1 page-local `bg-background` removed.**

## 3. `/teaching-load` — `components/faculty-assignments/TeachingLoadFilterBar.tsx`

| # | Control | BEFORE `file:line` | BEFORE primitive | BEFORE trigger class | BEFORE w | BEFORE h | Self-naming | Search box | AFTER primitive | AFTER w | AFTER h | Self-naming | Search box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | Status | `TeachingLoadFilterBar.tsx:152` | `@/ui/select` | `w-40 font-bold uppercase tracking-tight ${CONTROL_CHROME}` | 160px | 36px | no (`Status` / `All status`) | no (5 items) | `FilterPicker` | `w-32` (128) | 36px | **yes** (`Status: All`) | **no** |
| 9 | Department | `TeachingLoadFilterBar.tsx:167` | `@/ui/select` | `w-44 font-bold uppercase tracking-tight ${CONTROL_CHROME}` | 176px | 36px | no (`Department` / `All departments`) | **data-derived** | `FilterPicker` | `w-32` | 36px | **yes** (`Department: All`) | **only above 8 departments** |
| 10 | Load | `TeachingLoadFilterBar.tsx:182` | `@/ui/select` | `w-40 font-bold uppercase tracking-tight ${CONTROL_CHROME}` | 160px | 36px | no (`Load` / `All loads`) | no (5 items) | `FilterPicker` | `w-32` | 36px | **yes** (`Load: All`) | **no** |
| 11 | Sort | `TeachingLoadFilterBar.tsx:198` | `@/ui/select` | `w-40 font-bold uppercase tracking-tight ${CONTROL_CHROME}` | 160px | 36px | no (`Sort teachers`) | no (3 items) | `FilterPicker` | `w-32` | 36px | **yes** (`Sort: All`) | **no** |

`CONTROL_CHROME` itself: `h-9 rounded-xl border border-border/60 bg-background px-2.5 text-xs
transition-colors hover:bg-muted/40` — declared at `TeachingLoadFilterBar.tsx:65` at `419277e4`,
applied to 4 triggers **and to ~20 option rows**, each of which also carried
`font-bold uppercase tracking-tight`. **B4 removes the whole string from the pickers.** The two
optional-inclusion `Switch` wrappers keep an equivalent, renamed `SWITCH_CHROME`, because a
Switch is not a picker and is not part of the shared primitive; the two Switch **Labels** keep
`uppercase tracking-tight`, which is recorded as a known exception in the guard
(`A5-C3-P3-2b`) and as layout-note D1.

**Preserved:** the seven controls and their order, the two inclusion switches, the draft
controls, the facet counts, the **disabled states** (now carried by `FilterPicker`'s `disabled`
option flag, which `@/ui` owns), and every option label including the `—` policy-not-ready
placeholder.
**Δ: 4 widths → 1; 1 page-local chrome string deleted; ~24 `uppercase tracking-tight`
applications removed; 3 trigger glyphs removed; 3 option colour cues removed (the words carry the
same fact — layout note §3.2).**

## 4. `/teaching-load` grid mode — `components/faculty-assignments/SectionGridMode.tsx`

| # | Control | BEFORE `file:line` | BEFORE primitive | BEFORE trigger class | BEFORE w | BEFORE h | Self-naming | Search box | AFTER primitive | AFTER w | AFTER h | Self-naming | Search box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | Section view | `SectionGridMode.tsx:217` | `@/ui/select` | `w-45 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight` | 180px | **40px** | no (`Filter View`) | no (4 items) | `FilterPicker` | `w-32` (128) | **36px** | **yes** (`Filter: All`) | **no** |

**Preserved:** `activeFilterLabels.all / unassigned / constrained` verbatim.
**Δ: `w-45`→`w-32`, 40px→36px, `uppercase tracking-tight` removed, the `ListFilter` glyph
removed — the one control on this screen that looked like nothing else in the product.**

## 5. `/teaching-load` history — `components/faculty-assignments/TeachingLoadHistoryView.tsx`

| # | Control | BEFORE `file:line` | BEFORE primitive | BEFORE trigger class | BEFORE w | BEFORE h | Self-naming | Search box | AFTER primitive | AFTER w | AFTER h | Self-naming | Search box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | Archived year | `TeachingLoadHistoryView.tsx:166` | `@/ui/select` | `min-h-11` | grid col (`minmax(13rem,18rem)`) | **44px** | yes — a visible `<Label>` | no | `FilterPicker` | `fill` (grid col) | **36px** | **yes ×2** — trigger **and** `<Label>` | no |

**Preserved:** the visible `<Label htmlFor="teaching-load-history-year">Archived school year
</Label>`, the `id`, `data-testid="teaching-load-history-year-picker"`, and the
`— no annual Teaching Load` option suffix on a year with no cycle.
**New:** `allValue=""`, because this filter has no `all` option — without it the trigger would
have read `Archived year: all` on a control that offers no such choice.
**Δ: 44px→36px; one filter is now named twice (recorded as layout-note D4).**

> **CORRECTION ROUND 1 — the "Preserved" claim above was partly false, and QA proved it from
> source.** Before this round the trigger's unset face was always the hard-coded `All`, because
> `FilterPicker` computed `shortValue` as `'All'` for any unset value and the `??` fallback could
> only fire on `null`. The `placeholder` this control passes — `Choose an archived year`, and
> `Loading archived years…` while loading — therefore **could never render**, and the control
> claimed a state it could not deliver. While `disabled` the visible face read `All` while
> `aria-label` read `Loading archived years…`: two statuses for one fact.
>
> The fix is in `@/ui`, stated once: **an unset value shows `All` when the list really has an
> `all` member, and the caller's `placeholder` when it does not; a disabled picker shows its
> `disabledReason` on the visible face so it agrees with the accessible name.** The other twelve
> swept filters all have an `all` member, so their visible faces are byte-identical to the first
> candidate — `A5-C3-B2b` is the row that proves twelve were not broken to fix one. This control's
> unset face now reads **`Archived year: Choose an archived year`**, and while loading
> **`Archived year: Loading archived years…`**, which is what the pre-s Radix control said.

---

## 6. The sweep in one table

| | BEFORE | AFTER |
|---|---|---|
| Controls swept | 13 | 13 |
| Distinct primitives | **1** (`@/ui/select` for all 13) | **1** (`@/ui/filter-picker`) |
| Distinct trigger widths | **5** (`grid col`, `w-36`, `w-40`, `w-44`, `w-45`) | **2** (`w-32` shared, `fill` for one grid cell) |
| Distinct trigger heights | **3** (40, 44, 36px) | **1** (36, the shared `PICKER_CONTROL_HEIGHT_CLASS`) |
| Page-local chrome strings on a picker | **1** (`CONTROL_CHROME`, declared at `TeachingLoadFilterBar.tsx:65`) | **0** |
| Triggers that name themselves | **1 of 13** (only the history-year picker, which already had a visible `<Label>`; the other 12 were a bare value or a placeholder) | **13 of 13** |
| Short lists showing a search box | n/a | **0** (R2-5 working) |
| Visible words added | — | **0** |

> **CORRECTION ROUND 1 — four self-contradictions in this table, now corrected above.**
> **(a)** "Distinct primitives 4 (`@/ui/select` only)" was self-refuting: the count was 4 *and* the
> parenthetical said they were all the same one. The truth is **1 → 1** — thirteen controls, one
> primitive before and one after. The sweep's win is not "fewer primitives"; it is that the one
> primitive is now `@/ui`'s instead of a page's.
> **(b)** "Triggers that name themselves 0 of 13" contradicted row 4/5/13 of §2 and §5 above, which
> record that the history picker already carried a visible `<Label>Archived school year</Label>`
> and so DID name itself. The correct BEFORE figure is **12 of 13**: every picker was a bare value
> except the history year, which had a real `<Label>` beside it.
> **(c)** The BEFORE row counted `COMPACT_SELECT` as a second page-local chrome string. **It does
> not exist at `419277e4`** — it was removed by slice A, which is the base for this whole sweep.
> Counting it would have credited this slice with a deletion it did not make. Corrected to
> `CONTROL_CHROME` alone, which is the one that was here.
> **(d)** Roster and Load were listed as "(4 items)". Each list is **3 options** — `all` plus two
> states. Corrected in §2.
>
> None of these changes a gate or a code path; all four are documentation that overstated or
> contradicted its own evidence, which is the failure §16 exists to prevent.
| Page-local look overrides removed | — | **≈29** |

**Every option label, every `data-testid` and every page-owned accessible name is preserved.** What
changed is the primitive, the chrome, and the self-naming — which is exactly R1 B2's scope.

## 7. The guard

`src/ui/__tests__/a5-p3-picker-guard.test.ts`, wired to `test:a5-p3-picker-guard` in the same
commit. **There is no vitest in this repository** (R1 J5) — the harness is `tsx --test`.

Scoped by an **allowlist** of the six swept files, so it is a promise about a known set of
surfaces rather than a repo-wide style ban. It fails on: a swept filter built from `@/ui/select`;
a look-changing override on a picker line (`triggerClassName=…`, `uppercase`, `tracking-tight`,
`w-45`, `min-h-11`, `CONTROL_CHROME`, `rounded-xl`); and a page-local redefinition of the shared
variant (`pickerTriggerClass(`, `PICKER_CONTROL_HEIGHT_CLASS`, `PICKER_TRIGGER_WIDTH_CLASS`,
`SEARCHABLE_OPTION_THRESHOLD`).

It carries a **positive control** (`A5-C3-P3-1b`) so it cannot be satisfied by a file that builds
nothing at all, and a **known-exception row** (`A5-C3-P3-2b`) pinning the two uppercased Switch
labels so the exception is deliberate and removable.

**It deliberately does not assert a class list as evidence of a rendered width** — the slice-A
trap. The rendered contract is pinned in `a5-c3-picker-contract.test.tsx`; this file pins the
source contract.
