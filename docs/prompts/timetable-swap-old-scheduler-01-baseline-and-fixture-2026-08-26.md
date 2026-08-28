# Prompt 01 - Timetable Swap Old-Scheduler Baseline and Fixture

## Role

You are the ATLAS investigation executor. Do not implement product UI changes in this prompt. Establish the exact generated-swap and draft-review baseline before redesign begins.

## Problem

Live `/timetable` generated occupied-slot swap is reachable, but the modal reads like a review document instead of a quick scheduler decision. It currently stacks multiple text sections and scrolls internally on all tested viewports. Before changing UI, freeze a reliable non-mutating browser fixture and source contract so later prompts cannot hide regressions behind stale selectors.

## Required sequence context

Read first:

- `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Target files to inspect

- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/ManualEditPanel.tsx`
- `atlas-server/src/services/manual-edit.service.ts`
- `qa-artifacts/playwright/specs/`

## Scope

Detect-only. Product source changes are out of scope unless a stale QA helper must be corrected to capture evidence. Do not commit timetable edits.

## Required investigation

1. Check worktree state before touching anything:
   - `git --no-optional-locks status --short`
2. Authenticate against live Tailnet as the documented ATLAS admin QA user.
3. Open `https://njgrm.buru-degree.ts.net/timetable`.
4. Record:
   - active school year label;
   - active run ID;
   - source state;
   - blocker/warning counts;
   - default task shown;
   - available task menu entries.
5. Open generated swap through the Simple UI:
   - `More -> Swap sessions`;
   - select two occupied non-special-event cells;
   - wait for `generated-swap-review-dialog`.
6. Capture generated swap metrics on desktop, mobile portrait, and mobile landscape:
   - dialog title;
   - `data-review-action-type`;
   - section count;
   - visible text length;
   - dialog bounding box;
   - review-sheet `clientHeight` and `scrollHeight`;
   - whether sheet scrolling is required;
   - whether global horizontal or vertical overflow occurs;
   - footer button visibility and button dimensions;
   - console and page errors.
7. Attempt draft planning review discovery:
   - open `Plan draft`;
   - record whether draft placement review can be opened safely without committing;
   - record whether a draft swap fixture exists in the current live slice.
8. Inspect source for:
   - how generated swap preview chooses `recommendedStrategy`;
   - whether selected strategy drives the visible conflict summary;
   - how draft swap and draft placement share the review-sheet pattern;
   - current old-scheduler touch target and text-size risks.

## Required QA artifact

Add or update one non-mutating Playwright spec:

- `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`

The spec shall:

- run on desktop, mobile portrait, and mobile landscape;
- open generated swap review from Simple mode;
- never call the swap commit endpoint;
- cancel or close the dialog before ending;
- write JSON metrics under `qa-artifacts/timetable-swap-old-scheduler/baseline/`;
- capture screenshots for each viewport.

## Acceptance criteria

- The baseline spec opens generated swap review on all three viewports.
- The spec records whether the dialog is scroll-heavy.
- The spec records whether all swap strategy options are useful, disabled, or unavailable.
- The spec classifies draft review fixture status as `available`, `fixture-unavailable`, `stale-selector`, or `dev-stack-unavailable`.
- No product behavior changes are made.
- Stale selectors fail as stale selectors, not as proxy limitations.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts --workers=1 --reporter=line
```

## Internal gate before Prompt 02

Prompt 02 may proceed only if the generated swap baseline opens and records metrics across all three viewports. If generated swap cannot be opened, stop the sequence and report exact selector/runtime evidence.

## Report requirements

Return:

- `GO` or `NO-GO`;
- files changed;
- run ID and school year observed;
- viewport metrics table;
- generated swap text/scroll findings;
- draft fixture classification;
- screenshot/artifact paths;
- whether Prompt 02 can proceed.
