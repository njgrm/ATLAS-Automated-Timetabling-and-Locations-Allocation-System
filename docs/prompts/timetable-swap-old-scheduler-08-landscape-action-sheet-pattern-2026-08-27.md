# Prompt 08 - Swap Landscape Action-Sheet Pattern Fix

## Role

You are the ATLAS executor assigned to fix the remaining live old-scheduler failure after Prompt 07.

Do not continue shrinking the existing centered modal. Replace the short-height landscape presentation pattern so the scheduler's decision is visible without a footer collision.

## QA verdict to address

Codex QA marked Prompt 07 `NO-GO` after rerunning live Tailnet as an older scheduler.

The Prompt 07 implementation improved body height but still failed the actual live visual-decision spec:

```text
Failed: timetable-swap-visual-decision.spec.ts
Reason: recommendedIntersectsFooter expected false, received true
```

Fresh live metrics from 2026-08-27:

- Viewport: `844x390`
- Title: `Swap these two classes?`
- Section count: `2`
- Body: `scrollHeight 385`, `clientHeight 213`, `requiresScroll true`
- Recommended strategy row: `y 310`, `height 36`
- Footer: `y 321.5`, `height 40`
- `recommendedIntersectsFooter: true`
- `strategyButtonsIntersectingFooter: 2`
- `hasSelectedStatus: true`
- Result: the key recommendation exists but is visually under the footer band.

Old-scheduler reading:

- The page asks the right question.
- The affected classes are visible.
- The options start too low.
- The footer interrupts the recommendation.
- The user still has to interpret a cramped layout during a high-risk action.

## Required preflight

Before editing:

