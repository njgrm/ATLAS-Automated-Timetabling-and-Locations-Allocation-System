# Prompt 09 - Test Contract Alignment For Current Simple Timetable UX

## Role

You are the ATLAS executor assigned to align the active timetable Playwright release specs with the current simple, plain-language timetable UX.

This is not a wording redesign. The UI has already moved away from older labels such as `Review occupied-slot swap`, `Review draft placement`, and `Plan before generating`. Fix the tests so they prove the current user experience instead of requiring stale copy.

## Required preflight

Before editing:

1. Read:
   - `docs/prompts/timetable-simple-old-scheduler-remaining-issues-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `ATLAS_AGENT_KI.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
2. Inspect:
   - `qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-panel-ux-recovery.spec.ts`
   - every active timetable Playwright spec that references stale labels
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
3. Check git state.

## Scope

In scope:

- stale Playwright label expectations;
- stale helper fixtures that search for old menu or dialog labels;
- release assertions that should check user intent, visible regions, and actions instead of exact obsolete titles;
- source guards for old labels that must not return.

Out of scope:

- broad UI redesign;
- backend mutation semantics;
- generation algorithm changes;
- live destructive timetable writes;
- weakening tests to pass without proving the user path.

## Required fixes

### 1. Replace stale title expectations

Update active release specs so they accept the current direct labels:

- generated swap: `Swap these two classes?`
- draft placement: `Place this class?`
- draft planning menu: current visible planning label, such as `Plan draft`, if that is what the source renders

Do not simply add broad regex alternatives like `/Review|Place|Swap/`. Assertions must still prove the intended surface opened.

### 2. Assert user-facing purpose, not implementation history

For each updated spec, verify at least two stable facts:

- the intended dialog/sheet title is visible;
- the primary affected class/session row is visible;
- the primary action is visible;
- the cancel/back path is visible;
- destructive requests are blocked or canceled during proof.

### 3. Add stale-copy guards

Add or update source/test guards so active release specs fail if these return in visible scheduler-facing UI:

- `Review occupied-slot swap`
- `Review draft placement`
- `Plan before generating`
- `Blocking 0`
- `Blocking - - Warnings -`

Historical notes may contain old labels only if the spec excludes them from active UI assertions.

### 4. Verify release bundle stability serially

Run the specs serially with `--workers=1`. If a spec only fails under parallelism, record that separately but still fix any shared-state cause if it is in scope.

## Required commands

Focused:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts --project=desktop --workers=1 --reporter=line
rg -n "Review occupied-slot swap|Review draft placement|Plan before generating|Blocking 0|Blocking - - Warnings -" qa-artifacts/playwright/specs atlas-client/src/components/timetable
```

Static:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Tailnet proof

Use live Tailnet and capture at least one desktop screenshot for:

- draft placement dialog or fixture-limited proof of unavailability;
- draft planning entry from More;
- generated swap dialog.

Save artifacts under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\09-test-contract-alignment\
```

## Internal gate before Prompt 10

Prompt 09 is GO only when:

- focused specs pass serially;
- active specs no longer require stale labels;
- stale-copy source guard returns no active UI/spec violations, or only explicitly documented historical evidence files;
- tests still prove the user path, not just the presence of any dialog;
- all static gates pass.

## Final report requirements

Report:

- Prompt 09 verdict;
- stale expectations removed;
- files changed;
- commands and results;
- screenshot/artifact paths;
- remaining fixture-limited states;
- whether Prompt 10 may proceed.

## Suggested commit

```text
test(timetable): align old-scheduler specs with current labels
```
