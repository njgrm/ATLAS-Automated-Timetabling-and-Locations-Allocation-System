# Copilot Execution Prompt: Phase 3 Objective 1.4 Honesty Gate One-Shot

## Objective

After faculty and public dissemination are in place, perform a strict live honesty gate on Objective `1.4` and the paper's "conflict-free timetable" framing.

This pass is not mainly about shipping UI.
It is a reality check:

- is the generator/publish pipeline now strong enough to support the paper's claim?
- if not, what exactly remains?

## Out of Scope

Do not:

- do broad speculative refactors
- hide generator weaknesses behind copy changes
- spend time on cosmetic-only UI polish

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- latest evidence for:
  - faculty offline publish readiness
  - public published schedule implementation
  - publish dissemination closure
  - published-run integrity reconciliation

Inspect directly:

- generation services
- publish services
- review/publish UI entry points
- published schedule services
- any remaining KPI/readiness docs tied to generator truth

## Facts To Treat As Settled

- faculty published schedule experience should already be in place
- public published schedule experience should already be in place
- publish/dissemination closure should already be in place
- before this gate, the system had a truthful no-published baseline after reconciliation
- this gate must not assume that a valid published run exists unless dissemination closure actually created one

## Required Audit Questions

You must answer, with live evidence:

1. Can ATLAS now honestly claim a publish-ready timetable lifecycle?
2. Can ATLAS now honestly claim conflict-free timetable generation as a factual current behavior?
3. Does a valid published run now exist under the strict current contract?
4. If not, are the remaining blockers:
   - generator quality/readiness
   - staffing/data quality
   - review/publish workflow gaps
   - or some combination?

## Required Output

Produce a strict evidence-backed verdict covering:

- objective `1.4` current status
- whether the paper's conflict-free timetable claim is now supportable
- whether a valid published run now exists
- whether the next stream should be:
  - generator-readiness closure
  - or something else

If the answer is still `NO-GO`, identify the narrowest truthful next major stream.

## Verification Gates

Required:

- live Tailnet evidence
- current DB/runtime truth where needed
- no assumption-only verdicts
- explicit confirmation of whether a valid published run now exists after dissemination closure

## Required Output Format

Return:

1. objective `1.4` verdict
2. publish/generation honesty verdict
3. explicit published-run reality check
4. concrete remaining blockers
5. recommended next major stream
6. `GO` or `NO-GO` for the paper's strong timetable-generation claim

## GO Condition

Return `GO` only if live evidence really supports all of the following:

- ATLAS can produce or already has a valid published run under the current strict contract
- faculty and public dissemination surfaces are reading that valid published truth
- the generator/publish pipeline can now honestly be described as conflict-free and publish-ready

If dissemination closure still ends with no valid published run, this gate must default to `NO-GO` and explain the narrowest truthful next stream.
