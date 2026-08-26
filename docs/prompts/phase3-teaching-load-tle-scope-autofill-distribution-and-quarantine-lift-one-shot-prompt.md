# Copilot Execution Prompt: Phase 3 Teaching Load TLE Scope, Auto-Fill Distribution, And Quarantine Lift One-Shot

## Objective

Close the remaining live `Teaching Load` blockers on the now-correct active school year.

The runtime/year bootstrap bug is fixed. The next pass must finish the real remaining closure work:

1. eliminate the remaining `8` out-of-subject-scope truth rows
2. stop auto-fill / recovery from creating or reinforcing pathological single-teacher concentration
3. make `SCIENCE` recovery distribute across eligible science teachers by minimizing peak term load
4. prevent another `PERLA MARCOS` style concentration from being created
5. separate true integrity outliers from ordinary overload conditions
6. lift quarantine if the only remaining issues are approval workflow or legitimate overload review

This is a strict Copilot-owned backend + frontend + Tailnet-verification pass.

## Why This Pass Exists

Live Tailnet preview on `schoolYearId = 55` currently shows:

- `summaryAssignedPairs = 962`
- `coverageAssignedPairs = 962`
- `unassignedPairs = 0`
- runtime active year is now correct

But split-brain preview still reports:

- `integrityOutOfSubjectScopePairs = 8`
- `truthRowsToUpdate = 8`
- `overloadedFacultyRows = 21`
- `realFacultyBlockers = 8`
- `specialProgramApprovalCandidates = 8`

And those buckets now have a precise meaning:

### Remaining truth rows

All `8` truth rows are:

- `subjectCode = TLE_ICT_EXP`
- `category = UNRESOLVED_AUTOMATION_SEED_BIAS`
- exactly `1` leaked pair each

Affected faculty:

- `ALVAREZ, MILAGROS`
- `DIAZ, LEONARDO`
- `GOMEZ, OFELIA`
- `IBARRA, TERESA`
- `JAVIER, NESTOR`
- `LUNA, CHRISTIAN`
- `NATIVIDAD, QUINTINA`
- `NAVARRO, GLORIA`

### Approval checks

All `8` approval checks are valid `SPS_SPEC` capability-approval candidates, not integrity failures.

### Over-cap bucket

The current `21 over-cap faculty` bucket is too coarse.
It mixes:

- one extreme corruption/outlier (`PERLA MARCOS`)
- several legitimate but ordinary overloads (`31.3h`, `35h`, `37.5h`, `42.5h`)

This is misleading in both backend classification and UI wording.

## Safety Rule

Allowed in this pass:

- code changes
- local build/test runs
- Tailnet preview verification
- controlled Tailnet apply testing if needed to prove the fix

Forbidden:

- global reset as a shortcut
- unrelated live destructive cleanup
- hiding integrity defects in UI without fixing backend truth
- treating approval-needed candidates as corruption

If a controlled live apply is needed, keep it narrow and document exactly what changed.

## Out of Scope

Do not:

- redesign the overall `Teaching Load` UI
- reopen active-school-year runtime work
- change the peak single-term rotational rule
- auto-approve `SPS_SPEC` / `SPA_SPEC` capability overrides
- reopen unrelated `Sections`, `Subjects`, publish, or faculty portal work

## Required Reading

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- `atlas-client/src/types.ts`

## Required Outcomes

### A. Fix the `8` TLE scope-leak truth rows

You must eliminate the current:

- `integrityOutOfSubjectScopePairs = 8`
- `truthRowsToUpdate = 8`

These are now known to be `TLE_ICT_EXP` scope leakage rows.

You must determine exactly why they still survive reconcile/apply and then fix the mutation path so they are actually cleared.

This is not enough:

- detecting them
- classifying them
- leaving them as permanent warnings

After this pass, the existing reconcile/apply path must be able to clear them.

### B. Fix auto-fill / recovery distribution so Perla-like concentration does not happen again

The system must not be allowed to dump recoverable science load into one pathological teacher row.

Required:

1. auto-fill and real-faculty recovery must distribute `SCIENCE` across eligible faculty by minimizing peak term load
2. per-term hard caps must be respected
3. year-round stacking must still be respected
4. concentration risk must be explicitly prevented in candidate ranking and apply ordering

You must prove this on the current dataset, not just in abstract.

### C. Prevent the exact `PERLA MARCOS` failure shape

The system needs a hardening rule so it does not recreate a row like:

- `271.3h`
- `80` sections
- giant `SCI_ES` term concentration

