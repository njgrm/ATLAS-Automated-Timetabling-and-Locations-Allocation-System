# Phase 3 Occupancy Plan Capacity And Placement Audit

Date: 2026-05-18

Sources:
- `office-files/GRADE-7-OCCUPANCY-PLAN.pdf`
- `office-files/GARDE-8-OCCUPANCY-PLAN.docx`
- `office-files/BLDG3-BLDG-9-occupancy-plan-2023-24.docx`
- `office-files/OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx`
- `ARAL_G7_Class-Program_SY2025-2026.pdf`
- `ARAL_G8_Class-Program_SY2025-2026.pdf`
- `ARAL_G9_Class-Program_SY2025-2026.pdf`
- `ARAL_G10_Class-Program_SY2025-2026.pdf`
- live ATLAS DB

## Executive Summary

The occupancy-plan files confirm the direction, but they refine the problem:

1. the current live ATLAS issue is no longer "special-program sections have no rooms"
2. the issue is now "the live section-to-room placement is filled, but filled with a generic seeded campus contract that does not match stakeholder occupancy artifacts"
3. the office files do not yet provide a complete, clean schoolwide occupancy baseline for every grade, but they are strong enough to prove that the current generic `G7/G8/G9/G10 + SPA/SPS/STEX` placement model is not stakeholder-faithful

## What The Office Files Confirm

## Grade 7
`GRADE-7-OCCUPANCY-PLAN.pdf` is the strongest occupancy artifact in this folder.

It explicitly ties sections to rooms:
- Building `10`
  - Room `2` -> `SILANG`
  - Room `3` -> `DEL PILAR`
  - Room `5` -> `SPA-B`
  - Room `6` -> `TANDANG SORA`
  - Room `8` -> `LUNA`
  - Room `9` -> `LAKANDULA`
  - Room `10` -> `BURGOS`
  - Room `11` -> `BONIFACIO`
  - Room `12` -> `DAGOHOY`
  - Room `13` -> `JACINTO`
  - Room `14` -> `MABINI`
  - Room `15` -> `PALMA`
  - Room `16` -> `AGONCILLO`
  - Room `17` -> `QUEZON`
  - Room `18` -> `LAPU-LAPU`
  - Room `19` -> `RIZAL`
  - Room `20` -> `LOPEZ JAENA`
  - Room `1` -> `CLINIC`
  - Room `4` -> `MATH LRC`
  - Room `7` -> `FILIPINO LRC`
- Building `3`
  - Room `14` -> `7-STE RAYMUNDO SATIAGO`
  - Room `15` -> `7-STE ANACLETO DEL ROSARIO`
- Building `24`
  - Room `5` -> `7-SPA-A`

Important note:
- this file does not clearly show the `SPS` placements even though the Grade 7 class-program PDF does
- so the artifact is strong, but not fully complete

## Grade 8
`GARDE-8-OCCUPANCY-PLAN.docx` is partial and somewhat messy, but still useful.

It clearly shows:
- `BLDG 3 RM 12` -> `STE8-DIOSCORO UMALI`
- `BLDG 3 RM 13` -> `STE8-WILLIAM PADOLINA`
- `PAGCOR BLDG RM 6` -> `SPA8-LUCRECIA KASILAG`

It also includes many letter-coded room assignments (`A` through `P`) for regular sections, but this file is not clean enough to treat as a full canonical map without more stakeholder clarification.

## Grade 10
The class-program PDF itself is the strongest placement artifact:
- `B9/2F/R3` -> `DIAMOND`
- `B9/4F/R4` -> `PEARL`
- `B9/3F/R5` -> `GARNET`
- `B9/GF/R1` -> `EMERALD`
- `B9/3F/R4` -> `RUBY`
- `B9/4F/R2` -> `OPAL`
- `B9/2F/R5` -> `AMBER`
- `B9/2F/R4` -> `SAPPHIRE`
- `B9/3F/R2` -> `JADE`
- `B9/2F/R1` -> `TOPAZ`
- `B9/GF/R2` -> `ONYX`
- `B9/3F/R3` -> `AMETHYST`
- `B9/2F/R2` -> `CORAL`
- `B9/3F/R1` -> `AQUAMARINE`
- `B9/4F/R3` -> `ALEXANDRITE`
- `B9/GF/R4` -> `AGATE`
- `B9/4F/R5` -> `BERYL`
- `B9/4F/R1` -> `CITRINE`

