# Copilot Execution Prompt: Phase 3 Final Feasibility Contraction + Gate One-Shot

## Goal
Run the broadest remaining strong-model pass after the faculty-feasibility repair, focused on contracting the final blocker set toward closure-grade readiness.

This prompt should be used only after:
- `phase3-faculty-qualification-and-coverage-depth-one-shot-prompt.md`

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-post-run64-drift-assessment-2026-05-19.md`
- `docs/analysis/phase3-post-run68-faculty-feasibility-assessment-2026-05-19.md`
- all recently touched generation, assignment, and constructor services

## Goal State
Contract the remaining blocker mass enough that a final Phase 3 closure gate becomes realistic.

## Scope
In scope:
- final contraction of:
  - `UNASSIGNED_SECTION`
  - `hardViolationCount`
  - `policyBlockedCount`
  - travel/idle pressure
  - remaining cohort fallback pressure
- fresh rerun and strict `GO/NO-GO`

Out of scope:
- already-closed placement/label concerns
- speculative redesign that should be deferred to later phases

## Mandatory Behavior
1. Use the latest post-faculty-feasibility run as the working baseline.
2. Identify the smallest remaining high-leverage contraction opportunities.
3. Implement only the coherent final repair set.
4. Re-run generation.
5. Return an honest `GO` or `NO-GO`.

## Required Direction
- Do not reopen already-closed prompt scopes without hard evidence.
- Prefer contraction of the blocker mass over isolated cosmetic wins.
- If closure is still not earned, return a clean final blocker inventory instead of forcing success.

## Verification Requirements
You must verify:
- touched builds/tests
- fresh generation rerun
- exact delta versus the immediate prior baseline
- exact remaining blocker inventory if `NO-GO`

## GO Criteria
Return `GO` only if the remaining blocker set contracts materially enough to justify a true Phase 3 closure-gate attempt.

Return `NO-GO` if the blocker mass remains too high or too diffuse.
