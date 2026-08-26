# Antigravity External Review Prompt — Timetable Default Layout Iteration G

## Objective

Validate Iteration G of the timetable default-layout redesign on `https://njgrm.buru-degree.ts.net`.

Iteration G is expected to improve older-user visual comfort without removing essential timetable feedback.

## Required context

- Login as Admin: `1000001` / `AdminSY2026!`.
- Target route: `/timetable`.
- Use browser Playwright, including at least one drag and one click-selection path.

## Expected behavior

1. Timetable cells remain readable in Simple view.
2. Section view cells no longer show unnecessary teacher initials by default; room information remains visible.
3. Primary Simple-mode controls are large enough for older users and touch users.
4. The next-step prompt is announced through an `aria-live` status region.
5. Grid-wide guidance still appears during selected-source and drag-source workflows:
   - `Can place`
   - `Can swap`
   - `Blocked`
   - `Warning`
   - `Occupied`
6. Drag performance remains smooth and does not reintroduce header/rail/right-panel commit storms.
7. No global page scrollbar is introduced.

## Required commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Browser assertions to report

- First visible timetable action timing per viewport.
- Drag FPS, long-task count, and React commit containment result.
- Whether grid-wide labels are visible without hover-only discovery.
- Whether the visual density is meaningfully lower than the old cockpit.

## Verdict format

Return:

1. GO / NO-GO
2. Exact failures, if any
3. Performance summary
4. UX score from 1-10 for older non-technical users, with concrete reasons
