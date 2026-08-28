# Prompt 04 — Mobile Lifecycle Controls and Header Fit

## Goal

Ensure mobile Simple timetable exposes the same lifecycle clarity as desktop without bloating the header.

## Context

Source inspection shows `Generate` and `Publish` are hidden below the `sm` breakpoint in the Simple header. That can leave mobile users without an obvious lifecycle action, even though mobile is a supported scheduler viewport. The page needs one visible lifecycle action that changes based on state.

## Target files

Primary candidates:

- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`

## Tasks

1. Add one compact mobile-visible lifecycle action in the Simple header.
2. The action label shall be state-based:
   - no generated run: `Generate`;
   - generation blocked: `Review setup`;
   - hard blockers/unresolved sessions exist: `Fix blockers`;
   - no hard blockers/unresolved sessions and warnings exist: `Review warnings`;
   - ready to publish: `Publish`;
   - published: `Published`.
3. Desktop may keep separate Generate and Publish buttons if current layout remains clean.
4. Mobile shall not rely on More for the primary lifecycle action.
5. If the lifecycle action is disabled, show an adjacent tooltip/popover or visible short reason.
6. Maintain schedule switcher access on mobile.
7. Keep header height targets practical:
   - mobile portrait target: `<= 128px` unless hidden-row controls are visible;
   - mobile landscape target: `<= 96px` unless hidden-row controls are visible.
8. If hidden-row controls add height, ensure workspace remains usable and no controls overlap.

## UX requirements

- Header visible controls on mobile should remain limited:
  - schedule switcher;
  - Help/Tutorial;
  - lifecycle action;
  - More.
- Do not show both `Generate` and `Publish` as competing mobile buttons.
- The lifecycle action must route to the correct existing workflow.
- Do not introduce raw native controls.

## Acceptance criteria

- Mobile portrait shows one obvious lifecycle action.
- Mobile landscape shows one obvious lifecycle action.
- If publish is blocked, tapping the lifecycle action opens the publish-readiness sheet.
- If no run exists, tapping the lifecycle action starts generation or opens the generation blocked guidance.
- If ready, tapping the lifecycle action opens the publish confirmation flow.
- No global scrollbar or horizontal overflow is introduced.
- The More trigger is fully inside the viewport and keyboard reachable.

## Required tests

Update or add:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts`

Assertions:

- mobile lifecycle action exists;
- lifecycle action state matches current run readiness;
- lifecycle action opens the expected sheet/dialog;
- More trigger bounding box is within viewport;
- header has no visible overlap;
- schedule switcher remains reachable within one tap.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- mobile before/after screenshots
- header measurements by viewport
- lifecycle state table
- files changed
- exact commands and results
- remaining caveats
