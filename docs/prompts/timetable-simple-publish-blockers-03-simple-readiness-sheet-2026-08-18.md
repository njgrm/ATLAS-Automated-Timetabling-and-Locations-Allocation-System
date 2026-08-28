# Prompt 03 — Simple Publish Readiness Sheet

## Goal

Add a Simple-mode sheet that answers why the schedule cannot publish and what the scheduler should do next.

## Context

The existing Simple header has a blocked Publish button and a compact readiness summary, but the path is not actionable enough. Disabled controls and truncated text do not work for older non-technical schedulers.

## Scope

UI behavior only. Reuse the diagnostic model from Prompt 02.

## Tasks

1. Add a Simple publish readiness sheet or drawer.
2. Open it from:
   - blocked Publish state
   - `Review issues`
   - publish readiness summary
   - any visible `Why can't I publish?` action
3. Do not require switching to Advanced mode.
4. Keep the sheet visually simple:
   - top summary card
   - blocker groups
   - warnings section
   - sticky footer actions
5. Add stable test IDs:
   - `timetable-simple-publish-readiness-sheet`
   - `timetable-simple-publish-blocker-summary`
   - `timetable-simple-blocker-group`
   - `timetable-simple-warning-group`
   - `timetable-simple-why-cannot-publish`

## Required copy pattern

When hard blockers exist:

```text
Cannot publish yet
105 sessions still need fixing before this schedule can be published.
Fix blockers first. Warnings can be reviewed after blockers are clear.
```

When only warnings exist:

```text
Ready except for warnings
No hard blockers remain. Review the warnings, then publish if the schedule is acceptable.
```

When clean:

```text
Ready to publish
No hard blockers or unresolved sessions remain.
```

## Interaction requirements

- A disabled Publish control shall have a nearby enabled explanation action.
- The explanation action shall be reachable by keyboard.
- The sheet shall restore focus to the opener after close.
- The sheet shall fit mobile landscape without horizontal overflow.
- The sheet shall not show more than four major visual sections at once.

## Acceptance criteria

- In Simple mode, users can open the publish-readiness sheet within one interaction from the blocked publish state.
- Exact unresolved count is visible.
- Exact hard blocker count is visible.
- Warnings are visible but visually secondary.
- No raw ID-only hard violation text appears in the sheet.
- The sheet uses `@/ui/*` primitives and does not use raw `title` or raw `<details>`.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- screenshots for desktop, mobile portrait, mobile landscape
- before/after blocked publish behavior
- exact counts shown in sheet
- whether Prompt 04 can proceed
