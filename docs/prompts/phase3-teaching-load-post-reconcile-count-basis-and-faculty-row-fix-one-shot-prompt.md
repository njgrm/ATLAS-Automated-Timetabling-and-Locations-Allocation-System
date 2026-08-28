# Copilot Execution Prompt: Phase 3 Teaching Load Post-Reconcile Count Basis And Faculty Row Fix One-Shot

## Objective

Fix the remaining live `Teaching Load` contradiction **after** the split-brain hardening pass landed.

Current live state on Tailnet is no longer the old stale-placeholder incident. The new failure is narrower:

- saved summary truth now reports full closure (`962/962`, `unassigned=0`)
- coverage summary also reports every subject fully covered
- staffing report also reports `0` shortage
- **but** split-brain preview still returns blocking quarantine because:
  - `summaryAssignedPairs = 962`
  - `coverageAssignedPairs = 1044`
  - `assignmentPairDelta = -82`
- and an impossible faculty row still exists live:
  - `PERLA MARCOS`
  - `policyCreditedHours = 272.3`
  - `sectionCount = 81`
  - `SCI_ES` `Term 3 = 15975 minutes`

This pass must remove that last contradiction so the quarantine can lift for the right reasons.

## Safety Rule

Do **not** mutate live Tailnet data automatically in this pass.

Allowed:

- code changes
- local verification
- Tailnet read-only verification
- preview-only repair checks

Forbidden:

- auto-running live apply routes as part of verification
- silent data deletion in Tailnet

## Out of Scope

Do not:

- redesign the `Teaching Load` UI again
- reopen the old stale-placeholder incident work
- auto-approve special-program capability overrides
- change the rotational peak-term rule
- touch unrelated `Sections`, `Subjects`, or publish flows

