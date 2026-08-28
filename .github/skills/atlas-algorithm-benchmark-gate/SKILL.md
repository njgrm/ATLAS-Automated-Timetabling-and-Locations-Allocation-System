---
name: atlas-algorithm-benchmark-gate
description: Standardizes benchmark protocol, reproducibility requirements, and pass/fail thresholds for scheduler algorithm refactors.
user-invocable: true
---

# ATLAS Algorithm Benchmark Gate Skill

Use this skill for scheduling algorithm changes, especially hybrid greedy + genetic refactors.

## Benchmark Protocol
- Use fixed seed datasets and declared random seeds.
- Run baseline vs candidate across identical conditions.
- Repeat each run count enough for stability comparisons.

## Required Metrics
- Generation success rate.
- Hard-constraint violation count.
- Soft-constraint score trend.
- Runtime per run and percentile summary.

## Pass/Fail Decision
- Candidate must not regress hard-constraint outcomes.
- Candidate must meet defined runtime budget targets.
- Candidate must improve or maintain success/quality thresholds.

## Reproducibility Requirements
- Record dataset version, seed values, and command set.
- Store raw run output summary in docs evidence references.
- Ensure another operator can rerun and compare results.
