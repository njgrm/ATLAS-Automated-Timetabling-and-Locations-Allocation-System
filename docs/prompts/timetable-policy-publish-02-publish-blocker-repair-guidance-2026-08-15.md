# Prompt 02 — Publish Blocker Repair Guidance

## Role

You are the ATLAS timetable blocker-guidance implementation agent. Implement only this prompt after Prompt 01 is GO.

## Background

Latest Tailnet run `#424` was completed but blocked from publish:

- `145` hard violations
- all hard violations are unassigned sessions
- blocker groups:
  - `FACULTY_OVERLOADED`: `75`
  - `NO_QUALIFIED_FACULTY`: `40`
  - `NO_AVAILABLE_SLOT`: `30`

The current publish error is technically correct but not enough for non-technical scheduler officers.

## Objective

Turn publish blockers into plain repair guidance that tells the scheduler what to fix next.

## Scope

### In scope

- Publish checklist blocker grouping.
- Plain-language blocker labels.
- Deep links into Teaching Load, unresolved plotting, and policy/setup repair paths.
- Readable section/subject/faculty names in blocker rows.
- Tests for blocked publish guidance.

### Out of scope

- Automatically repairing blockers.
- Changing generation constraints.
- Changing Teaching Load ownership truth.
- Changing publish API rules.

## Required UX behavior

The publish readiness summary shall group blockers like this:

- `Teachers are overloaded`
  - source codes: `FACULTY_OVERLOADED`
  - next step: `Review Teaching Load`
- `No qualified teacher is assigned`
  - source codes: `NO_QUALIFIED_FACULTY`
  - next step: `Assign a qualified teacher`
- `No available time slot`
  - source codes: `NO_AVAILABLE_SLOT`
  - next step: `Review timetable slots or policy`

Each blocker group shall show:

- count;
- plain explanation;
- one primary action;
- optional details drawer.

Each detailed row shall show names, not raw IDs, when lookup data is available:

- grade + section name;
- subject code/name;
- teacher name if assigned;
- reason;
- next action.

If a name cannot resolve after lookup loading, show:

- `Name needs refresh`
- action: `Refresh setup names`
- raw ID only in details/debug surfaces.

## API/data notes

- Use existing timetable violations/unassigned payloads where possible.
- Enrich section labels through current section summary data.
- Do not require a new backend endpoint unless existing data cannot support readable guidance without heavy payloads.
- If adding a lightweight endpoint is necessary, keep it read-only and scoped under `/api/v1/generation`.

## Test requirements

Add/update browser tests proving:

- blocked Simple publish shows grouped blocker counts;
- blocker group labels are plain language;
- no visible blocker row shows only raw section/subject/faculty IDs after lookups finish;
- each blocker group has one obvious next action;
- clicking `Teachers are overloaded` reaches Teaching Load review;
- clicking `No qualified teacher is assigned` reaches Teaching Load or subject coverage repair;
- clicking `No available time slot` reaches timetable unresolved/policy review;
- no global scrollbar, horizontal overflow, or overlapping text.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Live blocker groups before/after
4. Browser evidence
5. Any unresolved raw-label surfaces

