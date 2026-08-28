# Prompt 10 - Swap Regression Proof And Real Footer Closure

## Role

You are the ATLAS executor assigned to close the repeated swap-review regressions after Prompt 09.

This is not another visual polish pass. Treat this as a test-contract repair plus UI closure. The work is only complete when the tests measure the real user-facing action bar and fail on the current Prompt 09 defect before the UI fix is applied.

## QA verdict to address

Codex QA marked Prompt 09 `NO-GO` on 2026-08-27 after acting as the target scheduler user.

Prompt 09 made the modal calmer, but the implementation and tests drifted from the prompt contract:

- The component renders only one `data-testid="generated-swap-primary-region"` even though Prompt 09 required exactly three.
- The Playwright visual-decision spec accepts `primaryRegionCount >= 1`, so it cannot catch the missing region structure.
- The tested `generated-swap-action-region` is a placeholder inside the scroll body, not the real footer/action bar.
- The real footer still intersects primary decision content at `844x390`.
- Mobile portrait clips content horizontally.

Fresh independent live Tailnet evidence from 2026-08-27:

```text
Full swap Playwright gate:
12 passed / 3 skipped

Independent target-user probe at 844x390:
body.scrollHeight: 326
body.clientHeight: 191
body.requiresScroll: true
realFooter.top: 286.5
realFooter.bottom: 369.5
recommendedRegion.top: 213.5
recommendedRegion.bottom: 360.5
selectedStatus.top: 310.5
selectedStatus.bottom: 348.5
primaryRegionCount: 1
recommendedRegion intersects real footer: true
selectedStatus intersects real footer: true
```

Screenshot evidence:

- `D:\ATLAS\qa-artifacts\timetable-swap-old-scheduler\manual-target-user-prompt09-mobile-landscape.png`
- `D:\ATLAS\qa-artifacts\timetable-swap-old-scheduler\manual-target-user-prompt09-mobile-portrait.png`

Target-user reading:

- The modal is calmer than before.
- The screen still hides and clips decision content in the small landscape viewport.
- The passing tests are not measuring the real action bar.
- The user still has to interpret layout collisions instead of simply deciding.

## Required preflight

Before editing:

1. Read:
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-09-decision-clarity-release-closure-2026-08-27.md`
2. Inspect:
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts`
3. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
git --no-optional-locks show --name-only --format= HEAD
```

If there are uncommitted changes in target files, identify them before editing. Do not revert unrelated user work.

## Scope

In scope:

- generated occupied-slot swap review layout;
- generated swap footer/action-region instrumentation;
- mobile portrait clipping;
- Playwright regression contract repair;
- old-scheduler browser evidence;
- source guards that prevent raw controls and fake helper actions from returning.

Out of scope:

- backend swap preview or commit semantics;
- generation algorithm changes;
- publish lifecycle changes;
- Teaching Load ownership rules;
- creating live destructive timetable writes;
- broad redesign of the whole timetable page.

## Mandatory workflow order

Do the work in this order. Do not skip the failing-proof step.

### Step 1 - Prove the current candidate fails the intended contract

Before changing UI code, update or add a temporary/local failing assertion in the Playwright specs or run an independent probe that proves the current Prompt 09 candidate fails these intended requirements:

- `primaryRegionCount` must equal `3`;
- `generated-swap-action-region` must be the real footer/action bar, not an inner placeholder;
- the real action region must not intersect pair, recommended, or selected-status regions;
- primary decision body must not require scroll at `844x390`;
- mobile portrait primary regions must fit inside the dialog width.

Record the failing output in the final report. If you cannot reproduce failure before fixing, stop and report `NO-GO`; do not continue by weakening the tests again.

### Step 2 - Harden the specs so they cannot be gamed

Fix the Playwright tests before or alongside the UI fix.

Required spec behavior:

- `primaryRegionCount` must be exactly `3`, not `>= 1`.
- `generated-swap-pair-region`, `generated-swap-recommended-region`, and `generated-swap-action-region` must each also carry `data-testid="generated-swap-primary-region"`.
- `generated-swap-action-region` must be on the same DOM node as the real footer/action bar, or on a wrapper that contains the real `Cancel` and `Swap sessions` buttons.
- The spec must locate the real action bar by `data-testid="generated-swap-action-region"`, not by incidental `border-t` classes.
- The spec must fail if the pair region, recommended region, or selected status intersects the real action region.
- The spec must fail at `844x390` if `body.scrollHeight > body.clientHeight + 4` for the primary decision area.
- The spec must fail if any primary region has `right > dialog.right + 2` or `left < dialog.left - 2` on mobile portrait.
- The spec must fail if `Blocking 0` appears in visible decision copy.
- The spec must fail if `No blockers` is absent when hard blockers are zero.
- The spec must still block destructive timetable write requests during non-mutating browser proof.

Do not count fixture-limited draft or blocked checks as generated-swap proof.

### Step 3 - Fix the actual layout

Recompose generated swap so the real layout satisfies the hardened specs.

Required UI structure:

- Region 1: `Swap pair`
  - carries `data-testid="generated-swap-primary-region"` and `data-testid="generated-swap-pair-region"`;
  - shows both affected classes fully;
  - uses compact chips that fit in mobile portrait and landscape;
  - avoids clipped text that prevents identifying section/day/time.
- Region 2: `Recommended action`
  - carries `data-testid="generated-swap-primary-region"` and `data-testid="generated-swap-recommended-region"`;
  - shows the recommended strategy as the dominant decision;
  - includes selected status or places it immediately inside this region;
  - says `No blockers` when there are zero hard blockers;
  - frames soft warnings as review work, not as a hard stop.
- Region 3: real `Action bar`
  - carries `data-testid="generated-swap-primary-region"` and `data-testid="generated-swap-action-region"`;
  - contains the real status pill/sentence, `Cancel`, and `Swap sessions` controls;
  - stays outside the scrollable body as a `shrink-0` footer;
  - never overlaps or visually bisects primary decision content.

Preferred direction:

- On `844x390`, use a compact horizontal decision composition:
  - pair chips in a single short row;
  - recommended action below or beside it;
  - real action bar at the bottom;
  - secondary unavailable strategies collapsed behind `Other options` or omitted from the first view with a visible cue.
- On mobile portrait, avoid two fixed columns that exceed the dialog width.
- On desktop, keep the panel relaxed and readable.

Do not solve this with `text-[0.45rem]`, `text-[0.5rem]`, clipped overflow, or hidden primary facts.

### Step 4 - Re-run target-user browser proof

Run the full gate and one independent target-user probe.

The independent probe must record:

- dialog rectangle;
- body rectangle;
- body `scrollHeight` and `clientHeight`;
- real action-region rectangle;
- pair-region rectangle;
- recommended-region rectangle;
- selected-status rectangle;
- primary-region count;
- primary regions intersecting action region;
- primary regions overflowing dialog width;
- visible blocker/warning copy;
- screenshot paths for desktop, mobile portrait, and mobile landscape.

## Required commands

Static and unit gates:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Full swap browser gate from repo root:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Source guards:

```bash
cd D:\ATLAS
rg -n "<button|<select|title=|Review occupied-slot swap|Blocking 0|Blocking - - Warnings -|Review blockers|Try manual move|primaryRegionCount\\)\\.toBeGreaterThanOrEqual\\(1\\)" atlas-client/src/components/timetable/modals qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks diff -- atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts
```

If backend files are changed, stop and explain why. This prompt should not require backend changes.

## Required Tailnet proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Before browser QA:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

Required viewport evidence:

- `1366x768`
- `390x844`
- `844x390`

For `844x390`, final evidence must include:

- screenshot path;
- primary region count, expected `3`;
- body `scrollHeight` and `clientHeight`;
- whether the primary decision requires scroll, expected `false`;
- real action-region top/bottom;
- pair region top/bottom;
- recommended region top/bottom;
- selected status top/bottom;
- list of primary regions intersecting action region, expected `[]`;
- visible blocker/warning copy;
- target-user verdict.

For `390x844`, final evidence must include:

- screenshot path;
- dialog left/right;
- pair region left/right;
- recommended region left/right;
- selected status left/right;
- list of primary regions overflowing dialog width, expected `[]`.

## Acceptance criteria

- The test suite first proves the current Prompt 09 candidate fails the intended contract, or the executor stops with `NO-GO`.
- `generated-swap-primary-region` appears exactly three times in generated swap.
- The real footer/action bar carries `data-testid="generated-swap-action-region"`.
- At `844x390`, primary decision content does not require body scroll.
- At `844x390`, pair, recommended, and selected-status regions do not intersect the real action bar.
- At `390x844`, primary regions do not overflow the dialog width.
- The visible primary decision copy does not contain `Blocking 0`.
- The visible primary decision copy contains `No blockers` when hard blockers are zero.
- Static gates pass.
- Full swap Playwright gate passes with generated swap proven in all three viewports.
- Draft parity and blocked recovery remain honestly marked `fixture-limited` if no fixture exists.
- Product GO remains pending real older-scheduler moderated validation.

## Required final report

Return one compact final report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- proof that the current Prompt 09 candidate failed before the fix;
- blocker-by-blocker resolution table;
- files changed;
- command results;
- live Tailnet measurements for `844x390` and `390x844`;
- screenshot/artifact paths;
- blocked recovery status: `proven`, `fixture-limited`, or `NO-GO`;
- draft parity status: `proven`, `fixture-limited`, or `NO-GO`;
- committed-scope proof;
- remaining caveats;
- suggested conventional commit message.

Use `GO` only if the real footer is measured, the exact three primary regions are rendered, and target-user proof shows the scheduler can decide without scroll, clipping, or diagnostic interpretation.

