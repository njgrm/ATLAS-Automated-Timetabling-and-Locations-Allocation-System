# Timetable Default Layout Redesign Plan - 2026-07-21

## Objective

Redesign the default `/timetable` experience so an older, non-technical scheduler can understand what to do within a few seconds without seeing the full expert cockpit.

This is not a performance-only phase and not another small compactness pass. The default page must visually change from a three-panel operations console into a simple task-first scheduling workspace.

## Problem Statement

The prior overhaul repaired important workflow and performance blockers, but the visible page still feels similar because the same core workspace composition remains:

- too many controls are visible at once;
- source/run/status/task/filter/panel information competes with the grid;
- the user sees multiple modes before understanding the next action;
- advanced diagnostics and recovery surfaces are still too close to the default view;
- tests proved route function and performance, not sufficient visual simplicity.

The new target is a default layout that follows KISS:

> One screen, one main task, one obvious next step.

## Non-Negotiable UX Principles

1. **Grid first**
   - The timetable grid is the main visual object on first load.
   - The first viewport must not look like an admin dashboard.

2. **One primary task at a time**
   - The default page shall show one recommended next action.
   - Secondary actions shall be visible but visually quiet.
   - Expert tools shall be behind `More` or `Advanced view`.

3. **No drag dependency**
   - Drag remains available as a shortcut.
   - Click/tap-to-select and click/tap-to-place must be the primary explained path.

4. **Help without crowding**
   - Persistent help must be short.
   - Longer explanations must live in `Help`, `Why?`, `What does this mean?`, or popover surfaces.
   - Help copy must use plain language, not scheduling jargon.

5. **Older-user accessibility**
   - Primary targets should be at least `44px` high.
   - Text must avoid dense all-caps walls.
   - Focus states must be obvious.
   - Dynamic changes must use `aria-live` where they affect task progress.
   - Every icon-only action needs a label or tooltip.

6. **No-scroll architecture**
   - Preserve root/local scroll contracts.
   - No global browser scrollbar.
   - The grid and task drawer own local scrolling.

7. **Keep power features**
   - Do not remove diagnostics, policies, maps, edit history, run history, filters, or conflict detail.
   - Move them out of the default visual path.

## Target Default Layout

### First Load: Simple Scheduler View

The first loaded `/timetable` screen should contain only these major regions:

1. **Slim status bar**
   - Run/source chip: `Using saved ATLAS data · Run #223`.
   - Publish readiness chip: `Not ready`, `Ready to publish`, or `Review needed`.
   - `Advanced view` toggle.
   - `More` menu.

2. **Task prompt**
   - One plain sentence:
     - `Next: Place unresolved sessions`
     - `Next: Review warnings`
     - `Next: Ready to publish`
   - One primary button:
     - `Start placing`
     - `Review issues`
     - `Publish schedule`
   - One secondary `What does this mean?` help trigger.

3. **Timetable grid**
   - Occupies the majority of the viewport.
   - Shows readable section/subject blocks.
   - Shows selected/move guidance only when a task is active.

4. **Collapsed task drawer**
   - Closed by default.
   - Opens only when the user chooses a task such as `Place unresolved`, `Swap`, or `Review issues`.

### Advanced View

Advanced view restores the expert cockpit features for power users:

- persistent left rail;
- right detail panel;
- full filter toolbar;
- diagnostics and violations list;
- policy/map/edit-history tools.

Advanced view must be a deliberate user choice, not the default.

## Phase 0 - Current State Visual Audit and Bundle Truth

### Goal

Prove what the user is actually seeing before implementing visual changes.

### Work

- Capture screenshots of `/timetable` at:
  - desktop `1366x768`,
  - mobile portrait,
  - mobile landscape.
- Record whether Tailnet is serving the current development bundle or returning stale/502 output.
- Measure:
  - top of grid,
  - visible count of task/action buttons,
  - visible panel count,
  - visible text density above the grid,
  - first useful action time.
