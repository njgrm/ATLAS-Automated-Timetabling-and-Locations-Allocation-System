# ACTOR-SCHOOL-MUTATIONS-C02 — faculty placeholder delete authority

## Objective

Make `DELETE /api/v1/faculty/:id` fail closed on school scope. An authenticated
privileged actor must provide one canonical positive school id and it must equal
the actor's authenticated school before `deletePlaceholderFaculty` can run.

## Tier and approval

HIGH: this is a destructive route and an actor-school authorization boundary.
The operator approved this bounded source-only lane on 2026-09-21. No request
may reach a live database, runtime, browser, deployment, migration, seed, or
companion system during source verification.

## Scope

Authorized production path: `atlas-server/src/routes/faculty.router.ts`.
Authorized test path: one mounted Express route test under
`atlas-server/src/__tests__/`.
Authorized package change: one reachable `atlas-server/package.json` test
script entry.

Do not alter other faculty routes, client code, Prisma/schema files, documents
outside this packet, services, runtime configuration, or role policy.

## Required behaviour

1. A missing, malformed, noncanonical, or non-safe-positive `schoolId` returns
   `400 INVALID_PARAM` before the delete service is called. Reject booleans,
   arrays, `0x10`, `1e2`, `01`, padded values, and `+1`.
2. The body owns `schoolId` when it is present, including an explicitly invalid
   body value; query is used only when the body has no own `schoolId` property.
3. An authenticated privileged actor with no usable school returns
   `403 SCHOOL_SCOPE_REQUIRED`; a different requested school returns
   `403 CROSS_SCHOOL_DENIED`; both reject before service dispatch.
4. A same-school privileged JWT with canonical numeric or string input reaches
   the stubbed delete service exactly once. Authentication and role middleware
   remain authoritative.

## Verification

- Establish RED with the mounted real router against the pre-fix route: an
  actorless privileged JWT plus the legacy fallback must reach the instrumented
  delete service rather than return a scope rejection.
- Run the new reachable C02 script after the fix; assert zero service dispatch
  for each rejection and one dispatch only for allowed controls.
- Run `npm run test:actor-school-mutations` as preservation, `npm run build`,
  and `git diff --check`.
- Independently QA the immutable range. Verify changed-path scope, script
  reachability, real-route zero dispatch, and the allowed control.
- Start the built server only on an isolated non-shared port with no usable
  database configuration; stop it and prove the listener is gone.

## Rollback

Do not push an unaccepted candidate. If accepted integration later fails, a
revert of the single C02 production commit restores the prior source without
touching data; no live delete is part of this packet.
