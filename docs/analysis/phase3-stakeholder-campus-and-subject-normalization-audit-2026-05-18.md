# Phase 3 Stakeholder Campus And Subject Normalization Audit

Date: 2026-05-18

Sources used:
- `ARAL_G7_Class-Program_SY2025-2026.pdf`
- `ARAL_G8_Class-Program_SY2025-2026.pdf`
- `ARAL_G9_Class-Program_SY2025-2026.pdf`
- `ARAL_G10_Class-Program_SY2025-2026.pdf`
- `office-files/GRADE-7-OCCUPANCY-PLAN.pdf`
- `office-files/GARDE-8-OCCUPANCY-PLAN.docx`
- `office-files/BLDG3-BLDG-9-occupancy-plan-2023-24.docx`
- `SSE-PLAN/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- live ATLAS DB
- `prisma/seed.js`
- `atlas-server/src/services/subject.service.ts`

## Executive Summary

Two concerns are validated:

1. the current seeded/live ATLAS campus model is not stakeholder-faithful
2. the current ATLAS subject model is more granular than the stakeholder-facing schedule output

But the correct product move is not:
- flatten ATLAS to only `SCIENCE`, `TLE`, `SPECIALIZATION`, `RESEARCH`

The correct move is:
- keep internal granular subject semantics where they help generation, qualification, and rooming
- add a normalized output contract for schedule display and stakeholder-facing exports
- add a stakeholder-faithful campus/placement repair stream because the current seed topology is too invented

## Building And Room Scope From The Stakeholder PDFs

The PDFs expose a much more concrete campus footprint than the current seeded labels.

## Grade 7
Visible building/room references:
- `BLDG 3 / ROOM 302`
- `BLDG 3 / ROOM 303`
- `BLDG 10 / ROOM 2` through at least `ROOM 20`
- `BLDG 11 / ROOM 4`
- `BLDG 26 / ROOM 5`

Distinct visible building numbers:
- `3`
- `10`
- `11`
- `26`

## Grade 8
Visible building/room references:
- `BLDG 14 R1`
- `BLDG 14 R2`
- `BLDG 13 R1`
- `BLDG 13 R2`
- `BLDG 12 R1`
- `BLDG 12 R2`
- `BLDG 12 R3`
- `BLDG 21 R1` through at least `R6`
- `BLDG 23 R2` through `R4`
- `BLDG 9 R3`

Distinct visible building numbers:
- `9`
- `12`
- `13`
- `14`
- `21`
- `23`

## Grade 9
The extracted PDF text does not consistently preserve the room labels on every page, but the schedule clearly includes:
- regular Grade 9 sections
- SPA sections
- a full-day timetable shape

So Grade 9 still supports the conclusion that school placement is concrete, even if page text extraction is less complete.

## Grade 10
Visible room references are explicit:
- `B9/GF/R1`
- `B9/GF/R2`
- `B9/GF/R4`
- `B9/2F/R1` to `R5`
- `B9/3F/R1` to `R5` (one extraction artifact showed `B93F/R1`)
- `B9/4F/R1` to `R5`

This is the clearest single-grade room map in the PDFs.

## What The Live ATLAS Seed / DB Looks Like Instead

Live building short codes are currently:
- `ADMIN`
- `G7`
- `G8`
- `G9`
- `G10`
- `GYM`
- `MAIN`
- `SCI`
- `SPA`
- `SPS`
- `STEX`
- `TLE`

This is a coherent generic campus seed, but it is not stakeholder-school faithful.

Examples of drift:
- stakeholder files use numbered buildings like `BLDG 10`, `BLDG 21`, `B9`
- ATLAS seed uses thematic academic wings and dedicated special-program buildings:
  - `STE Innovation Center`
  - `SPA Arts Conservatory`
  - `SPS Sports Academy`
- stakeholder special programs appear embedded in the schoolwide building footprint rather than isolated in separately named academies

## Baseline Section-To-Room Evidence From Stakeholder Files

These are the clearest room-tied section baselines currently available from stakeholder artifacts.

### Grade 7 explicit baseline
From `office-files/GRADE-7-OCCUPANCY-PLAN.pdf`:
- `BLDG 10 / ROOM 2` -> `SILANG`
- `BLDG 10 / ROOM 3` -> `DEL PILAR`
- `BLDG 10 / ROOM 5` -> `SPA-B`
- `BLDG 10 / ROOM 6` -> `TANDANG SORA`
- `BLDG 10 / ROOM 8` -> `LUNA`
- `BLDG 10 / ROOM 9` -> `LAKANDULA`
- `BLDG 10 / ROOM 10` -> `BURGOS`
- `BLDG 10 / ROOM 11` -> `BONIFACIO`
- `BLDG 10 / ROOM 12` -> `DAGOHOY`
- `BLDG 10 / ROOM 13` -> `JACINTO`
- `BLDG 10 / ROOM 14` -> `MABINI`
- `BLDG 10 / ROOM 15` -> `PALMA`
- `BLDG 10 / ROOM 16` -> `AGONCILLO`
- `BLDG 10 / ROOM 17` -> `QUEZON`
- `BLDG 10 / ROOM 18` -> `LAPU-LAPU`
- `BLDG 10 / ROOM 19` -> `RIZAL`
- `BLDG 10 / ROOM 20` -> `LOPEZ JAENA`
- `BLDG 3 / ROOM 14` -> `7-STE RAYMUNDO SATIAGO`
- `BLDG 3 / ROOM 15` -> `7-STE ANACLETO DEL ROSARIO`
- `BLDG 24 / ROOM 5` -> `7-SPA-A`

This is the strongest grade-level occupancy baseline we currently have.

### Grade 8 explicit baseline
From `office-files/GARDE-8-OCCUPANCY-PLAN.docx`:
- `BLDG 3 / RM 12` -> `STE8-DIOSCORO UMALI`
- `BLDG 3 / RM 13` -> `STE8-WILLIAM PADOLINA`
- `PAGCOR BLDG / RM 6` -> `SPA8-LUCRECIA KASILAG`

The same file also contains several letter-coded room assignments for regular sections, but the artifact is too messy to treat as a fully clean canonical map without stakeholder confirmation.

### Grade 10 explicit baseline
From `ARAL_G10_Class-Program_SY2025-2026.pdf`:
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

From `office-files/BLDG3-BLDG-9-occupancy-plan-2023-24.docx`:
- `BLDG 3 / ROOM 6` -> `AGAPITO FLORES 10A`
- `BLDG 3 / ROOM 7` -> `FELIX MARAMBA 10B`

### Grade 9 baseline
Current extracted artifacts do not yet provide a comparably clean room-tied baseline for all Grade 9 sections.
The class-program PDF still proves that concrete room placement exists, but not with the same extraction quality as Grades 7 and 10.

## What This Means For Timetabling

The concern is valid, but with nuance.

### What is probably causing real generation distortion
- the older `SPA`/`SPS` null-placement gap has already been repaired through the explicit ATLAS placement overlay contract
- live special-program sections are now persisted with placement, but that placement still sits on a generic seeded campus model rather than a stakeholder-faithful numbered-building topology
- zone/fallback behavior is therefore solving against a coherent but still school-inaccurate campus contract
- the campus topology itself remains more invented than stakeholder-faithful

### What is not yet proven
- that the total room count is too small

In fact, live ATLAS has a large room inventory:
- `G7` wing: `20` rooms
- `G8` wing: `20` rooms
- `G9` wing: `24` rooms
- `G10` wing: `24` rooms
- plus `SPA`, `SPS`, `STEX`, `SCI`, `TLE`, `GYM`

So the strongest issue is not raw count.
It is:
- wrong topology
- wrong placement model
- over-invented special-program campus assumptions
- and mismatched room ownership relative to stakeholder output

## Subject Contract: Internal Granularity vs Output Normalization

The stakeholder PDFs mostly display normalized labels such as:
- `SCIENCE`
- `TLE`
- `SPECIALIZATION`
- `RESEARCH`
- `MAPEH`
- `AP`
- `ESP`
- `FILIPINO`
- `ENGLISH`
- `MATH`

They do not usually expose ATLAS-style internal distinctions like:
- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_IA_EXP`
- `SPA_SPEC`
- `SPS_SPEC`

