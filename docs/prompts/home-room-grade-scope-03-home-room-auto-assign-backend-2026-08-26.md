# Home-Room Grade Scope Prompt 03 - Home-Room Auto-Assign Backend

## Role

You are the ATLAS backend executor for homeroom auto-assignment. Implement preview/apply logic and API endpoints only. Do not build the Sections UI in this prompt.

## Required preflight

Before editing:

1. Read Prompt 01 and Prompt 02 final reports.
2. Verify Prompt 02 completed and inspect any recorded `NO-GO` caveats.
3. Inspect current section home-room update service and route.
4. Inspect current room/building grade-scope field.
5. Re-run `git --no-optional-locks status --short`.
6. Identify blockers before implementation. If grade scope is missing or broken, record `NO-GO` and stop only if the backend auto-assign contract cannot be implemented safely.

## Problem

Manual homeroom assignment is tedious, especially for dummy and pilot data. ATLAS already has batch home-room update support, but there is no deterministic auto-assignment workflow that respects teaching-room eligibility and building grade confinement.

## Target files

- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- Add a focused service file if cleaner:
  - `atlas-server/src/services/home-room-auto-assign.service.ts`
- Add or update backend tests:
  - `atlas-server/src/__tests__/home-room-auto-assign.test.ts`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Endpoint contract

Add preview and apply behavior under the existing Sections ownership boundary.

Recommended route:

```text
POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign
```

Body:

```json
{
  "schoolId": 1,
  "mode": "preview",
  "strategy": "grade_scope_first",
  "overwriteExisting": false,
  "allowCrossGradeFallback": false
}
```

Response:

```json
{
  "schoolId": 1,
  "schoolYearId": 2,
  "mode": "preview",
  "strategy": "grade_scope_first",
  "overwriteExisting": false,
  "allowCrossGradeFallback": false,
  "assignments": [
    {
      "sectionId": 1,
      "sectionName": "Rizal",
      "gradeLevel": 7,
      "homeRoomId": 161,
      "roomName": "G7 Room 101",
      "buildingId": 13,
      "buildingName": "Grade 7 Academic Wing",
      "reason": "GRADE_SCOPE_MATCH"
    }
  ],
  "skipped": [
    {
      "sectionId": 9,
      "sectionName": "Example",
      "gradeLevel": 9,
      "reason": "NO_ELIGIBLE_ROOM"
    }
  ],
  "counts": {
    "sectionsConsidered": 20,
    "assigned": 20,
    "skipped": 0,
    "existingPreserved": 0,
    "applied": 0
  }
}
```

If the repo prefers separate preview/apply routes, use that pattern, but keep the response shape shared.

## Functional requirements

- When mode is `preview`, the system shall return proposed assignments without writing changes.
- When mode is `apply`, the system shall persist proposed assignments.
- When `overwriteExisting=false`, the system shall preserve sections that already have `homeRoomId`.
- When `overwriteExisting=true`, the system shall include already-assigned sections in reassignment.
- The system shall only assign rooms where `isTeachingSpace=true`.
- The system shall only assign rooms whose building has `isTeachingBuilding=true`.
- The system shall not assign a single room to multiple sections in the same result.
- The system shall not assign a room already used by another preserved section.
- The system shall prefer rooms in buildings whose grade scope includes the section grade.
- The system shall treat empty building grade scope as eligible for any grade.
- If `allowCrossGradeFallback=false`, then the system shall skip sections when only non-matching scoped buildings remain.
- If `allowCrossGradeFallback=true`, then the system may use non-matching scoped buildings only after matching and any-grade buildings are exhausted.
- The system shall sort assignments deterministically by grade level, section name, building scope match rank, building name, floor, floor position, and room name.
- The system shall set `SectionMirror.buildingZoneId` from the assigned room/building zone behavior already used by manual home-room assignment.
- The system shall return explicit skip reasons.

## Required skip reasons

Support at least:

- `ALREADY_ASSIGNED`
- `NO_ELIGIBLE_ROOM`
- `NO_GRADE_MATCHING_ROOM`
- `ROOM_CAPACITY_TOO_SMALL`
- `INVALID_SECTION_GRADE`

If capacity is not reliable in current dummy data, implement capacity handling as a non-blocking warning only if Prompt 01 proved capacity cannot be trusted. Document that decision in the final report.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/home-room-auto-assign.test.ts
```

Test cases must prove:

- Preview does not write.
- Apply writes the same assignments returned by preview.
- Existing home rooms are preserved by default.
- Overwrite mode can reassign.
- Grade-scoped buildings are preferred.
- Cross-grade fallback is blocked by default.
- Cross-grade fallback works only when explicitly enabled.
- Any-grade buildings are valid fallback.
- Non-teaching buildings are ignored.
- Non-teaching rooms are ignored.
- Duplicate room assignment cannot occur.
- Skipped sections have stable reasons.
- Invalid body values return `400`.

## Tailnet proof

Use Admin auth.

1. Run preview for active school year.
2. Confirm all currently missing home-room sections receive proposed assignments or explicit skip reasons.
3. Do not apply on Tailnet unless the user has explicitly authorized live data mutation.
4. If live apply is authorized, apply once, re-read section summary, and confirm `homeRoomId` count increased exactly by `counts.applied`.
5. If live apply is not authorized, use local apply proof and mark Tailnet apply as intentionally skipped.

## Acceptance criteria

- Backend preview/apply logic is deterministic.
- The endpoint respects building grade scope.
- The endpoint does not mutate on preview.
- The endpoint does not overwrite existing assignments by default.
- The endpoint produces enough detail for UI review before apply.

## Per-prompt evidence required

Record this prompt's evidence for the final sequence handoff. Include a compact preview result from Tailnet and whether apply was performed or skipped. Continue to Prompt 04 after command gates finish unless the backend endpoint is unusable.
