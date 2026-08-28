# Copilot Execution Prompt: Phase 2 Timetable Shape Refactor

Run this first.

This prompt replaces the old assumption that shift windows alone can solve the current generation blockers.

## Goal
Refactor ATLAS so timetable shape is a first-class scheduling contract instead of an accidental side effect of one global policy grid.

The system must support per-grade/per-program timetable shape that governs:
- visible start time
- visible end time
- period length
- periods per day
- lunch behavior
- special-event rows

## Scope

In scope:
- generator timetable-grid construction
- demand computation inputs that currently ignore program/day shape
- timetable display surfaces that must reflect the same shape contract used by generation
- policy and shift-window interaction points only where needed to support the new shape model

Out of scope:
- final KPI closure claim
- broad faculty-assignment refactors
- publish-phase work
- subject-bundle cleanup beyond what is strictly required to keep the refactor coherent

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/verification/evidence-log.md`
- `prisma/schema.prisma`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/manual-edit.service.ts`
- `atlas-server/src/services/room-schedule.service.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/timetable/*`
- `atlas-client/src/hooks/useTimetableData.ts`

## Workbook Assumption
Use the Grade 8 workbook as a representative structural sample for other grades unless current stakeholder instructions or live school data explicitly contradict it.

That means you may generalize these structural patterns:
- regular sections follow a full-day core timetable shape
- special programs inherit regular core demand and add specialized demand
- special programs may require a longer or differentiated day shape than regular sections

Do not assume the quarter-era science split is the future-state requirement just because it appears in the workbook.

## Mandatory First Step
Before editing:
1. Audit every place where timetable shape is currently inferred from:
   - global policy earliest/latest bounds
   - hardcoded `STANDARD_PERIOD_MINUTES`
   - grade windows
   - class template period length
2. List the findings grouped as:
   - generator shape
   - demand shape
   - review/display shape
   - policy/shift interaction
3. Then implement the refactor.

Do not skip the audit.

## Required Direction

### A. Introduce an explicit timetable-shape model
Create or formalize a contract that can represent, per grade/program:
- schedule start
- schedule end
- class period length
- periods per day
- lunch behavior
- special event rows

### B. Make generation use the same shape model
The constructor must stop relying on one global hardcoded period grid.

The scheduler must be able to:
- build valid periods for a specific grade/program shape
- enforce those periods consistently in assignment
- report incompatibility against the correct shape

### C. Make display use the same shape model
The timetable/review surfaces must derive their visible grid from the same contract the generator uses.

### D. Preserve policy as global guardrail, not full shape definition
Policy bounds may remain global constraints, but they must not remain the sole source of the timetable grid.

## Hard Rules
- Do not leave `STANDARD_PERIOD_MINUTES` as the controlling truth for all programs.
- Do not leave grade windows as mere post-hoc slot filters.
- Do not mark this prompt complete unless generator and visible timetable surfaces are both aligned to the new shape model.

## Verification Gates
- affected server typecheck/build
- affected client typecheck/build
- generator regression checks
- targeted checks proving different grade/program shapes can produce different valid grids
- evidence that timetable display and generation use the same shape contract

## Evidence Update
Append a narrow evidence entry describing:
- the new shape contract
- files changed
- verification commands
- remaining blockers if subject bundles or UI workflows still need follow-up

Do not claim overall Phase 2 closure here.

## GO / NO-GO
Return `GO` only if:
- timetable shape is explicit and not implied by one global 50-minute grid,
- generation and display derive from the same shape model,
- grade/program windows no longer act as the only structural control.

Return `NO-GO` if timetable shape remains split across incompatible rules.
