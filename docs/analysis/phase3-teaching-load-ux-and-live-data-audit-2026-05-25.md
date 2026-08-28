# 2026-05-25 - Teaching Load UX And Live Data Audit

## Scope

- Re-validate current `Teaching Load` live truth on Tailnet.
- Check whether rotation-aware weekly-load math is actually working for both raw and adjusted load.
- Audit whether the current page communicates that math clearly enough for schedulers.

## Live Verification Summary

- Environment: `https://njgrm.buru-degree.ts.net`
- Auth: admin `1000001`
- Verified endpoints:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
  - `POST /api/v1/faculty-assignments/report/staffing-needs`

## Current Live Truth

### Coverage and staffing totals are aligned

- `summary.coverageTotals`
  - `assignedPairs = 843`
  - `rawAssignedPairs = 843`
  - `unassignedPairs = 119`
  - `rawUnassignedPairs = 119`
- `coverage/summary`
  - `SCI_ES = 82 uncovered`
  - `SCI_CHEM = 35 uncovered`
  - `TLE_FCS_EXP = 2 uncovered`
- `staffing-needs`
  - `unresolved = 119`
  - `staffingReport.unassignedSections = 119`
  - `staffingReport.concurrentUnassignedSections = 84`
  - `staffingReport.missingHoursPerWeek = 446.3`
  - `staffingReport.concurrentMissingHoursPerWeek = 315`
  - `staffingReport.rotationAdjustedMinutesPerWeek = 7875`
  - `staffingReport.recommendedNewHires = 10.5`

Conclusion:
- live summary, coverage, and staffing are currently numerically coherent
- remaining blockers are still real `SCIENCE` and `TLE_FCS_EXP` coverage gaps, not stale-truth drift

## Rotation Math Audit

### Verdict

- Rotation-aware math is working live.
- The concern that raw and adjusted rotation numbers are "only 0" is not globally true.
- Most teachers correctly show `0` overlap because they do not currently own overlapping same-family section lanes.

### Evidence

- `146` total teachers in live summary
- `12` teachers with non-zero `rotationFamilyOvercountHours`
- `134` teachers with zero `rotationFamilyOvercountHours`

### Verified non-zero examples

1. `YAP, ROLANDO`
   - Department: `TLE`
   - Raw teaching load: `37.5h`
   - Adjusted concurrent load: `30.0h`
   - Rotation overlap removed: `7.5h`
   - Rotation family: `TLE_ROTATION`
   - Subjects: `TLE_AFA_EXP`, `TLE_FCS_EXP`, `TLE_ICT_EXP`

2. `AQUINO, ELPIDIO`
   - Department: `SCI`
   - Raw teaching load: `31.0h`
   - Adjusted concurrent load: `27.3h`
   - Rotation overlap removed: `3.8h`
   - Rotation family: `SCIENCE`
   - Subjects: `SCI_BIO`, `SCI_CHEM`

3. `QUIAMBAO, PABLO`
   - Department: `TLE`
   - Raw teaching load: `33.8h`
   - Adjusted concurrent load: `30.0h`
   - Rotation overlap removed: `3.8h`
   - Rotation family: `TLE_ROTATION`
   - Subjects: `TLE_AFA_EXP`, `TLE_ICT_EXP`

Conclusion:
- the backend is collapsing same-family section lanes correctly
- the current model still uses one canonical concurrent weekly load, not separate primary term totals
- zero overlap is often the correct outcome, not automatically a defect

## UX/UI Audit

### What is working

- The page is materially more compact and usable than earlier bloated passes.
- The live staffing picture is now honest enough to support real scheduler work.
- `SubjectRow` gives better inline rotation hints than before:
  - `Rotating Lane`
  - `Same section lane across terms`
  - `0h added` vs `increase concurrent weekly load`

### What is still not scheduler-friendly enough

1. The most important explanation is still hidden.
   - The worked calculation is inside an `Info` popover in [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1532).
   - Schedulers must already distrust the numbers before they think to open it.

2. Zero-overlap cases are not explained proactively.
   - The current top strip shows `Raw - Overlap + Credits = Total`.
   - When overlap is `0h`, the page does not explicitly say:
     - `No shared Science/TLE term lane overlap exists for this teacher right now.`

3. The UI still explains `rotation family`, not plain `term behavior`.
   - `SCIENCE` and `TLE_ROTATION` are internal model labels.
   - The page still expects the scheduler to mentally translate that into:
     - `same section across different terms`
     - `shared weekly lane`

4. The selected-teacher band still leans on microtext.
   - The strip around [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:1485) uses very small text and condensed labels.
   - It is denser than before, but still not calm enough for a core trust surface.

5. The page has a code-level inconsistency that can confuse future fixes.
   - `rotationOvercountHours` memo is defined in [FacultyAssignments.tsx](/d:/ATLAS/atlas-client/src/pages/FacultyAssignments.tsx:934) but the rendered strip still uses `loadProfile.rotationOvercountHours` directly in the main arithmetic view.
   - That is not the root cause of the current live numbers, but it is a refactor smell in the trust surface.

## Code Path Audit

- `buildTeachingLoadProfile(...)` in [faculty-assignment-helpers.ts](/d:/ATLAS/atlas-client/src/lib/faculty-assignment-helpers.ts:258) still computes:
  - `rawTeachingHours`
  - `actualTeachingHours`
  - `rotationOvercountHours`
  - `rotationFamilies`
- `SubjectRow.tsx` still computes hover-time lane impact wording and correctly distinguishes:
  - shared lane: `0h added`
  - new lane: increases concurrent load
- `FacultyAssignments.tsx` still builds the main selected-teacher panel from derived client-side load profile data, with API-provided rotation-family detail used as supplemental truth

## Final Verdict

### Live data

- `GO` for live truth coherence
- `GO` for rotation-aware raw vs adjusted load math
- `GO` for current staffing totals making sense against live blockers

### UX/UI

- `NO-GO` for full scheduler clarity
- Current page is no longer a truth-model mess, but it still does not explain expected zero-overlap cases clearly enough
- The remaining issue is communication and calculation visibility, not evidence of a broken rotation engine

## Recommended Next Step

Use the existing worked-calculation clarity pass and make it stricter:

- show a persistent plain-language state when overlap is `0h`
- translate `SCIENCE` / `TLE_ROTATION` into term-based scheduler wording
- keep the popover, but also expose a short always-visible reason line beside the main arithmetic
- unify the displayed top-strip value path so the trust surface uses one consistent source
