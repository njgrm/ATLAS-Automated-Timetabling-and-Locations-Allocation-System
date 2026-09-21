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
   `400 INVALID_PARAM` before the delete service is called. Accept a JSON
   number only when it is a safe positive integer, and a string only when it
   matches `^[1-9]\\d*$` and converts to a safe positive integer. Reject
   booleans, arrays, objects, null, zero, fractions, unsafe values, `0x10`,
   `1e2`, `01`, padded values, and `+1`.
2. Select `schoolId` with `req.body && Object.prototype.hasOwnProperty.call(req.body,
   'schoolId') ? req.body.schoolId : req.query.schoolId`. Thus an own invalid
   body value wins over a valid query value; query is used only when the body
   lacks that own property. No default is permitted.
3. The actor JWT claim itself is valid only when `req.user.schoolId` is a
   numeric safe positive integer; do not coerce claim strings. An authenticated
   privileged actor with no usable school returns
   `403 SCHOOL_SCOPE_REQUIRED`; a different requested school returns
   `403 CROSS_SCHOOL_DENIED`; both reject before service dispatch.
4. A same-school privileged JWT with canonical numeric or string input reaches
   the real delete service path exactly once through hermetic delegates.
   Authentication and role middleware remain authoritative.

## Verification

- Establish RED with the mounted real router against the pre-fix route: an
  actorless privileged JWT plus the legacy fallback must reach the instrumented
  delete service rather than return a scope rejection.
- Run the new reachable C02 script after the fix; assert zero service dispatch
  for each rejection and one real service-path dispatch only for allowed
  controls. The C02 script name is distinct from the existing
  `test:actor-school-mutations` C01 preservation script.
- Run `npm run test:actor-school-mutations` as preservation, `npm run build`,
  and `git diff --check`.
- Independently QA the immutable range. Verify changed-path scope, script
  reachability, real-route zero dispatch, and the allowed control.
- The mounted test instruments/restores the singleton Prisma delegates instead
  of attempting to overwrite the ESM faculty-service namespace. Rejection
  cases assert zero delegate operations. The allowed control runs the real
  `deletePlaceholderFaculty` path through fake `facultyMirror.findUnique` and
  fake transaction delegates, exactly once, then restores every delegate and
  closes its ephemeral listener.
- Preserve middleware behavior: missing or invalid JWT and non-privileged JWT
  reject with zero dispatch.
- Start the built server only on an explicit isolated non-shared `PORT` with a
  poisoned loopback `DATABASE_URL`; wait only for its listener, terminate it,
  and verify that exact port is no longer listening.

## Rollback

Do not push an unaccepted candidate. If accepted integration later fails, a
revert of the single C02 production commit restores the prior source without
touching data; no live delete is part of this packet.
