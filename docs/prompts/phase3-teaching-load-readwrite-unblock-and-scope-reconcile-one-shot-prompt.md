# Copilot Execution Prompt: Phase 3 Teaching Load Read/Write Unblock And Scope Reconcile One-Shot

## Mission

Unblock Teaching Load so schedulers can perform CRUD operations that persist again, even after the recent subject-scope corrections for special-program and TLE rows.

Right now the page is still operationally blocked because:

- manual save is locked
- section-mode save is locked
- auto-fill is locked
- the workspace shows read-only behavior

The critical correction is:

- stop treating the current live state as a hard no-edit quarantine when the remaining issues are recoverable scope drift and coverage debt, not catastrophic assignment corruption

This pass must restore operational editability without lying about the remaining review/recovery work.

---

## Current Verified Live State

These findings are already verified directly against the active database/service logic for `schoolId=1`, `schoolYearId=55`:

- current split-brain preview returns:
  - `quarantine.required = true`
  - `severity = BLOCKING`
  - `reasonCodes =`
    - `INTEGRITY_OUT_OF_SUBJECT_SCOPE`
    - `FACULTY_LOAD_REVIEW_REQUIRED`
    - `TRUTH_RECONCILE_PENDING`
    - `REAL_FACULTY_RECOVERY_PENDING`
    - `REAL_FACULTY_RECOVERY_BLOCKERS`
- current counters are:
  - `summaryAssignedPairs = 954`
  - `summaryUnassignedPairs = 80`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 8`
  - `truthRowsToUpdate = 7`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 7`
  - `realFacultyBlockers = 24`
  - `specialProgramApprovalCandidates = 0`

Current root causes behind the lock:

1. `DEVL_READING` was re-scoped to special programs only, but saved ownership still includes STE rows.
   - this is generating the current `INTEGRITY_OUT_OF_SUBJECT_SCOPE` + `TRUTH_RECONCILE_PENDING` state
2. `TLE_FCS_EXP` was expanded to include special-program demand, which created real uncovered demand and recovery blockers
3. the current split-brain quarantine policy still treats recoverable coverage/reconcile debt as hard-blocking for all Teaching Load CRUD

This is the exact blocker to fix.

---

## What This Pass Is Not

Do **not** treat this as:

- another broad UI redesign
- another special-program redistribution pass
- another timetabling generator pass

This is a **runtime editability and quarantine-policy correction pass** for Teaching Load after valid scope changes.

---

## Required References

Read and follow before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect at minimum:

- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- any split-brain repair or Teaching Load mutation path touched by this change

---

## Product Decisions To Follow

### 1. Manual CRUD must not remain blocked by recoverable coverage debt

Schedulers must be able to:

- assign
- unassign
- swap
- save drafts
- persist changes

when the live state is recoverable and the backend can still safely accept writes.

### 2. Auto-fill is a repair tool and must not be blocked by its own recoverable prerequisites

If the only remaining blockers are recoverable scope drift and recovery debt, do not deadlock the operator by disabling auto-fill entirely.

### 3. Hard lockdown should be reserved for true data-corruption blockers

Examples of blockers that may still justify hard write lock:

- pair-count mismatch
- missing ownership rows
- ownership-without-scope corruption
- stale ownership debt that would directly poison writes
- true integrity contradictions that cannot be safely reconciled inline

Current review/recovery states like:

- `FACULTY_LOAD_REVIEW_REQUIRED`
- `REAL_FACULTY_RECOVERY_PENDING`
- `REAL_FACULTY_RECOVERY_BLOCKERS`

must not by themselves force the whole page into read-only mode.

### 4. Scope-driven out-of-subject rows should be reconcilable, not permanently page-locking

When a subject scope changes and some saved rows become out-of-scope:

- the system should guide or auto-run a safe reconcile path
- not strand the entire workspace in read-only mode indefinitely

### 5. The page must stay honest

