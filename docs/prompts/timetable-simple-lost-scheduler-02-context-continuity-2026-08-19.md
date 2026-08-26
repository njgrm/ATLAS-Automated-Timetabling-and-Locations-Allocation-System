# Prompt 02 — Simple Timetable Context Continuity

## Goal

Make every Simple timetable workflow show where the scheduler is, why they are there, and how to safely go back.

## Context

The publish-blocker sheet can now route users into repair paths, but the destination surface can feel disconnected. Example: clicking a `No available slot` repair action opens the plotting tray, but the tray mostly says generic placement text. The scheduler needs a visible breadcrumb and recovery path.

## Target files

Primary candidates:

- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`

The executor may touch nearby timetable files only if required to pass context state cleanly.

## Tasks

1. Add a Simple workflow context model for visible guidance states:
   - `publish-blockers`;
   - `place-unresolved`;
   - `no-slot-repair`;
   - `teaching-load-repair`;
   - `room-repair`;
   - `swap-sessions`;
   - `draft-planning`;
   - `teacher-departure`;
   - `review-issues`.
2. When the user routes from the publish-blocker sheet into a repair path, preserve the origin context.
3. Show a compact context strip at the top of the destination workflow:
   - `Fixing publish blockers → No available slot`;
   - count if known;
   - one-sentence explanation;
   - `Back to blocker summary`;
   - `Clear filter` where applicable.
4. The context strip must be visible in the plotting tray and any Simple repair drawer/sheet opened from publish blockers.
5. Closing a sheet or drawer must not leave stale repair context behind.
6. Navigating away from `/timetable` must clear local-only Simple repair context unless the workflow is intentionally persisted.

## UX requirements

- Keep the strip compact: one line on desktop when possible, two lines maximum on mobile.
- Use plain scheduler language.
- Do not show raw enum names like `NO_AVAILABLE_SLOT` in visible copy.
- Use shadcn/Radix primitives.
- Do not use raw buttons.
- Do not introduce global scrollbars.

## Acceptance criteria

- From the publish-blocker sheet, clicking a repair action opens a destination surface that names the blocker being fixed.
- The destination surface includes a visible way back to the blocker summary.
- Clearing the filter returns the tray to the normal unresolved queue.
- Closing and reopening the tray does not show stale blocker context unless the same repair filter remains active.
- Mobile portrait and mobile landscape show the context without horizontal overflow or text overlap.

## Required tests

Update or add:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts`

Assertions:

- publish blocker repair action preserves context;
- `Back to blocker summary` reopens the readiness sheet;
- `Clear filter` removes the repair filter;
- no raw enum text is visible;
- no global scrollbar or horizontal overflow.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- before/after screenshots
- context states implemented
- files changed
- exact commands and results
- remaining caveats
