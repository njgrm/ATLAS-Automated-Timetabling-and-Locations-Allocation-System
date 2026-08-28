# Gemini Execution Prompt: Phase 3 Teaching Load Strict UX/UI Recovery One-Shot

## Objective

Recover `Teaching Load` as a scheduler-facing page after the recent truth-model passes made it more accurate but less usable.

This is a strict UX/UI pass.

Do not re-open the backend truth model unless a tiny UI-supporting client contract adjustment is absolutely required.

The goal is:

- keep the new truthful term-aware math
- make the page calm enough for everyday scheduler use
- remove the feel of an internal diagnostics console
- preserve honesty without forcing raw technical counters into the main workflow

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`
- `docs/analysis/phase3-subjects-teachers-and-teaching-load-visual-language-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-needs-term-math-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- `atlas-client/src/index.css`

## Facts To Treat As Settled

- Scheduler-facing naming is:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- The latest truth pass introduced valid dual metrics:
  - raw uncovered completeness
  - concurrent weekly shortage
- The current problem is mostly UX/UI, not whether those metrics exist
- Do not collapse back to fake simplicity
- Do not remove the new truth split

## Scope

### In Scope

#### A. Calm the top workflow band

Required:

- redesign the top overview so it no longer looks like a strip of tiny diagnostic badges
- separate:
  - assignment completeness
  - concurrent weekly shortage
- keep both truths visible, but do not present them as badge soup
- demote maintenance and repair actions from the main everyday action band

#### B. Simplify the teacher rail

Required:

- reduce microtext
- reduce always-on control density
- keep specialization more visible than technical secondary metadata
- make the rail feel like a roster navigator, not a debug panel
- keep the no-scroll architecture intact

#### C. Improve selected-teacher clarity

Required:

- preserve the actual/raw/credited/rotation logic
- make the explanation durable and readable
- do not depend on the `Breakdown` tooltip as the main explanation path
- if the tooltip remains, it must become a secondary reinforcement rather than the primary explanation surface

#### D. Rebuild the staffing-needs modal as an operator aid

Required:

- keep the raw-vs-concurrent split
- make the language less alarming and more actionable
- explain what the scheduler can do next
- keep the shortage drilldown, but make it easier to parse
- remove remaining mojibake or malformed separators
- stop making the modal feel like a staffing memo first and a scheduler tool second

#### E. Reduce subject-row noise

Required:

- keep conflict and ownership safety
- reduce visible clutter in subject rows
- foreground:
  - subject identity
  - current assignment state
  - section ownership workflow
- demote low-value badges and tiny helper labels where possible

#### F. Demote integrity diagnostics

Required:

- keep integrity honesty available
- do not leave the `Current-Year Teaching Load Integrity` slab dominating the main workflow
- move it into a calmer advanced or collapsible data-health treatment if possible

#### G. Tighten typography

Required:

- review global type-weight choices in `index.css`
- reduce default heaviness where it makes tables look louder than intended
- avoid sub-`text-xs` persistent workflow text where possible
- make the page feel more professional and less harsh

### Out Of Scope

Do not:

- rewrite staffing logic or rotation-family backend math
- reopen subject qualification contracts
- redesign unrelated pages
- remove truthful diagnostics entirely
- add new destructive workflow actions

## Implementation Direction

### 1. Preserve truth, simplify presentation

The page should remain honest, but schedulers should not need to decode technical counters in the main path.

### 2. Make explanation persistent

The current inline `Load interpretation` direction is right in principle, but the page still duplicates explanation poorly.

Refine it into one strong durable explanation surface.

### 3. Favor grouped cards or panels over tiny badges

For important concepts:

- completeness
- shortage
- load interpretation
- staffing action options

prefer grouped visible panels over thin badge strips.

### 4. Keep teacher-first workflow

The page should visually support this order:

1. choose teacher
2. understand load
3. inspect uncovered subject needs
4. assign or swap
5. save
6. verify staffing impact

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive elements were introduced
- verify no visible mojibake remains in `Teaching Load`
- verify the top workflow area is calmer and clearer than before
- verify the selected-teacher explanation is visible without hover-only interaction
- verify the staffing-needs modal now reads like an operator tool, not a raw staffing report
- verify the teacher rail is more readable than before

## Required Output

Return:

1. files changed
2. top-band and action-hierarchy changes
3. teacher-rail readability changes
4. selected-teacher explanation changes
5. staffing-needs modal UX changes
6. subject-row noise reductions
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the page still preserves the new truthful metrics
- the main workflow is materially calmer and easier to scan
- the teacher rail is more readable
- the selected-teacher load logic is easier to understand without tooltip dependency
- the staffing-needs modal is clearer and less alarming
- the page feels scheduler-friendly rather than diagnostics-first
