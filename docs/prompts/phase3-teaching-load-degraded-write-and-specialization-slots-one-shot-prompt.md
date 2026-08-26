# Copilot Execution Prompt: Phase 3 Teaching Load Degraded Write and Specialization Slots One-Shot

## Objective

Make `Teaching Load` operationally usable when EnrollPro is down, provided ATLAS already has enough local evidence, and turn `SPA_SPEC` / `SPS_SPEC` from mostly diagnostic specialization metadata into real specialization-aware assignment slots.

This pass is the product-contract fix for the current live gap:

- ATLAS already has enough local truth to reopen `Teaching Load`
- the backend can already compute staffing reports in degraded mode
- but the page is still client-locked to read-only
- special-program assignments still do not give schedulers a true specialization-aware assignment workflow

## Out of Scope

Do not:

- redesign the `Teaching Load` page from scratch
- reopen stale-ownership reconciliation
- rewrite staffing math from first principles
- explode `SPA_SPEC` / `SPS_SPEC` into separate top-level subject catalog rows
- introduce broad non-special-program specialization gating

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/services/qualification.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- any current capability / override / diagnostics helpers you find

## Facts To Treat As Settled

- stale ownership is already fixed and must stay fixed
- summary / coverage / staffing parity is materially improved and must not regress
- teacher-side rotation-aware load math is already in use and should be preserved
- staffing-needs already works from cached section evidence while EnrollPro is down
- `Teaching Load` is still effectively unusable during outage because the client forces read-only whenever `dataSource !== 'live'`
- live `SPA_SPEC` / `SPS_SPEC` ownership already carries assignment-level specialization identity
- special-program redistribution preview currently under-discovers realistic `MAPEH` candidates

## Required Product Outcome

After this pass:

- `Teaching Load` can perform safe ATLAS-owned write actions in degraded mode when local evidence is sufficient
- `SPA_SPEC` / `SPS_SPEC` assignments behave like specialization-aware section slots, not just generic umbrella rows
- weak EnrollPro specialization data can be supplemented by an ATLAS-owned approved capability / compatibility override
- special-program redistribution and candidate discovery can actually see realistic underutilized `MAPEH` teachers
- staffing-needs remains usable during outage and is not blocked by the same degraded-mode gate

## Implementation Requirements

### A. Enable degraded writable mode where ATLAS has enough evidence

Required:

- remove the blanket client rule that makes `Teaching Load` read-only whenever `dataSource !== 'live'`
- replace it with a narrower capability decision based on whether ATLAS has sufficient local evidence to operate safely

Minimum local evidence for degraded writable mode:

- ATLAS runtime context resolved
- active school year known
- current section summary available
- current subject contract available
- current faculty ownership summary available

Where that evidence exists, the system shall permit safe ATLAS-owned write operations for `Teaching Load`.

Where it does not exist, the system shall remain read-only and explain why.

### B. Separate safe degraded writes from truly upstream-dependent actions

Required:

- identify which `Teaching Load` actions are purely ATLAS-owned and safe during outage
- identify which actions remain unsafe and should still be blocked while EnrollPro is unavailable

Examples likely safe:

- manual ownership save
- special-program reassignment
- capability override maintenance
- staffing-needs report request

Examples that may remain blocked if truly necessary:

- direct upstream sync operations
- features that require fresh EnrollPro validation at execution time

### C. Make `SPA_SPEC` / `SPS_SPEC` specialization-aware section slots first-class

Required:

- keep `SPA_SPEC` and `SPS_SPEC` as umbrella subjects in the subject catalog
- in `Teaching Load`, treat each relevant section assignment as a specialization-aware slot
- preserve and use section-level specialization identity already present in ownership rows
- allow schedulers to assign a teacher to the section’s specialization slot rather than only to a generic umbrella ownership row

This is an assignment semantic, not a subject-catalog explosion.

### D. Add ATLAS-owned approved capability / compatibility overrides

Required:

- introduce an ATLAS-owned persisted capability / compatibility override for special-program assignment
- scope it at minimum by:
  - school
  - faculty
  - special-program subject family and/or specialization code
- make it possible for schedulers to use real `MAPEH` teachers honestly even when EnrollPro specialization strings are too generic

This override must supplement upstream data, not replace the original source contract globally.

### E. Fix special-program candidate discovery

Current live issue:

- `SPA_SPEC` / `SPS_SPEC` preview can return empty `candidateSignals`
- underutilized `MAPEH` teachers are excluded too early

Required:

- do not filter realistic `MAPEH` candidates out purely because umbrella owner codes are `SPA` or `SPS`
- candidate discovery should:
  1. include realistic department-baseline candidates
  2. refine by assignment-level specialization identity
  3. refine further by approved capability override
  4. preserve manual placements and safety constraints

### F. Keep staffing-needs usable in degraded mode

Required:

- do not let degraded-mode gating block staffing-needs if ATLAS can already compute it from local evidence
- preserve current warning/source metadata such as cached section evidence
- if a staffing report truly cannot be computed from local evidence, fail honestly and specifically

### G. Preserve current truth contracts

Do not regress:

- section-first assigned-class endpoints
- active-vs-raw coverage truth
- term-aware shortage reporting
- stale-ownership cleanliness
- degraded-source honesty labels added in prior passes

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- verify live Tailnet `Teaching Load` opens while EnrollPro is down
- verify safe ATLAS-owned `Teaching Load` write actions are now possible in degraded mode when local evidence exists
- verify staffing-needs can still be requested during outage
- verify `SPA_SPEC` / `SPS_SPEC` preview no longer collapses to empty `candidateSignals` solely because owner-code filtering excluded realistic `MAPEH` teachers
- verify `SPA_SPEC` / `SPS_SPEC` remain covered
- verify no stale-ownership or coverage-truth regression

## Required Output

Return:

1. files changed
2. degraded writable-mode contract changes
3. specialization-slot and capability-override changes
4. candidate-discovery and redistribution changes
5. staffing-needs outage-mode behavior
6. live verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Teaching Load` is no longer needlessly read-only during EnrollPro outage when ATLAS has enough local evidence
- `SPA_SPEC` / `SPS_SPEC` gain real specialization-aware assignment semantics
- approved capability / compatibility override exists for weak upstream specialization data
- realistic underutilized `MAPEH` candidates can surface in special-program preview
- no current truth-model gains are regressed
