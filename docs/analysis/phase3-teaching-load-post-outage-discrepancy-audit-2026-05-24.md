# Phase 3 Teaching Load Post-Outage Discrepancy Audit - 2026-05-24

## Purpose

This audit checks the current live `Teaching Load` state after the outage-runtime and special-program redistribution passes, with emphasis on what still blocks real scheduler use while EnrollPro is down.

## Main Verdict

`Teaching Load` is closer to truthful than before, but it is still not closure-grade.

The biggest remaining blockers are:

1. degraded mode is still effectively read-only in the client
2. `SPA_SPEC` / `SPS_SPEC` redistribution diagnostics are too strict to surface real idle `MAPEH` candidates
3. assignment-level specialization identity exists in data, but not yet as a first-class assignment control
4. explicit term-slot semantics are still not first-class even though rotation-family load math is already active

## Live Truth Snapshot

Live coverage remains:

- `SCI_ES = 82 / 82` uncovered
- `SCI_CHEM = 35 / 82` uncovered
- `TLE_FCS_EXP = 5 / 58` uncovered
- `SPA_SPEC = 8 / 8` covered
- `SPS_SPEC = 8 / 8` covered

Live staffing report remains internally consistent:

- raw uncovered rows: `122`
- raw missing hours/week: `457.5`
- concurrent uncovered rows: `87`
- concurrent missing hours/week: `326.3`
- rotation-adjusted minutes/week: `7875`

So the main remaining shortage is still real `SCIENCE` plus a small `TLE_FCS_EXP` gap.

## Discrepancy 1: Degraded writable mode is still blocked in the client

The backend can still serve meaningful local truth while EnrollPro is down:

- runtime context resolves from ATLAS-owned evidence
- sections load from `cached-enrollpro`
- staffing-needs report still computes from cached local evidence

But the page still forces read-only mode whenever:

- browser reports offline, or
- page `dataSource !== 'live'`

That means the scheduler cannot:

- save assignments
- run auto-fill
- request staffing-needs from the page
- use normal ownership tools

even when ATLAS already has enough persisted local evidence to work safely.

This is the main reason `Teaching Load` feels unusable during EnrollPro outage.

## Discrepancy 2: Special-program redistribution candidate discovery is too strict

Live redistribution preview currently returns:

- `underutilizedMapehCandidates = []`
- `candidateSignals = []`

for both:

- `SPA_SPEC`
- `SPS_SPEC`

But live ownership rows clearly show real `MAPEH` teachers already own these subjects, and many `MAPEH` teachers still remain underutilized.

The likely cause is current qualification filtering:

- candidate discovery still routes through ownership-department matching
- `SPA_SPEC` is structurally treated as `SPA`
- `SPS_SPEC` is structurally treated as `SPS`
- idle `MAPEH` teachers therefore never enter the candidate pool unless they are already current owners or have another exception path

So the current diagnostics are honest about constrained sections, but not yet honest about all realistic redistribution candidates.

## Discrepancy 3: Section-level specialization identity exists, but not yet as a real assignment control

Live assignment payloads already carry specialization identity for special-program sections, for example:

- `SPA_SPEC -> DANCE`
- `SPA_SPEC -> FINE_ARTS`
- `SPA_SPEC -> MAJOR_IN_MUSIC_EDUCATION`
- `SPA_SPEC -> THEATER_PERFORMING_ARTS`
- `SPS_SPEC -> SPORTS_SCIENCE`

That means the data contract is already expressive enough.

What is still missing is a real workflow contract in `Teaching Load` that lets schedulers:

- see the section’s required specialization clearly
- pick a teacher for that specialization slot
- use a local approved capability override when EnrollPro specialization strings are too weak or too generic

Right now specialization identity is still more of a diagnostic attribute than an assignment semantic.

## Discrepancy 4: Staffing report works in degraded mode, but the page still blocks it

Direct live API probe confirms:

- `POST /api/v1/faculty-assignments/report/staffing-needs` works while EnrollPro is down
- response includes:
  - `sectionSource = cached-enrollpro`
  - `sectionFallbackReason = section-adapter-fetch-failed`
  - warning text about cached section evidence

So the backend degraded behavior is already good enough for this read path.

But the page still blocks the action because it is bundled into read-only gating.

This is a product mismatch:

- backend says the report is safe to compute
- client says the scheduler is not allowed to request it

## Discrepancy 5: Rotation-family math is active, but explicit term-slot semantics are still not first-class

Teacher load math is already family-aware:

- `SCIENCE`
- `TLE_ROTATION`

Coverage/staffing math is also already family-aware at the concurrent-shortage level.

But the system still does not expose explicit persisted `Term 1 / Term 2 / Term 3` ownership semantics.

Current behavior is:

- multiple rotation-family rows can be owned
- weekly load is collapsed by family/section lane

That is mathematically useful, but still weaker than a true term-lane assignment model.

## What The Next Pass Should Add

The next backend/product pass should add all of the following:

1. degraded writable mode where ATLAS already has enough local evidence
2. `SPA_SPEC` / `SPS_SPEC` section-level specialization assignment semantics
3. local approved capability / compatibility override for weak EnrollPro specialization data
4. special-program candidate discovery that does not exclude realistic `MAPEH` teachers purely because the subject owner code is `SPA` or `SPS`
5. client permission for safe degraded staffing report requests

## Final Assessment

The remaining problem is no longer mostly stale truth or bad shortage arithmetic.

It is now a product-contract gap between:

- what ATLAS already knows locally
- what the backend can already compute safely
- and what the `Teaching Load` workflow still allows schedulers to do
