# Dashboard stale-readiness audit — 2026-09-11

## Verdict

The live EnrollPro service is reachable. The observed blank/zero Dashboard is
an ATLAS resilience and error-semantics defect, not loss of the saved school
data.

## Live evidence

- EnrollPro `GET /api/health` returned HTTP 200.
- EnrollPro `GET /api/integration/v1/school-year` returned HTTP 200 for school
  year 9 / `2030-2031`, format `TRIMESTER`, with three ordered term entries.
- Strict malformed and duplicate `schoolYearId` probes returned HTTP 400
  `SCHOOL_YEAR_ID_INVALID`.
- EnrollPro `GET /api/integration/v1/active-term` returned HTTP 409
  `ACTIVE_TERM_UNRESOLVED`. This is expected on 2026-09-11 because the
  configured test school year and term dates are in 2030-2031. It proves the
  service is reachable and the contract is fail-closed; it is not a network
  failure.
- ATLAS `GET /api/v1/dashboard/readiness-summary?schoolId=1` returned the saved
  school state: 20 sections, 22 subjects, 42 faculty, 98 teaching rooms out of
  103 rooms, school year 9 / `2030-2031`, and no current-year generation run.
- The live Dashboard rendered the same non-zero values after a fresh login and
  produced no browser-console errors.

## Confirmed ATLAS defects

1. `active-term-adapter.service.ts` maps every non-2xx EnrollPro response to
   `enrollpro-unreachable`, discarding the typed 409 code and message. A
   reachable, valid no-current-term state is therefore mislabeled as a network
   outage.
2. `dashboard-readiness.service.ts` substitutes empty arrays and numeric zeros
   when individual ATLAS reads fail. The API can therefore say `0` where the
   truth is `unknown/unavailable`.
3. `useDashboardData.ts` falls back from the authoritative readiness summary
   to a legacy fan-out. That fallback converts a failed subject-stat request to
   `{ count: 0, unassignedCount: 0 }`, clears buildings after one rejected
   dependency, and nulls other counts. A transient request failure can erase a
   previously good same-school snapshot and make the school appear empty.
4. The deployed Dashboard still exposes the superseded Curriculum
   Requirements repair action. This is separate from the stale-data defect and
   remains owned by the derived-demand/UX replacement stream.

## Required behavior

- Preserve EnrollPro's typed reachable errors, especially
  `ACTIVE_TERM_UNRESOLVED`, without calling them unreachable.
- Treat the school-year contract and active-term contract as independent
  evidence. A valid school year remains usable when no term contains today's
  Manila date.
- Use the authoritative Dashboard readiness summary as the only page-loading
  pipeline.
- On a transient same-scope failure, retain the last successful saved snapshot
  and show a degraded/retry state. Never turn unavailable data into zero.
- On actor-school change or unresolved scope, clear the previous school's data
  and dispatch no scoped requests until the new scope is resolved.
- Keep genuine persisted zeros distinguishable from unavailable values.

## Safety

This audit performed read-only API, browser, source, and Git checks. It changed
no EnrollPro or ATLAS product source, database row, runtime process, generation
run, or publication state.
