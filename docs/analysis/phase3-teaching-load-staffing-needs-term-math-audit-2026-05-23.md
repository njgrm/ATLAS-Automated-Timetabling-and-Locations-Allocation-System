# Phase 3 Teaching Load Staffing Needs Term-Math Audit

Date: 2026-05-23
Scope: live Tailnet audit of the post-parity `Teaching Load` staffing-needs report and its relationship to coverage truth and rotation-family load math

## Verdict

The new staffing-needs report is mathematically consistent with the current uncovered-pair model, but it is **not yet trustworthy as a weekly staffing/FTE signal**.

There are now two separate problems:

1. the page summary headline and the coverage/staffing reports still disagree because they do not use the same ownership filter rules
2. the staffing-needs report is still **not rotation-family aware**, so it overstates weekly missing hours for `SCIENCE` and `TLE_ROTATION`

## Live facts

### 1. The large number is real under the current uncovered-pair model

Live `POST /api/v1/faculty-assignments/report/staffing-needs` returns:

- `unassignedSections = 236`
- `missingMinutesPerWeek = 53100`
- `missingHoursPerWeek = 885`
- `recommendedNewHires = 29.5`

This comes directly from the uncovered coverage rows:

- `SCI_ES = 82`
- `TLE_FCS_EXP = 54`
- `SCI_CHEM = 35`
- `ENG = 23`
- `FIL = 22`
- `MATH = 12`
- `AP = 6`
- `STE_ROBOTICS = 2`

Total:

- `82 + 54 + 35 + 23 + 22 + 12 + 6 + 2 = 236`

Since these active subject rows are all currently `225` minutes:

- `236 * 225 = 53100 minutes`
- `53100 / 60 = 885 hours`

So the report is internally consistent.

## What is wrong

### A. The page headline still disagrees with staffing/coverage truth

Live `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55` still returns:

- `assignedPairs = 960`
- `totalPairs = 962`
- `unassignedPairs = 2`

But live `coverage/summary` and `report/staffing-needs` together imply:

- `236` uncovered subject-section pairs

This is not a user misunderstanding. It is a real contract mismatch.

### Root cause

`getAssignmentSummary()` in `faculty-assignment.service.ts` still builds `coverageTotals` from:

- all `subject_section_ownerships` rows for the current-year sections

without filtering ownership down to:

- active scheduling faculty only

By contrast, the newer staffing-needs path in `teaching-load-automation.service.ts` now filters resolved ownership to:

- active current-year sections
- active scheduling faculty IDs

So:

- the summary headline can still count rows owned by excluded/inactive faculty as assigned
- the staffing-needs report does not

That is why the user can see tiny top-level unassigned totals while the staffing modal reports hundreds of uncovered pairs.

## B. The staffing-needs report is still not term-aware

Current staffing-needs logic builds a `workQueue` by iterating:

- every active subject row
- every relevant section row

and then counts each unresolved `subjectId:sectionId` pair independently.

This is correct for:

- coverage completeness at the raw subject-row level

But it is not correct for:

- concurrent weekly shortage/FTE math when the subject rows belong to a rotation family

### Why this matters

Teacher load math is already rotation-family aware elsewhere:

- `computeTeachingLoadMinuteComputation()`
- `resolveLoadRotationFamily()`
- lane keys like `family:${family}:${sectionId}`

That logic removes concurrent weekly overcount for:

- `SCIENCE`
- `TLE_ROTATION`

But staffing-needs does **not** use that same family-lane logic.

Instead, it currently sums:

- `SCI_CHEM`
- `SCI_ES`
- `TLE_FCS_EXP`

as if they were all independent weekly missing classes.

### Result

The new `885 hours/week` figure is a valid **row-completeness shortfall** number under the current subject-section contract, but it is not a valid **concurrent weekly staffing need** number.

For rotation families, it overstates weekly shortage because the report is still counting family members row-by-row instead of lane-by-lane.

## What is currently accurate

### Accurate now

- The staffing-needs report no longer uses the stale `* 30` heuristic.
- The report now correctly includes all uncovered live blocker subjects, including `SCI_ES`.
- The report is truthful about raw uncovered active subject-section pairs.

### Not accurate yet

- The headline `coverageTotals.unassignedPairs` in `/summary`
- The interpretation of `885 hours/week` as a real weekly FTE shortage
- Any staffing recommendation that treats `SCIENCE` and `TLE_ROTATION` uncovered rows as concurrent weekly demand

## What the system is conflating

Right now `Teaching Load` is mixing two different questions:

1. **Contract completeness**
   - Do all active subject rows have subject-section ownership?

2. **Concurrent weekly staffing load**
   - How many weekly hours of teacher capacity are actually missing right now?

For non-rotation subjects, these are close.

For rotation families, they are not the same.

## Practical conclusion

If the staffing-needs report is meant to answer:

- "Which active subject rows are still uncovered?"

then the `236` number is defensible.

If it is meant to answer:

- "How many additional weekly teacher hours or FTEs do we really need?"

then the current `885 hours/week` is overstated because the report is not family-lane aware.

## Next fix direction

The next staffing/reporting pass should do both:

1. align `/faculty-assignments/summary` `coverageTotals` with the same active-faculty ownership filter used by coverage/staffing reporting
2. split staffing reporting into:
   - raw uncovered subject-row completeness
   - family-aware concurrent weekly shortage

Until then:

- raw uncovered rows: useful
- weekly missing hours / hires: not yet trustworthy for rotation families
