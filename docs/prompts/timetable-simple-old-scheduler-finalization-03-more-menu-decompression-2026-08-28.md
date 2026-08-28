# Prompt 03 - More Menu Decompression

## Role

You are the ATLAS executor assigned to keep the Simple timetable More menu from becoming a second overwhelming workspace.

The More menu should help schedulers find occasional actions, not bury Help under expert controls.

## Required preflight

Before editing:

1. Confirm Prompt 02 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-02-next-action-guidance-2026-08-28.md`
3. Inspect:
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - any extracted menu/help components if Prompt 01 or 02 created them.
4. Check git state.

## Scope

In scope:

- Simple timetable More menu layout and grouping;
- daily task entry points;
- help entry points;
- expert/advanced action grouping;
- menu viewport fit and accessibility.

Out of scope:

- removing Advanced view;
- deleting existing scheduler capabilities;
- backend changes;
- changing generated-run selection semantics.

## Required fixes

### 1. Split primary tasks from overflow utilities

Required behavior:

- Daily tasks must be the first group and visually short.
- Help must be visible without scrolling at `1366x768`, `390x844`, and `844x390`.
- Expert tools must not visually compete with Daily tasks.
- Advanced view must be clearly labeled as expert mode, not the default path.
- Long technical labels should be shortened without losing meaning.

### 2. Avoid clipped menu sections

Required behavior:

- menu content must not be clipped so that Help disappears below the viewport;
- if scrolling inside the menu is unavoidable on small screens, the Help entry must remain pinned or reachable from a separate visible Help trigger;
- first-level choices must not exceed what an older scheduler can scan quickly;
- no menu group may become a dense wall of buttons.

### 3. Make Help a first-class recovery path

Required behavior:

- Help/Tutorial and Status key are visible and tappable from the Simple header without depending only on More;
- More menu Help entries still work;
- How this works may remain a route link, but it must not be the only explanatory path.

### 4. Preserve command safety

Required behavior:

- Generate, Publish, Refresh, Export, and Advanced view still route to their existing handlers;
- disabled actions remain disabled for the same reasons;
- no raw native controls are introduced;
- keyboard navigation order remains logical.

## Required tests

Add or update Playwright coverage for:

- More menu opens and shows Daily tasks and Help in all three viewports;
- no Help entry is clipped outside the viewport;
- Advanced view is present but separated from daily tasks;
- Tutorial and Status key entries work from More after Prompt 01;
- menu item count and group count are bounded by testable limits agreed in the implementation notes.

Suggested source guard:

- fail if `DropdownMenuLabel` groups are added without a corresponding viewport-fit test.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Run the focused More menu Playwright spec on:

- `1366x768`
- `390x844`
- `844x390`

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\03-more-menu\
```

## Internal gate before Prompt 04

Prompt 03 is GO only when:

- Help is visible or first-class reachable in all three viewports;
- Daily tasks are not buried under utility/expert actions;
- no menu clipping hides required recovery aids;
- required tests pass.

## Final report requirements

Report:

- files changed;
- final menu grouping;
- viewport screenshot paths;
- command results;
- whether Prompt 04 may proceed.
