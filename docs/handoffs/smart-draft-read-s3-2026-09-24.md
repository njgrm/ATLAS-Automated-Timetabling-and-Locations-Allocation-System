# SMART handoff — reading a teacher's ATLAS **draft** schedule (SMART-DRAFT-READ-S3)

**To:** the SMART owners. **From:** ATLAS, 2026-09-24.
**Contract pin:** ATLAS release `70a5160819349f5ea0742b839c11606e8408185d` (short `70a51608`),
served at `https://njgrm.buru-degree.ts.net`. Source base `530e3b19`.

The full contract is `docs/reference/aims-smart-term-aware-published-schedule-handoff-2026-09-22.md`
(§8A is the draft family; §4.3–§4.5 cover rooms and breaks). This page is the short operator view.

## What "draft" means vs published

- **Published** (`…/schedules/published…`) is public, revision-pinned, and frozen. It is the
  authoritative schedule for students/parents. Read it with the published family.
- **Draft** (`…/schedules/draft…`) is the scheduler's **unpublished working** timetable. It is NOT
  public, has no revisions, and can change at any time (including disappearing when the run is
  published or a newer run replaces it).
- A **published run is never a draft**. Once a run is published, the draft family stops serving it:
  a read returns `404 DRAFT_RUN_NOT_FOUND` and the run cannot be shared.

## When you may call it

Only while a scheduler has turned ON **"Share draft with teachers"** for that run. The switch is
**per run**, **default OFF**, and only a `COMPLETED`, `FULL`, unpublished run can be shared. If it is
off, every read fails `403 DRAFT_SHARING_DISABLED` with no payload — that is expected, not an error to
retry. Do not poll for sharing; treat `403 DRAFT_SHARING_DISABLED` as "no draft available right now".

## Authentication

Reads accept the ATLAS **system token / integration key** (same credential you already use for other
ATLAS companion endpoints): send it as `X-Integration-Key: <token>` or
`Authorization: Bearer <ATLAS_SYSTEM_TOKEN>`. No credential → `401 NO_TOKEN`.

## What to call

Always send an explicit `termIndex` (`1..4` or `active`) — it is mandatory and is validated against
the verified ordered-term contract. Missing → `400 TERM_INDEX_REQUIRED`.

| Purpose | Path |
| --- | --- |
| One teacher (your external faculty id) | `GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/draft/faculty-external/:externalFacultyId?termIndex=<n>` |
| One section | `GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/draft/sections/:sectionId?termIndex=<n>` |

**There is no whole-run / whole-school draft read.** The path
`GET …/schedules/draft` is deliberately absent and returns a plain `404` (locked decision D3:
never expose whole-school drafts). Only the two scoped reads exist. **For a teacher's own schedule,
always use `faculty-external` with that teacher's external id.** ATLAS also refuses a self-identified
teacher reading another teacher's draft (`403 CROSS_FACULTY_DENIED`).

## What you get

The draft report plus an additive provenance block:

```json
{
  "source": {
    "runId": 317, "schoolId": 1, "schoolYearId": 10,
    "termScope": "explicit", "termIndex": 2,
    "orderedTerms": [{ "order": 1, "identity": "T1", "displayLabel": "TERM 1" }],
    "isDraft": true, "runStatus": "COMPLETED", "draftSharedWithTeachers": true,
    "inputFingerprint": "…", "inputStateStatus": "FRESH"
  },
  "entries": [ /* term-filtered, scope-filtered draft rows */ ],
  "unassignedItems": [],
  "version": 4, "finishedAt": "…", "createdAt": "…", "status": "COMPLETED", "runId": 317
}
```

- **Change detection:** store `runId` + `version` + `inputFingerprint`; re-fetch when any differs.
- **Term labels:** use `source.orderedTerms[].displayLabel`, never a hardcoded list.
- **Entry shape is raw** (`roomId`, `sectionId`, `subjectId` are ATLAS surrogate ids, not the
  published nested objects). Map names from the published whole-school payload or your own mirrors;
  `room.id` is the ATLAS `Room.id` and there is no external room id (see the published doc §4.3).
- **Breaks are not in `entries[]`** — they live in the published `specialEvents[]`; a draft read does
  not give you break bands (see the published doc §4.4).

## Errors you must handle

| Status | `code` | Meaning / action |
| --- | --- | --- |
| `401` | `NO_TOKEN` | send your system token |
| `403` | `DRAFT_SHARING_DISABLED` | no draft shared right now — show "no draft available", do not retry hot |
| `403` | `CROSS_FACULTY_DENIED` | a self-identified teacher asked for another teacher's draft |
| `404` | `DRAFT_RUN_NOT_FOUND` | no draft run, or the latest run is published |
| `404` | `FACULTY_NOT_FOUND` | unknown `externalFacultyId` |
| `400` | `TERM_INDEX_REQUIRED` / `INVALID_TERM_INDEX` / `TERM_INDEX_OUTSIDE_CONTRACT` | fix the term parameter |
| `409` | `TERM_STRUCTURE_UNAVAILABLE` / `TERM_SELECTION_REQUIRED` | the ordered term authority is unresolved — ask a human |
| `501` | `TERM_FILTER_NOT_READY` | the run's entries lack reliable term identity; ask a human |

## Do not

- Do not treat a draft as published, revision-stable, or student-facing.
- Do not attempt to read a published run as a draft.
- Do not cache a draft across a published transition.
- Do not write — this family is read-only; there is no companion write path.

## Acceptance (what ATLAS proved)

`atlas-server/src/__tests__/smart-draft-read-s3.test.ts` (on a disposable PostgreSQL) proves:
scoped-only reads, toggle-off typed failure with zero payload, `401` unauthenticated, `404` unknown
faculty, typed `400` term errors, published-run read `404` / share `409`,
`403 CROSS_FACULTY_DENIED`, and that the whole-run path is absent (`404`).
