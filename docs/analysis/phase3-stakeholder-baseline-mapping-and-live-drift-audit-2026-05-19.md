# Phase 3 Stakeholder Baseline Mapping And Live Drift Audit

Date: 2026-05-19

## Purpose

This report consolidates the stakeholder school artifacts into a validation-ready baseline for ATLAS.

The goal of this pass is not to change runtime knowledge files or re-steer prompts yet.
The goal is to:
- extract the most reliable baseline data from stakeholder files
- compare that baseline against `prisma/seed.js` and the live ATLAS DB
- identify which current ATLAS assumptions are real drift versus still-unconfirmed gaps
- produce a stakeholder-validation packet before more generation evaluation

## Source Inventory

### Primary stakeholder artifacts

- `stakeholderFiles/ARAL_G7_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G8_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G9_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G10_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/GRADE-7-OCCUPANCY-PLAN.pdf`
- `stakeholderFiles/GARDE-8-OCCUPANCY-PLAN.docx`
- `stakeholderFiles/BLDG3-BLDG-9-occupancy-plan-2023-24.docx`
- `stakeholderFiles/OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx`
- `SSE-PLAN/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- `quarter-3_grade-10-schedule-monitoring.xlsx`

### Compared ATLAS sources

- `prisma/seed.js`
- live ATLAS DB and live Tailnet behavior
- current page/service behavior in:
  - `atlas-client/src/pages/Subjects.tsx`
  - `atlas-client/src/pages/SpecializationMapping.tsx`
  - `atlas-server/src/services/subject.service.ts`
  - `atlas-server/src/services/faculty-assignment.service.ts`
  - `atlas-server/src/services/teaching-load-automation.service.ts`

## Confidence Legend

- `High`: directly supported by stakeholder artifacts and clearly parseable
- `Medium`: supported, but based on partial extraction or cross-file inference
- `Low`: plausible, but still needs stakeholder confirmation

## Executive Summary

The most important current drift is no longer just room topology or subject labels.

The strongest newly confirmed drift is that ATLAS is still carrying a **section identity model** that does not match the stakeholder school's operational reality.

Most notably:
- the stakeholder class-program outputs are **section-room anchored**
- stakeholder-facing schedules use **normalized subject labels**
- Teacher X style placeholders are a **real operational concept**
- current ATLAS seeded campus/building assumptions are too generic and too specialized
- live `section_mirrors` still contain many **TLE specialization pseudo-sections** as if they were real class sections

That means future generation evaluation should not be treated as clean until the stakeholder baseline is confirmed and ATLAS is aligned to it.

## 1. Stakeholder-Proven Baseline

### 1.1 Campus and Rooming Model

Confidence: `High`

The stakeholder school uses a numbered-building campus model, not the generic ATLAS seeded model.

Confirmed building references across the artifacts include:
- `BLDG 3`
- `BLDG 9`
- `BLDG 10`
- `BLDG 11`
- `BLDG 12`
- `BLDG 13`
- `BLDG 14`
- `BLDG 21`
- `BLDG 23`
- `BLDG 24`
- `BLDG 26`
- `PAGCOR BLDG`

The class-program PDFs and occupancy plans show that:
- sections are tied to concrete rooms
- grade levels can span multiple buildings
- laboratories and special rooms can exist inside or alongside grade-level buildings
- grade 10 appears more consolidated than lower grades

This supports a stakeholder-faithful campus model where:
- buildings are real numbered buildings
- rooms belong to those buildings
- special rooms are embedded into the actual campus topology
- generation should default to class/home-room logic unless a real exception is proven

### 1.2 Room-Tied Section Baselines

Confidence: `High` for Grade 7 and Grade 10, `Medium` for Grade 8, `Low` for Grade 9

#### Grade 7

Strong baseline from `ARAL_G7_Class-Program_SY2025-2026.pdf` and `GRADE-7-OCCUPANCY-PLAN.pdf`.

Examples:
- `BLDG 3 / ROOM 14` -> `7-STE RAYMUNDO SATIAGO`
- `BLDG 3 / ROOM 15` -> `7-STE ANACLETO DEL ROSARIO`
- `BLDG 24 / ROOM 5` -> `7-SPA-A`
- `BLDG 10 / ROOM 5` -> `7-SPA-B`
- `BLDG 10 / ROOM 2` -> `SILANG`
- `BLDG 10 / ROOM 3` -> `DEL PILAR`
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

The occupancy plan also proves non-classroom rooms inside the same building:
- `BLDG 10 / ROOM 1` -> `CLINIC`
- `BLDG 10 / ROOM 4` -> `MATH LRC`
- `BLDG 10 / ROOM 7` -> `FILIPINO LRC`

#### Grade 8

Partial but useful baseline from `ARAL_G8_Class-Program_SY2025-2026.pdf` and `GARDE-8-OCCUPANCY-PLAN.docx`.

Confirmed examples:
- `BLDG 3 / RM 12` -> `STE8-DIOSCORO UMALI`
- `BLDG 3 / RM 13` -> `STE8-WILLIAM PADOLINA`
- `PAGCOR BLDG / RM 6` -> `SPA8-LUCRECIA KASILAG`

The Grade 8 class-program PDF also shows visible room usage in:
- `BLDG 12`
- `BLDG 13`
- `BLDG 14`
- `BLDG 21`
- `BLDG 23`

The regular room labels in the occupancy doc are not yet clean enough to reconstruct a full exact room map without stakeholder validation.

#### Grade 9

Low-confidence room baseline from current artifacts.

The class-program PDF clearly proves section names and schedule structure, but does not yield a clean full room-tied baseline from OCR alone.
The `BLDG3-BLDG-9` occupancy doc does confirm:
- `BLDG 3 / ROOM 9` -> `FE DEL MUNDO 9A`
- `BLDG 3 / ROOM 10` -> `FRANCISCO QUISUMBING 9B`

That proves Grade 9 is not confined to a single generic grade wing in the stakeholder baseline.

#### Grade 10

Strong baseline from `ARAL_G10_Class-Program_SY2025-2026.pdf`, `quarter-3_grade-10-schedule-monitoring.xlsx`, and `BLDG3-BLDG-9-occupancy-plan-2023-24.docx`.

Confirmed room-tied regular sections in `BLDG 9` include:
- `B9/GF/R1` -> `EMERALD`
- `B9/GF/R2` -> `ONYX`
- `B9/GF/R4` -> `AGATE`
- `B9/2F/R1` -> `TOPAZ`
- `B9/2F/R2` -> `CORAL`
- `B9/2F/R3` -> `DIAMOND`
- `B9/2F/R4` -> `SAPPHIRE`
- `B9/2F/R5` -> `AMBER`
- `B9/3F/R1` -> `AQUAMARINE`
- `B9/3F/R2` -> `JADE`
- `B9/3F/R3` -> `AMETHYST`
- `B9/3F/R4` -> `RUBY`
- `B9/3F/R5` -> `GARNET`
- `B9/4F/R1` -> `CITRINE`
- `B9/4F/R2` -> `OPAL`
- `B9/4F/R3` -> `ALEXANDRITE`
- `B9/4F/R4` -> `PEARL`
- `B9/4F/R5` -> `BERYL`

The occupancy plan also confirms special/high sections in `BLDG 3`:
- `BLDG 3 / ROOM 6` -> `AGAPITO FLORES 10A`
- `BLDG 3 / ROOM 7` -> `FELIX MARAMBA 10B`

### 1.3 Minimum Visible Section Counts

These counts should be treated as the current **document-proven baseline**, not as the final canonical roster until the school validates them.

#### Grade 7

Confidence: `High`

Visible section columns:
- `23` total
- `6` special/high sections:
  - `STE SANTIAGO`
  - `STE DEL ROSARIO`
  - `SPA CAYABYAB`
  - `SPA CELERIO`
  - `SPS PRESAS`
  - `SPS REYES`
- `17` regular sections

#### Grade 8

Confidence: `High` for minimum count, `Medium` for complete program mix

Visible section columns:
- `20` total
- `4` special/high sections:
  - `STE8-WILLIAM PADOLINA`
  - `STE8-DIOSCORO UMALI`
  - `SPA8-LUCRECIA KASILAG`
  - `SPA8-FRANCISCA AQUINO`
- `16` regular sections

No clean SPS proof was visible in the currently parseable Grade 8 schedule artifacts.

#### Grade 9

Confidence: `High` for minimum count, `Medium` for complete program mix

Visible section columns:
- `20` total
- `4` named high/special columns:
  - `QUISUMBING`
  - `FE DEL MUNDO`
  - `SPA NICANOR ABELARDO(A)`
  - `SPA ANTONIO MOLINA(B)`
- `16` regular flower sections

No clean SPS/STE proof was visible in the current Grade 9 PDF text extraction.

#### Grade 10

Confidence: `Medium`

Current proven minimum:
- `21` total
- `18` regular gemstone sections
- `3` named high/special columns visible across the monitoring workbook:
  - `10 AGAPITO FLORES`
  - `10 FELIX MARAMBA`
  - `JULIAN FELIPE`

This should be revalidated with the stakeholder school because the OCR quality is weaker here than in Grades 7 and 8.

### 1.4 Subject Labels In Stakeholder Outputs

Confidence: `High`

Stakeholder-facing schedules mostly use normalized labels such as:
- `SCIENCE`
- `TLE`
- `SPECIALIZATION`
- `RESEARCH`
- `ARAL-READING`

Some special-program subjects do stay explicit, especially in higher/special sections:
- `APPLIED CHEMISTRY`
- `APPLIED PHYSICS`
- `BIOTECH`
- `ICT`

This proves the stakeholder output layer is more normalized than ATLAS internal subject codes.

### 1.5 Teacher Visibility In Stakeholder Outputs

Confidence: `High`

The stakeholder files support split visibility expectations:
- class-program / master schedule outputs do not always need a precise named teacher per cell
- subject-specific or teacher-facing outputs can still be more explicit

The artifacts explicitly show placeholder-style teaching ownership:
- `TEACHER X`
- `TEACHER Y`

That confirms Teacher X is not just an ATLAS workaround. It is part of the school's operational reality.

### 1.6 Subject Schedule Output Need

Confidence: `High`

`CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx` proves that stakeholder workflow includes subject-specific scheduling views.

The workbook contains:
- section-facing class schedules
- subject-specific quarterly sheets:
  - `Q1-BIOLOGY`
  - `Q2-CHEMISTRY`
  - `Q3-EARTH & SPACE`
  - `Q4-PHYSICS`

So a future `Subject Schedule` output is stakeholder-aligned and not optional noise.

## 2. Comparison Against Seed Data

### 2.1 Campus Topology Drift

Confidence: `High`

`prisma/seed.js` and the live seeded shape still assume buildings such as:
- `G7`
- `G8`
- `G9`
- `G10`
- `STEX`
- `SPA`
- `SPS`
- `SCI`
- `TLE`
- `GYM`

This is not stakeholder-faithful.

The stakeholder files instead prove:
- numbered buildings
- mixed-building placement by grade
- special/high sections embedded into real campus rooms
- no evidence of a dedicated stakeholder building named for `SPS`, `SPA`, or `STE`

### 2.2 Section Placement Drift

Confidence: `High`

The seeded model assumes a cleaner one-grade-one-wing arrangement than the stakeholder files support.

Examples of stakeholder reality that conflict with the current seed shape:
- Grade 7 spans `BLDG 3`, `BLDG 10`, `BLDG 24`, and others
- Grade 8 uses `BLDG 3`, `PAGCOR`, `BLDG 12`, `13`, `14`, `21`, `23`
- Grade 10 is concentrated in `BLDG 9` for regulars but still uses `BLDG 3` for named high/special sections

### 2.3 Room-Demand Drift

Confidence: `High`

The stakeholder class-program outputs are classroom/home-room-first.
They do not support the seeded assumption that many ordinary subject sessions should default into dedicated specialized buildings or rooms.

This means the current seed baseline likely overstates non-classroom demand.

## 3. Comparison Against Live DB

### 3.1 Generic Building Model Still Dominates Live Runtime

Confidence: `High`

Live buildings still follow the generic seed abstraction:
- `Main Academic Building`
- `Science and Labs`
- `TLE Building`
- `Grade 7 Academic Wing`
- `Grade 8 Academic Wing`
- `Grade 9 Academic Wing`
- `Grade 10 Academic Wing`
- `STE Innovation Center`
- `SPS Sports Academy`
- `SPA Arts Conservatory`

This is still inconsistent with the stakeholder-proven campus baseline.

### 3.2 TLE Specialization Pseudo-Sections Are Polluting The Section Baseline

Confidence: `High`

This is the strongest new live-data drift.

Live `section_mirrors` for `schoolId=1`, `schoolYearId=55`, `isStale=false` currently show:
- Grade 7: `22` rows
- Grade 8: `23` rows
- Grade 9: `40` rows
- Grade 10: `41` rows

The inflation in Grades 9 and 10 is explained by `44` TLE specialization pseudo-sections mirrored as if they were class sections.

Examples:
- `AFA - Crop Production - A`
- `AFA - Crop Production - B`
- `HE - Cookery - A`
- `HE - Cookery - B`
- `ICT - A`
- `ICT - B`
- `IA - Carpentry - A`
- `IA - Shielded Metal Arc Welding - B`

Shared properties of those pseudo-sections:
- `programType='REGULAR'`
- `homeRoomId=null`
- `buildingZoneId=null`

This does **not** match the stakeholder class-program baseline, where TLE specializations are not represented as extra section identities.

### 3.3 Special-Program Placement Is Still Over-Simplified

Confidence: `High`

Live special-program sections are still tied to generic dedicated buildings such as:
- `SPA Arts Conservatory`
- `SPS Sports Academy`
- `STE Innovation Center`

The stakeholder files do not prove this building model.
They instead show special/high sections living within the real school campus topology.

### 3.4 Inactive Subject Deletion Bug Is A Real DB-State Problem

Confidence: `High`

The user-reported delete error on inactive subjects is real.

Current delete logic blocks deletion whenever a subject still has `faculty_subjects` rows, even if:
- the subject is inactive
- the subject is no longer visible in practical teaching-load flows

Examples of inactive subjects that still have faculty assignment rows:
- `ADVANCED_CHEMISTRY`
- `ADVANCED_PHYSICS`
- `ADVANCED_STATISTICS`
- `BASIC_STATISTICS`
- `BIOTECHNOLOGY`
- `CONSUMERS_CHEMISTRY`
- `ELECTRONICS`
- `ELECTRONICS_ROBOTICS`
- `ENV_SCI`
- `SCI_PHYS`

This is not just a UI bug.
It is a stale data cleanup contract problem.

### 3.5 Teacher X Does Not Belong In Faculty Mirror Long-Term

Confidence: `High`

Live DB currently shows:
- active schedulable faculty: `175`
- placeholder faculty rows found: `0`

That supports the user's concern:
- Teacher X is operationally real
- but it is not surviving well as part of the synced faculty mirror truth

This strongly suggests Teacher X should become an ATLAS-owned overlay or scheduling artifact, not a normal EnrollPro-sourced faculty row.

### 3.6 Subject Granularity Versus Output Granularity

Confidence: `High`

Live active subject contracts still include fine-grained internal rows such as:
- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `STE_ENV_SCI`
- `STE_BIOTECH`
- `STE_APPLIED_CHEM`
- `STE_APPLIED_PHYS`
- `STE_ROBOTICS`
- `STE_ICT`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_IA_EXP`
- dynamic TLE specialization rows

