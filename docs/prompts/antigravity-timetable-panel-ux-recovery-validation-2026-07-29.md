# Antigravity Validation Prompt: Timetable Panel UX Recovery

Target environment: `https://njgrm.buru-degree.ts.net`

Validate the timetable panel recovery work with Playwright browser interaction, not only static checks.

## Required Reading

- `.github/instructions/frontend.instructions.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/context7-library-map.md`

## Required Commands

Run from `atlas-client` unless noted:

1. `npx tsc --noEmit`
2. `npm run test:ux-guardrails`
3. `npm run test:timetable-conflict`
4. `npm run build`
5. From repo root: `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-panel-ux-recovery.spec.ts --workers=1`

## Browser Scenarios

Use desktop, mobile portrait, and mobile landscape projects.

1. Login as Admin (`1000001` / `AdminSY2026!`) and open `/timetable`.
2. Confirm Simple view remains the default.
3. Switch to Advanced view.
4. Capture screenshots for:
   - simple view initial state;
   - advanced view initial state;
   - left rail at minimum width;
   - right panel at minimum width;
   - policy pane;
   - unresolved sessions list in collapsed and detail states.
5. Verify no text overlap, no horizontal page overflow, and no global browser scrollbar.
6. Open the unresolved/unassigned panel and verify:
   - search is visible and focusable;
   - quick filters are visible;
   - result count is visible;
   - list scrolls inside the panel;
   - collapsed rows expose safe plain-language actions.
7. Verify generated placement and generated swap still open modern review sheets without committing until explicit save/swap.
8. Enter planning/pre-generation mode and verify draft placement/swap review still opens.
9. Open Policy and verify:
   - policy status chip appears;
   - copy distinguishes next-generation impact from immediate preview/manual-placement impact;
   - reduced panel widths do not cause overlapping text.

## Policy Reversible Fixture Check

If a reversible fixture is available, temporarily alter a harmless policy setting, validate both generated/manual preview and pre-generation preview still read the current policy, then revert the policy. If no reversible fixture is safely available, report `NO-GO for policy reversible proof` while still reporting UI results.

## Report Format

Return:

1. `GO` / `NO-GO`
2. Exact command results
3. Browser timing observations
4. Console/page/network errors
5. Screenshot/artifact paths
6. Policy proof result
7. Remaining blockers with exact repro steps
