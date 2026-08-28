# A.T.L.A.S. UI/UX and Terminology Audit Report

This report catalogs UX/UI improvement opportunities, layout consistency audits, and DepEd/MATATAG terminology compliance findings across all operator-facing and teacher-facing pages in the system.

---

## 1. Executive Summary

A comprehensive page-by-page review was conducted to evaluate:
1. **DepEd Terminology Alignment**: Enforcing "Teachers" instead of "Faculty", "Teaching Load" instead of "Assignments", and "GR7, GR8, GR9, GR10" instead of "G7, G8, G9, G10".
2. **Specialization-Tier Theory Abstraction**: Hiding complex "Tier 1/2/3" jargon from operators to align with the department-first qualification baseline.
3. **UI/UX Consistency & Layout Limits**: Ensuring no-scroll architecture compliance (`h-[calc(100svh-3.5rem)]` root, scrolling main body), preventing badge/color spam, and verifying standard `@/ui/*` input controls.

---

## 2. Terminology & Concept Compliance Audit

### A. "Teachers" vs. "Faculty" (User-Facing Roster)
- **Status**: The sidebar navigation and page headers use "Teachers" correctly.
- **Findings**:
  - Four teacher portal pages still use `eyebrow="Faculty"` or `eyebrow='Faculty'` instead of `"Teacher"`:
    - [MySchedule.tsx](file:///d:/ATLAS/atlas-client/src/pages/MySchedule.tsx#L296)
    - [MyDashboard.tsx](file:///d:/ATLAS/atlas-client/src/pages/MyDashboard.tsx#L243)
    - [FacultyRoomPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/FacultyRoomPreferences.tsx#L821)
    - [FacultyPreferences.tsx](file:///d:/ATLAS/atlas-client/src/pages/FacultyPreferences.tsx#L393)
  - **Action**: Replace `eyebrow="Faculty"` with `eyebrow="Teacher"` in these files.

### B. "Teaching Load" vs. "Assignments"
- **Status**: Route paths use `/teaching-load` correctly.
- **Findings**:
  - [TeachingLoad.tsx](file:///d:/ATLAS/atlas-client/src/pages/TeachingLoad.tsx) contains legacy user-facing alerts and success messages referring to "assignments" rather than "teaching load":
    - Line 204: `"Failed to save assignments."` -> should be `"Failed to save teaching load."`
    - Line 206: `"Failed to save assignments."` -> should be `"Failed to save teaching load."`
    - Line 312: `"All assignments for the current school year have been cleared."` -> should be `"All teaching loads for the current school year have been cleared."`
  - **Action**: Correct these user-facing strings.

### C. "GR7-10" vs. "G7-10" Grade Representation
- **Status**: Several files display grades as "G7" or "Grade 7" instead of "GR7".
- **Findings**:
  - [grade-labels.ts](file:///d:/ATLAS/atlas-client/src/lib/grade-labels.ts#L7-L9): The standard `gradeLabel` helper returns `"G" + grade` (e.g. `G7`, `G8`, etc.), which propagates throughout tables, badges, and filters.
  - [LeftRailContent.tsx](file:///d:/ATLAS/atlas-client/src/components/timetable/LeftRailContent.tsx#L239-L242): Select items for the pins filter explicitly list `G7`, `G8`, `G9`, and `G10`.
  - [AssignmentWorkspace.tsx](file:///d:/ATLAS/atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx#L156-L159): Select items explicitly list `Grade 7` to `Grade 10`.
  - **Action**: Refactor `gradeLabel` to return `"GR" + grade` and update static select values to keep visual consistency.

### D. Specialization-Tier Theory Abstraction
- **Status**: Specialization mapping has been successfully demoted from the main setup menu.
- **Findings**:
  - [ManualEditPanel.tsx](file:///d:/ATLAS/atlas-client/src/components/ManualEditPanel.tsx#L304-L307) and [ManualEditPanel.tsx](file:///d:/ATLAS/atlas-client/src/components/ManualEditPanel.tsx#L784-L787): The UI lists "Tier 1: Perfect", "Tier 2: Structural", and "Tier 3: Suggestion / Suggestion" when selecting eligible teachers for swap/placements. Exposing these tiers directly to operators forces them to reason about internal classification mechanics.
  - **Action**: Rename these labels to be simple and department-first:
    - Tier 1 & 2 -> **"Qualified (Department)"** or **"Department Match"**
    - Tier 3 -> **"Cross-Dept Match"** or **"Secondary Match"**
    - None -> **"Unqualified"**

---

## 3. Page-by-Page Audit Findings

### Page 1: Dashboard (`Dashboard.tsx`)
- **UX/UI Check**: Clean layout, no global scrollbars. The recently refactored `CampusReadinessCard` handles interactive canvas rendering beautifully.
- **Completeness**: Stats are live and correctly aggregate readiness percentages.

### Page 2: Subjects Page (`Subjects.tsx`)
- **UX/UI Check**: Layout uses `AdminWorkspaceFrame` and has proper filters. Inputs are correctly standardized via `@/ui/*` primitives.
- **Terminology**: Correctly uses "Teachers" and "Teaching Load" in links and references.

### Page 3: Sections & Home Rooms (`Sections.tsx`)
- **UX/UI Check**: Nice building occupancy percentages and home-room picker. Fits standard tailwind styling.
- **Terminology**: Grade level filters currently show "Grade 7", etc. Recommend changing to "GR7", etc.

### Page 4: Teachers Page (`Faculty.tsx`)
- **UX/UI Check**: Roster stats are clear. Filters allow drilling by load and scheduling state.
- **Terminology**: Roster statistics currently label "With teaching load" and "No teaching load" correctly. The main table uses "Teacher" column headers.

### Page 5: Teaching Load Page (`TeachingLoad.tsx`)
- **UX/UI Check**: Left list shows teacher names and load percentages. Clicking a teacher displays qualified and cross-department subjects.
- **Completeness**: Remaining capacity is calculated dynamically.

### Page 6: Campus & Rooms (`CampusMapOverview.tsx`)
- **UX/UI Check**: Shared the same drilldown layout as `CampusReadinessCard`, resolving the cramped room grid display.
- **Correctness**: Fully aligned with the no-scroll viewport limits.

### Page 7: Timetable / Review Workspace (`ScheduleReviewWorkspace.tsx`)
- **UX/UI Check**: Responsiveness is excellent since the review workspace states were refactored into a custom hook. Cell tooltips were removed to prevent grid clutter.
- **Terminology**: Left rail tabs use "Unassigned" and "Violations" correctly.
- **Completeness**: Pinned entries are highlighted correctly.

### Page 8: Compliance & Audit Page (`Audit.tsx`)
- **UX/UI Check**: The compliance dashboard lists findings for sections, rooms, and teachers clearly. Clicking a finding correctly routes to the repair workspace.

### Page 9: Teacher Portal Portal (`MyDashboard.tsx` / `MySchedule.tsx` / `FacultyPreferences.tsx` / `FacultyRoomPreferences.tsx`)
- **Terminology**: Standardized eyebrows currently show "Faculty" which must be replaced with "Teacher".

---

## 4. Immediate Action Plan

To resolve all identified terminology and correctness issues:
1. **Update Roster Helpers**: Refactor `gradeLabel` in `grade-labels.ts` to output `GR7` - `GR10`.
2. **Update Dropdown Labels**: Replace static `G7-G10` / `Grade 7-10` options in `LeftRailContent.tsx` and `AssignmentWorkspace.tsx` with unified `GR7` - `GR10` labels.
3. **Abstract Tiers**: Rename the tier labels in `ManualEditPanel.tsx` to "Department Match", "Secondary Match", and "Unqualified".
4. **Clean terminology**: Replace `eyebrow="Faculty"` with `eyebrow="Teacher"` in teacher portal pages.
5. **Adjust message strings**: Correct "assignments" to "teaching load" in the save and reset toast notifications of `TeachingLoad.tsx`.