The stakeholder outputs prove this should remain an internal modeling concern, not necessarily a direct display concern.

The correct mismatch diagnosis is:
- internal subject granularity can remain useful for generation and assignments
- stakeholder-facing outputs still need normalization

## 4. Page And Process Implications

### 4.1 Is The Specialization Mapping Page Actually Important?

Short answer: `not in its current operator shape`

Confidence: `High`

The stakeholder workflow is not “scheduler maintains fine specialization logic.”
The stakeholder workflow is closer to:
- department heads decide who can teach what
- higher section / STE placements may already be pre-decided
- the scheduler translates those decisions into the system
- auto-fill can help only where the department did not pre-decide

That means the current specialization mapping page likely creates too much setup friction.

However, it cannot simply be removed today because current qualification logic still depends on:
- `allowedSpecializations`
- specialization alias rows
- qualification matching in auto-fill and assignment services

The better long-term direction appears to be:
- department-based subject qualification defaults from EnrollPro department ownership
- manual section-teacher locks for pre-decided assignments
- auto-fill that respects locked/pre-placed assignments absolutely
- specialization detail retained only where it truly matters

### 4.2 Teaching Load Alone Does Not Replace Pre-Generation Placement Controls

Confidence: `High`

Teaching load is necessary, but it is not sufficient.

