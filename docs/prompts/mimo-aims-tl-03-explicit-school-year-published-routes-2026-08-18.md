# Mimo Prompt 03 — Explicit School-Year Published Schedule Routes

## Role

You are the ATLAS public API executor. Add explicit school-year routes so AIMS can request current or historical schedules intentionally.

Do not begin this prompt until Prompt 02 receives Codex QA `GO`.

## Problem

AIMS needs stable school-year-specific published schedule reads. The current public route set is ambiguous because the default endpoint selects a schedule without an explicit school year, and the `/:termId` route is currently confused with school-year filtering.

## Target files

- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/__tests__/published-schedule-school-year-routes.test.ts`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`

## New endpoints

Add:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/sections/:sectionId
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/faculty/:facultyId
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/rooms/:roomId
```

## Requirements

### Functional requirements

- When AIMS requests an explicit school-year published schedule, the system shall return only a published run for that school year.
- If the requested school year has no published run, then the system shall return `404 PUBLISHED_RUN_NOT_FOUND`.
- When the requested school year is not the active school year, the system shall mark the payload as historical.
- When the requested school year is the active school year, the system shall mark the payload as active.
- The system shall keep section, faculty, and room filters scoped to the requested school year.
- The system shall preserve `date` and `asOfDate` revision-effective reads.

## Source metadata contract

Extend response `source`:

```json
{
  "runId": 425,
  "schoolId": 1,
  "schoolYearId": 5,
  "schoolYearLabel": "2026-2027",
  "isActiveSchoolYear": false,
  "isHistorical": true,
  "publishedAt": "...",
  "generatedAt": "..."
}
```

If school-year label cannot be resolved, use `null` and do not fabricate.

## Implementation guidance

- Keep the existing service signature clean. Prefer an options object if adding more parameters.
- Do not break existing public routes in this prompt.
- Do not use term route paths for school-year filtering.
- Use efficient metadata selection before reading full `draftEntries`.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Add/run backend tests proving:

- Explicit active-year request returns active source metadata when a published run exists.
- Explicit historical-year request returns historical source metadata when a published run exists.
- Explicit missing-year request returns `404 PUBLISHED_RUN_NOT_FOUND`.
- Section/faculty/room explicit school-year filters do not leak entries from other years.

Tailnet proof:

1. Read active year from runtime context.
2. Probe explicit active-year endpoint.
3. Probe explicit known historical endpoint if one exists.
4. Confirm source metadata accurately identifies active vs historical.

## Acceptance criteria

- AIMS has a stable explicit school-year route.
- Historical access is intentional, not fallback behavior.
- Current and historical schedules are clearly labeled in response metadata.
