# Requirements: Subjects Module Data & UI Sync

## Overview
This PRD outlines the synchronization of the Subjects Module to align with the newly implemented modular Science architecture and the school's "Uniform Daily Grid." It addresses live database legacy overlaps (deprecating redundant subjects, fixing time allocations) and implements critical frontend workflow enhancements in `SubjectFormModal.tsx` to support modular groupings, accurately track teaching load without grid inflation (via the `isSeedable` flag), and improve the UX for school administrators.

## Scope
### In Scope
- Updating database seed configurations (`seed.js`) to deactivate obsolete generic subjects (`SCI`, `ICT`, `RESEARCH_I`, `RESEARCH_II`, `RESEARCH_III`).
- Updating database seed configurations to correctly align core subject durations to 60-minute blocks (`ENG`, `MATH` to `240m`).
- Renaming `ESP` to `ESP/GMRC`.
- Modifying `HG` (Homeroom Guidance) to disable `isSeedable` while remaining active for teaching load credit.
- Refactoring `SubjectFormModal.tsx` into three distinct logical sections (Basic Identity, Grid & Time Constraints, Advanced Grouping).
- Adding UI controls for `modularGroupId`, `modularOrder`, and `isSeedable` in `SubjectFormModal.tsx`.
- Updating the duration quick-presets in the modal to match DepEd reality.
- Adding a visual indicator for modular subjects in the `Subjects.tsx` data table.

### Out of Scope
- Modifying the Timetable Generator logic (already handled in the Science Rotation PRD).
- Updating actual teaching load calculations (handled correctly by the existing engine).

## Actors
| Actor | Description |
|-------|-------------|
| Scheduler / Admin | User interacting with the Subjects table and modal to configure curriculum constraints and time allocations. |

## Requirements

### Functional Requirements

#### [FR-01] Seed Data Cleanup & Alignment
> [!IMPORTANT]
> **Prisma Upsert Logic:** When updating the seed script, the upsert logic *must* explicitly overwrite `minMinutesPerWeek`, `name`, `isActive`, and `isSeedable` in the `update` block. Skipping existing records will trap the database in the old 225-minute baseline.

- FR-01.1: The system's `seed.js` shall set `isActive: false` for the generic `SCI` subject.
- FR-01.2: The system's `seed.js` shall set `isActive: false` for `RESEARCH_I`, `RESEARCH_II`, `RESEARCH_III`, and `ICT`.
- FR-01.3: The system's `seed.js` shall set `isActive: false` for the old specialized TLE ICT subjects (`TLE_ICT_7` through `TLE_ICT_10`).
- FR-01.4: The system's `seed.js` shall set `isActive: false` for the individual SPA subjects (`DANCE`, `MUSIC`, `THEATER_ARTS`, `VISUAL_ARTS`, `CREATIVE_WRITING`).
- FR-01.5: The system's `seed.js` shall ensure the unified `SPA_SPEC` and `DEVL_READING` subjects are seeded as `isActive: true` with their correct program scopes.
- FR-01.6: The system's `seed.js` shall completely remove the National Reading Program (NRP) and National Math Program (NMP) configurations to adhere strictly to the uniform daily grid.
- FR-01.7: The system's `seed.js` shall update the `minMinutesPerWeek` for `ENG` and `MATH` to `240` minutes.
- FR-01.8: The system's `seed.js` shall rename `ESP` to `ESP/GMRC`.
- FR-01.9: The system's `seed.js` shall set `isSeedable: false` for `HG` (Homeroom Guidance) while keeping `isActive: true`.

