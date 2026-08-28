# Gemini Execution Prompt: Phase 3 Teaching Load Zero-Overlap Clarity UX One-Shot

## Objective

Fix the remaining scheduler-trust gap in `Teaching Load`.

The live backend math is now broadly correct.
The current failure is that valid `0h` rotation-overlap states still look like broken calculations.

This pass must make the selected-teacher load explanation immediately understandable in plain scheduler language, especially when:

- raw load is non-zero
- overlap removed is `0h`
- final adjusted load still makes sense

Do not reopen backend truth work.
Do not redesign the page again.

## Out of Scope

Do not:

- change backend load math
- change staffing or coverage endpoint logic
- invent separate canonical teaching loads per term
- rebuild the workspace layout from scratch
- make the selected-teacher area tall again
- reintroduce large header cards or global scroll
- replace the current compact workspace with a new interaction model

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-ux-and-live-data-audit-2026-05-25.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-live-discrepancy-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- any extracted selected-teacher or load-calculation subcomponents if they now exist

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Popover`
- `HoverCard`
- `Tooltip`
- `Accordion`
- `motion`

## Facts To Treat As Settled

- live summary, coverage, and staffing totals are now coherent
- rotation-aware weekly load math is working live
- only a minority of teachers currently have non-zero overlap
- zero overlap is often the correct result, not a missing calculation
- there is one canonical adjusted weekly load
- `SCIENCE` and `TLE_ROTATION` still represent shared weekly lanes across terms
- the compact workspace should be preserved

## Current Problem

The page still makes correct zero-overlap cases feel suspicious.

Right now the load strip and worked calculation are directionally better, but schedulers still have to infer:

- whether `0h overlap` means no math happened
- whether the teacher simply has no same-lane term overlap
- why adding one rotation-family row might still add `0h` concurrent load
- why another row from the same family can still increase ownership without increasing weekly classroom time

The page currently explains the model better than it explains the actual operator conclusion.

## Live Truth To Preserve

Treat the following as real current evidence:

- `assignedPairs = 843`
- `unassignedPairs = 119`
- `SCI_ES = 82 uncovered`
- `SCI_CHEM = 35 uncovered`
- `TLE_FCS_EXP = 2 uncovered`
- `12` teachers currently have non-zero rotation overlap
- `134` teachers currently have zero rotation overlap

Examples of valid non-zero overlap:

- `YAP, ROLANDO`
  - `37.5h raw`
  - `30.0h adjusted`
  - `7.5h overlap removed`
- `AQUINO, ELPIDIO`
  - `31.0h raw`
  - `27.3h adjusted`
  - `3.8h overlap removed`

This pass must help schedulers understand why many other teachers correctly show `0h overlap`.

## Required Product Outcome

A scheduler should be able to open a teacher and immediately understand one of these two states:

1. `Overlap exists`
   - this teacher owns multiple same-family section lanes across terms
   - raw rows are reduced into one concurrent weekly total

2. `No overlap exists`
   - this teacher currently has no shared Science/TLE lane overlap
   - raw rows and concurrent teaching time are the same
   - `0h removed` is the correct result

The page should answer that without forcing the scheduler to open a tiny info control and interpret internal terminology.

## Required UX Changes

### A. Add an always-visible reason line for the current overlap state

Required:

- in the selected-teacher load area, show a short plain-language explanation near the arithmetic
- when overlap is `0h`, explicitly say something equivalent to:
  - `No same-lane Science or TLE overlap is active for this teacher right now.`
  - or `No weekly rotation overlap to remove. Raw and classroom time are currently the same.`
- when overlap is non-zero, explicitly say something equivalent to:
  - `Some Science/TLE rows share the same weekly lane across terms, so overlap is removed from weekly load.`

This must be visible without opening a popover.

### B. Make zero-overlap and non-zero-overlap visually distinct states

Required:

- the arithmetic strip must not make `0h overlap` look like missing data
- use a calm affirmative state for valid zero overlap
- use a stronger explanatory state when overlap exists
- keep the strip compact, but remove ambiguity

The operator should be able to tell the difference between:

- `zero because nothing overlaps`
- `non-zero because overlap was removed`

### C. Translate rotation-family language into term-language

Required:

- reduce reliance on abstract labels like `Rotation Family`
- near the load explanation and row-interaction cues, prefer language like:
  - `same section across different terms`
  - `shared weekly lane`
  - `does not add another full weekly block`
  - `new weekly lane`
- if family labels remain, they must be secondary to scheduler-readable explanation

### D. Strengthen assignment-time delta explanation

Required:

- when hovering or selecting a section row in `SubjectRow`, make the first-level explanation easier to notice
- do not rely on a tiny dot plus tooltip alone
- visibly communicate:
  - `adds assignment row`
  - `adds weekly load`
  - `same lane across terms`
  - `0h added to concurrent weekly load`

This should remain compact and no-scroll-safe.

### E. Improve the worked calculation trust surface

Required:

- keep the existing worked-calculation disclosure if useful
- ensure the top arithmetic strip and deeper explanation use one consistent story
- if a separate memo or displayed value path is redundant or confusing, simplify the surface so it feels authoritative

The selected-teacher panel should feel like one coherent explanation, not a compact strip plus a separate hidden technical explanation.

## Implementation Direction

- preserve the current compact workspace
- favor persistent micro-explanations over hidden explanations
- use one short visible trust sentence beside the arithmetic
- keep deeper detail available through progressive disclosure
- make valid `0h overlap` feel resolved, not suspicious
- make non-zero overlap feel like understandable weekly-lane collapse, not invisible magic

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify the selected-teacher area stays compact on a normal laptop viewport
- verify a zero-overlap teacher now clearly shows why overlap is `0h`
- verify a non-zero-overlap teacher now clearly shows why overlap was removed
- verify assignment-time cues are easier to understand without relying only on tiny tooltips
- verify no regressions to the current compact workspace

## Required Output

Return:

1. files changed
2. selected-teacher overlap-state clarity changes
3. zero-vs-non-zero visual treatment changes
4. assignment-time explanation changes
5. confirmation that the compact workspace was preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- valid `0h overlap` states no longer look broken
- non-zero overlap states are explained in plain scheduler language
- assignment-time lane impact is easier to understand at a glance
- the page remains compact and scheduler-friendly
