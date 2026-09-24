# Fresh Planner Handoff — Scheduler Collaboration C01

## Role and delegation

Act as the SOL planner. Preserve the requested delegation model:

- Luna is the sole executor/writer for a source or operational packet.
- Terra is the independent QA reviewer after an immutable candidate exists.
- SOL plans, resolves custody, accepts/rejects evidence, and integrates.

Use one writer per branch/worktree. Do not dispatch a second writer into an
active stream. Refresh current ownership before any work because this handoff is
a checkpoint, not a permanent lease.

## Objective

Finish making four EnrollPro personnel operational as simultaneous ATLAS
schedulers without granting user/system administration. Complete only the next
authorized step; do not infer permission for migration, deployment, generation,
publication, database mutation, runtime changes, or authenticated browser work.

## Trusted source state

- Repository: `D:\ATLAS`
- Accepted and pushed source: `origin/main`
  `68e373108996b64c5e4470a5479aea1c2c0772ce`
- Integration commit: `68e37310` — `merge: integrate scheduler collaboration C01`
- Accepted executor candidate: `96339750a9d8a82f4efa9a13f93b34d37c2b6597`
- Terra bounded correction verdict: `ACCEPT`, no findings.
- The clean implementation worktree was retired after integration.
- The shared `D:\ATLAS` checkout is dirty historical/user work and must not be
  edited, reset, stashed, cleaned, or used as an implementation worktree.
- New worktrees normally belong under `E:\ATLAS-worktrees`, but the repository
  was already above its 12-active-worktree cap. Reuse a specifically released,
  clean checkout or retire eligible worktrees before creating another.

Always fetch and verify these facts again. If `origin/main` has advanced, review
the intervening commits and start from the new main only after proving ownership
and overlap.

## Live state

- Last verified live release: `4893cbdec2758fa9965a117a1988dee517718afb`.
- Source `68e37310` is integrated but not deployed.
- No C01 Prisma migration has been applied.
- No C01 runtime, supervisor, environment, or browser action has occurred.
- Do not treat source acceptance as live readiness.

Refresh `origin/main:docs/plans/live-state.md`, supervisor ownership, and browser
custody before relying on this snapshot.

## What is implemented in ATLAS

- Exact EnrollPro `GRADE_LEVEL_COORDINATOR` maps to least-privilege `scheduler`.
- `TEACHER` plus coordinator retains faculty self-service.
- Scheduler capabilities cover Teaching Load, policies, timetable read/edit,
  review, generation, publication request, and approval.
- Schedulers cannot administer users/systems or directly publish.
- Local login and companion SSO revalidate current upstream roles; a stale local
  scheduler row fails closed or downgrades when the coordinator claim disappears.
- Every scheduler workspace route enforces authenticated actor-school equality
  before service/database dispatch.
- Timetable collaboration uses opaque, short-lived, single-use user/school/run
  tickets. JWT query authentication was removed.
- Presence and bounded active-cell selections are school/run scoped and cleaned
  up on disconnect or authentication identity change.
- Disjoint concurrent edits can rebase through complete edit history and current
  server validation. Overlap, incomplete history, destructive ambiguity, and
  stale semantic conflicts fail without write dispatch.
- Publication uses durable two-person requests. Requester and approver must be
  distinct; approval and publication occur in one serializable transaction.

## Authority correction required before deployment

EnrollPro confirmed that `TEACHER` is deliberate. Scheduler eligibility comes
from active school-year ancillary roles, not a synthetic
`GRADE_LEVEL_COORDINATOR` application role.

At synchronized EnrollPro commit `7b6231ee2d7a5c9801b68afd0343db2768950e42`,
the machine-keyed `GET /api/integration/v1/faculty` feed already returns merged
active-year `ancillaryRoles`. `/auth/verify` and companion SSO intentionally
return application roles only.

The integrated C01 source currently requires `GRADE_LEVEL_COORDINATOR` in the
application-role assertion. It must be corrected before any migration or
deployment: authenticate the user normally, then resolve an exact verified
faculty identity against the current active-year faculty feed and grant
`scheduler` only for an exact normalized `GRADE 7`, `GRADE 8`, `GRADE 9`, or
`GRADE 10 COORDINATOR` ancillary role. All other data, lookup failures, and
ambiguous results fail closed to non-scheduler authority; do not preserve a
stale local scheduler role.

The four intended personnel remain the Grade 7–10 coordinator assignments
recorded in `NEWLY-SEEDED-USERS.md`. Their names and employee IDs are validation
fixtures only, never authorization logic.

