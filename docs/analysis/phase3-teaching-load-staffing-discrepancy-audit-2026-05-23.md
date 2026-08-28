# Phase 3 Teaching Load Staffing Discrepancy Audit

Date: 2026-05-23
Scope: live Tailnet plus source audit of current `Teaching Load` staffing discrepancies after manual umbrella `TLE` deletion

## Verdict

The current staffing surface is still drifting in three important ways:

1. qualification is still modeled as a single owning department even when real school practice requires multi-department ownership
2. the staffing-needs modal is still driven by stale auto-fill preview math instead of live coverage truth
3. the left-rail and teacher detail copy still expose the wrong identity fields for schedulers

The next staffing reconciliation pass should treat these as first-class fixes, not polish.

## Live confirmations

### 1. Umbrella `TLE` is now gone from live `Subjects`

After the manual delete, live `/api/v1/subjects?schoolId=1` now shows only:

- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_ICT_EXP`

Live `coverage/summary` also now reports only those three subject codes.

This is the correct direction. The next staffing pass must not recreate umbrella `TLE`.

### 2. `SCI_ES` is still a real uncovered blocker and not just a banner artifact

Live `coverage/summary` shows:

- `SCI_ES = 0 / 82`
- `status = ZERO`

So `SCI_ES` belongs in any staffing-needs or missing-classes drilldown. If it is missing from the modal while still present in the top-page lacking-faculty banner, that is a reporting inconsistency.

### 3. `STE_ROBOTICS` is still owned only by `SCI`

Live `/subjects` shows:

- `code = STE_ROBOTICS`
- `ownerDepartment = SCI`
- `qualificationPriority = DEPARTMENT_FIRST`
- `programScopes = [STE]`
- `termCount = 3`

Given the stakeholder clarification that some `TLE` teachers can legitimately handle Robotics, the current single-owner model is too narrow.

## Source findings

### A. Qualification logic is still single-owner only

Current UI-side qualification logic in `atlas-client/src/pages/FacultyAssignments.tsx` still checks only:

- `subject.ownerDepartment`

Current server-side recovery and redistribution logic in `atlas-server/src/services/faculty-assignment.service.ts` still checks only:

- `matchesSubjectOwnershipDepartment(member.department, subject.code, subject.name, subject.ownerDepartment)`

So the system currently has no first-class way to say:

- `SCI` and `TLE` can both legitimately own `STE_ROBOTICS`

This is the main product-contract gap exposed by Robotics.

### B. The staffing-needs modal is using the wrong backend contract

`handleViewStaffingNeeds()` in `FacultyAssignments.tsx` still calls:

- `POST /faculty-assignments/auto-fill` with `previewOnly: true`

That means the modal content is derived from `teaching-load-automation.service.ts` `staffingReport`, not from the newer live coverage and integrity truth used by the page itself.

That is why the modal can disagree with:

- the red lacking-faculty banner
- `coverage/summary`
- current ownership and reconciliation state

### C. The staffing-needs estimate still uses stale 30-minute math

`buildStaffingReport()` in `teaching-load-automation.service.ts` currently computes:

- `missingMinutesPerWeek = primaryShortage.unassignedSections * 30`

That is stale math for the current subject contract. With active class-program subjects now modeled at `225` minutes, the current estimate is analytically wrong and leads to nonsense like:

- `2 sections (1 hours/week)`
- `~0 additional full-time Science teachers`

This is not just wording drift. It is bad staffing arithmetic.

### D. The modal is only highlighting the primary shortage bucket

`buildStaffingReport()` chooses one `primaryShortage` department and builds the headline from that single bucket.

That causes two problems:

1. the top recommendation text is overly narrow and can mention only one department
2. the modal can under-express parallel blockers such as `SCI_ES` and `STE_ROBOTICS`

### E. Teacher identity copy is still scheduler-hostile

In the left teacher rail and selected-teacher header, the current UI still repeats:

- department
- employee ID
- `Department Baseline`

This is low-value compared with:

- specialization
- whether the teacher is outside their default ownership set
- whether they are manually placed into a cross-department assignment

For scheduler work, specialization is the more useful secondary identity than employee ID.

## What the next staffing reconciliation pass should do

### 1. Introduce multi-department ownership on subjects

The subject contract should support:

- one primary department
- zero or more additional allowed departments

At minimum, the next pass must support cases like:

- `STE_ROBOTICS` owned by `SCI` plus `TLE`

This must flow through:

- `Subjects`
- `Teaching Load`
- auto staffing
- recovery endpoints
- manual assignment explanation

### 2. Keep department-first, but make it plural-aware

The ownership baseline should remain department-first, but it must become:

- department-set-first

Meaning:

- teachers in any allowed owning department are baseline-qualified
- cross-department overrides outside that set stay explicit and exceptional

### 3. Replace staffing-needs modal math with live coverage-based math

The modal should not keep using stale auto-fill preview arithmetic.

It should derive shortages from live coverage truth, including:

- uncovered section count by subject
- subject weekly minutes
- real missing hours per week
- explicit department-set basis

### 4. Make the staffing-needs modal show all real uncovered subjects

The modal should explicitly include:

- `SCI_ES`
- `STE_ROBOTICS`
- `TLE_FCS_EXP`
- and any other zero or partial uncovered real blocker still present in live coverage

It should not silently collapse the experience to a single primary-shortage subject family.

### 5. Replace employee ID prominence with specialization

For the left rail and breakdown rows:

- show specialization
- demote or remove employee ID
- remove repeated `Department Baseline` filler copy

### 6. Explain auto vs manual ownership clearly

The UI should clearly tell the scheduler:

- which departments are baseline-qualified for a subject
- when an assignment is within the ownership baseline
- when a manual assignment is outside the baseline
- when auto staffing will refuse or accept an assignment

## Final conclusion

The next staffing pass should not just rebalance sections.

It must also:

- upgrade the subject ownership model from single-department to multi-department
- replace stale staffing-needs arithmetic with live coverage truth
- and make teacher identity plus qualification guidance legible to schedulers

Without those fixes, staffing output will keep looking contradictory even when the underlying ownership rows improve.
