# Copilot Execution Prompt: Phase 2 Home-Room KPI Recovery

Run this after:
- `docs/prompts/phase2-trisem-contract-reset-prompt.md`

This prompt exists because the previous recovery pass tightened some fallback behavior but left the core KPI failing at `39.68%`. Treat this as an algorithm and validation recovery pass aimed at Phase 2's main operational gate.

## Goal
Raise home-room retention toward the documented acceptance band and prove the fallback model protects specialized/shared facilities without starving regular sections or hiding the problem in evidence.

## Out of Scope
- Reopening already-completed shared-facility schema wiring unless required for a bug fix
- Reopening shift-window editor/model work unless it directly affects KPI recovery
- Broad timetable feature work outside room assignment behavior and validation

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/phases/phase-2-home-room-algorithm-2026-05-16.md`
- `docs/phases/phase-2-validation-behavior-guide.md`
- `docs/phases/PHASE-2-KICKOFF-SUMMARY.md`
- `docs/verification/evidence-log.md`
- `qa-artifacts/home-room-load-preferences-validation-2026-05-16.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/scripts/validate-run-preferences.ts`

## Mandatory First Step
Before editing:
1. State the current KPI baseline from evidence.
2. Explain the most likely causes of the low home-room retention from the current code.
3. Name the smallest set of code paths you intend to change.

Then implement.

## What Must Be Fixed

### A. Fallback discipline
- Regular demand must prefer:
  1. home room
  2. same-zone standard classroom
  3. broader standard-room-compatible fallback
- Specialized/shared facilities must not become casual fallback for regular demand.
- Preserve specialized availability for specialized demand.

### B. KPI visibility
- Validation must explicitly report home-room KPI outcomes in a closure-friendly way.
- Do not hide failure behind generic "pass" language.

### C. Root-cause diagnostics
- Improve diagnostics enough to show why sections leave home room:
  - occupied home room
  - no same-zone standard room
  - only specialized rooms available
  - policy or shift-window incompatibility if relevant

## Hard Rules
- Do not mark success if `homeRoomSuccessRate` remains below the accepted target unless the response is explicitly `NO-GO`.
- Do not update evidence with broad completion language if the KPI still fails.
- Do not fix the metric by allowing regular classes to occupy specialized/shared-facility rooms.

## Verification Gates
- affected server tests
- `npm run test:phase2-home-room-strategy`
- any added regression tests for fallback ordering and diagnostics
- one live or live-equivalent generation run with explicit KPI reporting

## Evidence Update
If this prompt succeeds, append a narrow evidence entry that includes:
- prior KPI baseline
- post-change KPI result
- whether the target band was met
- exact fallback rules now enforced
- exact remaining blockers, if target was still missed

Do not claim Phase 2 closure in this prompt unless every listed gate is actually proven.

## GO / NO-GO
Return `GO` only if:
- fallback ordering is materially tightened,
- regular demand no longer uses specialized/shared rooms as routine fallback,
- validation explicitly reports KPI status,
- the measured KPI meets the documented target or the stakeholder explicitly waived it.

Return `NO-GO` if the KPI still misses target or if evidence is incomplete.
