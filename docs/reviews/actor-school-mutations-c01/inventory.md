# ACTOR-SCHOOL-MUTATIONS-C01 inventory

Base inspected: `c08cc7d37e57ae2c31ac3432f3d0df917cadf506` (`origin/main`)

## Finding

`atlas-server/src/routes/runtime.router.ts:26` defines `parseSchoolId` as
`Number(raw ?? 1)`. The eight mutation HTTP routes below invoke it with
`req.body?.schoolId ?? req.query.schoolId`. Each route uses
`authenticateWithSystemToken`, which accepts either a system token or a JWT. A
JWT actor therefore reaches the route with a request-controlled school value,
or omitted value defaulting to school 1, without a route-level actor-school
comparison. The routes use role checks where noted, but role is not tenancy.

`ACTOR-SCOPE-C01`'s `authorizeRuntimeRead` (same file, lines 58-94) is a
read-route-only control. It is not called by the following mutations.

| File:line | Method and route | Current school parsing | JWT actor-school cross-check | Notes |
| --- | --- | --- | --- | --- |
| `atlas-server/src/routes/runtime.router.ts:164` | `POST /api/v1/runtime/rollover-recovery/mark-test-data` | Defaults to `1` when body/query is absent | No | Privileged-role check only; calls `markSchoolYearAsTestData`. |
| `atlas-server/src/routes/runtime.router.ts:189` | `POST /api/v1/runtime/rollover-recovery/scaffold` | Defaults to `1` when body/query is absent | No | Privileged-role check only; enters `withSchoolLock` then scaffolds recovery state. |
| `atlas-server/src/routes/runtime.router.ts:233` | `POST /api/v1/runtime/rollover-recovery/apply` | Defaults to `1` when body/query is absent | No | Privileged-role check only; enters `withSchoolLock` then applies recovery. |
| `atlas-server/src/routes/runtime.router.ts:258` | `POST /api/v1/runtime/rollover-sync/preview` | Defaults to `1` when body/query is absent | No | No privileged-role check; invokes preview service. It remains in scope because it is a runtime mutation-family `POST` and must not dispatch under rejected scope. |
| `atlas-server/src/routes/runtime.router.ts:276` | `POST /api/v1/runtime/rollover-sync/apply` | Defaults to `1` when body/query is absent | No | Privileged-role check only; locks, applies sync, then emits notifications. |
| `atlas-server/src/routes/runtime.router.ts:329` | `POST /api/v1/runtime/rollover-sync/reset-dummy-year` | Defaults to `1` when body/query is absent | No | Privileged-role check only; locks, resets, applies, then emits notifications. |
| `atlas-server/src/routes/runtime.router.ts:375` | `POST /api/v1/runtime/rollover-archive/preview` | Defaults to `1` when body/query is absent | No | Privileged-role check only; enters `withSchoolLock` for preview. |
| `atlas-server/src/routes/runtime.router.ts:393` | `POST /api/v1/runtime/rollover-archive/apply` | Defaults to `1` when body/query is absent | No | Privileged-role check only; locks and archives/syncs. |

## Authority contract proposed for review

For all eight routes, a missing, empty, malformed, zero, negative, or
fractional target school must return `400 INVALID_PARAM` before service,
upstream, lock, database, or notification dispatch. A system token may act on
an explicitly supplied valid target school; that parameter is the system
caller’s auditable target declaration. A JWT caller must be a privileged actor
with a positive actor school matching that target; missing actor school returns
`403 SCHOOL_SCOPE_REQUIRED` and a mismatch returns
`403 CROSS_SCHOOL_DENIED`. This mirrors the existing read-route distinction
without treating a system token as an implicit school-1 actor.

## Inventory boundary

This inventory is limited to `parseSchoolId` defaulting sites on runtime
mutation routes. `GET /rollover-recovery/preview` at line 215 is a defaulting
read route, but is outside the requested mutation inventory. The term-authority
`POST` routes at lines 468 and 482 already use the separate JWT-only
`authorizeTermAuthorityCaller` and are not listed as gaps.
