# Phase 4 Bundle A Verification Baseline

Date: 2026-03-31  
Owner: Planner/QC  
Scope: Teacher Load + Assignment UX/data controls (Bundle A)

## Objective

Document what is already implemented, what is partial, and what is missing before Claude executes Bundle A.

## Verified Implemented

- Teaching load computation surface exists (`actual`, `credited`, `overload`) in `atlas-client/src/pages/FacultyAssignments.tsx`.
- Faculty-subject assignment model and API exist:
  - `FacultySubject` with `gradeLevels` in `prisma/schema.prisma`
  - `PUT /api/v1/faculty-assignments/:facultyId` in `atlas-server/src/routes/faculty-assignment.router.ts`
  - business logic in `atlas-server/src/services/faculty-assignment.service.ts`
- TLE two-pass scheduling switch exists at policy/constructor level:
  - policy field in `prisma/schema.prisma`
  - ordering in `atlas-server/src/services/schedule-constructor.ts`
- Manual review surfaces exist (manual edits, unassigned list, room schedule overlays/pages):
  - `atlas-client/src/pages/ScheduleReview.tsx`
  - `atlas-client/src/components/ManualEditPanel.tsx`
  - `atlas-client/src/pages/RoomSchedules.tsx`
  - `atlas-client/src/components/RoomScheduleOverlay.tsx`

## Partial

- Qualified vs handled subject distinction is not explicit in UX:
  - assignment page currently uses one blended subject list (`atlas-client/src/pages/FacultyAssignments.tsx`)
- Faculty profile fields for load context are limited:
  - no explicit permanent/probationary or adviser-equivalent fields exposed in current client type (`atlas-client/src/types.ts`)
- Subject page has search/filter/table but no focused “who teaches G7-G10 + room allocation jump” flow:
  - `atlas-client/src/pages/Subjects.tsx`
- Grade display is inconsistent (`Grade 7`, numeric chips, etc.):
  - `atlas-client/src/pages/Sections.tsx`
  - `atlas-client/src/pages/Subjects.tsx`
  - `atlas-client/src/pages/ScheduleReview.tsx`

## Missing

- Global emergency control for out-of-department teaching assignment (default off), with explicit promotion behavior.
- Teacher drilldown that clearly shows subject -> room -> Gx-section context from one focused place.
- Map deep-link from subject-room allocation row (not just general map links).
- Bundle A capacity-aware generation validation remains missing (currently not blocked by room capacity in generator/validator path).

## Decisions Locked For Bundle A

- Weekly load semantics:
  - `30h` soft target baseline
  - `40h` hard ceiling
- Bundle order:
  - Start with Bundle A only (teacher load + assignment controls + drilldowns + grade label normalization).

## Out Of Scope For This Bundle

- Per-grade AM/PM shift windows
- Pre-generation session pinning/locking
- MWF/TTH scheduling template priority logic (Bundle B)