1. Read:
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-07-mobile-landscape-decision-fit-2026-08-27.md`
2. Inspect:
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts`
3. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
git --no-optional-locks show --name-only --format= HEAD
```

If there are uncommitted changes, identify whether they are unrelated user work before editing. Do not revert unrelated changes.

## Scope

In scope:

- generated occupied-slot swap UI for short-height landscape;
- visual-decision spec assertions and metrics;
- regression spec selectors only if needed;
- old-scheduler evidence capture.

Out of scope:

- backend API semantics;
- swap preview/commit business logic;
- creating draft fixtures;
- generation, publish, Teaching Load, or dashboard changes;
- broad redesign of desktop or mobile portrait.

## UI Implementation Directive: Use A Short-Height Pattern, Not A Smaller Modal

**Target File(s):** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`, `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
**Framework Requirements:** `@/ui/*` primitives, `lucide-react`, existing ATLAS tokens

**Required Pattern Change:**
- For short-height landscape, stop using the same centered stacked modal layout.
- Use one of these safer patterns:
  - a bottom action sheet with the action row separated from the scrollable decision content;
  - a wide two-column decision layout inside the dialog, with class chips on the left and strategy/action controls on the right;
  - a compact top/body/footer layout where the footer is outside the decision geometry and the strategy rows are fully above it.
- The chosen pattern must keep the recommended option row entirely visible above the footer at `844x390`.
- The selected blocker/warning status must appear in the selected strategy row or immediately adjacent to it.
- The footer may be compact, but it must not overlap, cover, or visually bisect decision content.

**Design Constraints:**
- Do not use `text-[0.45rem]`, `text-[0.5rem]`, or similarly tiny text to force-fit the layout. That is not old-scheduler friendly.
- Do not shrink primary actions below the project’s older-user-safe touch target policy.
- Do not hide unavailable strategies unless the UI clearly indicates there are unavailable alternatives and lets the scheduler inspect them after the primary decision.
- Do not use raw `<button>`, native `<select>`, raw `title`, or native disclosure controls.
- Keep the normal desktop/mobile-portrait layout readable. Do not make those routes inherit the emergency landscape compression.

**Developer Instructions for Claude/Codex:**
"Replace the short-height landscape swap review pattern so the scheduler can see the recommended strategy and selected status before interacting with the footer. Do not keep iterating with smaller font sizes. Preserve the existing server-controlled preview contract and the project Button primitives. The Playwright visual-decision test must fail on any footer intersection with strategy rows."

## Required fixes

### 1. Create a real short-height landscape layout

Implement a responsive branch for short-height landscape only.

Required outcomes at `844x390`:

- title is visible;
- affected classes are visible as concise chips;
- recommended strategy row is fully visible above the footer;
- selected blocker/warning status is visible in or beside the recommended row;
- cancel and confirm actions are visible;
- footer does not intersect any strategy button;
- body may scroll only for secondary details, not for the primary decision.

The recommended row cannot be partially hidden. This is a hard gate.

### 2. Preserve readable sizing

Undo or avoid over-compressed typography where it harms scheduler readability.

Required outcomes:

- no `text-[0.45rem]` or `text-[0.5rem]` in generated swap decision controls;
- primary strategy labels remain legible on `844x390`;
- primary action buttons stay large enough to tap deliberately;
- status text remains short but meaningful, for example `Ready: 0 blockers, 890 warnings`.

### 3. Harden the visual-decision spec

Update `timetable-swap-visual-decision.spec.ts` so it fails on the Prompt 07 state.

Required assertions:

- every strategy button rectangle is measured;
- footer rectangle is measured;
- `recommendedIntersectsFooter` must be false in all viewports;
- all non-hidden strategy buttons must not intersect the footer;
- if unavailable strategy rows are intentionally hidden/collapsed in landscape, the spec must assert a visible cue that unavailable alternatives exist;
- selected status must be visible before scroll;
- at `844x390`, the recommended row bottom must be at least `8px` above the footer top;
- screenshot and JSON metrics must be saved.

### 4. Verify with an independent old-scheduler probe

In addition to Playwright specs, run one independent `844x390` probe that records:

- dialog rectangle;
- body rectangle and scroll metrics;
- footer rectangle;
- strategy row rectangles;
- selected status rectangle;
- whether any primary decision content intersects the footer;
- screenshot path.

Use this probe as QA evidence, not as a replacement for the committed Playwright spec.

### 5. Keep Prompt 06 and 07 fixes intact

Preserve:

- `@/ui/button` strategy controls;
- stable `data-testid="generated-swap-strategy-option"`;
- `aria-pressed`;
- selected-strategy-aware blocker/warning counts;
- honest blocked-state wording;
- no `Review blockers` or `Try manual move` fake actions;
- no `Blocking - - Warnings -` placeholder;
- no destructive write request during non-mutating browser specs.

## Required commands

Client gates:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Full swap gate:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Source guards:

```bash
cd D:\ATLAS
rg -n "text-\\[0\\.45rem\\]|text-\\[0\\.5rem\\]|<button|<select|title=|Review blockers|Try manual move|Blocking - - Warnings -" atlas-client/src/components/timetable/modals qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
git --no-optional-locks status --short --untracked-files=all
```

If backend files are changed, stop and report why. This prompt should not need backend work.

## Required Tailnet browser proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Before browser QA:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

If Tailnet returns `502`, start the local dev stack and rerun health:

```bash
cd D:\ATLAS
npm run dev
```

Required viewport evidence:

- `1366x768`
- `390x844`
- `844x390`

For `844x390`, final evidence must include:

- screenshot path;
- body `scrollHeight` and `clientHeight`;
- footer top and height;
- recommended row top and bottom;
- `recommendedIntersectsFooter: false`;
- count of strategy rows intersecting footer, expected `0`;
- selected status visibility before scroll;
- old-scheduler verdict: `can decide without scrolling first`.

## Acceptance criteria

- The `844x390` visual-decision spec passes because the recommended row is above the footer, not because the assertion was weakened.
- The recommended strategy row does not intersect the footer in any required viewport.
- No primary strategy row intersects the footer unless it is intentionally hidden/collapsed with a visible alternatives cue.
- The selected blocker/warning status is visible before scroll.
- The generated swap decision controls do not use unreadably tiny text classes.
- Desktop and mobile portrait remain readable and do not regress into cramped landscape styling.
- Static gates and full swap Playwright gate pass.
- Blocked recovery and draft parity remain honestly classified if fixtures are unavailable.
- Product GO remains pending moderated older-scheduler validation.

## Required final report

Return one compact final report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- specific statement on whether Prompt 07's `recommendedIntersectsFooter=true` failure is fixed;
- before/after `844x390` measurements;
- old-scheduler QA verdict;
- files changed;
- command results;
- Tailnet screenshot/artifact paths;
- blocked recovery status;
- draft parity status;
- committed-scope proof;
- remaining caveats;
- suggested conventional commit message.

Use `GO` only if live Tailnet `844x390` proves the scheduler can see the recommended strategy and selected status without the footer intersecting them.

