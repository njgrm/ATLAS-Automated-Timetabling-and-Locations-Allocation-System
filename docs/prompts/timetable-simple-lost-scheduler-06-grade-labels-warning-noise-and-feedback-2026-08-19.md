# Prompt 06 — Grade Labels, Warning Noise, and Feedback Hardening

## Goal

Clean up remaining Simple timetable visual inconsistencies and harden feedback so every warning, disabled action, and failure explains what to do next.

## Context

Source inspection found remaining compact grade labels rendered as `G7`, `G8`, etc. in timetable components, despite the project decision that compact grade labels are `GR7`, `GR8`, `GR9`, and `GR10`.

Grid warning badges can also create alarm fatigue when many warnings are visible. Simple mode should keep the grid scannable while still making warnings discoverable.

## Target files

Primary candidates:

- `atlas-client/src/lib/grade-labels.ts`
- `atlas-client/src/lib/deped-glossary.ts`
- `atlas-client/src/hooks/useTimetableLookupHelpers.ts`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx`
- timetable grid/card components that render warning badges.

## Tasks

1. Replace all timetable-visible `G{grade}` compact labels with the existing `GR{grade}` helper.
2. Do not change long labels like `Grade 7` where long-form text is appropriate.
3. Add regression coverage preventing `G7`, `G8`, `G9`, or `G10` in visible timetable Simple surfaces.
4. Reduce warning noise in Simple grid cards:
   - show one compact warning indicator by default;
   - show full warning details only when selected, in details, or in Review issues;
   - keep blockers visually stronger than warnings.
5. Ensure warning and blocker states are not color-only:
   - labels must include text such as `Blocked`, `Warning`, `Needs room`, `Needs teacher`.
6. Standardize disabled/error feedback for Simple timetable surfaces:
   - what happened;
   - why it is blocked;
   - what to do next;
   - whether retry is safe.
7. Add `aria-live="polite"` status updates where preview/save/export/generate/publish states change.

## UX requirements

- Do not hide warnings entirely.
- Do not add large banners.
- Do not turn grid cards into walls of badges.
- Do not expose raw enum names or raw IDs.
- Keep touch targets practical.
- Preserve current status key functionality.

## Acceptance criteria

- Visible Simple timetable surfaces use `GR7` compact labels, not `G7`.
- Warning-heavy grids remain visually scannable.
- Selecting a warning-bearing class exposes readable details.
- Publish, generate, placement, swap, export, and refresh errors show a next step.
- Disabled actions explain why beside or directly near the action.
- No obsolete `Assign teacher and room`, `Choose teacher`, or `Choose room` timetable-owned modal language returns.

## Required tests

Update or add:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts`
- `qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts`
- unit tests for grade-label helper usage if applicable.

Assertions:

- no visible compact `G7/G8/G9/G10` labels in Simple timetable surfaces;
- warning details are available on selection;
- grid cards do not exceed a defined badge budget;
- disabled actions expose a reason;
- API failure simulations produce plain next-step guidance.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- list of grade-label replacements
- before/after warning-heavy grid screenshots
- feedback examples for blocked/failed actions
- files changed
- exact commands and results
- remaining caveats
