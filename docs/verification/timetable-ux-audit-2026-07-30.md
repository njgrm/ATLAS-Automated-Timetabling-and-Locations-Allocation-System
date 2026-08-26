# Timetable UX/UI Audit — Older Non-Technical Operator Fit

Date: 2026-07-30  
Target: https://njgrm.buru-degree.ts.net/timetable  
Verdict: NO-GO for older non-technical scheduler officers

## Summary

The timetable page is functionally stronger than earlier versions, but it is still not simple enough for older non-technical users. The current design passes many layout and performance guardrails, but it still presents too many controls at once, consumes too much vertical space before showing useful timetable content, and makes the simple plotting workflow feel cramped.

The main failure is information architecture. Advanced view is still a cockpit. Simple view hides the cockpit, but then places the unresolved-session queue inside a constrained drawer that can show too few sessions to support efficient plotting.

## Live Browser Measurements

Screenshots and JSON audit artifacts were captured under:

- `qa-artifacts/timetable-ux-audit-2026-07-30/`

Measured with the guided tour disabled to evaluate the underlying layout:

| Viewport | Mode | Key finding |
|---|---|---|
| Desktop 1366x768 | Simple | Header is 133px. Grid starts at 207px. Task drawer shows only 2 unresolved cards. |
| Desktop 1366x768 | Advanced | Source notice is 30px, task guide is 94px, grid starts at 361px, center content height is 424px. |
| Mobile portrait 390x844 | Simple | Header is 121px. Task drawer is 306px tall but shows 0 unresolved cards before scrolling. |
| Mobile portrait 390x844 | Advanced | Task guide is 123px, grid starts at 541px, center content height is 320px. |
| Mobile landscape 844x390 | Simple | Header is 133px. Task drawer is 224px tall and shows 0 unresolved cards before scrolling. |
| Mobile landscape 844x390 | Advanced | Grid starts at 395px, center content height is only 12px. This is unusable. |

No global browser scrollbar was detected during this audit. The issue is not shell overflow; it is poor viewport budgeting inside the timetable surface.

## Component Findings

### 1. Advanced header stack is too tall

Components involved:

- `ScheduleReviewWorkspace.tsx`
- `ScheduleReviewWorkspaceHeader.tsx`
- `TimetableToolbar.tsx`
- `TimetableStatusLegend.tsx`

Problems:

- Advanced mode renders multiple stacked full-width bands before the grid:
  - run selector/action bar;
  - source truth notice;
  - task guide;
  - setup/input-state banner;
  - entity/filter toolbar.
- These are individually reasonable, but together they push the timetable below the useful first viewport.
- Mobile landscape advanced mode is effectively broken from a UX standpoint because only about 12px of center content remained visible in the measurement.
- The default guided tour overlay can auto-open and obscure the grid, which makes first-use feel more complex instead of safer.

### 2. Simple view is visually cleaner but plotting is still cramped

Components involved:

- `TimetableSimpleHeader.tsx`
- `TimetableTaskDrawer.tsx`
- `LeftRailContent.tsx`
- `GeneratedUnassignedPanel.tsx`
- `VirtualizedRailList.tsx`

Problems:

- Simple view still exposes too many top-level controls at once: source chip, warning chip, filters, advanced view, more, status key, why, start placing.
- The task drawer currently embeds the unresolved rail list rather than redesigning it for the drawer.
- On mobile portrait and mobile landscape, the drawer shows the instructions, badges, search, and filters, but no session cards before scrolling.
- On desktop, only two cards are visible. For plotting hundreds of sessions, this is too slow and cognitively tiring.
- The session queue is search-capable, but not plotting-optimized. Users need to see a small working batch of sessions immediately.

### 3. Unresolved-session queue is still a list-management tool, not a plotting tool

Components involved:

- `GeneratedUnassignedPanel.tsx`
- `UnassignedRailRow`
- `DraggableUnassignedPin`

Problems:

- The queue is dominated by summary badges, search, status chips, grade/reason chips, result counts, diagnostics toggles, and then cards.
- That structure is acceptable for auditing unresolved items, but poor for fast placement.
- Older operators need a clearer "do this next" flow:
  - selected session;
  - next few sessions;
  - placeable grid cells;
  - review before save;
  - auto-advance.
- Current row height is large enough for touch safety but expensive in vertical space.

### 4. Advanced left/right panels improved, but the page still gives too many choices

Components involved:

- `LeftRail.tsx`
- `RightPanel.tsx`
- `SchedulingPolicyPane.tsx`
- `TacticalSandboxDock.tsx`

