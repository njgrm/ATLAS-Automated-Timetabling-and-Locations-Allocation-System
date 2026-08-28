# Phase 3 Teaching Load Live Data and Control Audit - 2026-05-24

## Scope

This audit re-checks current live `Teaching Load` behavior against three remaining concern groups:

- `SCIENCE` and `TLE_ROTATION` coverage truth
- `MAPEH` / `SPA_SPEC` / `SPS_SPEC` utilization truth
- `Audit` and `Auto-Fill` control latency and usability while EnrollPro is down

Live target used:

- `https://njgrm.buru-degree.ts.net`

Primary evidence sources:

- live `/api/v1/runtime/context`
- live `/api/v1/faculty-assignments/summary`
- live `/api/v1/faculty-assignments/coverage/summary`
- live `POST /api/v1/faculty-assignments/report/staffing-needs`
- live `POST /api/v1/faculty-assignments/auto-fill` with `previewOnly=true`
- current client/server source inspection in `atlas-client` and `atlas-server`

## Executive Verdict

`Teaching Load` is closer to truthful than before, but it is not closure-grade yet.

The main remaining problems are now:

1. `Audit` and `Auto-Fill` are still too slow because they hit the EnrollPro-first section adapter path before falling back to ATLAS-owned local data.
2. `SCIENCE` and `TLE_FCS_EXP` are still real coverage blockers even after rotation-aware collapse.
3. `MAPEH` special-program utilization is still under-realized, but the blocker is now candidate-discovery clarity and specialization-slot usability rather than raw zero coverage.
4. Rotation-family math is mostly right, but the controls still do not make the scheduler-facing term behavior obvious enough.

## Live Findings

### 1. Runtime context

Live `GET /api/v1/runtime/context?schoolId=1` returned:

- `activeSchoolYearId = 55`
- `source = atlas-persisted`
- `upstream.reachable = false`
- `activeSchoolYearLabel = null`

Interpretation:

- ATLAS can still resolve the active school year locally.
- EnrollPro is currently unavailable.
- Any page saying `Live` or implying upstream freshness must be treated carefully in this environment.

### 2. Staffing truth is now concentrated in Science and TLE

Live `POST /api/v1/faculty-assignments/report/staffing-needs` returned:

- `unresolved = 120`
- `sectionSource = cached-enrollpro`
- `sectionFallbackReason = section-adapter-fetch-failed`
- `missingHoursPerWeek = 450`
- `concurrentMissingHoursPerWeek = 318.8`
- `rotationAdjustedMinutesPerWeek = 7875`

Shortage buckets:

- `SCIENCE`
  - `count = 117`
  - `concurrentCount = 82`
  - `recoverableConcurrentCount = 0`
  - `constrainedConcurrentCount = 82`
- `TLE`
  - `count = 3`
  - `concurrentCount = 3`
  - `recoverableConcurrentCount = 0`
  - `constrainedConcurrentCount = 3`

Interpretation:

- `SCIENCE` and `TLE_FCS_EXP` are the only remaining live coverage blockers.
- The report is already term-aware enough to collapse raw rows into lower concurrent shortage.
- The remaining shortage is still fully constrained under current qualification/load rules, not just a stale-data illusion.

### 3. Science teachers are mostly already full or overloaded

Live `summary` inspection for `SCI` faculty shows:

- several `SCI` teachers at `36h`
- many others at `32.3h`
- multiple rows already carrying `rotationFamilyOvercountHours = 3.8`

Interpretation:

- the shortage is not just because the system forgot about per-term collapse
- many science teachers are already heavily loaded even after rotation-family adjustment
- current unresolved science demand is still materially real

### 4. TLE is nearly complete but not fully complete

Live `summary` inspection for `TLE` faculty shows:

- many TLE teachers at `30h`
- one TLE teacher at `33.8h`
- some TLE rows with non-zero `rotationFamilyOvercountHours`

Live staffing shortage still reports:

- `TLE count = 3`
- all tied to `TLE_FCS_EXP`

Interpretation:

- TLE exploratory coverage is almost complete
- the remaining `TLE` blocker is now narrow and specific, not systemic like the older umbrella-row problem

### 5. MAPEH remains underutilized even though SPA/SPS are covered

Live `summary` inspection shows multiple zero-load real `MAPEH` teachers:

- `WENDY ILAGAN`
- `VICTOR MACALINTAL`
- `ZACARIAS NAVARRO`
- `YOLANDA QUINTO`
- `XAVIER TUASON`
- `ALICIA YAMBAO`

