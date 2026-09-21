# ROLLOVER-YEAR-IDENTITY-C01 — no fabricated rollover year

## Objective

Remove the year-1 fallbacks after `POST /rollover-sync/apply` and
`POST /rollover-sync/reset-dummy-year`. A missing or malformed returned active
year must never create notifications or a Teaching Load cycle under year 1.

## Tier, authority, and boundaries

HIGH: both routes are rollover mutation paths. The operator authorized this
source-only lane on 2026-09-21. No deployment, browser, login, supervisor,
live-data action, migration, seed, or database connection is allowed.

Authorized paths are `atlas-server/src/routes/runtime.router.ts`, one mounted
route regression test under `atlas-server/src/__tests__/`, and one reachable
`atlas-server/package.json` test-script entry. Do not modify rollover services,
client, Prisma/schema, runtime configuration, or unrelated routes.

## Required discovery before implementation

Trace the result contract of `applyRolloverSync` and
`resetDummyYearAndApplyRollover`: establish whether a valid active-year identity
is available before either mutation, and which post-call operations write the
notification/cycle state. The correction must not claim it can undo a completed
rollover. If identity is only available after the service returns, it must fail
closed by refusing the follow-on notification/cycle path with a typed error and
an evidence-preserving response, never by selecting year 1.

## Acceptance rows

1. Both route result shapes reject missing, noncanonical, non-safe-positive
   active-year identities before `publishNotificationEvent` or
   `getOrCreateTeachingLoadCycleSource` dispatches.
2. Valid canonical returned year identities preserve the existing notification
   and cycle behavior exactly once.
3. The mounted production router harness proves the rejection/allowed paths and
   instruments all post-result delegates; no helper-only proof.
4. The test is reachable through a distinct committed package script. Run it,
   one rollover or actor-authority preservation suite, server build, and
   `git diff --check`.
5. Build startability uses only an isolated nonshared port and poisoned loopback
   DSN, then proves listener cleanup.

## Rollback

Do not push an unaccepted candidate. A later source revert is limited to this
route/test/script commit and cannot reverse a rollover that was already applied;
therefore a live apply is expressly out of scope.

## Approved contract refinement

`previewRolloverSync` is the existing read-only resolver. Before either apply
route enters its mutation, reuse it to require a canonical active-year identity
and return `409 ACTIVE_YEAR_UNRESOLVED` when it is absent. Do not add a second
resolver.

After the locked mutation returns, validate its returned active-year id only as
a numeric safe positive integer. Do not coerce strings or use nested/reset
target values. If it is invalid, return typed `409
ROLLOVER_ACTIVE_YEAR_IDENTITY_INVALID` with response-safe evidence that the
mutation result was received and follow-ons were withheld. It must not describe
the rollover as undone. No notification or Teaching Load get-or-create may run.

For a viable mounted route test, `runtime.router.ts` may export
`createRuntimeRouter(overrides)` while retaining its existing default router.
Overrides may cover only `applyRolloverSync`, `resetDummyYearAndApplyRollover`,
`publishNotificationEvent`, and `getOrCreateTeachingLoadCycleSource`.
