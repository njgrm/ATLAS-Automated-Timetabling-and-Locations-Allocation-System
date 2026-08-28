# Copilot Execution Prompt: Phase 3 Teaching-Load Policy Alignment Repair

## Goal
Make the teaching-load page and summary API truthful enough for Phase 3 operator decisions.

Current live state is not good enough:
- `54` faculty rows are overloaded by current `loadPercentage`
- summary math uses section-based load minutes plus adviser hours
- ancillary minutes are not included in the summary formula
- exploratory TLE placeholders appear structurally inflated because one placeholder assignment spans many sections

This prompt is about making the load signal coherent and policy-aligned, not about making every faculty row green.

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- any policy/load helper involved in faculty workload computation

## Known Facts To Treat As Fact
- The live summary service computes `loadPercentage` from:
  - section-based subject minutes
  - plus `advisoryEquivalentHours`
- The live summary service does not include `ancillaryMinutesPerWeek`.
- Placeholder exploratory TLE rows can show huge section-based load because one placeholder owns many sections.
- The page is useful for triage, but it is not yet a closure-grade workload signal.
- The Grade 10 workbook is a monitoring sheet, not the literal target output of ATLAS.
- The workbook should be used only as secondary operational evidence for how the school interprets load and day-shape pressure, not as a direct load-formula contract.

## Scope
In scope:
- teaching-load summary formula
- placeholder presentation/handling in teaching-load summary
- ancillary load inclusion
- explicit operator-facing meaning of the load signal
- any wording or field split needed so operators can distinguish real teacher load from synthetic coverage load
- live Tailnet verification of the corrected summary behavior

Out of scope:
- generator algorithm changes
- section sync/parity repair
- specialization alias cleanup
- broad faculty assignment redistribution

## Required Decisions
You must make the formula explicit in code and evidence.

At minimum, resolve:
1. what the canonical operator load formula is for this page
2. whether ancillary minutes count toward displayed policy load
3. how placeholder faculty should be displayed so coverage repair does not distort operator decisions

If the current page should show more than one load metric, implement that rather than forcing one misleading metric.

## Required Behavior
1. Audit the current page and API summary behavior.
2. Identify all formula mismatches against the faculty policy data model.
3. Implement the minimum coherent repair.
4. If safe and useful, distinguish:
   - actual teaching load
   - credited/policy load
   - placeholder/synthetic coverage load
5. Re-run local verification.
6. Re-run Tailnet verification.
7. If the first fix still leaves a misleading operator signal, self-correct once in the same pass.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate intermediate retries.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - GO/NO-GO
- Limit this pass to at most 2 repair iterations.

## Verification Requirements
You must verify:
- touched server build/typecheck passes
- touched client typecheck/build passes if you change frontend code
- Tailnet `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55` reflects the repaired formula/fields
- direct DB spot-check matches the intended policy inputs:
  - `maxHoursPerWeek`
  - `advisoryEquivalentHours`
  - `ancillaryMinutesPerWeek`
  - placeholder flag

## GO Criteria
Return `GO` only if:
- the summary formula is explicit and no longer silently ignores relevant policy inputs
- placeholder rows are no longer misleading as normal operator workload signals
- Tailnet summary output matches the repaired contract

If the page still presents a misleading or internally inconsistent load signal, return `NO-GO`.
