# Timetable Simple Lost-Scheduler Fix Sequence — 2026-08-19

## Why this sequence exists

QA review of `fix(timetable): prevent lost scheduler states in simple mode` found that most Simple timetable lost-scheduler work is valid, but the sequence cannot be signed off yet.

Concrete remaining failures:

1. `timetable-performance.spec.ts` fails in all three viewports at Scenario 7, `Keyboard select-then-place`.
2. The mobile-landscape More trigger still logs a visible overflow condition, but the test currently treats it as a pass.
3. The claim that compact grade labels were fully changed from `G7` to `GR7` is false. Several timetable-related source files still render `G{grade}`.
4. The final release proof omitted or did not successfully run the required performance matrix.

This fix sequence is narrow. Do not redesign Simple mode. Fix the verified defects and tighten the tests so these issues cannot be silently accepted again.

## Execution order

Run the prompts in order:

1. `docs/prompts/timetable-simple-lost-scheduler-fix-01-keyboard-special-events-2026-08-19.md`
2. `docs/prompts/timetable-simple-lost-scheduler-fix-02-mobile-more-overflow-2026-08-19.md`
3. `docs/prompts/timetable-simple-lost-scheduler-fix-03-grade-label-cleanup-2026-08-19.md`
4. `docs/prompts/timetable-simple-lost-scheduler-fix-04-release-proof-2026-08-19.md`

The executor may implement these in one coding pass only if each prompt is still reported separately with exact evidence.

## Non-negotiable constraints

- Simple mode remains default.
- Advanced mode remains optional.
- Do not change generation logic.
- Do not change publish gates.
- Do not change Teaching Load ownership truth.
- Do not hide special-event rows from the timetable.
- Do not remove keyboard support to make the performance test pass.
- Do not weaken or skip the performance gate.
- Do not commit generated `atlas-client/dist` artifacts unless the repository policy explicitly requires them.
- Use shadcn/Radix primitives from `@/ui/*`.
- Do not introduce raw styled `<button>`, native `<select>`, raw `title`, or raw `<details>`.

## Required final state

- `timetable-performance.spec.ts` passes all 42 tests with `PLAYWRIGHT_ADMIN_EMAIL` and `PLAYWRIGHT_ADMIN_PASSWORD` set.
- Mobile-landscape More trigger overflow fails the test if the visible trigger leaves the viewport.
- All timetable-visible compact grade labels use `GR7`, `GR8`, `GR9`, and `GR10`.
- The release report includes the full performance matrix result, not only Simple-mode functional specs.

## Suggested final commit

```text
fix(timetable): close simple lost-scheduler release blockers

Restore keyboard placement accessibility for special-event cells, fix mobile landscape More overflow, complete GR grade-label cleanup, and harden release proof gates.
```
