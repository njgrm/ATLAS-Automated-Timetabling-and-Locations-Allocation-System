# Prompt 03 — Policy-Driven Bell Schedule Alignment

## Role

You are the ATLAS policy/generator contract agent. Implement only this prompt after Prompt 02 is GO.

## Background

Live Tailnet showed:

- `SchedulingPolicy.earliestStartTime = 06:00`
- all `GradeShiftWindow.startTime = 07:30`
- `enableFlagCeremony = true`
- `flagCeremonyStartTime = 07:00`
- `flagCeremonyEndTime = 07:30`
- generated entries start at `07:30`
- `06:00` entries count is `0`

The schedule reference files include normal class periods at `6:00-6:45` and `6:45-7:30`, 40-minute periods, 45-minute periods, longer blocks, short break/transition slots, `HEALTH BREAK`, and `LUNCH BREAK`, but ATLAS must not hard-code those times or labels.

Reference-file audit:

```text
docs/analysis/timetable-reference-schedule-files-audit-2026-08-15.md
```

## Objective

Make the timetable grid, generator, policy pane, grade windows, and export logic consistently derive schedule shape from in-system policy and grade windows.

## Scope

### In scope

- Policy/grade-window consistency checks.
- UI warning when display slots exist outside grade windows.
- Generator tests proving 6:00 classes are possible only when policy and grade windows allow them.
- Policy fixtures proving 40-minute, 45-minute, and mixed-duration display slots are represented from policy/run metadata.
- Break-label handling for school-configurable labels such as `HEALTH BREAK`, `RECESS`, and `LUNCH BREAK`.
- Scheduler guidance for changing bell schedule and grade windows.

### Out of scope

- Hard-coding the reference workbook times.
- Hard-coding the Grade 7 DOCX times.
- Hard-coding the `40-minutes.xlsx` times.
- Hard-coding break labels from any reference file.
- Forcing every school to start at 6:00.
- Changing publish rules.
- Export implementation.

## Required behavior

- If policy starts at `06:00` but grade windows start at `07:30`, ATLAS shall show a policy alignment warning:
  - `The grid starts at 06:00, but grade windows start at 07:30. Classes cannot be generated before 07:30 until grade windows are changed.`
- If a special event blocks a visible time slot, ATLAS shall show:
  - `Flag ceremony blocks 07:00-07:30.`
- The generator shall only place classes in slots allowed by:
  - SchedulingPolicy bounds;
  - GradeShiftWindow bounds;
  - special-event blocks;
  - lunch/recess blocks;
  - room/faculty/section constraints.
- The schedule-shape contract shall preserve mixed-duration slots when they are present in policy/run metadata.
- The schedule-shape contract shall preserve special event labels from policy/configuration instead of substituting hard-coded labels.
- The policy pane shall make these controls discoverable:
  - earliest start time;
  - latest end time;
  - period length;
  - periods per day;
  - flag ceremony enabled/time;
  - recess enabled/time;
  - lunch enabled/time;
  - grade/program shift windows.
- The timetable page shall never imply that a visible grid row is schedulable if grade windows or policy block it.

## Test requirements

Add backend tests:

- policy `06:00` + grade window `07:30` yields no generated classes before `07:30`;
- policy `06:00` + grade window `06:00` allows candidates at `06:00`;
- 40-minute policy fixtures produce 40-minute display/candidate slots;
- 45-minute policy fixtures produce 45-minute display/candidate slots;
- mixed-duration/special-event fixtures preserve break and long-block display slots where configured;
- special event overlap blocks affected slots;
- display slots and schedulable slots are distinguishable.

Add browser tests:

- timetable shows a plain warning when display slots are outside grade windows;
- policy pane shows the controlling values;
- changing policy/grade-window fixture changes generated candidate slots;
- no time is hard-coded from the workbook.

## Required commands

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Explanation of why 06:00 is or is not schedulable in current live data
4. Explanation of how 40-minute, 45-minute, and mixed-duration schedules are represented without hard-coding
5. Policy/grade-window test evidence
6. Remaining policy UX caveats
