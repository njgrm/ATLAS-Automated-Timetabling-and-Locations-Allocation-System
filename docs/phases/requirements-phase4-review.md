# Requirements: Phase 4 Review Console Action Workflows

## Overview
This specification details the functional rules and workflows for interacting with the Phase 4 Review & Manual Adjustment Console. It defines how a scheduling officer triggers timetable generation, publishes valid drafts, handles manual edits during regeneration, and pivots the timetable grid for better conflict resolution.

## Scope
### In Scope
- Generation run triggers via the default algorithm.
- Publish block-rules regarding Hard and Soft violations.
- Discard confirmation handling when re-generating over unsaved edits.
- Grid pivot view toggles (Section, Faculty, Room) with persistent state.
- Server-side stored follow-up flags for schedule review.
- Triage views for unassigned/backlog schedule entries.

### Out of Scope
- Configurable "advanced generation options" modal [v2 / Phase 4.5].
- Pinning or locking specific classes across generation runs [v2].

## Actors
| Actor | Description |
|-------|-------------|
| Scheduling Officer | Authenticated Admin who generates, reviews, edits, and publishes the timetable. |

## Requirements

### Functional Requirements

#### [FR-01] Timetable Generation Trigger
- FR-01.1: When the officer clicks "Generate New Timetable", the system shall display a confirmation dialog.
- FR-01.2: If the officer confirms generation, then the system shall asynchronously trigger the default scheduling algorithm without an advanced options modal.
- FR-01.3: While the algorithm is running, the system shall show a non-blocking progress state.
- FR-01.4: The system shall create an entirely new run upon every confirmed generation, rather than silently overwriting the currently reviewed draft.

#### [FR-02] Generation with Unsaved Edits
- FR-02.1: If there are unsaved manual edits locally and the officer clicks "Generate New Timetable", then the system shall display a specific modal warning that current draft edits will be discarded.
- FR-02.2: If the officer selects "Cancel" on the generation discard modal, then the system shall abort the generation request and preserve the manual edits.

#### [FR-03] Publishing Rules
- FR-03.1: If the currently selected run contains any "HARD" severity violations, then the system shall restrict access to the "Publish" action entirely.
- FR-03.2: If the currently selected run contains NO "HARD" severity violations but contains "SOFT" severity violations, then the system shall display a warning summary of the soft violations and require an explicit officer acknowledgment checkbox before allowing the publish action.
- FR-03.3: When a run with zero hard violations is published, the system shall finalize the schedule and broadcast it to public/faculty views.

#### [FR-04] Grid Pivot Views
- FR-04.1: The system shall provide an in-page view toggle allowing the officer to pivot the timetable grid by Section, Faculty, or Room within the same route workspace.
- FR-04.2: When the grid pivot is changed, the system shall preserve the currently selected run, violation filters, and highlighted entries.
- FR-04.3: When a user switches view pivot modes (e.g., from Section to Faculty), the system shall automatically select the first alphabetically sorted entity in that mode, rather than displaying an empty grid.

#### [FR-05] Unassigned Backlog Panel
- FR-05.1: The system shall provide a left-hand panel toggle bridging between "Violations" and "Unassigned" classes.
- FR-05.2: The Unassigned panel shall display a list of all schedule demands (classes) that the generation algorithm failed to place, organized by Subject and Section.

#### [FR-06] Collaborative Triage (Follow-Up Flags)
- FR-06.1: The system shall persist "Mark for Follow-up" flags server-side, scoped to the specific `runId` and `entryId`.
- FR-06.2: Flags must track the `flaggedBy` user ID and `flaggedAt` timestamp to enable multiple officers to collaborate on draft review.

### Non-Functional Requirements

#### [NFR-01] Performance
- NFR-01.1: The system shall pivot the grid view (re-render from Section to Faculty/Room) within 200ms without requesting new core data from the backend.

## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Generate triggers correctly | Clicking "Generate" -> "Confirm" hits the generation endpoint and updates the run list. |
| AC-02 | Unsaved edit guard | Attempting to generate while `isDirty` is true prompts the "discard current draft edits" modal. |
| AC-03 | Hard block publish | A run with 1 Hard violation has a permanently disabled "Publish" button. |
| AC-04 | Soft warn publish | A run with only Soft violations requires clicking "I acknowledge these warnings" before the Publish button enables. |
| AC-05 | Grid switch | Toggling from "Section" to "Faculty" instantly remaps the grid rows to represent the selected teacher. |

## Open Questions
- [ ] Will large datasets cause performance drops if filtering the entire draft payload client-side for the Faculty/Room pivots?

## Assumptions
- The draft API `/runs/latest/draft` returns sufficient metadata (facultyId, roomId, sectionId) mapped to each entry to allow client-side grid pivoting.

## Dependencies
- Phase 3 Algorithm triggers (Existing backend `POST /api/v1/generation/...`)

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-04-02 | atlas-uiux-expert | Initial draft based on clarifying questions. |
