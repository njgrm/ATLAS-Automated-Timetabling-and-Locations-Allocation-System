# Mimo Prompt 04 — Term Route Contract Correction

## Role

You are the ATLAS public API executor. Remove the ambiguity between term filtering and school-year filtering in public published schedule routes.

Do not begin this prompt until Prompt 03 receives Codex QA `GO`.

## Problem

`GET /api/v1/schools/:schoolId/schedules/published/:termId` is documented as term-specific, but the current implementation passes the path parameter into a service argument named and used as `schoolYearId`.

This is dangerous for AIMS because `/published/5` can look like “term 5” while actually returning `schoolYearId=5`.

## Target files

- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/__tests__/published-schedule-term-routes.test.ts`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`

## Preferred new term endpoints

Add explicit term routes under the explicit school-year namespace:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/terms/:termId
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/terms/:termId/sections/:sectionId
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/terms/:termId/faculty/:facultyId
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published/terms/:termId/rooms/:roomId
```

## Requirements

### Functional requirements

- When AIMS requests a term-specific published schedule, the system shall filter entries by term within the requested school year.
- If term metadata is unavailable on entries, then the system shall return `501 TERM_FILTER_NOT_READY` rather than using the term ID as a school-year ID.
- When AIMS calls the old ambiguous `/:termId` route, the system shall not interpret that value as a school-year ID.
- Where backward compatibility is retained, the system shall either redirect/document deprecation or return a clear deprecation warning in source metadata.
- The system shall preserve non-term explicit school-year routes from Prompt 03.

## Implementation guidance

- Inspect generated entries for their existing `termIndex` or equivalent field before implementing term filtering.
- If `termIndex` is reliable, filter by it.
- If `termIndex` is not reliable, return `501 TERM_FILTER_NOT_READY` with a clear message.
- Do not break the current default `/published` active-year route.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Add/run backend tests proving:

- New explicit term route filters by term within a school year.
- Old ambiguous route does not masquerade as school-year lookup.
- `TERM_FILTER_NOT_READY` is returned if term data is not available.
- Explicit school-year route from Prompt 03 remains unaffected.

Tailnet proof:

1. Probe explicit school-year route.
2. Probe explicit term route for a valid term if data supports it.
3. Probe old ambiguous route and capture its new behavior.

## Acceptance criteria

- Term filtering and school-year filtering are no longer ambiguous.
- AIMS has a route shape that is hard to misuse.
- Old route behavior is safe and documented.
