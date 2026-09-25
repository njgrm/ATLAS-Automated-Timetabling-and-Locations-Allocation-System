# Cycle packet — `PUBLISHED-TERM-AND-DRIFT-FOLLOWUP-C01` (2026-09-26)

MEDIUM/LOW combined source cycle. The two residuals are independent (server published-output read
authority and client drift routing), disjoint in tree, and reviewed in one fresh QA pass. F2 is
LOW-tier; F1 is MEDIUM-tier. This is source-only: no deployment, migration, runtime, generation,
publication, browser, or live-data action.

## Base and worktree

- Base: current `origin/main` `9d01690587a425eb0539dee93769cd89e6f29bef`.
- Executor worktree: `E:\ATLAS-worktrees\lane-a-f1-f2-c01`, branch
  `work/published-term-and-drift-followup-c01`, one writer.
- Commit order: F2 first as an independently revertible commit, then F1. No amend/rebase/force-push.

## F2 — availability drift repair routing (LOW)

Correct the shared drift map so the availability domain points to the canonical concern workspace:

- `atlas-client/src/components/timetable/timetableDriftRouting.ts`: `availability.href` and its stale comment
  become `/faculty/concerns`; the other six domain entries remain byte-identical.
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts`: update the two old expectations and
  add a failing-first assertion for both the domain href and `primaryHref`.
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts`: extend the availability rendered
  test with the real `href="/faculty/concerns"` and `mountedRoutes().has('/faculty/concerns')`; do not rely on
  the existing tautological mounted-route assertion.
- Do not fork `teacher-concern-helpers.ts`, `RunAvailabilityDriftCard.tsx`, or `SimpleDriftBanner.tsx`; the
  shared map must remain the single source.

## F1 — published export term authority (MEDIUM)

Correct only `atlas-server/src/services/published-schedule.service.ts:956-984` and focused tests:

- Keep the existing `INITIAL_PUBLICATION` base `findFirst` and the live fallback unchanged for this cycle.
- Read the existing `SCHEDULED`/`SUPERSEDED` revision chain ordered by `effectiveDate`, then call the already
  imported `resolveEffectiveIdentitySnapshot` and `frozenTermContract`; do not add a second snapshot validator or
  import a new revision-service edge.
- Pin `asOf = new Date()` at the call site, matching `published-revision.service.ts`; date threading through the
  eight export routes is out of scope. Record the base-selection (`INITIAL_PUBLICATION` vs publication pointer)
  divergence as a residual rather than changing fail-closed behavior here.
- Preserve `TERM_INDEX_OUTSIDE_CONTRACT`, `TERM_FILTER_NOT_READY` (the existing export-resolver code for a null
  active order), `TERM_SELECTION_REQUIRED` (the archived-read payload code), and every existing route status/code
  passthrough. No database writes and no publication mutation.
- Put the decisive F1 controls in the real-Prisma `published-immutability-c08.test.ts` / `test:server-db` path,
  not in the `published-identity-readback-s4-client` fake, unless the fixture is extended explicitly.

## Required evidence

### F2 rows (LOW)

1. Failing-first: availability-only drift has domain href and primary href `/faculty/concerns`; the old `/faculty`
   value fails.
2. Source-shape proves `/faculty` is the legacy redirect, not the availability authority; the new target is the
   concern route with the same gate.
3. Rendered `SimpleDriftBanner` exposes the new href and the mounted concern route; the old mounted-route-only
   tautology is not accepted as evidence.
4. Shared-map/no-fork preservation: other domains and concern helper delegation remain unchanged.
5. Client preservation: `test:publish-drift-revision-s4-client`, `test:scheduler-concern`, `test:client-suite`,
   typecheck, and build; classify any base failure by reproduction on the base tree.

### F1 rows (MEDIUM)

1. Failing-first real-PG control: base TRIMESTER T1-T3 plus an effective SCHEDULED QUARTERS override; term 4
   resolves under the effective 4-term contract on candidate and fails `TERM_INDEX_OUTSIDE_CONTRACT` on base.
2. A requested date before the override effective date leaves term 4 under the base 3-term authority and fails closed.
3. A SUPERSEDED/withdrawn override does not govern and term 4 remains outside the base contract.
4. `requested === 'active'` uses the effective contract's `activeTermOrder`; a null active order fails closed with
   the existing `TERM_FILTER_NOT_READY` export code, while the archived read path retains `TERM_SELECTION_REQUIRED`.
5. `snapshotDigest(baseMetadata)` is byte-identical before/after and direct base read still returns TRIMESTER.
6. No second validator/import edge; the correction reuses the existing resolver and preserves typed errors.
7. Existing `test:server-db` C08 immutability, published-revision-identity, and published-identity-readback suites
   pass or reproduce only recorded base failures; server/client typechecks, builds, and `git diff --check` pass.
8. Reverting the effective-revision call makes F1-1 fail (load-bearing mutant), not merely changing a comment.

Every new/changed test must be reachable from a committed `package.json` script in the same commit. Record literal
commands, exact tallies, base-vs-candidate failures, changed paths, and no residue. No browser, generation,
publication, migration, deployment, runtime, or live-data action belongs to this cycle.

## Acceptance and integration

One fresh `atlas-qa` reviews the immutable range `9d016905...<candidate>` and returns `ACCEPT_READY` only with
`passed == total`, `blocked: 0`, `unperformed: 0`. The executor returns one immutable candidate; the planner
integrates from a clean `integration/published-term-and-drift-followup-c01-20260926` boundary and announces the
`main` push window before integration. F1/F2 are not deployment prerequisites; the live 861 release stays untouched.
