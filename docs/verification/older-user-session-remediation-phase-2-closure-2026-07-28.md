# Older-User Session Remediation Phase 2 Closure

Date: 2026-07-28  
Target: https://njgrm.buru-degree.ts.net  
Operator: Codex browser proxy  
Verdict: GO for Phase 2 technical closure

## Scope

Phase 2 addressed OUSER-002: older and non-technical operators could not clearly tell whether to repair saved setup data now or wait for the EnrollPro/source connection.

Implemented changes:

- Added a separate Dashboard `Source connection` decision strip above setup repair content.
- Preserved the existing dashboard readiness and repair links while removing source-state meaning from the setup checklist header.
- Added explicit plain-language decisions for all existing source states:
  - `verified_live`: `Source verified: continue setup normally.`
  - `checking_source`: `Checking source: review visible setup data now; wait for the check to finish before final sync.`
  - `using_saved_data`: `Source unavailable: review saved data now; wait for EnrollPro before final sync.`
  - `partial_degraded`: `Source partly unavailable: fix visible setup items now; wait for EnrollPro before final sync.`
  - `no_saved_data`: `No saved data: reconnect EnrollPro before repairing setup.`
- Kept repair links visible for `Sections`, `Subjects`, `Teachers`, `Teaching Load`, and `Rooms`.
- Lazy-loaded the lower Dashboard campus room detail surface so the source decision and setup actions remain visible inside the first-action budget.

## Runtime Ownership

No runtime source resolver, school-year selection, API ownership, persistence rule, generation truth, or fallback behavior was changed.

The Dashboard still consumes the existing `readinessSourceState` contract from the dashboard readiness summary and the existing runtime context remains authoritative for active source status.

## Acceptance Evidence

Focused browser gate:

- `dashboard-source-health-guidance.spec.ts`: PASS `9/9` across desktop, mobile portrait, and mobile landscape.
- Verified unavailable/saved-data state shows: `Source unavailable: review saved data now; wait for EnrollPro before final sync.`
- Verified unavailable/saved-data state keeps all five repair links visible.
- Verified verified-live state does not show outage or stale-source copy.
- Verified checking and no-saved-data states are distinct from cached fallback.
- Verified no global page overflow on all three viewport projects.

First-action timing:

- Initial focused desktop gate failed at `7374ms` to visible source decision because the Dashboard eagerly imported the heavy campus room surface.
- After lazy-loading `CampusReadinessCard`, the focused gate passed:
  - Desktop unavailable case: `4.3s`
  - Mobile portrait unavailable case: `3.2s`
  - Mobile landscape unavailable case: `3.4s`

Runtime proof:

- Authenticated login: HTTP `200`.
- Authenticated `/api/v1/health`: HTTP `200`.
- Authenticated `/api/v1/runtime/context?schoolId=1`: HTTP `200`, `832` bytes.
- Runtime context sample remained `source=atlas-persisted`, `stale=true`, `activeSchoolYearId=39`; this confirms Phase 2 did not silently switch school years or source ownership.

Regression gates:

- `npm exec -- tsc --noEmit`: PASS.
- `npm run test:ux-guardrails`: PASS `33/33`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- `npm run build`: PASS.
- `timetable-tailnet-preflight.spec.ts` + `older-user-session-validation-codex.spec.ts`: PASS `6/6`.
- `older-user-status-guidance.spec.ts`: PASS `9/9`.

## Notes

The source-health spec uses mocked dashboard readiness summaries for representative source states. This is intentional: it verifies the UI decision contract without mutating live runtime source data.

Human Product GO remains out of scope for Phase 2. The moderated older-user validation threshold remains assigned to Phase 5.

## Decision

Phase 2 is technically closed as GO. Proceed to Phase 3: controlled-dialog focus restoration.