The stakeholder process requires a way for schedulers to encode department-head decisions such as:
- this teacher owns this STE section
- this teacher owns this high section subject
- generation must not overwrite those pre-decided placements

That means a future ATLAS control model needs:
- manual pre-generation teaching placements or locks
- auto-fill only for the remaining unplaced demand
- hard respect for locked assignments during generation

### 4.3 Subject Page Visibility Gaps

Confidence: `High`

Current `Subjects` page behavior still hides too much practical detail:
- SPA/SPS spec information is effectively shown only as a locked count badge
- the actual enabled specialization values are not easy to inspect from the list page

This matches the user complaint and should be treated as a real usability gap.

### 4.4 Subject Schedule Is A Real Missing Output

Confidence: `High`

The stakeholder workbook evidence proves ATLAS should eventually support:
- class-program output
- faculty schedule output
- room schedule output
- subject schedule output

Subject schedule is not scope noise.
It is part of the school's current operational reporting.

### 4.5 Map Editor Capability Versus Seed Accuracy

Confidence: `High`

The schema and current map model can support:
- multiple buildings
- many rooms per building
- room type distinctions inside ordinary grade buildings

So the problem is not that ATLAS cannot model the stakeholder campus.
The problem is that the currently seeded/live topology is not close enough to the stakeholder baseline.

