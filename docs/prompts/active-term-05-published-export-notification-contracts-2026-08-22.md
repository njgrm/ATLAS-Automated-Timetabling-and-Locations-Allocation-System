# Active Term Prompt 05 — Published, Export, and Notification Contracts

## Role

You are the ATLAS API/export executor. Make published schedules, workbook exports, and notifications active-term aware without reintroducing the old `:termId` route ambiguity.

## Problem

Other systems need schedule data for the active term, but the legacy published path named `:termId` was ambiguous and unsafe. ATLAS also has workbook exports and notification events that would be clearer if they include active-term context.

## Target files

- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/routes/generation.router.ts`
- `atlas-server/src/services/workbook-export.service.ts` or existing workbook export service
- `atlas-server/src/services/notification-events.service.ts`
- `atlas-client/src/hooks/useNotificationStream.ts`
- API docs updated in Prompt 06
- Add focused backend tests if needed

## Requirements

### Functional requirements

- Where published schedule filtering is implemented, the system shall support explicit `termIndex=1|2|3`.
- Where active-term filtering is implemented, the system shall support `termIndex=active` only when runtime active term is verified.
- If `termIndex=active` is requested and active term cannot be verified, then the system shall return a clear error instead of silently using all terms.
- If persisted entries lack reliable `termIndex`, then the system shall return `501 TERM_FILTER_NOT_READY` for term-filtered reads.
- The system shall not use `/schools/:schoolId/schedules/published/:termId` as the new term-filtering contract.
- Workbook export endpoints shall support active-term defaults or explicit all-term export without changing source run data.
- Notification events for publish, revision, generation, and timetable changes shall include term metadata when the affected term is known.

### Non-functional requirements

- Published schedule slice reads shall remain memory-sensitive.
- Term filtering shall be pushed as close to the targeted payload extraction path as safely possible.
- API responses shall expose whether the payload is all-term, explicit-term, or active-term filtered.

## Implementation guidance

- Prefer query parameters over new ambiguous path segments:
  - `?termIndex=1`
  - `?termIndex=2`
  - `?termIndex=3`
  - `?termIndex=active`
  - `?termScope=all`
- Add response source fields such as:
  - `source.termScope`
  - `source.termIndex`
  - `source.activeTerm`
  - `source.activeTermVerified`
- Keep unfiltered reads backward compatible.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npm run test:workbook-export
```

Run focused published-schedule tests that prove:

- unfiltered reads are unchanged
- explicit term reads filter correctly
- `termIndex=active` maps to EnrollPro active term
- missing/unreliable `termIndex` returns a clear failure

Live Tailnet probe:

1. Resolve runtime active term.
2. Call current published schedule endpoint without term filtering.
3. Call the same endpoint with `termIndex=active`.
4. Export summary workbook with active-term scope if implemented.
5. Confirm notifications include term metadata on test-safe events.

## Acceptance criteria

- New term filtering uses query parameters, not legacy path ambiguity.
- Active-term schedule reads are clearly labeled in `source`.
- Workbook exports can distinguish active-term from all-term output.
- Notifications include term metadata where available.
- Existing public published schedule consumers remain backward compatible.

## Final report required

Report exact endpoint shapes implemented, source metadata returned, workbook behavior, and notification metadata proof.
