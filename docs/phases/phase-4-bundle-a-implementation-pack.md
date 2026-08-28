# Phase 4 Bundle A Implementation Pack (For Claude)

Date: 2026-03-31  
Mode: Implementation handoff (planner-authored)  
Reference baseline: `docs/phases/phase-4-bundle-a-verification.md`

## Delivery Goal

Implement the teacher load and assignment control improvements while preserving current timetabling flows.

## Workstream A: Backend Faculty Profile And Assignment Semantics

### A1. Schema additions (`prisma/schema.prisma`)

Extend `FacultyMirror` with load-context fields:

- `employmentStatus` (`PERMANENT` or `PROBATIONARY` semantic string for now)
- `isClassAdviser` (boolean)
- `advisoryEquivalentHours` (int; default `0`, commonly `5`)
- `canTeachOutsideDepartment` (boolean; default `false`)

Add a migration with `ADD COLUMN IF NOT EXISTS` for safety in drifted local DBs.

### A2. Service mapping (`atlas-server/src/services/faculty.service.ts`)

- Sync/adapters must map new fields with safe defaults.
- `updateFacultyMirror()` must allow controlled updates for the four new fields.
- Keep optimistic locking (`version`) behavior unchanged.

### A3. Route contract (`atlas-server/src/routes/faculty.router.ts`)

- Accept/validate new patch payload fields.
- Return updated faculty object with new fields.

### A4. Assignment read model extension (`atlas-server/src/services/faculty-assignment.service.ts`)

- Include enough data in summary payload to support:
  - primary (qualified) subject list
  - non-primary/other subjects list
  - future teacher-side drilldown labels

## Workstream B: Teaching Load UX (Assignments Page)

Target file: `atlas-client/src/pages/FacultyAssignments.tsx`

### B1. Split lists

- Render two sections:
  - `Primary Subjects (Qualified)`
  - `Other Subjects (Outside Department)`

### B2. Emergency global toggle

- Add `Allow outside department (emergency)` control:
  - default OFF
  - when OFF: other subjects disabled for assignment
  - when ON: other-subject checkboxes enabled
- Promote selected “other subjects” into active/handled list visualization.

### B3. Search and clarity

- Add subject search input to reduce scan load.
- Keep compact rows but show:
  - subject code/name
  - weekly minutes/hours
  - grade scope labels using `Gx` format.

### B4. Load policy copy

- Keep tooltip legend for `Actual`, `Credited`, `Overload`.
- Copy must reflect:
  - `30h` soft target
  - `40h` hard cap.

## Workstream C: Faculty/Subject Drilldowns

### C1. Faculty page entrypoint

Target: `atlas-client/src/pages/Faculty.tsx`

- Add clear CTA/deeplink from faculty row/card to the teaching-load management context for that teacher.

### C2. Subject summary detail mode

Target: `atlas-client/src/pages/Subjects.tsx`

- Add summary/drilldown panel/table per selected subject:
  - who teaches it by grade (`G7–G10`)
  - room allocation references where available.
- Add room allocation map deeplink (`/map?buildingId=...` where possible).

## Workstream D: Grade Label Normalization

Introduce shared helper and apply to key pages:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/ScheduleReview.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`

Display standard: `G7`, `G8`, `G9`, `G10`.

## Order Of Execution

1. Schema + migration + server DTO/service wiring
2. Client type updates
3. Teaching Load UX (split + emergency toggle + search)
4. Faculty/Subject drilldowns and map deep-links
5. Grade label normalization pass
6. Typecheck and QA run

## Non-Negotiables

- Do not edit planner files in `.cursor/plans/*`
- Preserve strict MVC boundaries
- Keep `/api/v1/...` contracts and school/year scoping
- No regressions in `ScheduleReview` and existing manual-edit flows

