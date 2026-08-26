# Timetable Default Layout Redesign Closure — 2026-07-21

## Verdict

Codex self-validation: GO for Iterations E-H, pending Antigravity external verification and moderated older-user validation.

## Scope completed

- Iteration E: Simple view is now the default timetable shell with a slim source/status/next-step header.
- Iteration F: Persistent default rails are replaced by focused task drawers opened only after task selection.
- Iteration G: Simple-mode grid cards use larger targets, reduced section-view microtext, `aria-live` next-step feedback, and preserved grid-wide placement/swap guidance.
- Iteration H: Tailnet browser verification, performance gate rerun, evidence update, and four Antigravity review prompts were created.

## Files changed

- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceBody.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.constants.ts`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleTypes.ts`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts`

## Verification commands

```text
npx tsc --noEmit
PASS

npm run test:ux-guardrails
PASS 29/29

npm run test:timetable-conflict
PASS 10/10

npm run build
PASS

npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts --workers=1
PASS 9/9 across desktop, mobile portrait, and mobile landscape

PLAYWRIGHT_ADMIN_EMAIL=1000001 PLAYWRIGHT_ADMIN_PASSWORD=AdminSY2026! npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
PASS 42/42 across desktop, mobile portrait, and mobile landscape
```

## Failures found and fixed

- Mobile portrait initially placed the timetable grid at `243px` because the Simple prompt stacked vertically. The prompt is now a compact single row on mobile.
- The performance matrix initially failed only the final gate verdict because Simple view hid the old filter trigger. Simple view now exposes a visible `Filters` action that routes to Advanced view where the full filter controls live.
- Final code review found `TimetableGrid.tsx` over the 1000-line component cap after the redesign. Small constants/helpers were extracted to `TimetableGrid.constants.ts`, and `TimetableGrid.tsx` now sits at exactly `1000` lines.

## Tailnet notes

- `/api/v1/health` returned HTTP `200`.
- The performance matrix reported repeated non-fatal `net::ERR_ABORTED` lines for EnrollPro public settings and Vite lazy chunks. These did not fail navigation, interaction, or performance assertions.

## Antigravity review prompts

- `docs/prompts/antigravity-timetable-default-layout-iteration-e-validation-2026-07-21.md`
- `docs/prompts/antigravity-timetable-default-layout-iteration-f-validation-2026-07-21.md`
- `docs/prompts/antigravity-timetable-default-layout-iteration-g-validation-2026-07-21.md`
- `docs/prompts/antigravity-timetable-default-layout-iteration-h-validation-2026-07-21.md`
