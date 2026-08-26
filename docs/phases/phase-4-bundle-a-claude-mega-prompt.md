# Claude Mega Prompt — Phase 4 Bundle A

Implement Bundle A exactly as specified below.  
Do not edit `.cursor/plans/*` files.  
Follow strict MVC and existing `/api/v1` conventions.

## Context

- Verification baseline: `docs/phases/phase-4-bundle-a-verification.md`
- Implementation pack: `docs/phases/phase-4-bundle-a-implementation-pack.md`
- Policy baseline: `30h` soft target, `40h` hard cap

## Required Changes

### 1) Backend: Faculty profile fields for load context

Update:

- `prisma/schema.prisma`
- new migration under `prisma/migrations/*`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/faculty-adapter.ts`
- `atlas-server/src/routes/faculty.router.ts`

Implement:

- Add `FacultyMirror` fields:
  - `employmentStatus` (default `PERMANENT`)
  - `isClassAdviser` (default `false`)
  - `advisoryEquivalentHours` (default `0`)
  - `canTeachOutsideDepartment` (default `false`)
- Ensure sync/update routes map and persist these fields.
- Keep optimistic locking behavior untouched.

### 2) Teaching Load UX split + emergency control

Target:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/types.ts`

Implement:

- Split subject assignment UI into:
  - `Primary Subjects (Qualified)`
  - `Other Subjects (Outside Department)`
- Add global checkbox:
  - label: `Allow outside department (emergency)`
  - default OFF
  - when OFF: other-subject checkboxes disabled
  - when ON: other-subject checkboxes enabled
- Add subject search input in assignment area.
- Show clearer rows (code/name + duration + grade scope).
- Grade labels must render as `G7`, `G8`, `G9`, `G10`.

### 3) Faculty and Subject drilldowns

Update:

- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Subjects.tsx`

Implement:

- Faculty page: add a clear entrypoint/deeplink into teaching-load details for a selected teacher.
- Subjects page: add per-subject summary/drilldown showing:
  - teachers handling the subject per grade (`G7–G10`)
  - room allocation reference where available
- Add map deep-link from room allocation rows to map context (`/map` with query params).

### 4) Grade label normalization helper

Create a shared display helper and apply where relevant:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/ScheduleReview.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`

Display standard: `Gx` only.

## Guardrails

- No UI regressions to existing `ScheduleReview` manual edit features.
- Keep component-level scrolling and existing shell behavior.
- No native unstyled form controls for new controls; prefer existing UI primitives.
- Preserve all existing route guards and role checks.

## Output Format Required

Return:

1. Files changed (with brief purpose per file)  
2. Schema/migration notes  
3. API contract changes (request/response deltas)  
4. UI behavior before vs after  
5. Validation results:
   - `atlas-server` typecheck
   - `atlas-client` typecheck
6. Manual QA checklist results for:
   - primary vs other subject split
   - emergency toggle behavior
   - faculty drilldown
   - subject drilldown + map deeplink
   - `Gx` label consistency

