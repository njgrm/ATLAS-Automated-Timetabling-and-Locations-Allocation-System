# AIMS / SMART handoff — consuming ATLAS's term-aware published schedule

**To:** the AIMS and SMART owners. **From:** ATLAS (Lane A), 2026-09-22.
**Pinned to deployed ATLAS release:** `5a333c74de03df11e0d0bf9ec6839c1916798896`
(release dir `D:\ATLAS-runtime-supervised-5a333c74-20260922`; served on
`https://njgrm.buru-degree.ts.net`).

**This replaces a deleted document.** `docs/reference/aims-smart-term-aware-api-context-2026-08-27.md`
and `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md` were removed from tracking on 2026-08-28 by
`4794bd9e` (`docs/*` is gitignored and `docs/guides/` was not whitelisted). **Do not code against them.**
The contract has since changed in ways that would break a caller written from that doc — see §6.

Everything below was verified against the **live payload** at that pin and the **source** at the same
commit. Where a claim comes from source only, it says so.

---

## 1. Base URL and authentication

- Base: `https://njgrm.buru-degree.ts.net/api/v1`
- **The schedule-read endpoints are public** — no token. Verified: an unauthenticated
  `GET /schools/1/schedules/published` returns `200`.
- The **only** authenticated route in this family is the change-feed
  `GET /schools/:schoolId/:schoolYearId/schedules/published-events` (Server-Sent Events), which
  requires a JWT (`extractSseToken`; `401 NO_TOKEN` / `401 INVALID_TOKEN`). Treat it as optional.

## 2. Endpoint family

Read routes (all public, all `GET`, all mounted at `/api/v1`):

| Purpose | Path |
| --- | --- |
| Whole-school schedule | `/schools/:schoolId/schedules/published` |
| Section | `/schools/:schoolId/schedules/published/sections/:sectionId` |
| Faculty (ATLAS id) | `/schools/:schoolId/schedules/published/faculty/:facultyId` |
| **Faculty (external id)** | `/schools/:schoolId/schedules/published/faculty-external/:externalFacultyId` |
| Room | `/schools/:schoolId/schedules/published/rooms/:roomId` |
| Explicit school year (whole school) | `/schools/:schoolId/school-years/:schoolYearId/schedules/published` |
| Explicit school year (section / faculty / room / faculty-external) | `…/school-years/:schoolYearId/schedules/published/{sections/:sectionId,faculty/:facultyId,rooms/:roomId,faculty-external/:externalFacultyId}` |

`faculty-external/:externalFacultyId` is the companion-friendly lookup: it resolves by the **external**
faculty identifier you already hold, not by an ATLAS surrogate id.

There are also legacy `:termId` path variants (`/schools/:schoolId/schedules/published/:termId`, and
`:termId/{sections,faculty,rooms}/…`). **Prefer the `termIndex` query form** (§3) — the path form is
kept for compatibility and is not the shape this handoff documents.

## 3. Request contract

| Param | Where | Values | Notes |
| --- | --- | --- | --- |
| `termIndex` | query | `1`, `2`, `3`, `4`, or `active` | `4` is `MAX_ACADEMIC_TERM_INDEX` (`QUARTER_TERM_COUNT = 4`). Anything else → `400 INVALID_TERM_INDEX`. |
| `date` (or `asOfDate`) | query | an ISO date string | Optional; resolves the schedule as of a date. Echoed as `source.requestedDate` / `source.resolvedForDate`. |

**On the whole-school and `faculty-external` read routes, omitting `termIndex` resolves to
`active`** — it does **not** return all terms. Some route variants instead return
`400 TERM_SELECTION_REQUIRED` when no term is chosen (`requireTermSelection` in
`atlas-server/src/routes/published-schedule.router.ts`). **Always send an explicit `termIndex`.**

## 4. Response contract

Top level: `source`, `timeSlots`, `specialEvents`, `entries`.

### 4.1 `source` — the provenance and term-scope block

Live example (`?termIndex=1`, run 315):

