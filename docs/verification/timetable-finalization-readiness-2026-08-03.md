# Timetable Finalization Readiness Report — 2026-08-03

## Verdict

`GO` for the implemented finalization scope:

- generated-run placement and swap
- pre-generation draft placement and swap regression coverage
- crowded grid-cell overflow discoverability
- teacher-departure reassignment for unpublished generated runs
- published-run teacher-departure revision-only flow
- policy/panel/performance regression coverage
- older-user safety guardrails covered by existing simplification and workflow gates

## Implemented changes

### Crowded grid cells

- Replaced passive `+N more` overflow text with an actionable overflow trigger.
- Added a cell overflow sheet that lists every hidden session in the crowded cell.
- Added per-hidden-session actions:
  - `Select`
  - `Swap`
  - `Move`
  - `Reassign`
  - `Details`
- Added hidden affected-session badges so teacher-departure sessions remain discoverable even when compressed behind overflow.

### Teacher-departure navigation

- Added `Show affected only` in the teacher-departure recovery sheet.
- Added `Jump to first affected`.
- Added per-group `Show on timetable`.
- Added a plain affected-session summary covering grid, unresolved, draft-linked, and groups still needing replacement.
- Added grid highlighting and jump behavior that points users to the relevant visible entry or crowded-cell overflow trigger.

### Published-run reassignment

- Connected teacher-departure recovery to the published revision review path.
- Published runs no longer expose the direct `Save reassignment` action.
- Published reassignment requires the existing effective-date revision dialog.
- Added `published-teacher-departure-effective-date` test coverage.

### Maintainability

- Extracted `TimetableDraggableEntry` from `TimetableGrid.tsx` to restore the project file-size guard.
- Current component sizes:
  - `TimetableGrid.tsx`: 923 lines
  - `TeacherDepartureRecoverySheet.tsx`: 647 lines
  - `TimetableDraggableEntry.tsx`: 140 lines
  - `TimetableCellOverflowSheet.tsx`: 173 lines

## Verification commands

### Static/local gates

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` in `atlas-client` | PASS |
| `npm run test:ux-guardrails` in `atlas-client` | PASS `36/36` |
| `npm run test:timetable-conflict` in `atlas-client` | PASS `10/10` |
| `npm run build` in `atlas-client` | PASS, final Vite build completed in `529ms` |

### Browser and contract gates

| Command | Result |
| --- | --- |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1` | PASS `6/6` |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-finalization-grid-overflow.spec.ts --project=desktop --workers=1` | PASS `3/3` |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts --workers=1` | PASS `6/6` across desktop, mobile portrait, and mobile landscape |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --project=desktop --workers=1` | PASS `1/1`, live fixture saved and reversed |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-finalization-published-revision.spec.ts --project=desktop --workers=1` | PASS `1/1` |
| `npx tsx atlas-server/src/__tests__/published-revision-contract.test.ts` | PASS `16/16` |
| `npx tsx atlas-server/src/__tests__/timetable-teaching-load-repair-contract.test.ts` | PASS |
| Combined workflow/finalization/teacher-departure regression suite | PASS `52 passed, 2 skipped` |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1` | PASS `42/42` across desktop, mobile portrait, and mobile landscape; rerun on 2026-08-03 passed with strict unexpected-network-failure gating and no `NETWORK FAILED` output |
| `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-finalization-screenshots.spec.ts --project=desktop --workers=1` | PASS `1/1` |

## Screenshot artifacts

- `qa-artifacts/timetable-finalization-2026-08-02/01-simple-default.png`
- `qa-artifacts/timetable-finalization-2026-08-02/02-advanced-view.png`
- `qa-artifacts/timetable-finalization-2026-08-02/03-crowded-cell-overflow.png`
- `qa-artifacts/timetable-finalization-2026-08-02/04-teacher-departure-sheet.png`
- `qa-artifacts/timetable-finalization-2026-08-02/05-published-revision-dialog.png`

## UX readiness assessment

### Passed

- Simple view keeps the grid as the primary visual object.
- Crowded cells no longer hide sessions behind passive text.
- Hidden sessions can be selected, swapped, and launched into teacher reassignment.
- Teacher-departure sessions can be filtered, jumped to, and shown on the timetable.
- Published-run reassignment explains revision behavior instead of direct mutation.
- Click-first generated and draft workflows remain covered by regression tests.
- Drag remains supported and performance-contained.
- Disabled or blocked placement paths continue to expose plain next-step copy through existing workflow gates.
- No global browser scrollbar or horizontal overflow was introduced by the finalization changes.
- No obsolete `Assign teacher and room` or `Choose teacher` timetable modal language was found in timetable surfaces.

### Caveats / non-blocking backlog

- The published-run live mutation path was proven through backend contract tests plus read-only browser UI proof. A real live published fixture write was not performed because published schedules are audit records and the plan allowed avoiding unsafe live mutation.
- The broader page can still be simplified further in future QoL work, but the finalization blockers in this plan are now covered by direct browser tests.

### Resolved runtime-hardening caveat

- The Tailnet/Vite dev abort caveat was closed on 2026-08-03 by removing the performance harness's unnecessary pre-scenario hard navigation to `/`, suppressing only expected navigation/module `ERR_ABORTED` events as attached evidence, and failing the scenario on any unexpected request failure.
- The strict rerun passed `42/42` without `NETWORK FAILED` output.

## Decision

`GO` for the finalization plan.

The timetable can proceed to external review for this scope. Remaining work should focus on non-blocking QoL polish, not on the finalization blockers addressed here.
