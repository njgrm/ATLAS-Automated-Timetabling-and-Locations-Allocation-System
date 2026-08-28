# Phase 3 Grade 10 Workbook Comparison

Date: 2026-05-18
Source workbook: `quarter-3_grade-10-schedule-monitoring.xlsx`
Comparison basis:
- workbook structure and raw sheet contents recovered directly from the `.xlsx` package
- live ATLAS DB state
- live latest ATLAS run (`runId=52`)

## Executive Summary
Yes, this workbook helps the current KPI direction a lot.

It reinforces three major conclusions:
1. program-specific day shapes are real and are not just a small edge case
2. ATLAS is still under-modeling Grade 10 special-program demand and placement
3. the current tri-sem refactor can still preserve most of these structural patterns even though the workbook is quarter-based

The workbook should be treated as a strong structural reference, not as a literal final term contract.

## What the Workbook Contains

The workbook has these sheets:
- `schedule summary`
- `monitoring sheet`
- `occupancy`
- subject schedules:
  - `science`
  - `mapeh`
  - `english`
  - `esp`
  - `aral pan`
  - `filipino`
  - `math`
  - `TLE`

That makes it valuable in two ways:
- it captures the section-level day shape
- it captures teacher-by-subject deployment patterns for Grade 10

## Strong Signals From The Workbook

### 1. Grade 10 is not one uniform day shape
The workbook clearly shows at least two different timetable shapes:

- special-program sections start at `10:00` and run through `5:30`
- regular sections mainly occupy `12:00` to `5:30`
- there is also an `ARAL PROGRAM` block around `10:20 - 11:20`
- lunch is consistently `11:20 - 12:00`
- recess is consistently `3:20 - 3:30`

This is the most important operational signal in the workbook.

Implication:
- the current ATLAS Grade 10 windows of `12:00 - 18:00` for `REGULAR`, `STE`, `SPA`, and `SPS` are not faithful to this stakeholder sample
- special programs should not share the exact same Grade 10 start window as regular sections

### 2. The school is already running mixed program logic in one grade level
The workbook explicitly shows:
- STE
- SPA
- SPS
- regular sections
- Aral Program support

Examples in the workbook:
- `APPLIED PHYSICS`
- `RESEARCH 10`
- `SPECIALIZATION 1`
- `SPECIALIZATION 2`
- `SPA SPECIALIZATION`
- `SPS SPECIALIZATION`
- `ARAL PROGRAM`

Implication:
- program-specific subject overlays are real in Grade 10
- ATLAS should not flatten all Grade 10 sections into the same subject/day contract

### 3. Regular Grade 10 appears afternoon-heavy, but special programs are earlier and longer
The regular-class summary blocks begin their main teaching sequence after lunch.
The special-program block on the left begins before lunch.

This lines up with your earlier concern:
- regular Grade 9-10 can remain afternoon-oriented
- special programs need earlier start time to fit both core and specialized work

The workbook strongly supports that direction.

### 4. Rooming is program-aware in the sample
The workbook shows:
- special-program sections using `B3` rooms
- regular Grade 10 sections concentrated in `B9`
- the occupancy plan is explicitly organized by named sections and floors

Implication:
- the stakeholder school is not treating SPA/SPS/STE as room-agnostic
- ATLAS currently lags this because the newly mirrored Grade 10 `SPA A`, `SPA B`, `SPS A`, `SPS B` sections still have:
  - `buildingZoneId = null`
  - `homeRoomId = null`

That is a real drift.

## Comparison Against Current Live ATLAS Data

## 1. Sections
Current live Grade 10 section mirror now includes:
- regular sections
- `STE`
- `SPA A`
- `SPA B`
- `SPS A`
- `SPS B`

But the special-program rows are still incomplete:
- no `homeRoomId`
- no `buildingZoneId`

Workbook contrast:
- special-program rooms are explicit
- room/building usage is not left blank

Conclusion:
- section parity is improving, but special-program physical placement is still not modeled enough for good generation outcomes

## 2. Grade 10 shift windows
Current live ATLAS Grade 10 windows:
- `REGULAR`: `12:00 - 18:00`
- `STE`: `12:00 - 18:00`
- `SPA`: `12:00 - 18:00`
- `SPS`: `12:00 - 18:00`

Workbook contrast:
- special programs visibly start around `10:00`
- regular sections are more afternoon-centered
- Aral support exists before lunch