```json
{
  "runId": 315, "schoolId": 1, "schoolYearId": 10, "schoolYearLabel": "2031-2032",
  "isActiveSchoolYear": true, "isHistorical": false,
  "publishedAt": "2026-09-18T05:38:27.923Z", "generatedAt": "2026-09-18T05:35:28.968Z",
  "requestedDate": null, "resolvedForDate": "2026-09-22T12:54:32.337Z",
  "activeRevisionId": 42, "activeRevisionEffectiveDate": "2026-09-18T05:38:27.923Z",
  "appliedRevisionIds": [42],
  "revisionMarker": "run=315|published=2026-09-18T05:38:27.923Z|revision=42|effective=2026-09-18T05:38:27.923Z|date=2026-09-22",
  "snapshotState": "FROZEN", "snapshotGaps": [],
  "termScope": "active", "termIndex": 1, "activeTermVerified": true,
  "orderedTerms": [
    { "order": 1, "identity": "T1", "displayLabel": "TERM 1" },
    { "order": 2, "identity": "T2", "displayLabel": "TERM 2" },
    { "order": 3, "identity": "T3", "displayLabel": "TERM 3" }
  ]
}
```

- **`orderedTerms` is the authoritative term list.** Use `displayLabel` for anything a human reads and
  `identity`/`order` as the stable key. Do **not** hardcode "Term 1/2/3" — the count and labels come
  from the upstream ordered-term authority, and the school year is `TRIMESTER` here (T1/T2/T3) while
  `termIndex` still ranges to 4.
- **`termScope` + `termIndex`** state what the payload actually covers. `"active"` means the resolved
  active term, with `termIndex` naming it.
- **`revisionMarker` is the cheapest change-detection key.** Store it and re-fetch when it differs.
  `activeRevisionId` / `appliedRevisionIds` / `activeRevisionEffectiveDate` give the revision detail.
- **`snapshotState` / `snapshotGaps`** describe whether the underlying generation input snapshot is
  frozen or has gaps. Treat `snapshotGaps` non-empty as "this payload may be incomplete" and surface
  it rather than silently rendering.
- `isHistorical` / `isActiveSchoolYear` let you label an archived year correctly.

### 4.2 `entries[]` — the schedule rows

Each entry carries its own `termIndex`, so a multi-term consumer can filter client-side without
guessing:

```json
{
  "entryId": "entry-1::t1", "day": "THURSDAY", "startTime": "06:00", "endTime": "06:45",
  "durationMinutes": 45, "termIndex": 1,
  "subject":  { "id": 4, "code": "AP", "name": "Araling Panlipunan" },
  "section":  { "atlasId": 1350, "externalId": 143, "id": 143, "name": "Aguinaldo",
                "gradeLevel": 17, "gradeLevelName": "Grade 7",
                "programType": "REGULAR", "programCode": "REGULAR", "programName": "Regular" },
  "faculty":  { "atlasId": 39, "externalId": "72", "employeeId": "1000011", "id": 39,
                "name": "VALDEZ, GABRIELA LUZ", "isPlaceholder": false },
  "room":     { "id": 65, "name": "G10 Room 101", "type": "CLASSROOM", "floor": "1",
                "buildingId": 4, "buildingName": "Grade 10 Academic Wing" },
  "entryKind": "SECTION", "cohortCode": null, "cohortName": null,
  "specializationCode": null, "specializationLabel": null
}
```

**Join keys for you:** `faculty.externalId` (string) and `faculty.employeeId` are the identifiers to
match against your own faculty records — prefer those over `faculty.id`/`faculty.atlasId`, which are
ATLAS surrogates. `section.externalId` is the upstream section id. `faculty.isPlaceholder` marks a
non-real assignment; do not present a placeholder as a person.

`timeSlots[]` is `{ "startTime": "06:00", "endTime": "06:45" }` and `specialEvents` is a list of the
school's configured non-teaching windows; use them to render a correct grid rather than inferring
periods from entry times.

### 4.3 Verified counts at the pin

