# 2026-05-27 - Phase 3 Teaching Load Post-Gemini Term-Awareness Audit

## Scope
- Re-audit `Teaching Load` after Gemini's rotational term-awareness UX follow-up.
- Compare live Tailnet teaching-load/staffing data against the current `Teaching Load` UI contract.
- Determine whether the page is closure-grade for scheduler use.

## Verdict
- Backend term-awareness correction: `GO`
- Teaching Load live saved-state truth: `NO-GO`
- Teaching Load scheduler UX/UI closure: `NO-GO`

The backend now exposes the right rotational subject contract, but the page is still not closure-grade because:
- saved coverage truth still shows `70` unresolved `SCI_ES` rows and `70` stale placeholder ownership rows
- staffing truth says those same `70` rows are recoverable by real faculty
- the selected-teacher strip still mixes credited and non-credited signals
- manual assignment preview is still not fully peak-term-aware

## Live Tailnet Findings

### Runtime State
- `runtime/context.source = enrollpro-verified`
- `runtime/context.upstream.reachable = true`
- `runtime/context.activeSchoolYearLabel = 2026-2027`

### Live Saved Teaching-Load Summary
- `assignedPairs = 892`
- `realFacultyAssignedPairs = 892`
- `syntheticPlaceholderPairs = 0`
- `rawAssignedPairs = 962`
- `unassignedPairs = 70`
- `rawUnassignedPairs = 0`

### Live Integrity Diagnostics
- `staleOwnershipRowCount = 70`
- `staleOwnedCurrentYearPairCount = 70`
- `stalePlaceholderPairCount = 70`
- `staleNonPlaceholderPairCount = 0`
- stale ownership samples still point to `SCI_ES, Teacher X`

### Live Coverage Summary
- `SCI_ES`: `82 relevant`, `12 owned`, `70 uncovered`, `14.63%`
- `SCI_BIO`: `82/82`
- `SCI_CHEM`: `82/82`
- `TLE_AFA_EXP`: `58/58`
- `TLE_FCS_EXP`: `58/58`
- `TLE_ICT_EXP`: `58/58`

### Live Staffing / Auto-Fill Truth
- `POST /faculty-assignments/report/staffing-needs` with `REAL_FACULTY_STANDARD` returns:
  - `unresolved = 0`
  - `staffingReport.unassignedSections = 0`
  - `staffingTruth.realOnly.shortageRows = 0`
  - `staffingTruth.realOnly.rowsClosedByRealFaculty = 70`
- `POST /faculty-assignments/auto-fill` preview with `REAL_FACULTY_THEN_TEACHER_X` returns:
  - `teacherXResolution.rowsClosedByTeacherX = 0`
  - `staffingTruth.realOnly.shortageRows = 0`
  - `staffingTruth.hardCap.shortageRows = 0`
  - baseline still shows `realCoveredRows = 892`, `unassignedRows = 70`

## Confirmed Mismatches

### 1. Saved coverage truth and staffing truth are still out of sync
The live staffing model now says the remaining `SCI_ES` gap is recoverable by real faculty, but the saved ownership layer still shows:
- `892/962` assigned
- `70` unassigned
- `70` stale placeholder-owned current-year pairs

This means the backend math was corrected, but the actual ownership state has not yet been reconciled to match the new truth.

### 2. Source-state honesty is still wrong inside staffing controls
Live runtime says EnrollPro is back:
- `source = enrollpro-verified`
- `upstream.reachable = true`

But staffing still returns:
- warning: `Staffing report is running on ATLAS-cached section data because EnrollPro is currently unavailable.`
- `sectionSource = cached-enrollpro`
- `sectionFallbackReason = atlas-mirror-preferred-runtime-control`

The fallback source may be legitimate, but the wording is false. The page should say EnrollPro is active while section evidence is currently coming from ATLAS mirror/cache.

## UX/UI Findings

### 1. Load status still uses the wrong basis
The selected-teacher strip shows `creditedTotalHours`, but status is still derived from teaching-only hours.

Current code path:
- `buildTeachingLoadProfile()` computes:
  - `actualTeachingHours`
  - `creditedTotalHours`
  - `status = deriveLoadStatus(actualTeachingHours)`

Effect:
- a teacher with `27.3h teaching + 5h advisory = 32.3h credited`
- can still be labeled `Below Standard`

That is wrong for scheduler-facing load status. Policy status must follow credited load, not teaching-only load.

### 2. Manual assignment preview is still not fully term-aware
The backend corrected the real rule:
- rotational `SCIENCE` and `TLE_ROTATION` load should count the heaviest single term
- year-round load stacks normally

But the row-level preview logic still uses a narrower heuristic:
- `SubjectRow` marks `No increase` only when the same `rotationLaneKey` already owns the same section
- hover preview still adds raw incoming minutes directly to `actualTeachingHours`

That means the UI can still suggest a weekly increase even when a new rotational assignment should fit under an already-heavier peak term.

This is the clearest remaining scheduler-trust bug.

### 3. Progress and cap visuals still mix incompatible numbers
In the selected-teacher strip:
- main number shows `creditedTotalHours`
- cap bar width still uses `actualTeachingHours`
- cap label text uses `creditedTotalHours / maxHoursPerWeek`

So the number, bar, and status are not all speaking the same language.

### 4. Microtext is still widespread in core trust surfaces
The latest pass did not actually eliminate microtext from the critical surfaces. Key `Teaching Load` areas still use:
- `text-[0.5rem]`
- `text-[0.55rem]`
- `text-[0.58rem]`
- `text-[0.6rem]`

This is still present in:
- `OverviewHeader`
- selected-teacher strip
- load explanation popover
- per-term breakdown tiles
- jump list / utility controls

The page is more truthful than before, but still too small-text-heavy to be comfortably scheduler-first.

### 5. Some labels are still more technical than they need to be
Examples still present:
- `Rotating Term Lane`
- `Peak Adjusted`
- `Rotation Term-Lane Breakdown`

These are better than the old model, but still read like implementation vocabulary instead of scheduler vocabulary.

## What Is Actually Good Now
- Peak-term rotational math is present in backend.
- `rotationTermBreakdown` is live and useful.
- Official term labels are normalized to `Term 1`, `Term 2`, `Term 3`.
- Teacher-first and section-first payloads now expose the needed term-aware metadata.
- The client and server still build and the regression test still passes.

## Final Judgment
`Teaching Load` is not done yet.

The latest Gemini pass improved visibility, but it did not finish the page because:
1. saved truth still conflicts with staffing truth
2. status and progress signals still use inconsistent load bases
3. manual assignment preview is still not fully peak-term-aware
4. the page is still too dense and microtext-heavy in its most important trust surfaces

## Recommended Next Work
1. Reconcile saved ownership state with corrected staffing truth so the remaining `70` `SCI_ES` rows are either:
   - actually reassigned to real faculty
   - or staffing truth is revised if that closure is not meant to persist automatically
2. Fix `Teaching Load` status/progress signals to use one policy-truth basis:
   - credited total for status
   - credited total for cap bar
   - credited total for cap percentage
3. Replace the current manual assignment hover/delta logic with the true peak-term concurrency rule.
4. Run one more narrow Gemini readability pass only after those truth fixes land.