## 5. Stakeholder Validation Checklist

The following items should be validated with the school before more generation evaluation is trusted.

### Campus and rooms

- Confirm the canonical building list for the stakeholder school.
- Confirm which numbered buildings are currently in scope for `SY 2026-2027`.
- Confirm which rooms are active instructional rooms versus support rooms.
- Confirm whether special/high sections still keep fixed home rooms in the same buildings shown in the historical files.

### Section roster

- Confirm the final per-grade section counts by program type for the target school year.
- Confirm whether Grade 8 and Grade 9 currently have SPS sections in the new school year.
- Confirm whether TLE specialization should be modeled as:
  - section attribute only, or
  - separate schedulable group rows

### Subject ownership and teaching assignments

- Confirm whether subject qualification should default by department first.
- Confirm which subjects still require specialization-specific qualification.
- Confirm how schedulers should encode department-head pre-decisions before generation.
- Confirm whether Teacher X should remain a formal output artifact when no final named teacher is decided.

### Output expectations

- Confirm that stakeholder-facing section schedules should use normalized labels such as:
  - `SCIENCE`
  - `TLE`
  - `SPECIALIZATION`
  - `RESEARCH`
- Confirm which views need explicit teacher names:
  - class program
  - faculty schedule
  - subject schedule
  - room schedule

