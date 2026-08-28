# Timetable Finalization Caveats Plan - 2026-07-27

## Objective

Close the remaining caveats from the Iterations E-H review so the timetable page can be treated as final from a UX/UI, workflow, and Playwright verification standpoint.

The E-H implementation is functionally and performance-wise `GO`, but final closure still requires adapting older regression tests to the new Simple/Advanced layout contract, resolving one cross-page density caveat, and producing a final verification matrix that reflects the actual current UI instead of the removed cockpit defaults.

## Current Evidence Baseline

Latest Codex assessment on the live Tailnet target `https://njgrm.buru-degree.ts.net`:

- `npx tsc --noEmit`: PASS.
- `npm run test:ux-guardrails`: PASS `29/29`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- `npm run build`: PASS.
- `qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts`: PASS `9/9`.
- `qa-artifacts/playwright/specs/timetable-performance.spec.ts`: PASS `42/42`.
- Visual probe:
  - desktop grid top: `207px`;
  - mobile portrait grid top: `195px`;
  - mobile landscape grid top: `207px`;
  - Simple mode old task guide count: `0`;
  - Simple mode default drawer count: `0`;
  - global overflow: none.

## Caveats To Close

### Caveat 1 - A-D Regression Specs Still Assert Old Default UI

Older Playwright specs fail because they still expect cockpit-era default elements:

- `data-testid="timetable-task-guide"`;
- `data-testid="timetable-task-place"`;
- default persistent left/right rail behavior.

These are not product failures after E-H. They are stale test contracts. E-H intentionally moved those surfaces behind Simple-mode task drawers or Advanced view.

### Caveat 2 - Broader `/sections` Header Density Is Still Borderline

The old Iteration C suite still reports `/sections` first useful content too low:

- desktop content top around `251px` versus threshold `220px`;
- mobile portrait content top around `293px` versus threshold `245px`;
- mobile landscape content top around `245px` versus threshold `220px`.

This is outside the E-H timetable route, but it is a valid cross-page UX caveat if the broader SMART-family simplification stream must be final.

### Caveat 3 - Tailnet Runtime Needs A Preflight Contract

The first live probe returned `502 Bad Gateway` until the local ATLAS dev runtime was started. Final verification should not burn time diagnosing false app failures caused by a stopped local process.

### Caveat 4 - Moderated Older-User Evidence Is Still Product-Pending

Automated tests prove layout, performance, and mechanics. They do not prove that older non-technical scheduler officers can complete tasks without coaching.

## Finalization Iterations

## Iteration I - Test Contract Adaptation For Simple/Advanced Layout

### Goal

Update the A-D Playwright regression suite so it verifies the current product contract:

- Simple view is the default.
- Advanced view restores old expert cockpit affordances.
- Prior workflows remain available through Simple task drawers or Advanced view.

### Work

1. Create shared timetable Playwright helpers:
   - `loginAdmin(page)`;
   - `openTimetableSimple(page)`;
   - `openTimetableAdvanced(page)`;
   - `openTaskDrawer(page, taskName)`;
   - `assertNoGlobalOverflow(page)`.
2. Update old A/B/D specs that currently wait for `timetable-task-guide`:
   - If testing old cockpit features, switch to Advanced view first.
   - If testing user-facing Simple behavior, assert `timetable-simple-header` and task drawer behavior instead.
3. Update old D specs that wait for `timetable-task-place`:
   - Simple-mode equivalent: `timetable-simple-primary-action` or `More -> Place unresolved sessions`;
   - Advanced-mode equivalent: switch to Advanced, then use legacy task buttons if still relevant.
4. Keep the E-H default-layout spec as the canonical Simple-mode gate.
5. Prevent future stale expectations by adding a static guardrail:
   - old cockpit test IDs may appear only in Advanced-mode tests;
   - Simple-mode tests must use Simple header/drawer IDs.

### Exit Criteria

- `timetable-overhaul-iteration-a.spec.ts` no longer fails only because Simple mode removed `timetable-task-guide`.
- `timetable-overhaul-iteration-b.spec.ts` validates generated placement through Simple task drawer or Advanced view deliberately.
- `timetable-overhaul-iteration-d.spec.ts` validates first useful timetable action using Simple-mode controls.
- The combined A/B/D + E-H timetable route matrix passes across desktop, mobile portrait, and mobile landscape.