#### [FR-02] UI Form Logical Grouping
- FR-02.1: The system shall logically group the inputs in `SubjectFormModal.tsx` into three distinct sections: "Basic Identity", "Grid & Time Constraints", and "Advanced Grouping".
- FR-02.2: The system shall locate "Code", "Name", "Active Status Toggle", "Grade Levels", "Program Scopes", and "Specialization Restriction" within the "Basic Identity" section, allowing admins to toggle subjects instead of deleting them.
- FR-02.3: The system shall locate "Duration", "Session Pattern", "Preferred Room Type", "Required Room Features", and the "Auto-Schedule to Grid" (`isSeedable`) toggle within the "Grid & Time Constraints" section.
- FR-02.4: The system shall locate "Inter-Section Scheduling" and "Modular Subject Configuration" within the "Advanced Grouping" section.
- FR-02.5: The system shall rename the "Inter-Section Scheduling" label to "Enable TLE / Cohort Splitting".

#### [FR-03] Modular Subject Controls
- FR-03.1: The system shall display a "Modular Subject" toggle in the "Advanced Grouping" section.
- FR-03.2: If the "Modular Subject" toggle is enabled, then the system shall reveal a text input for `modularGroupId` and a numeric input for `modularOrder`.
- FR-03.3: When saving a subject, the system shall include `modularGroupId` and `modularOrder` in the API payload.

#### [FR-04] Grid & Time Constraint Controls
- FR-04.1: The system shall update the Duration quick-preset buttons to display `[45m, 60m, 200m, 240m]`.
- FR-04.2: The system shall display an "Auto-Schedule to Grid" toggle bound to the `isSeedable` property.
- FR-04.3: The system shall display a tooltip next to the "Auto-Schedule to Grid" toggle explaining: *"Turn off for subjects like Homeroom Guidance that count toward teacher load but do not require physical grid placement."*

#### [FR-05] Subject Table Enhancements
- FR-05.1: The system shall display a visual indicator (e.g., a puzzle piece icon or "Modular" badge) next to the subject name in the data table for any subject where `modularGroupId` is not null.

### Non-Functional Requirements

#### [NFR-01] Usability
- NFR-01.1: The modal sections shall use visual dividers, cards, or accordions to prevent vertical scroll fatigue and logically separate concerns.

## Acceptance Criteria
| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Seed Verification | `npm run db:seed` runs successfully, overwriting previous records. `SCI`, `ICT`, `RESEARCH_I-III`, old TLE ICT subjects, and individual SPA arts are inactive. `SPA_SPEC` and `DEVL_READING` are active. `HG` is active but `isSeedable: false`. NRP and NMP are completely absent from the database. |
| AC-02 | Modal Layout | Opening the Add Subject modal displays three clearly defined sections (Basic Identity, Grid & Time Constraints, Advanced Grouping). |
| AC-03 | Duration Presets | Clicking the `60m` and `240m` presets correctly updates the duration input field without throwing errors. |
| AC-04 | Modular Toggle | Toggling "Modular Subject" ON reveals the `modularGroupId` and `modularOrder` inputs; toggling OFF hides them. |
| AC-05 | Grid Toggle Tooltip | Hovering over the "Auto-Schedule to Grid" toggle displays the correct helper text regarding teacher load vs. grid placement. |
| AC-06 | Table Indicator | Viewing the Subjects table shows a puzzle piece or "Modular" badge next to `SCI_BIO` but not `ENG`. |
| AC-07 | Live Sync Verification | Executing a `GET` request to the public endpoint (`https://njgrm.buru-degree.ts.net/api/v1/subjects`) returns the updated active/inactive states and accurate duration allocations, proving changes pushed to the tailscale environment. |

## Open Questions
- [ ] None. Implementation can proceed immediately.

## Assumptions
- The backend API (`PATCH /api/v1/subjects/:id` and `POST /api/v1/subjects`) already supports receiving `isSeedable`, `modularGroupId`, and `modularOrder` safely based on previous schema migrations.

## Dependencies
- Must run the updated `seed.js` script to clean up legacy live data and avoid Timetable Generation collisions.

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2026-05-13 | [prd-architect] | Initial PRD draft for Subjects UI refactor and Seed Synchronization. |
