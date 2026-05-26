# ATLAS Section-First Teaching Load Endpoint Spec

## Status

Implemented contract (2026-05-23).

This file defines the dedicated section-first teaching-load endpoints required by:

- sister-system integrations
- the upcoming `Sections` page assigned-classes breakdown

This is intentionally separate from the current faculty-first live teaching-load endpoints.

## Why This Is Needed

The current live read model is faculty-first:

- `GET /faculty-assignments/summary`
- `GET /faculty-assignments/:facultyId`

That works for teacher-centric workflows, but it is not the right primary contract for:

- per-section assigned classes
- section detail screens
- section-first downstream integrations

Those consumers should not be forced to reconstruct a section-centric model from every teacher row.

This endpoint family is meant to answer:

- What classes are currently assigned to this section?
- Who is the teacher for each live assigned class in this section?
- Which expected section classes are still unassigned or only diagnostically stale?

## Implemented Endpoints

### 1. Section assigned classes summary

### `GET /sections/:sectionId/assigned-classes?schoolYearId=<id>` 🔒

Return the live teaching-load classes currently assigned to one section.

Auth:

- required

Query:

- `schoolYearId` required

Path:

- `sectionId` required

Response:

```json
{
  "sectionId": 101,
  "sectionName": "ANDRES BONIFACIO",
  "gradeLevel": 7,
  "programType": "REGULAR",
  "schoolYearId": 55,
  "classes": [
    {
      "subjectId": 3021,
      "subjectCode": "SCI_BIO",
      "subjectName": "Science - Biology",
      "subjectDisplayLabel": "Science",
      "minMinutesPerWeek": 225,
      "rotationFamily": "SCIENCE",
      "rotationTermRank": 1,
      "rotationTermLabel": "Term 1",
      "rotationTermGroupId": "SCIENCE",
      "rotationTermCount": 3,
      "facultyId": 18189,
      "facultyName": "AQUINO, ELPIDIO",
      "facultyDepartment": "SCI",
      "facultySpecialization": "MAJOR IN BIOLOGY",
      "assignmentKind": "REAL_OWNERSHIP",
      "specializationCode": null,
      "specializationLabel": null,
      "isRotationMember": true
    }
  ],
  "totals": {
    "assignedClassCount": 8,
    "rotationFamilyClassCount": 2,
    "unassignedClassCount": 0
  }
}
```

Rules:

- only current-year live teaching-load ownership for the requested section
- only active subject rows
- only active non-stale faculty ownership in the default `classes` array
- if stale ownership exists for the same section, it should not appear as a normal assigned class
- include `rotationFamily` for per-term families such as `SCIENCE` and `TLE_ROTATION`
- include `rotationTermRank`, `rotationTermLabel`, `rotationTermGroupId`, and `rotationTermCount` for rotational rows
- rotation term labels must use canonical UI wording: `Term 1`, `Term 2`, `Term 3`
- include assignment-level specialization identity for umbrella special-program subjects such as `SPA_SPEC` and `SPS_SPEC`

Optional diagnostic extension:

- `includeDiagnostics=true`

If included, the payload may add:

- `staleOwnership`
- `unassignedExpectedClasses`

Diagnostic payload shape:

```json
{
  "staleOwnership": [
    {
      "subjectId": 3023,
      "subjectCode": "SCI_ES",
      "facultyId": 99001,
      "facultyName": "Teacher X SCI_ES",
      "reason": "STALE_PLACEHOLDER_OWNERSHIP"
    }
  ],
  "unassignedExpectedClasses": [
    {
      "subjectId": 3023,
      "subjectCode": "SCI_ES",
      "subjectName": "Science - Earth Science",
      "rotationFamily": "SCIENCE",
      "rotationTermRank": 2,
      "rotationTermLabel": "Term 2",
      "rotationTermGroupId": "SCIENCE",
      "rotationTermCount": 3
    }
  ]
}
```

### 2. School-wide section assignment index

### `GET /sections/assigned-classes?schoolId=<id>&schoolYearId=<id>` 🔒

Return the section-first live teaching-load index for an entire school year.

Auth:

- required

Response:

```json
{
  "schoolId": 1,
  "schoolYearId": 55,
  "sections": [
    {
      "sectionId": 101,
      "sectionName": "ANDRES BONIFACIO",
      "gradeLevel": 7,
      "programType": "REGULAR",
      "assignedClassCount": 8,
      "unassignedClassCount": 0,
      "classes": [
        {
          "subjectId": 3021,
          "subjectCode": "SCI_BIO",
          "subjectName": "Science - Biology",
          "facultyId": 18189,
          "facultyName": "AQUINO, ELPIDIO",
          "assignmentKind": "REAL_OWNERSHIP",
          "specializationCode": null,
          "specializationLabel": null
        }
      ]
    }
  ],
  "fetchedAt": "2026-05-23T12:00:00.000Z"
}
```

Rules:

- section-first payload
- suitable for the `Sections` page breakdown
- suitable for sister-system read integration
- should not require consumers to invert teacher rows themselves

### 3. Relationship to teacher sessions

Teacher-specific live teaching-load sessions remain on:

- `GET /faculty-assignments/:facultyId?schoolYearId=<id>`

That endpoint should continue to answer:

- What classes and sections is this teacher currently assigned to?
- What assignment-level specialization is attached to this owned section?

The section-first endpoint family should answer the inverse:

- For this section, what classes are currently assigned and who teaches them?

## Source-of-Truth Rules

These endpoints should derive from the same active teaching-load truth boundary as:

- `GET /faculty-assignments/summary`
- `GET /faculty-assignments/coverage/summary`
- `POST /faculty-assignments/report/staffing-needs`

Specifically:

- active school-year section universe only
- active subject contract only
- active non-stale faculty ownership only for normal assigned classes
- stale ownership should be excluded from normal assigned output and exposed only diagnostically when requested

## Relationship To Published Schedules

This section-first teaching-load contract is not the same as the published timetable contract.

It should not include:

- day
- start time
- end time
- room

Those remain the responsibility of published schedule endpoints.

## Implementation Notes

- These endpoints are now the stable section-first contract for live teaching-load ownership.
- `GET /faculty-assignments/summary` remains valid for faculty-first consumers and diagnostics.
- Section-first consumers should use the `/sections/*/assigned-classes` family directly rather than inverting faculty rows.
