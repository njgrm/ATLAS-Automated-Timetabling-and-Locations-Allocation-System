# Phase 2 Shift-Window + Workbook Gap Report

Date: `2026-05-16`
Author: Codex
Workbook source: `D:\CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`

## Executive Summary

The current generator blockers are not primarily caused by home-room fallback anymore. The dominant failure mode is now a structural mismatch between:

1. the current shift-window rules in the database,
2. the global scheduling-policy time grid,
3. the active class-template demand model, and
4. the stakeholder workbook structure that ATLAS is supposed to reproduce.

The workbook confirms that the system needs to support program-sensitive timetable structures, not just grade-level slot fences. The current implementation only filters a single global grid by grade/program windows; it does not reshape the timetable grid, period count, or subject bundle to match those windows.

That is why:
- sessions can be "assigned within the correct window",
- but the timetable still renders from one universal policy grid,
- and many sections still fail with `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`.

## Verified Findings

### 1. Grade windows filter placement, but do not reshape the timetable grid

Verified in:
- [schedule-constructor.ts](/d:/ATLAS/atlas-server/src/services/schedule-constructor.ts:135)
- [schedule-constructor.ts](/d:/ATLAS/atlas-server/src/services/schedule-constructor.ts:975)

What happens now:
- `buildPeriodSlots(policy)` creates one global set of periods from policy `earliestStartTime/latestEndTime`.
- Those periods are built with a hardcoded `STANDARD_PERIOD_MINUTES = 50`.
- Grade windows are later used only to filter which of those already-built periods a demand item may use.

Implication:
- grade/program windows do not create their own timetable grid,
- they do not change the visible timetable start/end for a grade,
- they do not change the number of usable periods for a grade/program,
- they do not reconcile with class-template `periodsPerDay`.

This confirms your concern: the system currently treats shift windows as eligibility filters, not as timetable shapers.

### 2. The current demand model is mathematically incompatible with the live shift windows

Verified in:
- [class-template.service.ts](/d:/ATLAS/atlas-server/src/services/class-template.service.ts:28)
- [schedule-constructor.ts](/d:/ATLAS/atlas-server/src/services/schedule-constructor.ts:409)

Live data for `schoolId=1`, `schoolYearId=55`:
- Grade 7 window: `06:00-12:00`
- Grade 8 window: `06:00-12:00`
- Grade 9 window: `12:00-18:00`
- Grade 10 window: `12:00-18:00`
- No persisted `SchedulingPolicy` row currently exists for SY55

Active templates:
- `REGULAR`: `60` minutes, `8` periods/day
- `STE`: `45` minutes, `10` periods/day
- `SPA`: `45` minutes, `10` periods/day

Active regular subject load:
- `FIL`, `ENG`, `MATH`, `AP`, `MAPEH`, `ESP`, `TLE` = `240` min/week each
- `HG` = `60` min/week

Why this breaks:
- regular demand still expects a full-day structure,
- but the live grade windows for G7/G8 and G9/G10 are half-day style windows,
- and the constructor does not reduce daily capacity based on `periodsPerDay`.

Result:
- the generator creates more weekly demand than the allowed windowed grid can realistically host,
- which matches the latest KPI diagnostics where `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` dominates.

### 3. `periodsPerDay` is stored but not used to cap demand or shape the grid

Verified in:
- [class-template.service.ts](/d:/ATLAS/atlas-server/src/services/class-template.service.ts:23)
- [schedule-constructor.ts](/d:/ATLAS/atlas-server/src/services/schedule-constructor.ts:409)

Current behavior:
- `computeDemand()` uses template `periodLengthMinutes`,
- but the constructor does not use template `periodsPerDay` to shape the valid daily schedule,
- and does not build a per-program/per-grade grid from template structure.

This is the core planning blocker. Without honoring `periodsPerDay`, the system cannot express:
- regular full-day schedules,
- half-day regular schedules,
- STE/SPA/SPS longer-day schedules,
- mixed lunch-window behavior by program.

### 4. The shift-settings UX is incomplete and currently misleading

Verified in:
- [SchedulingPolicyPane.tsx](/d:/ATLAS/atlas-client/src/components/SchedulingPolicyPane.tsx:499)
- [SchedulingPolicyPane.tsx](/d:/ATLAS/atlas-client/src/components/SchedulingPolicyPane.tsx:510)
- [SchedulingPolicyPane.tsx](/d:/ATLAS/atlas-client/src/components/SchedulingPolicyPane.tsx:897)

