# Phase 3 Schoolwide Stakeholder PDF Deep Dive

Date: 2026-05-18
Primary sources:
- `stakeholderFiles/ARAL_G7_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G8_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G9_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G10_Class-Program_SY2025-2026.pdf`

Secondary comparison sources:
- `SSE-PLAN/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- `quarter-3_grade-10-schedule-monitoring.xlsx`
- live ATLAS DB/runtime state on Tailnet
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Executive Summary

The new stakeholder PDFs are the strongest schoolwide output reference we have so far.

They do not invalidate the Phase 3 direction, but they do force one major correction:

1. the earlier Grade 10 monitoring workbook should no longer be treated as the main day-shape authority
2. the schoolwide PDFs plus the Grade 8 class-program workbook now look like the better structural contract
3. the current live ATLAS grade-shift window model is much farther from the stakeholder school's final output than we previously thought

The high-level verdict is:

- we are right to keep the program-aware section sync, subject sync, load cleanup, and mapping cleanup work
- we are wrong to treat the current half-day Grade 7/8 AM and Grade 9/10 PM shift assumption as the stakeholder school's long-term steady-state shape
- we should not treat the current seeded/live ATLAS school data as a faithful representation of the stakeholder school's actual section names, room ownership, and special-program placement

Important clarification:
- the stakeholder-provided grade shift windows are for the upcoming `SY 2026-2027`
- the PDFs are `SY 2025-2026` final outputs
- so the correct interpretation is not "discard grade shift windows"
- the correct interpretation is "model grade shift windows as a temporary, configurable transition contract while preserving the ability to return to a whole-day schoolwide schedule later"

## What The New PDFs Establish

## 1. The final stakeholder output is schoolwide and full-day

Across Grades 7 to 10, the PDFs consistently show:
- `7:30 - 8:15`
- `8:15 - 9:00`
- `9:00 - 9:45`
- `9:45 - 10:00` health break
- `10:00 - 10:45`
- `10:45 - 11:30`
- lunch break
- `1:00 - 1:45`
- `1:45 - 2:30`
- `2:30 - 3:15`

For regular sections, the day usually continues with:
- `3:15 - 4:15 ARAL-READING (MON-THURS)`
- `4:15 - 5:00` intervention / home visitation / LAC / co-curricular / culminating activities

Implication:
- the current live ATLAS shift windows (`G7/8 = 06:00-12:00`, `G9/10 = 12:00-18:00`) do not reflect the stakeholder school's `SY 2025-2026` final class-program output
- but they may still represent a valid temporary `SY 2026-2027` transition state based on stakeholder instruction
- ATLAS therefore needs to support both:
  - temporary grade/program shift-window overrides
  - a return path to whole-day schoolwide schedules

## 2. Program-specific differentiation is real in every grade, but it is not purely a shift-window problem

The PDFs show special-program structures such as:
- Grade 7:
  - STE research
  - specialization blocks
  - SPA/SPS sections explicitly labeled
- Grade 8:
  - `RESEARCH`
  - `ICT`
  - `BIOTECH`
  - `SPA SPECIALIZATION`
  - `DEVL READING`
- Grade 9:
  - `RESEARCH`
  - `APPLIED CHEMISTRY`
  - `SPECIALIZATION SPA 1`
  - `SPECIALIZATION SPA 2`
- Grade 10:
  - `APPLIED PHYSICS`
  - `RESEARCH 10`
  - `SPECIALIZATION 1`
  - `SPECIALIZATION 2`

Implication:
- our direction toward program-aware subjects is correct
- but the final stakeholder output suggests the distinction is not just "different start times"
- it is also:
  - different late-day blocks
  - different protected intervention periods
  - different specialization granularity

## 3. ARAL-READING is a structural schedule block

The PDFs repeatedly show:
- `ARAL-READING (MON-THURS)` for many regular sections

This is a much stronger signal than the earlier Grade 10 monitoring workbook's `ARAL PROGRAM`.

Implication:
- ATLAS likely needs a configurable protected block concept for:
  - `ARAL-READING`
  - intervention windows
  - possibly schoolwide non-subject time contracts

This should not be treated as a cosmetic note in the output.

## 4. Teacher X remains operationally real

The new final PDFs still show:
- `TEACHER X`
- `TEACHER Y`

The Grade 8 workbook also still contains `TEACHER X`.

Implication:
- placeholder coverage is not just an initial data-prep artifact
- it is a real operating concept in the stakeholder school's current scheduling reality
- the architectural conclusion still stands:
  - Teacher X should remain an ATLAS-owned scheduling overlay
  - it should not be modeled as true upstream faculty truth forever

## Comparison Against The Earlier Two Workbook Sources

## 1. Versus `CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`

The Grade 8 workbook aligns well with the PDFs.

Shared signals:
- full-day class program
- lunch break
- recess / health break
- STE overlay blocks
- SPA specialization
- developmental reading
- Teacher X appearing in the working schedule

Conclusion:
- the Grade 8 workbook and the schoolwide PDFs support each other
- together they look like a trustworthy structural reference set

## 2. Versus `quarter-3_grade-10-schedule-monitoring.xlsx`

The Grade 10 monitoring workbook is still useful, but it is no longer the strongest authority.

It still helps with:
- program-awareness
- specialization visibility
- operational pressure clues

But the new PDFs show a different, broader reality:
- the schoolwide final output is not a simple Grade 9/10 afternoon schedule
- Grade 10 regular sections in the final PDF are full-day from `7:30` onward
- the monitoring workbook should be treated as a partial operational snapshot, not the final scheduling contract

Conclusion:
- the monitoring workbook remains useful as secondary evidence
- the new PDFs plus the Grade 8 workbook should now drive planning more strongly

## Comparison Against Current Live ATLAS State

## 1. Grade/program shift windows are currently the biggest structural mismatch

Live ATLAS windows:
- Grade 7 regular/STE/SPA/SPS: `06:00 - 12:00`
- Grade 8 regular/STE/SPA/SPS: `06:00 - 12:00`
- Grade 9 regular/STE/SPA/SPS: `12:00 - 18:00`
- Grade 10 regular/STE/SPA/SPS: `12:00 - 18:00`

Stakeholder PDFs:
- all grades show a school-day structure starting at `7:30`
- all grades show pre-lunch and post-lunch teaching blocks
- regular sections show `ARAL-READING` in the late afternoon
- special programs show late specialization/research blocks

Conclusion:
- the current shift-window model is not stakeholder-faithful to the `SY 2025-2026` final outputs
- but it should not automatically be treated as wrong for `SY 2026-2027`
- the deeper product requirement is configurability across both modes, not hard commitment to only one

## 2. The live ATLAS section dataset is not stakeholder-faithful

Current ATLAS mirrors include:
- generic special-program rows like `SPA A`, `SPA B`, `SPS A`, `SPS B`
- STE section names like `SIRIUS`, `VEGA`, `ALTAIR`, `PROCYON`

Stakeholder PDFs show:
- named sections like `STE SANTIAGO`, `STE DEL ROSARIO`
- named SPA/SPS sections tied to school-specific naming
- explicit building/room placement in several grade outputs

Conclusion:
- current live ATLAS data is still more like a seeded pilot dataset than a faithful copy of this stakeholder school's operating roster
- KPI gains on the current dataset still matter for platform readiness
- but they do not yet prove stakeholder-school fidelity

## 3. Special-program placement is still under-modeled in ATLAS

Live DB currently shows:
- all `SPA` and `SPS` section rows for Grades 7 to 10 have:
  - `buildingZoneId = null`
  - `homeRoomId = null`

Stakeholder PDFs imply:
- special-program sections are physically placed
- room/building usage matters

Conclusion:
- special-program placement is not just a Grade 10 issue
- it is a schoolwide gap across all grades in the current ATLAS mirror

## 4. Subject semantics are still too compressed in ATLAS

Current ATLAS active special-program rows are still mostly:
- `SPA_SPEC`
- `SPS_SPEC`
- grade-specific STE overlays

Stakeholder PDFs imply:
- multiple visible specialization blocks
- grade-specific special-program schedules
- development reading and research are part of the timetable shape

Conclusion:
- the current `SPA_SPEC` / `SPS_SPEC` umbrella contract is probably too thin
- even if exact fine-grained strands still come from upstream later, ATLAS needs a better block-level special-program contract now

## 5. Teacher X is validated, but not enough to explain the remaining NO-GO

The stakeholder files confirm Teacher X usage.

That means:
- the placeholder concept is valid
- the earlier Teacher X work was not misguided

But the PDFs also show:
- richer day-shape rules
- protected reading/intervention blocks
- school-specific section placement

Conclusion:
- Teacher X is part of the truth
- it is not the main remaining blocker anymore

## What This Means For The Current Phase 3 Direction

## What remains correct

These completed or ongoing directions still look right:
- upstream section sync and program parity
- subject sync from special-program offerings
- specialization mapping cleanup
- teaching-load signal cleanup
- Teacher X as an explicit coverage concept

## What needs to change

### 1. Reframe the current half-day shift-window model as a temporary override, not the permanent target

The PDFs strongly suggest we should stop treating the current `G7/8 morning` and `G9/10 afternoon` model as the stakeholder school's permanent output target.

But the stakeholder update means we should still preserve and improve that control path for `SY 2026-2027`.

### 2. Promote configurable schoolwide day-shape alignment to the front

We need a schedule-shape contract that can express:
- full-day teaching blocks
- health break
- lunch
- `ARAL-READING`
- intervention block
- special-program late blocks
- temporary grade/program shift-window overrides for years when the school operates that way

### 3. Treat special-program placement as a schoolwide blocker

We need a repair path for:
- `SPA` and `SPS` home-room assignment
- `SPA` and `SPS` building-zone placement
- possibly manual/import-assisted placement if EnrollPro does not own this data

### 4. Revisit the special-program subject model before trusting the next KPI gate

The PDFs suggest ATLAS needs a better representation for:
- multiple specialization blocks
- grade-specific late-day program blocks
- `ARAL-READING` versus specialization usage

## Steering Recommendation

The next steering move should be:

1. **Do not treat the next KPI rerun as the main next action.**
2. **Insert a configurable schoolwide output-alignment repair stream first.**
3. **Use the stakeholder PDFs as the primary structural reference, with the Grade 8 workbook as corroborating evidence.**
4. **Use the Grade 10 monitoring workbook only as secondary operational evidence.**
5. **Treat grade shift windows as a temporary policy layer for `SY 2026-2027`, not as a reason to throw away whole-day support.**

## Recommended New Prompt Order

1. schoolwide day-shape and break-block alignment with temporary shift-window support
2. special-program placement and home-room/zone repair
3. special-program block/subject contract refinement
4. then rerun the KPI gate

## Final Direction Verdict

We are still directionally right on integration and cleanup.

But the new stakeholder PDFs show that the current generator is still solving against an under-modeled school-day contract and an under-modeled special-program placement contract.

So the steering answer is:

- **yes**, keep the Phase 3 repair approach
- **no**, do not go straight back to KPI reruns yet
- **yes**, keep grade shift windows as a valid temporary `SY 2026-2027` control path
- **yes**, pivot the next repair prompts toward configurable schoolwide output-shape fidelity first
