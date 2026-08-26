# Antigravity Prompt: Validate Timetable Overhaul Iteration C

You are independently verifying Codex's Timetable Simplification Overhaul Iteration C work on the live Tailnet environment.

Target environment: `https://njgrm.buru-degree.ts.net`

Use Browser Playwright, not static inspection only. Log in as Admin:

- Username: `1000001`
- Password: `AdminSY2026!`

## Context

Iteration A and B are already considered GO. Iteration C specifically targets visual simplification and compact command headers:

- `/timetable` must keep source-truth visibility and task guidance without crowding the first viewport.
- `/sections`, `/subjects`, and `/faculty` must expose table content earlier by using compact command-band headers.
- `/teaching-load` must expose the working area earlier and avoid a large duplicated visual workflow/header block.
- The compact shell must not regress generated unassigned click placement, generated unassigned drag placement, or modern generated occupied-slot swaps.

## Required commands

Run these from the repo root unless a command explicitly says `atlas-client`:

```powershell
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1
```

## Browser checks to perform

Using Playwright browser interactions against `https://njgrm.buru-degree.ts.net`, verify all of the following on desktop, mobile portrait, and mobile landscape:

1. `/sections`, `/subjects`, and `/faculty`
   - No global browser scrollbar appears.
   - The command header is compact.
   - The table/content region is visible without needing to scroll the page.
   - Search/filter controls remain visible or reachable.
   - The page still uses the SMART-family visual identity and does not introduce raw native controls.

2. `/teaching-load`
   - No global browser scrollbar appears.
   - The local command/header area is compact.
   - The teaching-load workspace/content area is visible quickly.
   - The primary teaching-load actions remain visible or reachable.

3. `/timetable`
   - No global browser scrollbar appears.
   - The task guide and source-truth notice do not dominate the first viewport.
   - The timetable grid remains the primary visual object.
   - Primary actions such as `Plan before generating`, `Generate timetable`, `Review latest run`, or the current equivalent task buttons remain visible/reachable.

4. Regression from Iterations A/B
   - Generated unassigned click-to-place still opens `Review generated placement`.
   - Generated unassigned drag-to-place still opens the same review without premature commit.
   - Generated placement does not ask the operator to choose or assign a teacher when the item already has a Teaching Load owner.
   - Generated occupied-slot swap still opens the modern visual swap review and uses `Swap sessions`.
   - Deprecated wording such as `Assign teacher and room`, `Choose teacher`, or `Choose room` must not appear in timetable placement/swap review flows.

## Report format

Return:

1. `GO` or `NO-GO`.
2. Exact failures or regressions, with reproduction steps.
3. Command results.
4. Browser timing observations for first visible content/table/workspace on each checked page.
5. Console/page/network errors.
6. Whether compactness improved enough for older non-technical users.
7. Whether Codex missed any UX/UI simplification issue that should block Iteration D.
