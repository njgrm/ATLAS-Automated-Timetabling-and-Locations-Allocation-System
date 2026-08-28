# Setup-First UI/UX Overhaul Plan - 2026-07-28

## Verdict

`Approved execution stream`

The timetable page is at `Technical GO`, but product closure still depends on moderated older-user validation. The next UI/UX priority is the setup workflow that feeds timetable quality: Sections, Subjects, Teachers, Teaching Load, Campus/Rooms, and Dashboard readiness.

## Boundary

- This stream may simplify presentation, task flow, status wording, and local page layout.
- This stream shall not change generation truth, publish lifecycle gates, role permissions, or persisted source ownership.
- Runtime-source changes must update `docs/reference/atlas-runtime-source-of-truth-map.md`.

## Iteration 0 - Baseline Audit And Guardrails

### Objective

Record the current live Tailnet UX density, source-truth clarity, and first-use behavior before new setup-page implementation.

### Target Pages

- `/timetable`
- `/sections`
- `/subjects`
- `/faculty`
- `/teaching-load`
- campus/rooms route
- `/dashboard`

### Tasks

- Capture header height, first useful content position, page overflow, visible controls, source status, and console/network errors.
- Record whether each page gives a plain next action.
- Identify pages where source truth is visible only through hover or not visible at all.

### Exit Criteria

- Baseline audit exists under `docs/analysis/`.
- Each target page has a pass/fail density verdict.
- Follow-up implementation scope is limited to the findings.

## Iteration 1 - Shared Compact Setup Shell

### Objective

Make setup pages expose the actual table/work area higher in the viewport while keeping actions discoverable.

### Target Pages

- `/sections`
- `/subjects`
- `/faculty`
- `/teaching-load`

### Tasks

- Strengthen the shared setup header contract.
- Keep title, source state, primary action, overflow/secondary action, and filters in a compact command band.
- Keep metrics in compact inline stats instead of large cards.
- Preserve local scrolling via `flex-1 min-h-0 overflow-auto`.

### Exit Criteria

- Desktop setup headers stay under `150px`.
- Mobile setup headers stay under `185px`, except Teaching Load hard max `210px`.
- First useful content starts under `220px` desktop and under `260px` mobile.
- No target page creates a global browser scrollbar.

## Iteration 2 - Source-Truth Clarity

### Objective

Make each setup page visibly answer whether the operator is using live EnrollPro data, saved ATLAS data, a checking state, or no safe data.

### Target Pages

- `/sections`
- `/subjects`
- `/faculty`
- `/teaching-load`
- `/timetable` source status remains regression-checked but should not be reworked in this pass.

### Tasks

- Add visible, non-hover-only source-truth summaries to compact headers.
- Keep detailed explanations in shadcn/Radix tooltips.
- Use the same language family across setup pages:
  - `Verified live`
  - `Checking source`
  - `Using saved data`
  - `No saved data`
  - `Read-only saved data` where writes are blocked

### Exit Criteria

- Source status is visible without hovering.
- Tooltip/help copy still explains what the source state means.
- Screen-reader users receive source changes through stable semantic text.

## Iteration 3 - Teaching Load Task-First Redesign

**Status:** Codex GO, implemented and verified on live Tailnet.

### Objective

Make Teaching Load the primary simplification target after the source/header pass.

### Default User Question

`What teaching-load issue should I fix before timetable generation?`

### Tasks

- [x] Convert the default Teaching Load experience into a task-first readiness surface.
- [x] Keep By Teacher and Section Allocation as work modes, not the first cognitive burden.
- [x] Move advanced staffing mode and destructive reset actions behind disclosure.
- [x] Keep the persistent right inspector from intercepting mobile controls.

### Verification

- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `32/32`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-3-4.spec.ts --workers=1`: PASS `15/15` across desktop, mobile portrait, and mobile landscape.

## Iteration 4 - Sections, Subjects, And Faculty Table Simplification

**Status:** Codex GO, implemented and verified on live Tailnet.

### Objective

Reduce dense table controls and row metadata on the core setup pages.

### Tasks

- [x] Standardize one compact search/filter/action band.
- [x] Keep advanced filters behind a `More filters` disclosure.
- [x] Reduce noisy subject program-scope tokens to one readable summary badge with tooltip detail.
- [x] Shorten section home-room helper text while preserving readiness meaning.
- [x] Add clearer status labels for readiness, missing room, missing coverage, and stale source.

### Verification

- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-0-2.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1`: PASS `30/30` across desktop, mobile portrait, and mobile landscape.

