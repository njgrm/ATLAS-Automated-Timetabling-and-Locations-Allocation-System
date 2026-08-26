# Copilot Execution Prompt: Phase 3 Teaching Load Split-Brain Repair And Special-Program Approval One-Shot

## Objective

Repair `Teaching Load` as a data-truth incident first, not as a cosmetic UI pass.

The current live state is a split-brain failure:

- faculty summary / faculty detail can show impossible rotational ownership totals
- coverage summary still reports large uncovered `SCI_ES` demand
- staffing truth reports the same demand as recoverable by real faculty
- the UI then compounds the contradiction by over-aggregating the bad row state

This pass must:

1. reconcile the contradictory `Teaching Load` data paths
2. quarantine desynced faculty/cohort state instead of letting the UI guess
3. correct real-faculty recovery behavior for rotational `SCIENCE`
4. preserve explicit human approval for `SPA_SPEC` / `SPS_SPEC` capability overrides
5. deliver the frontend/runtime contract needed for a final Gemini scheduler UX pass

This is a strict Copilot-owned backend + frontend + operational-safety pass.

## Non-Negotiable Safety Rule

Do **not** mutate live Tailnet data automatically.

Allowed:

- code changes
- diagnostic SQL / Prisma scripts
- dry-run reconciliation tooling
- apply tooling that a human operator can review and run manually
- local verification
- Tailnet read-only verification

Forbidden:

- automatically applying destructive or state-changing repairs to live Tailnet data
- silently deleting or rewriting live ownership rows during verification

The output of this pass must leave a human-auditable repair path.

## Out of Scope

Do not:

- do another broad visual redesign of `Teaching Load`
- auto-approve `MAPEH` capability overrides
- treat `Teacher X` synthetic closure as real staffing success
- reopen unrelated outage/runtime work outside `Teaching Load`
- change the peak-term rule
- collapse `SPA_SPEC` / `SPS_SPEC` specialization constraints into generic `MAPEH` by default

