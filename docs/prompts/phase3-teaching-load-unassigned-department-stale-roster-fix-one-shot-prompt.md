# Copilot Execution Prompt: Phase 3 Teaching Load Unassigned Department Stale Roster Fix One-Shot

## Objective

Fix the current `Teaching Load` roster leak where stale or incomplete faculty mirror rows appear under `UNASSIGNED DEPARTMENT` even though they are not real active scheduler-facing teachers.

This is a narrow integrity fix.

Do not reopen broader Teaching Load math, UX, or staffing logic.

## Why This Pass Is Needed

Current live DB state includes faculty mirror rows that are:

- `isStale = false`
- `isActiveForScheduling = true`
- `isPlaceholder = false`
- `department = null`
- zero `FacultySubject` rows
- zero `SubjectSectionOwnership` rows

Confirmed live examples:

- `ELPIDIO AQUINO` (`employeeId=6319922`)
- `FELICIDAD AQUINO` (`employeeId=5780142`)
- `DIEGO AQUINO` (`employeeId=3179586`)

These rows are currently real records in `faculty_mirrors`, so the UI is not inventing them.
But they are clearly not valid current scheduler roster members.

They are zombie mirror rows.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`

## Facts To Treat As Settled

- the current `Teaching Load` page groups roster members by:
  - real department code
  - `UNSTAFFED TEMPORARY ROLES` for placeholders
  - `UNASSIGNED DEPARTMENT` for blank departments
- these zombie rows currently fall into `UNASSIGNED DEPARTMENT`
- the live DB check showed these rows have no real teaching-load ownership
- EnrollPro being down prevents an upstream reconciliation from cleaning them automatically right now
- scheduler-facing pages should not treat obviously incomplete legacy mirrors as active working roster

## Scope

### In Scope

- narrow backend fix so invalid incomplete mirror rows stop appearing in scheduler-facing Teaching Load roster output
- preserve honest diagnostics so the system does not silently destroy evidence of the bad rows
- ensure department filter/grouping no longer surfaces these zombie rows as if they were real current teachers

### Out of Scope

- broad faculty sync refactor
- rewriting stale reconciliation strategy end-to-end
- changing qualification rules
- changing staffing math
- changing page layout
- deleting records automatically without proof and guardrails

## Required Behavior

### 1. Quarantine clearly invalid roster rows from scheduler-facing summary output

For the `Teaching Load` summary/roster path, exclude non-placeholder faculty mirror rows that are clearly incomplete and unusable as active scheduler actors.

At minimum, handle rows matching this shape:

- `isStale = false`
- `isActiveForScheduling = true`
- `department` missing or blank
- zero current teaching-load ownership / zero assignment footprint

This must stop them from showing up in:

- grouped faculty roster
- department options
- `UNASSIGNED DEPARTMENT` bucket when they are not genuinely assignable current teachers

### 2. Keep integrity visibility

Do not silently pretend the data never existed.

Expose a small diagnostic count and optional sample IDs/names in the summary integrity contract or nearby admin-facing diagnostics so operators or auditors can still see that rows were quarantined.

### 3. Do not hide legitimate edge cases

If a real active faculty member genuinely has missing department data but already owns current teaching-load rows, do not blindly drop them.

The filter should be narrow and integrity-aware, not a crude `department IS NOT NULL` hard cut.

### 4. Keep future sync recovery compatible

When EnrollPro comes back and a real faculty sync succeeds, the system should still be able to:

- stale out or reconcile these rows properly
- preserve valid canonical current rows

Do not introduce a fix that makes future reconciliation harder.

## Implementation Direction

- prefer fixing this in the backend summary-building contract rather than only hiding it in the frontend
- if needed, add a dedicated helper predicate for “scheduler-usable active roster member”
- keep placeholder behavior unchanged
- keep truly active assigned teachers visible even if they have data-quality issues; only quarantine clearly dead/incomplete rows

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- verify current zombie examples no longer appear in `/faculty-assignments/summary` scheduler-facing roster output
- verify placeholders still appear only in their intended bucket
- verify legitimate active assigned teachers are not accidentally removed
- verify the summary contract still returns useful integrity diagnostics for the quarantined rows
- verify Tailnet/live probe after the change, not build-only

## Required Output

Return:

1. files changed
2. the exact predicate used to quarantine invalid roster rows
3. integrity-diagnostic additions
4. live verification results
5. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the zombie null-department rows no longer appear as active teaching-load roster members
- placeholders and real teachers are still separated correctly
- no legitimate active assigned teacher was wrongly hidden
- integrity evidence for quarantined rows remains inspectable
