# Requirements: Timetable Visual Noise and Badge Spam Cleanup

## Overview

Clean up visual noise, eliminate "badge spam", and reduce redundant warning text across the timetable placing mode and review modals. The goal is to make the UI simpler and calmer for non-technical scheduler users, directly addressing GEMINI.md rule #7 ("Keep visual hierarchy calm") and the Phase 5 grid-label density pass.

## Scope

### In Scope

- Removal of textual preview labels (`Blocked`, `Warning`, `Can swap`, `Can place`) from grid cells during drag/keyboard placement mode
- Removal of `Occupied ({count})` badge from grid cells during placement mode
- Removal of DOM-injected pointer preview labels from the `decoratePointerPreview` effect
- Change of soft-violation class card border from `border-dashed` to solid
- Consolidation of duplicate "Blocks" / warning sections in the draft placement review dialog
- Simplification of redundant footer feedback text in both placement review dialogs
- Localization of `ConflictBadgeWithTooltip` to the single active pointer cell only

### Out of Scope

- Changes to generation logic, publish lifecycle gates, role permissions, or persisted source ownership
- Changes to the "After save" review sections (keeping as-is per stakeholder decision)
- Changes to the `ConflictBadgeWithTooltip` component itself (keeping the component, restricting where it renders)
- Changes to non-timetable pages
- Moderated older-user product validation (separate gate)

## Actors

| Actor | Description |
|-------|-------------|
| Scheduler Officer | Authenticated scheduling operator performing timetable placement and review |
| IT Admin | Authenticated platform admin with scheduler-equivalent access for testing |

## Requirements

### Functional Requirements

#### FR-01: Remove Textual Preview Labels from Grid Cells

- FR-01.1: When a placement source is active and the user hovers or drags over a cell, the system shall indicate cell state exclusively through ring and background color classes (e.g., `ring-red-500 bg-red-50/60` for blocked, `ring-amber-400 bg-amber-50/60` for warning, `ring-emerald-400 bg-emerald-50/60` for clean).
- FR-01.2: The system shall not render the `previewLabel` JSX element (the `<div>` containing "Blocked", "Warning", "Can swap", or "Can place" text) in grid cells during placement mode.
- FR-01.3: The system shall not render the `Occupied ({cellEntries.length})` badge in grid cells during placement mode.

#### FR-02: Remove DOM-Injected Pointer Preview Labels

- FR-02.1: Inside the `decoratePointerPreview` DOM effect in `TimetableGrid.tsx`, the system shall not create or prepend the textual `label` div element to cells (`label.dataset.pointerPreviewLabel = 'true'`).
- FR-02.2: The `decoratePointerPreview` effect shall continue to apply ring and background color classes to cells for visual state indication.
- FR-02.3: The `cleanupPointerPreview` function shall continue to remove any residual `[data-pointer-preview-label="true"]` elements for safety, even after the creation code is removed.

#### FR-03: Fix Dotted Borders on Soft-Warning Class Cards

- FR-03.1: When a class card has `severity === 'SOFT'`, the system shall render a solid amber border (e.g., `border-amber-400`) instead of `border-dashed`.
- FR-03.2: The system shall not apply `border-dashed` to any class card for soft violations.

#### FR-04: Consolidate Draft Placement Dialog Warnings

- FR-04.1: The draft placement review dialog shall consolidate the `confirmDisplacedPlacement` occupied-slot warning block and the main "Blocks" conflict check section into a single, unified "Blocks" `ReviewActionSection`.
- FR-04.2: The unified "Blocks" section shall display the occupied-slot swap prompt (if applicable) followed by the conflict check results (loading, error, success, or blocked states) within the same section.
- FR-04.3: The dialog shall not display two separate `ReviewActionSection` elements with the title "Blocks".

#### FR-05: Simplify Footer Feedback Text

- FR-05.1: The generated placement review dialog footer shall display a short, concise state indicator (e.g., "Ready to save", "Blocked: Fix issues", "Saving...") instead of the full paragraph message.
- FR-05.2: The draft placement review dialog footer shall display a short, concise state indicator matching the same pattern.
- FR-05.3: The footer feedback text shall not exceed 60 characters.
- FR-05.4: The footer feedback shall remain outside any scroll region in a `shrink-0` container.

#### FR-06: Localize ConflictBadgeWithTooltip to Active Cell

- FR-06.1: The `ConflictBadgeWithTooltip` shall render only on the single actively hovered/dragged cell, not globally across all evaluated cells.
- FR-06.2: If the badge currently renders on multiple cells simultaneously during drag, the system shall restrict it to the cell matching `activeDragCellState.cellId` only.

### Non-Functional Requirements

#### NFR-01: Visual Hierarchy

- NFR-01.1: The timetable grid in placing mode shall display no more than one text label per cell at any time (the existing "Current" badge for the source cell is acceptable).
- NFR-01.2: The total number of distinct visual indicators per cell during placement shall not exceed three (ring, background color, and one optional badge such as "Current").

#### NFR-02: Accessibility

- NFR-02.1: Removal of textual labels shall not reduce the `aria-label` quality on grid cells; screen reader labels shall continue to describe the cell state.
- NFR-02.2: Color-only state indication shall be supplemented by the `ConflictBadgeWithTooltip` on the active cell and by the existing `sr-only` status regions in modals.

#### NFR-03: Build Integrity

- NFR-03.1: All changes shall pass `npx tsc --noEmit` with zero errors.
- NFR-03.2: All changes shall pass `npm run build` with zero errors.

## Acceptance Criteria

| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Placing mode cell labels removed | No "Blocked", "Warning", "Can swap", or "Can place" text labels appear in grid cells during drag or keyboard placement |
| AC-02 | Occupied badge removed | No "Occupied (N)" text badge appears in grid cells during placement mode |
| AC-03 | DOM pointer preview labels removed | No `[data-pointer-preview-label]` elements are injected into cells by the `decoratePointerPreview` effect |
| AC-04 | Soft-warning borders solid | Class cards with `severity === 'SOFT'` display a solid amber border, not a dashed border |
| AC-05 | Draft dialog blocks consolidated | The draft placement review dialog shows exactly one "Blocks" section containing both occupied-slot and conflict-check information |
| AC-06 | Footer feedback concise | Both generated and draft placement dialog footers display feedback text of 60 characters or fewer |
| AC-07 | ConflictBadge localized | The `ConflictBadgeWithTooltip` renders only on the single active pointer cell, not on all evaluated cells |
| AC-08 | TypeScript clean | `npx tsc --noEmit` passes with zero errors |
| AC-09 | Build clean | `npm run build` passes with zero errors |
| AC-10 | Grid scannable | The timetable grid remains highly scannable and calm without alarm fatigue during placement mode |

## Open Questions

- [ ] None — all clarifying questions answered.

## Assumptions

- The `ConflictBadgeWithTooltip` component itself does not need modification; only its render location needs restriction.
- The `decoratePointerPreview` effect's ring/background styling logic is sufficient for cell state indication without textual labels.
- The "After save" sections in placement dialogs are not contributing to visual noise and shall remain unchanged.
- The existing `conflictSummary` and `conflictGuidance` helper functions remain available for reuse within the consolidated "Blocks" section.

## Dependencies

- `atlas-client/src/components/timetable/TimetableGrid.tsx` — primary grid component with cell rendering and DOM effects
- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx` — placement review dialogs
- `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx` — review action sheet/section components
- `atlas-client/src/components/timetable/TimetableGrid.constants.ts` — grid constants and helper functions

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-08-21 | atlas-uiux-expert | Initial draft |
