# Prompt 02 - Generated Swap Visual Decision

## Role

You are the ATLAS frontend implementation executor. Implement only the generated occupied-slot swap review redesign in this prompt.

## Problem

The generated swap modal currently reads like a multi-section document. It should instead be a visual decision surface that lets a scheduler understand the two affected classes, the recommended action, and the selected option's risk without reading long explanatory sections.

## Required prerequisite

Prompt 01 must be `GO`. Use its live fixture and artifact paths as the before-state baseline.

## Target files

- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
- New extracted components are allowed under:
  - `atlas-client/src/components/timetable/modals/`
- `atlas-client/src/hooks/useTimetableMutations.ts` only if selected-strategy state needs a small contract adjustment
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`

## Scope

In scope:

- Generated occupied-slot swap review only.
- Visual before/after outcome.
- Recommended strategy presentation.
- Selected-strategy conflict and warning summary.
- Reduced modal text density.

Out of scope:

- Draft placement or draft swap changes.
- Backend swap algorithm changes.
- Live commit behavior changes.
- Teaching Load ownership changes.
- Publish lifecycle gate changes.

## Implementation requirements

1. Replace the generated swap review body with a decision-first layout:
   - Primary title should be direct, such as `Swap these two classes?`.
   - Use a visual before/after panel showing both classes and their target slots.
   - Use subject, section, day, time, and room as scannable chips or compact rows.
   - Keep long explanatory copy out of the primary path.
2. Limit generated swap to no more than three primary visual regions:
   - affected classes;
   - recommended/available options;
   - selected option status and next action.
3. Present `recommendedStrategy` visibly:
   - add a `Recommended` badge to the backend-recommended strategy when it is not `BLOCKED`;
   - do not preselect a blocked option;
   - keep disabled strategies visibly disabled with a short reason.
4. Fix selected-strategy status:
   - the visible blocker/warning summary must reflect `regularSwapStrategy`;
   - do not always show `Direct swap` counts after the scheduler selects or receives an auto-fix recommendation.
5. Replace `Blocking - - Warnings -` with useful unavailable-state copy:
   - `No safe slot found`;
   - `Not available for this pair`;
   - or another short plain-language reason.
6. Keep generated swap footer actions sticky outside the scrollable region.
7. Keep `Cancel` and Escape behavior intact.
8. Preserve `data-testid="generated-swap-review-dialog"`, `data-testid="generated-swap-preview-status"`, `data-testid="generated-swap-feedback"`, and `data-review-action-type="generated-swap"`.

## UX constraints

- Use `@/ui/*` Button, Badge, Tooltip, Popover, or existing primitives.
- Do not use native `<button>` for new controls.
- Do not use raw `<details>` or `title`.
- Use `lucide-react` icons for status and swap direction.
- Text in the primary path should be at least `text-sm` except secondary metadata.
- Primary option targets should be at least 44px tall.
- Avoid a modal body that requires scrolling on desktop for the baseline fixture.

## Required assertions

Update or add source-pattern tests so they fail if:

- generated swap still renders five `ReviewActionSection` blocks in the primary path;
- generated swap uses direct-preview counts for every selected strategy;
- generated swap displays `Blocking - - Warnings -`;
- generated swap lacks a visible `Recommended` indicator when `recommendedStrategy` is available;
- generated swap footer actions are inside the scrollable review sheet.

## Live browser gate

Update the Playwright spec from Prompt 01 or add:

- `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`

The live gate shall:

- open the same generated swap fixture on desktop, mobile portrait, and mobile landscape;
- assert no global horizontal overflow;
- assert footer actions are visible;
- assert option buttons/cards meet target-size rules;
- assert the visible selected status label matches the selected strategy;
- cancel the dialog without committing.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts --workers=1 --reporter=line
```

## Internal gate before Prompt 03

Prompt 03 may proceed only if generated swap is visibly simplified and the live 3-viewport visual-decision gate passes. If desktop still needs inner review-sheet scrolling for the baseline fixture, mark Prompt 02 `NO-GO` and fix before continuing.

## Report requirements

Return:

- `GO` or `NO-GO`;
- files changed;
- before/after text length and section count;
- selected-strategy summary proof;
- command results;
- screenshot/artifact paths;
- whether Prompt 03 can proceed.
