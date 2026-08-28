# Phase 3 Post-Run68 Faculty Feasibility Assessment

Date: 2026-05-19

Primary evidence:
- `docs/verification/evidence-log.md`
  - `2026-05-19 - Phase 3 Cohort Fallback + Packing + KPI One-Shot (Tailnet + DB)`
  - `2026-05-19 - Phase 3 Generation Feasibility + Term Distribution One-Shot (Tailnet + DB)`
- stakeholder references:
  - `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
  - `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`

## Executive Summary

Yes, something should happen before another broad generator prompt.

The new evidence shows that faculty feasibility is no longer just one minor signal inside the larger blocker set.
It is now one of the clearest remaining unresolved clusters.

## Why This Is Now a Separate Blocker

### 1. `LACKING_FACULTY` did not improve
- `run 64`: `LACKING_FACULTY=68`
- `run 68`: `LACKING_FACULTY=68`

There is zero movement here.

### 2. `NO_QUALIFIED_FACULTY` is a larger mass than the unresolved cohort rows
Run-64 unassigned reason mix explicitly showed:
- `NO_AVAILABLE_SLOT=818`
- `NO_QUALIFIED_FACULTY=388`

That means qualification depth is not a side-note.
It is one of the largest remaining hard-fit blockers.

### 3. Stakeholder files support flexible teacher attribution, not missing teacher reality
The class-program PDFs show:
- `TEACHER X`
- `TEACHER Y`
- partial specialist attribution on some Grade 9-10 TLE and specialization blocks

This supports:
- flexible or placeholder teacher labeling on the master schedule

It does **not** support:
- ATLAS leaving large parts of the demand without feasible qualified teacher coverage internally

So the next fix should not be "hide teacher shortage in the output."
It should be:
- improve real qualification and assignment feasibility while keeping the lighter section-facing display contract

### 4. Travel/idle pressure is tied to faculty feasibility too
- `FACULTY_EXCESSIVE_IDLE_GAP=368`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=723`

This indicates the remaining issue is not just raw count.
It is also:
- who is qualified for what
- how thin the candidate pool is
- how far those candidates must move
- how fragmented their day becomes

## Decision

Before another broad closure-style prompt, add one dedicated strong-model prompt for:
- qualification coverage depth
- candidate-pool broadening where justified
- placeholder overlay rules for unresolved specialist demand
- travel/idle-aware assignment feasibility

Then return to the broader post-run68 contraction/gate prompt.

## Recommended Next Order

1. `phase3-faculty-qualification-and-coverage-depth-one-shot-prompt.md`
2. `phase3-final-feasibility-contraction-and-gate-one-shot-prompt.md`

This will waste fewer requests than jumping straight into another global rerun without addressing the stuck faculty block first.
