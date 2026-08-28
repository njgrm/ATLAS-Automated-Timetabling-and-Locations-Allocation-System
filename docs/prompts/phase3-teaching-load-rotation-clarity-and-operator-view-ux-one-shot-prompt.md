# Gemini Execution Prompt: Phase 3 Teaching Load Rotation Clarity and Operator View UX One-Shot

## Objective

Finish the final scheduler-facing clarity layer for `Teaching Load` by making rotation-family behavior understandable and by separating three operator questions that are still visually mixed together:

1. What is still uncovered?
2. Which teachers are underutilized?
3. Which special-program ownership could be redistributed?

This pass must continue from the current calmer `Teaching Load` UI.
Do not redesign the page from scratch.

## Out of Scope

Do not:

- rewrite staffing math
- change backend distribution rules yourself
- re-expand the page into tall dashboard cards
- undo the current workspace-density recovery
- reintroduce badge soup or card-heavy assignment cells

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-live-discrepancy-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- any `Teaching Load` subcomponents added by the recent Gemini rehaul

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tabs`
- `Popover`
- `HoverCard`
- `Drawer` / `Sheet`
- `Tooltip`
- `motion`

## Facts To Treat As Settled

- current scheduler-facing names stay:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- stale ownership is already fixed and must not be reintroduced
- current page density is better than before and must be preserved
- teacher-side rotation-aware load math is already correct enough to keep
- staffing report now distinguishes raw uncovered rows from concurrent shortage
- remaining real staffing blockers are concentrated in `SCIENCE` and `TLE_ROTATION`
- special-program redistribution should build on assignment-level specialization identity, not specialization-first page qualification

## Main UX Problems To Solve

### 1. Rotation behavior is still not obvious enough

Schedulers still need a clearer answer to:

- why does adding `SCI_ES` or `SCI_CHEM` affect load the way it does?
- why can one assignment be real but not fully additive to weekly load?
- what does `SCIENCE` rotation mean in practice?
- what does `TLE_ROTATION` mean in practice?

The page currently exposes the math.
It still does not expose the operator meaning clearly enough.

### 2. Staffing views are still mixed together

The page needs a cleaner separation between:

- `Coverage shortage`
- `Underutilized teachers`
- `Redistributable ownership`

Right now the scheduler still has to mentally merge those truths.

### 3. Manual assignment needs clearer term-aware preview

When the scheduler assigns a rotational family subject manually, the page should make it more obvious:

- what raw row ownership is being added
- what adjusted concurrent load effect is expected
- which family lane is affected

This should feel like guidance, not debugging output.

## Scope

### In Scope

#### A. Add a clearer rotation-family explanation layer

Required:

- preserve the current adjusted-load model
- clearly explain `SCIENCE` and `TLE_ROTATION` in scheduler language
- show that some rows belong to rotating term families instead of all stacking as simultaneous weekly demand
- surface this in the selected-teacher area and the assignment interaction area

Preferred:

- small persistent cues for family membership
- compact contextual explanation near the relevant load preview
- optional deeper detail via progressive disclosure

#### B. Add a dedicated operator split view

Required:

- create a clean operator-facing separation between:
  - coverage shortage
  - underutilized teachers by department
  - redistributable special-program ownership
- this may be implemented as tabs, segmented panels, or another compact pattern
- it must fit the current no-scroll architecture and calmer workspace

The goal is that a scheduler no longer confuses:

- missing staffing need
- available spare capacity
- ownership that could be redistributed without hiring

#### C. Improve manual assignment preview for rotation families

Required:

- when a scheduler interacts with `SCIENCE` or `TLE_ROTATION` rows, show clearer preview of:
  - raw ownership impact
  - adjusted concurrent weekly impact
  - family / term relationship

Do not make the preview large or noisy.

#### D. Keep the current layout direction

Required:

- continue from the current calmer workspace
- do not reduce the visible assignment workspace again
- keep the selected-teacher panel compact
- do not restore large dashboard-style slabs

### Out Of Scope

Do not:

- rebuild the whole page again
- rewrite backend shortage math
- change ownership truth contracts yourself
- reintroduce full-page diagnostics clutter

## Implementation Direction

### 1. Translate term-aware math into scheduler meaning

Use plain operator language.

Examples of the concept to communicate:

- `Owned this term family`
- `Counts within Science rotation`
- `Adds a row, not a full parallel weekly block`

Do not dump raw internal model terms without interpretation.

### 2. Separate action planning from diagnostics

The new operator split should help the scheduler answer:

- do we need more teachers?
- do we just need to rebalance existing teachers?
- do special-program assignments need redistribution?

### 3. Build on the current UI, do not restart it

This pass is a refinement on top of the current Gemini rehaul.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive elements were introduced
- verify no mojibake remains
- verify the assignment workspace remains materially usable on a normal laptop viewport
- verify `SCIENCE` and `TLE_ROTATION` meaning is clearer than before
- verify the operator can visually distinguish:
  - shortage
  - underutilization
  - redistributable ownership

## Required Output

Return:

1. files changed
2. rotation-clarity changes
3. operator-view separation changes
4. manual assignment preview improvements
5. confirmation that the current compact workspace was preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `SCIENCE` and `TLE_ROTATION` are easier for schedulers to interpret during manual assignment
- shortage, underutilized teachers, and redistributable special-program ownership are no longer visually conflated
- the current calmer `Teaching Load` workspace is preserved
- the page remains compact, readable, and no-scroll-safe
