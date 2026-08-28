# Home-Room Grade Scope Prompt 01 - Baseline Contract

## Role

You are the ATLAS investigation executor. Do not implement feature code in this prompt. Establish the exact current baseline and identify blockers before the schema/API work begins.

## Problem

ATLAS is EnrollPro-aligned for active school year and active term, but the latest dummy-data generation run is not publishable because hard `UNASSIGNED_SECTION` violations remain. Before adding building grade scope or auto-assignment, prove whether those violations are warnings, homeroom-driven setup gaps, Teaching Load feasibility pressure, or a combination.

## Target files to inspect

- `prisma/schema.prisma`
- `atlas-server/src/routes/map.router.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Required investigation

1. Read the sequence file:
   - `docs/phases/home-room-auto-assign-and-building-grade-scope-sequence-2026-08-26.md`
2. Confirm worktree state before touching anything.
3. Authenticate against Tailnet as Admin.
4. Capture current runtime context:
   - `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`
5. Capture current rollover status:
   - `GET /api/v1/runtime/rollover-status?schoolId=1&includeCounts=true`
6. Capture latest run summary:
   - `GET /api/v1/generation/:schoolId/:schoolYearId/runs/latest`
7. Capture latest violation report:
   - `GET /api/v1/generation/:schoolId/:schoolYearId/runs/latest/violations`
8. Capture current section summary and home-room options:
   - `GET /api/v1/sections/summary/:schoolYearId?schoolId=1`
   - `GET /api/v1/sections/home-rooms/:schoolYearId?schoolId=1`
9. Capture Teaching Load summary and coverage:
   - `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=:schoolYearId&pageSize=100`
   - `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=:schoolYearId`

## Required analysis

Report all of the following:

- Active school year and active term.
- Latest run ID, status, assigned count, unassigned count, hard violation count, and soft violation count.
- Violation counts by code and severity.
- Whether hard violations are publish blockers.
- Current section count.
- Sections with `homeRoomId`.
- Sections missing `homeRoomId`.
- Home-room room option count.
- Home-room room count by building.
- Current building fields available in API and Prisma.
- Whether `Building` has any persisted grade-scope field.
- Whether room `buildingZoneId` or section `buildingZoneId` can safely stand in for grade scope.
- Teaching Load coverage totals.
- Number of active faculty over cap.
- Top overloaded faculty by load percentage.
- Whether the latest hard violations appear primarily caused by homeroom absence, Teaching Load overload, or both.

## Acceptance criteria

- The executor shall not change source files in this prompt.
- The executor shall distinguish hard violations from soft warnings.
- The executor shall identify whether the latest run is publishable.
- The executor shall prove whether all sections are missing home rooms.
- The executor shall prove whether building grade scope already exists.
- The executor shall record a GO/NO-GO recommendation for Prompt 02 in the final sequence handoff.

## Verification commands

```bash
cd D:\ATLAS
git --no-optional-locks status --short
```

Tailnet probes are required. Do not claim GO from source-only evidence.

## Per-prompt evidence required

Record this prompt's evidence for the final sequence handoff. Include a compact table of violation buckets by severity and a compact table of section home-room readiness by grade. Continue to Prompt 02 unless the baseline proves the active runtime cannot be queried at all.
