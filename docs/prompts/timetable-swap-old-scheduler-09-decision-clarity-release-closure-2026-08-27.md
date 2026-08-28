# Prompt 09 - Swap Decision Clarity Release Closure

## Role

You are the ATLAS executor assigned to close the remaining old-scheduler readiness gaps after Prompt 08.

Do not continue patching the same cramped layout by shaving pixels. Recompose the generated swap review so the screen explains itself: what will change, what ATLAS recommends, what the risk is, and what button to press.

## QA verdict to address

Codex QA marked Prompt 08 `NO-GO` on 2026-08-27 after live Tailnet verification as an older scheduler.

Prompt 08 improved the right-side strategy visibility, but the release proof is still not acceptable:

```text
Full swap Playwright gate:
6 failed / 6 passed / 3 skipped

Failures:
- timetable-swap-old-scheduler-baseline.spec.ts failed on desktop, mobile portrait, and mobile landscape
- timetable-swap-visual-decision.spec.ts failed on desktop, mobile portrait, and mobile landscape

Repeated assertion:
sectionCount expected >= 1, received 0
```

Fresh live `844x390` QA evidence:

- Screenshot: `D:\ATLAS\qa-artifacts\timetable-swap-old-scheduler\manual-old-scheduler-prompt08-844x390.png`
- Dialog: `top 19.5`, `bottom 370.5`, `height 351`
- Body: `scrollHeight 283`, `clientHeight 191`, `requiresScroll true`
- Footer action: `top 306.5`, `bottom 350.5`, `height 44`
- Second affected class chip: `top 225.5`, `bottom 311.5`, intersects footer band
- Selected status: `top 295.5`, `bottom 333.5`, intersects footer band
- Strategy rows: `3` visible and not intersecting footer
- Recommended row: visible and not intersecting footer
- Current decision text: `Blocking 0 • Warnings 890`

Old-scheduler reading:

- The question is clear.
- The strategy options are visible.
- The affected class confirmation is not fully visible.
- The status area and footer visually compete.
- The warning count still feels alarming and unexplained.
- The screen still asks the scheduler to mentally reconcile warnings, unavailable options, class chips, and footer status.

## Required preflight

Before editing:

1. Read:
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-06-qa-blocker-fix-2026-08-27.md`
   - `docs/prompts/timetable-swap-old-scheduler-07-mobile-landscape-decision-fit-2026-08-27.md`
   - `docs/prompts/timetable-swap-old-scheduler-08-landscape-action-sheet-pattern-2026-08-27.md`
2. Inspect:
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
   - `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts`
3. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
git --no-optional-locks show --name-only --format= HEAD
git --no-optional-locks ls-files qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
```

If there are uncommitted changes, identify whether they are unrelated user work before editing. Do not revert unrelated changes.

## Scope

In scope:

- generated occupied-slot swap review UI;
- generated swap decision copy;
- old-scheduler visual hierarchy;
- generated swap browser/spec instrumentation;
- fixture-limited blocked and draft proof honesty;
- source guards for project UI primitive rules.

Out of scope:

- backend swap preview or commit semantics;
- generated timetable algorithm changes;
- publish lifecycle changes;
- Teaching Load ownership rules;
- creating live destructive timetable writes;
- redesigning the whole timetable page outside the swap workflow.

## UI Implementation Directive: Decision-First Swap Review

