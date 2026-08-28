# Copilot Execution Prompt: Phase 3 Teaching Load Zombie Advisory Mapping Fix One-Shot

## Objective

Fix the remaining `Teaching Load` zombie teacher leak caused by a stale adviser mapping from an old school year being treated as current advisory load.

This is narrower than the earlier generic null-department stale-roster prompt.

## Live Finding To Treat As Proven

Current live and DB investigation confirms the remaining problematic row is:

- `FacultyMirror.id = 11414`
- `employeeId = 3179586`
- `name = DIEGO AQUINO`
- `department = null`
- `isStale = false`
- `isActiveForScheduling = true`
- `subjectCount = 0`
- `sectionCount = 0`
- `assignments = []`
- `advisoryHours = 5`

This teacher does **not** currently own any:

- `FacultySubject` rows
- `SubjectSectionOwnership` rows

The row survives in `Teaching Load` only because of this legacy adviser mapping:

- `advisedSectionId = 1407`
- `advisedSectionName = BEC 8-3. MAKAKALIKASAN`

And that section is not part of the active school year roster.

DB verification shows `externalId = 1407` exists only in older school years, not in active `schoolYearId = 55`.

So this is **not** a current-year assigned teacher.
It is a legacy advisory mapping leak.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/hg-advisory.service.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`

## Scope

### In Scope

- stop non-active-school-year adviser mappings from producing current `Teaching Load` advisory credit or roster presence
- keep current-year legitimate advisers working
- preserve diagnostics or warnings for broken legacy adviser mappings

### Out of Scope

- broad faculty sync redesign
- broad roster quarantine rewrite
- Teaching Load UX cleanup
- staffing math changes
- deleting records automatically without guardrails

## Required Behavior

### 1. Advisory credit must be current-year valid

For `Teaching Load` summary and related roster output, advisory credit must only count if the adviser mapping points to a section that belongs to the active school year scope being summarized.

If the mapped `advisedSectionId` does not belong to the active school-year section universe:

- do not count advisory hours toward live teaching load
- do not let that stale adviser mapping keep the row alive as a scheduler-facing active teacher in the roster if the teacher has no current-year assignment footprint

### 2. HG advisory sync must stop reinforcing dead mappings

Review `syncAdvisoryHgAssignments(...)` and any related HG/adviser logic.

The system must not keep generating or preserving current advisory semantics from adviser mappings that do not resolve to the active school-year section roster.

### 3. Preserve diagnostics

Do not silently erase the evidence.

If a faculty row has an adviser mapping that points outside the active year:

- surface it as an integrity issue or warning
- keep it inspectable
- but do not present it as real live current-year load

### 4. Keep legitimate advisers safe

Do not break valid current-year adviser behavior.

A teacher who truly advises an active current-year section must still:

- receive advisory credit
- receive HG system-assigned handling where appropriate
- remain visible in scheduler-facing Teaching Load

## Implementation Direction

- prefer fixing this at the backend summary/service truth layer
- validate adviser mappings against active current-year section scope before counting them
- if needed, introduce a narrow predicate like:
  - `hasCurrentYearAdvisoryScope`
- only quarantine advisory-only zombie rows when they have:
  - no current-year subject ownership
  - no current-year section ownership
  - no valid active-year adviser mapping

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- verify `DIEGO AQUINO (3179586)` no longer appears as a current scheduler-facing teacher in live `Teaching Load`
- verify his legacy adviser mapping is still diagnosable as invalid or out-of-scope
- verify legitimate current-year advisers still appear and still receive advisory credit
- verify no real assignment-bearing teacher was wrongly hidden
- verify live Tailnet result, not build-only

## Required Output

Return:

1. files changed
2. exact active-year adviser validation rule used
3. how invalid adviser mappings are surfaced diagnostically
4. live verification results
5. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the zombie advisory-only teacher no longer appears as live current-year Teaching Load roster
- invalid old adviser mappings no longer inflate current teaching load
- valid active-year advisers still work normally
- integrity visibility for broken adviser mappings is preserved
