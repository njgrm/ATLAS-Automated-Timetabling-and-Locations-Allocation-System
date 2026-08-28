# Antigravity Validation Prompt: ATLAS Timetable Simplification Overhaul Iteration B

Target environment: `https://njgrm.buru-degree.ts.net`

Login: Admin `1000001` / `AdminSY2026!`

## Purpose

Independently verify Codex's Iteration B work before Iteration C begins. This pass must use browser Playwright interaction against the live Tailnet environment, not source inspection alone.

Iteration B is specifically about repairing generated placement and swap contracts:

- generated unassigned items must be placeable by click and drag when they already have a Teaching Load owner, even if the generated item lacks `homeRoomId`;
- placement review must not ask the scheduler to choose a teacher;
- generated drag must resolve the grid cell beneath the dragged card;
- generated occupied-slot swaps must use the modern visual swap review;
- failed commits must not produce false success UI.

## Required commands

Run these from the repository root unless otherwise noted.

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build

cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1
```

## Browser checks to perform manually or with additional Playwright probes

Use desktop, mobile portrait, and mobile landscape viewports.

1. Navigate to `/login`, authenticate as Admin, then navigate to `/timetable`.
2. Confirm the timetable loads without app-critical console/page/network errors.
3. Open the generated unassigned list.
4. Find an unassigned item that has a Teaching Load owner but no home room.
5. Confirm the item can expose `Place session`.
6. Click `Place session`.
7. Confirm grid-wide guidance appears.
8. Click a highlighted timetable cell.
9. Confirm a dialog with `data-testid="generated-placement-review-dialog"` appears.
10. Confirm the dialog title/copy includes `Review generated placement`.
11. Confirm the dialog includes `Teaching Load owner`.
12. Confirm the dialog includes `Room source`.
13. Confirm the dialog does not contain:
    - `Assign teacher and room`
    - `Choose teacher`
    - `Choose room`
    - `Apply repair`
14. Repeat the placement path by dragging the generated unassigned card onto the grid.
15. Confirm the drag path opens the same generated placement review without committing live writes.
16. Select an occupied generated timetable session and attempt an occupied-slot swap.
17. Confirm the modern swap review appears with:
    - `Review occupied-slot swap`
    - `Swap sessions`
    - blocking/warning figures or equivalent visual conflict summary.
18. Confirm no obsolete manual teacher/room assignment modal appears in either generated placement or generated swap paths.

## Destructive-write guard

Do not commit real timetable changes during validation unless explicitly approved. If you write additional Playwright probes, block non-preview writes under `/api/v1/generation/**` and report any blocked attempted write URLs.

## Expected Codex evidence to verify

Codex reports:

- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npm run test:ux-guardrails`: PASS `26/26`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- Combined Playwright matrix: PASS `30/30` across desktop, mobile portrait, and mobile landscape.

## Report format

Return:

1. `GO` or `NO-GO`.
2. Exact failures/regressions, if any.
3. Browser timing observations for first visible table and first placement action.
4. Console/page/network errors, if any.
5. Whether click-to-place generated unassigned works.
6. Whether drag-to-place generated unassigned works.
7. Whether generated occupied-slot swap uses the modern review.
8. Whether obsolete teacher/room assignment text is absent from timetable placement/swap paths.
9. Any suspected implementation pattern Codex should correct before Iteration C.
