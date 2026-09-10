# DASH-RESILIENCE-C01 — Preserve saved Dashboard truth during upstream failures

## Objective

Correct the ATLAS Dashboard so a reachable EnrollPro typed term state and a
transient dependency failure can never appear as an empty school. Keep the
work actor-school scoped, read-only at runtime, and compatible with the
authoritative EnrollPro ordered-term contract.

## Required reading

- `AGENTS.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/dashboard-stale-readiness-audit-2026-09-11.md`
- `atlas-server/src/services/active-term-adapter.service.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/dashboard-readiness.service.ts`
- `atlas-client/src/hooks/useDashboardData.ts`
- `atlas-client/src/pages/Dashboard.tsx`

## Git and scope

Create a fresh worktree and neutral branch from refreshed `origin/main`. Record
the base SHA before editing. Commit one immutable candidate and return
`REVIEW_REQUIRED`; do not merge or push.

Allowed product paths are the Dashboard/runtime/active-term server and client
surfaces plus focused tests and necessary documentation. EnrollPro, AIMS, and
SMART are READ_ONLY. Do not touch curriculum derivation, Teaching Load,
timetable generation, publication, migrations, schemas, `.env`, or live data.

## Required corrections

1. Preserve typed EnrollPro non-2xx contract responses. A reachable HTTP 409
   `ACTIVE_TERM_UNRESOLVED` shall remain reachable and shall expose that code
   and message; it shall not become `enrollpro-unreachable`.
2. Keep active school-year verification independent from active-term
   resolution. A verified year with no current calendar term shall continue to
   resolve the actor school's saved ATLAS readiness data.
3. Make `/dashboard/readiness-summary` the single authoritative Dashboard load
   pipeline. Remove the competing legacy fan-out fallback from normal error
   recovery.
4. Treat HTTP 401/403 as authentication/scope failures, not data-source
   failures. Invoke the application's canonical expired-session or blocked-
   scope UX and never fan out into legacy school requests after either status.
5. Never substitute `0`, `[]`, `NONE`, or another valid-looking business value
   for a failed domain read. Represent unavailable domains explicitly and keep
   lifecycle/readiness fail-closed.
6. Retain the last successful same-school snapshot on transient refresh
   failure and show a concise degraded state with one retry action. Never retain
   data across an actor-school or active-year scope change.
7. Preserve genuine persisted zeros as real values and distinguish them from
   unavailable values in API types, UI copy, and tests.
8. Do not solve the superseded Curriculum Requirements workflow in this pass.
   Record it as the separate DEMAND-C01/UX-C01 dependency.

## Required negative controls

- EnrollPro school-year 200 plus active-term 409
  `ACTIVE_TERM_UNRESOLVED`: year and saved counts remain available; source is
  reachable but term-unresolved.
- EnrollPro network failure with valid ATLAS mirrors: saved counts remain and
  the page says it is using saved data.
- One Dashboard domain read throws: its value is unavailable, not zero; the
  lifecycle cannot advance from the synthetic value.
- Summary refresh fails after one successful same-school load: the prior
  snapshot remains visible with degraded/retry status.
- Expired session returns 401: no legacy requests are dispatched, no counts are
  rendered as zero, and the canonical sign-in/session-expired path is shown.
- Actor/scope rejection returns 403: no legacy requests are dispatched and no
  fallback school is queried.
- First load fails with no snapshot: show unavailable placeholders, not zeros.
- Actor school changes while a prior request is in flight: old response cannot
  populate the new scope and no fallback school ID is used.
- A real zero-row fixture remains visibly and semantically zero.

## Verification

- Add failing-first focused server and client tests for every negative control.
- Exercise the mounted readiness route and the real Dashboard hook/page path;
  helper-only proof is insufficient.
- Run focused tests, server/client TypeScript checks, production builds, and
  committed-range `git diff --check`.
- Run Playwright against an isolated candidate client/server or controlled
  fixtures at desktop and 390px mobile. Confirm retained saved data, concise
  degraded copy, one retry action, no overflow/mojibake, and zero write
  requests.
- Run a read-only Tailnet confirmation. Do not restart shared port 5001 or
  mutate live data.
- Obtain one fresh independent changed-scope QA review. Fix material findings
  with additive commits and repeat QA only for the changed range.

## Handoff

Return base SHA, candidate SHA, exact changed paths, before/after state matrix,
test counts, browser evidence, read-only live evidence, zero-mutation proof,
known risks, and `REVIEW_REQUIRED`.

Suggested commit:

```text
fix(dashboard): preserve saved readiness during upstream failures
```
