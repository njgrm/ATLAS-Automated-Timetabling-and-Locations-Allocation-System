# Prompt 01 - Help And Status Key Repair

## Role

You are the ATLAS executor assigned to make Simple timetable help direct, visible, and useful for older scheduler officers.

The user must not have to hunt through a clipped menu or click a second nested control to understand the screen.

## Required preflight

Before editing:

1. Confirm Prompt 00 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-00-regression-baseline-2026-08-28.md`
3. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableStatusLegend.tsx`
   - `atlas-client/src/components/TutorialOverlay.tsx`
   - `qa-artifacts/playwright/specs/`
4. Check git state.

## Scope

In scope:

- Simple timetable tutorial entry points;
- status key direct rendering;
- tooltip/tip reachability on touch and desktop;
- focused tests for help flows.

Out of scope:

- rewriting the whole timetable toolbar;
- backend changes;
- changing tutorial content unrelated to scheduler orientation;
- changing generation or publish rules.

## Required fixes

### 1. Wire every Tutorial entry point

Fix `More -> Help -> Tutorial` so it opens the same Simple timetable tutorial as the visible Tutorial button.

Required behavior:

- desktop Tutorial button opens `data-testid="timetable-simple-tutorial"`;
- mobile icon Tutorial button opens the same tutorial;
- `More -> Help -> Tutorial` opens the same tutorial;
- Escape and Close dismiss it;
- opening the tutorial does not leave the More menu open underneath.

### 2. Render status meanings directly

The Simple status-key dialog must show the actual definitions immediately.

Required behavior:

- clicking Status key from the header or More menu opens a dialog/panel where `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, and `Current` definitions are visible without another click;
- the status key may still use a popover elsewhere, but Simple dialog content must not nest a second trigger;
- the Done/Close action is visible on mobile portrait and landscape.

### 3. Make essential help touch-friendly

Required behavior:

- no essential explanation is hover-only on mobile;
- icon-only help controls have visible accessible labels and tooltips;
- the visible Help route or panel is reachable in `390x844` and `844x390`;
- help copy stays short: one heading, one sentence, then actions or definitions.

### 4. Reduce tutorial overwhelm

Keep the tutorial concise enough to be useful.

Required behavior:

- no tutorial step body exceeds two short sentences;
- each step has one plain target label;
- `Show me`, `Next`, `Back`, and `Close` use old-scheduler-friendly target sizes;
- no step points to an element that is hidden behind a closed menu without opening that menu first or explaining the action.

## Required tests

Add or update Playwright coverage for:

- desktop Tutorial button opens the tutorial;
- More menu Tutorial opens the tutorial;
- Status key opens direct definitions with all six states visible;
- mobile portrait and landscape can open and close tutorial and status key;
- no global horizontal overflow after opening tutorial/status key.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Run focused Playwright help/status-key specs on:

- `1366x768`
- `390x844`
- `844x390`

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\01-help-status\
```

## Internal gate before Prompt 02

Prompt 01 is GO only when:

- all Tutorial entry points open the tutorial;
- status definitions are visible without a nested second click;
- mobile/touch help is not hover-only;
- screenshot evidence exists for all three viewports;
- required commands pass.

## Final report requirements

Report:

- files changed;
- tutorial entry points verified;
- status definitions verified;
- viewport screenshots;
- command results;
- whether Prompt 02 may proceed.
