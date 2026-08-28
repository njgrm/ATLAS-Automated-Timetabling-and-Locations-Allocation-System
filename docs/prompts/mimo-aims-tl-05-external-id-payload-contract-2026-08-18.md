# Mimo Prompt 05 — External ID Payload Contract for AIMS

## Role

You are the ATLAS public API executor. Make published schedule payloads map cleanly to EnrollPro/AIMS identities.

Do not begin this prompt until Prompt 04 receives Codex QA `GO`.

## Problem

Public schedule entries currently expose nested `faculty.id` as the ATLAS internal `FacultyMirror.id`. AIMS is likely to know EnrollPro teacher IDs, employee IDs, or section IDs, not ATLAS internal mirror IDs.

If AIMS queries `GET /published/faculty/:facultyId` using an EnrollPro teacher ID, the route may return empty results because the filter compares against ATLAS internal IDs.

## Target files

- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/__tests__/published-schedule-external-id-contract.test.ts`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`

## Requirements

### Functional requirements

- The system shall expose ATLAS internal faculty IDs as `faculty.atlasId`.
- The system shall expose EnrollPro teacher/faculty IDs as `faculty.externalId`.
- The system shall expose faculty employee IDs as `faculty.employeeId` when available.
- The system shall expose placeholder state as `faculty.isPlaceholder`.
- The system shall expose ATLAS internal section mirror IDs separately from EnrollPro section IDs where both are available.
- The system shall expose EnrollPro section IDs as `section.externalId`.
- If a faculty assignment is missing, then the system shall return `faculty.atlasId=null`, `faculty.externalId=null`, and `faculty.name="Unassigned Faculty"`.
- If a faculty assignment points to a missing mirror, then the system shall return a plain fallback and include enough metadata for ATLAS support to diagnose it without claiming it is an EnrollPro teacher.

## Suggested entry shape

```json
{
  "entryId": "entry-101",
  "subject": {
    "id": 1,
    "code": "FIL",
    "name": "Filipino"
  },
  "section": {
    "atlasId": 12,
    "externalId": 104,
    "name": "Luna",
    "gradeLevelName": "Grade 7",
    "programType": "REGULAR"
  },
  "faculty": {
    "atlasId": 24263,
    "externalId": 7,
    "employeeId": "1234501",
    "name": "DE LEON, NATHANIEL JOSE",
    "isPlaceholder": false
  }
}
```

## Faculty filter behavior

Add one of these approaches:

### Preferred

Keep existing internal route:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId
```

and add explicit external-ID route:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty-external/:externalFacultyId
```

### Acceptable alternative

Support query parameter:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId?idType=atlas|external
```

Default must be documented.

## Implementation guidance

- Load `FacultyMirror.externalId`, `employeeId`, and placeholder flags in reference maps.
- Keep `faculty.id` only if needed for backward compatibility, but prefer new explicit names.
- Do not make AIMS guess whether an ID is internal or external.
- Do not expose proposal-only faculty assignments.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Add/run backend tests proving:

- Published payload includes `faculty.atlasId`.
- Published payload includes `faculty.externalId`.
- Published payload includes `faculty.employeeId`.
- Published payload includes `faculty.isPlaceholder`.
- Published payload includes `section.externalId`.
- External faculty route/query returns entries for EnrollPro external faculty ID.
- Internal faculty route/query remains backward compatible.

Tailnet proof:

1. Fetch explicit school-year published schedule with entries.
2. Pick one non-null faculty entry.
3. Confirm both ATLAS and external IDs are present.
4. Fetch by external faculty ID.
5. Confirm returned entries match that external teacher.

## Acceptance criteria

- AIMS can map schedule entries to EnrollPro teachers and sections without relying on ATLAS internal IDs.
- Placeholder/test faculty are clearly marked.
- Internal ID compatibility is preserved or documented.
