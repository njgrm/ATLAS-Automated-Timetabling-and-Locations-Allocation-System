# Active Term Prompt 01 — Runtime Contract

## Role

You are the ATLAS backend executor for EnrollPro active-term integration. Implement the backend active-term pull contract and expose it through ATLAS runtime context.

## Problem

EnrollPro now exposes `GET /api/integration/v1/active-term` as the master active-term source. ATLAS already resolves active school year, but it does not expose the active term through `/api/v1/runtime/context`, so pages and downstream contracts cannot safely default to the current term.

## Target files

- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/routes/runtime.router.ts`
- `atlas-server/src/__tests__/runtime-context-active-term.test.ts`
- Add a focused service file if cleaner:
  - `atlas-server/src/services/active-term-adapter.service.ts`

## Requirements

### Functional requirements

- When ATLAS resolves runtime context with upstream verification enabled, the system shall fetch EnrollPro active term from `/integration/v1/active-term`.
- When fetching EnrollPro active term, the system shall authenticate with `X-Integration-Key: <ENROLLPRO_SERVICE_TOKEN>`.
- When EnrollPro returns `activeTerm` as `T1`, `T2`, or `T3`, the system shall normalize it to `termIndex` `1`, `2`, or `3`.
- When EnrollPro returns active-term `schoolYearId`, the system shall compare it with the runtime active school year.
- If the active-term school year differs from the active runtime school year, then the system shall mark active-term status as mismatched without changing selected runtime school year.
- If EnrollPro active-term fetch fails, then the system shall return runtime context with active-term verification marked unavailable.
- The system shall not persist EnrollPro active term as schedule truth.

### Non-functional requirements

- The active-term fetch shall use a bounded timeout.
- The active-term fetch shall not log or return the integration key.
- Runtime context response shape shall remain backward compatible for existing clients.
- Tests shall cover success, unreachable upstream, invalid term value, and school-year mismatch.

## Implementation guidance

- Add a typed runtime field similar to:

```json
{
  "activeTerm": {
    "source": "enrollpro-verified",
    "reachable": true,
    "verified": true,
    "activeTerm": "T1",
    "termIndex": 1,
    "schoolYearId": 2,
    "matchedSchoolYear": true,
    "message": "ATLAS is aligned with EnrollPro active term T1."
  }
}
```

- Use `source="atlas-unverified"` or similar when `verifyUpstream=false`.
- Use `source="enrollpro-unreachable"` when `verifyUpstream=true` but EnrollPro cannot be reached.
- Keep active-year drift and active-term drift separate.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npx tsx src/__tests__/runtime-context-active-term.test.ts
```

Live Tailnet probe:

1. Login as Admin.
2. Call `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`.
3. Confirm response includes active term from EnrollPro.
4. Confirm active term maps `T1/T2/T3` to `termIndex`.
5. Confirm no token appears in output or logs.

## Acceptance criteria

- `/runtime/context?verifyUpstream=true` returns `activeTerm.verified=true` when EnrollPro responds.
- `/runtime/context?verifyUpstream=false` does not force an EnrollPro active-term call.
- Active-term failure does not break runtime school-year context.
- Invalid EnrollPro active-term values are surfaced as contract drift.
- Tests prove all of the above.

## Final report required

Report the active-term payload shape, live Tailnet result, and whether the endpoint used live EnrollPro verification or fallback.
