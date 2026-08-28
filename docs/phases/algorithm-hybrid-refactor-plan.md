# Hybrid Algorithm Refactor Plan (Greedy Constructor + Genetic Optimizer)

## Purpose
This plan formalizes a hybrid scheduling approach for ATLAS:
- deterministic greedy construction for fast baseline schedules,
- genetic algorithm optimization for global conflict resolution and soft-priority balancing,
- targeted repair operators for hard-constraint recovery.

The goal is to improve schedule completion reliability and optimization quality without sacrificing runtime targets.

## Why This Helps Objectives

### Objective 1.1 — Web-based admin portal with scheduling workflow
- Fewer infeasible drafts reach the scheduler review workspace.
- Better initial schedule quality reduces manual correction burden.

### Objective 1.2 — Configurable scheduling priority management
- GA fitness can directly encode weighted policy priorities.
- Hybrid seeds give GA better starting points, improving policy adherence under tight constraints.

### Objective 1.3 — Mobile faculty auth + preference submission
- Faculty preferences have higher chance of meaningful incorporation when generation avoids dead-end drafts.
- Request/review loop quality improves because baseline assignments are more coherent.

### Objective 1.4 — Automated timetable generation system
- Higher completion rates and fewer hard violations in dense bottlenecks.
- Better chance of meeting sub-60-second generation target through faster feasible seed creation.

## Current ATLAS Flow Integration

Current generation flow already has:
- generation run lifecycle and persistence,
- deterministic baseline constructor,
- hard-constraint validator and policy service,
- review workspace consuming draft output.

This plan integrates with existing flow by replacing "single constructor -> validator" with:
1. Multi-seed greedy constructor stage
2. GA optimization stage
3. Repair/validation stage
4. Persist and expose best candidate to review UI

## Target Architecture

### Stage A: Greedy Deterministic Multi-Seed Constructor
- Build N diverse baseline schedules quickly.
- Use deterministic heuristics with controlled variation buckets (seed profiles).
- Prioritize hardest-to-place classes first (scarce room/time/faculty constraints).

Output:
- Initial population with broad feasible coverage.

### Stage B: Genetic Optimization Core
- Use crossover + mutation on baseline population.
- Fitness function:
  - hard violations: dominant penalty (effectively infeasible),
  - soft constraints: weighted by policy configuration,
  - optional tie-breakers: compactness/travel/load smoothness.

Output:
- Candidate schedules converging toward feasible + policy-optimized state.

### Stage C: Repair Operators
- Post-mutation/crossover repair for common hard failures:
  - teacher double-booking,
  - room occupancy collision,
  - section overlap,
  - policy hard-block windows.
- Apply bounded iterative repair before candidate discard.

Output:
- Recoverable candidates preserved instead of prematurely dropped.

### Stage D: Selection + Validation + Persistence
- Select best candidate by fitness then strict hard validation.
- Persist run summary, violations, and draft entries as current active draft output.
- Expose clear diagnostics to review workspace and logs.

## Implementation Plan

### Batch H-ALG-1: Constructor and Population Seeding
- Add multi-seed greedy constructor service.
- Introduce seed profiles (constraint order / tie-breaker strategy variants).
- Add baseline diversity metrics.

### Batch H-ALG-2: GA Fitness and Policy Weighting Hardening
- Centralize fitness computation in service layer.
- Align soft weights with scheduling policy model.
- Add strict hard-penalty and feasibility scoring semantics.

### Batch H-ALG-3: Repair Operator Library
- Implement deterministic repair passes for high-frequency hard conflicts.
- Add capped retry strategy to avoid runtime explosion.

### Batch H-ALG-4: Runtime and Quality Benchmarking
- Compare current engine vs hybrid on:
  - completion rate,
  - hard-violation count,
  - soft-score quality,
  - runtime distribution (p50/p95/max).
- Enforce generation target guardrails.

### Batch H-ALG-5: Review UX Diagnostic Alignment
- Expose hybrid-specific diagnostics in review flow:
  - seed quality summary,
  - repair impact summary,
  - unresolved bottleneck classes.

## Verification Gates

### Automated
- Unit tests:
  - greedy seed determinism and diversity behavior,
  - fitness weighting correctness,
  - repair operator correctness.
- Integration tests:
  - generation run success on dense fixture sets,
  - strict hard-violation publish-block compatibility.
- Performance tests:
  - maintain sub-60-second target under defined dataset profile.

### Manual/Operational
- Scheduler review sanity:
  - fewer unassigned/problem clusters than prior baseline.
- Policy sensitivity check:
  - changing policy weights affects outcome ranking as expected.

## Exit Criteria
- Hybrid engine consistently outperforms current baseline on completion and hard-violation reduction.
- Soft-priority compliance improves measurably under policy weighting.
- Runtime remains within accepted generation target envelope.
- Review workspace receives stable, interpretable diagnostics.

## Scope Guardrails
- Keep this refactor in generation/services domain.
- Do not mix with unrelated UI redesign work in same batch.
- Preserve existing API contracts unless change is explicitly approved and versioned.
