# Antigravity Verification Prompt: Timetable Simplification Recovery Phase 5

You are performing external browser Playwright verification for ATLAS Timetable Simplification Recovery Phase 5.

## Target Environment

- Live Tailnet only: `https://njgrm.buru-degree.ts.net`
- Login as Admin:
  - Username: `1000001`
  - Password: `AdminSY2026!`

## Context

Codex implemented Phase 5 after Antigravity gave Phase 4 a `GO`. Phase 5 is an older-user copy and visual-density pass only. It must not change generation truth, timetable ownership, placement endpoints, publish lifecycle rules, or persisted source ownership.

Expected Phase 5 changes:

1. Grid-wide preview labels use plain action states:
   - `Can place`
   - `Can swap`
   - `Blocked`
   - `Warning`
   - `Occupied`
   - `Current`
2. The task guide includes a persistent legend:
   - `Can place = empty slot. Can swap = occupied slot. Blocked = fix first. Warning = review only.`
3. Task count badges are capped action labels instead of bare numbers, such as `99+ to place` and `99+ blocked`.
4. Generated-unassigned collapsed cards show less badge noise.
5. Generated-unassigned reason/program details remain available after expanding the item.
6. Generated-unassigned recovery buttons are larger and easier to tap/click.
7. Generated unassigned click and drag placement still work.
8. Pre-generation draft placement still opens `Review draft placement`.
9. Generated and draft swaps still use the modern visual review flow.
10. No obsolete `Assign teacher and room`, `Choose teacher`, or `Choose room` timetable modal appears.
11. Phase 4 grid-first layout remains intact.
12. No global browser scrollbars appear.

## Required Commands

Run these from the ATLAS workspace:

```bash
cd atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd ..
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1
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
3. Confirm the page loads with the grid as the primary focus.
4. Confirm no global scrollbar or mobile side-panel squeeze is introduced.
5. Select or drag an unassigned generated session.
6. Confirm grid-wide labels include `Can place`, `Can swap`, `Blocked`, or `Warning` without requiring per-cell hover.
7. Confirm occupied cells still show `Occupied` and switch/swap guidance.
8. Expand a generated unassigned item.
9. Confirm detailed reason/program badges are still present after expansion.
10. Confirm the recovery action target is not tiny and is easy to click/tap.
11. Open a generated occupied-slot swap and confirm the modern visual review flow.
12. Open pre-generation draft planning and confirm draft placement opens `Review draft placement`.
13. Watch for app-critical console errors, page errors, and failed API calls.

## Report Format

```markdown
# AG External Verification Report — Timetable Phase 5

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
| Phase 5 Playwright | PASS/FAIL | |
| Phase 4 regression | PASS/FAIL | |
| Phase 1/2/3/6 regression | PASS/FAIL | |

## Browser Layout Evidence
| Viewport | Global Scrollbar? | Grid First? | Side Panel Squeeze? | Notes |
|---|---|---|---|---|
| Desktop | | | | |
| Mobile Portrait | | | | |
| Mobile Landscape | | | | |

## Functional Evidence
- Grid-wide `Can place` / `Can swap` labels: PASS/FAIL
- Grid-wide `Blocked` / `Warning` labels: PASS/FAIL
- Generated unassigned click placement: PASS/FAIL
- Generated unassigned drag placement: PASS/FAIL
- Generated unassigned expanded details preserved: PASS/FAIL
- Larger generated-unassigned recovery target: PASS/FAIL
- Generated occupied-slot modern swap review: PASS/FAIL
- Pre-generation draft placement review: PASS/FAIL
- Obsolete teacher/room modal absent: PASS/FAIL

## Console/Page/Network Errors
List only app-relevant errors. Separate Tailnet/network noise from app failures.

## UX Second Opinion
Score 1-10 with notes:
- Plain-language clarity
- Visual density
- Older-user suitability
- Mobile readability
- Placement confidence
- Swap confidence

## Blockers
Priority ordered with reproduction steps.

## Recommendations Before Phase 6
Specific, actionable changes only.

## Final Decision
State whether Codex can proceed to Phase 6.
```

## NO-GO Conditions

Mark `NO-GO` if any of these happen:

- Generated unassigned click or drag placement breaks.
- Pre-generation draft placement review fails to appear.
- Modern visual swap review regresses.
- Obsolete teacher/room assignment modal appears in timetable placement/swap.
- Mobile first load is squeezed by open side panels again.
- Global page scrollbars return.
- The new plain-language grid labels are not visible during select/drag.
