# Copilot Execution Prompt: Phase 2 Tri-Sem Contract Reset

Run this first.

This prompt exists because the previous recovery pass only renamed some metadata and copy, but did not finish the tri-sem replacement. Treat this as a focused domain-contract reset, not a broad cleanup.

## Goal
Remove the remaining quarter-era scheduling contract from active runtime behavior and user-facing scheduling surfaces so the system behaves as a tri-sem system, not a quarter system with term aliases.

## Out of Scope
- Home-room KPI tuning beyond changes strictly required by tri-sem contract cleanup
- Shared-facility or shift-window work already completed in the prior recovery slice
- Publish-phase or faculty UX work

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/phases/phase-2-home-room-algorithm-2026-05-16.md`
- `docs/phases/PHASE-2-KICKOFF-SUMMARY.md`
- `docs/verification/evidence-log.md`
- `qa-artifacts/home-room-load-preferences-validation-2026-05-16.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`

## Mandatory First Step
Before editing:
1. Audit the repo for all remaining active quarter-era scheduling references.
2. List them in the response grouped as:
   - runtime logic
   - seeded/default subject contract
   - client types/contracts
   - user-facing copy
3. Then implement the fix.

Do not skip the audit. Do not start by claiming the drift is already resolved.

## What Must Be Fixed

### A. Runtime contract
- Remove remaining active reliance on quarter-era modular metadata for scheduling behavior.
- Do not derive active term behavior from quarter-labeled fields.
- Keep any compatibility shim isolated and non-user-facing if a migration bridge is unavoidable.

### B. Subject/modular contract
- Reconcile the current science modular structure with the intended tri-sem model.
- Remove the still-active 4-slice quarter-era assumption if it remains in seeds/defaults/runtime.
- Ensure seeded/default subject data no longer implies a quarter bundle when the active model is tri-sem.

### C. User-facing scheduling language
- Remove quarter-era language from active scheduling and subject configuration surfaces where term semantics are required.
- This includes labels, warnings, diagnostics, and summary text that users can actually see.

## Hard Rules
- Renaming `quarter` to `termIndex` in a few types is not enough.
- Do not update `docs/verification/evidence-log.md` with a success claim unless the 4-slice science assumption and active quarter-era scheduling references are actually resolved.
- If the full contract cannot be resolved in one pass, return `NO-GO` and enumerate the exact remaining blockers by file.

## Verification Gates
- `rg -n "quarter|quarters|Q1|Q2|Q3|Q4" prisma atlas-server atlas-client`
- relevant server typecheck/build checks
- relevant client typecheck/build checks for touched surfaces
- tests covering subject/modular contract and scheduling metadata propagation

## Evidence Update
If this prompt succeeds, append a narrow entry to `docs/verification/evidence-log.md` that states:
- tri-sem contract reset scope only
- exact commands run
- exact files changed
- what quarter-era contract was removed
- what quarter-era references intentionally remain, if any, and why they are non-active

Do not claim Phase 2 closure in this prompt.

## GO / NO-GO
Return `GO` only if:
- active runtime scheduling no longer depends on quarter-era semantics,
- the 4-slice science assumption is removed or formally isolated from active tri-sem scheduling behavior,
- user-facing scheduling copy is term-based on touched surfaces,
- verification results are included.

Return `NO-GO` if any active quarter-era scheduling contract remains.
