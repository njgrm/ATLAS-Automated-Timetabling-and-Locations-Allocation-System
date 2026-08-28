# Phase 3 Timetabling Readiness Against Teaching Load Audit

Date: 2026-05-26
Scope: verify whether current timetabling/generation/review is ready to consume the cumulative Teaching Load changes as a whole

## Verdict

`NO-GO` for full end-to-end readiness.

Current timetabling is ready to consume some of the newer Teaching Load truth, but it is not yet aligned enough to treat Teaching Load and generation as one coherent contract.

The generator now benefits from:
- cleaner `FacultySubject` scope
- cleaned stale ownership truth
- current subject ownership contract fields such as `ownerDepartment` and `rotationFamily`
- active-year TLE reset away from cohort dependency

But it is still not ready as a whole because:
- the latest active-year generation runs are still all `FAILED`
- the remaining live Teaching Load blockers are not represented truthfully in generator diagnostics
- generator qualification logic still ignores some of the newer Teaching Load semantics
- the review UI still carries older wording that no longer matches the real Teaching Load model

## What Is Ready

### 1. Generation now reads the cleaned assignment scope

`generation.service.ts` builds constructor input from persisted `FacultySubject` rows after normalizing current-year scope:

- `facultySubjectRows -> normalizeStoredAssignmentScope(...)`
- only active, non-stale faculty are included
- stale ownership is no longer the main truth source

This means the stale-ownership reconciliation work did land in the generation path indirectly.

### 2. Subject contract fields are flowing into generation

`generation.service.ts` now fetches active subjects with:
- `ownerDepartment`
- `qualificationPriority`
- `requiredFeatures`
- `modularGroupId`
- `modularOrder`
- `allowedSpecializations`

And `schedule-constructor.ts` is using at least:
- `ownerDepartment`
- `requiredFeatures`
- `modularGroupId`
- `modularOrder`
- `allowedSpecializations`

So the newer subject contract is not isolated to `/teaching-load`.

### 3. Term distribution is no longer collapsed

Latest active-year runs in DB:
- `run 78`: `FAILED`
- `assignedCount=2179`
- `unassignedCount=997`
- `hardViolationCount=827`
- `termCounts={ term1: 1974, term2: 105, term3: 100 }`

This confirms generation is no longer collapsing everything into term 1.

### 4. TLE cohort bypass is active

Latest run summary still carries:
- `MATATAG section-scoped TLE contract active; cohort-based TLE inputs are bypassed for this run.`

And the latest run has:
- `cohortCount=0`
- `cohortizedClassCount=0`

So the old TLE cohort dependency is no longer the blocker.

## What Is Not Ready

### 1. Generator and Teaching Load still disagree on the real staffing blocker shape

Current Teaching Load truth:
- `assignedPairs=843`
- `unassignedPairs=119`
- live coverage blockers:
  - `SCI_ES = 82 uncovered`
  - `SCI_CHEM = 35 uncovered`
  - `TLE_FCS_EXP = 2 uncovered`

Current staffing report:
- `unresolvedRawRows=119`
- `concurrentUnassignedSections=84`
- `rotationAdjustedMinutesPerWeek=7875`
- dominant shortages:
  - `SCIENCE`: `117 raw`, `82 concurrent`
  - `TLE`: `2 raw`, `2 concurrent`

Latest generator run summary:
- `LACKING_FACULTY=0`
- `UNASSIGNED_SECTION=757`
- `FACULTY_SUBJECT_NOT_QUALIFIED=70`
- `SPECIALIZED_ROOM_UNAVAILABLE=240`

That is the clearest readiness problem.

Teaching Load says the remaining live blocker is mostly real `SCIENCE` + residual `TLE`.
Generation still does not express that directly. It spreads the failure into:
- generic `UNASSIGNED_SECTION`
- `FACULTY_SUBJECT_NOT_QUALIFIED`
- no explicit lacking-faculty signal

So the two systems are not yet telling the same story.

### 2. Generator does not consume the newer specialization and capability-override semantics

Current generation constructor input still only passes faculty as:
- `id`
- `maxHoursPerWeek`
- `department`

It does not pass:
- faculty specialization
- `canTeachOutsideDepartment`
- special-program capability overrides
- assignment-level specialization identity

This means the newer Teaching Load work for:
- `SPA_SPEC`
- `SPS_SPEC`
- approved capability overrides
- specialization-aware redistribution

is not fully available to generation.

This is a real gap because Teaching Load now has more truthful special-program semantics than the generator does.

### 3. `qualificationPriority` is fetched but not meaningfully used in constructor qualification