Authoritative compatibility packet:
`docs/handoffs/enrollpro-scheduler-role-contract-c01.md`.

EnrollPro remains read-only for this ATLAS correction. No EnrollPro handback or
role/seed change is needed unless its faculty-feed contract changes.

## Pending ATLAS migration

Source migration:
`prisma/migrations/20260923000000_publication_approval_requests/migration.sql`.

It creates the publication-approval status/type and request table, adds the
generation-run compound scope key, and enforces foreign keys for the scoped run,
school, requester, optional approver, source revision, and published revision.

The migration has static review, schema parity tests, dummy-URL Prisma validation,
and independent QA. It has not been run against any real database.

## Verification already completed

- Initial Terra QA rejected three P1 issues: missing actor-school guards, stale
  local scheduler authority, and incomplete publication foreign keys.
- Luna corrected them additively; Terra then returned `ACCEPT` with no findings.
- Integration gates at `68e37310`:
  - server focused hermetic suite: 27/27 passed;
  - client focused suite: 12/12 passed;
  - server/client TypeScript and production builds passed;
  - Prisma validation passed with a non-routable dummy URL;
  - built auth/collaboration/publication route imports passed;
  - no shared listener, browser, migration, deployment, generation, or publication.

Execution deviation to retain: during implementation, Luna accidentally ran an
existing DB-backed test. Source inspection proved it creates a random guarded
`atlas_restore_drill_*` database distinct from the configured database, drops it
with retries, and asserts zero residue; the suite passed. The exact temporary
database name was not retained. No DB-backed command was run afterward. Treat
this as disclosed non-blocking history, not authorization to repeat it.

## Required next sequence

1. Create a clean, isolated ATLAS source lane from refreshed `origin/main` for
   the ancillary-role authority correction. Luna owns writes; Terra reviews the
   immutable candidate. Keep it source-only.
2. Add failing-first tests for exact active ancillary-role grants, normal teacher
   denial, lookalike-string denial, active-year rollover/removal downgrade,
   unavailable/malformed/duplicate feed denial, cross-school identity denial,
   local-login/SSO parity, and zero credential leakage.
3. Refresh `origin/main`, live release, database target identity, migration list,
   worktree/runtime/browser custody, and available rollback.
4. After the source correction is accepted and integrated, prepare an independent
   HIGH pre-action packet for the ATLAS migration. State
   the exact host/database, expected schema delta, backup/rollback, commands, and
   post-action verification. Do not execute it until the user explicitly approves.
5. After migration acceptance, prepare a separate HIGH deployment packet for an
   accepted release containing `68e37310` or its verified successor. Deployment
   approval is not migration approval.
6. After deployment, obtain exclusive authenticated browser custody and perform
   multi-user acceptance with separate scheduler sessions: simultaneous presence,
   selection visibility, two disjoint edits, an overlapping-edit rejection, school
   isolation, scheduler admin denial, request/other-user approval/publication, and
   disconnect/reconnect cleanup.

Do not generate or publish a real schedule merely to test collaboration. Use an
already approved safe fixture or separately authorize any live scheduling action.

## Immediate next action

**Owner: ATLAS planner.** Dispatch the source-only ancillary-role authority
correction under Luna → Terra → SOL. Do not apply the existing migration or
deploy until the corrected source is accepted and the user explicitly approves
each HIGH action.

## Forbidden without new explicit approval

- editing EnrollPro, AIMS, or SMART from the ATLAS lane;
- applying the Prisma migration or any schema command against a real database;
- deploying, restarting, stopping, or replacing the shared supervisor/runtime;
- changing machine environment or scheduled tasks;
- logging in, changing passwords, or using the authenticated browser;
- generating, publishing, or mutating live schedules;
- hardcoding employee IDs, names, ancillary designations, or seed membership as
  authorization;
- exposing or copying any credential into prompts, tests, logs, or handoffs.

## Suggested fresh-chat opening

> Continue Scheduler Collaboration C01 as the SOL planner using
> `docs/handoffs/fresh-planner-scheduler-collaboration-c01-2026-09-23.md`.
> First correct scheduler eligibility to use EnrollPro's active ancillary
> grade-coordinator roles rather than an application role. Refresh `origin/main`,
> live state, and custody first. Preserve Luna as executor and Terra as
> independent QA. Do not perform any HIGH action without presenting its exact
> target, delta, rollback, and verification and receiving my explicit approval.
