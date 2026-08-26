# DeepSeek Prompt 03 — Older-User Validation Spec Realignment

## Role

You are the implementation executor for ATLAS. Codex is acting as QA/reviewer after you finish. Implement only this prompt, then stop and report.

## Context

The older-user browser proxy spec currently fails because it expects the old timetable control:

- `data-testid="timetable-layout-toggle"`

The current Simple timetable header no longer exposes that exact control. The visible current controls include:

- `Tutorial`
- `Generate`
- `More`
- current Simple schedule switcher controls

The failure is likely stale-selector/test-contract drift, not necessarily a product defect. However, the older-user validation gate is currently not usable, so we cannot claim older-user Product GO from it.

Failing file:

- `qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts`

Failure:

```text
TimeoutError: locator.focus: Timeout 12000ms exceeded.
waiting for getByTestId('timetable-layout-toggle')
```

## Objective

Realign the older-user validation spec to the current Simple-default timetable contract without weakening the older-user intent.

## Scope

Target test/spec work:

- `qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts`
- shared timetable Playwright helpers if relevant.

Target app work only if the current UI lacks a stable accessible path:

- Add or restore stable test IDs on current controls.
- Do not redesign the timetable.

## Current Product Contract

The test should validate the current timetable behavior:

- Simple view is default.
- Advanced view is opt-in and reachable through the current Simple path.
- Simple tutorial is manually triggered and does not auto-block the page.
- Schedule switching remains available in Simple view.
- Start placing remains available.
- Placement, swap, details, and status guidance remain discoverable.
- More groups expose secondary/expert controls.

## Required Test Changes

Replace hardcoded old toggle assumptions with current paths:

- If there is a visible current `Advanced view` action under `More`, use that.
- If there is a stable current test id for the Simple More trigger, use it.
- If no stable current ids exist, add minimal stable test IDs to the app:
  - `timetable-simple-more-trigger`
  - `timetable-simple-advanced-view-action`
  - `timetable-simple-status-key-action`
  - `timetable-simple-help-trigger`
- Keep the focus-order test. It should focus the current control that opens advanced/help, not a removed control.

## Acceptance Criteria

- `older-user-session-validation-codex.spec.ts` passes across:
  - desktop
  - mobile portrait
  - mobile landscape
- The test still verifies:
  - no committing timetable writes;
  - no uncaught page errors;
  - no ATLAS API 5xx responses;
  - no global overflow;
  - controls meet minimum accessibility target size expectations;
  - Simple-to-Advanced-to-Simple path is reachable or correctly classified when viewport hides it;
  - placement/swap review surfaces can open and cancel safely;
  - focus can move predictably after opening/closing a current control.
- Do not mark proxy-limited tasks as product pass unless the spec already classifies them as proxy limitations.

## Required Verification

Run:

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run build
```

Run Tailnet browser gate:

```powershell
cd D:\ATLAS
$env:PLAYWRIGHT_ADMIN_EMAIL='1234501'
$env:PLAYWRIGHT_ADMIN_PASSWORD='DepEdSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts --workers=1 --reporter=line
```

Also run a current timetable smoke gate:

```powershell
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-view-completion.spec.ts qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts --workers=1 --reporter=line
```

## Do Not Do

- Do not reintroduce the old visible toggle if the current Simple header intentionally moved Advanced under More.
- Do not skip older-user tasks just because selectors changed.
- Do not change generation, Teaching Load, published revision, or timetable placement logic.
- Do not commit live timetable writes.

## Final Report Format

Return:

1. `GO` or `NO-GO`.
2. Whether the failure was stale selector, product gap, or mixed.
3. Files changed.
4. Current Simple-view paths used by the spec.
5. Test results across all three viewports.
6. Remaining caveats for moderated older-user validation.

