---
name: atlas-phase-gate-enforcer
description: Prevents completion claims without phase-required tests, manual checks, and evidence updates aligned to phase gates.
user-invocable: true
---

# ATLAS Phase Gate Enforcer Skill

Use this skill before declaring work complete in any phase.

## Required Inputs
- `phasePlan.md` active phase and scope.
- `docs/verification/phase-gates.md` criteria.
- `docs/verification/evidence-log.md` latest entries.

## Completion Gate Rules
- No "done" claim without required automated checks.
- No "done" claim without required manual QA evidence where applicable.
- No "done" claim without evidence-log update for this pass.

## Output Contract
- Gate checklist with explicit pass/fail per criterion.
- Remaining blockers and owner next steps.
- Final decision: `GO`, `CONDITIONAL GO`, or `NO-GO`.

## Scope Protection
- Flag cross-phase work unless explicitly approved.
- Record any approved exceptions in phase notes.
