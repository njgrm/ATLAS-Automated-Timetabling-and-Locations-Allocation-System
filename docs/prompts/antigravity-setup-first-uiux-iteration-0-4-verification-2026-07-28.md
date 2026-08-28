# Antigravity Prompt: Verify Setup-First UI/UX Overhaul Iterations 0-4

You are independently verifying Codex's Setup-First UI/UX Overhaul work for Iterations 0-4 on the live Tailnet environment.

Target environment: `https://njgrm.buru-degree.ts.net`

Use Browser Playwright for live interaction. Do not rely on static grep or source review only.

Log in as Admin:

- Username: `1000001`
- Password: `AdminSY2026!`

## Verification Goal

Determine whether Codex's Iterations 0-4 are ready to proceed to Iterations 5-6, or whether there are blocking fixes required first.

Return `GO` only if:

- automated local gates pass,
- live Tailnet browser gates pass,
- setup pages are visibly simpler and less vertically wasteful,
- source-truth status is visible without hover,
- Teaching Load is task-first and usable on mobile,
- no global browser scrollbars or mobile tap interception are introduced,
- no timetable regressions are found.

Return `NO-GO` if any required behavior below fails.

## Context: What Codex Claims Was Done

### Iteration 0 - Baseline Audit And Guardrails

- Added baseline plan/audit coverage for setup-first simplification.
- Established compactness, source-truth visibility, no-scroll, and Tailnet browser gates.
- Added live Playwright checks for `/sections`, `/subjects`, `/faculty`, `/teaching-load`, and `/timetable`.

### Iteration 1 - Shared Compact Setup Shell

- `/sections`, `/subjects`, and `/faculty` now use compact command-band headers.
- First useful table/content should appear high in the viewport.
- Metrics should be inline and compact, not large card stacks.
- Global page scrolling should not appear.

### Iteration 2 - Source-Truth Clarity

- Setup pages now expose visible source-truth summaries without requiring hover.
- Expected visible source states include:
  - `Verified live`
  - `Checking source`
  - `Using saved data`
  - `No saved data`
  - `Read-only saved data`
- `/teaching-load` exposes `teaching-load-source-truth-summary`.
- Shared setup pages expose `admin-source-truth-summary`.

### Iteration 3 - Teaching Load Task-First Redesign

- `/teaching-load` now opens with a compact next-task guide inside the working content area.
- Expected visible guide:
  - `Fix first`
  - one of: `Save your draft changes`, `Fill missing teaching loads`, `Review overloaded teachers`, or `Teaching Load looks ready`
  - quick actions for missing loads, over-cap teachers, and teachers without load
- Advanced Teaching Load filters should be hidden by default behind `More filters`.
- The persistent right inspector should not intercept mobile taps.
- Desktop may keep the inspector; mobile should prioritize usable main controls.

### Iteration 4 - Sections, Subjects, And Faculty Table Simplification

- Shared setup pages expose a compact search-first toolbar with `More filters`.
- Subject rows summarize program scope into one readable badge with tooltip details instead of multiple tiny tokens.
- Section home-room helper text is shorter, e.g. `Ready: [building]`, `Needs home room. Choose a room.`, or equivalent.
- Setup table controls should look calmer and easier to scan for older non-technical users.

## Required Commands

Run exactly these commands unless the environment requires a clearly documented equivalent. Record exact pass/fail output.

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
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/setup-first-uiux-iteration-3-4.spec.ts --workers=1
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1
```

## Required Live Browser Checks

Use Playwright browser interaction against `https://njgrm.buru-degree.ts.net`.

Check desktop, mobile portrait, and mobile landscape unless the item explicitly says desktop-only.

### 1. Global Shell And Overflow

For `/sections`, `/subjects`, `/faculty`, `/teaching-load`, and `/timetable`:

- Verify the page does not create a global browser scrollbar.
- Verify no horizontal page overflow appears.
- Verify the primary scroll region is local to the table/workspace, not the document root.
- Capture header height, content top, viewport size, and root scroll metrics.

### 2. Setup Pages: `/sections`, `/subjects`, `/faculty`

Verify:

- The command header is compact.
- The table/content shell is visible without scrolling the browser page.
- A visible source state chip appears without hover.
- On desktop, a visible source-truth summary appears.
- Search is visible in the first viewport.
- `More filters` is visible and opens the advanced filter controls.
- The page uses project controls, not raw native-looking browser controls.
- The UI is calmer than the old dense header/table layout.

Use these practical thresholds:

- desktop command header should stay near or below `150px`,
- mobile command header should stay near or below `185px`,
- desktop content should start near or above `220px`,
- mobile content should start near or above `245px`.

If the threshold is exceeded, do not automatically fail; inspect whether the content remains practically usable. Report exact numbers and visual impact.

### 3. Teaching Load: `/teaching-load`

Verify:

- `teaching-load-command-header` is compact.
- `teaching-load-content-shell` appears quickly.
- `teaching-load-task-guide` is visible inside the content shell, not as a large extra page header.
- `teaching-load-next-action` contains a plain-language next task.
- The task guide height is compact enough not to dominate the workspace.
- Default controls show search/status plus `More filters`, not the full advanced filter strip.
- Clicking `More filters` reveals advanced filters such as cross-department and unmapped-specialization controls.
- On mobile portrait, the `More filters` button is tappable; no right inspector or overlay intercepts the tap.
- No global scrollbar appears after opening `More filters`.
- Teaching Load remains usable in both teacher and section/allocation modes.

Specific regression to look for:

- If Playwright reports that the right inspector or any side panel intercepts a tap over a main control, mark `NO-GO`.

### 4. Table Row Simplification

On `/subjects`:

- Verify program scope is not shown as a noisy row of many tiny labels.
- Verify a summarized program badge exists and the detail is available through a tooltip/popover-style affordance.

On `/sections`:

- Verify home-room status text is short and readable.
- Verify missing-room or ready-room status remains understandable without reading a long sentence.

On `/faculty`:

- Verify compact header/source truth behavior remains consistent with Sections and Subjects.
- Verify search/filter controls remain reachable.

### 5. Timetable Regression Check

Codex claims timetable is not being reworked in this stream, but it must not regress.

Verify:

- `/timetable` loads in Simple/default view.
- Simple header and primary action are visible.
- Timetable grid/table becomes visible.
- No global browser scrollbar appears.
- Existing compactness gate from `timetable-overhaul-iteration-c.spec.ts` passes.
- No obsolete placement wording appears in visible timetable workflows:
  - `Assign teacher and room`
  - `Choose teacher`
  - `Choose room`

You do not need to commit timetable writes. Keep this verification read-only.

### 6. Console, Page, And Network Errors

Capture:

- app-critical console errors,
- page errors,
- failed API requests,
- failed lazy chunk requests,
- Tailnet instability such as `502`, `net::ERR_ABORTED`, or WebSocket errors.

Classify failures:

- App-critical: blocks UI, unmounts content, prevents interaction, or fails assertions.
- Non-fatal Tailnet noise: does not block visible UI or assertions.

Do not dismiss network failures without checking whether the UI stayed usable.

## Expected Automated Gate Results From Codex

Codex reported:

- `npx tsc --noEmit`: PASS.
- `npm run test:ux-guardrails`: PASS `32/32`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- `npm run build`: PASS.
- `setup-first-uiux-iteration-0-2.spec.ts`: PASS `15/15`.
- `setup-first-uiux-iteration-3-4.spec.ts`: PASS `15/15`.
- `timetable-overhaul-iteration-c.spec.ts`: PASS `15/15`.

Independently confirm or refute these results.

## Report Format

Return the report in this exact structure:

```markdown
# Antigravity Verification Report: Setup-First UI/UX Iterations 0-4

## 1. Verdict
GO or NO-GO

## 2. Summary
Briefly state whether Codex can proceed to Iterations 5-6.

## 3. Exact Command Results
List each command and pass/fail result.

## 4. Browser Matrix Results
Table with Desktop, Mobile Portrait, Mobile Landscape for:
- /sections
- /subjects
- /faculty
- /teaching-load
- /timetable

Include header height, content top, global scrollbar yes/no, and primary usability notes.

## 5. Functional Behavior Results
Confirm:
- source truth visible without hover
- More filters behavior
- Teaching Load task guide
- mobile tap interception absent
- subject row badge simplification
- section home-room copy simplification
- timetable regression safety

## 6. Console/Page/Network Errors
List exact errors and classify as app-critical or non-fatal Tailnet noise.

## 7. UX Second Opinion
Score 1-10 with notes:
- older-user clarity
- visual density
- first-screen usefulness
- mobile usability
- setup workflow readiness

## 8. Blockers
If NO-GO, list blockers in priority order with reproduction steps.

## 9. Recommendation
State one of:
- Proceed to Iterations 5-6.
- Fix listed blockers before Iterations 5-6.
- Proceed with caveats, listing non-blocking improvements.
```

Do not mark GO if the page only passes static checks but fails real browser usability.
