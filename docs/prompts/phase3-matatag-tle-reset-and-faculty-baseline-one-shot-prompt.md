# Copilot Execution Prompt: Phase 3 MATATAG TLE Reset + Faculty Baseline One-Shot

## Objective

Reset ATLAS away from the stale TLE cohort/split model and align the next generation baseline to the now-confirmed MATATAG contract:
- Grades 7-10 TLE are section-scoped rotational/modular subjects
- Grades 9-10 no longer require split specialization cohorts
- EnrollPro no longer provides TLE split metadata in the active section feed

In the same pass, audit the faculty qualification baseline against department ownership and the stakeholder's official department counts so the generator is not rebuilt on a hidden staffing assumption.

## Required Context

Read these first:
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/verification/evidence-log.md`

## Facts To Treat As Settled

- Live EnrollPro sections for `schoolYearId=55` now return:
  - `82` sections total
  - `0` rows with `tleProgramId`
  - `0` rows with `tleSpecialization`
- Live ATLAS `SectionMirror` now also has:
  - `82` mirrored sections total
  - `0` TLE-tagged section rows
- Any remaining ATLAS TLE cohort logic is now stale and must not be preserved just because older prompts optimized it.
- Latest live generation run `63` still emits:
  - `cohortCount=4`
  - contract warning about deriving TLE cohorts
  - many `TLE_EXPLORATORY` modular warnings
- Stakeholder official department counts are:
  - `SCI=19`
  - `MATH=22`
  - `ENG=22`
  - `TLE=22`
  - `FIL=16`
  - `ESP=11`
  - `MAPEH=21`
  - `AP=13`
- Current active EnrollPro faculty feed is:
  - `SCI=18`
  - `MATH=25`
  - `ENG=33`
  - `TLE=13`
  - `FIL=14`
  - `ESP=11`
  - `MAPEH=14`
  - `AP=14`

## Scope

### A. Reset TLE scheduling contract

Make ATLAS behave as if TLE is now a modular per-section rotation contract across Grades 7-10.

That includes any affected logic in:
- subject activation / modular grouping
- template binding assumptions
- generation demand creation
- cohort generation / fallback logic
- review/runtime summaries that currently report stale TLE cohort warnings

### B. Retire stale cohort dependence

Do not preserve TLE-specific `InstructionalCohort` dependence just because the schema still exists.

If local cohort rows remain useful for non-TLE future cases, keep the primitive available.
But TLE generation must stop depending on them.

### C. Re-audit faculty qualification baseline

Inspect whether current qualification and autofill assumptions are still too specialization-heavy for the new contract.

Bias toward:
- department-based defaults
- manual locked placements respected absolutely
- specialization detail only where it still truly matters

If safe local repairs are needed in the same pass to keep this new contract coherent, make them.

## Explicit Non-Goals

Do not:
- reopen stakeholder-faithful campus topology work in this pass
- reinvent SPA/SPS offering contracts
- add a department-head user role
- fabricate faculty rows to force stakeholder counts to match EnrollPro

## Required Live Verification

Use live Tailnet/DB verification.

You must prove:
1. EnrollPro active section feed still has `82` sections and no TLE split metadata.
2. ATLAS section mirror still has `82` sections and no TLE-tagged section rows.
3. TLE generation no longer emits stale cohort-derived contract behavior.
4. Any TLE modular warnings or remaining staffing warnings are now tied to the new per-section rotational model, not old cohort expectations.
5. Faculty baseline mismatch versus stakeholder counts is explicitly documented as:
   - matched
   - mismatched but harmless for current pass
   - mismatched and blocking

## Verification Gates

Local:
- touched server build/typecheck
- any touched client build/typecheck
- targeted tests for touched TLE generation / modular / qualification logic

Live:
- EnrollPro sections feed
- EnrollPro faculty feed
- ATLAS latest run before/after if generation is rerun
- direct DB proof for section mirror and cohort state

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- If a check is noisy, narrow it silently.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Required Output

Return:
1. before-state summary
2. files changed
3. exact TLE contract reset made
4. faculty-baseline findings
5. verification results
6. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if all of the following are true:
- ATLAS no longer depends on TLE cohort/split assumptions for current generation
- live EnrollPro/ATLAS section parity remains clean at `82` unsplit sections
- the latest TLE contract warnings now reflect the new model or disappear
- faculty-baseline mismatch is either documented as non-blocking for this pass or explicitly repaired where safe

If not, return `NO-GO` with exact blockers.