The older `BLDG3-BLDG-9-occupancy-plan-2023-24.docx` also shows:
- Building `3`
  - Room `6` -> `AGAPITO FLORES 10A`
  - Room `7` -> `FELIX MARAMBA 10B`
- Building `9`
  - many Grade 10 regular gemstone sections tied to numbered rooms

This confirms the stakeholder pattern:
- Grade 10 regular sections are heavily concentrated in one building
- special sections and labs may still use other buildings

## Grade 9
The office-files folder does not currently provide a clean Grade 9 occupancy artifact comparable to Grade 7 or Grade 10.

So for Grade 9 we still rely more on:
- class-program PDF structure
- later stakeholder clarification
- room-placement heuristics inferred from nearby files

## Comparison Against Current Live DB

Current live section totals:
- Grade `7`: `22`
- Grade `8`: `23`
- Grade `9`: `18`
- Grade `10`: `19`

Current live placement state:
- all active sections now have `homeRoomId`
- all active sections now have `buildingZoneId`

So the old "null placement" blocker is no longer the best description.

## What the live placement actually looks like
The live DB now maps sections into generic seeded buildings such as:
- `Grade 7 Academic Wing`
- `Grade 8 Academic Wing`
- `Grade 9 Academic Wing`
- `Grade 10 Academic Wing`
- `STE Innovation Center`
- `SPA Arts Conservatory`
- `SPS Sports Academy`

Examples:
- Grade 7 `SPA A` -> `SPA-101` in `SPA Arts Conservatory`
- Grade 7 `SPS A` -> `SPS-101` in `SPS Sports Academy`
- Grade 10 `ALTAIR` -> `STE-CompLab-1` in `STE Innovation Center`
- Grade 10 regular sections -> `G10-*` rooms in `Grade 10 Academic Wing`

This is coherent internally, but it does not match the stakeholder artifacts well.

## What This Means

## 1. Room count is not the main proven problem
The live ATLAS campus already has many rooms.
The occupancy artifacts do not prove an obvious raw room deficit.

## 2. Placement fidelity is the stronger problem
The stakeholder school uses:
- numbered buildings
- mixed-building grade placement in some grades
- building-specific special-program placement

The current ATLAS seed instead assumes:
- one generic grade wing per regular grade
- one dedicated STE building
- one dedicated SPA building
- one dedicated SPS building

That is a much stronger mismatch than simple room count.

## 3. The current placement prompt needs widening
The next placement repair should no longer focus only on:
- filling null `homeRoomId`
- filling null `buildingZoneId`

It should now focus on:
- stakeholder-faithful campus and section placement contract
- whether placement should come from:
  - imported occupancy overlays
  - manual ATLAS mapping
  - future SSE-level orchestration

## Can The Stakeholder Plans Support The Current Live Section Counts?

Partially yes, but not cleanly enough yet to call full parity.

### Grade 7
- available occupancy artifacts support at least `20` student sections explicitly
- live ATLAS has `22`
- missing `SPS` placement pages likely explain the gap

### Grade 8
- artifacts are partial and messy
- they clearly support STE + SPA + many regular sections
- they do not yet cleanly prove all `23` live sections

### Grade 9
- current office-files do not provide enough occupancy detail to validate all `18` live sections

### Grade 10
- artifacts clearly support the current scale of `19` live sections
- Grade 10 is the strongest validated grade for room placement

## Steering Implication

Do not change direction away from placement work.

Do change the exact goal:
- from "fill missing placement fields"
- to "repair stakeholder-campus placement fidelity"

And do not yet assume the office-files folder is a complete enough import source for the entire school.

## Final Verdict

- The occupancy plans support the current direction.
- They do not support the current seeded campus topology.
- They are strong enough to justify widening the next placement prompt.
- They also justify adding explicit stakeholder section-to-room baseline evidence into the normalization audit.
