# Prompt 01 — Timetable Simple Publish Blockers Baseline and Fixture

## Goal

Lock the current Simple-mode publish-blocker failure with browser and API evidence before changing the UI.

## Context

The live Tailnet currently shows a generated timetable that cannot publish and displays large counts such as:

- `99+ unresolved`
- `105 blockers`
- `271 warnings`

The latest DB probe found run `427` with:

- `105` unresolved sessions
- `105` hard blockers
- hard code `UNASSIGNED_SECTION`
- unresolved reasons:
  - `FACULTY_OVERLOADED = 70`
  - `NO_AVAILABLE_SLOT = 35`

Simple mode currently does not make those causes easy to understand or fix.

## Scope

This prompt is detect-only. Do not change product behavior unless a test helper needs a stale selector update.

## Tasks

1. Add or update a Playwright spec:
   - `qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts`
2. The spec shall load `/timetable` in Simple mode across:
   - desktop
   - mobile portrait
   - mobile landscape
3. The spec shall capture:
   - selected run ID
   - assigned count
   - unresolved count
   - hard blocker count
   - soft warning count
   - visible Simple header text
   - whether the blocked-publish explanation can be opened without switching to Advanced
4. Add an API helper inside the spec or shared QA utilities to fetch the selected/latest run metadata and classify fixture state:
   - `product-failure`
   - `fixture-unavailable`
   - `stale-selector`
   - `dev-stack-unavailable`

## Required assertions

- Simple mode shall be the default mode.
- If unresolved sessions or hard blockers exist, then Simple mode shall expose a visible path to understand why publish is blocked.
- If that path is missing or hidden behind Advanced-only panels, classify it as `product-failure`.
- The spec shall record whether exact counts are visible or capped as `99+`.
- The spec shall record whether user-facing messages contain raw ID-only text such as `Section 5 subject 3`.

## Acceptance criteria

- Baseline evidence is recorded.
- The current failure is reproducible or classified with a clear fixture reason.
- No product code is changed.
- Stale selectors fail as stale selectors, not as proxy limitations.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- live run ID used
- counts observed from UI and API
- failure classification
- screenshots/artifacts path
- whether Prompt 02 can proceed
