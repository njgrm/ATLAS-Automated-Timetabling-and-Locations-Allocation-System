# Timetable Simple Lost-Scheduler Prevention Sequence — 2026-08-19

## Why this sequence exists

Simple timetable mode is now functionally strong, but it is not yet fool-proof for older non-technical scheduler officers. The latest QA pass found that schedulers can still lose context after clicking into repair paths, especially when moving from publish blockers into the plotting tray. The page must always answer:

1. What am I looking at?
2. Why am I here?
3. What should I do next?
4. How do I go back safely?
5. What will happen if I press this button?

This is not a broad redesign. It is a context, guidance, and lost-user-prevention pass for the existing Simple timetable workflow.

## Current QA findings to address

- The publish-blocker sheet is useful, but after routing into a repair path the plotting tray loses the context of which publish blocker is being fixed.
- A session can be filtered under `No available slot` while the visible row action says `Choose room` or `Fix owner`, which is technically valid but confusing without a reason stack.
- Mobile Simple mode hides visible Generate/Publish controls below `sm`, so mobile users may not see the same lifecycle affordance as desktop users.
- The Simple tutorial still teaches the older flow and does not cover publish blocker recovery, hidden rows/full-day view, export workbook, or what happens when generation/publishing is blocked.
- Several timetable components still render compact grade labels as `G7`, `G8`, etc. even though the project decision is `GR7`, `GR8`, etc.
- The More menu is grouped but still acts like a secondary cockpit. Help-like actions and lifecycle actions need clearer separation.
- Some disabled/error states may still lack the full non-technical pattern: what happened, why, next action, and whether retry is safe.
- Grid warning noise can still overwhelm Simple mode when many warning badges are visible.

## Execution order

The executor may implement these in one coding iteration, but must preserve the prompt boundaries and report results for each prompt separately.

1. `docs/prompts/timetable-simple-lost-scheduler-01-baseline-2026-08-19.md`
2. `docs/prompts/timetable-simple-lost-scheduler-02-context-continuity-2026-08-19.md`
3. `docs/prompts/timetable-simple-lost-scheduler-03-reason-stack-2026-08-19.md`
4. `docs/prompts/timetable-simple-lost-scheduler-04-mobile-lifecycle-controls-2026-08-19.md`
5. `docs/prompts/timetable-simple-lost-scheduler-05-help-tutorial-and-more-menu-2026-08-19.md`
6. `docs/prompts/timetable-simple-lost-scheduler-06-grade-labels-warning-noise-and-feedback-2026-08-19.md`
7. `docs/prompts/timetable-simple-lost-scheduler-07-release-proof-2026-08-19.md`

## Gates between prompts

Each prompt report must include:

- `GO` / `NO-GO`
- files changed
- exact commands run
- viewport coverage
- live Tailnet evidence where applicable
- before/after screenshots or artifact paths for visible UX changes
- remaining caveats

If running all prompts in one implementation pass, the executor must still stop and fix failures discovered by each prompt before declaring the full sequence complete.

## Design constraints

- Simple mode remains the default scheduler experience.
- Advanced mode remains available but must not be required to understand or recover from Simple-mode workflows.
- Do not change generation truth, Teaching Load ownership truth, publish gates, or backend data rules unless a concrete bug is discovered and explicitly documented.
- Do not force publishing with hard blockers.
- Do not hide warnings entirely; reduce warning noise in Simple mode and keep details discoverable.
- Do not hard-code current live counts, school year IDs, run IDs, section IDs, teacher IDs, or room IDs.
- Use shadcn/Radix primitives from `@/ui/*`.
- Do not introduce native `<select>`, raw styled `<button>`, raw `title`, or raw `<details>`.
- Preserve no-global-scroll architecture.
- Preserve generated placement, generated drag placement, generated swap, draft planning, draft placement, draft swap, teacher-departure, policy, publish, and workbook export behavior.
- Use `GR7`, `GR8`, `GR9`, and `GR10` for compact grade labels.

## Success definition

This sequence is complete only when a scheduler can click any visible Simple timetable control and always receive one of:

- a clear next action;
- a readable explanation;
- a reversible review step;
- a visible way back to the previous context;
- a plain-language disabled/error reason.

## Suggested final commit

```text
fix(timetable): prevent lost scheduler states in simple mode

Keep Simple timetable users oriented across publish blockers, placement queues, mobile lifecycle actions, tutorials, and warning-heavy grids.
```
