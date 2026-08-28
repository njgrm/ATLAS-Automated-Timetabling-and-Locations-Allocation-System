# Prompt 11 - Touch Queue And Focus Fixture Repair

## Role

You are the ATLAS executor assigned to close the remaining mobile touch queue, focus/cancel, readiness stability, and fixture drift issues in timetable old-scheduler proof.

This prompt is about making the active release tests deterministic and meaningful. Do not redesign the timetable unless the test exposes a real user-facing defect.

## Required preflight

Before editing:

1. Confirm Prompt 10 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-remaining-issues-sequence-2026-08-28.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
   - `ATLAS_AGENT_KI.md`
3. Inspect:
   - `qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts`
   - `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
   - `atlas-client/src/components/timetable/CenterWorkspace.tsx`
   - `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
4. Check git state.

## Scope

In scope:

- generated unassigned queue selector drift;
- mobile touch queue interaction proof;
- generated placement/swap focus and cancel proof;
- draft planning entry proof;
- readiness sheet open stability in serial and active release bundles;
- fixture-limited classification only when the runtime truly lacks data.

Out of scope:

- generation algorithm changes;
- destructive queue placement commits;
- publish changes;
- broad visual redesign unrelated to the failing proof.

## Required fixes

### 1. Repair generated unassigned queue proof

The current failure is:

```text
[data-virtualized-rail="Unassigned generated sessions"] [data-testid="generated-unassigned-card"] not found
```

Determine whether this is:

- a real UI regression where unassigned generated sessions are not reachable;
- a selector drift where the component renamed the card or rail;
- a fixture limitation where the current selected run has no matching visible generated unassigned queue state.

Fix accordingly:

- If real UI regression, restore a visible old-scheduler queue entry point.
- If selector drift, update the spec to use stable data-testid attributes that exist in source and rendered UI.
- If fixture limitation, create or select a deterministic run with generated unassigned sessions and document the runtime evidence.

Do not pass the test by skipping when the data exists.

### 2. Repair focus/cancel proof

The generated occupied-slot swap focus/cancel proof passed. The draft placement proof timed out on stale `Plan before generating` copy.

Update the proof so it:

- opens the current draft planning entry;
- opens draft placement review if a draft fixture exists;
- confirms cancel returns focus to the prior safe scheduler context;
- marks draft fixture limitation only when no draft queue item exists and records the exact evidence.

### 3. Stabilize readiness sheet proof

The readiness sheet passed in isolation but failed once in a broad bundle.

Fix the test or UI timing so:

- the readiness chip opens the sheet reliably;
- tests wait on the visible sheet region, not incidental text;
- prior dialogs/menus are closed before opening readiness;
- serial active release bundle passes.

### 4. Preserve old-scheduler UX

Every touched surface must still:

- show one clear next action;
- expose visible cancel/back path;
- keep actions visible at `844x390`;
- avoid raw enum-only copy;
- avoid walls of text.

## Required commands

Focused:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --project=desktop --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --project=desktop --workers=1 --reporter=line
```

Active release bundle:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1 --reporter=line
```

Static:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Tailnet proof

Use live Tailnet and capture screenshots or fixture-limited evidence under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\11-touch-queue-and-focus-fixture-repair\
```

Required evidence:

- generated unassigned queue visible and touchable, or deterministic proof it is unavailable;
- selected class focus before and after cancel;
- draft planning entry opened with current copy;
- readiness sheet opens reliably after closing any prior menu/dialog;
- no root overflow on `1366x768`, `390x844`, and `844x390`.

## Internal gate before Prompt 12

Prompt 11 is GO only when:

- focused specs pass serially;
- active release bundle passes serially;
- no fixture-limited skip is used where current live data can support the path;
- static gates pass;
- wall-of-text checks remain satisfied.

## Final report requirements

Report:

- Prompt 11 verdict;
- root cause for each previous failing spec;
- files changed;
- commands and results;
- screenshot/artifact paths;
- remaining fixture limitations;
- whether Prompt 12 may proceed.

## Suggested commit

```text
test(timetable): stabilize old-scheduler queue and focus proof
```