Restoring CRUD does **not** mean hiding the remaining issues.

The UI must still show:

- that there are review/recovery items
- that some recovery work remains
- that some subjects are still under-covered

But those warnings must not disable all CRUD if the state is still safely editable.

---

## Required Fixes

### 1. Reclassify split-brain quarantine for Teaching Load editability

Required outcome:

- current live reason-code combinations like:
  - `FACULTY_LOAD_REVIEW_REQUIRED`
  - `REAL_FACULTY_RECOVERY_PENDING`
  - `REAL_FACULTY_RECOVERY_BLOCKERS`
- do **not** force `Teaching Load` into hard read-only mode by themselves

At minimum, update the logic so only true integrity-corruption blockers hard-lock the workspace.

### 2. Add safe reconcile behavior for scope-drift rows

Required outcome:

- current `DEVL_READING` out-of-scope saved rows can be reconciled without blocking the entire workspace forever
- the operator can either:
  - run a compact explicit reconcile action from the page
  - or trigger save/autofill through a safe repair-first flow

Do not leave `TRUTH_RECONCILE_PENDING` as a dead-end state that simply disables all CRUD.

### 3. Restore save persistence in both modes

Required outcome:

- teacher-mode changes can be saved again
- section-mode changes can be saved again
- save attempts must hit real persistence instead of being disabled at the UI gate

### 4. Restore auto-fill when the state is recoverable

Required outcome:

- auto-fill is re-enabled when remaining blockers are warning/recovery-class issues rather than catastrophic integrity contradictions
- if auto-fill must run a reconcile preflight first, do that deliberately and transparently

### 5. Keep warning visibility without page lock

Required outcome:

- keep clear warning/review messaging for remaining:
  - uncovered TLE special-program demand
  - load-review rows
  - recovery blockers
- but present these as operational warnings or review sheets, not as total edit lock unless truly necessary

---

## Specific Live Cases This Pass Must Handle

### A. `DEVL_READING`

Current state:

- `DEVL_READING` now has `programScopes = [SPA, SPS]`
- saved rows still include STE ownership

Required outcome:

- these saved STE rows are reconciled cleanly
- they no longer poison the split-brain state
- the page does not stay read-only because of this scope correction

### B. `TLE_FCS_EXP`

Current state:

- `TLE_FCS_EXP` now has broader scope including special programs
- live preview shows real uncovered/recovery-blocked demand

Required outcome:

- this remains visible as real coverage work
- but it must not by itself lock all CRUD and auto-fill

---

## Tailnet Verification Requirements

You must test directly on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

You must prove all of the following:

1. Teaching Load no longer stays in read-only mode for the current year-55 state.
2. Manual assignment changes can be made and saved in `By Teacher`.
3. Manual assignment changes can be made and saved in `Section Allocation`.
4. Auto-fill becomes usable again under the current recoverable blocker set.
5. The page still surfaces real review/recovery warnings instead of pretending the state is fully clean.
6. `DEVL_READING` scope-drift rows are reconciled or safely handled so they do not keep the whole page locked.
7. `TLE_FCS_EXP` uncovered demand remains visible as real work, but does not by itself hard-lock CRUD.

Record the exact before/after split-brain preview results.

---

## Build And Test Requirements

Run and record:

- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build`
- any directly relevant faculty-assignment / Teaching Load regression tests touched by this pass

If you change quarantine classification logic, add or update regression coverage for it.

---

## Documentation Updates

Update in the same pass:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Evidence-log rule:

- append only
- do not overwrite prior entries

The evidence entry must include:

- the exact pre-fix split-brain reason codes and counters
- the exact post-fix split-brain reason codes and counters
- whether manual save works again
- whether auto-fill works again
- whether any reasons still remain blocking and why

---

## Completion Rule

Do not declare `GO` just because backend data changed.

This pass is only `GO` if the actual Teaching Load workspace becomes operational again for CRUD and save persistence under the current year-55 state.
