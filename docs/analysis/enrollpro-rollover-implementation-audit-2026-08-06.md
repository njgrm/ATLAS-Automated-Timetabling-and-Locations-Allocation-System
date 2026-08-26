# EnrollPro Rollover Implementation Audit

Date: 2026-08-06  
Operator: Codex  
ATLAS target: local ATLAS server bridged to Tailnet surfaces  
EnrollPro active year: `id=1`, `yearLabel=2026-2027`

## Contract Sources Checked

- `D:\EnrollPro\ARCHITECTURE_MICROSERVICES.md`
- `D:\EnrollPro\docs\features\integration\ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md`
- `D:\EnrollPro\docs\features\integration\ENROLLPRO-API.md`

## Implemented Runtime Contract

- EnrollPro remains the active school-year authority.
- ATLAS mirrors EnrollPro active-year metadata in `enrollpro_school_year_mirrors`.
- ATLAS uses EnrollPro school-year IDs directly for new-year scheduling.
- ATLAS does not copy prior-year Teaching Load into ready state.
- ATLAS blocks stale-year generation while EnrollPro is reachable.
- Historical timetable reads remain allowed.

## Live Probe Evidence

- Login with `identifier=1234501`, password `DepEdSY2026!`: PASS; ATLAS issued an officer token.
- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`: PASS.
  - ATLAS selected year: `39`.
  - EnrollPro active year: `1 / 2026-2027`.
  - Drift status: `atlas-stale`.
  - Recommended action: `RUN_ROLLOVER_SYNC`.
- `POST /api/v1/runtime/rollover-sync/preview`: PASS.
  - Faculty count: `24`.
  - Section count: `20`.
  - Settings reachable: `true`.
  - Drift status: `mapping-conflict`.
- `POST /api/v1/runtime/rollover-sync/apply`: correctly blocked.
  - Error code: `SCHOOL_YEAR_MAPPING_CONFLICT`.
  - Reason: ATLAS already has `66` section rows under schoolYearId `1` that do not match EnrollPro 2026-2027's `20` sections.
- `POST /api/v1/generation/1/39/runs`: correctly blocked.
  - Error code: `ACTIVE_YEAR_DRIFT`.
  - Message: `EnrollPro is now on 2026-2027. Sync the new school year before generating schedules.`

## Verification Commands

- `npx prisma generate`: PASS after stopping the locked ATLAS server process.
- `npx prisma migrate deploy`: PASS; migration `0033_add_enrollpro_school_year_mirror` applied.
- `cd atlas-server && npx tsc --noEmit`: PASS.
- `cd atlas-server && npx tsc --outDir dist-rollover-check --declaration false --sourceMap false`: PASS.
- `cd atlas-client && npx tsc --noEmit`: PASS.
- `cd atlas-client && npm run build`: PASS.
- `cd atlas-client && npm run test:ux-guardrails`: PASS `37/37`.
- `cd atlas-client && npm run test:timetable-conflict`: PASS `10/10`.
- `GET /api/v1/health`: PASS after restarting the local ATLAS server via `npm.cmd --prefix atlas-server run dev`.

## Caveats

- `cd atlas-server && npm run build` is blocked by a pre-existing locked generated file in `atlas-server/dist/scripts/verify-cross-repo-source-gate.js`; source type-check and alternate emit passed.
- The safety policy blocked cleanup of generated `atlas-server/dist-rollover-check`; it should be removed manually when file deletion is available.
- Rollover apply intentionally remains blocked until the schoolYearId `1` collision is resolved.

## Next Required Decision

Resolve the direct-ID collision before applying EnrollPro 2026-2027:

1. archive/rename legacy ATLAS year `1` data, then rerun apply; or
2. explicitly approve a mapping-layer approach instead of direct EnrollPro IDs.

