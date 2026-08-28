# Phase 3 Post-Run64 Drift Assessment

Date: 2026-05-19

Primary evidence:
- `docs/verification/evidence-log.md`
  - `2026-05-19 - Phase 3 Generation Feasibility + Term Distribution One-Shot (Tailnet + DB)`
- stakeholder references:
  - `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
  - `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`

## Executive Summary

Run `64` changes the next-step diagnosis materially.

What is now improved:
- term distribution is no longer collapsed:
  - `term={2187,39,44}`
- cohortization is no longer zero:
  - `cohortizedClassCount=8`
- specialized-room scarcity is no longer dominant:
  - `SPECIALIZED_ROOM_UNAVAILABLE=127`

What is still blocking closure:
- `hardViolationCount=1079`
- `UNASSIGNED_SECTION` remains high
- `policyBlockedCount=1466`
- `FACULTY_EXCESSIVE_IDLE_GAP=363`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=842`
- `8` remaining unassigned cohort rows with:
  - `NO_AVAILABLE_SLOT`
  - room reason `FALLBACK_UNRESOLVED`

So the next prompt should focus on:
1. cohort fallback completion
2. packing / slot-fit contraction
3. faculty travel / idle contraction
4. rerun gate against `run 64`

not on:
- raw specialized-room scarcity
- placement persistence
- subject-label normalization
- generic term-collapse debugging

## Stakeholder Direction To Preserve

The stakeholder files still support:
- section-home-room/classroom-default scheduling
- full-day baseline shape with protected blocks
- partial teacher attribution on section-facing master schedules

They do not suggest that the next fix should reintroduce broad specialized-room dependence.

## Remaining Root-Cause Clusters After Run 64

### 1. Cohort fallback is still incomplete
- `cohortizedClassCount=8` proves cohortization now exists
- `8` remaining unassigned cohort rows with `NO_AVAILABLE_SLOT` and `FALLBACK_UNRESOLVED` prove the fallback contract is still incomplete

### 2. Policy / packing pressure is still too high
- `policyBlockedCount=1466`

This is too large to treat as incidental.

### 3. Faculty feasibility is still structurally weak
- `FACULTY_EXCESSIVE_IDLE_GAP=363`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE=842`

This points to movement and daily spread pressure, not just raw coverage count.

### 4. Hard unresolved count is still too high
- `hardViolationCount=1079`

Even after room-demand reset and term-distribution repair, the generator is still far from closure-grade feasibility.

## Best Next Prompt Shape

The next prompt should merge:
1. cohort slot fallback repair
2. policy/packing contraction
3. travel/idle-aware feasibility tightening
4. fresh KPI rerun gate

That is the highest-signal way to save requests while staying aligned with the evidence.
