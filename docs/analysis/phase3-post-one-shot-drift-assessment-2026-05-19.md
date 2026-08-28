# Phase 3 Post One-Shot Drift Assessment

Date: 2026-05-19

Primary evidence:
- `docs/verification/evidence-log.md` (`2026-05-18 - Phase 3 Placement Normalization + KPI One-Shot Rerun`)
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- stakeholder artifacts already summarized in:
  - `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
  - `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
  - `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`

## Executive Summary

The latest one-shot pass proves that two previously open concerns are now materially closed:

1. section placement persistence for active special-program demand is repaired and auditable
2. stakeholder-facing subject-label normalization is repaired on the main output surfaces

The Phase 3 `NO-GO` is therefore no longer caused by:
- missing `SPA`/`SPS` placement fields
- raw leakage of internal subject codes into stakeholder-facing schedules

The `NO-GO` is now caused by a deeper generator-feasibility drift that splits into two major clusters:

1. **campus/room topology drift**
2. **generation contract drift**

These should not be attacked with one more generic KPI rerun prompt.
They should be attacked with two stronger one-shot prompts that target those two root-cause clusters directly.

## What The One-Shot Closed

### 1. Placement persistence is closed for current prompt scope
- `specialProgramRows=16`
- `missingPlacement=0`
- live parity remains:
  - `REGULAR=58`
  - `STE=8`
  - `SPA=8`
  - `SPS=8`

This means the old null-placement framing is no longer useful.

### 2. Stakeholder-facing label normalization is closed for current prompt scope
Verified live:
- `SCI_BIO -> SCIENCE`
- `SCI_CHEM -> SCIENCE`
- `SCI_ES -> SCIENCE`
- `TLE_ICT_EXP -> TLE`
- `SPA_SPEC -> SPECIALIZATION`
- `SPS_SPEC -> SPECIALIZATION`
- `STE_APPLIED_CHEM -> APPLIED CHEMISTRY`
- `STE_RESEARCH -> RESEARCH`

This means the next prompts should not spend cycles re-litigating output labels.

## What The One-Shot Did Not Fix

## 1. Generator outcome barely moved

### Run comparison
- `run 54`
  - `assigned=1989`
  - `unassigned=1471`
  - `hard=606`
  - `homeRoom=42.75`
  - `term={1989,0,0}`
- `run 55`
  - `assigned=1990`
  - `unassigned=1470`
  - `hard=606`
  - `homeRoom=38.2`
  - `term={1990,0,0}`

### Interpretation
- the one-shot repaired correctness and output fidelity
- it did not materially improve generator feasibility
- therefore the remaining blockers are not shallow setup drift

## 2. Policy pressure remains very high
- `policyBlockedCount=1245`

Interpretation:
- this is still too large to treat as incidental noise
- current timetable feasibility is still fighting the active policy/window/template contract

## 3. Cohorts exist but are not being consumed meaningfully
- `cohortCount=4`
- `cohortizedClassCount=0`

Interpretation:
- persistence readiness is not enough
- the live generator contract is still not actually producing cohortized scheduling behavior

## 4. Specialized-room scarcity remains dominant
- `SPECIALIZED_ROOM_UNAVAILABLE=864`

Interpretation:
- this is still one of the top hard blockers
- the remaining problem is likely not just "more rooms"
- it is more likely a compound of:
  - generic seeded campus topology
  - stakeholder-inaccurate room ownership assumptions
  - specialized-room typing/availability pressure
  - schedule shape forcing too much specialized demand into the same windows

## 5. Faculty feasibility is still open
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=334`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=785`

Interpretation:
- Teacher X and zero-coverage repair solved only the first layer
- the live faculty contract is still not good enough in:
  - depth
  - placement-aware movement
  - travel feasibility
  - schedule packing

## 6. Tri-sem runtime behavior is still broken
- `term1=1990`
- `term2=0`
- `term3=0`

Interpretation:
- this remains one of the clearest unresolved bugs
- any further KPI rerun without confronting this directly is likely to plateau

## Remaining Drift Clusters

## Cluster A: Campus / Room Topology Drift

This is the gap between:
- stakeholder occupancy artifacts using numbered buildings, mixed-building grade placement, and school-specific room ownership

and:

- ATLAS using a coherent but still generic seeded campus model such as:
  - `G7`, `G8`, `G9`, `G10`
  - `STEX`
  - `SPA`
  - `SPS`

Why it matters:
- it likely inflates specialized-room scarcity
- it likely inflates faculty travel-distance violations
- it likely distorts home-room fidelity against the stakeholder school's real section footprint

This cluster should be attacked first.

## Cluster B: Generation Contract Drift

This is the gap between the stakeholder school's actual scheduling structure and the live internal generation contract.

Key signals:
- template math still overloaded
- `policyBlockedCount=1245`
- `cohortizedClassCount=0`
- `term2=0`, `term3=0`
- `LACKING_FACULTY=68`
- `FACULTY_EXCESSIVE_IDLE_GAP=334`

Why it matters:
- even with better placement and normalized outputs, the generator is still solving against an infeasible contract
- the remaining issues are now algorithm/data-contract level rather than UI or CRUD level

This cluster should be attacked second, after campus/room topology work.

## Recommended Next Prompt Order

1. `phase3-campus-feasibility-and-room-topology-one-shot-prompt.md`
2. `phase3-generation-feasibility-and-term-distribution-one-shot-prompt.md`

Only after those should another broad KPI gate be trusted.

## Final Steering

Do not go backward to:
- more subject-output normalization work
- more null-placement work
- another generic KPI rerun first

Go forward with:
- stakeholder-faithful campus/room topology repair
- then generator contract repair focused on:
  - template math
  - policy-block pressure
  - cohort consumption
  - faculty feasibility
  - tri-sem term distribution