You must decide where this belongs:

- candidate ranking
- concentration guardrail
- apply-time validation
- integrity quarantine
- or a combination

But after this pass, the platform must not be able to silently auto-create that kind of assignment concentration again.

### D. Reclassify overload truth more honestly

The current `overloadedFacultyRows = 21` bucket is too broad.

You must split or reclassify it so the product distinguishes between:

1. **true load outliers / likely corruption**
   - example: `PERLA MARCOS`
2. **legitimate overloads above max**
   - example: `31.3h`, `35h`, `37.5h`, `42.5h`
3. **approval workflow blockers**
   - not integrity errors

Do not keep labeling all `21` as if they are the same class of problem.

### E. Keep approval-needed candidates visible, but separate

The `8` `SPS_SPEC` approval checks are valid workflow items.

Preserve:

- explicit visibility
- no auto-approval
- clear faculty + specialization requirement + approval-needed reason

But they must not keep quarantine blocking if integrity and truth rows are otherwise clean.

### F. Lift quarantine when only non-blocking conditions remain

After this pass, quarantine should only remain blocking if there is still a true blocking defect.

If the remaining conditions are only:

- legitimate overload review
- approval-needed special-program candidates

then the system should degrade to a warning state, not blocking quarantine.

## Implementation Directives

### 1. Make reconcile/apply actually clear the TLE scope-leak rows

Current live state proves preview knows about the rows but apply is not removing them.

Fix the actual repair path.

### 2. Harden candidate ranking and apply order for science distribution

Do not use a naive least-loaded or append-first strategy.

Ranking must consider at least:

- projected peak term load
- current concentration within `SCIENCE`
- section spread / lane spread
- resulting credited weekly load

### 3. Add a concentration guardrail

If a candidate would become an extreme outlier compared with other eligible faculty, the system should avoid that assignment unless no other feasible option exists.

This guardrail must apply to:

- auto-fill preview
- auto-fill apply
- real-faculty recovery apply

### 4. Rework blocker classification and UI counters

Backend counters and frontend banner copy must stop implying:

- all overloads are corruption
- approval checks are integrity failures

The selected wording may vary, but the semantics must be correct.

### 5. Keep the UI changes narrow

Only adjust the UI enough to:

- show the reclassified buckets honestly
- stop saying `21 over-cap faculty` as if they are all the same
- show approval checks as approval workflow
- reflect quarantine-lift correctly when blocking reasons are gone

No redesign.

## Verification Requirements

### Automated

Run:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run test:faculty-assignment-pass5`

Add or update regression coverage for:

- `TLE_ICT_EXP` out-of-subject-scope repair
- science distribution ranking / anti-concentration behavior
- outlier-vs-overload classification
- quarantine severity downgrading when only approval workflow or non-blocking overloads remain

### Tailnet Verification

Using the live Tailnet environment, prove:

1. the `8` truth rows are cleared or reduced to a fully explained residual set
2. `integrityOutOfSubjectScopePairs` and `truthRowsToUpdate` no longer stick at `8`
3. `PERLA MARCOS` no longer exists as an absurd auto-filled concentration row, or is explicitly quarantined only if a real residual defect still exists
4. `SCIENCE` recovery is spread across eligible science teachers instead of collapsing into one teacher
5. the overload bucket is reclassified more honestly
6. approval-needed `SPS_SPEC` candidates still appear
7. quarantine becomes warning-only if integrity is clean and only approval/legitimate overload review remains

If you perform a controlled live apply for proof, document it precisely.

### Evidence Log

Append a truthful entry to `docs/verification/evidence-log.md` with:

- files changed
- builds/tests
- Tailnet preview/apply results
- before/after blocker counters
- whether quarantine was lifted, downgraded, or remains blocking
- whether science distribution is now stable

## GO / NO-GO

### GO only if

- the `8` TLE scope-leak truth rows are actually fixed or reduced to a clearly justified residual set
- auto-fill/recovery can no longer create a `PERLA`-style concentration row
- science coverage is spread across real faculty more sensibly
- overload/outlier labeling is honest
- approval checks remain visible but separate
- quarantine is lifted or downgraded correctly when only non-blocking conditions remain
- builds/tests pass
- Tailnet evidence is recorded

### NO-GO if

- the same `8` truth rows still persist unexplained
- concentration can still collapse onto one teacher
- `21 over-cap faculty` still means a mixed bucket with misleading copy
- approval checks still behave like integrity corruption
- quarantine remains blocking without a true blocking defect
