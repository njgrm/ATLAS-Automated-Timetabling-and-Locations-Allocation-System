# Prompt 07 - Swap Mobile Landscape Decision-Fit Closure

## Role

You are the ATLAS executor assigned to close the remaining old-scheduler QA blocker after Prompt 06.

Do not reopen the full swap redesign. Fix the mobile-landscape decision-fit failure and the tests that allowed it to pass.

## QA verdict to address

Codex QA marked Prompt 06 `NO-GO` after acting as an old scheduler on live Tailnet.

The automated checks passed only after starting the dev stack, but the actual `844x390` viewport still hides the scheduler's decision behind the footer. This is the remaining product-critical blocker.

Fresh QA evidence from 2026-08-27:

- Screenshot: `D:\ATLAS\qa-artifacts\timetable-swap-old-scheduler\manual-old-scheduler-mobile-landscape.png`
- Viewport: `844x390`
- Dialog: `top 19.65`, `bottom 370.43`, `height 350.78`
- Body: `top 99.60`, `bottom 294.48`, `height 194.88`, `scrollHeight 522`, `clientHeight 195`
- Footer: `top 312.47`, `bottom 352.45`, `height 39.98`
- Sections extending below the visible decision area: `Swap options`, `Direct swap status`
- Buttons intersecting the footer band: `Recommended Direct swap`, `Cancel`, `Swap sessions`
- Only one strategy button was fully visible

Old-scheduler reading of the screen:

- The question and affected classes are understandable.
- The actual choice list is not visible enough.
- The status panel is hidden below the first view.
- The footer competes with the decision instead of coming after it.
- The screen still feels like "scroll to understand" in landscape.

## Required preflight

Before editing:

