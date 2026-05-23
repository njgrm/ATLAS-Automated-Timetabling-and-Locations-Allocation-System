# ATLAS Live Teaching Load Integration Guide

## Purpose

This guide documents the current ATLAS endpoints that downstream systems should use when they need:

- assigned classes per section
- assigned sessions per teacher

These endpoints reflect the live `Teaching Load` contract, not the published timetable contract.

Important:

- these are protected endpoints
- these return teaching-load ownership data, not final scheduled day/time slots
- for final public timetable sessions, use the published schedule endpoints instead

## Base URL

- Tailnet default: `https://njgrm.buru-degree.ts.net/api/v1`
- Local service form: `http://100.88.55.125:5001/api/v1`

## Authentication

All endpoints in this guide require:

```http
Authorization: Bearer <token>
```

## Current Implemented Endpoint Set

### `GET /faculty-assignments/summary?schoolId=<id>&schoolYearId=<id>`

Use this when you need:

- school-wide live teaching load
- section assignment coverage
- temporary section assignment derivation from live teacher assignments
- coverage and integrity context for the same school year

Top-level response fields:

- `faculty`
- `ownershipIndex`
- `coverageTotals`
- `integrityDiagnostics`
- `schoolYearId`
- `fetchedAt`

### Temporary section-level integration rule

For section-assigned classes, use:

- `faculty[].assignments`
- then filter to `assignmentKind = "REAL_OWNERSHIP"`
- then explode each assignment's `sections[]`
- then group by `section.id`

This is the current safest live teaching-load source for section class ownership because it is aligned to the live faculty summary contract.

It is also only a temporary workaround.

Downstream systems that are section-first should not be forced to invert teacher rows long-term.

### Minimal response example

```json
{
  "faculty": [
    {
      "id": 18189,
      "firstName": "ELPIDIO",
      "lastName": "AQUINO",
      "department": "SCI",
      "specialization": "MAJOR IN BIOLOGY",
      "isActiveForScheduling": true,
      "policyCreditedHours": 36,
      "assignments": [
        {
          "id": 345,
          "subjectId": 3021,
          "gradeLevels": [7, 8, 9, 10],
          "sectionIds": [101, 102],
          "assignmentKind": "REAL_OWNERSHIP",
          "storedCurrentYearSectionCount": 2,
          "ownedCurrentYearSectionCount": 2,
          "sections": [
            {
              "id": 101,
              "name": "ANDRES BONIFACIO",
              "displayOrder": 7,
              "programType": "REGULAR"
            }
          ],
          "subject": {
            "id": 3021,
            "name": "Science - Biology",
            "code": "SCI_BIO",
            "minMinutesPerWeek": 225,
            "rotationFamily": "SCIENCE"
          }
        }
      ]
    }
  ],
  "coverageTotals": {
    "assignedPairs": 728,
    "activeAssignedPairs": 728,
    "realFacultyAssignedPairs": 728,
    "syntheticPlaceholderPairs": 0,
    "rawAssignedPairs": 962,
    "totalPairs": 962,
    "unassignedPairs": 234,
    "rawUnassignedPairs": 0
  },
  "integrityDiagnostics": {
    "emptySectionRows": 143,
    "currentYearRowsMissingOwnership": 0,
    "currentYearOwnershipWithoutMatchingScope": 0,
    "currentYearMissingOwnershipPairs": 0,
    "currentYearOwnershipWithoutMatchingScopePairs": 0
  },
  "schoolYearId": 55,
  "fetchedAt": "2026-05-23T12:00:00.000Z"
}
```

### `GET /faculty-assignments/:facultyId?schoolYearId=<id>`

Use this when you need:

- all live teaching-load subject/section sessions for one teacher
- section-level taught identity for special-program umbrella subjects
- teacher-specific assignment reconciliation details

Top-level response fields:

- `facultyId`
- `version`
- `assignments`

### Minimal response example

```json
{
  "facultyId": 18189,
  "version": 4,
  "assignments": [
    {
      "id": 345,
      "subjectId": 3021,
      "gradeLevels": [7, 8, 9, 10],
      "sectionIds": [101, 102],
      "assignmentKind": "REAL_OWNERSHIP",
      "storedCurrentYearSectionCount": 2,
      "ownedCurrentYearSectionCount": 2,
      "missingOwnershipSectionCount": 0,
      "ownershipWithoutScopeSectionCount": 0,
      "sections": [
        {
          "id": 101,
          "name": "ANDRES BONIFACIO",
          "displayOrder": 7,
          "programType": "REGULAR",
          "assignmentSpecializationCode": null,
          "assignmentSpecializationLabel": null
        }
      ],
      "subject": {
        "id": 3021,
        "name": "Science - Biology",
        "code": "SCI_BIO",
        "minMinutesPerWeek": 225,
        "rotationFamily": "SCIENCE"
      }
    }
  ]
}
```

### Interpreting `assignmentKind`

- `REAL_OWNERSHIP`: live owned current-year teaching load
- `BASELINE_ONLY`: baseline qualification row with no owned current-year sections
- `MISSING_OWNERSHIP`: stored scope exists but current-year ownership rows are missing

For teacher assigned sessions, downstream systems should normally consume only `REAL_OWNERSHIP` unless they intentionally want reconciliation diagnostics.

## Join Helpers

These endpoints are commonly paired with the teaching-load endpoints:

### `GET /sections/summary/:schoolYearId?schoolId=<id>`

Use for:

- section labels
- grade level
- program type
- adviser and special-program metadata

### `GET /subjects?schoolId=<id>`

Use for:

- subject catalog labels
- subject duration
- rotation family
- program scope

## Important Contract Notes

### 1. This is live teaching-load ownership, not timetable slots

These endpoints do not include:

- day of week
- start time
- end time
- room placement

If your sister system needs scheduled class meetings, use published schedule endpoints or generated/latest timetable endpoints where appropriate.

### 2. Special-program subjects can carry assignment-level specialization identity

For umbrella subjects such as `SPA_SPEC` and `SPS_SPEC`, the precise taught identity is available at section level via:

- `assignmentSpecializationCode`
- `assignmentSpecializationLabel`

### 3. Rotation-family subjects are still normal teaching-load sessions

Subjects in families such as `SCIENCE` and `TLE_ROTATION` still appear as normal assignment rows.

The rotation-family effect changes weekly load computation, not the basic ownership shape of the assignment record.

### 4. Coverage and diagnostics are available in the summary payload

If the sister system needs health context, use:

- `coverageTotals`
- `integrityDiagnostics`

Do not infer staffing health only from the count of teacher assignment rows.

## Current Recommendation

For sister-system integration today:

- use `GET /faculty-assignments/summary` as the school-wide source
- derive section-assigned classes from `faculty[].assignments[]`
- use `GET /faculty-assignments/:facultyId` for teacher-specific session detail
- join with `/sections/summary` and `/subjects` for display labels

## Required Next Contract

ATLAS still needs a dedicated section-first live teaching-load endpoint.

That target contract is documented in:

- [ATLAS Section-First Teaching Load Endpoint Spec](./ATLAS-SECTION-FIRST-TEACHING-LOAD-ENDPOINTS.md)

## Related Docs

- [ATLAS Public API](./ATLAS-PUBLIC-API.md)
- [ATLAS Section-First Teaching Load Endpoint Spec](./ATLAS-SECTION-FIRST-TEACHING-LOAD-ENDPOINTS.md)
- [AIMS Fetch Published Schedules Guide](../guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md)
