# Prompt 01 — Simple Timetable Lost-Scheduler Baseline

## Goal

Lock the current Simple timetable behavior before changing UI. This prompt is detect-only except for stale-selector test helper fixes.

## Context

Recent QA found that Simple mode is functional but can still leave scheduler officers uncertain after they click into repair paths. The most important gap is context loss after moving from the publish-blocker sheet into the plotting tray.

Known concerns to verify:

- Publish blocker sheet opens from the Simple header.
- Plotting tray does not always explain which blocker/filter is being fixed.
- Mobile Simple mode may hide Generate/Publish lifecycle buttons.
- Tutorial does not cover the new publish-blocker recovery path.
- Some timetable surfaces still show `G7` instead of `GR7`.
- More menu remains long and may mix help, lifecycle, data, and expert tools.

## Scope

Detect-only. Do not change product behavior unless a selector helper is stale and must be corrected to capture evidence.

## Tasks

1. Add or update a Playwright spec:
   - `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
2. Run against live Tailnet:
   - `https://njgrm.buru-degree.ts.net`
3. Cover:
   - desktop;
   - mobile portrait;
   - mobile landscape.
4. Capture these Simple-mode states:
   - default header;
   - publish-blocker sheet;
   - plotting tray opened from `Start placing`;
   - plotting tray opened from a publish-blocker repair action;
   - Simple More menu;
   - Simple tutorial;
   - schedule switcher;
   - selected class action strip or sheet;
   - hidden-row/full-day controls where fixture data allows.
5. Record measurements:
   - no global vertical scrollbar;
   - no horizontal page overflow;
   - header height;
   - body/workspace top;
   - visible lifecycle controls by viewport.

## Required assertions

- Simple mode shall be the default mode.
- If publish is blocked, then the Simple header shall expose a one-click path to understand why.
- If a repair action opens a tray or workflow, then the opened surface shall explain the current repair context.
- If a lifecycle action is hidden on mobile, then the test shall record whether an equivalent visible action exists.
- If the tutorial opens, then the test shall record whether it mentions publish blockers, blocked generation, full-day view, and workbook export.
- If grade badges are visible in Simple timetable surfaces, then the test shall fail on `G7`, `G8`, `G9`, or `G10` when the intended compact label is `GR7`, `GR8`, `GR9`, or `GR10`.
- Stale selectors shall fail as stale selectors, not as proxy limitations.

## Acceptance criteria

- Baseline evidence is captured across all three viewports.
- The report identifies concrete user-lost states instead of generic polish.
- No product behavior changes are made in this prompt.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- files changed
- run ID and school year observed
- viewport measurements
- list of lost-scheduler states found
- screenshot/artifact paths
- whether Prompt 02 can proceed
