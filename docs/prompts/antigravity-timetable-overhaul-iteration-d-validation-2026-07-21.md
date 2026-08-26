# Antigravity Prompt: Timetable Overhaul Iteration D External Validation

You are independently validating Codex's Timetable Simplification Overhaul Iteration D work on the live Tailnet environment.

Target: `https://njgrm.buru-degree.ts.net`

Credentials:

- Admin: `1000001` / `AdminSY2026!`

## Context

Iterations A-C are expected to be preserved:

- Iteration A: runtime/source truth is visible; generated unassigned items no longer make false placement claims; generated occupied-slot swaps say `Swap sessions`.
- Iteration B: generated unassigned click-to-place and drag-to-place open modern generated placement review without premature commit; teacher ownership remains sourced from Teaching Load.
- Iteration C: `/sections`, `/subjects`, `/faculty`, `/teaching-load`, and `/timetable` use compact no-scroll headers/shells with useful content visible early.

Iteration D adds:

- one shared review/action-sheet pattern for generated placement, generated swap, draft placement, and draft swap;
- a direct visible timetable selection strip with `Move timeslot` and `Details`;
- pointer-drag grid-wide `Can place`, `Can swap`, `Blocked`, and `Warning` guidance without a React commit storm;
- corrected performance harness behavior for keyboard and touch placement.

## Correction addendum after prior NO-GO

Codex has applied a correction after the prior Antigravity NO-GO. Please explicitly re-check these known failure points:

- Mobile portrait performance scenario 14 previously failed because `pointer_drag.json` recorded `maxCellsPerCommitBatch=3`; the corrected run must stay `<= 2`.
- Mobile compact panels previously logged invalid layout totals and missing resize-handle warnings; report whether either warning still appears.
- Mobile landscape draft placement previously left the left rail too wide after selecting a draft queue item; verify that selecting a draft queue item makes the grid reachable and that tapping a slot opens `Review draft placement`.
- Latest Codex evidence before your rerun: `qa-artifacts/perf-runs/run-2026-07-21T05-30-34-633Z/pointer_drag.json` reports `maxCellsPerCommitBatch=2`, about `60.10 FPS`, no long tasks, and zero header/left/right commits.

## Required commands

Run these from the workspace:

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
```

Then run the browser matrix from `D:\ATLAS`:

```powershell
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1
```

Run the performance matrix:

```powershell
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

If Tailnet instability causes a trace/network-copy failure, rerun the failed profile once. Do not mark GO if any app-level assertion still fails after retry.

## Required browser checks

Use Playwright browser interaction, not only grep:

1. Login as Admin and navigate to `/timetable`.
2. Confirm no global browser scrollbar exists on desktop, mobile portrait, or mobile landscape.
3. Confirm first useful timetable action is visible within 5 seconds.
4. Select an occupied session and confirm the bottom selection strip appears with:
   - selected session details,
   - `Move timeslot`,
   - `Details`.
5. Click `Move timeslot` and confirm grid cells expose plain slot labels for keyboard/click placement.
6. Drag a generated unassigned item and confirm grid-wide guidance appears without needing to hover each cell:
   - `Can place`,
   - `Can swap`,
   - `Blocked` or `Warning` when applicable,
   - `Occupied` where applicable.
7. Confirm generated unassigned click-to-place opens `Review generated placement`.
8. Confirm generated unassigned drag-to-place opens the same review and does not commit on drop.
9. Confirm generated occupied-slot swap opens the unified review action sheet and the primary action says `Swap sessions`.
10. Enter the pre-generation draft workspace and confirm draft placement opens the unified review action sheet.
11. Confirm draft occupied-slot swap uses the unified action-sheet pattern and the primary action says `Swap sessions`.
12. Confirm obsolete timetable-owned assignment language is absent from placement/swap modals:
    - `Assign teacher and room`,
    - `Choose teacher`,
    - `Choose room`.
13. Confirm the review sheets use plain sections such as `What changes`, `Blocks`, `Warnings`, and `After save`.
14. Confirm pointer drag performance reports pass the mandatory gate:
    - no long task over 50ms,
    - no header/left/right panel commits during drag crossing,
    - no grid-cell crossing batch over 2 cells,
    - drag start/end commit <= 16ms.

## Report format

Return:

1. Verdict: `GO` or `NO-GO`.
2. Exact command results.
3. Browser timing observations.
4. Console/page/network errors, separating Tailnet resource aborts from app errors.
5. Whether generated placement, generated swap, draft placement, and draft swap all use the unified review action sheet.
6. Whether grid-wide guidance remains visible during drag without lag.
7. Whether any obsolete teacher/room assignment modal language remains.
8. Screenshots or artifact paths for any failure.
9. Blockers in priority order with exact reproduction steps.