## Required Reading

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `GEMINI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-teaching-load-post-gemini-term-awareness-audit-2026-05-27.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

## Confirmed Live Problems To Fix

### 1. Summary/detail/coverage/staffing are still contradictory

Live Tailnet currently shows all of the following at once:

- `coverageTotals.assignedPairs = 892`
- `coverageTotals.unassignedPairs = 70`
- `integrityDiagnostics.staleOwnershipRowCount = 70`
- `coverage summary SCI_ES.uncoveredSectionCount = 70`
- `staffingTruth.realOnly.shortageRows = 0`
- `staffingTruth.realOnly.rowsClosedByRealFaculty = 70`

And a live faculty row (`PERLA MARCOS`) can still show:

- `policyCreditedHours = 272.3`
- `sectionTeachingHours = 267.3`
- `sectionCount = 81`
- `SCIENCE peakTermLabel = Term 3`
- `SCIENCE peakTermMinutesPerWeek = 15975`

That is not a scheduler UX problem.
That is a broken truth contract.

### 2. The UI still trusts contradictory row data too eagerly

Current `Teaching Load` can present impossible teacher totals instead of explicitly flagging the row / cohort as desynced.

When summary/detail/coverage do not agree, the page must not silently proceed as if the row is trustworthy.

### 3. Rotational Science recovery still is not operationally closed

The agreed rule is:

- rotational `SCIENCE` / `TLE_ROTATION` weekly load = heaviest single term
- terms are strictly sequential
- year-round subjects stack normally
- hard-cap must be checked per term

But current live saved truth still does not reflect that corrected model.

### 4. `MAPEH` redistribution is still only advisory

Live special-program redistribution preview still finds underutilized `MAPEH` candidates, but proposes zero moves because specialization-compatible handoff is blocked.

That is acceptable only if the system clearly surfaces:

- missing specialization compatibility
- missing approved capability overrides
- explicit scheduler approval path

It is not acceptable to silently leave zero-load `MAPEH` faculty looking like the system has no answer.

## Required Outcomes

### A. Build a trustworthy incident-grade reconcile path

You must implement a human-reviewed repair workflow for the split-brain state.

Required:

1. Add a diagnostic path that compares, for the same school + school year:
   - faculty summary truth
   - faculty detail truth
   - coverage summary truth
   - staffing truth
   - stale ownership truth
2. Detect and classify contradictions such as:
   - impossible per-faculty rotational totals
   - faculty detail rows that claim ownership the coverage summary does not count
   - stale placeholder ownership still leaking into teacher load paths
3. Produce a dry-run reconcile result that explicitly lists:
   - which faculty-subject rows are contradictory
   - which ownership rows are stale/orphaned
   - which rows would be detached
   - which rows would be reassigned by corrected real-faculty recovery
4. Provide an apply path that is safe for **manual operator execution**, not auto-run

The repair path may be:

- a protected admin API preview/apply pair
- a script under the server workspace
- or both

But it must be reviewable before apply.

### B. Quarantine desynced data in the frontend/runtime contract

When a faculty row or subject-family cohort is in a contradictory state, the UI must not guess.

Required behavior:

- show a clear `Data needs repair` / `Assignment state conflict` style state
- suppress misleading cap/status arithmetic for the contradictory row
- disable further manual assignment on that row while the contradiction exists
- direct the scheduler to the reconcile action / integrity workflow

Do not silently pick summary over detail or detail over summary in the main scheduler workflow.

### C. Fix real-faculty Science recovery behavior

Once the contradictory stale debt is removed, the corrected real-faculty recovery logic must distribute recoverable `SCI_ES` rows across eligible science teachers in a way that minimizes peak term load.

This is the required strategy:

- do **not** greedily dump all recoverable rows onto one least-loaded teacher
- distribute across eligible science faculty to smooth `Term 3` peak load
- respect per-term hard cap
- respect year-round stacking
- `Teacher X` remains fallback only after corrected real-faculty capacity is exhausted

If this requires changing candidate ranking / assignment ordering in auto-fill or recovery logic, do it.

### D. Keep `SPA_SPEC` / `SPS_SPEC` strict, but operational

The system must preserve:

- strict specialization compatibility by default
- explicit approved capability overrides
- no automatic creation of overrides

But it must improve the workflow so schedulers can actually act.

Required:

1. Keep exact specialization and approved-override checks authoritative.
2. Surface underutilized `MAPEH` teachers as candidates when they are plausible but blocked.
3. Expose a clear missing-approval state for those candidates.
4. Add or strengthen the frontend/operator path so a scheduler can see:
   - candidate teacher
   - current load
   - required specialization
   - whether an approved override exists
   - that manual approval is required before reassignment

This pass may add backend/frontend support for capability-approval review, but must not auto-approve.

### E. Fix source-state honesty inside `Teaching Load`

If EnrollPro is reachable but the page is still using mirror/cached section evidence by runtime policy, wording must say that truthfully.

Forbidden:

- claiming EnrollPro is unavailable when runtime says `enrollpro-verified`

Allowed wording shape:

- `Using saved ATLAS section data while EnrollPro connection is active.`

### F. Prepare the page for the final Gemini cleanup

Do not fully redesign the page here.

But you must leave the frontend contract in a clean enough state that Gemini can safely finalize the scheduler surface afterward.

Required:

- keep primary summary logic honest
- keep impossible data quarantined
- keep manual assignment preview tied to corrected truth
- avoid adding more dense diagnostic clutter to the main strip

## Implementation Plan

### 1. Backend truth reconciliation

Inspect and fix the divergence among:

- `getTeachingLoadSummary`
- faculty detail assignment hydration
- coverage summary
- staffing-needs truth
- auto-fill preview/apply
- stale ownership diagnostics / reconciliation

You must identify why a faculty detail path can still carry giant `SCI_ES` ownership that the coverage aggregate does not count.

### 2. Manual repair tooling

Implement a dry-run-first repair tool or endpoint that can:

- enumerate contradictory ownership and faculty-subject rows
- preview repair actions
- apply the repair when manually confirmed

If you use an API route, protect it appropriately and make preview the default.

### 3. Recovery distribution strategy

Update real-faculty recovery / auto-fill candidate ordering so recoverable rotational science rows are distributed to minimize peak term load, not concentrated into a single teacher.

### 4. Frontend quarantine state

In `FacultyAssignments`, add a clear integrity guard state for contradictory rows/cohorts.

Do not let the selected-teacher strip present normal scheduler arithmetic when the row is known bad.

### 5. Special-program approval surfacing

Strengthen `SPA_SPEC` / `SPS_SPEC` operator cues so blocked idle `MAPEH` candidates are visible with explicit approval-needed messaging.

### 6. Source-state copy

Correct `Teaching Load` staffing/source wording to reflect:

- EnrollPro active
- ATLAS mirror/cache currently preferred by runtime policy

## Verification Requirements

### Automated

Run and report:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run test:faculty-assignment-pass5`

Add or update tests for:

- split-brain contradiction detection
- dry-run reconcile output
- corrected rotational recovery distribution
- capability-override blocked candidate surfacing

### Tailnet Read-Only Verification

Using the live Tailnet environment in read-only mode, prove:

1. current contradiction before repair tooling
2. the dry-run reconcile output against that live state
3. the exact rows / faculties flagged by the repair preview
4. that the frontend now quarantines contradictory data instead of presenting normal load math
5. that `MAPEH` blocked candidates are surfaced with approval-needed state

Do **not** apply the repair on live Tailnet in this pass.

### Evidence Log

Append a new entry to `docs/verification/evidence-log.md` that clearly separates:

- local code/test proof
- Tailnet read-only proof
- dry-run repair proof
- any still-manual operator steps required

Do not write a fake `GO` if live apply was not executed.

## GO / NO-GO

### GO only if all are true

- split-brain contradictions are detected explicitly
- a manual, reviewable repair path exists
- frontend no longer silently trusts impossible faculty rows
- corrected recovery distribution no longer favors pathological single-teacher concentration
- `MAPEH` blocked candidate workflow is surfaced honestly
- build/tests pass
- evidence log is updated honestly

### NO-GO if any remain

- impossible per-faculty science load can still appear without quarantine
- summary/detail/coverage/staffing can still disagree without being flagged
- repair tooling mutates live Tailnet automatically
- `MAPEH` idle teachers are still hidden instead of surfaced as blocked-by-approval candidates
- source-state copy still falsely says EnrollPro is unavailable
