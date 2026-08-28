# Phase 2 Workbook Gap Refactor Sequence

Use this sequence instead of returning to Phase 2 closure prompts immediately.

## Why this sequence exists
The current blocker is no longer mainly home-room fallback.

The workbook gap audit showed the real dependency order is:
1. timetable shape
2. policy/window scheduler UX
3. template/subject contract
4. only then KPI recovery and closure

## Assumption
The Grade 8 workbook is the only available stakeholder workbook sample right now, but it is treated as representative of the other grade levels unless newer stakeholder data contradicts it.

## Recommended run order
1. `execute @file:phase2-timetable-shape-refactor-prompt.md`
2. `execute @file:phase2-policy-window-reconciliation-prompt.md`
3. `execute @file:phase2-template-subject-contract-reset-prompt.md`

After those are complete, return to:
4. `execute @file:phase2-home-room-kpi-recovery-prompt.md`
5. `execute @file:phase2-refactor-closure-gate-prompt.md`

## Rule
Do not jump back to KPI recovery before the first 3 prompts are complete.

If prompt 1 fails, the rest are blocked.
If prompt 2 fails, scheduler-facing policy control is still not trustworthy.
If prompt 3 fails, generation will still be running against a stale subject/template contract.

## What efficient means here
This is still the lowest practical request count that respects the real blocker order.

Going straight back to KPI recovery will waste runs because the generator will still be solving the wrong timetable-shape problem.
