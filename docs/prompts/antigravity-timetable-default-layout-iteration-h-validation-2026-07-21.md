# Antigravity External Review Prompt — Timetable Default Layout Iteration H

## Objective

Perform final external validation of the complete Timetable Default Layout Redesign stream on `https://njgrm.buru-degree.ts.net`.

This is a release-style verification across Iterations E, F, and G plus regression checks against the prior timetable workflow fixes.

## Required context

- Login as Admin: `1000001` / `AdminSY2026!`.
- Target route: `/timetable`.
- Test desktop, mobile portrait, and mobile landscape.
- Use real browser interaction through Playwright.

## Expected final behavior

1. Simple view is the default and is visually distinct from the old cockpit.
2. The grid is visible early and remains the main object.
3. Persistent rails are hidden by default.
4. Focused task drawers appear only after task selection.
5. Filters and Advanced view remain discoverable.
6. Users can return from Advanced view to Simple view.
7. Generated unassigned click-to-place works.
8. Generated unassigned drag-to-place works.
9. Generated occupied-slot swap uses the modern visual `Swap sessions` review.
10. Pre-generation draft placement still opens the modern review before save.
11. Teacher assignment is not owned by timetable:
    - no `Assign teacher and room`
    - no `Choose teacher`
    - no `Choose room`
12. Grid-wide guidance remains visible and performant.
13. No global scrollbar or horizontal page overflow appears.
14. Performance Prompt 0/1 gate remains passing.

## Required commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Required report

Return:

1. GO / NO-GO
2. Summary of what passed
3. Exact failures or regressions
4. Browser timing observations
5. Console/page/network errors and whether they are app-critical
6. Whether the page is now simple enough for older non-technical scheduler officers
7. Remaining QoL recommendations, if any, grouped into:
   - must fix before release
   - should fix after release
   - optional polish
