# AIMS / SMART Term-Aware API Context

Date: 2026-08-27  
Audience: AIMS and SMART developers consuming ATLAS schedule, term, export, and notification endpoints.

## Purpose

This file consolidates the term-aware behavior ATLAS has added around active-term discovery, published schedule reads, workbook exports, timetable violations, and schedule-change events. AIMS and SMART can use this as the implementation handoff for updating existing integrations without guessing from legacy `termId` routes.

## Source-Of-Truth Rules

| Domain | Owner | Consumer rule |
|---|---|---|
| Active term identity | EnrollPro | Read through ATLAS runtime context or EnrollPro's protected integration endpoint from trusted server code only. |
| Active school-year identity | EnrollPro, mirrored by ATLAS | Do not hard-code school-year IDs. Resolve at runtime. |
| Persisted schedule entry term | ATLAS `termIndex` on generated/published entries | Treat each entry's `termIndex` as durable schedule truth. |
| Published schedule availability | ATLAS | Only published schedule endpoints are final downstream truth. Generation draft routes are not final-sync routes. |
| Published revision effective date | ATLAS | Use `date` or `asOfDate` when reading revision-effective published truth. |

Important distinction: EnrollPro's active term tells clients what the current term is now. ATLAS entry `termIndex` tells clients which term a schedule row belongs to. Do not overwrite or infer an entry's `termIndex` from the active term.

## Term-Aware Rotating Subjects

Yes, term-aware rotating subjects are part of the ATLAS contract and must be considered by AIMS and SMART.

Rotating subjects are subject families where the same section lane can carry different concrete subject identities in different terms. The most important current families are:

| Family | Concrete subject rows | Consumer interpretation |
|---|---|---|
| `SCIENCE` | `SCI_BIO`, `SCI_CHEM`, `SCI_ES` | These are term-ordered Science subjects that can share a weekly lane across the school year. |
| `TLE_ROTATION` / `TLE_EXPLORATORY` | `TLE_ICT_EXP`, `TLE_AFA_EXP`, `TLE_FCS_EXP` | These are exploratory TLE subjects that rotate by term instead of all stacking as simultaneous weekly demand. |

Rotating-subject metadata can appear in subject and Teaching Load payloads:

| Field | Meaning |
|---|---|
| `subject.rotationFamily` | Logical rotating family, such as `SCIENCE` or `TLE_ROTATION`. |
| `subject.termGroupId` | Logical term bundle key, such as `SCIENCE`. |
| `subject.termCount` | Expected number of terms in the bundle, currently `3` for tri-semester rotation. |
| `rotationTermBreakdown[]` | Per-family Teaching Load breakdown grouped by `Term 1`, `Term 2`, and `Term 3`. |
| `rotationFamilyLoadDetails[]` | Faculty-level summary of raw minutes, credited minutes, and term buckets for rotating families. |
| `termBuckets[]` | Bucketed term details including `termRank`, `termLabel`, raw/credited minutes, section IDs, and subject IDs. |

Consumer rule: do not treat every rotating subject row as fully concurrent annual load. For rotating families, ATLAS credits the heaviest active term bucket as the concurrent weekly load. Cross-term rows in the same family are not simply summed unless they stack inside the same term bucket.

Example Teaching Load shape:

```json
{
  "rotationTermBreakdown": [
    {
      "family": "SCIENCE",
      "rawMinutesPerWeek": 675,
      "peakTermMinutesPerWeek": 450,
      "peakTermRank": 1,
      "peakTermLabel": "Term 1",
      "termGroupId": "SCIENCE",
      "termCount": 3,
      "termBuckets": [
        {
          "termRank": 1,
          "termLabel": "Term 1",
          "rawMinutesPerWeek": 450,
          "creditedMinutesPerWeek": 450,
          "isPeakTerm": true,
          "sectionIds": [101, 102],
          "subjectCodes": ["SCI_BIO"],
          "subjectIds": [3021]
        },
        {
          "termRank": 2,
          "termLabel": "Term 2",
          "rawMinutesPerWeek": 225,
          "creditedMinutesPerWeek": 225,
          "isPeakTerm": false,
          "sectionIds": [101],
          "subjectCodes": ["SCI_ES"],
          "subjectIds": [3022]
        }
      ]
    }
  ]
}
```

