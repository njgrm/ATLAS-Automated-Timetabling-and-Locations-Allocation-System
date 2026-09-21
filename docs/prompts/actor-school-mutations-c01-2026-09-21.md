# ACTOR-SCHOOL-MUTATIONS-C01 — runtime mutation actor-school authority

Status: **PROPOSED — source-only packet awaiting Lane A review.**

Risk: **MEDIUM** server authorization correction. This packet changes no
database schema, configuration, runtime process, deployment, browser state, or
companion repository.

Base: `c08cc7d37e57ae2c31ac3432f3d0df917cadf506` (`origin/main`).

## Objective

Make each listed runtime mutation route fail closed on a missing or malformed
target school and prevent a JWT actor from operating on another school. Retain
the existing explicit system-token capability, but require that machine caller
to declare its target school rather than silently receiving school 1.

## Scope

In scope:

- `POST /api/v1/runtime/rollover-recovery/mark-test-data`
- `POST /api/v1/runtime/rollover-recovery/scaffold`
- `POST /api/v1/runtime/rollover-recovery/apply`
- `POST /api/v1/runtime/rollover-sync/preview`
- `POST /api/v1/runtime/rollover-sync/apply`
- `POST /api/v1/runtime/rollover-sync/reset-dummy-year`
- `POST /api/v1/runtime/rollover-archive/preview`
- `POST /api/v1/runtime/rollover-archive/apply`

Out of scope:

- all client, runtime, deployment, browser, database, migration, generation,
  publication, rollover execution, environment, or companion-repository work;
- the existing runtime read-route and JWT-only term-authority contracts;
- changing a service’s business behavior after authorization succeeds;
- changing role policy beyond applying the existing privileged-role rule where
  the route already has one.

## Boundaries

- Keep the `authenticateWithSystemToken` dual-auth contract explicit:
  `authSource === 'system'` may target any *explicit, valid* school; JWT callers
  must have a positive actor school equal to the requested school.
- Preserve `body.schoolId ?? query.schoolId` precedence where a route already
  accepts both locations; remove only the default-to-1 behavior.
- Reject before `withSchoolLock`, every runtime service, upstream request,
  Prisma operation, audit write, and notification dispatch.
- Keep relative server imports ESM-safe with `.js` endings.
- Do not broaden this packet to the `GET` recovery preview or any unrelated
  mutation router without a separate inventory and review.

## Authorized paths

- `atlas-server/src/routes/runtime.router.ts`
- `atlas-server/src/__tests__/runtime-router-actor-school-mutations.test.ts`
- `atlas-server/package.json` — only the script that reaches the new test

## Implementation approach

Add one route-local caller-authorization helper in `runtime.router.ts` for the
eight listed POST routes. It shall parse an explicit positive target school;
distinguish system from JWT callers using the middleware’s existing
`req.user.authSource`; enforce existing route role requirements; enforce a
positive JWT actor school and equality with the target; and return the
authorized target only after those checks. Each listed handler shall use that
result before its first side effect. The existing term-authority helper is a
reference contract, not a target for duplication or modification.

## Acceptance rows

| ID | Requirement | Deciding harness |
| --- | --- | --- |
| A1 | Every listed route shall reject omitted, empty, malformed, zero, negative, and fractional `schoolId` with `400 INVALID_PARAM`. | New mounted Express test using the real runtime router and `authenticateWithSystemToken`; instrumented unconnected Prisma/upstream counters must remain zero. |
| A2 | When a JWT privileged actor lacks a positive actor school, each listed route shall return `403 SCHOOL_SCOPE_REQUIRED` and dispatch no lock, service, upstream, database, audit, or notification work. | Same mounted negative matrix with injected unconnected Prisma and upstream request counter. |
| A3 | When a JWT privileged actor requests another school, each listed route shall return `403 CROSS_SCHOOL_DENIED` and dispatch no work. | Same mounted negative matrix. |
| A4 | When a JWT privileged actor requests its own school, authorization shall pass through the route gate without replacing business-result semantics. | Mounted route harness using a disposable PostgreSQL fixture or a narrowly injected service seam, one representative route per service family; no shared database. |
| A5 | When a valid system token supplies an explicit positive school, the route shall retain the documented machine-target capability; when it omits school, it shall fail A1. | Same mounted matrix, with system-token headers and explicit target cases. |
| A6 | Existing non-privileged rejections shall remain `403 FORBIDDEN` for routes that currently require the privileged role. | Mounted matrix across the seven currently role-gated routes. |
| A7 | The new test shall be reachable from a committed `atlas-server/package.json` script, and that script plus one relevant preservation suite shall pass. | `npm run <new-script>` and the existing runtime read-scope test script or its recorded literal `tsx` command. |
| A8 | Type-check/build shall pass and the built server shall start only on an isolated test port, if the existing server test harness requires a process start. | `npm run build`; isolated start probe only if the harness cannot mount Express in-process. Never use 5001/5174/5175. |

## Verification sequence

1. Add the mounted negative matrix first and demonstrate the current defaulting
   behavior fails it.
2. Apply the smallest route-local authority helper and update only the eight
   handlers.
3. Run the new reachable script, the retained runtime read-scope preservation
   suite, server type-check/build, and `git diff --check`.
4. Record literal commands and outcomes in the executor handoff. Source proof
   is not deployment proof; browser and live-runtime acceptance remain
   unperformed in this source-only packet.

## Rollback

Revert the implementation commit(s). The packet has no schema, data,
environment, runtime, or deployment artifact, so rollback is a source revert
only.