- Document visual failure points using screenshot annotations or a short markdown audit.

### Gate

- We know whether the live page reflects the latest code.
- We have a before screenshot for comparison.
- The audit identifies which visible elements must move out of first view.

## Phase 1 - Introduce Simple/Advanced Layout State

### Goal

Create the layout switch that allows a truly simple default without deleting expert capabilities.

### Work

- Add a `layoutMode` state with values:
  - `simple`,
  - `advanced`.
- Default `/timetable` to `simple`.
- Persist the user choice locally after explicit toggle.
- Add an `Advanced view` control in the slim status bar.
- Ensure route/query state does not accidentally force expert view unless explicitly requested.
- Keep current workspace available under `advanced`.

### Gate

- First visit opens `simple`.
- Returning users who explicitly selected `advanced` get `advanced`.
- A visible control can switch back to `Simple view`.
- No workflow capability is removed.

## Phase 2 - Rebuild the Simple Status Bar and Task Prompt

### Goal

Replace the current command-heavy header with a small, calm decision area.

### Work

- Convert source truth into a compact chip with a help popover.
- Convert run/publish state into one plain readiness chip.
- Replace the current multi-button command row with:
  - one recommended next action,
  - one primary action button,
  - one `More` menu.
- Move these into `More`:
  - run history selector,
  - refresh,
  - setup tools,
  - policy,
  - map,
  - edit history,
  - filters,
  - diagnostics.
- Keep critical status visible, but not vertically expensive.

### Gate

- At desktop `1366x768`, the grid begins at or above `220px`.
- Above the grid, the user sees no more than:
  - one source/readiness line,
  - one task prompt line,
  - one primary action.
- The page does not show the full diagnostics or filter cockpit by default.

## Phase 3 - Task Drawer System

### Goal

Show task-specific help and controls only after the user chooses a task.

### Work

- Add a single task drawer that can open in these modes:
  - `place-unresolved`,
  - `swap-sessions`,
  - `review-issues`,
  - `plan-draft`,
  - `publish`.
- In simple mode, do not show left and right panels by default.
- Opening a task drawer should:
  - show only the relevant list/actions,
  - keep the grid visible,
  - provide short step-by-step instructions,
  - include a clear close/back control.
- Task drawer content should be visually light:
  - grouped counts,
  - top 5 recommended items,
  - `Show more` for long lists.

### Gate

- Starting placement opens only the placement queue, not the whole rail.
- Starting swap shows only swap instructions and selected-session feedback.
- Review issues shows grouped issue categories, not the full violation wall.
- Closing the drawer returns to the calm grid-first state.

## Phase 4 - Simplify Placement and Swap Guidance

### Goal

Make common tasks foolproof without cluttering the grid.

### Work

- Placement mode:
  - show `1. Choose a session` then `2. Choose a green slot` progress.
  - show grid-wide `Can place`, `Can swap`, `Blocked`, and `Warning` labels only while placement/swap mode is active.
  - keep click/tap placement primary.
- Swap mode:
  - show `1. Choose first class` then `2. Choose class to switch with`.
  - open the existing unified review sheet.
  - keep primary action `Swap sessions`.
- Blocked states:
  - never use generic errors.
  - show one direct next action: `Fix room first`, `Choose another slot`, or `Review warning`.

### Gate

- A non-technical user can infer the next click without reading a long paragraph.
- Grid-wide guidance appears only when useful.
- No teacher assignment controls appear in timetable placement or swap.
- Drag remains smooth and optional.

## Phase 5 - Reduce Visual Density Inside the Grid

### Goal

Make the grid easier on the eyes while keeping needed schedule information.

### Work

- Audit cell content in section view.
- Prefer:
  - subject label,
  - room or concise secondary label,
  - warning marker only when needed.
- Hide low-value metadata until hover/click details.
- Use consistent grade colors only where grade meaning is encoded.
- Keep row height readable but not bloated.
- Add a `Comfortable density` toggle only if needed after the first pass.