Problems:

- Left rail tabs combine violations, unassigned, pinned, and requests in the same attention panel.
- Right panel/detail areas are structurally safer now, but they add to cockpit density when advanced mode is open.
- Policy and repair tools should stay available, but they should not compete with the main timetable grid by default.

### 5. Grid itself is not the primary problem

Components involved:

- `CenterWorkspace.tsx`
- `TimetableGrid.tsx`

Findings:

- The grid is generally usable when it is allowed enough vertical space.
- Grid-wide guidance remains useful and should be preserved.
- The main problem is that surrounding headers and panels reduce the grid to a secondary object, especially in advanced mobile landscape.

## Older-User Fit Assessment

| Dimension | Score | Reason |
|---|---:|---|
| Plain-language copy | 8/10 | Labels are mostly understandable, but too many are visible at once. |
| First-screen usefulness | 4/10 | Advanced view wastes too much vertical space before the timetable. |
| Simple plotting workflow | 4/10 | Simple view is visually simpler, but the queue shows too few sessions. |
| Mobile portrait usability | 5/10 | No overlap, but session placement requires too much drawer scrolling. |
| Mobile landscape usability | 2/10 | Advanced center content can collapse to near-zero height. |
| Cognitive load | 4/10 | The page still asks users to understand too many modes and controls. |
| Accessibility mechanics | 7/10 | Touch targets and no-scroll shell are mostly okay, but cognitive accessibility is weak. |

Overall score: 4.8/10. The page is not yet fit for older non-technical users.

## Required UX Direction

The next redesign should stop treating "simple view" as "advanced view with panels hidden." Simple view needs its own plotting workflow.

Required direction:

1. The timetable grid must be the dominant first-screen object.
2. The advanced header must collapse to one compact command row plus optional drawers.
3. The simple task drawer must become a plotting tray that immediately shows actionable sessions.
4. Search and filters must be available, but not before the first actionable session.
5. Advanced tools must remain available, but behind explicit "More tools" or "Advanced" entry points.
6. The guided tour must not auto-obstruct the timetable on first entry.

## Recommended Phased Fix Plan

### Phase 0 — Add UX Budget Tests

- Add Playwright assertions for:
  - advanced grid top must be within a strict first-screen budget;
  - mobile landscape advanced center content must remain usable;
  - simple task drawer must show at least 3 actionable sessions on desktop;
  - simple task drawer must show at least 1 actionable session on mobile portrait;
  - simple task drawer must show at least 1 actionable session on mobile landscape;
  - guided tour must not auto-open over the timetable unless explicitly requested.

### Phase 1 — Compress Advanced Header

- Replace the advanced header stack with:
  - one compact command row;
  - one inline status chip group;
  - optional collapsible details for source truth, warnings, policy status, and run metadata.
- Move setup/input-state banners into a compact alert drawer or one-line warning chip.
- Move task guide into a popover or inline single-line mode switch.
- Target budgets:
  - desktop advanced grid top under 260px;
  - mobile portrait advanced grid top under 300px;
  - mobile landscape advanced grid top under 180px.

### Phase 2 — Redesign Simple Plotting Tray

- Replace the current drawer rail embed with a purpose-built plotting tray.
- The tray should show:
  - selected/current session;
  - next 3 sessions on desktop;
  - next 1-2 sessions on mobile;
  - compact "Skip", "Details", and "Place" actions.
- Move search/filter controls behind a "Find session" button or collapsible filter row.
- Keep long diagnostics out of the tray.
- Preserve virtualization for the full queue, but do not make the first visible content be filters.

### Phase 3 — Auto-Advance Placement Workflow

- After a successful placement review, automatically advance to the next unresolved session.
- Keep the queue anchored so users do not lose their place.
- Keep grid-wide place/swap/block guidance visible for the selected session.
- Provide a clear "Undo last placement" action near the tray.

### Phase 4 — Advanced Panel Decluttering

- Default advanced left rail to the active task only.
- Move less frequent tools to "More tools":
  - room requests;
  - policy pane;
  - manual repair;
  - impact preview;
  - sync setup;
  - map workspace.
- Keep all features, but stop presenting them as equal priority.

### Phase 5 — Older-User Validation Gate

- Run task-based Playwright simulations:
  - place three unresolved sessions without search;
  - find a specific section and place it;
  - swap two occupied sessions;
  - review one blocker;
  - open and close advanced policy tools without losing place.
- Capture desktop, mobile portrait, and mobile landscape screenshots.
- Treat any mode where the grid is not visible enough for action as NO-GO.

