# Copilot Execution Prompt: Phase 3 Teaching Load Rotation And Redistribution One-Shot

## Objective

After the truth/integrity reset lands, finish the remaining live truth contract and then repair the operational teaching-load distortions:

- missing live summary-route exposure of truth totals/diagnostics
- rotation-family load overcount
- concentrated special-program distribution
- unresolved coverage gaps for active current-year subjects

This pass exists because the live system still counts rotating subject families like concurrent weekly rows, and because special-program plus modular-family coverage is still uneven in ways that make the page operationally misleading.

This is a staged pass:
1. complete the live summary-route truth exposure if it is still incomplete
2. then do the operational balancing work

It should consume the truth contract repaired by the previous prompt rather than redefine it again.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-bottleneck-audit-2026-05-22.md`
- the latest result of `phase3-teaching-load-truth-and-integrity-reset-one-shot-prompt.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- any current helper or UI surface that presents:
  - `sectionTeachingHours`
  - `policyCreditedHours`
  - per-subject breakdown
  - special-program ownership distribution

## Facts To Treat As Settled

- `SCI_BIO`, `SCI_CHEM`, and `SCI_ES` are part of one `SCIENCE` rotation family.
- `TLE`, `TLE_ICT_EXP`, `TLE_AFA_EXP`, and `TLE_FCS_EXP` are part of one `TLE_ROTATION` family.
- These rotating families should not be treated like concurrent full weekly rows for the same section in teacher-load accounting.
- `SPA_SPEC` and `SPS_SPEC` are real current-year subjects:
  - active
  - `225` minutes
  - classroom-default
  - owned by `SPA` and `SPS` respectively in the current live subject contract
- Current coverage gaps are concentrated, not universal. The key unresolved active rows are:
  - `SCI_ES` zero coverage
  - `TLE_FCS_EXP` zero coverage
  - partial `SCI_CHEM`
  - partial `ENG`
  - partial `FIL`
  - partial `HG`
  - partial `MATH`
  - partial `TLE_AFA_EXP`
  - partial `AP`
- Manual scheduler placements remain authoritative. Do not silently override them.

## Scope

### In Scope

#### A0. Complete live summary-route truth exposure first

Required:
- inspect the current live `GET /api/v1/faculty-assignments/summary` response
- if it still does not return `coverageTotals` and `integrityDiagnostics`, fix that first before any redistribution work
- ensure the summary route exposes the same truth contract already computed by `faculty-assignment.service.ts`
- ensure cached snapshot shape and client read logic stay aligned after the route payload is corrected

This pre-step is mandatory if the live route is still incomplete.

#### A. Repair rotation-family load accounting

Required:
- stop counting rotating family members like simultaneous weekly load for the same section
- ensure teacher load accounting reflects term rotation rather than concurrent duplication
- preserve visibility into the family members, but make the load math truthful

This must cover at least:
- `SCIENCE`
- `TLE_ROTATION`

#### B. Make rotation-family detail inspectable

Required:
- let schedulers see that a family exists
- let them see which member subjects belong to it
- avoid making the main load number depend on a concurrent-row interpretation

#### C. Audit and rebalance special-program distribution

Required:
- inspect current live `SPA_SPEC` and `SPS_SPEC` distribution
- reduce artificial concentration where the current baseline is obviously skewed
- keep the live department baseline truthful to the current subject contract
- do not reassign this prompt around the stale assumption that `SPA_SPEC` and `SPS_SPEC` belong to `MAPEH`
- allow a more realistic distribution across qualified teachers only if the live data still shows obvious concentration after the truth contract is complete

Do not invent specialization-tier gating again.

#### D. Close the most important active coverage gaps

Required:
- repair or redistribute active subject ownership for the highest-signal unresolved rows
- at minimum address:
  - `SCI_ES`
  - `TLE_FCS_EXP`
  - `SCI_CHEM`
  - `TLE_AFA_EXP`
  - `HG`
  - `FIL`
  - `ENG`
  - `MATH`
  - `AP`

If a repair must be preview-first, do it preview-first.
If a gap remains, explain exactly why.

### Out Of Scope

Do not:
- re-open specialization mapping as a scheduler-facing workflow
- redesign the shell/sidebar
- rewrite generator rooming or timetable policy logic in this prompt unless directly necessary for truthful teaching-load accounting
- skip the summary-route truth exposure step if the live route still omits truth totals/diagnostics

## Implementation Direction

- Prefer current-year truth over legacy broad seeding assumptions.
- Preserve manual placements.
- Treat rotation-family accounting as a load-truth problem, not a UI-label problem.
- Treat special-program redistribution as a baseline cleanup problem, not a specialization-eligibility problem.
- If the live summary route is incomplete, repair that contract first and verify it live before continuing into rotation/redistribution changes.

## Verification Gates

Required:
- client build
- server build/typecheck
- live Tailnet verification that `GET /api/v1/faculty-assignments/summary` now exposes:
  - `coverageTotals`
  - `integrityDiagnostics`
- live Tailnet verification of:
  - at least one science teacher previously inflated by `SCIENCE` family rows
  - at least one TLE teacher previously inflated by `TLE_ROTATION` rows
  - current `SPA_SPEC` / `SPS_SPEC` distribution
  - current active coverage summary after the pass
- DB verification of:
  - rotation-family teacher load behavior
  - active coverage rows for the target unresolved subjects
- direct proof that:
  - summary-route truth exposure is complete and live
  - rotation-family load accounting changed materially
  - special-program distribution is less concentrated if a redistribution was applied
  - the targeted coverage gaps improved or are clearly explained

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. summary-route truth exposure changes made
2. files changed
3. rotation-family accounting changes made
4. inspectability changes made for rotating subject families
5. special-program redistribution changes made
6. active coverage-gap changes made
7. before/after live examples for:
   - one science teacher
   - one TLE teacher
   - `SPA_SPEC`
   - `SPS_SPEC`
8. exact live `coverageTotals` and `integrityDiagnostics` payload proof after the pass
9. verification results
10. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the live summary route now exposes `coverageTotals` and `integrityDiagnostics`
- rotating subject families no longer inflate teacher load like concurrent weekly rows
- the page still shows family detail without lying about load
- active coverage improves for the targeted unresolved subjects or remaining gaps are explicitly justified
- the `SPA_SPEC` / `SPS_SPEC` baseline is no longer obviously concentrated without explanation

If not, return `NO-GO` with the exact remaining blocker.