For final schedule sync, published schedule `entries[].termIndex` remains the row-level truth. For staffing, readiness, or Teaching Load sync, preserve rotating-family fields so SMART/AIMS do not inflate Science or TLE demand by adding all term rows together.

## Base URLs

| Service | URL |
|---|---|
| ATLAS Tailnet API | `https://njgrm.buru-degree.ts.net/api/v1` |
| ATLAS health preflight | `https://njgrm.buru-degree.ts.net/api/v1/health` |
| EnrollPro active-term feed used by ATLAS | `GET <ENROLLPRO_API>/integration/v1/active-term` |

AIMS and SMART should prefer ATLAS API payloads for schedule integration. The EnrollPro active-term endpoint requires a protected `X-Integration-Key`; never expose that key to browsers, public clients, screenshots, logs, or downstream payloads.

## Active-Term Runtime Context

Use this endpoint when AIMS or SMART needs to know the active term and school-year alignment as ATLAS sees it:

```http
GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true
Authorization: Bearer <ATLAS JWT or bridge JWT>
```

The response includes:

```json
{
  "activeSchoolYearId": 2,
  "source": "enrollpro-verified",
  "upstreamVerified": true,
  "upstreamActiveSchoolYearId": 2,
  "activeTerm": {
    "source": "enrollpro-verified",
    "reachable": true,
    "verified": true,
    "activeTerm": "T1",
    "termIndex": 1,
    "schoolYearId": 2,
    "matchedSchoolYear": true,
    "code": null,
    "message": "ATLAS is aligned with EnrollPro active term T1."
  }
}
```

The values above are verified example evidence from 2026-08-22, not permanent constants.

### Active-Term States

| `activeTerm.source` | Meaning | AIMS / SMART behavior |
|---|---|---|
| `enrollpro-verified` | ATLAS reached EnrollPro and normalized `T1`, `T2`, or `T3`. | Safe to use `activeTerm.termIndex` for current-term defaulting. |
| `enrollpro-unreachable` | ATLAS could not verify active term. | Use explicit `termIndex=1`, `2`, or `3`, or read all terms. Do not use `termIndex=active`. |
| `enrollpro-contract-drift` | EnrollPro returned an invalid active-term shape. | Treat active-term filtering as unavailable and escalate the integration contract. |
| `atlas-unverified` | ATLAS did not perform live upstream verification. | Treat as saved context only; do not use as proof of current term. |

## Published Schedule Reads

The term-aware query parameter is:

```text
termIndex=1|2|3|active
```

Omit `termIndex` to read all terms. Use `termIndex=active` only when the ATLAS server can verify EnrollPro's active term. Use explicit `termIndex=1`, `2`, or `3` when you need deterministic historical or fallback behavior.

### Current Active School Year

| Purpose | Endpoint |
|---|---|
| School-wide published schedule | `GET /schools/:schoolId/schedules/published?termIndex=active` |
| Section schedule | `GET /schools/:schoolId/schedules/published/sections/:sectionId?termIndex=active` |
| Faculty schedule by ATLAS ID | `GET /schools/:schoolId/schedules/published/faculty/:facultyId?termIndex=active` |
| Faculty schedule by EnrollPro ID | `GET /schools/:schoolId/schedules/published/faculty-external/:externalFacultyId?termIndex=active` |
| Room schedule | `GET /schools/:schoolId/schedules/published/rooms/:roomId?termIndex=active` |

Current-year routes resolve the active school year from ATLAS's EnrollPro school-year mirror. They return `404 CURRENT_PUBLISHED_RUN_NOT_FOUND` when no published schedule exists for the active school year.

### Explicit School Year

