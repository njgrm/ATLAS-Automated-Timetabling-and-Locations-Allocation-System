# Requirements: Faculty Assignments UX & Specialization Fixes
## Overview
This document outlines the required fixes to stabilize the Faculty Assignments (Teaching Load) module. It addresses the disconnect in specialization alias matching, clarifies the Auto-Fill functionality globally, cleans up misleading statistics (like HG assignments inflating the assigned counter), and standardizes the dropdown filters in the left panel.
## Scope
### In Scope
- Correcting `getQualificationTier` usage to strictly rely on the `specialization_aliases` source of truth.
- Refactoring the "Assigned" metric counter to exclude baseline advisory assignments.
- Moving the "Auto-Fill Remaining" button to a global scope and providing explicit execution feedback.
- Restructuring the left panel filters to accurately distinguish between Departments and Specializations, converting them to searchable comboboxes.
- UI cleanup: Removing the redundant adviser banner, fixing the "System Assigned" badge overflow, and appending the advised section directly to the right panel header.
### Out of Scope
- Altering the backend Auto-Fill optimization algorithm (handled in the automation service).
- Updating the specialization mappings page itself.
## Actors
| Actor | Description |
|-------|-------------|
| Scheduler | The administrator mapping subjects to faculty based on strict alias rules. |
## Requirements
### Functional Requirements
#### [FR-01] Strict Specialization Matching (Single Source of Truth)
- FR-01.1: The `FacultyAssignments` page shall fetch the global `specialization_aliases` catalog on mount.
- FR-01.2: The page shall pass the fetched aliases into `getQualificationTier()`.
- FR-01.3: The system shall remove "Smart Match" (Tier 2) and "Fuzzy Match" (Tier 3) suggestions from the UI. A subject is only eligible for a teacher if there is a concrete Tier 1 match in the alias catalog or if the subject explicitly requires no specialization.
#### [FR-02] Global Auto-Fill Execution & Feedback
- FR-02.1: The "Auto-Fill Remaining" button shall be relocated from the individual teacher's right-side panel to a global location (e.g., the main page header or left panel header).
- FR-02.2: Upon clicking "Auto-Fill Remaining" and receiving a successful response from the backend, the system shall display an explicit summary toast or modal detailing: "Assigned [X] subjects across [Y] teachers."
#### [FR-03] Accurate Assignment Metrics
- FR-03.1: The global "[X] / [Y] assigned" metric shall not count system-assigned Homeroom Guidance (HG) maps as part of the denominator or numerator. It must strictly reflect the percentage of *teachable academic subject-sections* that have been assigned a teacher.
#### [FR-04] Filter Combobox Refactor (Left Panel)
- FR-04.1: The current "All Specializations" dropdown shall be renamed to "All Departments", as it currently holds department values.
- FR-04.2: A new "All Specializations" dropdown shall be added to the right of the Department dropdown.
- FR-04.3: The "All Specializations" dropdown options shall dynamically filter based on the currently selected Department.
- FR-04.4: Both dropdowns shall be converted into searchable comboboxes (matching the interaction pattern used in the Timetabling page).
#### [FR-05] UI & Advisory Header Cleanup
- FR-05.1: The "System Assigned" badge on subject rows shall be visually adjusted (e.g., layout wrapping or truncation) so it does not block or overlap the section name.
- FR-05.2: The large "Adviser Mapping" banner shall be completely removed from the right panel.
- FR-05.3: The right panel header shall display the advised section next to the teacher's badge in the format: `[Adviser Badge] of G[Grade Level] - [Section Name]`.
- FR-05.4: The system shall ensure the grade level is successfully fetched from the EnrollPro section schema to support FR-05.3.
#### [FR-06] State Management & History (Undo/Redo)
- FR-06.1: The system shall provide "Undo" and "Redo" buttons to revert or re-apply manual and auto-fill teaching load assignments.
- FR-06.2: The system shall support keyboard shortcuts `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo) for state history navigation.
- FR-06.3: The system shall provide a "Reset Assignments" button that clears all mutable teaching load assignments.
- FR-06.4: The system's state management (Undo, Redo, and Reset) shall strictly ignore and preserve all Homeroom Guidance (HG) advisory records. They must not be affected by history traversal or mass deletion.
## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Tier 1 Strictness | A Math teacher is only suggested for Math subjects if a concrete alias exists. No fuzzy keyword matches are displayed as eligible. |
| AC-02 | Global Auto-Fill | The Auto-Fill button is globally accessible and displays a summary of assigned subjects/teachers upon completion. |
| AC-03 | Metric Accuracy | The Assigned counter excludes system-assigned HG advisory records from its calculation. |
| AC-04 | Dual Comboboxes | The left panel features searchable "Department" and "Specialization" comboboxes, with the latter filtered by the former. |
| AC-05 | Header Display | An adviser's panel explicitly reads "Adviser of G8 - Rizal" in the header without the presence of the old advisory banner. |
| AC-06 | Live Tailnet Testing & Complete Coverage | The auto-fill algorithm must be tested against the live tailnet environment (`https://njgrm.buru-degree.ts.net`). The test passes if, post-run, **all** required subjects have a faculty assigned, **all** faculty members have a subject assigned, and **no** session is left unchecked without overlapping/colliding faculty assignments in the UI. |

## Verification & Documentation
- **Algorithm Analysis:** All findings, edge cases, and test results from the Auto-Fill live tailnet run must be heavily documented in a separate markdown artifact or QA report. This data is critical for continuous optimization of the algorithm's constraints and collision logic.
## Open Questions
- [ ] Are there any subjects outside of HG that should be excluded from the global `[X] / [Y] assigned` metric?
## Dependencies
- Backend must return grade levels natively within the `section` objects in the faculty summary payload.
- Backend Auto-Fill endpoint must return a structured summary of `assignmentsCreated` and `uniqueTeachersAffected`.
## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-05-14 | [prd-architect] | Initial PRD for Faculty Assignments UX and Alias strictness fixes. |
