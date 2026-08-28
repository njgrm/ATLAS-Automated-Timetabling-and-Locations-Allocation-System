# Copilot Execution Prompt: Phase 3 Teaching Load Saved-Truth and Peak-Term UI Reconciliation One-Shot

## Objective

Close the remaining high-severity `Teaching Load` gaps after the rotational term-awareness and Gemini UX passes.

This pass must handle both:

- backend / persisted truth reconciliation
- frontend / UI contract correction

Do not split them again.

The current problem is not “missing term labels.”
The current problem is that `Teaching Load` still presents contradictory truths:

- saved assignment coverage still says `892 / 962`
- integrity diagnostics still show `70` stale `Teacher X` `SCI_ES` rows
- staffing / auto-fill now says those same `70` rows are recoverable by real faculty with `0` shortage
- selected-teacher status and cap visuals still use inconsistent load bases
- manual assignment preview is still not truly aligned to the peak-term rotational rule

This pass must make `Teaching Load` operationally truthful.

## Out of Scope

Do not:

- redesign the whole page again
- reopen general outage work
- rewrite unrelated `Sections` or `Subjects` UX
- add a new rotational load model
- treat `Teacher X` as normal staffing success

## Required Context

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

## Confirmed Current Problems

### 1. Saved coverage truth and staffing truth still disagree

Live state now is:

- saved coverage totals:
  - `assignedPairs = 892`
  - `unassignedPairs = 70`
  - `rawAssignedPairs = 962`
  - `rawUnassignedPairs = 0`
- integrity:
  - `staleOwnershipRowCount = 70`
  - `staleOwnedCurrentYearPairCount = 70`
  - stale rows still point to `SCI_ES, Teacher X`
- staffing / auto-fill truth:
  - `REAL_FACULTY_STANDARD.shortageRows = 0`
  - `REAL_FACULTY_STANDARD.rowsClosedByRealFaculty = 70`
  - `REAL_FACULTY_THEN_TEACHER_X.rowsClosedByTeacherX = 0`

That means the corrected term-aware model says the remaining Science gap is recoverable by real faculty, but the persisted ownership state has not caught up.

### 2. Load status still uses the wrong basis

The UI currently shows:

- main headline number = `creditedTotalHours`

but derives status from:

- `actualTeachingHours`

That causes policy-visible contradictions such as:

- `27.3h teaching + 5h advisory = 32.3h credited`
- still labeled `Below Standard`

That is wrong for scheduler use.

### 3. Cap visuals still use mixed bases

Current selected-teacher strip still mixes:

- headline number from credited hours
- status from teaching-only hours
- cap bar width from teaching-only hours
- cap label percentage from credited hours

All cap/status signals must use one consistent policy-truth basis.

### 4. Manual assignment preview is still not fully peak-term-aware

The backend peak-term rule is now correct:

- rotational `SCIENCE` / `TLE_ROTATION` family weekly load = heaviest single term
- year-round load stacks normally

But `SubjectRow` still treats `No increase` too narrowly and the hover preview still adds incoming minutes too simplistically.

This means the scheduler can still see false weekly growth cues when assigning a rotational subject that should fit under an existing heavier peak term.

### 5. Staffing source warning is still false

Live runtime context is:

- `source = enrollpro-verified`
- `upstream.reachable = true`

But staffing still returns:

- `Staffing report is running on ATLAS-cached section data because EnrollPro is currently unavailable.`

That wording is wrong.
It may still be using ATLAS-cached section data by design, but it must not claim EnrollPro is unavailable when runtime says it is back.

## Required Outcomes

### A. Reconcile saved ownership state with corrected staffing truth

You must determine and implement the correct operational behavior.

Acceptable end states are:

1. If the corrected staffing model is meant to represent recoverable real-faculty closure that should be persistable now:
   - provide a real-faculty recovery apply path that persists the `70` recoverable Science rows
   - clear the stale placeholder-owned `SCI_ES` rows
   - update summary / coverage / integrity so saved truth catches up

2. If the corrected staffing model is only advisory and should not auto-close saved ownership:
   - then revise staffing truth and auto-fill truth so they no longer report `0 shortage` as if closure already exists

You must not leave the current contradiction in place.

Preferred outcome:

- recover and persist the real-faculty closure if the current corrected capacity model is actionable

### B. Make policy status use credited load

For `Teaching Load` status:

- `Below Standard`
- `Compliant`
- `Overload Allowed`
- `Over Cap`

must be derived from the final policy-credited load, not teaching-only load.

Use the same credited basis for:

- status badge
- cap percentage
- cap bar fill
- remaining load label

Do not leave mixed signal sources in the selected-teacher strip.

### C. Fix peak-term-aware assignment delta preview

The frontend must use the true rotational concurrency rule when previewing manual assignment impact.