1. Read:
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-06-qa-blocker-fix-2026-08-27.md`
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

If there are uncommitted changes in the target files, treat them as user/executor work. Do not revert them. Work with the current candidate.

## Scope

In scope:

- generated swap mobile-landscape layout;
- generated swap visual-decision Playwright assertions;
- blocked-recovery Playwright honesty if it still passes without a blocked state;
- regression spec source checks for raw controls and hidden core decisions;
- documentation/evidence correction.

Out of scope:

- backend swap semantics;
- generation truth;
- publish lifecycle;
- draft queue data creation unless a safe non-mutating fixture already exists;
- broad visual redesign of desktop or mobile portrait;
- claiming older-scheduler Product GO without moderated validation.

## UI Implementation Directive: Short-Height Swap Review

**Target File(s):** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`, `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
**Framework Requirements:** `@/ui/*` shadcn primitives, `lucide-react`, existing ATLAS Tailwind tokens

**Layout Constraints to Enforce:**
- For short-height viewports such as `844x390`, the visible first screen must answer:
  - which two classes are being swapped;
  - which strategy is recommended;
  - whether the selected strategy has blockers;
  - where to cancel;
  - where to confirm.
- Do not require the old scheduler to scroll before seeing the strategy choices.
- Do not place a separate selected-status card below the strategy list in short-height landscape. Integrate the selected strategy status into the selected option row or a compact inline status strip above the footer.
- Keep the footer as a real footer, but it must not cover, visually compete with, or hide the strategy rows.
- Keep desktop and mobile portrait relaxed enough to avoid over-compression.
- Keep touch targets usable. Do not shrink primary action buttons below the existing older-user-safe target policy.

**Recommended Composition:**
- Desktop and mobile portrait may keep the three-region model:
  - `What changes`
  - `Swap options`
  - `Selected option status`
- Short-height landscape should use a two-region decision model:
  - `What changes`, compact one-line or two-chip row
  - `Choose option`, with each option row showing its own blocker/warning counts
- In short-height landscape, the footer feedback sentence may be replaced by a compact status pill if needed.
- If the warning count is very large, show it as `890 warnings` inside the chosen option row or footer pill rather than in a separate card.

**Developer Instructions for Claude/Codex:**
"Fix the generated occupied-slot swap dialog so a scheduler using mobile landscape can decide without scrolling first. Preserve the server-owned swap preview contract and the selected-strategy-aware behavior. The implementation must not solve this by hiding the available strategies, removing cancel safety, or using raw native controls. The visual-decision spec must fail if the first screen hides strategy rows or status behind the footer."

## Required fixes

### 1. Make mobile landscape decision-first

For `max-height: 500px` or an equivalent short-height responsive condition, recompose generated swap only.

Required outcome at `844x390`:

- The dialog title is visible.
- Both affected classes are visible.
- All available strategy rows are visible enough to identify their labels and selected/recommended state.
- The selected strategy's blocker/warning status is visible without scrolling.
- Cancel and confirm actions are visible.
- The footer does not visually cover any strategy row.
- The user can decide and cancel without guessing that more content exists below.

Do not remove the selected-strategy status entirely. Move or compress it into the decision area.

### 2. Fix the visual-decision test so it catches the failure

Update `timetable-swap-visual-decision.spec.ts`.

Required assertions:

- Measure every strategy button's bounding rectangle.
- Measure footer rectangle.
- Fail if a strategy button intersects the footer rectangle.
- Fail if fewer than the expected strategy rows are visible in the initial body viewport.
- Fail if the selected strategy status is not visible in the initial viewport on desktop and mobile portrait.
- For mobile landscape, fail if neither the selected option row nor a compact status strip visibly reports blocker/warning counts before scrolling.
- Continue recording `scrollHeight`, `clientHeight`, footer rectangle, section rectangles, and screenshot paths.

Do not accept a passing test that only checks body-container overlap.

### 3. Fix the regression spec's raw-control check

The current uncommitted candidate changed the raw-control detector to `button:not(.font-semibold)`, which is too brittle.

Required outcome:

- The regression spec proves strategy rows are rendered through the intended project button/control pattern without relying on a random typography class.
- Prefer a stable data attribute such as `data-testid="generated-swap-strategy-option"` plus source-pattern checks for `Button`.
- The check must not fail the Radix dialog close button or legitimate project `Button` output.

### 4. Stop blocked-recovery tests from passing without proof

If the blocked-recovery spec still uses `if (metrics.isBlocked)`, it remains weak.

Required outcome:

- Either create or locate a deterministic non-mutating blocked preview fixture and assert the blocked UI, or explicitly skip with a `fixture-limited` artifact that the final report treats as caveat, not pass evidence.
- The final report must not write `Blocked Recovery: PASS` unless `isBlocked=true` was rendered and asserted.

### 5. Preserve the fixes from Prompt 06

Keep these already-corrected items intact:

- strategy rows use `@/ui/button` or equivalent project primitive;
- `aria-pressed` or equivalent selected state remains present;
- `Review blockers` and `Try manual move` are not shown as fake actions;
- no `Blocking - - Warnings -` placeholder returns;
- no generated swap commit request is sent during browser specs.

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

Full swap sequence gate:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Source guards:

```bash
cd D:\ATLAS
rg -n "<button|<select|title=|Review occupied-slot swap|Blocking - - Warnings -|Review blockers|Try manual move" atlas-client/src/components/timetable/modals qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
git --no-optional-locks status --short --untracked-files=all
```

If backend files are changed, stop and explain why. This prompt should not need backend changes.

## Required Tailnet browser proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Before running browser QA, prove health:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

If Tailnet returns `502`, start the local dev stack and rerun health before claiming live proof:

```bash
cd D:\ATLAS
npm run dev
```

Capture generated swap evidence at:

- `1366x768`
- `390x844`
- `844x390`

For `844x390`, the final report must include:

- screenshot path;
- body `scrollHeight` and `clientHeight`;
- strategy button rectangles;
- footer rectangle;
- list of strategy buttons intersecting the footer band;
- number of fully visible strategy rows;
- whether selected blocker/warning status is visible before scrolling;
- old-scheduler verdict: `usable without first scroll` or `still requires scroll to decide`.

## Acceptance criteria

- `844x390` no longer hides strategy rows behind the footer.
- `844x390` shows blocker/warning status for the selected strategy before scrolling.
- `844x390` has enough visible strategy information for a scheduler to choose or cancel without scrolling first.
- Desktop remains readable and not over-compressed.
- Mobile portrait remains readable and not horizontally clipped.
- Strategy rows remain implemented with project UI primitives.
- The visual-decision spec fails on the exact Prompt 06 screenshot failure.
- Blocked recovery is not counted as PASS unless a blocked state was actually rendered and asserted.
- Draft parity remains honestly reported as fixture-limited if no draft queue fixture exists.
- No timetable write occurs during non-mutating browser proof.

## Required final report

Return one compact final report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- before/after mobile-landscape measurements;
- old-scheduler QA verdict in one sentence;
- files changed;
- command results;
- Tailnet screenshot/artifact paths;
- blocked recovery status: `proven`, `fixture-limited`, or `NO-GO`;
- draft parity status: `proven`, `fixture-limited`, or `NO-GO`;
- committed-scope proof;
- remaining caveats;
- suggested conventional commit message.

Use `GO` only if the mobile-landscape decision can be made without first scrolling and the tests now fail on hidden strategy rows. Otherwise use `CONDITIONAL GO` or `NO-GO`.

