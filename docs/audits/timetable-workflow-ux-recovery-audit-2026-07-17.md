# Timetable Workflow UX Recovery Audit

**Date:** 2026-07-17  
**Surface:** `/timetable` live Tailnet environment (`https://njgrm.buru-degree.ts.net/timetable`)  
**Verdict:** **NO-GO for operator usability**

## Executive Summary

The prior timetable performance work improved narrow drag-render metrics, but it did not close the real operator workflow. The current page still fails the user-facing goals of swapping generated sessions, placing unassigned sessions, scrolling the generated-run unassigned list, fast first-use readiness, and simple older-user operation.

The main failure pattern is that the page optimizes technical sub-scenarios while leaving the core workflows split across multiple hidden modes:

- generated-run review
- manual edit / swap
- generated-run unassigned repair
- pre-generation draft placement
- teaching-load repair
- policy/map/request side workflows

This makes the page feel smooth in a narrow profiler but non-functional in actual use.

## Live Tailnet Evidence

### Navigation and First Readiness

Live Tailnet run with admin credentials:

| Check | Result |
| --- | ---: |
| Login | `200` |
| DOM content loaded | `~3.16s` |
| Timetable table visible | `~12.42s` |
| Total resource transfer | `~9.26 MB` |
| Total decoded resource size | `~10.77 MB` |
| JavaScript resources | `52` |
| JavaScript decoded size | `~4.45 MB` |
| Global browser scroll | Not present |

Interpretation: the root no-scroll contract is intact, but first meaningful timetable readiness is still too slow for a primary daily-use scheduling page. A drag FPS pass does not cover this delay.

### Generated-Run Unassigned Scroll

Live generated run `#225` showed:

| Element | Measurement |
| --- | ---: |
| `#panel-unassigned` height | `640px` |
| virtualized unassigned list client height | `18px` |
| virtualized unassigned list scroll height | `28,482px` |
| visible virtualized rows | `7` |

Verdict: **Fail.** The unassigned list technically scrolls, but the viewport is effectively one line high. For an operator, this presents as "I cannot scroll the unassigned tab."

Likely cause: the static generated-run summary, resource diagnostics, reason filters, and helper copy consume nearly the entire left-rail height before the virtualized list is given flex space.

### Generated-Run Unassigned Placement

Observed live flow:

1. Opened `Unassigned`.
2. Expanded a generated unassigned item.
3. The item exposed `Load fix suggestions`, `Place session`, `Full explanation`, and `Flag`.
4. Clicking `Place session` did not visibly open a slot picker, suggested-slot list, or placement dialog in the active viewport.

Verdict: **Fail.** The action label promises placement, but the code routes the item into a Teaching Load repair workflow. Slot selection is hidden behind a separate preview/repair state and can be invisible when the dock is not obvious.

Relevant code path:

- `GeneratedRunRailPanels.tsx`
  - `Place session` calls `setSelectedUnassignedForRepair(item)`.
- `TacticalSandboxDock.tsx`
  - unassigned placement suggestions appear only after repair preview/readiness state exists.
- `useScheduleReviewWorkspaceState.ts`
  - dragging or keyboard-selecting a generated-run unassigned item into the grid routes to an assignment picker.

This means there are two inconsistent placement models for the same object:

- click `Place session` -> Teaching Load repair dock
- drag/cell-placement -> assignment picker / manual edit proposal

### Generated-Run Swap

Code support exists:

- `useScheduleReviewWorkspaceState.ts`
  - occupied target evaluation calls `findRegularSwapCandidate(...)`.
  - swap candidates call `openRegularSwapPrompt(...)`.
- `useTimetableMutations.ts`
  - `openRegularSwapPrompt(...)` calls `${apiBase}/swap/preview`.
  - `executeRegularSwap(...)` calls `${apiBase}/swap`.
- `TimetablePlacementDialogs.tsx`
  - renders `Review occupied-slot swap`.

Live click-path evidence:

1. Clicking one occupied generated entry selected it.
2. Clicking another occupied entry did not open the swap dialog.
3. No inline swap status was exposed.

Verdict: **Partial / insufficient.** The lower-level drag/swap route may exist, but the common user action does not expose it. The page needs a clear, tested, task-first "switch this session" flow that works by click/tap as well as drag.

### New Pre-Generation Draft Access

Observed live:

