# Prompt 03 - Draft Review Parity

## Role

You are the ATLAS frontend implementation executor. Apply the new visual decision pattern to pre-generation draft placement and draft swap without changing draft persistence semantics.

## Problem

Generated swap should no longer be the only simplified review. Draft placement and draft swap currently share the same text-heavy `ReviewActionSheet` structure, so schedulers can still hit a wall of text when working from the first draft queue.

## Required prerequisite

Prompt 02 must be `GO`. Use the generated swap visual pattern from Prompt 02 as the local design contract.

## Target files

- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
- Extracted visual components from Prompt 02
- `atlas-client/src/hooks/useTimetableMutations.ts` only if draft review state labels need a small UI-facing adjustment
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/`

## Scope

In scope:

- `draft-placement-review-dialog`
- `draft-swap-review-dialog`
- concise visual parity with generated swap
- draft review copy reduction
- fixture classification when live draft swap is unavailable

Out of scope:

- Generated swap behavior already completed in Prompt 02, except regression fixes.
- Backend draft placement or draft swap algorithm changes.
- Teaching Load ownership changes.
- Adding teacher assignment controls to timetable.

## Implementation requirements

1. Draft placement review shall lead with:
   - selected class;
   - Teaching Load owner as read-only;
   - selected/suggested room;
   - target slot;
   - clear status: `Ready`, `Needs room`, `Blocked`, or `Warnings`.
2. Draft swap review shall lead with:
   - incoming class;
   - displaced class;
   - visual target/return outcome;
   - clear status for each leg.
3. Reduce explanatory sections:
   - do not render `What changes`, `Blocks`, `Warnings`, and `After save` as four equal-weight primary cards for draft review;
   - move secondary explanation into a popover, tooltip, or compact details region using project primitives.
4. Preserve ownership rule:
   - teacher ownership remains read-only and sourced from Teaching Load;
   - no timetable-owned teacher chooser may appear.
5. Keep conflict information actionable:
   - show hard conflict count and soft warning count visually;
   - if blocked, show the first manual next action in the primary path.
6. Preserve data-testid contracts:
   - `draft-placement-review-dialog`;
   - `draft-placement-preview-status`;
   - `draft-placement-save-reason`;
   - `draft-placement-feedback`;
   - `draft-swap-review-dialog`;
   - `draft-swap-preview-status`;
   - `swap-review-feedback`.
7. Preserve cancel, Escape, and focus behavior.

## UX constraints

- Use `@/ui/*` primitives.
- Keep primary controls at least 44px tall on touch viewports.
- Avoid `text-xs` for primary instructional copy.
- Keep footer actions sticky outside local scroll.
- Do not add global page overflow.

## Required assertions

Update or add source-pattern tests so they fail if:

- draft placement or draft swap reverts to four equal-weight explanatory sections;
- draft review includes `Choose teacher`, `Assign teacher`, or a teacher reassignment control;
- draft review primary status copy exceeds a concise threshold without being behind disclosure;
- draft review footer actions are hidden inside the scrollable region.

## Live browser gate

Add or update:

- `qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts`

The gate shall:

- open `Plan draft` from Simple mode on desktop, mobile portrait, and mobile landscape;
- attempt to open draft placement review without committing;
- attempt draft swap only if the fixture can be created safely without live writes;
- classify draft swap as `fixture-unavailable` when no safe occupied draft pair exists;
- assert generated swap from Prompt 02 still passes.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts --workers=1 --reporter=line
```

## Internal gate before Prompt 04

Prompt 04 may proceed only if draft placement review is simplified and generated swap regression gates still pass. Draft swap fixture unavailability may be carried forward only when the spec proves the fixture could not be reached without committing live writes.

## Report requirements

Return:

- `GO` or `NO-GO`;
- files changed;
- draft placement evidence;
- draft swap fixture classification;
- ownership-rule proof;
- command results;
- screenshot/artifact paths;
- whether Prompt 04 can proceed.