## 6. Steering Implications Before More Generation Runs

### Confirmed direction

- Keep internal subject modeling richer than stakeholder-facing display labels.
- Treat Teacher X as a real operational concept.
- Favor classroom/home-room-first scheduling.
- Treat department ownership as more important than exposing large specialization-setup burden to schedulers.
- Add future support for subject schedules as an output surface.

### Confirmed drifts that should be corrected before trusting more KPI comparisons

- live campus topology is still too generic and too specialized
- live section identity is still polluted by TLE specialization pseudo-sections
- special-program placement is still too seed-shaped
- inactive subject cleanup is still broken at the data contract level
- subject page visibility is still too opaque for SPA/SPS spec review

### What should not be assumed yet

- the exact final room roster for every grade, especially Grade 8 and Grade 9
- the exact target-year section mix by program type
- whether all historical building placements will remain the same in `SY 2026-2027`

## 7. Recommended Next Step

Before the next round of generation diagnosis, use this report as a validation packet with the stakeholder school and confirm:
- canonical building and room map
- canonical section roster by grade/program
- TLE specialization modeling expectations
- department-based teaching ownership expectations
- schedule output expectations for class, teacher, room, and subject views

Only after that validation should ATLAS re-baseline its seed/live data and treat subsequent generation KPIs as stakeholder-faithful.
