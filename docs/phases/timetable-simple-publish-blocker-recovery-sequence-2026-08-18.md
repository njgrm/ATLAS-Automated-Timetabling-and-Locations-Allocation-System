# Timetable Simple Publish Blocker Recovery Sequence — 2026-08-18

## Why this sequence exists

Simple mode is the default scheduler experience, but after generation it can currently show large numbers such as `99+ unresolved`, `105 blockers`, and `271 warnings` without giving the scheduler a clear path to understand or fix the problem. This is a release-blocking UX issue because users cannot publish and cannot quickly tell whether the problem is Teaching Load, unavailable slots, rooms, policy, or warnings.

Live Tailnet evidence from the latest completed run at investigation time:

- Latest completed run: `427`
- School year: `2`
- Assigned sessions: `820`
- Unresolved sessions: `105`
- Hard blockers: `105`
- Soft warnings: `273` in DB probe, while the user saw `271` in the UI. Treat this as selected-run/filter drift until proven otherwise.
- Hard blocker code: `UNASSIGNED_SECTION = 105`
- Real unresolved causes:
  - `FACULTY_OVERLOADED = 70`
  - `NO_AVAILABLE_SLOT = 35`

The UX failure is that Simple mode groups the hard blockers by the broad violation code `UNASSIGNED_SECTION`, while the useful causes live on unassigned items and summary diagnostics.

## Execution order

Run the prompts in order. Do not skip directly to UI polish before the data grouping and test fixture are locked.

1. `docs/prompts/timetable-simple-publish-blockers-01-baseline-and-fixture-2026-08-18.md`
2. `docs/prompts/timetable-simple-publish-blockers-02-diagnostic-contract-2026-08-18.md`
3. `docs/prompts/timetable-simple-publish-blockers-03-simple-readiness-sheet-2026-08-18.md`
4. `docs/prompts/timetable-simple-publish-blockers-04-repair-routing-and-filters-2026-08-18.md`
5. `docs/prompts/timetable-simple-publish-blockers-05-message-and-export-hardening-2026-08-18.md`
6. `docs/prompts/timetable-simple-publish-blockers-06-release-proof-2026-08-18.md`

## Gates between prompts

Each prompt must report:

- `GO` or `NO-GO`
- exact files changed
- exact commands run
- live Tailnet evidence when applicable
- before/after user-facing behavior
- remaining caveats

Proceed only when the prior prompt is `GO`, except for fixture-unavailable cases that are explicitly classified and do not hide a product defect.

## Design constraints

- Simple mode remains default.
- Advanced mode remains available but must not be required for understanding why publish is blocked.
- Do not change generation logic.
- Do not force publish with hard blockers.
- Do not hide warnings; make them secondary to blockers.
- Do not hard-code current live counts.
- Use shadcn/Radix primitives from `@/ui/*`.
- Do not introduce native `<select>`, raw styled `<button>`, raw `title`, or raw `<details>`.
- Preserve no-global-scroll architecture.
- Preserve generated placement, swap, draft planning, teacher-departure, policy, and workbook export behavior.

## Success definition

This sequence is complete only when a scheduler in Simple mode can answer:

1. Why can I not publish?
2. How many sessions are actually unresolved?
3. What are the top causes?
4. Which items should I fix first?
5. Which button should I press next?
6. Which warnings are not hard publish blockers?

## Suggested final commit

```text
fix(timetable): make simple publish blockers actionable

Explain unresolved generated sessions by real cause in Simple mode, route schedulers to the correct repair workflow, and harden publish-readiness tests.
```
