# Prompt 04 — Simple Blocker Repair Routing and Filtered Fix Paths

## Goal

Make every blocker group in Simple mode route to the correct repair path.

## Context

Showing blocker causes is not enough. The scheduler needs one obvious action per cause.

## Scope

Frontend UX routing and local filter state. Do not change generation logic.

## Tasks

1. Wire blocker-group primary actions:
   - `FACULTY_OVERLOADED` → `/teaching-load` or Teaching Load guided repair entry
   - `NO_QUALIFIED_FACULTY` → `/teaching-load`
   - `NO_AVAILABLE_SLOT` → open Simple placement tray filtered to `NO_AVAILABLE_SLOT`
   - `NO_COMPATIBLE_ROOM` → `/campus-rooms`
   - `ROOM_CAPACITY_EXCEEDED` → `/campus-rooms`
2. If opening the Simple placement tray from the readiness sheet:
   - set task to `place-unresolved`
   - apply the relevant reason filter
   - preserve the selected run
   - close the readiness sheet
3. Add or reuse test IDs:
   - `simple-plotting-reason-filter`
   - `timetable-simple-blocker-next-action`
   - `timetable-simple-blocker-teaching-load-action`
   - `timetable-simple-blocker-placement-action`
4. Make sure the action labels are plain:
   - `Open Teaching Load`
   - `Place manually`
   - `Review rooms`
   - `Review issue`

## Acceptance criteria

- Every visible blocker group has exactly one primary action.
- Teacher-load blockers do not send users to a generic diagnostics wall.
- Slot blockers open a filtered Simple placement path.
- Room blockers point to room setup/readiness.
- The user does not need Advanced mode to start fixing blockers.
- Existing Advanced diagnostics still remain available under More / Expert tools.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- action routing table
- proof that `NO_AVAILABLE_SLOT` opens filtered placement
- proof that `FACULTY_OVERLOADED` opens Teaching Load path
- whether Prompt 05 can proceed
