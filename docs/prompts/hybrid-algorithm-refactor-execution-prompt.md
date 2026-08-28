# Copilot Execution Prompt: Hybrid Scheduling Algorithm Refactor (Greedy Multi-Seed + GA + Repair)

## Goal
Execute the formal hybrid algorithm refactor already planned in ATLAS:
- deterministic greedy multi-seed constructor,
- GA optimization stage,
- repair operators for hard-constraint recovery,
- benchmark-driven acceptance.

This prompt operationalizes `docs/phases/algorithm-hybrid-refactor-plan.md`.

---

## Required Files to Read First
- `docs/phases/algorithm-hybrid-refactor-plan.md`
- `phasePlan.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/*policy*`
- `atlas-server/src/services/*manual-edit*` (for downstream compatibility)
- `atlas-server/src/__tests__/` (generation/review/constraint suites)

---

## Implementation Batches (must follow)

1. **H-ALG-1 Constructor/Population Seeding**
   - Add greedy multi-seed baseline constructor profiles.
   - Keep deterministic behavior by explicit seed control.

2. **H-ALG-2 Fitness + Policy Weighting**
   - Centralize fitness scoring.
   - Hard violations must dominate (infeasible penalty).
   - Soft constraints weighted from policy configuration.

3. **H-ALG-3 Repair Operators**
   - Add bounded repair passes for common hard conflicts:
     - teacher overlap,
     - room collision,
     - section overlap,
     - policy hard windows.

4. **H-ALG-4 Benchmark Harness + Gates**
   - Baseline vs hybrid comparison:
     - completion rate
     - hard violations
     - soft score quality
     - runtime p50/p95/max
   - Keep runtime envelope aligned to sub-60s objective constraints.

5. **H-ALG-5 Diagnostics for Review**
   - Persist and expose:
     - seed quality summary
     - repair impact summary
     - unresolved bottlenecks

---

## Required Test/Benchmark Outputs
- Determinism tests for seed profiles.
- Fitness scoring correctness tests.
- Repair operator correctness tests.
- Integration tests with dense fixture datasets.
- Benchmark report artifact with baseline vs hybrid deltas.

---

## Evidence Requirements
- Update `docs/verification/evidence-log.md`:
  - benchmark dataset identifiers
  - command list
  - metric tables
  - pass/fail judgement

---

## GO/NO-GO
- NO-GO if hard-constraint outcomes regress.
- NO-GO if runtime envelope significantly regresses without approved waiver.
- NO-GO if benchmark reproducibility is missing.
- GO only if hybrid shows measurable quality/reliability gains with acceptable runtime.