### Gate

- Cells are readable at normal zoom without dense microtext.
- Warnings remain visible.
- Details are available on click/hover.
- Grid still fits enough rows to be useful.

## Phase 6 - Mobile and Older-User Accessibility Pass

### Goal

Make simple mode usable for touch and low-confidence users.

### Work

- Validate mobile portrait and landscape layouts.
- Ensure primary actions are at least `44px` high.
- Verify keyboard-only flow:
  - select task,
  - select source,
  - select grid slot,
  - open review,
  - cancel safely.
- Verify screen-reader labels for:
  - status bar,
  - task prompt,
  - task drawer,
  - grid cells,
  - review sheets.
- Add `aria-live` progress feedback for mode changes and selected task/source.

### Gate

- Mobile does not require drag.
- Focus order follows the task sequence.
- Screen readers get meaningful labels.
- No modal/drawer traps focus incorrectly.

## Phase 7 - Verification, AG Review, and Moderated Usability

### Goal

Prove the redesign is visually simpler, functionally intact, and understandable by real users.

### Work

- Add Playwright specs for simple mode:
  - default first load;
  - simple/advanced toggle;
  - placement drawer;
  - swap drawer;
  - review drawer;
  - mobile tap flow.
- Re-run existing workflow/performance suites.
- Ask Antigravity to verify with browser Playwright.
- Run moderated older-user script:
  - identify current status;
  - start placing an unresolved session;
  - identify why a blocked item cannot be placed;
  - swap two sessions;
  - find advanced tools;
  - return to simple view.

### Gate

- Existing functional suites remain green.
- First useful grid action remains under `2.5s` in isolated Tailnet runs.
- Drag performance gates remain green.
- Antigravity returns `GO`.
- Moderated user completes core tasks without coaching.

## Grouped Implementation Iterations

To keep Codex and Antigravity validation manageable:

### Iteration E - Layout Mode and Simple Header

Includes Phases 0, 1, and 2.

Expected visible change:

- `/timetable` no longer opens as the full cockpit.
- The top area becomes a slim status + task prompt.
- `Advanced view` restores the prior expert workspace.

Validation:

- screenshot comparison before/after;
- simple default route test;
- advanced toggle test;
- no-scroll and grid-top budget.

### Iteration F - Task Drawer and Guided Workflows

Includes Phases 3 and 4.

Expected visible change:

- Placement, swap, review, draft, and publish are task drawers.
- Left/right panels are not default simple-mode furniture.
- Guidance appears only when the task needs it.

Validation:

- placement click/tap flow;
- swap click/tap flow;
- blocked-state next action;
- existing review sheets still used.

### Iteration G - Grid Visual Comfort and Accessibility

Includes Phases 5 and 6.

Expected visible change:

- Grid cells are calmer and less text-heavy.
- Mobile/touch flows are clearer.
- Accessibility labels and focus order match task sequence.

Validation:

- desktop/mobile screenshot audit;
- keyboard-only task flow;
- target-size checks;
- screen-reader label checks where feasible.

### Iteration H - Release Verification

Includes Phase 7.

Expected result:

- Antigravity validates the simplified layout externally.
- Moderated older-user evidence decides final GO/NO-GO.

Validation:

- full Playwright matrix;
- performance matrix;
- AG browser report;
- moderated task script results.

## Anti-Goals

- Do not remove advanced timetable capabilities.
- Do not make the grid slower to restore visual guidance.
- Do not add another stacked header band.
- Do not rely on color alone for status.
- Do not turn help into a wall of text.
- Do not introduce a separate route that fragments `/timetable`; use a clear simple/advanced mode within the same route.

## Current Verdict

The previous timetable overhaul is workflow/performance-correct but visually incomplete.

Default-layout redesign is `NO-GO` until Iterations E-H are implemented and externally validated.
