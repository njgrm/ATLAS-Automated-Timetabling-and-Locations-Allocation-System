# Prompt 13 - Status Key 200 Percent Reflow Closure

## Role

You are the ATLAS executor assigned to close the final old-scheduler accessibility caveat from Prompt 12.

The current release proof is `CONDITIONAL GO` because the Status key at 200% font size is skipped: the test reports that the dialog does not open or the Status key menu item is not reachable. This is not a fixture limitation. For older scheduler officers, 200% text reflow is a real accessibility scenario and must be proven.

## QA verdict to address

Independent Codex verification accepted the broader sequence as `CONDITIONAL GO`, but kept this caveat:

```text
Status key at 200% is skipped because the dialog does not open / is not reachable in that reflow proof.
```

The current test in `qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts` skips these states:

- `Status key menu item not visible in More menu`
- `Status key dialog did not open`
- `Status key content fixture unavailable`

For Prompt 13, those must become real failures unless the executor proves a different reachable Status key path is intentionally provided and works at 200%.

## Required preflight

Before editing:

1. Read:
   - `docs/prompts/timetable-simple-old-scheduler-remaining-issues-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-12-cumulative-release-proof-2026-08-28.md`
   - `docs/verification/timetable-simple-old-scheduler-remaining-issues-release-proof-2026-08-28.md`
   - `ATLAS_AGENT_KI.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
2. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableStatusLegend.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
   - `qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
   - `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
3. Check git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -5 --oneline
```

Do not revert unrelated user work.

## Scope

In scope:

- Status key reachability at 200% text size / browser reflow;
- More menu reachability at 200%;
- direct Status key entry if present;
- dialog/sheet geometry, local scrolling, and focus behavior at 200%;
- test hardening so future regressions cannot be hidden as fixture-limited skips;
- small layout or interaction fixes discovered while proving 200% reflow.

Out of scope:

- generation algorithm changes;
- timetable mutation semantics;
- publish lifecycle changes;
- broad redesign of the timetable shell;
- replacing the current old-scheduler visual language unless required by the 200% accessibility proof.

## Required investigation

First reproduce the current caveat:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --project=desktop -g "200 percent" --workers=1 --reporter=line
```

Then run a manual Playwright probe or update the spec temporarily to record:

- viewport size;
- computed root font size;
- whether the More trigger is visible;
- whether the direct Status key trigger is visible, if present;
- whether the More menu opens;
- More menu bounding box and scroll metrics;
- whether the Status key menu item is visible without horizontal page overflow;
- whether clicking Status key opens the dialog;
- dialog bounding box and scroll metrics;
- whether definitions are visible directly: `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, `Current`;
- whether a close button is visible and keyboard reachable;
- active element after open and after close;
- root `scrollWidth/clientWidth` and `scrollHeight/clientHeight`.

Save the failing evidence before fixing.

## Required fixes

### 1. Make Status key reachable at 200%

At 200% font size on `1366x768`, the scheduler must be able to open Status key from a visible and understandable path.

Required behavior:

- The More trigger remains visible.
- The More menu can open.
- The Status key item remains visible or reachable through local menu scrolling.
- Selecting Status key closes More before opening the Status key dialog.
- The Status key dialog opens.
- The six definitions are directly visible or reachable through local dialog scrolling.
- The close/done action is visible or keyboard reachable.
- The root document must not create horizontal overflow.

If the direct header Status key trigger is visible at 200%, test that too. If it is intentionally hidden, the More path must still pass.

### 2. Keep the dialog old-scheduler friendly

The Status key content must remain concise:

- one heading;
- no nested Status key trigger;
- six short state definitions;
- no raw enum-only labels;
- no wall of text;
- no hover-only explanation required.

If local scrolling is necessary at 200%, the first useful definition and close path must remain discoverable. Do not shrink text below readable sizes just to avoid local scroll.

### 3. Harden the 200% spec

Update `timetable-touch-queue-and-reflow.spec.ts` so these are failures, not skips:

- Status key menu item is not visible or locally reachable;
- Status key dialog does not open;
- Status key definitions are not visible or locally reachable;
- Status key creates root horizontal overflow;
- More remains visible behind the Status key layer;
- the only close path is hidden or unreachable.

Only the generated unassigned queue portion may remain fixture-limited if the current selected run truly has no generated unassigned queue. Separate that from Status key proof so a missing queue cannot skip Status key accessibility.

### 4. Add source guard coverage

Update `atlas-client/src/lib/__tests__/ux-guardrails.test.ts` or an equivalent source-pattern test so it prevents:

- nested Status key trigger returning inside the Status key dialog;
- Status key 200% test skipping dialog-open failures;
- More menu opening Status key without closing More first.

Do not overfit to one class string if a semantic assertion is available.

## Required commands

Focused first:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --project=desktop -g "200 percent" --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line
```

Old-scheduler browser regression:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --project=desktop --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Static:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Source guard:

```bash
cd D:\ATLAS
rg -n "Status key dialog fixture unavailable|Status key content fixture unavailable|Status key menu item not visible|test\\.skip\\(true, 'Status key" qa-artifacts/playwright/specs atlas-client/src/lib/__tests__
rg -n "Review occupied-slot swap|Review draft placement|Blocking 0|Blocking - - Warnings -" atlas-client/src/components/timetable qa-artifacts/playwright/specs
git --no-optional-locks status --short --untracked-files=all
```

## Required Tailnet proof

Use live Tailnet:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

Capture Status key evidence at 200% font size for:

- `1366x768`
- `390x844`
- `844x390`

Save artifacts under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\13-status-key-200-percent-reflow\
```

Required artifacts:

- before-fix failure JSON and screenshot;
- after-fix screenshot per viewport;
- after-fix metrics JSON per viewport;
- final proof summary Markdown or JSON.

Metrics must include:

- viewport;
- computed root font size;
- root overflow measurements;
- More trigger visibility;
- More menu scroll measurements;
- Status key trigger/item visibility;
- dialog visibility;
- dialog scroll measurements;
- definitions found;
- close path visibility;
- More menu hidden after Status key opens;
- focused element after close.

## Acceptance criteria

- The 200% Status key check fails before the fix or the executor documents why it already passes now.
- The final 200% Status key check does not skip on missing Status key item, missing dialog, or missing content.
- Status key opens at 200% from More on desktop, mobile portrait, and mobile landscape.
- Status key definitions are directly visible or locally reachable at 200%.
- More is closed while Status key is open.
- Close/done path is visible or keyboard reachable at 200%.
- No root horizontal overflow appears at 200%.
- The generated unassigned queue may still be fixture-limited, but it cannot skip Status key checks.
- Static gates pass.
- Old-scheduler browser regression gates pass.
- Product GO remains pending moderated older-scheduler validation unless the user explicitly accepts simulated proof.

## Final report requirements

Report:

- final Prompt 13 verdict;
- before-fix failure evidence;
- files changed;
- exact commands and results;
- Tailnet 200% metrics for all three viewports;
- screenshot/artifact paths;
- source guard results;
- remaining fixture limitations;
- whether the overall timetable old-scheduler status moves from `CONDITIONAL GO` to `Technical GO`;
- suggested conventional commit message.

## Suggested commit

```text
test(timetable): prove status key reflow accessibility
```