Required behavior:

- if a new rotational assignment falls inside a non-peak term and does not exceed the current peak term for that family, show:
  - `No weekly increase`
  - or equivalent plain scheduler wording
- if it raises the family’s peak term, show the real incremental weekly increase
- if it is year-round or non-rotational, stack normally

This must affect:

- row-level “Adds load / No increase” language
- hover delta / preview math
- selected-teacher temporary projected load cues

Do not rely on the old same-section-only heuristic.

### D. Fix staffing source-state honesty

If the staffing controls are intentionally using cached or mirror-backed section data while EnrollPro is up, the message must say that truthfully.

Allowed wording shape:

- `Using saved ATLAS section data while EnrollPro connection is active.`

Forbidden wording shape:

- claiming EnrollPro is unavailable when runtime says it is reachable

### E. Keep the current term-aware visibility

Do not regress:

- `Term 1 / Term 2 / Term 3`
- teacher `rotationTermBreakdown`
- section-first term metadata
- rotational-family peak-term contract

### F. Keep the UI compact, but correct the trust contract

This pass owns frontend fixes too, but it is not another redesign pass.

Required:

- fix the incorrect status/progress logic
- fix the incorrect manual preview logic
- keep the selected-teacher strip readable
- do not add another dense explanation block

If you need to lightly adjust labels or small layout affordances to support the truth fix, do it.
But keep the existing compact workspace architecture.

## Implementation Directives

### 1. Backend reconciliation

Inspect and correct the interaction among:

- summary coverage totals
- integrity diagnostics
- staffing truth
- auto-fill preview/apply
- stale placeholder ownership cleanup
- real-faculty recovery application

If a real-faculty recovery apply route already exists and is sufficient, use it or strengthen it.
Do not invent a second overlapping closure mechanism unless necessary.

### 2. Frontend selected-teacher load model

Refactor the `Teaching Load` selected-teacher summary so all primary signals derive from the same policy-truth value.

Required:

- headline weekly load = credited total
- status = credited total
- cap bar = credited total
- cap percentage = credited total
- remaining load = credited total against policy cap

If actual classroom time still needs to be shown, keep it secondary.

### 3. Frontend assignment delta model

Use the backend-exposed term-aware rotational data to determine:

- whether a new row increases weekly load
- by how many minutes/hours

Do not keep a frontend-only shortcut that ignores current family peak-term state.

### 4. Summary and modal honesty

If `Teacher X` is no longer needed under the corrected model, the UI must not imply otherwise.

If saved ownership still lags until reconciliation is applied, the UI must distinguish:

- current saved assignments
- recoverable real-faculty closure

Do not collapse those concepts into one number unless they actually match.

## Documentation Requirements

Update in the same pass if contract language changes:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `ATLAS-PUBLIC-API.md`
- `api/ATLAS-PUBLIC-API.md`
- any relevant teaching-load integration doc if payload or meaning changes

At minimum, if you change whether staffing truth is advisory vs persistable, document it.

## Verification Requirements

### Local

Run at minimum:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run test:faculty-assignment-pass5`

Add or update regression coverage if needed for:

- credited-load-based status derivation
- peak-term-aware delta calculation
- saved-truth vs staffing-truth reconciliation path

### Tailnet

You must verify on Tailnet:

1. `GET /faculty-assignments/summary?schoolId=1&schoolYearId=55`
2. `GET /faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
3. `POST /faculty-assignments/report/staffing-needs`
4. `POST /faculty-assignments/auto-fill` preview
5. at least one Science teacher with rotational assignments
6. selected-teacher strip now shows consistent status / cap logic
7. row-level manual assignment preview now matches peak-term truth

### Required live truth after pass

One of these must be true, and you must say which:

- `saved coverage now matches staffing truth`
- or `staffing truth was revised to match non-persisted saved state`

Do not leave them drifting.

## Evidence Log Requirement

Append a new entry to `docs/verification/evidence-log.md` titled exactly:

- `# 2026-05-27 - Phase 3 Teaching Load Saved-Truth and Peak-Term UI Reconciliation One-Shot`

The evidence must include:

- before/after coverage totals
- before/after integrity diagnostics
- before/after staffing truth
- before/after `SCI_ES` live state
- before/after selected-teacher status logic
- proof that manual rotational assignment preview is now peak-term-aware
- whether `Teacher X` still exists in current-year saved ownership after the pass

## GO / NO-GO

This pass is only `GO` if all are true:

- saved coverage truth and staffing truth no longer contradict each other
- credited-load status is correct
- cap visuals use the same load basis as the main headline
- manual assignment delta logic follows the real peak-term rotational rule
- staffing source-state wording is honest with EnrollPro back online
- local build/test gates pass
- Tailnet evidence is appended and actually proves the fix
