# Antigravity Final Verification Prompt: Timetable Simplification Recovery Phase 6

You are performing final external browser Playwright verification for ATLAS Timetable Simplification Recovery Phase 6.

## Target Environment

- Live Tailnet only: `https://njgrm.buru-degree.ts.net`
- Login as Admin:
  - Username: `1000001`
  - Password: `AdminSY2026!`

## Context

Codex completed Phase 6 after Antigravity returned Phase 5 `GO`.

Phase 6 is the final release validation pass for timetable simplification. It must prove the Phase 0-6 timetable simplification recovery remains intact after all UX/UI, performance, and workflow fixes.

Do not broaden scope. Do not implement new features. Verify and report.

## Final Expected Behavior

1. `/timetable` first load remains grid-first.
2. Desktop, mobile portrait, and mobile landscape do not introduce global browser scrollbars.
3. Compact viewports do not squeeze the grid with open side panels.
4. Advanced filters remain behind the `Filters` popover.
5. The task guide remains compact and includes the status legend:
   - `Can place = empty slot. Can swap = occupied slot. Blocked = fix first. Warning = review only.`
6. Selecting or dragging a generated unassigned session shows grid-wide labels without per-cell hover:
   - `Can place`
   - `Can swap`
   - `Blocked`
   - `Warning`
   - `Occupied`
   - `Current`
7. Generated unassigned click placement still works.
8. Generated unassigned drag placement still works.
9. Generated unassigned expanded details still preserve reason/program context.
10. Generated unassigned recovery controls remain easy to click/tap.
11. Generated occupied-slot swap uses the modern visual review flow.
12. Pre-generation draft planning opens quickly.
13. Pre-generation draft placement opens `Review draft placement`.
14. Draft and generated placement/swap flows do not show obsolete teacher/room assignment controls.
15. Obsolete timetable placement text must be absent:
   - `Assign teacher and room`
   - `Choose teacher`
   - `Choose room`
16. Live conflict feedback remains visible/useful during click and drag.
17. Non-preview writes must not be committed during verification.
18. App-critical console errors, page errors, API 500s, and error boundaries must be reported as blockers.

## Required Commands

Run these from the ATLAS workspace:

```bash
cd atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd ..
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1
```

If a lint script exists, run it. If no lint script exists, report that clearly instead of treating it as a failure.

## Manual Browser Checks

Test these viewports:

- Desktop: `1440x900`
- Mobile portrait: `390x844`
- Mobile landscape: `844x390`

For each viewport:

1. Login as Admin.
2. Navigate to `/timetable`.
3. Capture console errors, page errors, failed requests, and API 500s.
4. Record whether the timetable table and first useful action are visible.
5. Record whether global vertical or horizontal scrollbars exist.
6. Confirm the grid is not squeezed by open side panels.
7. Open the `Filters` popover and verify advanced filters are disclosed there.
8. Open generated unassigned workflow.
9. Scroll the generated unassigned list.
10. Select a generated unassigned session and confirm grid-wide guidance appears.
11. Drag a generated unassigned session and confirm grid-wide guidance appears.
12. Confirm `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, or `Current` labels are visible as applicable.
13. Open a generated occupied-slot swap and confirm the modern visual review flow.
14. Open pre-generation draft planning.
15. Place a draft queue item and confirm `Review draft placement` appears.
16. Confirm no obsolete teacher/room assignment modal appears.
17. Confirm no live write is committed during the verification run.

## Report Format

```markdown
# AG Final Verification Report — Timetable Simplification Phase 6

## Verdict
GO / NO-GO

## Summary
Short factual summary.

## Automated Test Results
| Command | Result | Notes |
|---|---:|---|
| npx tsc --noEmit | PASS/FAIL | |
| npm run test:ux-guardrails | PASS/FAIL | |
| npm run test:timetable-conflict | PASS/FAIL | |
| npm run build | PASS/FAIL | |
| Full Phase 1-6 Playwright matrix | PASS/FAIL | |
| lint, if available | PASS/FAIL/N/A | |

## Browser Layout Evidence
| Viewport | Table Visible? | First Action Visible? | Global Scrollbar? | Grid Squeezed? | Notes |
|---|---|---|---|---|---|
| Desktop | | | | | |
| Mobile Portrait | | | | | |
| Mobile Landscape | | | | | |

## Functional Evidence
- Filters popover preserves advanced filters: PASS/FAIL
- Generated unassigned list scrolling: PASS/FAIL
- Generated unassigned click placement: PASS/FAIL
- Generated unassigned drag placement: PASS/FAIL
- Grid-wide plain-language guidance: PASS/FAIL
- Generated occupied-slot modern swap review: PASS/FAIL
- Pre-generation draft planning: PASS/FAIL
- Pre-generation draft placement review: PASS/FAIL
- Obsolete teacher/room modal absent: PASS/FAIL
- Live conflict feedback visible/useful: PASS/FAIL
- Verification avoided live write commits: PASS/FAIL

## Console/Page/Network Errors
List app-critical findings. Separate Tailnet/network noise from app failures.

## Blockers
Priority ordered with reproduction steps.

## Final Decision
State whether timetable simplification recovery Phase 0-6 can be considered externally closed.
```

## NO-GO Conditions

Mark `NO-GO` if any of these occur:

- Any required automated command fails.
- Generated unassigned click or drag placement breaks.
- Pre-generation draft placement review fails to appear.
- Modern swap review regresses.
- Obsolete teacher/room assignment modal appears in timetable placement/swap.
- Mobile first load is squeezed by open side panels again.
- Global page scrollbars return.
- Grid-wide plain-language guidance is not visible during select/drag.
- App-critical console/page/network errors appear.
- The verification commits a live timetable write.