| Purpose | Endpoint |
|---|---|
| School-wide published schedule | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published?termIndex=1` |
| Section schedule | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/sections/:sectionId?termIndex=1` |
| Faculty schedule by ATLAS ID | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId?termIndex=1` |
| Faculty schedule by EnrollPro ID | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty-external/:externalFacultyId?termIndex=1` |
| Room schedule | `GET /schools/:schoolId/school-years/:schoolYearId/schedules/published/rooms/:roomId?termIndex=1` |

Use explicit school-year routes for historical schedules, repeatable test fixtures, and AIMS backfills. The response `source` identifies whether the returned schedule is active or historical.

### Published Response Fields To Consume

Published payloads now include term scope metadata under `source`:

```json
{
  "source": {
    "schoolId": 1,
    "schoolYearId": 5,
    "isActiveSchoolYear": false,
    "isHistorical": true,
    "termScope": "explicit",
    "termIndex": 1,
    "activeTermVerified": false,
    "requestedDate": "2026-08-27",
    "resolvedForDate": "2026-08-27",
    "activeRevisionId": null,
    "revisionMarker": "run=425|published=..."
  },
  "entries": []
}
```

| Field | Meaning |
|---|---|
| `source.termScope` | `all`, `explicit`, or `active`. |
| `source.termIndex` | Resolved numeric term used for filtering, or `null` for all-term reads. |
| `source.activeTermVerified` | `true` only when `termIndex=active` was resolved from live EnrollPro active-term verification. |
| `source.isActiveSchoolYear` | `true` when the payload belongs to the active school year. |
| `source.isHistorical` | `true` when the payload is not the active school year. |
| `entries[].termIndex` | Durable term membership for each entry. Consumers should preserve it. |

## Workbook Export Reads

Privileged workbook export routes accept the same `termIndex=1|2|3|active` parameter:

```http
GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/summary-teacher-schedule.xlsx?termIndex=active
GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx?termIndex=active
Authorization: Bearer <ATLAS JWT>
```

Behavior:

- No `termIndex`: export all terms.
- `termIndex=1`, `2`, or `3`: export only entries for that term.
- `termIndex=active`: ATLAS resolves EnrollPro active term server-side, then filters.
- Invalid term value: `400 INVALID_TERM_INDEX`.
- Unverifiable active term or entries without reliable `termIndex`: `501 TERM_FILTER_NOT_READY`.

Generated filenames include `-term1`, `-term2`, `-term3`, or `-term-active` when a term filter is requested.

## Timetable Violations

Generation violation reads support explicit numeric term filtering:

```http
GET /api/v1/generation/:schoolId/:schoolYearId/runs/latest/violations?termIndex=1
GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/violations?termIndex=1
```

Valid values are `1`, `2`, or `3`. Invalid values return:

```json
{
  "code": "INVALID_PARAM",
  "message": "termIndex must be 1, 2, or 3 when provided."
}
```

These routes are for scheduler diagnostics and readiness checks. AIMS final schedule sync should use published schedule routes instead.

## Notifications And Events

ATLAS emits term metadata on timetable and published-schedule changes when affected entries carry `termIndex`.

| Event source | Endpoint / stream | Term metadata |
|---|---|---|
| Unified authenticated notifications | `GET /api/v1/notifications/:schoolId/:schoolYearId/events` | Operational events may include affected term indices. |
| Published schedule events | `GET /api/v1/schools/:schoolId/:schoolYearId/schedules/published-events` | `SCHEDULE_REVISED` metadata includes `affectedTermIndices` when available. |
| Timetable edit events | Internal scheduler event bridge | `TIMETABLE_EDIT_COMMITTED` metadata includes `affectedTermIndices` when available. |

Consumers must treat `affectedTermIndices: null` as "term impact not available," not as "all terms changed" or "no terms changed."

## Legacy Route Warning

Legacy routes still exist:

```http
GET /api/v1/schools/:schoolId/schedules/published/:termId
GET /api/v1/schools/:schoolId/schedules/published/:termId/sections/:sectionId
GET /api/v1/schools/:schoolId/schedules/published/:termId/faculty/:facultyId
GET /api/v1/schools/:schoolId/schedules/published/:termId/rooms/:roomId
```

