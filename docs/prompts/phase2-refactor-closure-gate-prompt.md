# Copilot Gate-Closure Prompt: Phase 2 Refactor Closure

Run this last, after:
- `docs/prompts/phase2-trisem-contract-reset-prompt.md`
- `docs/prompts/phase2-home-room-kpi-recovery-prompt.md`

This is a strict closure gate. It is not an implementation prompt unless targeted patching is required to resolve a found blocker.

## Goal
Decide whether Phase 2 refactor recovery is actually closeable based on repo evidence, runtime behavior, and the remaining acceptance criteria.

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/phases/phase-2-home-room-algorithm-2026-05-16.md`
- `docs/phases/phase-2-validation-behavior-guide.md`
- `docs/phases/PHASE-2-KICKOFF-SUMMARY.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `qa-artifacts/home-room-load-preferences-validation-2026-05-16.md`
- all files touched by the two prior prompts

## What To Validate

### A. Tri-sem closure
- No active scheduling surface or active runtime contract still behaves like a quarter-era system where tri-sem semantics are required.

### B. Home-room closure
- KPI result is explicitly stated and judged against the target.
- Regular demand fallback behavior protects specialized/shared facilities.

### C. Shared-facility closure
- `Room.isSharedFacility` exists in schema and seed/runtime flow.
- Validation coverage for shared-facility protection exists.

### D. Shift-window closure
- Grade + Program support exists where intended.
- policy earliest/latest bounds reject contradictory shift-window configurations.
- evidence proves the behavior instead of merely claiming it.

### E. Evidence quality
- `docs/verification/evidence-log.md` must reflect exact commands, exact outcomes, and open blockers honestly.
- If the evidence overclaims completion, patch the wording before final decision.

## Mandatory Review-First Behavior
Before making any edits:
1. List findings first, ordered by severity, with file references.
2. If no blockers remain, say so explicitly.
3. Only then apply targeted patching if needed.

This prompt should behave like a code review plus closure gate, not a generic summary.

## Required Verification
- exact commands used to validate the prior prompt outputs
- grep/search proof for remaining quarter-era drift
- relevant build/type/test checks
- evidence-log consistency check
- live or live-equivalent run result referenced by run ID when available

## Tailnet QA
Validate on:
- `https://njgrm.buru-degree.ts.net`

Credentials:
- Admin: `1000001` / `AdminSY2026!`

Manual checks must include:
1. scheduling UI term labeling
2. policy panel shift-window overrides
3. KPI visibility in timetable/review surfaces
4. room-assignment and shift-window diagnostics visibility

## Hard NO-GO Conditions
- quarter-era active scheduling contract still present
- `homeRoomSuccessRate` still below target without explicit stakeholder waiver
- evidence log claims completion without proving it
- shared-facility or shift-window behavior still only partially implemented or partially evidenced

## Output Required
1. Findings first, with severity and file references
2. What was patched during this gate, if anything
3. Verification commands and outcomes
4. Evidence-log update confirmation
5. Final decision: `GO`, `CONDITIONAL GO`, or `NO-GO`

`CONDITIONAL GO` is allowed only if the code is complete but a non-code evidence artifact is still pending.
