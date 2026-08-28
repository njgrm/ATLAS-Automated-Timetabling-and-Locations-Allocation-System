---
name: atlas-genetic-scheduler
description: Genetic algorithm workflow and guardrails for ATLAS timetable generation. Use when designing or refining schedule generation logic and constraint scoring.
user-invocable: true
---

# ATLAS Genetic Scheduler Skill

Use this skill for schedule generation algorithm design and evaluation.

## Constraint Policy
- Hard constraints define schedule validity and publish blockers.
- Soft constraints influence scoring and warning output only.
- Generate best-effort results even when soft preferences are incomplete.

## Lifecycle Integration
- Generation outputs feed Review phase with violation summaries.
- Publish is blocked until hard-constraint violations are zero.

## Algorithm Procedure
1. Build candidate generation scoped by school and term.
2. Evaluate hard-constraint violations first.
3. Score soft constraints separately.
4. Apply mutation/crossover or neighborhood search.
5. Stop on time budget or convergence threshold.
6. Return schedule plus diagnostics (hard violations, soft warnings, score).

## Performance Target
- Maintain sub-60-second generation per single-school dataset.