Current behavior:
- `Add Override` appends a new card at the bottom.
- New override is hardcoded to:
  - `gradeLevel: 7`
  - `programType: 'STE'`
  - `startTime: '07:30'`
  - `endTime: '12:00'`
- The grade cannot be edited in the UI.
- Only program type and time can be changed.

Impact:
- scheduler cannot create a Grade 9 STE/SPS/SPA override correctly,
- override creation flow is bottom-append form spam,
- it does not explain what happens to policy bounds when overrides exceed or contract them,
- it cannot support the stakeholder rule you described without code change.

### 5. Policy and shift windows currently reject each other instead of guiding the scheduler

Verified in:
- [grade-window.service.ts](/d:/ATLAS/atlas-server/src/services/grade-window.service.ts:20)
- [scheduling-policy.service.ts](/d:/ATLAS/atlas-server/src/services/scheduling-policy.service.ts:717)

Current behavior:
- saving a grade window outside policy bounds throws `WINDOW_OUT_OF_POLICY_BOUNDS`
- saving a policy outside existing windows throws `POLICY_CONFLICTS_WITH_SHIFT_WINDOWS`

This is correct as a guardrail, but incomplete as scheduler UX.

What is missing:
- no modal explaining which object will be adjusted,
- no guided "expand policy to fit windows" or "trim windows to fit policy" action,
- no first-touch ownership model,
- no preview of consequences before save.

### 6. The Grade 9 building is present and mapped; the homelessness issue is likely downstream

Verified from live local DB:
- Grade 9 building exists: `Grade 9 Academic Wing`, shortCode `G9`
- Grade 9 rooms exist with `buildingZoneId = G9`
- Grade 9 sections in SY55 already have:
  - `homeRoomId`
  - `buildingZoneId = G9`

Examples:
- `ANTHURIUM` -> `homeRoomId=85`, `buildingZoneId=G9`
- `CATTLEYA` -> `homeRoomId=86`, `buildingZoneId=G9`
- `TULIP` -> `homeRoomId=96`, `buildingZoneId=G9`

Conclusion:
- this is not primarily a missing-building seed problem,
- it is more likely that Grade 9 sections are being stranded after time-grid filtering, qualification filtering, or subject/program demand mismatch.

### 7. The G10-before-G7 ordering bug is real

Verified in:
- [ScheduleReviewWorkspace.tsx](/d:/ATLAS/atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx:995)

Current behavior:
- section pivot groups are sorted with `localeCompare()` on labels like `G10 · Regular`, `G7 · Regular`

Impact:
- lexical sort places `G10` before `G7`

This is a UI sorting bug, not a data bug.

### 8. The workbook confirms quarter-era science sheets and does not by itself validate tri-sem

Workbook sheets include:
- `SUMMARY Q1 PAGE1`
- `SUMMARY Q1 PAGE2`
- `SUMMARY Q1 PAGE3`
- `Q1-BIOLOGY`
- `Q2-CHEMISTRY`
- `Q3-EARTH & SPACE`
- `Q4-PHYSICS`
- subject sheets: `MATH.`, `ENG`, `ESP.`, `AP.`, `FIL`, `MAPEH.`
- `CLASS SCHEDULES`

Implication:
- the workbook is explicitly quarter-era,
- it supports the observation that last school year still ran a 4-part science split,
- it does not by itself prove the next-school-year tri-sem target.

Use this workbook as:
- evidence for timetable shape,
- evidence for subject minutes and program loading patterns,
- evidence for how special programs inherit regular core subjects.

Do not use it as sole authority for tri-sem closure.

### 9. Current subject data and template bindings are materially out of sync with the workbook

#### 9a. Active subject table still contains legacy/stale STE rows

Observed active rows include:
- `ADVANCED_CHEMISTRY`
- `ADVANCED_PHYSICS`
- `ADVANCED_STATISTICS`
- `BASIC_STATISTICS`
- `ELECTRONICS`
- `ENVIRONMENTAL_SCIENCE`

These are not aligned cleanly with the current default seed file and create ambiguity about what is actually in scope for generation.

#### 9b. Template subject bundles reference legacy subject codes

Verified in live DB template bindings:
- `REGULAR` template includes `SCI`
- `STE` template includes `SCI` and `RESEARCH_I`
- `SPA` template includes `SCI`

But the active seeded/default subject set now uses:
- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `SCI_PHYS`
- `STE_RESEARCH`

That means template bindings and subject inventory are already drifted apart.

#### 9c. Core subject scope logic partially works for STE/SPA, but not for SPS and similar programs

Verified in:
- [subject-program-scope.service.ts](/d:/ATLAS/atlas-server/src/services/subject-program-scope.service.ts:48)