## Iteration 5 - Campus And Rooms Simplification

### Objective

Make room readiness visible without requiring map editing.

### Tasks

- Put list-based room readiness before heavy map surfaces.
- Lazy-load map/editor surfaces.
- Add room setup labels: `Ready`, `Needs capacity`, `Needs room type`, `Needs section`, `Unavailable`.

### Codex verification (2026-07-28)

- [x] Added a plain-language `Room readiness` list before the map explorer.
- [x] Added per-room readiness labels and counts for capacity, room type, section assignment, and unavailable spaces.
- [x] Deferred the campus map preview, building view, map editor, and room editor into Suspense-backed lazy chunks.
- [x] Preserved local overflow boundaries and accessible status text.
- [x] Live Tailnet Playwright gate passed `6/6` across desktop, mobile portrait, and mobile landscape.

## Iteration 6 - Dashboard Readiness Hub

### Objective

Make Dashboard the first plain-language readiness hub for non-technical schedulers.

### Tasks

- Add a compact checklist for Sections, Subjects, Teachers, Teaching Load, Rooms, Timetable, and Publish readiness.
- Link each blocker to the exact repair page.
- Include visible source truth for each readiness domain.

### Codex verification (2026-07-28)

- [x] Expanded the dashboard checklist to seven operator steps: Sections, Subjects, Teachers, Teaching Load, Rooms, Timetable, and Publish readiness.
- [x] Linked each checklist item to its repair route (`/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/timetable`, `/schedules`).
- [x] Added a visible source-state badge to the readiness hub.
- [x] Live Tailnet Playwright gate passed `6/6` across desktop, mobile portrait, and mobile landscape.
- [x] Combined setup-first Iterations 0-4 plus timetable compactness regression passed `51/51`.

### Iterations 5-6 gate

`GO` for continued setup-first UX work. Technical gates passed: `tsc --noEmit`, `test:ux-guardrails` `32/32`, `test:timetable-conflict` `10/10`, production build, and live Tailnet Playwright coverage. Moderated older-user validation remains a separate product-readiness gate.

## Iteration 7 - Timetable Product Validation And Micro-Adjustments

### Objective

Move timetable from `Technical GO` to `Product GO` if older-user validation passes.

### Tasks

- Run the moderated older-user script.
- Convert only observed participant failures into targeted UI changes.

### Codex verification (2026-07-28)

- [x] Preserved the executable moderated older-user script and scorecard; no participant evidence was fabricated.
- [x] Added final browser route/mode smoke coverage so participant sessions start from a technically stable baseline.
- [ ] Participant sessions remain required before claiming Product GO.

## Iteration 8 - Full Regression And Antigravity Review Package

### Objective

Package the stream for independent browser verification.

### Required Gates

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
```

```powershell
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-0-2.spec.ts --workers=1
```

### Codex verification (2026-07-28)

- [x] Added `setup-first-uiux-iteration-7-8.spec.ts` for all operator routes, app-error detection, local overflow checks, and Simple/Advanced reversibility.
- [x] Fixed the Dashboard mobile-landscape loading-shell page scrollbar discovered by the new route-smoke gate.
- [x] Tailnet preflight passed `1/1`.
- [x] Iterations 7-8 browser suite passed `6/6` across desktop, mobile portrait, and mobile landscape.
- [x] Combined Iterations 0-7 plus timetable compactness regression passed `57/57` across desktop, mobile portrait, and mobile landscape.

### Iterations 7-8 gate

`Technical GO`. Independent Antigravity review is ready. Product-level `GO` remains conditional on moderated older-user participant evidence.

## Execution Groups

1. Iterations 0-2: baseline, compact setup shell, source-truth clarity.
2. Iterations 3-4: Teaching Load redesign and setup table simplification.
3. Iterations 5-6: Campus/Rooms simplification and Dashboard readiness.
4. Iterations 7-8: timetable product validation and external review package.
