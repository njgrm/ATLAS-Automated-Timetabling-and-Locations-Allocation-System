# Prompt 02 — Publish Blocker Diagnostic Contract

## Goal

Create a stable frontend diagnostic model that explains publish blockers by real cause, not only by generic hard violation code.

## Context

Generated hard violations may all be `UNASSIGNED_SECTION`, but the scheduler needs the actual reason:

- overloaded teachers
- no available slot
- no qualified teacher
- no compatible room
- capacity problems

Those causes may live on `unassignedItems`, `summary.resourceDiagnostics`, or related generated-run payloads.

## Scope

Frontend-first unless code inspection proves that the server does not expose enough data.

Do not change generation behavior.

## Tasks

1. Add a helper module such as:
   - `atlas-client/src/components/timetable/simplePublishReadiness.ts`
2. Build derived groups from available run data:
   - unresolved blocker groups by reason
   - affected subject/grade groups
   - soft warning groups by code
   - total hard blocker count
   - total unresolved count
   - exact user-facing summary text
3. Prefer this source order for unresolved causes:
   1. `unassignedItems[].reason`
   2. `summary.resourceDiagnostics.unassignedBySubjectGrade[].reasons`
   3. hard violation code fallback
4. The helper shall map technical reasons to plain language:
   - `FACULTY_OVERLOADED` → `Teachers are overloaded`
   - `NO_AVAILABLE_SLOT` → `No allowed time slot was found`
   - `NO_QUALIFIED_FACULTY` → `No qualified teacher is assigned`
   - `NO_COMPATIBLE_ROOM` → `No compatible room was found`
   - `ROOM_CAPACITY_EXCEEDED` → `Room capacity is too small`
   - unknown reason → `Needs review`
5. The helper shall produce next actions:
   - overloaded or no qualified teacher → `Open Teaching Load`
   - no available slot → `Place manually`
   - room issues → `Review rooms`
   - unknown → `Review issue`
6. Add unit tests for the helper.

## Required behavior

For the current live pattern:

- `UNASSIGNED_SECTION = 105`
- `FACULTY_OVERLOADED = 70`
- `NO_AVAILABLE_SLOT = 35`

The derived model shall show:

- `105 sessions still need fixing`
- `70 sessions need teacher load repair`
- `35 sessions need a valid time slot`

It shall not collapse everything into only `105 unassigned sections`.

## Acceptance criteria

- The diagnostic model is deterministic.
- Counts are exact and not capped internally.
- GR labels use `GR7`, `GR8`, `GR9`, `GR10`.
- Raw IDs are not used as primary labels.
- Unknown labels use recovery copy, not raw `Unknown Subject (#id)` on the Simple path.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Run any new targeted unit tests added for the helper.

## Report requirements

Return:

- `GO` / `NO-GO`
- files changed
- sample derived diagnostic object for the current live run or fixture
- unit test results
- whether Prompt 03 can proceed
