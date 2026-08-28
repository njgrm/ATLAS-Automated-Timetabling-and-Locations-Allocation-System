# Phase 3 Teaching Load Live Discrepancy Audit - 2026-05-23

## Scope

This audit re-checks the live Tailnet `Teaching Load` state after the recent truth-model, specialization, staffing, and UX passes.

Primary questions investigated:

- Why do `SCI_ES` rows still appear as `Teacher X` in parts of the workflow?
- Why do `ENG` and `FIL` look fully taken in the assignment surface while coverage still reports missing rows?
- Is per-term / rotation-family math actually working?
- Is per-term / rotation-family behavior clearly represented to schedulers?
- What is the real current progress of the Teaching Load stream?

Environment used:

- Tailnet UI/API target: `https://njgrm.buru-degree.ts.net`
- Live API probes using direct admin login
- Direct DB probe through local Prisma runtime against the active ATLAS database

## Executive Summary

The current Teaching Load backend is partly correct and partly internally contradictory.

What is genuinely improved:

- teacher load math is now rotation-family aware
- staffing report now separates raw uncovered rows from concurrent weekly shortage
- placeholder coverage is no longer counted as staffed success in the live headline totals
- assignment-level specialization identity for `SPA_SPEC` / `SPS_SPEC` is in the right layer

What is still broken:

- the system is still carrying stale ownership rows for both old faculty and old `Teacher X` placeholders
- the live summary headline treats those rows as uncovered, but the assignment surface still uses them as saved ownership
- this makes rows look "already taken" in the UI while coverage and staffing correctly call them missing
- per-term behavior is only modeled as load-collapse math, not as an explicit scheduler-facing assignment model

The current live state is therefore:

- better than the earlier placeholder-masking state
- more truthful than before
- not closure-grade yet

## Verified Live Truth Layers

### 1. Active staffing truth

Live `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55` currently returns:

- `assignedPairs = 728`
- `realFacultyAssignedPairs = 728`
- `syntheticPlaceholderPairs = 0`
- `totalPairs = 962`
- `unassignedPairs = 234`
- `rawAssignedPairs = 962`
- `rawUnassignedPairs = 0`

This means:

- every current-year teachable pair has some ownership row in storage
- but only `728` of those pairs are owned by live non-stale teaching staff
- the remaining `234` pairs are not blank; they are stale-owned

### 2. The uncovered count is not a blank-row problem

A direct reconciliation of live `summary`, `subjects`, and `sections` shows:

- `activePairs = 728`
- `staleOnlyPairs = 234`
- `noOwnershipPairs = 0`

That is the core discrepancy.

The current uncovered count is coming from:

- pairs with ownership rows tied to stale faculty or stale placeholders

It is not coming from:

- completely missing ownership rows

### 3. Integrity diagnostics are currently incomplete

Live `integrityDiagnostics` currently reports:

- `emptySectionRows = 143`
- `currentYearRowsMissingOwnership = 0`
- `currentYearOwnershipWithoutMatchingScope = 0`

This is not enough to explain the real problem.

Why:

- the diagnostics catch empty baseline rows on active faculty
- they do not catch stale-faculty ownership rows that still occupy subject-section pairs

So the current integrity panel understates the actual debt.

## Subject-Level Discrepancies

### `SCI_ES`

Live coverage says:

- `82 / 82 uncovered`
- `ZERO`

Direct live reconciliation confirms:

- `82` relevant sections
- `0` owned by active real faculty
- `82` still have ownership rows
- all `82` are owned by stale placeholder faculty row:
  - `facultyId = 21774`
  - `name = Teacher X SCI_ES`
  - `isPlaceholder = true`
  - `isStale = true`
  - `isActiveForScheduling = true`

This explains the contradiction:

- coverage treats `SCI_ES` as uncovered because the owner is stale and excluded from active staffing truth
- parts of the assignment surface can still display those rows as taken because saved ownership still exists in the raw ownership index

Live active science teachers do still carry `SCI_ES` as baseline-only assignments, for example:

- `AQUINO, ELPIDIO`
- `ARROYO, DIOSDADO`
- `CRUZ, BENIGNO`
- `DOMINGO, KRISTINE`
- `PASCUAL, JOSEFINA`

But their live summary rows all show:

- `assignmentKind = BASELINE_ONLY`
- `storedCurrentYearSectionCount = 0`
- `ownedCurrentYearSectionCount = 0`

So Earth Science is still not truly recovered to real science teachers.

### `SCI_CHEM`

Live coverage says:

- `35 / 82 uncovered`

Direct live reconciliation shows:

- `47` owned by active real faculty
- `35` still stale-owned
- `0` truly blank

These stale-owned rows are still carried by historical placeholder or stale-faculty ownership rather than active science-teacher ownership.

### `TLE_FCS_EXP`

Live coverage says:

- `54 / 58 uncovered`

Direct live reconciliation shows:

- `4` owned by active real faculty
- `54` stale-owned
- `0` truly blank

This means `TLE_FCS_EXP` is not failing because rows were never created.
It is failing because legacy ownership rows still occupy the pairs without belonging to live active teachers.

### `ENG`

Live coverage says:

- `23 / 82 uncovered`

Direct live reconciliation shows:

- `59` owned by active real faculty
- `23` stale-owned
- `0` truly blank

Sample missing sections are not unowned in storage. They are owned by stale faculty rows such as:

- `CASTILLO, JOSEPH`
- `SORIANO, FELICIDAD`
- `SANTIAGO, DIOSDADO`
- `PANGANIBAN, MARIA`
- `RODRIGUEZ, ANDRES`

These rows are present in `ownershipIndex` but absent from the live faculty summary because their `FacultyMirror` rows are `isStale = true`.

### `FIL`

Live coverage says:

- `22 / 82 uncovered`

Direct live reconciliation shows:

- `60` owned by active real faculty
- `22` stale-owned
- `0` truly blank

This is the same pattern as `ENG`.

Conclusion for `ENG` / `FIL`:

- the user is correct that the rows can look "already taken"
- the backend is also correct to report them as uncovered for live staffing truth
- the contradiction exists because the UI is still using raw saved ownership as a blocking state, while coverage uses active non-stale ownership

## Why `Teacher X` Still Appears

Direct DB probe shows these stale placeholder rows still exist with active section ownership:

- `Teacher X HG` -> `17` sections
- `Teacher X SCI_CHEM` -> `35` sections
- `Teacher X SCI_ES` -> `82` sections
- `Teacher X TLE_FCS_EXP` -> `54` sections

All of them are currently:

- `isPlaceholder = true`
- `isStale = true`
- `isActiveForScheduling = true`

That combination is the main hidden debt:

- summary coverage excludes them from active staffing truth
- raw ownership still carries them
- UI conflict ownership can still surface them

So the current system has not actually erased placeholder debt.
It has only stopped counting that debt as success in the main coverage headline.

## Per-Term / Rotation Status

### What is working

Teacher load calculation is now genuinely rotation-family aware.

The backend currently collapses overlapping family rows by section lane:

- `SCIENCE`
- `TLE_ROTATION`

Live teacher summaries expose:

- `sectionTeachingHoursRaw`
- `rotationFamilyOvercountHours`
- `rotationFamilyLoadDetails`

This means teacher-side weekly load is no longer naively double-counting every rotation-family subject row.

### What is not working well

Per-term behavior is not modeled as an explicit scheduler-facing assignment contract.

Current state:

- `Subject.termCount` exists in the schema
- `rotationFamily` exists in the schema and services
- load math uses `rotationFamily`
- the UI shows rotation adjustment explanation

But the Teaching Load workflow still does not expose:

- an explicit term selector per assignment
- a per-term placement control
- a clear term-by-term ownership surface for rotational subject families

So the current product behavior is:

- per-term is reflected in weekly load computation
- per-term is not clearly controlled or directly editable as a scheduler workflow concept

That is why the user experience still feels unclear even though part of the backend math is now correct.

## Why the UI Still Feels Wrong

The assignment surface currently builds saved ownership from `savedOwnershipIndex` when present.

That index is sourced from raw ownership rows, including stale faculty ownership.

Effect:

- a section can be blocked as "already owned"
- even when the owner is not part of the active faculty roster anymore
- coverage and staffing can simultaneously call the same section uncovered

So the page is still mixing:

- operator-facing active staffing truth
- raw historical ownership truth

without clearly separating them.

## Actual Progress of the Teaching Load Stream

### Real progress achieved

These are real gains, not cosmetic:

1. `Teaching Load` no longer hard-crashes on the prior stale-cache path.
2. Auto-fill no longer fails with the earlier transaction-abort path.
3. Live summary no longer treats placeholder coverage as normal staffed success.
4. Staffing needs now separates:
   - raw uncovered completeness
   - concurrent weekly shortage
5. Rotation-family overcount is now removed from teacher load math.
6. `SPA_SPEC` / `SPS_SPEC` specialization identity is now correctly assignment-level rather than top-level subject explosion.

### What is still unfinished

1. Stale ownership rows are still contaminating the live assignment surface.
2. Stale placeholder rows still exist for `SCI_ES`, `SCI_CHEM`, and `TLE_FCS_EXP`.
3. Stale non-placeholder faculty ownership still exists for `ENG`, `FIL`, `MATH`, and `AP`.
4. Integrity diagnostics do not currently expose stale-ownership debt.
5. Per-term rotation behavior is explained as math, but not surfaced as a clean scheduler control model.
6. The assignment workspace still does not tell the scheduler which owned rows are live-active versus stale-historical without deeper interpretation.

## Bottom Line

Teaching Load is not back at zero, but it is not finished.

Current honest status:

- truth model: improved
- teacher load math: mostly correct
- staffing shortage framing: improved
- specialization contract: repaired
- ownership reconciliation: still broken
- per-term scheduler communication: still weak
- Earth Science / Chemistry / TLE FCS recovery: still unresolved

The single biggest remaining blocker is now:

stale ownership reconciliation across current-year subject-section pairs

Until that is repaired, the page will continue to produce contradictory operator signals:

- "owned" in one place
- "uncovered" in another
- `Teacher X` still appearing in raw ownership history

## Recommended Next Work

1. Reconcile or purge stale current-year ownership rows tied to `isStale = true` faculty.
2. Stop using raw ownership index as the primary saved-owner blocker in the assignment surface without active-owner qualification.
3. Add a separate explicit stale-ownership diagnostic category to Teaching Load integrity.
4. Keep rotation-family teacher math, but add a clear scheduler-facing term/rotation model instead of only a load-adjustment explanation.
5. Re-run science and TLE recovery only after stale ownership cleanup, so the system stops competing with dead owners.
