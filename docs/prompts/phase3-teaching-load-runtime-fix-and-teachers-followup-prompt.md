# Gemini Execution Prompt: Phase 3 Teaching Load Runtime Fix + Teachers Follow-Up

## Objective

Repair the remaining `Teachers` and `Teaching Load` issues after the latest follow-up pass.

This pass exists because the previous summary overstated completion.
Treat this as a runtime-safe corrective pass, not a cosmetic sweep.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teachers-followup-structure-audit-2026-05-22.md`
- `docs/analysis/phase3-teaching-load-runtime-and-teachers-followup-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/lib/grade-labels.ts`
- any helper/hooks used by `FacultyAssignments.tsx` for qualification, aliases, or load grouping

## Facts To Treat As Settled

- Scheduler-facing labels should remain `Teachers` and `Teaching Load`.
- `Teachers` must stay roster-first.
- `Teaching Load` remains the authoritative assignment-editing page.
- The previous pass did not fully remove specialization-first logic from `Teaching Load`.
- The previous pass did not make advisory section identity explicit enough on the `Teachers` surface.
- Build success alone is not enough for `GO`.
- Visible UI should keep `GR7` through `GR10` semantics and color parity where grade badges are shown.

## Scope

### A. Fix the likely Teaching Load runtime fragility

Audit and repair the part of `Teaching Load` most likely to be failing in runtime use, not just in build output.

Required direction:
- identify the exact runtime-fragile path introduced or left behind by the last pass
- simplify or remove stale specialization-heavy state where it conflicts with the new department-first direction
- keep the page rendering stable after route retargeting and current summary payload usage

Do not hide behind a successful Vite build.

### B. Continue the department-first reset honestly

Required:
- reduce or remove specialization-first scheduler-facing filters and groupings where they are no longer appropriate
- if a specialization helper must remain internally, keep it out of primary operator-facing language and controls
- do not keep renamed department labels while the real behavior is still specialization-led

### C. Finish advisory visibility on `Teachers`

Required:
- make the actual advisory section explicit on the `Teachers` surface when available
- do not rely only on star icons or advisory credit text
- ensure the operator can identify which class a teacher advises from the `Teachers` page or drawer

### D. Tighten remaining structure and readability issues

Required:
- keep the corrected `Teachers` table structure intact
- reduce identity-area micro-text further where it is still too small
- keep `Excluded in EnrollPro` only if it remains understandable and justified
- preserve grade-color parity on displayed grade badges

## Out Of Scope

Do not:
- redesign the whole shell
- change DB model naming
- invent new backend data if it does not already exist

## Verification Gates

Required:
- client build
- direct code verification of the exact runtime-fragile path repaired in `Teaching Load`
- direct verification that specialization-first scheduler-facing drift was materially reduced
- direct verification that advisory section is explicitly visible on `Teachers` when available
- direct verification that `GR7` to `GR10` badge color parity is preserved where used

If a browser/runtime check is available, verify:
- navigation from `Teachers` to `Teaching Load`
- initial render of `Teaching Load`
- selected-teacher render after route retargeting
- adviser teacher visibility

## Required Output

Return:
1. actual runtime or render-risk issue identified
2. files changed
3. `Teaching Load` runtime fix made
4. department-first simplification changes made
5. advisory visibility changes made on `Teachers`
6. remaining structure/readability cleanup made
7. verification results
8. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the likely `Teaching Load` runtime issue is specifically identified and repaired
- specialization-first scheduler-facing drift is materially reduced
- `Teachers` explicitly shows advisory section identity when available
- the touched UI remains readable and structurally coherent

If not, return `NO-GO` with the exact remaining blocker.
