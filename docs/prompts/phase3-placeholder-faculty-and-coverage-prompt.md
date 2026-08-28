# Copilot Execution Prompt: Phase 3 Teacher X + Subject Coverage Repair

Run this after:
- `docs/prompts/phase3-policy-cohort-room-readiness-prompt.md`

## Goal
Add Teacher X placeholder capability and repair active subject coverage gaps so the generator is no longer running with active demand that has no plausible faculty ownership path.

This prompt should not assume placeholders are the whole KPI fix. It should solve the faculty-coverage portion cleanly after the template math and control state are repaired.
This prompt should also avoid deepening the source-of-truth boundary mistake where Teacher X is treated like a real upstream faculty mirror row.

## Scope

In scope:
- Teacher X placeholder workflows
- placeholder data lifecycle
- subject-to-faculty coverage remediation for active subjects
- assignment-path readiness for active STE/TLE/SPS rows
- live Tailnet verification of placeholder and coverage behavior
- preserving EnrollPro as the source of truth for real faculty while ATLAS owns scheduling-only placeholder overlays

Out of scope:
- final KPI closure claim
- broad room/policy math repair already handled earlier in Phase 3

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/verification/evidence-log.md`
- `prisma/schema.prisma`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/assignment-seed.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- any faculty assignment UI surfaces touched by this work

## Live Facts To Treat As Fact
- placeholder faculty rows currently live: `0`
- active subjects with zero faculty assignments currently include:
  - `STE_ENV_SCI`
  - `STE_BIOTECH`
  - `STE_ICT`
  - `STE_APPLIED_CHEM`
  - `STE_APPLIED_PHYS`
  - `STE_ROBOTICS`
  - `TLE_ICT_EXP`
  - `TLE_AFA_EXP`
  - `TLE_FCS_EXP`
  - `TLE_IA_EXP`
  - `SPS_SPEC`
- only `2` active schedulable faculty currently have zero assignments, so simple reassignment alone is unlikely to cover all active demand

## Mandatory Behavior
- audit current placeholder readiness and active-subject coverage first
- audit whether placeholder persistence is wrongly coupled to upstream faculty mirror semantics
- implement the minimum coherent Teacher X workflow needed for generator support
- repair active subject coverage gaps in a way that is visible and controllable
- verify locally
- verify live on Tailnet

## Control Adjustment Allowance
You are explicitly allowed to add or adjust admin controls for:
- creating placeholder faculty
- assigning placeholder coverage
- managing placeholder activation state

Do not hide the behavior behind seed-only automation if an operator needs to steer it.

## Required Direction

### A. Make Teacher X real
- placeholders must be creatable, distinguishable, and schedulable
- lifecycle rules must be explicit enough for QA and generation reruns
- placeholders must not be treated as canonical upstream faculty truth
- prefer a dedicated ATLAS-owned overlay or an explicit sync-exempt model over a plain upstream-mirror-style record

### B. Repair active-subject coverage
- active subjects should not remain uncovered without an explicit reason
- if a subject is active and in a live template, it needs either:
  - real faculty coverage
  - placeholder coverage
  - or an explicit deactivation / scope correction backed by evidence

### C. Keep coverage logic auditable
- coverage fixes must be visible in data, not hidden in heuristics
- report exactly which active subjects were covered by real faculty vs placeholders

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. verify placeholder faculty can exist in the real dataset
2. verify active zero-coverage subjects are resolved or intentionally deactivated
3. verify assignment state is reflected in the relevant UI/API surfaces
4. verify the generator can consume the repaired coverage state

## Verification Gates
- touched build/typecheck
- diagnostics on touched files
- explicit before/after coverage summary for active subjects
- live Tailnet verification of placeholder and assignment behavior

## Evidence Update
Append evidence that records:
- exact active zero-coverage subjects before the pass
- exact placeholder or coverage repairs made
- exact files changed
- exact commands run
- exact live checks performed
- final `GO` or `NO-GO`

## GO / NO-GO
Return `GO` only if active subject coverage is no longer silently broken and Teacher X placeholder support is proven usable for the real dataset without further confusing EnrollPro as the owner of placeholder faculty.

Return `NO-GO` if placeholder support is still theoretical or if active live-template subjects remain uncovered without explicit resolution.
