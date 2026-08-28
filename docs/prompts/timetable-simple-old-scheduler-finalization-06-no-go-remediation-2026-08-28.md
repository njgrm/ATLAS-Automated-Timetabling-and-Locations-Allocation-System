# Prompt 06 - NO-GO Remediation For Old-Scheduler Timetable UX

## Role

You are the ATLAS executor assigned to close the independent Codex NO-GO from 2026-08-28.

This is not a general polish pass. Fix the user-facing defects that still make the timetable confusing for older scheduler officers, and harden the tests that missed them.

## Independent QA verdict to address

Codex independently verified the executor's reported sequence completion and marked it `NO-GO for old-scheduler release`.

Passing evidence from the independent run:

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `npm run test:ux-guardrails`: `93/93 PASS`
- `npm run test:timetable-conflict`: `10/10 PASS`
- Focused Playwright matrix: `72 passed, 3 skipped`

But live old-scheduler sweep still found real defects:

1. Status key is not direct. Opening Status key shows another `Status key / 6 states` button instead of the definitions.
2. Dialogs opened from More leave the More menu visually present behind them.
3. Manual swap preview failure can land on `Unable to preview swap` with a disabled-looking `Swap sessions` action.
4. `timetable-swap-visual-decision.spec.ts` still accepts `primaryRegionCount >= 1`.
5. Several old specs still reference `Review occupied-slot swap`.

Independent screenshot evidence:

- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\desktop-05-status-key.png`
- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\mobile-portrait-05-status-key.png`
- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\desktop-04-tutorial-from-more.png`
- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\desktop-06-filters.png`
- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\desktop-swap-dialog.png`
- `D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\manual-codex-audit-2026-08-28\mobile-landscape-swap-dialog.png`

## Required preflight

Before editing:

1. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-05-cumulative-release-proof-2026-08-28.md`
   - `docs/verification/timetable-simple-old-scheduler-finalization-release-proof-2026-08-28.md`
   - `ATLAS_AGENT_KI.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
2. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableStatusLegend.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - all timetable Playwright specs that still reference `Review occupied-slot swap`
   - `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
3. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
```

Do not revert unrelated user work.

## Scope

In scope:

- Simple status key direct definitions;
- More-menu overlay lifecycle when opening Tutorial, Status key, Filters, and How-this-works;
- generated/manual swap preview failure state;
- stale/weak swap and old-scheduler tests;
- source guards that specifically catch this NO-GO.

Out of scope:

- backend generation algorithm changes;
- publish lifecycle semantics;
- Teaching Load ownership rules;
- live destructive timetable writes;
- broad redesign outside `/timetable`;
- claiming moderated Product GO.

## Required fixes

### 1. Make Status key direct

The Status key must show definitions immediately.

Required behavior:

- When the scheduler opens Status key from the header or More menu, the visible panel/dialog must directly show `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, and `Current`.
- The visible first panel must not contain a second `Status key` trigger as the only path to definitions.
- Hidden `sr-only` text must not be counted as visual proof.
- The Done/Close control must remain visible on desktop, mobile portrait, and mobile landscape.

Implementation direction:

- Split `TimetableStatusLegend` into reusable trigger and reusable content, or add a content-only mode.
- In the Simple status-key dialog, render the content directly instead of `<TimetableStatusLegend compact />`.

### 2. Close More before opening layered surfaces

Opening Tutorial, Status key, Filters, How-this-works, or any dialog/sheet from More must not leave the More menu visually present behind the new layer.

Required behavior:

- More closes before the new layer becomes visible.
- The new layer is visually clean and not overlapped by the More menu.
- Focus returns predictably when the layer closes.
- Tests must prove this with visibility checks, not just click success.

Implementation direction:

- Use a predictable state transition helper for More menu actions that close More first, then opens the requested surface on the next frame if needed.
- Do not use timing hacks that make mobile flaky.

### 3. Fix swap preview failure as a decision state

The `Unable to preview swap` state must be useful, not a dead-end error panel.

Required behavior:

- The primary question still says what pair was selected.
- The primary status says why ATLAS cannot preview in plain language.
- `Swap sessions` must not appear as the primary action when preview is unavailable.
- The dominant action must be `Choose another pair` or equivalent.
- `Cancel` remains available.
- If a retry is possible, show it as a secondary action only.
- No primary preview-failure state may contain more than three primary regions.
- No preview-failure state may exceed the agreed visible text budget before actions.

### 4. Harden stale tests and source guards

Required behavior:

- Replace `primaryRegionCount >= 1` with the intended exact generated-swap contract.
- Remove or update active specs that still require `Review occupied-slot swap`.
- Keep historical specs only if they are explicitly marked superseded and excluded from the active release gate.
- Add a Playwright check that fails if Status key definitions are hidden behind a second trigger.
- Add a Playwright check that fails if More remains visible behind Tutorial, Status key, or Filters.
- Add a Playwright check for the preview-failure swap state if reachable; otherwise add a source/unit guard that covers the fallback branch.

Do not claim GO if the active specs still allow the known NO-GO screenshots to pass.

## Wall-of-text rule

Apply this rule to every touched timetable component:

- Primary decision surface: maximum three primary regions.
- Primary instruction block: one heading plus one short sentence.
- Lists: no more than five visible rows before disclosure or local scroll.
- Diagnostics/details: disclosed behind a clear `Details`, `Explain`, or `Other options` action.
- No primary modal/drawer body should require scrolling to understand the decision at `844x390`.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-simple-view-completion.spec.ts timetable-simple-ease-of-use.spec.ts timetable-simple-publish-blockers.spec.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Run any new focused specs directly before the broader matrix.

## Required Tailnet proof

Use live Tailnet:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin credentials from project instructions

Capture evidence on:

- `1366x768`
- `390x844`
- `844x390`

For each viewport, prove:

- Status key definitions are directly visible.
- More is closed when Tutorial opens.
- More is closed when Status key opens.
- More is closed when Filters opens.
- Swap preview failure state, if reached, has a useful dominant action and no disabled-looking commit action.
- No global horizontal overflow.
- No app-critical console errors.

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\06-no-go-remediation\
```

## Internal gate before Prompt 07

Prompt 06 is GO only when:

- the independent NO-GO screenshots cannot recur;
- the stale/weak tests are fixed;
- the live three-viewport proof passes;
- all required commands pass;
- no wall-of-text primary decision state is introduced.

## Final report requirements

Report:

- final Prompt 06 verdict;
- files changed;
- exact stale assertions removed;
- commands and results;
- screenshot paths;
- remaining fixture limitations;
- whether Prompt 07 may proceed.
