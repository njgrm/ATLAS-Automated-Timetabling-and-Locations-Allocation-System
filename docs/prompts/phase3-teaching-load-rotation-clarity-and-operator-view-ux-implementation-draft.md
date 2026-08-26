# Implementation Draft: Phase 3 Teaching Load Rotation Clarity and Operator View UX

This document details the plan for the final scheduler-facing clarity layer of the `Teaching Load` (Faculty Assignments) workspace.

## Objectives
1.  **Rotation Family Clarity**: Make `SCIENCE` and `TLE_ROTATION` behavior understandable for schedulers.
2.  **Operator View Separation**: Split the workspace into focused views for Shortage, Utilization, and Redistribution.
3.  **Compact Workspace**: Recover vertical space and increase density for high-throughput manual scheduling.
4.  **Improved Manual Preview**: Provide immediate feedback on the impact of assigning rotational family subjects.

## Component Architecture Changes

### 1. `OverviewHeader.tsx` (Dual Truth Header)
- **Visual Separation**: Clearly distinguish between **Contract Completeness** (number of rows owned) and **Weekly Shortage** (hours/hires needed).
- **Consolidated Actions**: Group `Staffing Audit`, `Auto-Fill`, and a new `View Mode` selector.

### 2. `FacultyAssignments.tsx` (Workspace Orchestration)
- **Workspace Tabs**: Introduce a top-level `Tabs` component within the subject assignments container to switch between:
    - **Assignments** (The main work view).
    - **Shortage View** (Focused on subjects with unassigned sections).
    - **Utilization View** (Focused on teachers with spare capacity).
    - **Redistribution View** (Focused on special-program assignments).
- **Compressed Identity Bar**:
    - Slim down the teacher header.
    - Move `Rotation Family` details from a blue persistent panel/popover into a compact inline summary with a secondary expansion for deep math.
- **Operator Split Logic**:
    - Use existing `subjects` and `sectionSummary` to derive the shortage view.
    - Use `faculty` load percentages for the utilization view.
    - Filter subjects by program type for the redistribution view.

### 3. `SubjectRow.tsx` (Denser Assignments)
- **Cell Density**: Replace the current card grid with a denser, more list-like layout to fit more sections per viewport.
- **Rotation Cues**: Add small, consistent cues for subjects belonging to rotation families (e.g., a "Rotation" badge or specific border styling).
- **Enhanced Hover Preview**: Update the hover effect to show:
    - Raw hours impact.
    - Adjusted weekly impact (if it collapses into a family lane).
    - Family lane affected (e.g., "Science Lane").

### 4. `AutoFillSummaryModal.tsx` (Staffing Audit)
- **Mojibake Fix**: Clean up encoding artifacts (e.g., `Ã‚Â·`).
- **Reframed Content**: Lead with actionable decisions (What can be fixed now vs. what requires hiring).

## Implementation Detail: Rotation Clarity Language
- Use plain language:
    - Instead of "Rotation Overcount Adjustment", use **"Shared Weekly Lane"** or **"Rotational Adjustment"**.
    - Cues: **"Owned this term"**, **"Counts within Science rotation"**.

## Verification Plan
1.  **Build Verification**: Run `npm run build` in `atlas-client`.
2.  **Layout Check**: Ensure no-scroll architecture is preserved and vertical space is recovered.
3.  **UX Review**: Verify that `SCIENCE` and `TLE` behavior is clearer and that the operator views are distinct.

## GO Condition
- `SCIENCE` and `TLE_ROTATION` are easier for schedulers to interpret.
- Shortage, underutilization, and redistributable ownership are visually separated.
- Compact workspace is preserved.
- Page remains readable and no-scroll-safe.
