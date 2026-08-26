# Gemini Execution Prompt: Phase 3 Teaching Load Review And Rotation Surface Compaction UX One-Shot

## Mission

Compact the Teaching Load page now that live year-55 data truth is mostly stable.

This is a UI/UX compaction pass, not a backend or data-model pass.

Current verified live state on Tailnet:

- `schoolId=1`
- `schoolYearId=55`
- coverage = `962 / 962`
- `unassignedPairs = 0`
- split-brain preview:
  - `quarantine.required = false`
  - integrity counters = `0`
  - `truthRowsToUpdate = 0`
  - remaining reasons:
    - `FACULTY_LOAD_REVIEW_REQUIRED`
    - `SPECIAL_PROGRAM_APPROVAL_REQUIRED`

Current page problems:

1. The non-blocking review banner still occupies too much space.
2. The `Rotational Family Breakdown` slab still occupies too much of the main workspace.
3. The page still asks schedulers to absorb too much secondary explanation before they can work.

Your job is to move review and rotational detail into secondary disclosure while preserving truthful top-line signals.

## Hard Scope

Touch only the Teaching Load frontend surface.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- any directly related Teaching Load subcomponent if necessary

Do not:

- reopen backend math
- change API contracts
- change staffing logic
- change auto-fill logic
- redesign the whole page

## Required UX Changes

### 1. Downgrade the current review banner

The page must stop using a large incident-style banner for non-blocking review state.

Required outcome:

- If `quarantine.required = false`
- and integrity counters are zero
- and `truthRowsToUpdate = 0`

then the page must not show the current large warning slab.

Replace it with a smaller review affordance such as:

- a compact inline badge
- a toolbar chip
- a button that opens a drawer/popover/sheet

That secondary surface may contain:

- review-only overload count
- approval-check count
- top review note

But those details must no longer dominate the page above the working surface.

### 2. Move rotational breakdown into secondary disclosure

The large `Rotational Family Breakdown` block should no longer sit open by default in the main workspace.

Required outcome:

- keep one truthful rotational explanation surface
- move it into a popover, drawer, sheet, collapsible secondary panel, or similar secondary disclosure
- keep the main selected-teacher strip focused on:
  - `Credited Weekly Load`
  - `Concurrent Teaching`
  - `Remaining Capacity`

The scheduler should not have to stare at the full term cards all the time just to keep working.

### 3. Preserve the truthful term language

Even after compaction:

- keep exact `Term 1`, `Term 2`, `Term 3`
- keep tied-peak language honest
- do not reintroduce additive-looking term totals
- do not reintroduce duplicate competing term surfaces

### 4. Keep top-line clarity

The top of the page must remain easy to scan.

Required outcome:

- the selected-teacher strip stays visually calm
- no giant explanatory copy blocks
- no duplicate summary numbers
- no new clutter in the header

### 5. Preserve compact workspace behavior

- no global scrollbar regressions
- no large static cards that consume the assignment workspace
- preserve no-scroll architecture

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. The large page-level review warning no longer dominates the page in warning-only state.
2. Rotational family detail is still available, but no longer always open as a large static slab.
3. The main working area feels less crowded for both a Science teacher and a TLE teacher.
4. The top-line metrics remain truthful and readable after compaction.

If the page still feels crowded after the first implementation, keep fixing in the same pass.

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- what was moved out of the main workspace
- what remained visible by default
- Tailnet verification result for one `SCI` teacher and one `TLE` teacher
- final verdict: `GO` or `NO-GO`

Do not call this `GO` unless the page is materially calmer on Tailnet.
