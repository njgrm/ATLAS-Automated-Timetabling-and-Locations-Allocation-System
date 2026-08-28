# Prompt 05 — Simple Help, Tutorial, and More Menu Cleanup

## Goal

Update Simple timetable help and navigation so secondary tools do not feel like a cockpit and the tutorial teaches the current workflow.

## Context

The Simple tutorial currently teaches the older baseline flow:

- choose whose schedule to see;
- pick schedule;
- place unresolved sessions;
- check a class;
- swap;
- use More;
- use Advanced.

It does not sufficiently teach:

- publish blocker recovery;
- no-slot and Teaching Load repair paths;
- hidden rows and full-day view;
- workbook export;
- blocked generation;
- what to do when no current-year timetable exists.

The More menu is grouped, but it still mixes daily tasks, data controls, help, expert tools, generation, export, and edit history.

## Target files

Primary candidates:

- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`

## Tasks

1. Revise Simple tutorial steps to match the current Simple workflow:
   - choose schedule view;
   - use lifecycle action;
   - understand blockers;
   - fix a blocker group;
   - place or repair one session;
   - use Show full day;
   - export workbook;
   - use Advanced only for expert repair.
2. Add or preserve visual step-card style:
   - icon;
   - one-line title;
   - one short sentence;
   - target name.
3. Add `Show me` behavior only where it can safely focus or open a control without changing data.
4. Split help-like items away from More where practical:
   - Tutorial;
   - Status key;
   - What do blockers mean?;
   - How this works.
5. Keep More focused on secondary tools:
   - Daily tasks;
   - Schedule data;
   - Expert tools.
6. Rename ambiguous More labels:
   - `Latest Run` should be clearer as a selector label such as `Run to review`.
   - `Review issues` should clarify whether it opens warnings/blockers.
7. Ensure all menu groups have short descriptions only if needed. Do not add long paragraphs.

## UX requirements

- Help must be manually opened only.
- Tutorial must never auto-open over `/timetable`.
- Escape, Back, Next, Finish must work.
- Focus must return to the trigger after close.
- Use Radix/shadcn Dialog, DropdownMenu, Tooltip, Popover, or Sheet primitives.
- Avoid raw text walls.

## Acceptance criteria

- Tutorial mentions publish blockers and how to recover from them.
- Tutorial mentions Show full day if hidden rows exist or as a general concept.
- Tutorial mentions export workbook.
- More menu no longer contains help-like actions that duplicate the visible Help/Tutorial area, unless there is a deliberate fallback.
- Menu labels are plain and non-technical.
- Keyboard users can open and close Help, Tutorial, and More.

## Required tests

Update or add:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts`

Assertions:

- tutorial opens only from trigger;
- tutorial contains current workflow steps;
- tutorial keyboard navigation works;
- focus returns after close;
- More menu groups are present and not overloaded with help duplicates;
- no raw enum labels appear.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-ease-of-use.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- before/after tutorial step list
- More menu before/after structure
- screenshots/artifacts
- files changed
- exact commands and results
- remaining caveats
