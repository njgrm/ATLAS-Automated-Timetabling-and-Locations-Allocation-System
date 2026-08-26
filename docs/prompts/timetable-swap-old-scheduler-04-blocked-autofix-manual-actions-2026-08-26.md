# Prompt 04 - Blocked Auto-Fix and Manual Actions

## Role

You are the ATLAS implementation executor for blocked swap recovery. Make blocked swaps useful without weakening timetable validation.

## Problem

When generated swap is blocked and auto-fix targets are unavailable, the current UI can leave schedulers with disabled strategy rows and a disabled `Swap sessions` button. That is technically safe but operationally frustrating. The scheduler needs the next useful action.

## Required prerequisite

Prompt 03 must be `GO` or must have only a documented draft-swap fixture limitation that does not affect generated swap.

## Target files

- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- Extracted swap visual components from Prompts 02-03
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx` only if focus/selection reset needs a small UI hook
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/`

Backend target only if the client lacks enough data to explain unavailable auto-fix reasons:

- `atlas-server/src/services/manual-edit.service.ts`

## Scope

In scope:

- blocked generated swap recovery;
- unavailable auto-fix explanation;
- manual next action buttons;
- selected-strategy status correctness;
- non-mutating live proof.

Out of scope:

- weakening hard-conflict validation;
- allowing publish with hard violations;
- inventing a new scheduler algorithm;
- changing Teaching Load ownership.

## Implementation requirements

1. When `recommendedStrategy` is `BLOCKED`, the modal shall show a primary blocked-state panel with:
   - the short reason;
   - hard conflict count;
   - first recommended manual next action.
2. When an auto-fix strategy has no preview, the option shall show a clear unavailable reason instead of placeholder dashes.
3. Provide manual next actions in the primary path:
   - `Choose another class`;
   - `Review blockers`;
   - `Try manual move`;
   - `Cancel safely`.
4. Manual action behavior:
   - `Choose another class` closes the modal and leaves swap mode active or resets only the second selection, whichever matches current state architecture most safely;
   - `Review blockers` routes to the existing blocker/review task surface without changing schedule data;
   - `Try manual move` opens the existing move/manual edit affordance for the selected class when available, or explains why it is unavailable;
   - `Cancel safely` closes without writes.
5. Do not show a disabled primary `Swap sessions` button as the only apparent next step.
6. If the server already returns enough preview data, keep changes client-only.
7. If the server must return unavailable auto-fix reasons, add a minimal typed field to the swap preview response and preserve existing clients.

## UX constraints

- Use clear action labels with verbs.
- Keep manual actions visually secondary to safe auto-fix when safe auto-fix exists.
- Keep target sizes at least 44px on touch viewports.
- Use icons and badges to separate `Recommended`, `Blocked`, `Unavailable`, and `Manual`.
- Do not add long instructional paragraphs to replace the old wall of text.

## Required assertions

Update or add tests so they fail if:

- blocked generated swap has no manual next action;
- any auto-fix option renders placeholder dash counts;
- `Swap sessions` is enabled when no safe strategy exists;
- selected strategy and visible status disagree;
- manual action buttons are raw native buttons.

## Live browser gate

Add or update:

- `qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts`

The gate shall:

- open the baseline blocked pair from Prompt 01 or discover a blocked pair safely;
- assert blocked state is visually clear;
- assert at least one manual next action is visible;
- assert `Choose another class` or `Cancel safely` exits without committing writes;
- assert no call to the swap commit endpoint occurs during the non-mutating gate;
- run on desktop, mobile portrait, and mobile landscape.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

If backend files changed:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Also verify the built server starts and the touched swap preview route responds.

## Internal gate before Prompt 05

Prompt 05 may proceed only if blocked generated swap shows useful next actions across all three live viewports and no non-mutating browser gate leaks a commit request.

## Report requirements

Return:

- `GO` or `NO-GO`;
- files changed;
- blocked-state behavior proof;
- manual action behavior proof;
- command results;
- screenshot/artifact paths;
- whether Prompt 05 can proceed.
