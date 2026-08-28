# Active Term Prompt 03 — Timetable Defaults and Guards

## Role

You are the ATLAS timetable executor. Use EnrollPro active term to improve timetable defaults and editing guardrails while preserving full-year review capability.

## Problem

ATLAS generated and published timetable entries already carry `termIndex`, but the UI does not know which term is active from EnrollPro. Officers need current-term focus without losing access to future and historical term review.

## Target files

- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/TimetableToolbar.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- Existing timetable tests under `qa-artifacts/playwright/specs/`
- Existing client unit/guardrail tests where applicable

## Requirements

### Functional requirements

- When active term is available, the timetable shall default the term filter to the matching `termIndex`.
- When active term is unavailable, the timetable shall keep the existing default filter behavior.
- When the user manually selects another term, the timetable shall preserve that selection until the user resets filters or changes school year.
- When the user edits a non-active term, the system shall show a compact warning before commit.
- If an entry lacks `termIndex`, then the system shall keep it visible in all-term review and shall not silently classify it as active term.
- The system shall not mutate persisted timetable entries when EnrollPro active term changes.

### UI requirements

- Show a compact `Active Term` indicator near existing source/readiness state.
- Use the existing filter/menu primitives.
- Keep all-term review reachable.
- Do not add another persistent side panel.

## Implementation guidance

- Normalize EnrollPro `T1/T2/T3` to existing `termIndex` values from Prompt 01.
- Add a clear distinction between:
  - active term default
  - user-selected term filter
  - all terms
- Keep generated-run, draft, and published review behavior consistent.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Live Tailnet probe:

1. Resolve runtime context and active term.
2. Open `/timetable`.
3. Confirm the default term filter matches active term.
4. Switch to another term and confirm the user selection sticks.
5. Trigger a preview path for a non-active term and confirm the warning appears before commit.
6. Confirm all-term review remains reachable.

## Acceptance criteria

- Timetable defaults to the active term only when active term is verified.
- User-selected term filters are not overwritten by background refresh.
- Non-active term edits are warned, not blocked by default.
- All-term review remains available.
- Existing timetable drag/drop and conflict tests still pass.

## Final report required

Report active term, default filter state, manual override behavior, and non-active edit warning proof.
