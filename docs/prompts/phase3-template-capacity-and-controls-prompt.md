# Copilot Execution Prompt: Phase 3 Template Capacity + Control Math Repair

Run this first in Phase 3.

## Goal
Repair the timetable math so active class templates, subject-minute totals, and scheduler control surfaces describe a schedule that is actually feasible before any KPI rerun or Teacher X expansion is attempted.

This pass must treat control adjustment as in scope. If the only way to make the real dataset schedulable is to change template or control values, do it deliberately and log it.

## Scope

In scope:
- template weekly capacity math
- subject minute totals bound to templates
- control adjustments required to make template demand physically schedulable
- persisted config or seed defaults needed to keep the repaired math stable
- live Tailnet verification of the repaired template/control state

Out of scope:
- broad Teacher X workflow UI
- full KPI closure claim
- unrelated publish or review-console polish

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/prompts/phase3-generator-readiness-sequence.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`

## Live Facts To Treat As Fact
- `REGULAR` template weekly capacity: `2400`; bound minutes: `3420`
- `STE` template weekly capacity: `2250`; bound minutes: `2580`
- `SPA` template weekly capacity: `2250`; bound minutes: `2265`
- `SPS` template weekly capacity: `2250`; bound minutes: `2220`
- current generation failure includes heavy `policyOrShiftWindowIncompatible` pressure

## Mandatory Behavior
- audit the current minute math first
- identify exactly which subject/template/control combinations overflow weekly capacity
- repair the math using the minimum coherent change set
- re-verify locally
- re-verify live on Tailnet
- if the first repair still leaves impossible template math, iterate once more

## Control Adjustment Allowance
You are explicitly allowed to adjust:
- `ClassTemplate.periodsPerDay`
- `ClassTemplate.periodLengthMinutes`
- `Subject.minMinutesPerWeek`
- template subject bundles
- default persisted control values if they are part of the math contract

Do not keep impossible subject-minute totals just because they existed first.

## Required Direction

### A. Audit template feasibility
- compute weekly capacity for each active template
- compute total bound subject minutes for each active template
- list every overflow explicitly

### B. Repair overloaded templates coherently
- make `REGULAR`, `STE`, `SPA`, and `SPS` mathematically schedulable
- do not leave hidden over-capacity debt in active templates
- ensure the chosen fix still aligns with the workbook-derived structure and current stakeholder direction

### C. Keep controls user-adjustable where needed
- if feasibility depends on values officers may need to tune, route them through the existing control surfaces rather than hardcoding opaque behavior
- preserve or improve admin editability for the resulting controls

### D. Preserve runtime alignment
- templates, subject minutes, and generator expectations must agree after the repair
- do not fix the math in one layer while leaving stale values in another

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. `GET /api/v1/class-templates?schoolId=1`
2. `GET /api/v1/subjects?schoolId=1`
3. verify the policy/template controls reflect the repaired math where applicable
4. trigger or inspect a fresh generation run only after the repaired math is in place

## Verification Gates
- touched build/typecheck
- diagnostics on touched files
- explicit before/after capacity calculation for every active template
- live Tailnet verification of updated templates/subjects/controls

## Evidence Update
Append evidence that records:
- before/after capacity math
- exact controls adjusted
- exact files changed
- exact commands run
- exact live checks performed
- final `GO` or `NO-GO`

## GO / NO-GO
Return `GO` only if every active template is mathematically schedulable after the repair.

Return `NO-GO` if any active template still exceeds weekly capacity or if the repaired math exists only locally and is not verified live.