Current logic:
- `STE` sections can take `REGULAR` or `STE`
- `SPA` sections can take `REGULAR` or `SPA`
- all other program types default to `REGULAR` only

Impact:
- SPS does not currently model "regular core + specialized subjects" correctly
- future special-program scheduling will under-model stakeholder reality unless program rules are broadened

### 10. EnrollPro is already the live source of truth for offered SCP programs and TLE specialization ownership

Validated against the live `dev-jegs` Tailnet environment on `2026-05-17`:

- `GET /api/settings/scp-config` currently reports:
  - `SCIENCE_TECHNOLOGY_AND_ENGINEERING` offered
  - `SPECIAL_PROGRAM_IN_THE_ARTS` offered
  - `SPECIAL_PROGRAM_IN_SPORTS` offered
- `GET /api/integration/v1/sections` currently exposes:
  - `programType`
  - `gradeLevel`
  - `tleProgramId`
  - `tleSpecialization`
  - `tleProgramCategory`
- `GET /api/admin/tle-programs` currently exposes the active TLE catalog, including live programs such as:
  - `ICT`
  - `HE - Cookery`
  - `HE - Baking and Pastry Arts`
  - `HE - Caregiving`
  - `IA - Carpentry`
  - `IA - Electrical Installation`
  - `IA - Electronics`
  - `IA - Shielded Metal Arc Welding`
  - `AFA - Crop Production`
  - `AFA - Fishery Arts`
  - `AFA - Swine Production`

Implication:
- TLE specialization rows should not be maintained as a purely static ATLAS seed concern anymore.
- EnrollPro already knows:
  - which sections own a TLE specialization,
  - which grade levels those sections belong to,
  - which specialization labels and categories are active.
- ATLAS should translate that upstream context into schedulable subject rows, cohort ownership, and template activation instead of keeping a disconnected local list.

### 11. SPA and SPS should also become upstream-driven, but the current live EnrollPro detail is incomplete

Validated against the protected EnrollPro curriculum config:
- `GET /api/curriculum/55/scp-config` can expose:
  - `artFields`
  - `languages`
  - `sportsList`
  - SCP workflow steps/rubrics
- In the current live dataset, `artFields` and `sportsList` are still empty arrays.

Implication:
- EnrollPro is already the correct architectural owner for SPA/SPS offering detail,
- but the current live data is not yet rich enough for ATLAS to auto-materialize detailed SPA or SPS subject inventories.

Therefore the correct interim model is:
- SPA/SPS offered state comes from EnrollPro,
- SPA/SPS detailed specialization rows remain umbrella placeholders in ATLAS until EnrollPro actually supplies populated specialization arrays,
- TLE can move earlier to a truly upstream-driven model because the necessary live catalog and section ownership data already exists.

## Workbook Findings

## A. What the Grade 8 workbook clearly shows

### Regular Grade 8 sections

From `CLASS SCHEDULES`, regular Grade 8 sections such as:
- `BEC 8-1. MATULUNGIN`
- `BEC 8-2. MASUNURIN`
- `BEC 8-9. MASIPAG`
- `BEC 8-10. MAALALAHANIN`

show this pattern:
- flag ceremony `7:00-7:30`
- class blocks generally `60` minutes
- recess around `9:30-9:45`
- lunch break around `11:45-1:00`
- full-day schedule extending to `5:00 PM`

Subject minute pattern observed from sample sections:
- `MATH` = `240`
- `SCIENCE` = `240`
- `AP` = `240`
- `ESP/GMRC` = `240`
- `FILIPINO` = `240`
- `TLE` = `240`
- `ENGLISH` = `240`
- `MAPEH` = `240`

This strongly supports the current regular subject minute defaults of `240` minutes for Grade 8 regular sections.

### STE Grade 8 sections

From `STE8-WILLIAM PADOLINA` and `STE 8-DIOSCORO UMALI`, the workbook shows:
- core subjects are still present
- periods are shorter, effectively `45` minutes
- specialized subjects are layered on top
- lunch remains in the middle of the day
- the day extends later than the morning-only window

Observed sample minute pattern:
- core subjects such as `SCIENCE`, `MATH`, `ENGLISH`, `FILIPINO`, `AP`, `ESP`, `MAPEH` appear at `90` minutes in the extracted sample
- specialized subjects appear in `45`-minute blocks:
  - `RESEARCH`
  - `ICT`
  - `BIOTECH`
  - `DEVL READING`
  - specialization rows

Interpretation:
- the sheet supports the claim that special programs are not just half-day regular classes,
- they require a longer, differentiated daily structure,
- and they carry regular plus specialized demand.

