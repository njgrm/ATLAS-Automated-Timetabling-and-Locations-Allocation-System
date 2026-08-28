# Prompt 02 - Persistent Next Action Guidance

## Role

You are the ATLAS executor assigned to make every Simple timetable state answer: "What should I do next?"

The screen must give one direct recommended action, one short reason, and a clearly sized action control. Older schedulers should not infer workflow from diagnostics.

## Required preflight

Before editing:

1. Confirm Prompt 01 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-01-help-and-status-key-2026-08-28.md`
3. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
   - `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
   - `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
   - existing task definitions and routing hooks.
4. Check git state.

## Scope

In scope:

- Simple next-step prompt;
- visible helper copy;
- primary action sizing;
- loading, empty, blocked, generation-ready, publish-blocked, and active-task states;
- focused tests for next-action clarity.

Out of scope:

- redesigning the timetable grid itself;
- backend algorithm changes;
- changing publish hard-blocking semantics;
- changing Teaching Load ownership.

## Required fixes

### 1. Add visible helper copy to the task prompt

The task prompt must show a short visible helper line for sighted users.

Required behavior:

- `timetable-simple-next-action` remains the main label;
- one visible helper line explains why this is next;
- helper text must not be only `sr-only`;
- helper copy must fit without overlapping primary actions on desktop, mobile portrait, and landscape;
- helper copy may truncate only after preserving the core instruction.

### 2. Standardize primary action sizing

Critical Simple timetable actions must be old-scheduler-friendly.

Required behavior:

- primary task action uses `h-10` or `h-11`;
- Generate, Start draft, Publish, Start placing, Start swapping, and task drawer primary actions use old-scheduler-friendly targets;
- non-critical badges may remain compact, but they must not be the only path to an action;
- no `h-7` or `h-8` may remain on critical Simple timetable actions.

### 3. Make each state direct

Every major Simple timetable state must expose one next action:

- no timetable yet;
- generation available;
- generation running;
- generated schedule with unresolved sessions;
- swap mode active;
- blocked publish;
- ready to publish;
- published;
- source unavailable/saved-data state.

Required behavior:

- one recommended action is visually dominant;
- secondary actions are present but visually quieter;
- diagnostic counts support the decision instead of replacing the decision;
- no state relies on a wall of text.

### 4. Preserve accessibility and announcement behavior

Required behavior:

- task prompt remains `role="status"` or equivalent;
- action updates are announced without spam;
- disabled actions include a visible reason or nearby tip;
- keyboard focus is not lost when task mode changes.

## Required tests

Add or update tests that assert:

- visible helper text exists in `timetable-simple-task-prompt`;
- primary Simple action height is at least 40px;
- each known state has non-empty next-action text;
- disabled primary actions expose a visible or accessible reason;
- no global overflow occurs on the three required viewports.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run the focused Simple next-action Playwright spec on:

- `1366x768`
- `390x844`
- `844x390`

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\02-next-action\
```

## Internal gate before Prompt 03

Prompt 02 is GO only when:

- next action and helper are visible;
- critical actions meet old-scheduler target sizing;
- the three required viewports show no overlap or global overflow;
- required tests pass.

## Final report requirements

Report:

- files changed;
- state coverage;
- target-size evidence;
- screenshot paths;
- command results;
- whether Prompt 03 may proceed.
