# Master Implementation Plan: Faculty Assignments UX & Auto-Fill (Phase 6)

## Overview
This phase builds upon the structural fixes of Phase 5 in requirements-phase5-faculty-assignment-fixes.md. It implements critical algorithmic safeguards to prevent program scope leaks (e.g., preventing STE subjects from being assigned to Regular sections) and enforces strict Tier 1 Aliasing to eliminate "Science favoritism" in the auto-fill queue. It introduces "Smart Grid" UX upgrades to the right panel, Command Center upgrades to the left panel, and overhauls the Auto-Fill feedback mechanism.

## Scope
### In Scope
- Backend fix to strictly evaluate program compatibility during auto-fill (`teaching-load-automation.service.ts`).
- Enforcing strict Tier 1 Aliasing for auto-fill to completely disable fuzzy/keyword (Tier 3) matching.
- Adding "Load Impact Preview" (ghosted progress bar extension) on section hover.
- Implementing Conflict Visibility (showing `[Assigned to Teacher A]` on unchecked boxes with "Swap" functionality).
- Adding `[Select All Eligible]` subject-level bulk actions.
- Adding Section Health Indicators (Green/Yellow dots for modular/cohort completion).
- Left panel Workforce Sorting (Load: Lowest to Highest / Highest to Lowest) and Grouping by Department.
- Interactive Staffing Report Drill-Down (expanding shortage metrics into detailed sub-lists).
- Suppressing excessive toast notifications after Auto-Fill and replacing them with a consolidated summary modal detailing concerns.
- Implementing the "disable and enable teaching outside of department" logic into the eligibility workflow.

### Out of Scope
- Altering the Timetable Generator logic downstream.

## Actors
| Actor | Description |
|-------|-------------|
| Scheduler | The administrator finalizing teaching loads and resolving staffing shortages. |

## Requirements

### [FR-01] Critical Algorithmic & Data Safeguards
- FR-01.1 (Program Scope Leak Fix): The backend `teaching-load-automation.service.ts` shall evaluate program compatibility strictly. A subject shall only be assigned to a section if `subject.programScopes.length === 0` or `subject.programScopes.includes(section.programType)`.
- FR-01.2: The frontend `FacultyAssignments.tsx` shall disable (not hide) checkboxes for incompatible sections and display a tooltip: *"Incompatible Program: Subject requires [X], Section is [Y]."*
- FR-01.3: Auto-Fill shall strictly enforce Tier 1 matching (concrete alias mapping). Tier 3 (fuzzy/keyword) matching is fully disabled in the auto-fill queue builder.
- FR-01.4: Auto-fill must properly iterate through every subject and every teacher equitably, removing any implicit favoritism for Science or specific subjects.
- FR-01.5: The system shall enforce the "enable/disable teaching outside of department" rule dynamically during eligibility checks.

### [FR-02] Smart Grid UX Upgrades (Right Panel)
- FR-02.1: Hovering over an unassigned section checkbox shall display a "ghosted" load extension on the teacher's main progress bar representing incoming minutes.
- FR-02.2: The ghost fill shall display in Yellow/Red if the assignment exceeds the warning threshold (1,800m) or hard cap (2,400m).
- FR-02.3: If a section is assigned to another teacher, a badge `[Assigned to Teacher Name]` shall appear next to the checkbox. Clicking it must trigger a "Swap" confirmation dialog.
- FR-02.4: A `[Select All Eligible]` button shall be placed next to each subject header to bulk-assign sections, stopping automatically at the workload cap.
- FR-02.5: Section names shall display a visual Health Indicator (🟢 Green dot for 100% assigned required teachers, 🟡 Yellow dot for partially assigned).

### [FR-03] Command Center Upgrades & Reporting
- FR-03.1: The Left Panel faculty list shall support visual grouping by Department via accordions.
- FR-03.2: The Left Panel shall feature a Sort Dropdown with: "Load: Lowest to Highest" and "Load: Highest to Lowest".
- FR-03.3: The system shall suppress individual toast notifications after an Auto-Fill run to prevent UI jitter.
- FR-03.4: The system shall present a unified "Staffing Shortage & Resolution Report" modal immediately post-generation containing all assignment results and warnings.
- FR-03.5: Shortage metrics in the report modal shall be interactive, allowing users to expand them into a detailed sub-list mapping exactly which sections are missing teachers.