## B. What the workbook does not prove

- It is Grade 8 only.
- It is last-school-year data.
- It is quarter-era for science.
- It does not validate the stakeholder's new Grade 9/10 afternoon design by itself.

That new stakeholder rule must be treated as an updated future-state configuration requirement, not something "already proven" by this workbook.

## Current-System vs Workbook Mismatch Matrix

| Area | Workbook / stakeholder signal | Current ATLAS behavior | Verdict |
|---|---|---|---|
| Grid shaping | Different program structures imply different usable daily grids | One global grid from policy only | Mismatch |
| Grade windows | Should affect actual schedule shape | Only filters candidate slots | Mismatch |
| Policy/window UX | Scheduler needs guided mutual adjustment | Save fails with hard validation only | Mismatch |
| Regular Grade 8 load | `240` min core subjects looks correct | `240` min defaults exist | Mostly aligned |
| Special programs | Regular core + specialized overlays | STE/SPA partly modeled, SPS not properly modeled | Partial mismatch |
| Science structure | Workbook is 4-quarter-era | current codebase claims tri-sem but still has drift | Mismatch |
| Template bundles | Should reference current active subject IDs/codes | still references `SCI`, `RESEARCH_I` | Mismatch |
| Grade sort order | numeric grade order | lexical label sort | Mismatch |
| Grade 9 building data | should exist for G9 homerooms | exists and mapped | Data aligned |

## Planning Reset: What Must Happen Before More Phase 2 Closure Work

### Priority 1. Define timetable shape as a first-class configuration model

The system needs an explicit schedule-shape model per grade/program that controls:
- visible start time
- visible end time
- period length
- periods per day
- lunch behavior
- special-event rows

Grade windows alone are not enough.

### Priority 2. Reconcile policy bounds and shift windows with guided ownership

Required UX behavior:
- if scheduler changes policy first:
  - system warns which grade/program windows will be expanded, clipped, or invalidated
- if scheduler changes a window first:
  - system warns whether policy will be expanded or save will be blocked

This should be a guided modal, not a silent append-and-fail flow.

### Priority 3. Separate "window eligibility" from "program timetable template"

Needed distinction:
- shift window = when a grade/program may occupy time
- timetable template = how many periods and what period lengths that grade/program actually uses

Right now those two concepts are collapsed incorrectly.

### Priority 4. Repair template/subject inventory drift

Must reconcile:
- template bundles referencing `SCI` and `RESEARCH_I`
- active subject rows using `SCI_BIO/SCI_CHEM/SCI_ES/SCI_PHYS` and `STE_RESEARCH`
- legacy extra STE subject rows still active

Without this cleanup, simulation results will remain unstable.

### Priority 5. Expand special-program modeling beyond STE and SPA

SPS specifically needs:
- regular core bundle
- specialized overlay bundle
- own daily shape

Current program-scope logic is not enough for that.

## Recommended Next Planning Sequence

1. Freeze Phase 2 closure attempts.
2. Treat the current blocker as a timetable-shape and data-contract reset.
3. Resolve these in order:
   - timetable shape model
   - policy/window mutual-adjustment UX
   - template/subject bundle cleanup
   - special-program scope rules
   - only then rerun home-room KPI recovery

## Concrete Next Implementation Tracks

### Track A. Timetable Shape Refactor
- Replace single global `STANDARD_PERIOD_MINUTES` scheduling assumption.
- Introduce per-grade/per-program grid generation.
- Make timetable display derive from the same shape model used by generation.

### Track B. Policy + Shift Settings UX Fix
- Replace bottom-append override cards with a controlled matrix or editable row list.
- Allow grade selection on override creation.
- Add preview modal for policy/window conflict resolution.

### Track C. Template + Subject Contract Cleanup
- Remove stale template references to `SCI` and `RESEARCH_I`.
- Decide whether science is truly tri-sem next SY or still quarter-sliced for transition.
- Map special-program bundles from stakeholder rules, not legacy placeholders.

### Track D. Validation/Evidence Reset
- Stop interpreting Grade 9 homelessness as a missing-building problem.
- Re-run diagnostics after timetable-shape/model repair, not before.

## Bottom Line

Your current concerns are valid.

The most important verified conclusion is:

`homeRoomSuccessRate` is now being suppressed mainly by timetable-shape incompatibility, not by missing Grade 9 buildings or casual specialized-room fallback.

The next plan should therefore pivot from:
- "keep tuning fallback and constraints"

to:
- "repair the schedule-shape model, subject/template data contract, and policy/shift-window UX so the generator is solving the right problem."