Conclusion:
- current ATLAS Grade 10 windows are too flat
- the workbook supports program-specific overrides for Grade 10
- this is not just a UI/control issue; it is a generator-feasibility issue

## 3. Grade 10 subjects
Current active Grade 10 ATLAS subjects include:
- core:
  - `AP`, `ENG`, `ESP`, `FIL`, `HG`, `MAPEH`, `MATH`
- science modular set:
  - `SCI_BIO`, `SCI_CHEM`, `SCI_ES`
- regular TLE:
  - `TLE`
- STE:
  - `STE_APPLIED_PHYS`
  - `STE_RESEARCH`
  - `STE_ROBOTICS`
- SPA/SPS:
  - `SPA_SPEC`
  - `SPS_SPEC`

Workbook contrast:
- uses `APPLIED PHYSICS`
- uses `RESEARCH 10`
- shows `SPECIALIZATION 1` and `SPECIALIZATION 2`
- uses `VALUES EDUCATION 10`
- uses `ARAL PROGRAM`

Main drifts:
- workbook uses explicit Grade 10 naming while ATLAS uses generic or program-wide rows
- workbook shows two specialization blocks for special programs; ATLAS currently models SPA/SPS with one umbrella row each
- workbook exposes `ARAL PROGRAM`, which ATLAS does not currently model as a real schedulable subject/control contract
- workbook still reflects quarter naming, but the structural load split is what matters here

Conclusion:
- ATLAS subject semantics are still too compressed for what the school is actually running
- the current umbrella `SPA_SPEC` and `SPS_SPEC` rows may be too thin if the school expects multiple distinct special-program blocks

## 4. Teaching periods and control shape
Workbook Grade 10 pattern suggests:
- many periods are `40` minutes
- lunch is `40` minutes
- recess is `10` minutes
- pre-lunch support/program blocks matter

Current ATLAS template shape:
- `REGULAR`: `8 x 60`
- `STE/SPA/SPS`: `10 x 45`

Conclusion:
- the current ATLAS template math is still not closely aligned to the stakeholder sample
- the workbook strengthens the case that template-capacity repair and policy/window reconciliation are still central

## 5. Timetabling KPI implications
Current latest ATLAS run:
- `assigned=1121`
- `unassigned=1451`
- `hard=610`
- `homeRoomSuccessRate=32.11`
- `term1=1121`, `term2=0`, `term3=0`

Workbook implication:
- the system is likely still solving the wrong shape, not just solving badly
- if special programs really need earlier start windows and dedicated rooms, then current flat Grade 10 windows and incomplete special-program room placement are directly feeding NO-GO

## Does This Support Our Current Direction?
Yes, strongly.

It supports:
- section sync and program parity repair
- subject sync and special-program offerings repair
- teaching-load and timetable-shape repair
- program-specific shift-window logic
- stronger room/home-zone handling for special programs

It also adds one new important emphasis:
- `ARAL PROGRAM` is a real structural feature in the stakeholder sample and should not be ignored as a cosmetic artifact

## Does Quarter-Based Structure Still Transfer To Terms?
Mostly yes, structurally.

What should carry over:
- which programs need earlier start
- which sections are regular vs special-program
- room/building clustering behavior
- presence of specialized blocks
- lunch/recess shape
- the fact that Grade 10 is not one uniform timetable model

What should not be copied blindly:
- literal `Q3` labels
- exact quarter subject naming if tri-sem requires regrouping
- exact weekly rotation counts without validating against the new term model

So the right interpretation is:
- use this workbook for shape and operational patterns
- do not use it as a literal term schema without translation

## Highest-Signal New Discrepancies
1. Live ATLAS Grade 10 windows are too flat across `REGULAR`, `STE`, `SPA`, and `SPS`.
2. Live mirrored `SPA/SPS` Grade 10 sections still lack `homeRoomId` and `buildingZoneId`.
3. `SPA_SPEC` and `SPS_SPEC` may be too compressed compared with the workbook's visible specialization blocks.
4. `ARAL PROGRAM` is visible in stakeholder operations but absent from current ATLAS scheduling semantics.
5. Current template period shape still does not look close enough to the stakeholder sample.

## Recommended Planning Effect
This workbook does not invalidate the current Phase 3 direction.
It sharpens it.

Updated emphasis:
1. finish upstream section parity
2. sync special-program subject state
3. revisit Grade 10 program-specific day-shape controls
4. explicitly decide how `ARAL PROGRAM` should exist in ATLAS
5. only then trust the next KPI rerun as representative
