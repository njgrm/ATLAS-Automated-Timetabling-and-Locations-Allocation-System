# Copilot Execution Prompt: Phase 3 Upstream Section Sync + Program Parity Repair

## Goal
Repair the gap between live EnrollPro section demand and ATLAS persisted section mirrors so KPI reruns use the real active school-year section mix.

This prompt exists because live EnrollPro now exposes:
- `REGULAR: 58`
- `SCIENCE_TECHNOLOGY_AND_ENGINEERING: 8`
- `SPECIAL_PROGRAM_IN_THE_ARTS: 8`
- `SPECIAL_PROGRAM_IN_SPORTS: 8`

But ATLAS still persists only:
- `REGULAR: 58`
- `STE: 8`

You must treat that mismatch as a real blocker.

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/routes/section.router.ts`
- any sync path that persists `SectionMirror`

## Known Facts To Treat As Fact
- EnrollPro integration feed now includes live SPA/SPS sections on Tailnet.
- `section-adapter.ts` already has long-form normalization entries for SPA/SPS.
- ATLAS persisted `SectionMirror` state is stale or incomplete for those programs.
- KPI/generation evidence is currently under-reading active special-program demand because the mirror is not up to date.

## Scope
In scope:
- section sync execution path
- section normalization and persistence
- `SectionMirror.programType`, `programCode`, `programName`, `isSpecialProgram`
- direct DB proof and Tailnet API proof for the corrected section mix

Out of scope:
- timetable algorithm fixes
- template math changes
- faculty coverage fixes
- specialization alias cleanup beyond what is strictly required to unblock section parity

## Required Behavior
1. Audit live EnrollPro integration data first.
2. Audit current ATLAS persisted `SectionMirror` state second.
3. Identify why SPA/SPS sections are not represented in the mirror.
4. Implement the smallest coherent repair.
5. Re-run:
   - local build/typecheck for touched server code
   - Tailnet API verification
   - direct DB persistence proof
6. If the first fix is insufficient, perform one more repair iteration in the same pass.
7. Return `GO` only if persisted mirror parity is truly corrected.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate probe retries or filtering steps.
- If a probe is noisy, narrow it silently and continue.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - GO/NO-GO
- Limit this pass to at most 2 repair iterations.

## Verification Requirements
You must verify all of these:

### Tailnet EnrollPro source proof
- `https://dev-jegs.buru-degree.ts.net/api/integration/v1/sections?schoolId=16&schoolYearId=55`
- prove live program mix includes:
  - `SPECIAL_PROGRAM_IN_THE_ARTS`
  - `SPECIAL_PROGRAM_IN_SPORTS`

### Tailnet ATLAS API proof
- `GET /api/v1/sections/summary/55?schoolId=1`
- prove ATLAS now returns SPA/SPS-backed mirrored sections in the active summary

### Direct DB proof
- query `SectionMirror` for `(schoolId=1, schoolYearId=55)`
- prove persisted program mix now includes:
  - `SPA`
  - `SPS`

### Required parity checks
- `programType`
- `programCode`
- `programName`
- `isSpecialProgram`
- no stale fallback to only `REGULAR` and `STE`

## GO Criteria
Return `GO` only if all of these are true:
- EnrollPro source feed still shows SPA/SPS sections live
- ATLAS Tailnet sections summary now reflects those sections
- DB persistence proves SPA/SPS rows exist in `SectionMirror`
- normalized short-code parity is correct in persisted mirror state

If any of those fail, return `NO-GO`.