Live special-program redistribution work from prior passes means:

- `SPA_SPEC` and `SPS_SPEC` are already fully covered
- redistribution preview now finds non-empty `MAPEH` candidate signals
- but those covered special-program loads are still not being surfaced or operated on clearly enough for the scheduler

Interpretation:

- `MAPEH` is no longer blocked by total absence of special-program coverage
- the remaining issue is that underutilized `MAPEH` teachers are still not easy to convert into visible, confidence-backed redistribution actions

### 6. Slow controls are hitting the wrong section-source path

Live timing probes:

- `GET /faculty-assignments/summary`: about `153-279ms`
- `GET /sections/summary/:schoolYearId`: about `12-57ms`
- `POST /faculty-assignments/report/staffing-needs`: about `10525ms`
- `POST /faculty-assignments/auto-fill` with `previewOnly=true`: about `10709ms`

Interpretation:

- the slow path is not the mirror-backed section summary route
- the slow path is inside teaching-load automation / staffing services
- those services still call `sectionAdapter.fetchSectionsBySchoolYear(...)`
- that adapter still tries EnrollPro first in `auto` mode and only falls back to cached data after upstream failure

Relevant code:

- `atlas-server/src/services/teaching-load-automation.service.ts`
  - `fetchSectionsForAutoFill(...)`
- `atlas-server/src/services/faculty-assignment.service.ts`
  - `fetchSectionsForCoverage(...)`
- both call:
  - `sectionAdapter.fetchSectionsBySchoolYear(...)`
- while the fast page path uses:
  - `atlas-server/src/services/section.service.ts`
  - `getSectionSummary(...)`
  - which is mirror-first and fast

This is the main reason the `Audit` and `Auto-Fill` buttons feel like they are waiting on EnrollPro before they can work.

### 7. The current controls are still too implicit

Current `Teaching Load` controls are better visually than before, but still weak semantically:

- `Audit` and `Auto-Fill` are too generic as button labels
- top-level mode tabs:
  - `Work`
  - `Gap`
  - `Load`
  - `Spec`
  are too cryptic for a high-stakes scheduler workflow
- `Rotation Family` and `Shared Weekly Slot` cues exist, but still feel like hints rather than an explicit assignment model
- the page still does not make a scheduler clearly feel:
  - `this row is part of a rotating term family`
  - `this adds raw ownership`
  - `this adds only X concurrent weekly minutes`

### 8. Rotation behavior is mathematically better than it is communicatively

Current state:

- teacher load is family-aware
- staffing shortage is family-aware
- manual row interaction still reads like ordinary section ownership with a small lane hint

Interpretation:

- the system is already modeling `SCIENCE` and `TLE_ROTATION` as shared weekly lanes
- but the controls still do not expose that as a first-class scheduling concept

## What Is Actually Fixed

- stale ownership is fixed
- `Teacher X` masking is no longer the main issue
- staffing math now distinguishes raw uncovered rows from concurrent shortage
- `SCIENCE` and `TLE_ROTATION` are already family-aware in staffing/load math
- `SPA_SPEC` and `SPS_SPEC` stay umbrella subjects with specialization identity at assignment level

## What Is Not Fixed

- `Audit` and `Auto-Fill` still pay an EnrollPro-first timeout tax even when ATLAS already has the data locally
- the scheduler still lacks a direct term-aware assignment explanation model
- underutilized `MAPEH` teachers are still not surfaced as clearly actionable special-program redistribution capacity
- control labels are still too terse for the complexity they represent

## Recommended Next Passes

### 1. Backend/runtime pass

Target:

- stop teaching-load control actions from blocking on EnrollPro-first section fetches when ATLAS mirror/snapshot evidence already exists
- preserve source honesty
- keep current staffing truth intact
- expose clearer rotation-lane preview semantics for manual assignment

### 2. UX/control pass

Target:

- rename and clarify the major controls
- make `SCIENCE` / `TLE_ROTATION` term-family behavior explicit in operator language
- separate:
  - real shortage
  - underutilized teachers
  - redistributable special-program ownership
- preserve the current calmer no-scroll workspace

## Bottom Line

The remaining `Teaching Load` problem is no longer mostly a hidden data-corruption issue.

It is now a combination of:

- real unresolved science/TLE coverage
- EnrollPro-first latency in server-side control actions
- weak scheduler-facing communication of rotation-family behavior
- underexposed special-program redistribution paths for low-load `MAPEH` teachers
