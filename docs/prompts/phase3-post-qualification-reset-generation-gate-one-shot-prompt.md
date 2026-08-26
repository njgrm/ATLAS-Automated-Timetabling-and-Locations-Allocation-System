# Copilot Execution Prompt: Phase 3 Post-Qualification Reset Generation Gate One-Shot

## Objective

Run the first honest generation gate after the subject-qualification reset lands.

This pass must verify that:
- specialization-based qualification was removed without regressing generation
- department-based qualification plus manual Teaching Load authority still produces sane scheduler behavior
- the remaining blocker mix is identified from the new contract, not from stale assumptions

## Required Context

Read these first:
- `phasePlan.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- the output/evidence from `phase3-subject-qualification-reset-one-shot-prompt.md`

Inspect directly:
- qualification-related server services
- subject and teaching-load pages if touched
- current generation endpoints and latest run summary/violations

## Facts To Treat As Settled

- This gate happens after specialization-based qualification has been removed from the normal workflow.
- Department ownership is now the default qualification baseline.
- Manual Teaching Load placements remain authoritative.
- The point of this pass is not to reopen subject-page UX by itself; it is to measure the scheduler/runtime consequences of the qualification reset.

## Scope

### A. Re-verify the qualification contract live

Before running generation, prove:
- department-owned subject qualification is live
- subject-page specialization-tier workflow is gone
- Teaching Load manual placements are still present and respected

### B. Trigger a fresh generation run

Use the current active school year and current live dataset.

Compare against the most recent credible baseline before this qualification reset.

### C. Reclassify remaining blocker mass

If the run still fails, classify the remaining blockers into the real post-reset clusters, such as:
- no available slot / packing pressure
- faculty depth by department
- room/travel pressure
- policy/shift incompatibility
- stale subject inventory or load assignment artifacts

Do not blame removed specialization mapping unless you have direct proof.

## Explicit Non-Goals

Do not:
- reopen shell/sidebar IA in this prompt
- revert the department-based qualification reset just because KPIs remain imperfect
- fabricate a `GO` if the blocker mass merely changed shape

## Required Verification

You must prove:
1. qualification reset is live at runtime
2. a fresh generation run completed
3. the new blocker mix is reported against the post-reset contract
4. any regression or improvement versus baseline is explicitly quantified

At minimum verify with:
- live Tailnet auth
- live `/subjects` and `/faculty-assignments/summary`
- fresh generation run trigger
- latest run summary
- latest violations

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- If a check is noisy, narrow it silently.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Required Output

Return:
1. before-state runtime summary
2. qualification-reset live verification
3. fresh run id and KPI deltas
4. blocker reclassification
5. verification results
6. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the qualification reset is live
- generation does not materially regress from the pre-reset baseline
- remaining blocker clusters are clearly identified

If not, return `NO-GO` with the exact post-reset blocker cluster.
