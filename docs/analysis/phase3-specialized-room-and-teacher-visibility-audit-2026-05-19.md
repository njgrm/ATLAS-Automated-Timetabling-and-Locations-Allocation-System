# Phase 3 Specialized Room And Teacher Visibility Audit

Date: 2026-05-19

Primary sources:
- `ARAL_G7_Class-Program_SY2025-2026.pdf`
- `ARAL_G8_Class-Program_SY2025-2026.pdf`
- `ARAL_G9_Class-Program_SY2025-2026.pdf`
- `ARAL_G10_Class-Program_SY2025-2026.pdf`

Secondary sources:
- `docs/verification/evidence-log.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- live ATLAS subject/template contract

## Executive Summary

The stakeholder class-program PDFs do **not** provide strong evidence for a highly specialized per-subject rooming model.

What they show much more strongly is:
- one section column
- one building/room heading for that section
- many subjects taught under that same section-room heading across the day

This pattern holds even for:
- `SCIENCE`
- `TLE`
- `SPECIALIZATION`
- `RESEARCH`
- `APPLIED CHEMISTRY`
- `APPLIED PHYSICS`
- `BIOTECH`
- `ICT`

So the current ATLAS assumption that a large share of demand must be scheduled into:
- `LABORATORY`
- `COMPUTER_LAB`
- `TLE_WORKSHOP`
- `GYMNASIUM`

appears over-modeled relative to the stakeholder's class-program outputs.

This does **not** prove that specialized facilities never matter.
It does prove that the master schedule contract should not force specialized-room assignment as the default interpretation for a large portion of the curriculum unless the school explicitly configures that.

## What The PDFs Actually Show

## 1. Each section is anchored to one room heading

### Grade 7
The PDF shows explicit section room headings such as:
- `BLDG 3 / ROOM 302`
- `BLDG 3 / ROOM 303`
- `BLDG 10 / ROOM 5`
- `BLDG 10 / ROOM 4`
- `BLDG 11 / ROOM 4`
- `BLDG 26 / ROOM 5`

Under those headings, the same section column then contains:
- `SCIENCE`
- `TLE`
- `SPECIALIZATION`
- `RESEARCH`

with no separate room switch being shown for those subjects.

### Grade 8
The PDF shows room headings such as:
- `BLDG14 R1`
- `BLDG13 R1`
- `BLDG14 R2`
- `BLDG12 R3`
- `BLDG21 R2`
- `BLDG21 R5`

Under those same section columns, the schedule includes:
- `SCIENCE`
- `TLE`
- `RESEARCH`
- `ICT`
- `BIOTECH`
- `SPA SPECIALIZATION`
- `DEVL READING`

Again, the PDF does not show those blocks moving to separate rooms.

### Grade 9
Even though room extraction is weaker, the same section-column pattern is still visible.
The grade-level schedule includes:
- `TLE`
- `RESEARCH`
- `APPLIED CHEMISTRY`
- `SPECIALIZATION SPA`

There is no strong room-switch evidence attached to those subjects in the class-program output.

### Grade 10
The strongest room evidence exists here:
- `B9/2F/R3`
- `B9/4F/R4`
- `B9/3F/R5`
- `B9/GF/R1`
- and similar `B9/*` anchors

Within those same section columns, the schedule includes:
- `SCIENCE`
- `TLE`
- `APPLIED PHYSICS`
- `RESEARCH 10`
- `SPECIALIZATION 1`
- `SPECIALIZATION 2`

Again, the class-program output does not show those blocks being relocated to distinct specialized rooms.

## 2. The PDFs are section-centric, not facility-centric

The stakeholder outputs are clearly:
- class-program schedules
- section-oriented
- room-anchored at the section level

They are not:
- lab booking sheets
- workshop utilization boards
- facility assignment manifests

So the safest interpretation is:
- the stakeholder school's primary master schedule logic is section-home-room-centric
- specialized facilities may still exist operationally
- but they are not the dominant scheduling contract visible in the final class-program outputs

## 3. Teacher names are partial and flexible on some specialist blocks

The PDFs also show that some specialist blocks do not behave like rigid teacher-assigned master-schedule rows.

Visible examples:
- Grade 9 includes `TEACHER X`
- Grade 9 includes `TEACHER Y`
- Grade 10 includes `TEACHER X`

These occur around `TLE` and flexible specialist coverage patterns.

Interpretation:
- the master schedule should not require complete teacher labeling on every section-facing schedule cell
- teacher attribution can remain partial or unresolved on the master schedule where the school works that way
- individual teacher schedules should still show teacher-specific resolved assignments

## Comparison Against Current ATLAS Room-Demand Model

The current ATLAS live subject contract is much more specialized:

### Active subjects by preferred room type
- `LABORATORY`: `11`
- `CLASSROOM`: `9`
- `GYMNASIUM`: `2`
- `COMPUTER_LAB`: `2`
- `TLE_WORKSHOP`: `4`

### Current regular template distribution
- `CLASSROOM`: `1260` minutes
- `GYMNASIUM`: `240` minutes
- `LABORATORY`: `1200` minutes
- `TLE_WORKSHOP`: `480` minutes
- `COMPUTER_LAB`: `240` minutes

This means the live regular template currently pushes:
- `2160` non-classroom minutes
- out of `3420` total minutes

That is a very strong specialized-room assumption for a stakeholder output that mostly looks classroom/home-room anchored.

## Validation Of The Concern

Yes, the concern is valid.

The remaining `SPECIALIZED_ROOM_UNAVAILABLE` pressure is likely caused at least in part by an over-modeled room-demand contract, not just by campus topology.

The class-program PDFs support moving toward:
- **single home room / classroom as the default scheduling room contract**
- with **explicit exceptions** where the school truly needs them

rather than:
- treating science, TLE, sports, and specialization blocks as specialized-room demand by default

## What Should Change

## 1. Master schedule generation should become classroom-default

For stakeholder-facing master schedule generation, the default assumption should be:
- a section stays in its home room / assigned class room
- unless the school explicitly configures a subject or section to require another room type

## 2. Specialized room demand should become explicit, not assumed

Specialized rooms should remain available for:
- explicit school-configured subject overrides
- room-request workflows
- optional facility utilization views
- future SSE-level richer contracts

But they should not dominate baseline section scheduling unless the school has actually modeled them that way.

## 3. Teacher visibility should differ by surface

### Master schedule / class program
- teacher name can be omitted or optional
- especially for flexible specialist coverage

### Individual teacher schedules
- teacher-specific assignments should still be visible

### Faculty-facing views
- teacher identity should remain resolved internally even if the section-facing export omits it

## Decision

Do **not** combine the earlier:
- `phase3-campus-feasibility-and-room-topology-one-shot-prompt.md`
- `phase3-generation-feasibility-and-term-distribution-one-shot-prompt.md`

as-is.

Reason:
- the first one still assumes the main rooming issue is stakeholder-campus topology
- the new audit shows the stronger next move is to reset the **room-demand contract itself**

The better sequence is:
1. room-demand contract reset + master-schedule teacher visibility prompt
2. then generation-feasibility + term-distribution one-shot

That sequence attacks the likely synthetic room scarcity before trying to fix the deeper generator logic.
