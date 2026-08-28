# Antigravity External Review Prompt — Timetable Default Layout Iteration E

## Objective

Validate Iteration E of the timetable default-layout redesign on the live Tailnet environment: `https://njgrm.buru-degree.ts.net`.

Iteration E is expected to make the timetable open in a genuinely simplified default shell, not the old three-panel cockpit.

## Required context

- Login as Admin: `1000001` / `AdminSY2026!`.
- Target route: `/timetable`.
- Use browser Playwright interaction, not only grep.
- Test desktop, mobile portrait, and mobile landscape.

## Expected behavior

1. `/timetable` defaults to Simple view on a fresh session.
2. The old persistent task guide is not visible in Simple view.
3. The grid is the primary visual object immediately after navigation.
4. Simple view shows:
   - source/status chip
   - readiness chip
   - visible `Filters`
   - visible `Advanced view`
   - one plain next-step prompt
   - one primary action
5. Advanced view remains available through `Advanced view`.
6. Advanced view has a visible `Simple view` control to return without clearing browser storage.
7. No global browser scrollbar or horizontal page overflow appears on any viewport.

## Required commands

Run these from the repository root unless noted:

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts --workers=1
```

## Browser assertions to report

- Header height and timetable table top coordinate per viewport.
- Whether `data-testid="timetable-simple-header"` is visible by default.
- Whether `data-testid="timetable-task-guide"` is absent in Simple view.
- Whether `data-testid="timetable-layout-toggle"` switches both directions.
- Whether any console/page/network errors are app-critical.

## Verdict format

Return:

1. GO / NO-GO
2. Exact failed assertions, if any
3. Browser timing and layout observations
4. Console/page/network errors
5. Whether Iteration E can proceed to Iteration F/G/H validation
