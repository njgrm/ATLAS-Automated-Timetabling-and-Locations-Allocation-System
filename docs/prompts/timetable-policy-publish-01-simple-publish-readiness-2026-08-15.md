# Prompt 01 — Simple Publish Readiness UX

## Role

You are the ATLAS timetable UX implementation agent. Implement only this prompt. Do not continue to Prompt 02.

## Background

Live Tailnet verification on 2026-08-15 showed that Simple timetable mode exposes `Generate` and `More`, but it does not expose a stable visible `Publish` button. Publish is only selected as the recommended Simple task when the schedule is already clean. This hides a critical lifecycle action from scheduler officers.

The publish API is already correct:

- `POST /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/publish`
- Hard violations return `422 PUBLISH_BLOCKED_HARD_VIOLATIONS`
- Soft warnings require acknowledgement.

## Objective

Make publish discoverable in Simple mode without allowing invalid publish.

## Scope

### In scope

- Simple timetable header publish discoverability.
- Simple publish disabled/blocked feedback.
- Publish checklist entry point.
- Empty/current-run state actions.
- Tests for current Simple mode.

### Out of scope

- Changing publish API rules.
- Changing generation rules.
- Changing Teaching Load ownership.
- Changing policy defaults.
- Implementing workbook export.

## Required UX behavior

- Simple mode shall show a visible `Publish` action whenever a generated run is selected.
- If publish is blocked, the visible action shall remain discoverable but disabled or routed to a checklist.
- The disabled/blocked action shall show a plain reason near the action:
  - `145 sessions still need fixing before publish.`
  - `Resolve hard blockers before publishing.`
- The publish checklist shall show:
  - generated run ID;
  - assigned count;
  - unassigned count;
  - hard blocker count;
  - soft warning count;
  - next action button.
- When no generated run exists, the empty state shall keep both actions visible:
  - `Start Pre-Generation Draft`
  - `Generate when ready`
- The header `Generate` action shall remain visible.
- Publish shall not be hidden only because it is not the recommended next task.

## Implementation constraints

- Use existing `TimetableSimpleHeader.tsx`, `TimetableTaskDrawer.tsx`, and publish dialog plumbing where possible.
- Use shadcn/Radix primitives from `@/ui/*`.
- Do not use raw native buttons/selects.
- Preserve Simple header compactness:
  - desktop header `<= 96px`;
  - mobile portrait header `<= 112px`;
  - mobile landscape header `<= 84px`.
- No global browser scrollbar.
- No horizontal overflow.
- No text overlap.

## Test requirements

Add or update Playwright coverage proving:

- Simple mode shows `Generate`.
- Simple mode shows `Publish` when a generated run exists.
- Blocked publish explains the blocker count.
- Clicking blocked publish opens or focuses the publish checklist / review issues path.
- Advanced mode publish behavior still works.
- No obsolete teacher/room assignment modal appears.

Use stable test IDs if missing:

- `timetable-simple-publish-action`
- `timetable-publish-readiness-summary`
- `timetable-publish-blocked-reason`
- `timetable-empty-start-draft-action`
- `timetable-empty-generate-action`

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Before/after Simple mode publish path
4. Browser proof on Tailnet
5. Remaining blockers