They only become more explicit when the school cares about it, for example:
- `APPLIED CHEMISTRY`
- `APPLIED PHYSICS`
- `BIOTECH`
- `ICT`
- `RESEARCH 10`
- `SPECIALIZATION 1`
- `SPECIALIZATION 2`
- `SPA SPECIALIZATION`

## Validation Of The Subject Concern

Yes, the concern is real:
- current ATLAS internal subject codes are too literal for stakeholder-facing schedule output
- if we surface those internal codes directly in timetable, room schedules, or faculty schedules, the output will not match the school's actual schedule language

But no, we should not simply delete the internal granularity.

That granularity still helps with:
- teacher qualification
- special-program scope
- room-type suitability
- term-aware internal scheduling logic

## Correct Direction

ATLAS should have two layers:

### 1. Internal scheduling contract
Examples:
- `SCI_BIO`, `SCI_CHEM`, `SCI_ES`
- `STE_APPLIED_CHEM`
- `STE_APPLIED_PHYS`
- `STE_BIOTECH`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `SPA_SPEC`
- `SPS_SPEC`

Purpose:
- generation
- qualification
- room suitability
- workload and coverage

### 2. Normalized display/output contract
Examples:
- internal `SCI_*` -> output `SCIENCE`
- internal exploratory TLE rows -> output `TLE`
- internal `SPA_SPEC` / `SPS_SPEC` -> output `SPECIALIZATION`
- internal `STE_RESEARCH` -> output `RESEARCH`
- preserve explicit labels where the stakeholder output actually does:
  - `APPLIED CHEMISTRY`
  - `APPLIED PHYSICS`
  - `BIOTECH`
  - `ICT`

Purpose:
- timetable page
- faculty schedules
- room schedules
- published/exported stakeholder views

## What This Means For Current ATLAS Outputs

### Timetable output
Should likely show stakeholder-normalized display labels, not raw internal codes.

### Room schedule output
Should also use normalized/stakeholder-facing labels, because the room view is operational.

### Faculty schedule output
Should prefer the same normalized display contract so teachers see the schedule in familiar terms.

### Audit / internal admin surfaces
May still need access to internal canonical codes for debugging and coverage analysis.

## Steering Recommendation

We should add another prompt stream after special-program placement:

1. stakeholder-faithful campus / placement repair
2. subject display normalization contract
3. then rerun KPI / output QA

The product decision should be:
- keep internal subject granularity
- normalize outward-facing schedule labels
- stop pretending the current seeded campus topology is an acceptable proxy for the stakeholder school

## Final Verdict

Yes, the campus/building concern is valid.
- not because live ATLAS necessarily has too few rooms
- but because the topology and placement model are too invented

Yes, the subject-normalization concern is valid.
- not because internal granularity is wrong
- but because stakeholder-facing schedule output should not expose all of that granularity literally

So the next steering move should include:
- a stakeholder-faithful campus/placement repair prompt
- a schedule-output subject normalization prompt
