# Phase 3 Teaching Load Post-Rotation Audit

Date: 2026-05-23
Scope: live Tailnet validation of `# 2026-05-22 - Phase 3 Teaching Load Rotation + Redistribution One-Shot`

## Verdict

`NO-GO` for closure of the rotation/redistribution pass.

The pass improved part of the backend truth contract, but it left three critical problems:

1. `Teaching Load` is currently crashing live for operators.
2. the page now treats massive `Teacher X` placeholder ownership as if it were successful coverage
3. the top-line coverage signal is therefore operationally misleading even though the summary route is richer than before

So the result is not "wrong everywhere," but it is not safe to trust as a scheduler-facing outcome.

## What actually landed correctly

### 1. Summary route payload is now richer live

Live `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55` now exposes:

- `faculty`
- `ownershipIndex`
- `coverageTotals`
- `integrityDiagnostics`
- `schoolYearId`
- `fetchedAt`

Live truth values observed:

- `coverageTotals.assignedPairs = 1026`
- `coverageTotals.totalPairs = 1026`
- `coverageTotals.unassignedPairs = 0`
- `integrityDiagnostics.emptySectionRows = 149`
- `integrityDiagnostics.currentYearRowsMissingOwnership = 2`
- `integrityDiagnostics.currentYearMissingOwnershipPairs = 6`

So the pre-rotation summary-route blocker was resolved.

### 2. Rotation-aware teacher load fields are present live

The summary route now returns rotation-aware fields such as:

- `sectionTeachingHoursRaw`
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`

This supports the new rotation-family inspection model.

### 3. Credited-load truth is improved for normal teachers

Example verified live:

- `ELPIDIO AQUINO`
  - `sectionTeachingHours = 31`
  - `policyCreditedHours = 36`

That is closer to the intended `Teaching Load` truth model than the earlier undercounted `Teachers` surface.

## What is still wrong

### 1. Live Teaching Load page currently crashes

Observed live error:

- `Cannot read properties of undefined (reading 'map')`
- thrown from `FacultyAssignments.tsx`

The exact browser stack points into a memoized path in `FacultyAssignments`.

Current source strongly suggests the likely fault class is:

- an unsafe client assumption around newly added array-shaped data
- plus the cache layer still using `atlas:faculty-summary:v2` even though the summary shape changed again in the rotation pass

Important nuance:

- the fresh live API payload itself looks structurally valid
- the crash is therefore more likely a client derivation / stale-cache-shape problem than a broken summary endpoint

This means the evidence entry claiming live PASS is overstated.

### 2. Placeholder coverage is being treated like real operational coverage

Live placeholder rows now include:

- `Teacher X / SCI_ES`
  - `policyCreditedHours = 307.5`
  - `sectionTeachingHours = 307.5`
- `Teacher X / TLE_FCS_EXP`
  - `policyCreditedHours = 202.5`
  - `sectionTeachingHours = 202.5`
- `Teacher X / SCI_CHEM`
  - `policyCreditedHours = 131.3`
  - `sectionTeachingHours = 131.3`
- `Teacher X / HG`
  - `policyCreditedHours = 17`
  - `sectionTeachingHours = 17`

Live placeholder aggregate:

- `4` placeholder teachers
- `658.3` credited hours total
- `3` placeholder rows above `40h`

This is not an appropriate scheduler-facing teaching-load outcome.

It may be acceptable as a repair shim or diagnostic artifact, but not as "assigned coverage."

### 3. Coverage summary is now mathematically "full" but operationally misleading

Live `GET /api/v1/faculty-assignments/coverage/summary` shows:

- `SCI_ES`
  - `82 / 82 owned`
  - `0` owned by real faculty
  - `82` owned by placeholder
- `TLE_FCS_EXP`
  - `58 / 58 owned`
  - `4` owned by real faculty
  - `54` owned by placeholder
- `SCI_CHEM`
  - `82 / 82 owned`
  - `47` owned by real faculty
  - `35` owned by placeholder
- `HG`
  - `82 / 82 owned`
  - `65` owned by real faculty
  - `17` owned by placeholder

So the new `1026 / 1026 assigned` signal is not wrong in a raw ownership sense, but it is still wrong for operator interpretation if placeholders are counted as successful staffing.

The page needs at least three separate concepts:

1. real faculty-owned coverage
2. synthetic placeholder-covered pairs
3. truly uncovered pairs

Right now those are being collapsed too aggressively.

### 4. Integrity debt is still high

Live `integrityDiagnostics.emptySectionRows = 149`

That is still a large amount of baseline/seed drift.

Even though the prompt was allowed to leave some integrity debt behind, the current result still needs a more honest operator framing before the workflow can be trusted.

## What looks correct enough to keep

These parts should not be reverted blindly:

- summary route exposure of `coverageTotals` and `integrityDiagnostics`
- rotation-family-aware load fields
- primary route contract:
  - `/teachers`
  - `/teaching-load`
- special-program subject existence and live ownership baselines for:
  - `SPA_SPEC`
  - `SPS_SPEC`

## What the next pass should do

### 1. Fix the live runtime regression first

Required:

- reproduce and eliminate the `Cannot read properties of undefined (reading 'map')` crash
- harden all new array-shaped summary data paths
- bump or invalidate the cached faculty-summary snapshot version so stale payload shapes cannot crash the page

### 2. Separate synthetic placeholder coverage from real teaching-load truth

Required:

- do not count placeholder-owned pairs as "assigned" in the main operator headline
- show placeholder coverage as a separate warning or recovery bucket
- keep placeholders visible for diagnostics, but do not let them masquerade as normal staffed coverage

### 3. Reframe coverage metrics

Required:

- expose:
  - `realAssignedPairs`
  - `syntheticPlaceholderPairs`
  - `unassignedPairs`
- preserve the full ownership denominator, but label it honestly

### 4. Keep Teacher X out of normal load interpretation

Required:

- do not sort or present placeholder loads as if they were normal faculty competition in the roster
- cap or visually quarantine synthetic coverage rows so they cannot dominate the operator experience

## Decision

The `phase3-teaching-load-rotation-and-redistribution-one-shot-prompt.md` pass produced useful backend truth work, but the live operator-facing result is not acceptable yet.

The next pass should be:

- runtime crash repair
- cache-shape hardening
- placeholder truth segregation
- coverage headline correction

before any further balancing work is treated as trustworthy.