## Required Reading

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-teaching-load-post-gemini-term-awareness-audit-2026-05-27.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`

## Confirmed Live Problem

The new reconcile/apply flow improved saved truth, but the system is still not internally consistent.

Live Tailnet now shows:

- `summary.coverageTotals.assignedPairs = 962`
- `summary.coverageTotals.totalPairs = 962`
- `coverage summary SCI_ES = 82/82 FULL`
- `staffingTruth.baseline.realCoveredRows = 962`
- `staffingTruth.baseline.unassignedRows = 0`

Yet the new split-brain preview still reports:

- `coverageAssignedPairs = 1044`
- `coverageTotalPairs = 1044`
- quarantine `required = true`
- reason codes include:
  - `ASSIGNED_PAIR_MISMATCH`
  - `TOTAL_PAIR_MISMATCH`

At the same time, `PERLA MARCOS` still carries an impossible science load in live faculty summary/detail.

That means one or both of these are still wrong:

1. the pair-count aggregation basis used by split-brain preview / coverage aggregation
2. the per-faculty assignment hydration path for rotational science ownership

## What The Existing Apply Repair Actually Does

Do not re-discover this from scratch.

The current `POST /faculty-assignments/integrity/reconcile-split-brain` apply path already orchestrates:

1. `previewOrApplyTeachingLoadTruthReconcile`
   - syncs `facultySubject.sectionIds` / `gradeLevels` to current ownership rows when they diverge
2. `previewOrApplyStaleOwnershipReconcile`
   - removes stale ownership rows and cleans affected `facultySubject` rows
3. `previewOrApplyRealFacultyRecovery`
   - persists recoverable placeholder-owned rows to real faculty when applicable
4. special-program redistribution preview
   - **preview only**
   - does **not** auto-approve or auto-apply capability overrides

So the next bug is not “the apply repair forgot to run.”
The next bug is that **after** those steps, the post-reconcile counters and/or faculty row hydration still disagree.

## Required Outcomes

### A. Reconcile pair-count basis across all truth surfaces

You must determine why split-brain preview still computes:

- `coverageAssignedPairs = 1044`
- `coverageTotalPairs = 1044`

when all other live truth paths now point to `962`.

Fix the counting basis so these agree across:

- `getAssignmentSummary`
- `getActiveSubjectCoverageSummary`
- `aggregateCoverageRows(...)`
- split-brain preview counters

The system must not remain quarantined because two internal pair-count formulas are counting different universes.

### B. Fix the impossible faculty row path

You must determine why `PERLA MARCOS` can still show:

- `81` sections
- `272.3h`
- giant `SCI_ES Term 3` ownership

when the saved summary/coverage/staffing state now claims normal full coverage.

Fix whichever path is wrong:

- faculty summary hydration
- faculty detail assignment ownership hydration
- rotational family breakdown construction
- ownership scope filtering
- current-year row filtering

This row must either:

1. become correct
2. or be explicitly quarantined because it is still contradictory

It must not remain silently impossible.

### C. Keep quarantine only for real contradictions

After the fixes, split-brain quarantine should remain blocking only if a real contradiction still exists.

If the only remaining issue is:

- `SPECIAL_PROGRAM_APPROVAL_REQUIRED`

then quarantine severity must degrade appropriately instead of staying `BLOCKING` on false pair-count mismatches.

Do not let approval-needed candidates keep assignment editing globally blocked unless there is a true data-truth contradiction.

### D. Preserve special-program approval surfacing

Keep the current queue behavior:

- show approval-needed `MAPEH` candidates
- do not auto-approve
- do not auto-apply redistribution

This pass should only ensure that approval-needed warnings are not mistaken for pair-count corruption.

## Implementation Directives

### 1. Audit the count basis

Trace how each of these derives its totals:

- `summary.coverageTotals`
- `coverage summary rows`
- `aggregateCoverageRows(...)`
- split-brain preview `counters`

Find and fix the inflation source behind `1044`.

### 2. Audit the impossible faculty row

Trace `PERLA MARCOS` through:

- faculty summary assembly
- assignment hydration
- ownership lookup
- current-year filtering
- rotation-term breakdown construction

Do not stop at “the UI shows it.” The bug is in the data path.

### 3. Adjust quarantine severity rules if needed

If pair-count contradictions are fixed and only approval-needed candidates remain, do not keep global blocking quarantine on.

### 4. Frontend follow-through

Only make the minimal frontend adjustments needed to:

- show the corrected quarantine state
- keep impossible row states honest if any remain

No redesign work here.

## Verification Requirements

### Automated

Run:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run test:faculty-assignment-pass5`

Add or update tests for:

- split-brain counter basis after saved truth is reconciled
- faculty summary/detail not inflating rotational science ownership after reconcile
- quarantine severity not staying blocking for approval-only warnings

### Tailnet Read-Only Verification

Prove all of the following after the fix:

1. `summaryAssignedPairs`, `coverageAssignedPairs`, and `staffingTruth.baseline.realCoveredRows` agree
2. `summaryTotalPairs` and `coverageTotalPairs` agree
3. `PERLA MARCOS` no longer shows impossible live load, or is explicitly quarantined for a still-real reason
4. split-brain preview reason codes no longer include false pair-count mismatches
5. approval-needed `MAPEH` candidates still appear

Do not apply live repair in this pass.

### Evidence Log

Append an honest entry to `docs/verification/evidence-log.md` that distinguishes:

- code/test proof
- Tailnet read-only proof
- what is fixed
- whether any faculty row still remains quarantined

## GO / NO-GO

### GO only if

- pair-count basis is internally consistent
- impossible faculty row inflation is fixed or explicitly quarantined for a real reason
- split-brain preview no longer blocks on false mismatches
- approval-needed `MAPEH` candidates remain surfaced
- builds/tests pass

### NO-GO if

- `coverageAssignedPairs` still differs from saved summary totals without explanation
- `PERLA MARCOS` still silently shows impossible science ownership
- quarantine remains blocking because of false arithmetic mismatches