**Target File(s):** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`, `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`, swap Playwright specs under `qa-artifacts/playwright/specs/`
**Framework Requirements:** `@/ui/*` primitives, `lucide-react`, existing ATLAS Tailwind tokens

**Layout Constraints to Enforce:**
- The first view must answer four questions without scrolling:
  - Which two classes are affected?
  - What is ATLAS recommending?
  - Is the recommended action blocked?
  - What should I press next?
- At `844x390`, both affected classes, the recommended strategy, the selected status, Cancel, and Swap must be fully visible without footer intersection.
- The footer must be a `shrink-0` action zone that does not overlap, cover, or visually bisect decision content.
- The body may only scroll for secondary details, not for the primary decision.
- The modal must not rely on hidden explanatory paragraphs to be understandable.
- The design must remain readable on desktop and mobile portrait.

**Component Selection:**
- Use project `Button` for actions and selectable strategy rows.
- Use `Badge` or the existing status chip pattern for `Recommended`, `No blockers`, `Warnings`, and `Unavailable`.
- Use `Tooltip`, `Popover`, or a compact details sheet for warning explanations. Do not use raw `title`, native `<details>`, native `<select>`, or raw styled `<button>`.
- Use lucide icons only where they clarify state or action.

**Developer Instructions for Claude/Codex:**
"Recompose the generated occupied-slot swap review as a decision-first workflow for older scheduler officers. The screen should behave like a calm decision panel, not a diagnostic report. Preserve the server-owned preview contract and selected-strategy behavior, but make the default path obvious: see the two affected classes, see the recommended action, understand whether it is blocked, then cancel or swap. Do not solve fit by using unreadably tiny text or hiding primary decision data."

## Required fixes

### 1. Rebuild the primary decision layout

Replace the current split layout with a structure that is explicitly measured by tests.

Required primary regions:

- `Swap pair`: a compact visual pair showing the two affected classes and their day/time/section.
- `Recommended action`: the selected/recommended strategy with blocker status and warning summary.
- `Action bar`: Cancel and Swap controls with one short status sentence or status pill.

Required data attributes:

- `data-testid="generated-swap-review-dialog"`
- `data-testid="generated-swap-primary-region"` on each primary region
- `data-testid="generated-swap-pair-region"`
- `data-testid="generated-swap-recommended-region"`
- `data-testid="generated-swap-action-region"`
- `data-testid="generated-swap-strategy-option"` on strategy controls
- `data-testid="generated-swap-selected-status"` on selected blocker/warning status
- `data-testid="generated-swap-secondary-details-toggle"` if secondary warnings/details are hidden behind a control

Do not leave tests guessing from heading levels or incidental class names.

### 2. Make warnings calm and inspectable

Replace alarming inline copy such as:

```text
Blocking 0 • Warnings 890
```

with scheduler-facing decision copy:

```text
No blockers
890 warnings to review after swap
```

Required behavior:

- If hard blockers are `0`, the primary status must say `No blockers`.
- If hard blockers are greater than `0`, the primary status must say the swap is blocked and disable commit.
- Soft warnings must not read like a hard stop.
- Warning details must be reachable through a project primitive (`Popover`, `Sheet`, or equivalent), but the warning list must not dominate the primary decision.

### 3. Keep secondary strategies from crowding the decision

For non-blocked swaps, the recommended/selected strategy is the main decision.

Required behavior:

- The recommended strategy must be visually primary.
- Alternate strategies may be shown as compact secondary options on desktop and mobile portrait.
- At `844x390`, alternate unavailable strategies may collapse behind a visible control such as `Other options`, as long as the scheduler can see that alternatives exist.
- Do not show disabled unavailable rows as large competing actions in short-height landscape.
- If an alternate strategy is available, selecting it must update `generated-swap-selected-status`.

### 4. Fix the affected-class visibility

The two class cards/chips must fit before the action bar.

Required `844x390` outcome:

- both class chips are fully visible;
- neither class chip intersects the footer/action region;
- no class chip is partially clipped by the bottom of the dialog;
- day/time labels are readable without line soup;
- repeated subject/section labels may be compacted if both classes share the same subject or section.

### 5. Harden the browser specs

Update the swap specs so they match the new intentional structure and fail on Prompt 08's state.

Required assertions:

- Count `generated-swap-primary-region`; expected `3`.
- Assert `generated-swap-pair-region`, `generated-swap-recommended-region`, and `generated-swap-action-region` are visible.
- Measure pair chips, recommended row, selected status, and action region rectangles.
- Fail if any primary region intersects the action region.
- Fail if body scroll is required for the primary decision at `844x390`.
- Fail if `No blockers` is absent when hard blockers are `0`.
- Fail if raw `Blocking 0 • Warnings` copy appears in the primary decision.
- Fail if strategy controls are not implemented through the project Button/control pattern.
- Continue proving no global horizontal overflow.
- Continue proving non-mutating browser specs do not send swap commit writes.

Do not simply weaken or remove the old `sectionCount` assertion. Replace it with explicit primary-region assertions.

### 6. Preserve Prompt 06-08 improvements

Keep these fixes intact:

- no raw option-row `<button>`;
- no native `<select>`;
- no raw `title` tooltip;
- `aria-pressed` or equivalent selected state remains present;
- `Review blockers` and `Try manual move` do not return as fake actions;
- blocked state has honest next action copy;
- recommended strategy is visible;
- strategy rows do not intersect the footer;
- draft parity and blocked recovery are not overclaimed when fixtures are unavailable.

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
rg -n "<button|<select|title=|Review occupied-slot swap|Blocking 0 \u2022 Warnings|Blocking - - Warnings -|Review blockers|Try manual move" atlas-client/src/components/timetable/modals qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks diff -- atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
```

If backend files are changed, stop and explain why. This prompt should not need backend changes.

## Required Tailnet browser proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Before browser QA:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

If Tailnet returns `502`, start the local dev stack and rerun health before claiming live proof:

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
- whether body scroll is required before primary decision;
- pair region rectangle;
- recommended region rectangle;
- selected status rectangle;
- action region rectangle;
- list of primary regions intersecting the action region, expected `[]`;
- visible copy for blocker and warning status;
- old-scheduler verdict: `can decide without mental gymnastics` or `still requires interpretation`.

## Acceptance criteria

- The generated swap review exposes exactly three primary decision regions.
- At `844x390`, both affected classes are fully visible before the action bar.
- At `844x390`, the recommended action and selected blocker/warning status are fully visible before the action bar.
- At `844x390`, no primary decision region intersects the action region.
- At `844x390`, primary decision content does not require body scroll.
- The primary status says `No blockers` when hard blockers are `0`.
- Soft warning counts are framed as post-swap review work, not a hard stop.
- Unavailable alternate strategies do not compete visually with the recommended action in short-height landscape.
- Desktop and mobile portrait remain readable and do not inherit cramped landscape-only decisions.
- Full swap Playwright gate passes or any fixture-limited skips are explicitly limited to draft/blocked fixtures, not generated swap.
- Static gates pass.
- Product GO remains pending real older-scheduler moderated validation unless the stakeholder explicitly accepts automated proof.

## Required final report

Return one compact final report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- whether Prompt 08's `sectionCount=0` spec failure is fixed;
- before/after `844x390` measurements;
- old-scheduler QA verdict in one sentence;
- files changed;
- command results;
- Tailnet screenshot/artifact paths;
- blocked recovery status: `proven`, `fixture-limited`, or `NO-GO`;
- draft parity status: `proven`, `fixture-limited`, or `NO-GO`;
- committed-scope proof;
- remaining caveats;
- suggested conventional commit message.

Use `GO` only if the generated swap path passes live browser proof and the primary decision can be made without scrolling or interpreting diagnostic-style copy.

