# DeepSeek Prompt 01 — Dashboard First-Screen Recovery

## Role

You are the implementation executor for ATLAS. Codex is acting as QA/reviewer after you finish. Implement only this prompt, then stop and report.

## Context

The latest QA pass found that the Dashboard is still not older-user-first enough. It technically follows the SMART-family pattern, but the first useful work area is too low, especially on mobile.

Failing evidence from Tailnet:

- `cross-page-ux-release-readiness.spec.ts`
  - desktop `/`: first useful content `288px`, budget `<=260px`.
  - mobile portrait `/`: first useful content `456px`, budget `<=260px`.
  - mobile landscape `/`: first useful content `238px`, budget `<=180px`.
- Screenshot evidence shows the full `Year aligned` card appears even when there is no action required. This card pushes the actual `Your next step` card down.

## Objective

Make the Dashboard first screen answer: `What should I do next?` before showing detailed status explanations.

## Scope

Target page:

- `/`
- Dashboard components only, plus shared runtime guidance components only if needed.

Likely files:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx`
- Dashboard readiness/source components if Dashboard delegates those surfaces.
- `qa-artifacts/playwright/specs/cross-page-ux-release-readiness.spec.ts` only if the test is stale after the product fix. Do not relax budgets unless the product behavior is demonstrably correct and Codex QA agrees later.

## Required UX Behavior

### Normal aligned state

When ATLAS and EnrollPro are aligned and no year action is required:

- Do not render a full-width `Year aligned` card above `Your next step`.
- Show year state as a compact chip or popover item in the header/readiness area.
- Keep the full explanation available through Help, More, or source details.
- The first primary work object must be `Your next step`.

### Blocking drift states

When runtime drift is `atlas-stale`, `mapping-conflict`, or `enrollpro-unreachable`:

- It is acceptable to show a visible guidance card.
- The card must still be compact.
- It must state one clear action:
  - `Sync from EnrollPro`
  - `Reset dummy data and sync`
  - `Check source connection`

### Mobile ordering

On mobile portrait:

- `Your next step` must appear before the full setup readiness list.
- The setup readiness list may be compacted to three visible items plus `View all setup steps`.
- Source details should be one chip/popover, not repeated paragraphs.

On mobile landscape:

- The header plus normal aligned year/source status must stay shallow.
- `Your next step` should be visible immediately after the command row.

## Acceptance Criteria

- Dashboard first useful content meets:
  - desktop `/` `<=260px`.
  - mobile portrait `/` `<=260px`.
  - mobile landscape `/` `<=180px`.
- `/sections` mobile landscape first useful content stays `<=250px`.
- No global vertical browser scrollbar.
- No horizontal overflow.
- No visible text overlap.
- No long source-truth paragraph is visible in the primary Dashboard command/header area.
- Aligned year information remains discoverable.
- Blocking drift still gives clear guidance.
- SMART-family rhythm is preserved: compact command bar, source chip, one primary action, local scroll.

## Required Verification

Run:

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run build
```

Then run Tailnet browser gate:

```powershell
cd D:\ATLAS
$env:PLAYWRIGHT_ADMIN_EMAIL='1234501'
$env:PLAYWRIGHT_ADMIN_PASSWORD='DepEdSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/cross-page-ux-release-readiness.spec.ts qa-artifacts/playwright/specs/smart-parity-cross-page.spec.ts --workers=1 --reporter=line
```

If browser testing fails, classify each failure as:

- `product-failure`
- `stale-selector`
- `fixture-unavailable`
- `dev-stack-unavailable`

## Do Not Do

- Do not redesign Timetable.
- Do not change rollover backend logic in this prompt.
- Do not change generation or Teaching Load data rules.
- Do not run dummy-year reset.
- Do not weaken the older-user budgets to hide the Dashboard issue.

## Final Report Format

Return:

1. `GO` or `NO-GO`.
2. What changed.
3. Before/after first-useful-content measurements.
4. Test results.
5. Screenshot/trace artifact paths.
6. Any remaining caveats.