`GET /schools/1/schedules/published?termIndex=1` → **200**, **920 entries**, every entry
`termIndex: 1`. `?termIndex=1|2|3|active` all → 200. `timeSlots` non-empty; `specialEvents` count 5.

## 5. Error contract

| Status | `code` | When |
| --- | --- | --- |
| `400` | `INVALID_TERM_INDEX` | `termIndex` is not `1..4` and not `active` |
| `400` | `TERM_SELECTION_REQUIRED` | the route requires an explicit term and none was supplied |
| `400` | `INVALID_PARAM` | a path id is non-numeric / non-positive |
| `409` | `ACTIVE_SCHOOL_YEAR_AMBIGUOUS` | more than one active school year is configured — the scope cannot be resolved |
| `404`-family | `CURRENT_PUBLISHED_RUN_NOT_FOUND`, `FACULTY_NOT_FOUND` | no published run / unknown faculty |
| `401` | `NO_TOKEN` / `INVALID_TOKEN` | SSE change-feed only |

**Handle `409 ACTIVE_SCHOOL_YEAR_AMBIGUOUS` explicitly** — it means "ask a human which year", not
"retry".

## 6. Migration warning — what changed since the deleted 2026-08-27 doc

If you have a caller written against the deleted doc, these are the breaking differences:

1. **Omitting `termIndex` no longer means "all terms".** It resolves `termScope = "active"` with a
   concrete `termIndex` (observed `1`). The old doc promised a null/all-term read.
2. **The response gained `source.termScope`, `source.orderedTerms`, `source.snapshotState`,
   `source.snapshotGaps`, `source.revisionMarker`, `source.activeRevisionId`,
   `source.appliedRevisionIds`, `source.activeRevisionEffectiveDate`, `source.activeTermVerified`** —
   none of which the old doc described. Use `revisionMarker` for change detection instead of
   re-fetching blindly.
3. **`entries[].termIndex` is now present on every row.**
4. **Term labels must come from `source.orderedTerms`**, not from a hardcoded list.

## 7. Recommended integration

1. `GET …/schedules/published?termIndex=<n>` per term you display, always explicit.
2. Persist `source.revisionMarker`; poll or SSE on change, then refetch.
3. Join faculty on `faculty.externalId` / `faculty.employeeId`; skip `isPlaceholder: true`.
4. Label terms from `source.orderedTerms[].displayLabel`.
5. Surface `snapshotGaps` and `ACTIVE_SCHOOL_YEAR_AMBIGUOUS` to a human rather than degrading silently.

## 8. Acceptance tests

1. **Term scoping:** `?termIndex=1|2|3` each return 200 and every entry's `termIndex` equals the
   requested value.
2. **No implicit all-term read:** omitting `termIndex` must not be treated as "all terms" — assert the
   response declares `source.termScope` and a concrete `source.termIndex`.
3. **Typed rejection:** `?termIndex=0`, `?termIndex=5` and `?termIndex=abc` return
   `400 INVALID_TERM_INDEX`; a non-numeric `:schoolId` returns `400 INVALID_PARAM`.
4. **Change detection:** two successive reads with no regeneration return the same
   `source.revisionMarker`.
5. **Faculty mapping:** `faculty-external/:externalFacultyId` resolves the same person as the
   corresponding `faculty.externalId` in the whole-school payload.
6. **Label authority:** a term whose `displayLabel` differs from `TERM <order>` renders the
   `displayLabel`.

## 9. Scope and open items

- **The API contract is stable at the pin.** ATLAS has two pending *client-side* term-scope lanes
  (`work/timetable-live-term-authority-c01`, `work/public-published-view-term-merge-c01`); **neither
  touches `atlas-server/**`**, so neither moves this contract. You do not need to wait for them.
- **Not covered here:** writing schedules back to ATLAS, Teaching Load, enrolment, and the SSO
  federation handshakes (those are separate handoffs:
  `docs/handoffs/aims-direct-federation-c04.md`, `docs/handoffs/smart-direct-federation-c04.md`).
- **Ask before depending on the legacy `:termId` path variants** — they are compatibility surfaces,
  not the recommended contract.
