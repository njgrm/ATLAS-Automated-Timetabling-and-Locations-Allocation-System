# Prompt 04 - Decision State Parity

## Role

You are the ATLAS executor assigned to apply the concise, decision-first pattern across the timetable states that schedulers actually operate.

Generated swap has been improved, but the rest of the timetable workflow must not fall back to diagnostic walls of text.

## Required preflight

Before editing:

1. Confirm Prompt 03 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-10-regression-proof-and-real-footer-closure-2026-08-27.md`
3. Inspect:
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
   - `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
   - `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
   - `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
   - `atlas-client/src/components/timetable/ManualEditPanel.tsx`
   - related Playwright specs under `qa-artifacts/playwright/specs/`
4. Check git state.

## Scope

In scope:

- generated swap review;
- draft placement and draft swap review;
- blocked swap/placement recovery;
- publish blocker review;
- task drawer item detail states;
- auto-fix and suggested manual-fix presentation;
- focused tests for wall-of-text prevention.

Out of scope:

- backend swap or generation semantics unless a UI needs already-available fields;
- changing hard-constraint enforcement;
- live destructive timetable writes;
- Teaching Load ownership changes;
- broad redesign of unrelated pages.

## Required fixes

### 1. Define a reusable decision-state standard

For each timetable decision state, the first view must answer:

- What is happening?
- What does ATLAS recommend?
- Is it blocked?
- What should I press next?

Required behavior:

- no primary decision state has more than three visible primary regions;
- secondary diagnostics are behind a clear details action;
- warnings are calm and inspectable;
- hard blockers are direct and specific;
- every blocked state includes at least one useful manual next action when available.

### 2. Audit and refactor wall-of-text states

Inspect and repair these surfaces if they violate the standard:

- generated occupied-slot swap;
- draft placement review;
- draft swap review;
- blocked placement/swap recovery;
- publish readiness sheet;
- task drawer blocker details;
- generated unassigned item details;
- manual repair preview/commit states.

Required behavior:

- paragraph-heavy content must be shortened into visual rows, chips, or compact checklists;
- no modal body should require scrolling to understand the primary decision at `844x390`;
- details may scroll, but primary action and recommendation must remain visible;
- action labels must be direct, such as `Swap sessions`, `Open section`, `Review room`, `Keep current`, or `Choose another pair`.

### 3. Preserve auto-fix and manual-fix clarity

Required behavior:

- auto-fix options must be labeled as automatic only when ATLAS can safely preview/apply them;
- manual options must say where they take the scheduler;
- unavailable strategies must not look like broken buttons;
- blocked states must not end with only a disabled primary button.

### 4. Keep tests fixture-honest

Required behavior:

- generated swap must have live Tailnet proof;
- draft parity may be fixture-limited only if no draft items exist;
- blocked recovery may be fixture-limited only if no blocked pair exists;
- fixture-limited states must still have source-level and synthetic-unit protection where practical;
- do not claim Product GO from fixture-limited proof.

## Required tests

Add or update tests so they fail if:

- visible text length exceeds the agreed budget for a primary modal state;
- primary decision regions exceed three;
- a primary decision state lacks a recommended action;
- a blocked state lacks a manual next action;
- a warning count is shown as hard-stop diagnostic copy when hard blockers are zero;
- footer/action zones overlap primary decision content;
- raw native controls return.

Run or update existing swap specs:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\04-decision-parity\
```

## Internal gate before Prompt 05

Prompt 04 is GO only when:

- all reachable decision states follow the three-region decision standard;
- generated swap proof is live and passing;
- fixture-limited draft/blocked states are honestly classified;
- focused and broad gates pass.

## Final report requirements

Report:

- surfaces audited;
- surfaces changed;
- before/after text-density or region-count metrics;
- fixture limitations;
- screenshot paths;
- command results;
- whether Prompt 05 may proceed.