Despite the parameter name, `:termId` is compatibility-only and currently maps to the old school-year-scoped behavior. New AIMS and SMART work must not use these routes as the term-aware contract. Use explicit `/school-years/:schoolYearId/...` routes plus `?termIndex=...`.

## Error Handling Matrix

| HTTP | Code | Meaning | Recommended consumer action |
|---:|---|---|---|
| `400` | `INVALID_TERM_INDEX` | `termIndex` was not `1`, `2`, `3`, or `active`. | Fix the request. |
| `400` | `INVALID_PARAM` | A path/query parameter is invalid. | Fix the request. |
| `404` | `CURRENT_PUBLISHED_RUN_NOT_FOUND` | Active year has no published schedule yet. | Wait for ATLAS publish or use explicit historical route if intended. |
| `404` | `PUBLISHED_RUN_NOT_FOUND` | Requested explicit school year has no published run. | Verify year/run readiness. |
| `404` | `FACULTY_NOT_FOUND` | EnrollPro external faculty ID has no ATLAS mirror. | Recheck faculty sync/mapping. |
| `501` | `TERM_FILTER_NOT_READY` | Active term cannot be verified or entries lack reliable `termIndex`. | Use explicit term, all-term read, or wait for integration repair. |

## Update Checklist For AIMS And SMART

1. Resolve active context through `GET /api/v1/runtime/context?schoolId=:schoolId&verifyUpstream=true` at session/module boundaries where current term matters.
2. Stop using legacy `/schedules/published/:termId` routes for new work.
3. Use `/schools/:schoolId/schedules/published...` routes for active-year reads.
4. Use `/schools/:schoolId/school-years/:schoolYearId/schedules/published...` routes for explicit-year and historical reads.
5. Add optional `termIndex=1|2|3|active` only when a term slice is needed.
6. Preserve `entries[].termIndex` in local stores, caches, exports, and sync payloads.
7. Preserve rotating-subject metadata such as `rotationFamily`, `termGroupId`, `termCount`, `rotationTermBreakdown`, and `termBuckets` when consuming Teaching Load or readiness payloads.
8. Do not sum all rows in a rotating family as simultaneous weekly load; use ATLAS credited/peak-term fields where provided.
9. Key term-filtered caches by `schoolId`, `schoolYearId`, `termIndex` or resolved `source.termIndex`, and `source.revisionMarker`.
10. Treat `termIndex=active` as unavailable when ATLAS returns `501 TERM_FILTER_NOT_READY`.
11. Use `faculty.externalId` and `section.externalId` for cross-system matching; do not use ATLAS internal IDs for AIMS/SMART joins unless explicitly intended.
12. Keep EnrollPro integration keys server-side only.

## Minimal Consumer Examples

### Read Current Active-Term Published Schedule

```http
GET /api/v1/schools/1/schedules/published?termIndex=active
```

Pass condition:

- `source.termScope = "active"`
- `source.activeTermVerified = true`
- `source.termIndex` is `1`, `2`, or `3`
- every returned entry has matching `entries[].termIndex`

### Read Historical Term 2 Schedule By EnrollPro Faculty ID

```http
GET /api/v1/schools/1/school-years/5/schedules/published/faculty-external/17?termIndex=2
```

Pass condition:

- `source.schoolYearId = 5`
- `source.termScope = "explicit"`
- `source.termIndex = 2`
- `entries[].faculty.externalId = 17`
- every returned entry has `entries[].termIndex = 2`

### Export Active-Term Class Program

```http
GET /api/v1/generation/1/5/runs/425/export/class-program.xlsx?termIndex=active
Authorization: Bearer <ATLAS JWT>
```

Pass condition:

- HTTP `200`
- content type is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- filename includes `class-program-term-active.xlsx`

## Verification References

- `docs/verification/active-term-integration-release-proof-2026-08-22.md`
- `docs/phases/active-term-integration-sequence-2026-08-22.md`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`
- `docs/reference/atlas-smart-rollover-api-endpoints-2026-08-07.md`
- `docs/guides/ATLAS-PUBLIC-API.md`
