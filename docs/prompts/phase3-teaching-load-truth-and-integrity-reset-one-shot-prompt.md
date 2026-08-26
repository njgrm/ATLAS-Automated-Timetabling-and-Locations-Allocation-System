# Copilot Execution Prompt: Phase 3 Teaching Load Truth And Integrity Reset One-Shot

## Objective

Repair the foundational truth contract of `Teaching Load` before any further balancing or redistribution work.

This pass exists because the current live page still mixes:

- an overstated `assigned / total` denominator
- current-year and historical ownership drift
- seeded qualification rows with empty `sectionIds`
- actual owned teaching load rows

The goal of this pass is to make the page and APIs tell the truth about:

- what the current-year teachable universe actually is
- which rows represent real section ownership
- which rows are only baseline qualification/seed hints
- which current-year subject-section pairs are truly assigned

This is the foundational teaching-load repair.
Do not skip it and jump straight to redistribution.

This pass must also preserve the current scheduler-facing route and naming contract.
Do not regress the UX back to legacy `Faculty` / `Assignments` terminology while repairing truth and integrity.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-bottleneck-audit-2026-05-22.md`
- `docs/analysis/phase3-faculty-teaching-load-performance-and-offline-audit-2026-05-22.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/App.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/faculty-assignment-scope.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- any current helper that computes active school-year section scope or assignment coverage

## Facts To Treat As Settled

- Scheduler-facing qualification is department-first.
- Manual `Teaching Load` placement remains authoritative.
- `FacultySubject` rows with empty `sectionIds` must not be treated as real owned teaching load.
- The current `787 / 1476 assigned` badge is misleading because the denominator ignores subject `programScopes`.
- The more accurate current-year non-`HG` baseline is approximately:
  - `1026` relevant program-scoped pairs
  - `778` currently owned pairs
- Current-year read behavior must be school-year scoped, not just school scoped.
- Historical `SubjectSectionOwnership` rows must not silently distort current-year `Teaching Load`.
- Scheduler-facing naming remains:
  - `Teachers`
  - `Teaching Load`
- Scheduler-facing frontend routes remain:
  - `/teachers`
  - `/teaching-load`
- Any legacy `/faculty` or `/assignments` references encountered during this pass must be treated as compatibility debt or stale wording, not as the preferred UX contract.

## Scope

### In Scope

#### A. Fix overview pair math

Required:
- make `assigned / total` respect both:
  - subject `gradeLevels`
  - subject `programScopes`
- ensure the same current-year teachable universe is used consistently across:
  - overview stats
  - section checkbox availability
  - coverage calculations where appropriate

#### B. Separate real load rows from baseline qualification rows

Required:
- stop treating seeded `FacultySubject` rows with empty `sectionIds` as if they were actual teaching load assignments
- keep them if needed for baseline qualification logic, but surface them as a distinct state
- do not let those rows inflate:
  - assigned-teacher counts
  - section-owned load metrics
  - operator understanding of who is actually handling sections

#### C. Reconcile current-year ownership truth

Required:
- make current-year summary and supporting read models explicitly scoped to active/current-year sections
- do not let historical ownership rows distort current-year teaching-load truth
- reconcile current-year drift between:
  - `FacultySubject.sectionIds`
  - `SubjectSectionOwnership`

If reconciliation needs a preview-first repair path, add one.
Do not apply destructive cleanup blindly.

#### D. Improve current-year integrity diagnostics

Required:
- expose enough diagnostics for operators or admins to see:
  - rows with empty `sectionIds`
  - current-year rows with missing ownership
  - current-year ownership without matching assignment scope
- keep this understandable and auditable

#### E. Preserve current Teachers / Teaching Load naming and routes

Required:
- do not regress any scheduler-facing label from `Teachers` back to `Faculty`
- do not regress any scheduler-facing label from `Teaching Load` back to `Assignments`
- do not regress the primary frontend route contract away from:
  - `/teachers`
  - `/teaching-load`
- if this pass touches links, remediation paths, breadcrumbs, badges, cache copy, or offline-state copy, keep them aligned to the current visible route and label contract

### Out Of Scope

Do not:
- rebalance SPA/SPS staffing in this prompt
- rewrite rotation-family load accounting in this prompt
- redesign the full UI shell in this prompt
- silently delete historical data without an explicit repair path or confirmation contract
- reintroduce legacy visible route or page naming as part of a truth/integrity repair

## Implementation Direction

- Preserve the current department-first qualification model.
- Treat empty-section rows as baseline qualification state, not real load.
- Current-year read truth should be driven by active/current-year section scope.
- If summary and coverage endpoints need different scoped outputs, make that explicit rather than implicit.
- Keep read surfaces truthful before making them pretty.
- If you touch visible page text or navigation links while implementing this pass, preserve the modern scheduler-facing UX contract:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`

## Verification Gates

Required:
- client build
- server build/typecheck
- live Tailnet verification of:
  - `Teaching Load` overview counts
  - selected teacher with real owned sections
  - selected teacher with empty seeded rows
  - subject row section availability for a scoped special-program subject
- DB verification of:
  - current-year `FacultySubject` refs vs `SubjectSectionOwnership`
  - empty `sectionIds` rows after the pass
- direct proof that:
  - overview denominator now respects `programScopes`
  - current-year read truth is no longer distorted by historical ownership rows
- live verification that this pass did not regress scheduler-facing naming or routes:
  - `Teachers` remains visible in UI/nav where expected
  - `Teaching Load` remains visible in UI/nav where expected
  - remediation and deep links still target `/teaching-load`, not `/assignments`

Manual truth checks required:
- verify the page no longer represents empty seeded rows as actual owned load
- verify the page no longer reports the old inflated `assigned / total` denominator
- record the new live count

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. root truth/integrity issues repaired
2. files changed
3. overview-pair math changes made
4. empty-row handling changes made
5. current-year ownership reconciliation changes made
6. integrity diagnostic changes made
7. naming/route non-regression checks performed
8. exact new live `assigned / total` baseline after the pass
9. verification results
10. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- `assigned / total` is now based on the real current-year program-scoped universe
- empty seeded rows no longer masquerade as real assigned load
- current-year read truth is school-year scoped and no longer distorted by historical ownership rows
- the pass did not regress visible scheduler-facing naming or primary routes back to `Faculty` / `Assignments`
- the final output states the exact new live baseline count after repair

If not, return `NO-GO` with the exact remaining blocker.
