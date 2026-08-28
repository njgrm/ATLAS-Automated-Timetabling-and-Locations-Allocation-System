# Home-Room Grade Scope Prompt 04 - Sections UI Auto-Assign

## Role

You are the ATLAS frontend executor for the Sections homeroom auto-assign workflow. Build the operator UI for preview/apply using the backend from Prompt 03.

## Required preflight

Before editing:

1. Read Prompt 01 through Prompt 03 final reports.
2. Verify Prompt 03 completed and inspect any recorded `NO-GO` caveats.
3. Inspect `atlas-client/src/pages/Sections.tsx` and existing home-room manual edit flows.
4. Inspect shared UI primitives under `atlas-client/src/ui` or the repo's local UI folder.
5. Re-run `git --no-optional-locks status --short`.
6. Identify UI, API, or stale-cache blockers. If blockers exist, record `NO-GO` and continue only if the UI can still be implemented against a stable backend contract.

## Problem

Schedulers should not assign every section homeroom one row at a time when there is enough room/building data for ATLAS to propose safe assignments. The UI must preview the plan first, explain skipped sections, and only apply after the operator confirms.

## Target files

- `atlas-client/src/pages/Sections.tsx`
- Add focused components if `Sections.tsx` is too large or if extraction improves clarity:
  - `atlas-client/src/components/sections/HomeRoomAutoAssignDialog.tsx`
  - `atlas-client/src/components/sections/HomeRoomAutoAssignSummary.tsx`
- `atlas-client/src/types.ts`
- Any API helper used by Sections
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`

## UI contract

Add a compact action near the existing home-room readiness/toolbar area:

```text
Auto assign home rooms
```

The action opens a dialog or sheet with:

- Preview button or automatic preview on open.
- Summary counts:
  - sections considered
  - proposed assignments
  - skipped sections
  - existing preserved
- Toggle or checkbox:
  - `Keep existing assignments` default on
  - `Allow cross-grade fallback` default off
- Proposed assignments list grouped by grade.
- Skipped sections list with reason labels.
- Apply button disabled until preview succeeds.
- Refresh/preview again action.
- Clear success/error status after close or school-year change.

## UI requirements

- Use `@/ui/*` Button, Dialog/Sheet, Badge, Checkbox/Switch, Tooltip/Popover, and ScrollArea/Table primitives where available.
- Do not use native `<select>`.
- Do not add raw styled buttons.
- Keep the existing manual home-room row controls.
- Keep queued offline manual edit behavior intact.
- After apply succeeds, refresh section summary and home-room options.
- Show an explicit success message with applied count.
- Show an explicit no-op message when there are no missing home rooms.
- If preview returns skipped sections, show why without blocking valid assignments.
- If apply fails, preserve the preview result so the operator can retry.
- On small screens, the dialog/sheet content must scroll locally, not at the browser window.
- Do not add a large hero/card block. This belongs in the setup table workflow.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Add or update UX guardrail tests to prove:

- The Sections source contains the auto-assign workflow.
- No native `<select>` was introduced.
- The workflow uses shared UI primitives.
- The apply action is gated behind preview state.
- The UI includes skipped-section reasons.

If a component file exceeds 1000 lines or approaches that limit, extract logical subcomponents before continuing.

## Browser/Tailnet proof

Using Admin auth on Tailnet:

1. Navigate to `/sections`.
2. Confirm the auto-assign action is visible only for privileged users.
3. Open the workflow.
4. Run preview.
5. Confirm proposed assignment counts match the backend preview.
6. Confirm skipped reasons render if present.
7. Confirm small viewport layout has no global browser scrollbar caused by the dialog/sheet.
8. Do not click Apply on Tailnet unless the user has explicitly authorized live data mutation.

Required viewports:

- `1366x768`
- `390x844`
- `844x390`

## Acceptance criteria

- Operators can preview homeroom auto-assignment.
- Operators can apply only after preview.
- Manual row-level assignment remains available.
- UI respects ATLAS SMART-family compact setup patterns.
- UI does not weaken live-data/source-honesty messaging.

## Per-prompt evidence required

Record this prompt's evidence for the final sequence handoff. Include screenshots or Playwright evidence paths if browser QA was run. Continue to Prompt 05 after command and browser gates finish.
