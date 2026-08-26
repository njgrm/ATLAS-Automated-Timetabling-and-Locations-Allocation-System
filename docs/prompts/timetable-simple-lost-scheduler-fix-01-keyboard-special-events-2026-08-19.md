# Prompt 01 — Fix Keyboard Placement on Special-Event Cells

## Goal

Fix the performance/accessibility failure where keyboard select-then-place cannot focus every timetable target cell.

## Verified failure

QA ran:

```powershell
cd D:\ATLAS\atlas-client
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

Observed failure in all three viewports:

```text
Keyboard placement target cell must be focusable.
Received: null
```

Failing scenario:

```text
7. Keyboard select-then-place
```

Failure artifacts:

- `D:\ATLAS\qa-artifacts\perf-runs\2026-08-19\results\timetable-performance-Time-f6ea0--Keyboard-select-then-place-desktop\test-failed-1.png`
- `D:\ATLAS\qa-artifacts\perf-runs\2026-08-19\results\timetable-performance-Time-f6ea0--Keyboard-select-then-place-mobile-portrait\test-failed-1.png`
- `D:\ATLAS\qa-artifacts\perf-runs\2026-08-19\results\timetable-performance-Time-f6ea0--Keyboard-select-then-place-mobile-landscape\test-failed-1.png`

## Likely root cause

In `atlas-client/src/components/timetable/TimetableGrid.tsx`, normal cells render keyboard placement metadata when `hasKbSource` is active:

- `role="button"`
- `tabIndex={0}`
- `aria-label="Move selected session to ..."`
- `onKeyDown` handler for `Enter` / `Space`

Special-event cells return early and only render:

- `data-day`
- `data-start-time`
- `data-end-time`
- `data-cell-entry-ids`
- visible event text

Because the performance test queries all `td[data-day][data-start-time][data-end-time]`, it can choose a special-event cell. That cell has no `aria-label`, so the test fails.

## Target files

Primary:

- `atlas-client/src/components/timetable/TimetableGrid.tsx`

Tests:

- `qa-artifacts/playwright/specs/timetable-performance.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`

## Tasks

1. Update special-event `td` cells in `TimetableGrid.tsx` so they remain accessible when keyboard placement mode is active.
2. When `hasKbSource` is true, special-event cells shall render:
   - `role="button"`;
   - `tabIndex={0}`;
   - a plain `aria-label`, for example `Blocked slot: Recess on Monday 09:30`;
   - keyboard handling for `Enter` and `Space`.
3. Pressing `Enter` or `Space` on a special-event cell shall not silently do nothing.
4. If the selected placement source cannot be placed into a special-event slot, ATLAS shall show a plain blocked message, for example:
   - `This slot is blocked by Recess. Choose a regular class slot.`
5. Preserve pointer behavior for special-event rows.
6. Preserve drag/click performance containment.
7. Do not remove special-event rows from the grid.

## Acceptance criteria

- Every `td[data-day][data-start-time][data-end-time]` has an `aria-label`.
- While keyboard placement mode is active, every target cell is focusable.
- Special-event cells explain that they are blocked rather than acting as dead cells.
- `timetable-performance.spec.ts` Scenario 7 passes in desktop, mobile portrait, and mobile landscape.
- Downstream performance scenarios 8–14 run instead of being skipped after Scenario 7 failure.

## Verification commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- exact files changed
- before/after explanation of special-event keyboard behavior
- performance matrix result
- artifact paths
- remaining caveats
