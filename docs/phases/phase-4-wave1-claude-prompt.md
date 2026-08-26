# Claude Prompt — Wave 1 / Bundle A (Build On Existing Edits)

Use this prompt as-is for Claude/Copilot.

---

Implement **Wave 1 / Bundle A** for ATLAS timetabling.

Do not start from scratch. Build on existing in-progress edits already present in this branch.

## Read first

1. `docs/phases/timetabling-direction-master.md`
2. `docs/phases/phase-4-bundle-a-verification.md`
3. `docs/phases/phase-4-bundle-a-implementation-pack.md`
4. `docs/verification/phase-4-bundle-a-qc-checklist.md`

## Critical instruction

There are already partial code edits in:

- `prisma/schema.prisma`
- `prisma/migrations/0008_add_faculty_profile_fields/migration.sql`
- `atlas-server/src/services/faculty-adapter.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/routes/faculty.router.ts`

You must **continue and complete** these edits, not replace them with a conflicting approach.

## Scope for this run (Wave 1 only)

### 1) Backend completion

- Finalize faculty profile fields and persistence:
  - `employmentStatus`
  - `isClassAdviser`
  - `advisoryEquivalentHours`
  - `canTeachOutsideDepartment`
- Ensure route/service validation and response mapping are stable.
- Keep optimistic lock behavior (`version`) unchanged.

### 2) Frontend teaching load UX

Target: `atlas-client/src/pages/FacultyAssignments.tsx`

- Split subject area into:
  - `Primary Subjects (Qualified)`
  - `Other Subjects (Outside Department)`
- Add global toggle:
  - `Allow outside department (emergency)` default OFF
  - OFF = outside-department subjects disabled
  - ON = outside-department subjects enabled
- Add subject search within assignment panel.
- Keep load policy tooltips/copy aligned to:
  - `30h soft baseline`
  - `40h hard cap`

### 3) Drilldown entry points

- `atlas-client/src/pages/Faculty.tsx`
  - add clear action to open teaching-load details for selected teacher.
- `atlas-client/src/pages/Subjects.tsx`
  - add per-subject summary/drilldown view:
    - who teaches by grade (`G7–G10`)
    - room references where available
  - add map deep-link for room allocation references.

### 4) Grade label normalization

Normalize labels to `Gx` in target views:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/ScheduleReview.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`

## Guardrails

- Do not edit `.cursor/plans/*`.
- Keep strict MVC boundaries and `/api/v1` conventions.
- Do not regress existing `ScheduleReview` manual-edit flows.
- Keep component-level scrolling behavior.
- Prefer existing shared UI primitives and patterns.

## Verification required before handoff

Run and report:

1. `cd atlas-server && npx tsc --noEmit`
2. `cd atlas-client && npx tsc --noEmit`

Then execute manual QA and report pass/fail for:

- primary vs other subject split
- emergency toggle behavior
- faculty drilldown entrypoint
- subject drilldown + map deep-link
- `Gx` label consistency

## Output format

Return:

1. files changed with purpose
2. API contract deltas (if any)
3. before/after UX summary
4. typecheck results
5. manual QA checklist results
6. remaining risks/open items

---