### Verification

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1
```

## Iteration J - Cross-Page Header Density Cleanup

### Goal

Close the remaining `/sections` header-density caveat without weakening timetable simplification.

### Work

1. Audit `/sections`, `/subjects`, `/faculty`, and `/teaching-load` on live Tailnet.
2. Identify why `/sections` content starts around `251-293px`.
3. Compact only redundant vertical bands:
   - oversized command description text;
   - repeated status cards;
   - non-primary controls that can move into a popover/dropdown;
   - extra margins above the data table.
4. Preserve:
   - no global scroll architecture;
   - clear page identity;
   - primary action visibility;
   - older-user readable targets.
5. Update the Iteration C gate thresholds only if the old threshold is no longer compatible with a deliberate, measured design decision. Do not relax thresholds just to pass.

### Exit Criteria

- `/sections` first useful content top:
  - desktop: `<= 220px`;
  - mobile portrait: `<= 245px`;
  - mobile landscape: `<= 220px`.
- `/subjects`, `/faculty`, and `/teaching-load` do not regress.
- No global scrollbar or horizontal overflow appears.

### Verification

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1
```

## Iteration K - Tailnet Preflight And Runtime-Stability Gate

### Goal

Make final verification reproducible by checking the local runtime behind Tailnet before running browser suites.

### Work

1. Document the preflight sequence:
   - start `npm run dev` from `D:\ATLAS` if no local ATLAS runtime is active;
   - verify client `http://127.0.0.1:5174`;
   - verify server `http://127.0.0.1:5001/api/v1/health`;
   - verify Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health`.
2. Add this preflight to the final AG validation prompt or a small QA checklist.
3. Classify failures:
   - `502` before local health passes = runtime-preflight failure, not product failure;
   - app console exception after health passes = product failure;
   - non-fatal lazy chunk `ERR_ABORTED` during navigation = noise unless it blocks visible UI or assertions.

### Exit Criteria

- Browser test runs begin only after local and Tailnet health return HTTP `200`.
- Final report separates runtime-preflight issues from app regressions.

### Verification

```powershell
try { Invoke-WebRequest -Uri http://127.0.0.1:5174 -UseBasicParsing -TimeoutSec 10 } catch { $_.Exception.Message }
try { Invoke-WebRequest -Uri http://127.0.0.1:5001/api/v1/health -UseBasicParsing -TimeoutSec 10 } catch { $_.Exception.Message }
try { Invoke-WebRequest -Uri https://njgrm.buru-degree.ts.net/api/v1/health -UseBasicParsing -TimeoutSec 20 } catch { $_.Exception.Message }
```

## Iteration L - Final Timetable Closure Matrix

### Goal

Run the final timetable page verification against the new layout contract and close the page technically.

### Required Pass Matrix

1. Local/static gates:
   - TypeScript;
   - UX guardrails;
   - conflict engine;
   - production build.
2. Browser layout gates:
   - default Simple view;
   - Advanced view round-trip;
   - task drawer open/close;
   - no global overflow;
   - grid top budget.
3. Workflow gates:
   - generated unassigned click-to-place;
   - generated unassigned drag-to-place;
   - generated occupied-slot swap;
   - pre-generation draft placement;
   - modern review sheet only;
   - no timetable-owned teacher assignment.
4. Performance gates:
   - full `timetable-performance.spec.ts`;
   - drag containment;
   - no header/left/right commit storm;
   - no long tasks.

### Exit Criteria

- All updated timetable Playwright suites pass across desktop, mobile portrait, and mobile landscape.
- All relevant artifacts are linked in `docs/verification/evidence-log.md`.
- The final verdict distinguishes:
  - `Technical GO`;
  - `AG external GO`;
  - `Moderated older-user GO`.

### Verification

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1
$env:PLAYWRIGHT_ADMIN_EMAIL='1000001'
$env:PLAYWRIGHT_ADMIN_PASSWORD='AdminSY2026!'
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Iteration M - Moderated Older-User Validation

### Goal

Confirm that the simplified page is understandable to actual or representative older non-technical scheduler users.

### Script

Ask each participant to complete these tasks without coaching:

1. Tell us whether the schedule is ready or needs work.
2. Start placing unresolved sessions.
3. Explain what a green slot means.
4. Explain what a blocked slot means.
5. Cancel safely from a review screen.
6. Start swapping two sessions.
7. Find Advanced view.
8. Return to Simple view.

### Success Metrics

- `80%` of participants complete tasks 1-6 without direct coaching.
- `100%` can return from Advanced view to Simple view after being told Advanced exists.
- No participant interprets timetable as the place to assign teachers.
- No participant is blocked because drag is required.

### Exit Criteria

- Findings are documented in `docs/verification/`.
- Must-fix usability issues are converted into implementation tasks.
- If no must-fix issues remain, timetable page can move from `Technical GO` to `Product GO`.

## Dependency Order

```text
Iteration K can run immediately before every browser session.
Iteration I and J can run independently.
Iteration L depends on I, J, and K.
Iteration M depends on L technical closure.
```

## GO / NO-GO Rule

The timetable page can be finalized only when:

- Iteration I closes stale test-contract failures.
- Iteration J closes or explicitly scopes out the `/sections` density caveat.
- Iteration K is documented and used in the final run.
- Iteration L passes the full updated technical matrix.
- Iteration M has either passed or is explicitly accepted by stakeholders as a post-technical-release validation activity.

