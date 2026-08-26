# Copilot Execution Prompt: Phase 3 Post-TLE-Reset Generation Gate One-Shot

## Objective

Run the first honest generator gate after the MATATAG TLE reset lands.

This pass exists to answer:
- what blocker mass remains once stale TLE cohort/split logic is removed
- whether the next dominant issue is timetable geometry, faculty depth, policy fit, or stakeholder baseline parity

## Required Context

Read these first:
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/prompts/phase3-matatag-tle-reset-and-faculty-baseline-one-shot-prompt.md`
- `docs/verification/evidence-log.md`

## Settled Baseline

- Old TLE cohort fallback is not the target anymore.
- The correct TLE contract is section-scoped term rotation.
- EnrollPro and ATLAS section baseline are both `82` real sections with no TLE split metadata.

## Scope

1. Re-verify the post-reset TLE contract is still live.
2. Trigger a fresh generation run.
3. Compare the result against pre-reset run `63`.
4. Classify the remaining blocker mass without slipping back into stale cohort-language.

## Required Metrics

At minimum report:
- `assignedCount`
- `unassignedCount`
- `hardViolationCount`
- `homeRoomSuccessRate`
- `policyBlockedCount`
- `termCounts`
- `LACKING_FACULTY`
- `SPECIALIZED_ROOM_UNAVAILABLE`
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- any residual TLE-specific warning mass

## Classification Rules

If the rerun still fails, classify blockers only using the current live reality, for example:
- timetable-capacity geometry
- policy-window fit
- faculty depth / qualification
- room topology / travel
- stakeholder baseline mismatch

Do **not** use "unresolved TLE cohort fallback" as a blocker class unless you can prove a new cohort requirement was reintroduced intentionally.

## Verification Gates

- live rerun completed
- before/after comparison captured
- direct DB spot-check if the rerun surfaces a contradiction
- evidence appended to `docs/verification/evidence-log.md`

## GO Condition

Return `GO` only if the post-reset rerun materially improves the generator and no longer depends on stale TLE contract warnings.

Otherwise return `NO-GO` with the exact next repair cluster.

