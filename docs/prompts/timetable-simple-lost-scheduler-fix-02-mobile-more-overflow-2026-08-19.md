# Prompt 02 — Fix Mobile-Landscape More Trigger Overflow

## Goal

Fix the mobile-landscape Simple timetable More trigger overflow and update the test so this can no longer be logged as a pass.

## Verified issue

QA ran:

```powershell
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
```

The spec passed 108/108, but logged this three times:

```text
[BASELINE] More trigger overflows viewport on mobile-landscape: right=978.90625/844 bottom=92/390
```

This means the test is currently tolerating a visible overflow condition instead of failing it.

## Target files

Primary:

- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`

Tests:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts`

## Tasks

1. Identify why the More trigger bounding box is outside the mobile-landscape viewport.
2. Fix the layout so the visible More trigger remains inside the viewport at `844x390`.
3. If multiple `timetable-simple-more-trigger` elements exist due responsive rendering, ensure hidden/non-visible instances are not included in viewport assertions.
4. The visible More trigger shall be:
   - inside viewport horizontally;
   - inside viewport vertically;
   - pointer-clickable;
   - keyboard-focusable.
5. Update the lost-scheduler spec:
   - fail if a visible More trigger has `right > viewport.width`;
   - fail if a visible More trigger has `left < 0`;
   - fail if a visible More trigger has `bottom > viewport.height`;
   - ignore hidden elements only after proving they are not visible.
6. Do not solve this by hiding More on mobile landscape.
7. Do not create global horizontal overflow.

## Acceptance criteria

- Mobile landscape shows a usable More trigger.
- The More menu opens from mobile landscape.
- The trigger's visible bounding box is inside the viewport.
- The test fails on real visible overflow instead of logging and passing.
- No global vertical scrollbar or horizontal page overflow is introduced.

## Verification commands

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- root cause of overflow
- before/after bounding boxes for mobile landscape
- files changed
- exact commands and results
- remaining caveats