`generation.service.ts` fetches `qualificationPriority`.

But current `schedule-constructor.ts` qualification is still effectively:
- explicit `FacultySubject.sectionIds`
- then department-baseline match through `matchesSubjectOwnershipDepartment(...)`

There is no visible constructor logic that switches behavior based on:
- `DEPARTMENT_FIRST`
- `SPECIALIZATION_PRIMARY`

So the newer subject qualification model is only partially integrated.

### 4. Teaching Load and generation still differ on what “qualified” means

Direct DB inspection shows many active `FacultySubject` rows like:
- `SCI_ES` with `sectionIds=[]`
- `TLE_FCS_EXP` with mixed real and zero-section baseline rows
- `SPA_SPEC` / `SPS_SPEC` fully assigned at section level in Teaching Load

This creates a split:
- Teaching Load coverage cares about real `SubjectSectionOwnership`
- generation qualification still starts from `FacultySubject.sectionIds`

That is not always wrong, but it means:
- coverage truth
- qualification truth
- generator blocker reporting

are still different models.

The strongest symptom is that `SPS_SPEC` appears fully covered in Teaching Load, while the latest generation run summary still reports:
- `qualifiedFacultyCoverageBySubject`
  - `SPS_SPEC: requiredAssignments=8, qualifiedAssignments=0, coveragePercent=0`

That is not closure-grade parity.

### 5. Review/pre-generation UI still uses outdated language

Current timetable UI still shows wording like:
- `No faculty is assigned in teaching load for this session. Any available teacher may be selected.`

This appears in:
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`

That language no longer matches the real model.

The current model is not:
- “any teacher may be selected”

It is:
- explicit Teaching Load ownership when present
- otherwise department-baseline qualification
- plus newer specialization/capability rules that timetabling does not yet expose cleanly

The current wording is too loose and can mislead schedulers.

## Important Interpretation

### Teaching Load is no longer the dominant blocker

This part is improved.

Teaching Load has moved from:
- stale data
- placeholder masking
- broken coverage math

to a mostly truthful staffing surface.

But generation is still structurally failing for reasons beyond Teaching Load alone:
- unassigned section mass
- travel pressure
- room scarcity
- qualification distribution
- overloaded template geometry already documented elsewhere

So the answer is not:
- “Teaching Load is still broken”

The answer is:
- “Teaching Load is healthier, but timetabling has not fully absorbed its newer truth contract.”

### Rotation-aware weekly load truth is not the same as generator qualification truth

This is another important boundary.

Teaching Load’s newer rotation-family work:
- raw vs concurrent weekly load
- lane impact
- per-family overlap removal

is primarily:
- operator truth
- staffing truth
- manual placement truth

The generator does not need to use those exact weekly-load UI fields directly.

What it does need is:
- correct modular/term subject contract
- correct qualification contract
- correct section-scoped subject demand

Those pieces are only partially aligned today.

## Current Readiness Summary

### Ready enough
- stale ownership cleanup no longer poisons generation input
- TLE cohort reset is active
- term split is no longer collapsed
- Teaching Load can now serve as a more truthful staffing reference

### Not ready enough
- generation blocker reporting still does not match Teaching Load blocker truth
- generator does not fully use specialization/capability override semantics
- `qualificationPriority` is not clearly active in constructor behavior
- pre-generation review copy still assumes an older looser qualification model
- end-to-end latest runs are still `FAILED`

## Recommended Next Steps

### 1. Generation qualification parity pass

Timetabling needs a narrow backend pass that:
- aligns generator qualification with current Teaching Load semantics
- explicitly decides what generation should consume from:
  - capability overrides
  - specialization-aware special-program assignments
  - multi-owner department subjects
  - `qualificationPriority`

### 2. Generator blocker-truth pass

Generation summaries and review diagnostics need to express real staffing shortage more honestly.

Specifically:
- if `SCIENCE` and `TLE` are the real uncovered families, generator output should not hide that behind only `UNASSIGNED_SECTION`
- `LACKING_FACULTY=0` is not product-truthful enough under the current live state

### 3. Timetable UI wording cleanup

Pre-generation/manual placement surfaces should stop saying:
- `Any available teacher may be selected`

and instead communicate:
- qualified by current Teaching Load ownership or department/specialization baseline

### 4. Fresh KPI rerun after parity

After qualification/blocker parity is fixed, rerun generation and re-audit:
- blocker counts
- subject-family shortage truth
- latest-run resource diagnostics
- review-surface wording

That is the right point to decide whether timetabling is finally ready to absorb Teaching Load “as a whole”.
