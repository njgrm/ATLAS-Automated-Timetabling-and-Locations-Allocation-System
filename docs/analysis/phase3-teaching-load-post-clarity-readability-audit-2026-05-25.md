# 2026-05-25 - Teaching Load Post-Clarity Readability Audit

## Scope

- Re-check the current `Teaching Load` page after the latest rotation-clarity UI changes.
- Determine whether the page is now too crowded or too text-small for practical scheduler use.
- Separate live-data truth from readability problems.

## Verdict

- Live data and rotation-aware load math still look coherent.
- Readability has regressed.
- The page is currently too crowded in the selected-teacher trust surface and too microtext-heavy in the assignment grid.

## Live Data Status

No new truth-model regression was found in this review.

Current live shape still makes sense:

- `assignedPairs = 843`
- `unassignedPairs = 119`
- main uncovered blockers are still:
  - `SCI_ES = 82`
  - `SCI_CHEM = 35`
  - `TLE_FCS_EXP = 2`
- rotation overlap is still real but sparse:
  - only a minority of teachers currently show non-zero overlap
  - that remains expected

Conclusion:
- this is a readability and density problem, not evidence that the current live math broke again

## UX/UI Findings

### 1. Selected-teacher load area is too compressed

The selected-teacher header band is trying to show:

- identity
- adviser state
- specialization + department
- raw minus overlap plus credits arithmetic
- progress strip
- overlap-state explanation
- worked calculation access
- undo/redo
- more actions

That is too much for one compact horizontal strip.

Affected area:
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1484)

Symptoms:
- key trust information is small enough to feel secondary
- labels become harder to scan than the numbers they explain
- the arithmetic feels packed instead of authoritative

### 2. Text is too small on the core trust surface

The current page still uses very small text sizes across the most important scheduler-facing explanation:

- `text-[0.45rem]`
- `text-[0.5rem]`
- `text-[0.6rem]`
- `text-[0.65rem]`
- `text-[0.7rem]`

Examples:
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1488)
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1505)
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1555)
- [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1615)

This is too small for a scheduler’s main decision surface, especially on normal laptop screens.

### 3. Subject assignment cells are still dense in the wrong way

The section chips are compact, but they are still trying to carry too many signals:

- section name
- program badge
- rotation indicator
- specialization requirement
- conflict label
- stale-owner warning
- swap/take action

Affected area:
- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty-assignments/SubjectRow.tsx:421)

Symptoms:
- the page looks busy even when the underlying layout is compact
- understanding a section’s state still depends too much on tooltip hunting
- tiny badges and tiny labels compete with the actual assign/unassign action

### 4. Uppercase + tight tracking + tiny sizing is amplifying the problem

Many labels are:

- uppercase
- bold
- tightly tracked
- sub-`text-xs`

That combination makes dense control bands and metadata harder to read than plain mixed-case `text-xs` / `text-sm`.

Affected areas:
- roster metadata
- arithmetic labels
- grade toggles
- section state labels
- action buttons

### 5. The page is now clearer conceptually, but not calmer visually

The recent pass improved the meaning of zero-overlap vs non-zero-overlap states.
But the extra explanatory surface was added into a UI that was already near the density limit.

So the result is:

- conceptually improved
- visually more crowded

This is why the current page can be “more truthful” while still feeling worse to use.

## Recommended Direction

The next pass should not add more explanation blocks.
It should rebalance the existing explanation.

### A. Raise the floor on text size

Recommended:

- do not use sub-`text-xs` sizing for the main trust surface
- reserve the tiniest text only for tertiary helper labels
- move the selected-teacher calculation strip to a stable `text-xs` / `text-sm` hierarchy

### B. Split primary and secondary explanation more cleanly

Recommended:

- keep one short visible trust sentence near the arithmetic
- move secondary labels and repeated helper copy into progressive disclosure
- do not show every explanatory label at equal weight

### C. Simplify section-chip signal density

Recommended:

- keep the compact chip layout
- reduce simultaneous visible metadata inside each chip
- favor one strong visible state and one optional deeper explanation, not five tiny simultaneous cues

### D. Stop using microtext to solve layout pressure

Recommended:

- solve crowding by reducing simultaneous elements
- not by shrinking every label further

## Final Product Call

- `Teaching Load` is closer to correct than before
- but it is still not closure-grade from a scheduler readability standpoint
- the next pass should be a narrow readability recovery, not another truth-model or architecture pass
