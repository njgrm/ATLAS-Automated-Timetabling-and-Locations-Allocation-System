# Prompt 00 - Old-Scheduler Regression Baseline

## Role

You are the ATLAS executor assigned to prevent another round of timetable UX regressions before changing the Simple timetable UI.

This prompt is primarily test-contract and source-guard work. It may make small test-only additions. Do not start broad UI edits until the regression gates can catch the known problems listed here.

## Required preflight

Before editing:

1. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `ATLAS_AGENT_KI.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
2. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableStatusLegend.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
   - `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`
3. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
```

If target files already contain uncommitted changes, identify them and preserve unrelated user work.

## Scope

In scope:

- source guards for Simple timetable old-scheduler readiness;
- focused Playwright regression checks for visible help, menu reachability, next-action clarity, and swap region integrity;
- baseline screenshots and metrics for `/timetable`;
- repairing stale or weak test assertions.

Out of scope:

- broad Simple timetable visual redesign;
- backend changes;
- generation algorithm changes;
- live timetable write commits;
- changing role permissions or source ownership.

## Required fixes

### 1. Harden swap regression assertions

Fix the existing swap specs so they cannot pass with the known weak Prompt 10 state.

Required assertions:

- `generated-swap-primary-region` count must be exactly `3`.
- `generated-swap-pair-region`, `generated-swap-recommended-region`, and `generated-swap-action-region` must be visible.
- `generated-swap-action-region` must be the real action area containing `Cancel` and `Swap sessions`.
- No primary decision region may intersect the real action region.
- Primary decision content must not require body scroll at `844x390`.
- Visible decision copy must not include `Blocking 0`.
- Visible decision copy must include `No blockers` when hard blockers are zero.

### 2. Add Simple timetable source guards

Add or update source-pattern tests so they fail if:

- `More -> Tutorial` only closes the menu without opening the tutorial;
- status key opens a dialog that requires another status-key click before definitions are visible;
- `timetable-simple-task-prompt` hides all helper guidance from sighted users;
- primary Simple actions use `h-7` or `h-8`;
- `timetable-foolproof-help` remains hidden as `sr-only` in the visible Advanced task strip;
- raw `<button>`, native `<select>`, raw `title`, or native `<details>` appears in timetable interactive components.

Keep guards targeted. Do not scan unrelated generated output or `dist`.

### 3. Add baseline browser metrics

Create or update a focused Playwright spec for Simple timetable finalization evidence.

Required checks on `1366x768`, `390x844`, and `844x390`:

- Simple timetable loads without app-critical console errors.
- `timetable-simple-task-prompt` is visible.
- `timetable-simple-next-action` is visible and non-empty.
- Help or tutorial entry point is reachable without horizontal overflow.
- More menu opens without clipping the first task group.
- Status key path is reachable.
- Non-mutating swap proof still intercepts or avoids write commits.

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\00-baseline\
```

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
```

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts --workers=1 --reporter=line
```

Also run the new or updated Simple finalization spec directly.

## Internal gate before Prompt 01

Prompt 00 is GO only when:

- source guards catch the known old-scheduler risks;
- stale weak swap assertions are removed;
- baseline browser metrics and screenshots exist for all three viewports;
- non-mutating proof remains non-destructive;
- all required commands pass.

If tests cannot run because fixtures are unavailable, classify the affected item as fixture-limited and keep any dependent UI work blocked until the source guard covers it.

## Final report requirements

Report:

- files changed;
- exact tests added or updated;
- exact commands and results;
- screenshot paths;
- remaining fixture limitations;
- whether Prompt 01 may proceed.
