# Antigravity External Review Prompt — Timetable Default Layout Iteration F

## Objective

Validate Iteration F of the timetable default-layout redesign on `https://njgrm.buru-degree.ts.net`.

Iteration F is expected to replace always-visible left/right panels in the default experience with focused task drawers that appear only after the user chooses a task.

## Required context

- Login as Admin: `1000001` / `AdminSY2026!`.
- Target route: `/timetable`.
- Use browser Playwright interaction across desktop, mobile portrait, and mobile landscape.

## Expected behavior

1. Simple view does not show persistent left and right rails by default.
2. Clicking the Simple-mode primary action opens `data-testid="timetable-task-drawer"`.
3. The task drawer has:
   - a plain-language task title
   - two clear steps
   - a close button labelled `Close task drawer`
   - scrollable content inside the drawer, not the global page
4. The `More` menu can open:
   - `Place unresolved sessions`
   - `Swap sessions`
   - `Review issues`
   - `Plan before generating`
   - `Generate schedule`
   - `Edit history`
5. `Swap sessions` opens drawer guidance that says:
   - `Choose first class`
   - `Choose class to switch with`
   - `Review the visual swap sheet`
6. Generated placement and generated swap workflows still use the modern review/action-sheet flow.
7. Obsolete wording must remain absent:
   - `Assign teacher and room`
   - `Choose teacher`
   - `Choose room`

## Required commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1
```

## Browser assertions to report

- Drawer visibility and close behavior.
- Drawer local scroll behavior on mobile portrait.
- Generated unassigned click-to-place still reaches review.
- Generated unassigned drag-to-place still reaches review.
- Generated occupied-slot swap still reaches `Swap sessions`.

## Verdict format

Return:

1. GO / NO-GO
2. Exact workflow regressions, if any
3. Browser screenshots or trace paths for failures
4. Whether Iteration F can proceed to Iteration G/H validation
