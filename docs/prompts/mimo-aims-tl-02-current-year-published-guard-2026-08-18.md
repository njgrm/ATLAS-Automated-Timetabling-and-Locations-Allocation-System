# Mimo Prompt 02 — Current-Year Published Schedule Guard

## Role

You are the ATLAS public API executor. Fix the default AIMS-facing published schedule endpoint so it cannot silently return a historical or dummy run as the current schedule.

Do not begin this prompt until Prompt 01 receives Codex QA `GO`.

## Problem

Live Tailnet showed:

- Runtime active school year resolved to `2`.
- `GET /api/v1/schools/1/schedules/published` returned run `425` from `schoolYearId=5`.

That is unsafe for AIMS. The default public endpoint should represent the current active school year, not the latest published run across all years.

## Target files

- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/enrollpro-rollover.service.ts`
- `atlas-server/src/__tests__/published-schedule-current-year.test.ts` or equivalent
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md` only if needed for interim notes

## Requirements

### Functional requirements

- When `GET /api/v1/schools/:schoolId/schedules/published` is called, the system shall resolve the current active ATLAS school year before selecting a published run.
- When a current active-year published run exists, the system shall return only that active-year published schedule.
- If no current active-year published run exists, then the system shall return `404 CURRENT_PUBLISHED_RUN_NOT_FOUND`.
- If no current active-year published run exists, then the system shall not fall back to a historical published run.
- If active-year resolution is unavailable, then the system shall return a plain integration-state error instead of guessing from historical runs.
- The system shall continue to allow explicitly requested historical school years in later prompts, but not through the default endpoint.

## Expected error response

```json
{
  "code": "CURRENT_PUBLISHED_RUN_NOT_FOUND",
  "message": "No published schedule is available for the current school year yet.",
  "actionHint": "Build Teaching Load, generate a timetable, and publish the current school-year schedule before AIMS syncs."
}
```

## Implementation guidance

- Do not scan every completed run with full `draftEntries` payload just to find the current schedule.
- Reuse existing runtime active-year resolver/mirror logic where possible.
- Keep public endpoint unauthenticated.
- Keep historical read support out of the default endpoint.
- Keep date/asOfDate revision behavior intact for the selected active-year run.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Add/run backend tests proving:

- Default endpoint selects only active-year published run.
- Default endpoint returns `CURRENT_PUBLISHED_RUN_NOT_FOUND` when only historical published runs exist.
- Default endpoint does not return historical run metadata when active year has no published run.
- Date/asOfDate revision options still apply to the selected active-year run.

Tailnet proof:

1. Read `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`.
2. Read `/api/v1/schools/1/schedules/published`.
3. Confirm returned `source.schoolYearId` equals runtime active school year, or confirm `404 CURRENT_PUBLISHED_RUN_NOT_FOUND`.
4. Confirm it no longer returns run `425` from `schoolYearId=5` unless active year is actually `5`.

## Acceptance criteria

- AIMS cannot accidentally sync an old published run as current.
- Default endpoint source metadata is active-year consistent.
- If no active-year published schedule exists, AIMS receives a readable 404.
- No Teaching Load proposal data is exposed.
