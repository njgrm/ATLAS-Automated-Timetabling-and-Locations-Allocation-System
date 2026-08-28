# Requirements: Modular Science Rotation

## Overview
This feature resolves the "Catch-22" scheduling conflict involving modular subjects like JHS Science, where teachers rotate by quarter but the subject demands a single unified time block. The system will support distinct modular subjects for accurate teaching load calculations while merging them during timetable generation to prevent grid inflation and double-booking errors.

## Scope
### In Scope
- Adding `modularGroupId` and `modularOrder` fields to the `Subject` database model.
- Seeding 4 distinct modular Science subjects (`SCI_BIO`, `SCI_CHEM`, `SCI_ES`, `SCI_PHYS`) for JHS.
- Merging demand items in the Timetable Generator based on `modularGroupId`.
- Modifying the Timetable Generator output to assign the primary `facultyId` to `null` and attach a structured `metadata.modularAssignments` array.
- Flagging incomplete modular assignments as "Lacking Faculty" warnings rather than hard generation blockers.

### Out of Scope
- Frontend UI modifications for rendering the `modularAssignments` array on the Timetable Grid (this PRD is for backend/generation logic only).
- Migrating the `SessionPattern` enum.
- Re-calculating existing teaching load standard constraints (the UI correctly handles min-by-min calculations via DO 005 s.2024).

## Actors
| Actor | Description |
|-------|-------------|
| Scheduler | Authenticated officer mapping teachers to modular subjects in the Teaching Load UI and generating schedules. |
| Timetable Generator | Background service compiling teaching load into schedulable demand items. |

## Requirements

### Functional Requirements

#### [FR-01] Database Architecture
- FR-01.1: The system shall support optional `modularGroupId` (String) and `modularOrder` (Int) fields on the `Subject` model.

#### [FR-02] Demand Aggregation
- FR-02.1: When the Timetable Generator compiles demand, the system shall group all subjects sharing the same `modularGroupId` for a specific section into a single unified Demand Item.
- FR-02.2: The system shall calculate the required minutes for the unified Demand Item by taking the maximum `minMinutesPerWeek` among the merged modular subjects.
- FR-02.3: The unified Demand Item shall inherit its `preferredRoomType` from the underlying modular subjects (which must be identical).
- FR-02.4: The unified Demand Item shall use the `modularGroupId` (e.g., "SCIENCE") as its primary `subjectCode` for grid placement purposes.

#### [FR-03] Generation Output
- FR-03.1: When outputting a ScheduledEntry for a unified modular Demand Item, the system shall set the primary `facultyId` and `facultyName` fields to `null`.
- FR-03.2: When outputting a ScheduledEntry for a unified modular Demand Item, the system shall attach a `modularAssignments` array within the entry's `metadata` object.
- FR-03.3: The system shall format each item in the `modularAssignments` array with the schema `{ quarter: Int, facultyId: Int, subjectCode: String }`, mapped sequentially based on the `modularOrder` of each subject.

#### [FR-04] Incomplete Modular Assignments
- FR-04.1: If a unified modular Demand Item is missing faculty assignments for one or more quarters, then the system shall generate the timetable entry anyway.
- FR-04.2: If a unified modular Demand Item is missing faculty assignments, then the system shall append a "Lacking Faculty" warning flag for the missing quarters to the generation run's violation summary.
- FR-04.3: If a unified modular Demand Item detects fewer subjects grouped than expected (e.g., only 3 modules found for a group that expects 4), the generator shall proceed but append an "Incomplete Modular Group" warning to the violation summary.

#### [FR-05] Seed Data Standardization & Corrections
- FR-05.1: The system's `seed.js` shall remove all hardcoded specialized `TLE_ICT_7` through `10` subjects, relying solely on generic `TLE` combined with `InstructionalCohort` logic.
- FR-05.2: The system's `seed.js` shall remove individualized SPA subjects (`DANCE`, `MUSIC`, etc.) and replace them with a unified `SPA_SPEC` subject.
- FR-05.3: The system's `seed.js` shall update core subject minutes from `225` to `240` (to support 60-minute blocks for regular BEC sections) and update Homeroom Guidance to `60` minutes.
- FR-05.4: The system's `seed.js` shall condense `RESEARCH_I` through `IV` into a single `STE_RESEARCH` subject mapped to grade levels `[7, 8, 9, 10]`.
- FR-05.5: The system's `seed.js` shall inject `NRP` (National Reading Program) and `NMP` (National Mathematics Program) at 50 mins/week with a `FRIDAY_ONLY` session pattern.
- FR-05.6: The system's `seed.js` shall rename `ESP` to `ESP/GMRC` and add `DEVL_READING` (Developmental Reading) for STE and SPA scopes.

### Non-Functional Requirements

#### [NFR-01] Performance
- NFR-01.1: The system shall execute demand aggregation without increasing overall timetable generation time by more than 5%.

## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Seed Integrity | Running `npm run db:seed` successfully creates `SCI_BIO`, `SCI_CHEM`, `SCI_ES`, and `SCI_PHYS` with their respective `modularGroupId` and `modularOrder`. |
| AC-02 | Teaching Load UI | Assigning 4 different EnrollPro-synced faculty members to the 4 Science modules for a live EnrollPro-synced section calculates load correctly and saves without a `SubjectSectionOwnership` collision. |
| AC-03 | Grid Generation | Generating a schedule for a live EnrollPro-synced section produces exactly one 225-minute (or 240-minute) block for Science, not four blocks. |
| AC-04 | JSON Payload | The resulting `ScheduledEntry` JSON contains `facultyId: null` and a populated `metadata.modularAssignments` array containing the 4 teachers. |
| AC-05 | Missing Faculty Fallback | Generating a schedule with only 2 of the 4 Science modules assigned successfully generates the grid and produces a soft warning for the unassigned modules. |

## Open Questions
- [ ] None. All implementation details confirmed based on DepEd DO 005 s.2024 and architectural decisions.

## Assumptions
- The React frontend will gracefully ignore `facultyId: null` for modular entries until Phase 5 UI work is implemented.
- The JHS MATATAG curriculum explicitly allows 45-minute or 60-minute blocks, summing accurately to `minMinutesPerWeek`.

## Dependencies
- Prisma schema migrations to add `modularGroupId` and `modularOrder` to the `Subject` model.

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-05-13 | [prd-architect] | Initial requirements draft after architectural decisions |
