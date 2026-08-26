# AIMS Integration Guide: Fetching Published Schedules from ATLAS

This document is the authoritative integration contract for AIMS (and other sister systems) consuming published schedule data from ATLAS.

**Base URL:** `https://njgrm.buru-degree.ts.net/api/v1`
**Environment:** Live Tailnet (Tailscale required)

---

## 1. Quick Reference

| What you need | Endpoint | Notes |
|---|---|---|
| Current school-year schedule | `GET /schools/:schoolId/schedules/published` | Returns active year only; 404 if none published |
| Specific school-year schedule | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published` | Works for current and historical years |
| Section schedule (current year) | `GET /schools/:schoolId/schedules/published/sections/:sectionId` | Resolves active school year automatically |
| Section schedule (specific year) | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/sections/:sectionId` | Explicit year scoping |
| Faculty schedule by ATLAS ID (current year) | `GET /schools/:schoolId/schedules/published/faculty/:facultyId` | Uses ATLAS internal faculty ID |
| Faculty schedule by EnrollPro ID (current year) | `GET /schools/:schoolId/schedules/published/faculty-external/:externalFacultyId` | Uses EnrollPro teacher ID |
| Faculty schedule by ATLAS ID for specific year | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId` | Explicit year scoping with ATLAS internal faculty ID |
| Faculty schedule by EnrollPro ID for specific year | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty-external/:externalFacultyId` | Recommended for historical/test fixtures |
| Room schedule (current year) | `GET /schools/:schoolId/schedules/published/rooms/:roomId` | Resolves active school year automatically |
| Room schedule for specific year | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/rooms/:roomId` | Explicit year scoping |

## Current Tailnet Test State

As of the latest ATLAS verification:

- Active school year resolves to `schoolYearId=2`.
- No published schedule exists for active school year `2` yet.
- Current-year default endpoints therefore return `404 CURRENT_PUBLISHED_RUN_NOT_FOUND`.
- Historical/test published data is available under `schoolYearId=5`.
- The historical/test run currently returns `830` entries.
- Historical/test routes include `source.isHistorical=true` and `source.isActiveSchoolYear=false`.

AIMS must not decide whether a schedule is current from `schoolYearLabel` alone. Use `source.schoolYearId`, `source.isActiveSchoolYear`, and `source.isHistorical`.

---

## 2. Endpoints AIMS Must NOT Consume

The following endpoints are **internal scheduler workflow endpoints**, not AIMS final-sync endpoints. They expose draft/proposal data that may change or be cancelled before being applied.

| Endpoint | Why not |
|---|---|
| `POST /faculty-assignments/suggestion-proposals` | Creates a Teaching Load suggestion draft. Not published truth. |
| `POST /faculty-assignments/suggestion-proposals/:proposalId/apply` | Applies a suggestion to Teaching Load. Officer-only workflow step. |
| `POST /faculty-assignments/auto-fill` | Generates a suggestion preview. Not saved until applied. |
| `GET /faculty-assignments/summary` | Returns current Teaching Load assignment state, not published schedule. |
| `GET /generation/:schoolId/:schoolYearId/runs/latest/timetable` | Returns the latest generation draft, which may be unpublished or contain violations. |

**Rule:** AIMS final truth is published schedule data only. Teaching Load suggestions are proposal data until explicitly applied by a Scheduling Officer.

---

## 3. Current-Year vs Historical-Year Behavior

### Default endpoints (no year parameter)

Default endpoints resolve the **active school year** from the EnrollPro mirror. They return:

- **200** with the active-year published schedule, OR
- **404** `CURRENT_PUBLISHED_RUN_NOT_FOUND` if no published schedule exists for the active year.

Default endpoints **never** return historical published schedules. If you need a historical schedule, use the explicit school-year routes.

### Explicit school-year endpoints

Explicit school-year routes return data for the requested year. The response includes metadata to distinguish current from historical:

```json
{
  "source": {
    "schoolYearId": 5,
    "schoolYearLabel": "2026-2027",
    "isActiveSchoolYear": false,
    "isHistorical": true,
    ...
  }
}
```

- `isActiveSchoolYear: true` — this is the current active year
- `isHistorical: true` — this is a past year's schedule

---

## 4. Recommended Dummy Validation Calls

Use these calls to validate connectivity and schema while ATLAS has no active-year published run yet.

### 1. Confirm current-year endpoint is safely blocked

```http
GET /api/v1/schools/1/schedules/published
```

Expected:

```json
{
  "code": "CURRENT_PUBLISHED_RUN_NOT_FOUND"
}
```

### 2. Fetch historical/test published schedule

```http
GET /api/v1/schools/1/school-years/5/schedules/published
```

Expected:

- HTTP `200`
- `source.schoolYearId = 5`
- `source.isHistorical = true`
- `source.isActiveSchoolYear = false`
- `entries.length > 0`

### 3. Fetch one teacher schedule by EnrollPro teacher ID

```http
GET /api/v1/schools/1/school-years/5/schedules/published/faculty-external/17
```

Expected:

- HTTP `200`
- `entries.length > 0`
- every returned entry has `faculty.externalId = 17`

### 4. Confirm missing external teacher returns a readable 404

```http
GET /api/v1/schools/1/school-years/5/schedules/published/faculty-external/999999
```

Expected:

```json
{
  "code": "FACULTY_NOT_FOUND"
}
```

---

## 5. Response Schema

### Top-level payload

```json
{
  "source": {
    "runId": 425,
    "schoolId": 1,
    "schoolYearId": 5,
    "schoolYearLabel": "2026-2027",
    "isActiveSchoolYear": false,
    "isHistorical": true,
    "publishedAt": "2026-08-15T10:00:00.000Z",
    "generatedAt": "2026-08-15T09:55:00.000Z",
    "revisionMarker": "run=425|published=..."
  },
  "timeSlots": [...],
  "specialEvents": [...],
  "entries": [...]
}
```

### Entry schema (faculty and section identity fields)

Each entry contains ATLAS internal IDs and EnrollPro-compatible external IDs:

```json
{
  "entryId": "entry-101",
  "day": "MONDAY",
  "startTime": "08:00",
  "endTime": "08:45",
  "durationMinutes": 45,
  "subject": {
    "id": 1,
    "code": "FIL",
    "name": "Filipino"
  },
  "section": {
    "atlasId": 11667,
    "externalId": 104,
    "id": 104,
    "name": "Luna",
    "gradeLevel": 17,
    "gradeLevelName": "Grade 7",
    "programType": "REGULAR",
    "programCode": "REG",
    "programName": "Regular Program"
  },
  "faculty": {
    "atlasId": 24263,
    "externalId": 17,
    "employeeId": "1000010",
    "id": 24263,
    "name": "DE LEON, NATHANIEL JOSE",
    "isPlaceholder": false
  },
  "room": {
    "id": 161,
    "name": "G7 Room 101",
    "type": "CLASSROOM",
    "floor": 1,
    "buildingId": 13,
    "buildingName": "Grade 7 Academic Wing"
  }
}
```

### Identity field reference

| Field | Description | Use for |
|---|---|---|
| `faculty.atlasId` | ATLAS internal faculty mirror ID | Internal ATLAS references |
| `faculty.externalId` | EnrollPro teacher ID | **Cross-system matching with EnrollPro/AIMS** |
| `faculty.employeeId` | Employee ID (may be null) | Employee record matching |
| `faculty.isPlaceholder` | `true` if this is a test/dummy faculty entry | Filter out placeholders |
| `faculty.id` | Alias for `atlasId` (backward compatibility) | Legacy consumers |
| `section.atlasId` | ATLAS internal section mirror ID | Internal ATLAS references |
| `section.externalId` | EnrollPro section ID | **Cross-system matching with EnrollPro/AIMS** |
| `section.id` | Alias for `externalId` (backward compatibility) | Legacy consumers |

For AIMS/EnrollPro compatibility:

- Use `faculty.externalId` to match EnrollPro teacher IDs.
- Use `section.externalId` to match EnrollPro section IDs.
- Do not use `faculty.id` for cross-system matching.
- Do not use `section.id` for cross-system matching unless you intentionally accept the backward-compatible alias behavior.
- `faculty.atlasId` and `section.atlasId` are ATLAS internal mirror IDs.

---

## 6. Placeholder Faculty

Where a schedule entry has no faculty assignment, the payload returns:

```json
{
  "faculty": {
    "atlasId": null,
    "externalId": null,
    "employeeId": null,
    "id": null,
    "name": "Unassigned Faculty",
    "isPlaceholder": false
  }
}
```

Entries where `faculty.isPlaceholder: true` represent test or dummy faculty records and should be excluded from AIMS sync.

---

## 7. Error Responses

### 404 — No current published schedule

```json
{
  "code": "CURRENT_PUBLISHED_RUN_NOT_FOUND",
  "message": "No published schedule is available for the current school year (2) yet.",
  "actionHint": "Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs."
}
```

**Cause:** The active school year has no published schedule yet.
**Resolution:** Wait for the Scheduling Officer to complete the publish workflow, or use an explicit school-year route to fetch a historical schedule.

### 404 — Faculty not found

```json
{
  "code": "FACULTY_NOT_FOUND",
  "message": "No faculty member with external ID 999999 found for school 1."
}
```

**Cause:** The requested EnrollPro external faculty ID has no matching ATLAS FacultyMirror record.
**Resolution:** Verify the teacher exists in the EnrollPro sync feed and that ATLAS has synced the faculty mirror.

### 400 — Invalid parameter

```json
{
  "code": "INVALID_PARAM",
  "message": "schoolId must be a positive integer."
}
```

---

## 8. Prerequisites for Published Data

For AIMS to receive published schedule data, the following must be complete:

1. **School year is active** — An EnrollProSchoolYearMirror record with `isActive: true` must exist.
2. **Faculty are synced** — FacultyMirror records must be populated from the EnrollPro feed.
3. **Teaching Load is assigned** — Faculty must be assigned to subjects/sections via Teaching Load (not just suggested).
4. **Timetable is generated** — A generation run must complete successfully.
5. **Schedule is published** — A Scheduling Officer must click Publish, which marks the run as the published schedule.

---

## 9. Connectivity

- **Tailscale Required:** The AIMS agent must be connected to the same Tailnet to resolve `njgrm.buru-degree.ts.net`.
- **Latency:** Published endpoints are optimized; school-wide fetches for large schools (100+ sections) typically respond in 200-500ms.
- **Support:** For API inconsistencies or schema questions, contact the ATLAS development team.

---

## 10. Repository Note

This guide lives under `docs/`, which may be ignored by the local `.gitignore` depending on branch state. If this document must be committed, force-add it intentionally or move it to a tracked handoff location.
