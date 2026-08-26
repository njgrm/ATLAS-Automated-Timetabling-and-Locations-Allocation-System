# Copilot Execution Prompt: Phase 3 Teaching Load Residual Integrity And Outlier Fix One-Shot

## Objective

Close the remaining live `Teaching Load` blockers after the post-reconcile count-basis fix.

The broad split-brain arithmetic issue is now fixed on Tailnet:

- summary totals align
- coverage totals align
- staffing totals align
- false pair-count mismatch reasons are gone

But `Teaching Load` is still correctly blocked by a narrower live integrity problem:

- `integrityMissingOwnershipPairs = 16`
- `integrityOwnershipWithoutScopePairs = 16`
- `overloadedFacultyRows = 21`
- `realFacultyBlockers = 2`
- `PERLA MARCOS` still shows an impossible `SCIENCE` outlier row (`271.3h`, `80` sections, `Term 3` peak `15975` minutes)

This pass must isolate and fix those remaining live blockers.

## Safety Rule

Do **not** mutate live Tailnet automatically in this pass.

Allowed:

- code changes
- local verification
- Tailnet read-only verification
- preview-only incident/reconcile probes

Forbidden:

- auto-running live apply mutation routes
- global reset as a shortcut
- destructive live repair without explicit human approval afterward

## Out of Scope

Do not:

- redesign `Teaching Load`
- reopen the already-fixed count-basis mismatch work
- auto-approve `SPA/SPS` capability overrides
- use global reset as the primary solution
- change the rotational peak-term rule
- reopen unrelated `Sections`, `Subjects`, publish, or faculty-auth work

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
- `atlas-client/src/types.ts`

## Confirmed Live State

Current Tailnet read-only verification shows:

- summary totals:
  - `assignedPairs = 962`
  - `totalPairs = 962`
  - `unassignedPairs = 0`
- coverage totals:
  - `assignedPairs = 962`
  - `totalPairs = 962`
- staffing baseline:
  - `realCoveredRows = 962`
  - `unassignedRows = 0`

But split-brain preview is still `BLOCKING` because:

- `integrityMissingOwnershipPairs = 16`
- `integrityOwnershipWithoutScopePairs = 16`
- `overloadedFacultyRows = 21`
- `realFacultyBlockers = 2`
- `specialProgramApprovalCandidates = 8`

The remaining impossible faculty sample is:

- `PERLA MARCOS`
- `policyCreditedHours = 271.3`
- `sectionTeachingHours = 266.3`
- `sectionCount = 80`
- `subjectCount = 3`
- `SCIENCE peakTermLabel = Term 3`
- `SCIENCE peakTermMinutesPerWeek = 15975`

This means the system is no longer suffering from broad coverage arithmetic drift.
It is now suffering from residual assignment integrity drift and faculty outlier truth.

## Required Outcomes

### A. Explain and fix the remaining `16 / 16` integrity drift

You must identify exactly which rows make up:

- `integrityMissingOwnershipPairs = 16`
- `integrityOwnershipWithoutScopePairs = 16`

Then determine whether they are caused by:

- bad `facultySubject.sectionIds`
- bad `subjectSectionOwnership` scope
- subject relevance scoping bugs
- special-program ownership scope leakage
- HG/advisory coupling
- another current-year filtering defect

Fix the root cause so these counters drop to the correct value.

Do not leave them as unexplained “expected warnings.”

### B. Fix the faculty outlier path

You must determine why `PERLA MARCOS` still carries an impossible live science load.

Your investigation must explain:

- why this row still owns or appears to own `SCI_ES` across nearly the whole school year
- why coverage/staffing can be fully closed while her faculty row remains this inflated
- whether the fault is in:
  - faculty summary hydration
  - faculty detail hydration
  - assignment ownership scope resolution
  - rotational breakdown construction
  - or a different row-path defect

Then fix it.

The outlier row should either:

1. become a sane real row
2. or remain quarantined only if there is a still-real integrity defect that cannot yet be repaired

It must not stay silently impossible.

### C. Resolve the remaining `realFacultyBlockers = 2`

Split-brain preview still reports `realFacultyBlockers = 2`.

You must:

- identify exactly which rows/blockers these are
- classify whether they are:
  - integrity defects
  - qualification defects
  - advisory/HG defects
  - capability-approval blockers
- fix them if they are repairable in this pass
- otherwise return explicit blocker diagnostics in a form the operator can understand

### D. Keep special-program approval separate from integrity failure

`specialProgramApprovalCandidates = 8` is valid warning-state behavior.

Preserve:

- approval-needed candidate surfacing
- no automatic override creation
- no automatic redistribution apply

But do not let approval-needed candidates masquerade as unexplained integrity corruption.

### E. Prepare for controlled Tailnet apply testing

The goal of this pass is to make the remaining state small and explicit enough that a later **controlled Tailnet apply test** becomes justified.

That means after this pass:

- the residual integrity counters should be correct and explained
- the outlier path should be fixed or clearly isolated
- the remaining blockers, if any, should be concrete and operator-readable

## Implementation Directives

### 1. Add deeper integrity diagnostics if needed

If current counters are not specific enough, extend the preview/diagnostic output so operators can see:

- affected faculty ids
- affected subject ids / subject codes
- affected section ids
- mismatch type

Do this without blowing up the main scheduler UI.

### 2. Trace `PERLA MARCOS` end-to-end

Trace her through:

- `faculty summary`
- `faculty detail`
- ownership rows
- faculty-subject rows
- current-year scoping
- subject relevance filtering
- rotational term breakdown construction

Document and fix the true inflation source.

### 3. Keep the UI quarantine honest

Only adjust frontend behavior as needed to:

- surface the more specific remaining blockers
- preserve quarantine for truly blocking reasons
- avoid presenting impossible row math as trustworthy

No redesign work here.

## Verification Requirements

### Automated

Run:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run test:faculty-assignment-pass5`

Add or update regression coverage for:

- residual integrity counter classification
- outlier faculty row inflation fix
- real-faculty blocker identification

### Tailnet Read-Only Verification

Prove all of the following after the fix:

1. `integrityMissingOwnershipPairs` is either `0` or explicitly mapped to a concrete remaining defect set
2. `integrityOwnershipWithoutScopePairs` is either `0` or explicitly mapped to a concrete remaining defect set
3. `PERLA MARCOS` no longer shows impossible live load, or is isolated for a clearly justified reason
4. `realFacultyBlockers = 2` is resolved or explicitly explained by row
5. approval-needed `MAPEH` candidates still appear separately

Do not perform live apply mutation in this pass.

### Evidence Log

Append a truthful entry to `docs/verification/evidence-log.md` with:

- files changed
- builds/tests
- Tailnet read-only findings
- whether the system is now ready for a controlled live apply test

## GO / NO-GO

### GO only if

- the remaining `16 / 16` integrity drift is fixed or fully explained by concrete row diagnostics
- the `PERLA MARCOS` outlier is fixed or explicitly isolated
- `realFacultyBlockers = 2` is fixed or explicitly identified
- approval-needed special-program candidates remain visible
- builds/tests pass
- the system is now ready for controlled Tailnet apply testing

### NO-GO if

- integrity counters still exist without clear cause
- faculty outlier inflation still persists without explanation
- remaining blockers are still abstract counters instead of operator-readable defects
