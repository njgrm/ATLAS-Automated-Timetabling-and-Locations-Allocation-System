# Active Term Integration Release Proof — 2026-08-22

## Overview

This document provides end-to-end verification evidence for the EnrollPro active-term integration across ATLAS backend and frontend.

## Build and Test Gates

### Server
```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit                    # PASS
npm run build                       # PASS
npm run test:workbook-export        # 20/20 PASS
```

### Client
```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit                    # PASS
npm run build                       # PASS (814ms)
npm run test:ux-guardrails          # 84/84 PASS
npm run test:timetable-conflict     # 10/10 PASS
```

## Secret Hygiene

```bash
git grep -n "ENROLLPRO_SERVICE_TOKEN" -- .  # Env var name appears in .env.example, docs, source (process.env reads), tests (mock setup), and dist
git grep -n "sk_live_" -- .                   # No matches - no actual secret values tracked
git check-ignore -v .env atlas-server/.env    # All ignored
```

**Result:** The env var *name* `ENROLLPRO_SERVICE_TOKEN` appears in source code (as `process.env.ENROLLPRO_SERVICE_TOKEN`), test files (for mock setup), and documentation. No actual secret *values* (e.g., `sk_live_...`) are tracked in any file. All `.env` files are gitignored.

## Tailnet Runtime Context Proof

### Endpoint
```
GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true
```

### Response (verified)
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

## Implementation Summary

### Prompt 01 — Backend Active-Term Adapter
- Created `active-term-adapter.service.ts` with T1/T2/T3 normalization
- Added `activeTerm` to runtime context response
- Parallelized school-year and active-term fetches

### Prompt 01A/01B — QA Fixes
- Distinct `enrollpro-contract-drift` source for invalid payloads
- Guard prevents contract-drift messages from being overwritten

### Prompt 02 — Client Runtime Consumption
- Added `activeTerm` to `AtlasRuntimeContext` and `ActiveSchoolYearContext`
- Active-term badge in AppShell header
- Cache key bumped to v2

### Prompt 03/03A/03B — Timetable Defaults and Guards
- Term filter defaults to active term when verified
- User override preserved across refreshes
- 16 regression tests for term filter behavior

### Prompt 04 — Teaching Load and Dashboard Readiness
- Active term highlighted in WorkloadInspector T1/T2/T3 grid
- Active Term badge on Dashboard
- `activeTermIndex` added to `useTeachingLoadData` and `useDashboardData`

### Prompt 05 — Published, Export, and Notification Contracts
- `?termIndex=1|2|3|active` query parameter on published schedule endpoints
- `termScope`, `termIndex`, `activeTermVerified` in response source
- Workbook export supports term filtering
- `501 TERM_FILTER_NOT_READY` for unverifiable active term

## Endpoint Summary

| Endpoint | Active Term Support |
|----------|-------------------|
| `GET /api/v1/runtime/context` | Returns `activeTerm` object |
| `GET /schools/:schoolId/schedules/published` | `?termIndex=1\|2\|3\|active` |
| `GET /schools/:schoolId/schedules/published/sections/:sectionId` | `?termIndex=1\|2\|3\|active` |
| `GET /schools/:schoolId/schedules/published/faculty/:facultyId` | `?termIndex=1\|2\|3\|active` |
| `GET /schools/:schoolId/schedules/published/rooms/:roomId` | `?termIndex=1\|2\|3\|active` |
| `GET /:schoolId/:schoolYearId/runs/:runId/export/summary-teacher-schedule.xlsx` | `?termIndex=1\|2\|3\|active` |
| `GET /:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx` | `?termIndex=1\|2\|3\|active` |

## Key Behaviors

1. **Active term source:** EnrollPro owns active term; ATLAS consumes it via `/integration/v1/active-term`
2. **Fallback:** When EnrollPro is unreachable, ATLAS uses saved context with `activeTerm.source = "enrollpro-unreachable"`
3. **Contract drift:** Invalid term values return `source: "enrollpro-contract-drift"` with `code: "ACTIVE_TERM_CONTRACT_DRIFT"`
4. **Term filtering:** Invalid `termIndex` values return `400 INVALID_TERM_INDEX`; entries lacking `termIndex` cause `501 TERM_FILTER_NOT_READY` for term-filtered reads
5. **Integration key:** Never transmitted to browser; server-side only via `X-Integration-Key` header

## Files Changed

### Backend
- `atlas-server/src/services/active-term-adapter.service.ts` (new)
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/workbook-export.service.ts`
- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/routes/generation.router.ts`
- `atlas-server/src/__tests__/runtime-context-active-term.test.ts` (new)

### Frontend
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useDashboardData.ts`
- `atlas-client/src/components/timetable/TimetableToolbar.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/lib/__tests__/timetable-term-filter.test.ts` (new)

## Remaining Caveats

- Live Tailnet verification requires `ATLAS_SYSTEM_TOKEN` or valid JWT for `/runtime/context`
- Active-term behavior depends on EnrollPro availability; graceful degradation confirmed