1. `New Pre-Generation Draft` is hidden inside the `More` menu.
2. An automated selection attempt did not transition the page from generated run `#225` to the pre-generation draft workspace within 5 seconds.
3. No visible draft-loading state or "draft opened" confirmation appeared in that pass.

Verdict: **Fail / needs manual confirmation.** Even if the event path works for a human in some cases, hiding the entry point and giving weak feedback is not acceptable for the target users.

### New-Draft Placement Model

Code path:

- `stagePreGenDrop(...)` in `useTimetableMutations.ts`
  - chooses faculty/room automatically when possible.
  - previews placement.
  - auto-commits immediately if the preview is allowed.
  - only opens a confirm dialog for occupied-slot displacement or missing faculty/room context.

Verdict: **Fail for foolproof UX.** The new-draft model is too opaque:

- "place" may silently become "preview then auto-save."
- if preview blocks, the error lands in a side state rather than a stable step-by-step placement panel.
- if faculty/room cannot be inferred, the user gets a toast instead of a recoverable guided form.

## Broader UX / QoL Findings

### 1. The Page Has Too Many Concurrent Mental Models

The page currently asks an operator to understand:

- generated run vs pre-generation draft
- selected entry vs selected unassigned item
- drag source vs keyboard selected source
- manual edit proposal vs teaching-load repair
- preview vs commit vs soft override
- left rail tabs vs center workspace vs right panel
- hidden More menu actions

This violates KISS for older or non-technical users.

### 2. Primary Actions Are Hidden or Ambiguous

Examples:

- `New Pre-Generation Draft` is under `More`.
- `Place session` does not directly show "choose teacher, room, and slot."
- swap behavior requires the correct interaction path instead of an explicit "Switch" task.
- "Load fix suggestions" is a technical phrase, not an operator task.

### 3. The Left Rail Is Doing Too Much

The generated-run unassigned tab combines:

- summary stats
- resource diagnostics
- reason filters
- helper text
- virtualized list
- expanded item diagnostics
- fix suggestions
- item actions

The result is a broken list viewport and cognitive overload.

### 4. The Right/Dock Workflow Is Not Discoverable

Generated unassigned placement depends on the Tactical Sandbox Dock for suggested slots, but the action does not clearly move focus there or explain the next required step.

### 5. Performance Gates Are Too Narrow

Earlier gates measured drag containment well, but did not gate:

- time from navigation to usable grid
- time from navigation to left-rail list usable
- click-to-swap success
- unassigned placement success
- new-draft entry success
- visual confirmation after user action
- scrollability of each panel
- older-user task completion

### 6. Current Copy Uses System Terms Instead of User Tasks

Examples needing replacement:

- "Generated run"
- "Pre-generation draft"
- "Fix suggestions"
- "Teaching Load repair"
- "Preview impact"
- "Manual edit proposal"

Preferred operator-oriented copy:

- "Review generated schedule"
- "Plan schedule before generating"
- "Find available slots"
- "Choose teacher"
- "Choose room"
- "Check conflicts"
- "Save placement"

## Severity Table

| Severity | Finding | User Impact | Gate |
| --- | --- | --- | --- |
| Critical | Generated unassigned list viewport is `18px` high | Cannot browse 365 unassigned sessions | NO-GO |
| Critical | Generated unassigned `Place session` does not visibly open placement | Cannot place sessions | NO-GO |
| Critical | Common click path does not expose swap | Cannot switch sessions reliably | NO-GO |
| Critical | New-draft access and placement are opaque | Cannot start/recover draft placement confidently | NO-GO |
| High | Table visible after `~12.42s` | Page feels slow before any action | NO-GO for UX |
| High | More menu hides primary scheduling actions | Operators miss required workflows | NO-GO |
| High | Multiple repair models for the same object | Users cannot predict what actions do | NO-GO |
| Medium | Resource diagnostics consume rail height | Useful info blocks primary list | Needs redesign |
| Medium | Technical labels dominate copy | Older/non-technical users struggle | Needs rewrite |

## Immediate Recovery Principles

1. Do not remove live conflict inspector or placement feedback to gain smoothness.
2. Do not claim performance success unless click/tap/drag workflows still work.
3. Make "select session -> choose target -> preview conflicts -> save" the single visible model.
4. Keep diagnostics secondary and collapsible.
5. Gate every phase with live Tailnet task completion, not only component/unit tests.

