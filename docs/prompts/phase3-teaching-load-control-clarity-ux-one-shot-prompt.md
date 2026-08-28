# Gemini Execution Prompt: Phase 3 Teaching Load Control Clarity UX One-Shot

## Objective

Refine the current `Teaching Load` workspace so the controls and rotation-family behavior are understandable to schedulers without undoing the recent density recovery.

This pass must continue from the current calmer UI.
Do not redesign the page from scratch.

## Out of Scope

Do not:

- rewrite backend staffing math
- bring back tall dashboard cards
- re-expand the selected-teacher area
- undo the current compact workspace recovery
- reintroduce a global page-scroll layout

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-ux-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tooltip`
- `Popover`
- `Tabs`
- `HoverCard`
- `Sheet`
- `motion`

## Facts To Treat As Settled

- current scheduler-facing naming stays:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- stale ownership is fixed and must not be reintroduced
- current workspace density is materially better than before and must be preserved
- `SCIENCE` and `TLE_FCS_EXP` are still the real live blockers
- `SPA_SPEC` and `SPS_SPEC` are already covered, but low-load `MAPEH` teachers still need clearer redistribution visibility
- current term-aware math is already good enough to keep
- the main UX weakness is not layout chaos anymore
- the main UX weakness is now unclear control meaning and unclear operator interpretation

## Main Problems To Solve

### 1. The top controls are still too cryptic

Current labels are too terse for the workflow:

- `Audit`
- `Auto-Fill`
- `Work`
- `Gap`
- `Load`
- `Spec`

These save space but cost too much comprehension.

### 2. Rotation-family meaning is still only half-visible

The page already hints at:

- `Rotation Family`
- `Shared Weekly Slot`

But the scheduler still needs a clearer answer to:

- is this another term of the same section lane?
- does this add a row only or real weekly concurrent load?
- why can a teacher take this and not jump by the full raw row amount?

### 3. Special-program redistribution still feels abstract

Low-load `MAPEH` teachers are not being turned into clear assignment opportunity signals strongly enough.

The UI should separate:

- fully covered but concentrated special-program ownership
- underutilized `MAPEH` teachers
- specialization-supported redistribution candidates

### 4. Degraded writable state still needs cleaner operator language

If the current UI still says `Read-Only` or implies upstream dependence too vaguely while ATLAS can still operate, tighten that language.

## Scope

### A. Clarify major controls

Required:

- replace terse control labels with clearer scheduler-facing language
- preserve density while making the action meaning explicit

Examples of the kind of meaning to communicate:

- staffing impact / shortage audit
- auto-assign remaining eligible rows
- shortage view
- underutilized teachers
- special-program redistribution

You may keep short labels only if a nearby tooltip or visible descriptor removes ambiguity.

### B. Make rotation-family behavior explicit in the assignment workflow

Required:

- make `SCIENCE` and `TLE_ROTATION` meaning clearer near the actual manual assignment surface
- show the operator that these rows belong to a rotating family, not a fully parallel weekly block
- visibly distinguish:
  - raw row ownership
  - concurrent weekly load effect

The operator should not have to open a deep diagnostic explanation just to understand why a hover or assignment changed load by less than the subject minutes.

### C. Improve the operator split views

The current split between shortage, utilization, and redistribution should become clearer and more literal.

Required:

- make it visually obvious which view answers:
  - what is uncovered
  - who still has usable spare capacity
  - which special-program ownership can be redistributed
- do not rely on abbreviations alone

### D. Strengthen special-program assignment visibility

Required:

- better expose specialization-aware slots and redistribution opportunities for `SPA_SPEC` / `SPS_SPEC`
- keep the current compact assignment surface
- continue from the current `SubjectRow` direction instead of reverting to large cards

### E. Keep the current calmer workspace

Required:

- do not make the selected-teacher area taller again
- do not reduce the visible assignment workspace
- do not turn the page into a dashboard or report page

## Implementation Direction

### 1. Favor plain operator language over internal model language

Examples of the concept to communicate:

- `Part of Science rotation`
- `Same section lane across terms`
- `Adds ownership row`
- `Adds concurrent load`
- `Covered but concentrated`
- `Available for redistribution`

### 2. Use progressive disclosure, not hidden truth

Small persistent cues should do the first layer of explanation.
Optional deeper disclosure can still exist, but the scheduler should understand the basics without a hunt.

### 3. Preserve compactness by simplifying words, not shrinking type

Do not solve space pressure with sub-`text-xs` typography.
If text needs to be clearer, simplify the layout around it instead.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify the assignment workspace remains materially usable on a normal laptop viewport
- verify the revised control labels are clearer than the current `Audit / Auto-Fill / Work / Gap / Load / Spec`
- verify `SCIENCE` and `TLE_ROTATION` are easier to interpret during manual placement
- verify shortage, underutilized teachers, and redistributable special-program ownership are no longer visually conflated

## Required Output

Return:

1. files changed
2. control-label and control-clarity changes
3. rotation-family explanation changes
4. special-program redistribution visibility changes
5. degraded writable-state language changes
6. confirmation that the compact workspace was preserved
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the current calmer workspace is preserved
- the primary controls are materially easier for schedulers to understand
- `SCIENCE` and `TLE_ROTATION` assignment meaning is clearer during manual placement
- special-program redistribution reads as a real operator workflow instead of a hidden abstraction
