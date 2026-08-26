# Gemini Execution Prompt: Phase 3 Teaching Load Rotation Calculation Clarity One-Shot

## Objective

Make the rotation-aware weekly load calculation in `Teaching Load` visibly understandable to schedulers.

The current hover/popover explanation is too abstract.
This pass must turn the existing truthful load model into a worked, readable calculation view.

Do not change the underlying load math.
Make the existing math understandable.

## Out of Scope

Do not:

- rewrite backend load or staffing math
- invent separate canonical teaching loads per term
- redesign the whole `Teaching Load` page
- re-expand the page into tall dashboard cards
- reintroduce global scroll

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- any extracted selected-teacher/load detail subcomponents if they now exist

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Popover`
- `Tooltip`
- `HoverCard`
- `Accordion`
- `motion`

## Facts To Treat As Settled

- there is one canonical adjusted weekly load
- the current backend already exposes truthful rotation-family and lane-impact fields
- `SCIENCE` and `TLE_ROTATION` share weekly lanes across terms
- current manual assignment already has:
  - raw minutes
  - concurrent delta minutes
  - lane IDs
  - expands-concurrent-demand flag
- the problem is explanation, not missing arithmetic

## Current Problem

The current scheduler explanation is still too conceptual.

The page says things like:

- `Rotation Family`
- `Shared Weekly Slot`
- `ATLAS removes Xh of overlapping rotation-family sections`

That is directionally correct, but not easy to trust quickly.

Schedulers need to see the actual calculation.

Right now the page does not clearly show:

- what rows are being counted raw
- which rows collapse into the same lane
- how much overlap is removed
- what final concurrent weekly load remains
- how advisory and ancillary hours contribute after that

## Required Product Outcome

A scheduler should be able to open a teacher in `Teaching Load` and immediately understand:

1. the teacher's raw teaching rows
2. the rotation-family overlap that gets removed
3. the resulting concurrent teaching load
4. the advisory and ancillary additions
5. the final policy-credited load

And when manually selecting a section, the scheduler should understand:

- whether this adds a raw row only
- whether it adds real concurrent weekly load
- whether it belongs to the same rotation lane across terms

## Required UX Changes

### A. Add a worked load calculation view

Required:

- show the load arithmetic in a durable, readable format near the selected-teacher load area
- do not rely on hover-only explanation for the first layer
- show a worked sequence, not just labels

The view should communicate something equivalent to:

- `Raw teaching rows`
- `Rotation overlap removed`
- `Concurrent teaching load`
- `Advisory`
- `Ancillary`
- `Final policy-credited load`

### B. Break down rotation families visibly

Required:

- show `SCIENCE` and `TLE_ROTATION` as explicit families when present
- show the family raw total
- show the family concurrent counted total
- show the family overlap removed
- show the rows or section-lane count in a compact but understandable way

This must feel like a calculation view, not a hidden diagnostic.

### C. Make assignment-time impact explicit

Required:

- near manual section selection, show the effect of adding that row in scheduler language
- visibly distinguish:
  - `adds ownership row`
  - `adds concurrent weekly load`
  - `same section lane across terms`
  - `new weekly lane`

The scheduler should not have to infer this from a tiny badge alone.

### D. Keep the current compact workspace

Required:

- preserve the current density recovery
- do not make the selected-teacher slab tall again
- if deeper detail is needed, use progressive disclosure cleanly
- the first calculation layer must still be visible without hunting

### E. Use scheduler language, not internal math language

Required:

- prefer phrasing that explains what happens operationally
- do not make the explanation read like a developer trace

Examples of the right direction:

- `same Science lane across terms`
- `does not add another full weekly block`
- `counts as shared rotation time`
- `adds to final credited load`

## Implementation Direction

- preserve one canonical adjusted load
- add a visible worked calculation layer
- keep deeper per-family detail collapsible if necessary
- make the assignment delta explanation visible at point of action
- favor readable arithmetic over abstract model labels

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify the selected-teacher area is still compact enough for laptop use
- verify the page now shows a worked load calculation instead of only a conceptual hover/popover explanation
- verify `SCIENCE` and `TLE_ROTATION` families are easier to understand as weekly lane calculations
- verify assignment-time impact is clearer during manual placement

## Required Output

Return:

1. files changed
2. worked calculation view changes
3. rotation-family breakdown changes
4. assignment-time delta explanation changes
5. confirmation that compactness was preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- a scheduler can see the actual weekly load arithmetic clearly
- rotation-family overlap is shown as a readable calculation, not just abstract explanation
- manual placement impact is easier to understand at the point of action
- the compact workspace remains intact