## Verification & Documentation
- **Live Tailnet Testing:** The entire suite (Auto-Fill algorithm, Manual Swaps, Hover Previews) must be validated directly against the live EnrollPro data on the tailnet.
- **Algorithm Analysis:** All findings, edge cases, assignment distributions, and test results from the live tailnet run must be heavily documented in a separate markdown QA report. This data is critical for the continuous optimization of the algorithm's constraints and collision logic.

## Open Questions
- Are there specific override privileges required for the "teaching outside of department" rule, or is it a strict global setting?
- Should the "Staffing Shortage & Resolution Report" modal include recommendations for resolving shortages (e.g., "Consider enabling out-of-department teaching for [Teacher Name]")?
- Are there any additional sorting/grouping options desired for the Left Panel (e.g., filter by teachers with unassigned sections)?

1. Override Privileges for "Teaching Outside of Department"
Answer: It is a per-faculty override, not a global setting or a complex role-based privilege.

How it works: This is represented by a boolean flag (canTeachOutsideDepartment) on individual faculty profiles. The scheduling officer (the user of this page) has the authority to toggle this flag on a case-by-case basis.

PRD Update: Clarify that the rule is enforced at the individual faculty level. The UI should allow the scheduler to easily toggle this on a teacher's profile (or directly within the Resolution Modal) to bypass Tier 1 strictness for that specific teacher.

2. Recommendations in the "Staffing Shortage & Resolution Report"
Answer: Yes, absolutely. This is the critical feature that elevates the system from a "dumb calculator" to an "Intelligent Assistant."

How it works: As finalized in the "Resolution Hub" concept, the modal should not just state the missing hours. It must actively scan the rest of the faculty for spare capacity and present it as Strategy 1: Cross-Assignment.

PRD Update: Specify that the report must include actionable data (e.g., "Mathematics has 4 teachers with a combined 20 spare hours/week"). It should explicitly recommend enabling out-of-department teaching for these specific under-loaded candidates before defaulting to Strategy 2 (Requesting New Hires).

3. Additional Sorting/Grouping Options for the Left Panel
Answer: Yes, two specific additions will vastly improve the scheduler's workflow.

Option A: Filter by Load Status. Instead of just sorting, add quick-filter chips for [Overloaded] (>30 hours), [Optimal] (25-30 hours), and [Under-loaded] (<25 hours). This allows the scheduler to instantly isolate the faculty who have the capacity to take on more work.

Option B: Filter by "Action Required" (Unmapped Specialization). As noted in a previous audit, if a teacher's EnrollPro specialization string has no corresponding Tier 1 alias in ATLAS, the Auto-Fill algorithm completely ignores them. Adding a filter to surface teachers with "Unmapped Specializations" allows the admin to quickly find and fix these invisible teachers before running the generator.


## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Scope Enforcement | Auto-fill and manual assignment strictly block STE subjects from being assigned to Regular sections. |
| AC-02 | Strict Tier 1 | Auto-fill assigns teachers solely based on explicit Specialization Alias matches, iterating equitably without subject bias. |
| AC-03 | UX Feedback | Progress bar hover states, swap badges, and section health indicators display accurately based on live state. |
| AC-04 | Summary Modal | Clicking Auto-Fill triggers the global process and displays a consolidated summary modal with interactive shortage metrics instead of spamming toast notifications. |
| AC-05 | Workforce Sorting | Left panel successfully groups by department and accurately sorts by active load capacity. |
| AC-06 | Tailnet Verification & Complete Coverage | Running Auto-Fill on the live tailnet (`https://njgrm.buru-degree.ts.net`) results in all valid subjects/sections being assigned, with zero session overlaps and zero out-of-scope assignments. |

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-05-15 | [prd-architect] | Initial Master Implementation Plan for Phase 6 (Faculty Assignments UX & Auto-Fill). |
