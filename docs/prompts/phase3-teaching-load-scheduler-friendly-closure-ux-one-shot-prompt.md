# Gemini Execution Prompt: Phase 3 Teaching Load Scheduler-Friendly Closure UX One-Shot

## Objective

Turn the current `Teaching Load` page into a scheduler-friendly workspace that explains the assignment model in plain language at the point of action.

This pass must continue from the current calmer, denser workspace.
Do not rebuild the page into a new layout system.

The backend truth to assume already exists:

- raw vs concurrent load math
- rotation-family lane metadata
- degraded writable mode
- section-level specialization identity for `SPA_SPEC` / `SPS_SPEC`
- capability-override support

This pass is about making those behaviors understandable and usable.

## Out of Scope

Do not:

- rewrite backend staffing math
- redesign the page from scratch
- re-expand the selected-teacher area into a tall dashboard slab
- bring back large top cards or heavy card grids
- reintroduce global page scrolling
- collapse the page back into terse technical shorthand
- invent a three-separate-loads-per-term model

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-live-discrepancy-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tabs`
- `Tooltip`
- `Popover`
- `HoverCard`
- `DropdownMenu`
- `motion`

## Facts To Treat As Settled

- scheduler-facing names stay:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- the current no-scroll architecture stays
- the current calmer density recovery stays
- there is one canonical adjusted weekly load
- `SCIENCE` and `TLE_ROTATION` are rotation families that share a weekly lane
- `SCIENCE` and `TLE_FCS_EXP` are still the real live blocker families
- `SPA_SPEC` and `SPS_SPEC` remain umbrella schedulable subjects
- section-level specialization identity already exists and must be surfaced, not reinvented
- degraded writable mode is allowed when ATLAS has enough local evidence

## Current UX Failure To Correct

The page is still too technical for scheduler use.

Right now it mostly communicates:

- internal model language
- hover or popover explanations
- compact stats and pills
- backend-truth hints

Instead, the page needs to answer these operator questions immediately:

1. If I assign this row, what changes right now?
2. Is this a new term of the same section lane or a truly additional weekly burden?
3. Is this teacher actually free for this work?
4. Is this shortage real, or just concentrated ownership?
5. If EnrollPro is down, can I still keep working here?
6. For `SPA_SPEC` / `SPS_SPEC`, who is actually a realistic assignment candidate and why?

## Main Problems To Solve

### 1. The page still explains rotation math better than it explains scheduler decisions

The UI currently uses terms like:

- `Rotation Family`
- `Shared Weekly Slot`
- `Raw Rows`
- `Concurrent Families`

These are directionally correct, but still require interpretation.

The page must instead clearly communicate:

- this class belongs to the same section lane across terms
- adding this row may add ownership without fully adding weekly load
- the teacher is being measured by adjusted weekly demand, not by stacked raw rows

### 2. The controls are still too model-centric

Even after the UX pass, the page still leans on compact wording and technical framing.

The scheduler should not have to decode:

- whether `Auto-Assign Remaining` means safe department-fit assignment, special-program redistribution, or both
- whether `Staffing Audit` is about raw coverage, concurrent shortage, or hiring need
- whether a teacher is truly available or only looks low-load because of rotation-family collapse

### 3. Shortage, spare capacity, and redistribution are still too blended

The page needs clearer separation between:

- uncovered classes
- teachers with usable capacity
- special-program ownership that is already covered but can be rebalanced

These are different scheduler questions and should not read like one blended mode.

### 4. Special-program assignment still feels hidden behind diagnostics

For `SPA_SPEC` / `SPS_SPEC`, the scheduler needs a clear section-level story:

- what specialization the section needs
- whether the selected teacher is a direct match
- whether they are approved via compatibility override
- whether the section is covered but concentrated under too few teachers

### 5. Degraded writable mode is not yet communicated as a confident workflow

If EnrollPro is down but ATLAS has enough local evidence, the page should not feel like a temporary broken view.

It should clearly say:

- what source is being used
- what can still be done
- what remains intentionally blocked

## Required UX Outcomes

### A. Replace technical jargon with scheduler-first action language

Required:

- keep the page compact
- reduce or rename jargon-heavy labels where the operator meaning is not obvious
- prefer scheduler language over internal implementation language

Examples of concepts to make clearer:

- `same section lane across terms`
- `adds ownership row`
- `adds weekly load`
- `already covered`
- `covered but concentrated`
- `available for reassignment`
- `specialization match`
- `approved compatibility`

### B. Make rotation-term behavior obvious at the exact point of assignment

Required:

- expose the effect of a manual selection directly in the assignment surface
- do not hide the first explanation inside a secondary popover alone
- visibly show when a row:
  - increases raw ownership only
  - increases adjusted concurrent weekly load
  - belongs to the same `SCIENCE` or `TLE` section lane across terms

The scheduler should understand this before saving.

### C. Make selected-teacher load interpretation practical

Required:

- keep one canonical adjusted load
- make the difference between raw load and adjusted load feel operational, not mathematical
- ensure the selected-teacher area answers:
  - how loaded is this teacher now
  - what changes if I take this class
  - why does this not count like a full new weekly block

Do not solve this by adding a giant explanation card.

### D. Reframe page modes around scheduler questions

Required:

- keep the current workspace split approach
- make each mode answer a literal scheduler question, not an internal data slice

The operator should immediately understand:

- where do I fix uncovered classes
- who can still absorb work
- where can special-program sections be redistributed

### E. Surface special-program assignment logic as a real workflow

Required:

- make `SPA_SPEC` / `SPS_SPEC` section slots visibly specialization-aware
- clearly distinguish:
  - direct specialization match
  - approved compatibility override
  - covered but concentrated ownership
- make underutilized `MAPEH` teachers feel like actionable candidates where justified

### F. Make degraded writable mode feel trustworthy

Required:

- communicate cached or ATLAS-owned source state honestly
- clearly show what remains writable
- clearly show which actions still require live-only state
- do not label the page as read-only if safe local writes are actually allowed

## Implementation Direction

### 1. Keep the current compact workspace

Required:

- preserve the current vertical efficiency
- do not reduce the height of the main assignment workspace
- do not return to oversized panels

### 2. Use persistent micro-explanations, not hidden deep explanations

Required:

- use small always-visible cues near the assignment and load surfaces
- allow deeper disclosure through tooltip/popover only for secondary detail
- the first-level explanation must be visible without hunting

### 3. Use stronger visual distinction between assignment effects

Required:

- help the operator distinguish:
  - normal new weekly demand
  - same-lane term rotation
  - specialization slot
  - covered-but-redistributable special-program ownership

### 4. Keep typography readable

Required:

- do not solve density with sub-`text-xs` text
- reduce container waste instead of shrinking important copy
- remove remaining mojibake and awkward separators

## Specific Problems That Must Be Corrected

- any remaining wording that implies the scheduler is just looking at technical diagnostics
- any row treatment where `SCIENCE` / `TLE_ROTATION` behavior is still ambiguous
- any mode naming that still feels cryptic or internal
- any `SPA_SPEC` / `SPS_SPEC` assignment slot that does not clearly tell the operator why a teacher is or is not a strong candidate
- any degraded-mode messaging that still suggests the page is read-only when it is actually locally writable
- any remaining microtext or cramped copy that lowers confidence in the workspace

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify the current no-scroll workspace contract is preserved
- verify a normal laptop viewport still shows a meaningful assignment workspace
- verify the page now explains rotation-term behavior more clearly than the current `Rotation Family` / `Shared Weekly Slot` alone
- verify the selected-teacher panel makes adjusted-vs-raw load understandable without forcing the scheduler into a diagnostic popover
- verify special-program slots visibly distinguish match, compatibility, and concentration states
- verify degraded writable mode is communicated honestly and confidently

## Required Output

Return:

1. files changed
2. control and labeling changes
3. rotation-term clarity changes
4. selected-teacher load interpretation changes
5. special-program assignment and redistribution clarity changes
6. degraded writable-state communication changes
7. confirmation that the compact workspace was preserved
8. verification results
9. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the page reads like a scheduler workspace rather than a technical diagnostic surface
- a scheduler can understand `SCIENCE` / `TLE_ROTATION` assignment effects without decoding internal jargon
- the selected-teacher load story is operationally clear
- special-program assignment feels like a real workflow, not a hidden expert path
- degraded writable mode is communicated honestly and confidently
- the current compact workspace remains intact
