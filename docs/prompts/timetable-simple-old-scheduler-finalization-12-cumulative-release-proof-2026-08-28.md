# Prompt 12 - Cumulative Old-Scheduler Release Proof

## Role

You are the ATLAS release verifier for the remaining old-scheduler timetable sequence.

This is the only final QA handoff point for Prompts 09-11. Verify the entire sequence end to end, open the user-facing timetable surfaces, and separate Technical GO from moderated Product GO.

## Required preflight

Before editing:

1. Confirm Prompts 09, 10, and 11 are GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-remaining-issues-sequence-2026-08-28.md`
   - final reports from Prompts 09-11
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
   - `ATLAS_AGENT_KI.md`
3. Check git state.
4. Inspect changed files from Prompts 09-11.
5. If any prior prompt skipped a required proof without a deterministic fixture attempt, keep this final QA at `NO-GO`.

## Scope

In scope:

- final non-destructive old-scheduler proof for `/timetable`;
- reversible teacher-departure mutation proof review;
- stale-spec guard review;
- focused and cumulative Playwright gates;
- Tailnet 3-viewport screenshots and metrics;
- final evidence document.

Out of scope:

- new features;
- broad redesign;
- generation algorithm changes;
- live destructive publish;
- claiming moderated Product GO without real moderated older-scheduler validation.

## Required source audit

Audit:

- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`
- `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
- `qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts`
- `qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts`
- `qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts`
- `qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts`
- all active old-scheduler timetable specs changed by Prompts 09-11

## Required live old-scheduler journey

Using live Tailnet as the Admin scheduler, verify:

1. Login and open `/timetable`.
2. Confirm Simple mode is the default ordinary scheduler path.
3. Open Tutorial from direct Help and from More.
4. Open Status key and verify definitions are visible directly.
5. Open Filters and close it.
6. Switch Section, Teacher, and Room schedule views.
7. Select a generated class and verify details, move, swap, and teacher-leaving actions are understandable.
8. Open generated swap review and verify it remains concise with three primary regions.
9. Open publish readiness and verify blocker groups have plain-language next actions.
10. Open generated unassigned queue or record deterministic fixture-limited evidence.
11. Open draft planning and draft placement if a draft fixture exists.
12. Open teacher-leaving flow from Simple More and from selected class.
13. Review Prompt 10 evidence that teacher-leaving save/revert passed on an isolated unpublished run.
14. Verify published teacher-leaving remains revision-only.
15. Open Advanced mode and verify it is available without becoming the required path for ordinary decisions.

Run the journey on:

- `1366x768`
- `390x844`
- `844x390`

## Wall-of-text release rule

Mark `NO-GO` if any active timetable surface:

- presents more than three primary decision regions before actions;
- requires scrolling before the primary action is understandable at `844x390`;
- shows a primary instruction block longer than one heading plus one short sentence;
- shows raw enum-only copy such as `UNASSIGNED_SECTION`, `NO_AVAILABLE_SLOT`, `FACULTY_SLOT_UNAVAILABLE`, or `ROOM_TYPE_MISMATCH` without plain-language framing;
- hides the only useful action behind hover-only help;
- leaves the scheduler without a visible cancel/back/close path.

## Required commands

Static:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Focused browser:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --project=desktop --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Stale-copy and raw-control guard:

```bash
cd D:\ATLAS
rg -n "Review occupied-slot swap|Review draft placement|Plan before generating|Blocking 0|Blocking - - Warnings -|<button|<select|title=" atlas-client/src/components/timetable qa-artifacts/playwright/specs
```

Treat expected matches in UI primitives or explicitly superseded historical artifacts separately. Do not hide active scheduler-facing violations.

## Required artifacts

Save final evidence under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\12-cumulative-release-proof\
```

Create:

```text
docs/verification/timetable-simple-old-scheduler-remaining-issues-release-proof-2026-08-28.md
```

The evidence document must include:

- final verdict;
- prompt-by-prompt results for 09-11;
- commands and results;
- screenshot/artifact paths;
- teacher-departure save/revert proof;
- generated unassigned queue proof;
- draft fixture status;
- blocked swap fixture status;
- stale-copy guard results;
- wall-of-text metrics summary;
- Product GO status.

## Final verdict rules

Use `GO` only if:

- Prompts 09-11 are GO;
- all static gates pass;
- all active focused browser gates pass;
- teacher-departure save/revert is proven on an isolated unpublished run;
- generated unassigned touch queue proof is deterministic;
- readiness sheet opens reliably in the active bundle;
- no active scheduler-facing component violates the wall-of-text rule;
- Tailnet proof exists for all three required viewports.

Use `CONDITIONAL GO` only for true data limitations that cannot be manufactured safely and are fully documented.

Use `NO-GO` if any stale test contract remains, any deterministic proof remains fixture-limited without an attempted fix, or any old-scheduler surface still requires mental gymnastics to decide what to do next.

## Final report requirements

Report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- prompt-by-prompt result;
- files changed across Prompts 09-12;
- exact commands and results;
- live Tailnet route and viewport evidence;
- teacher-departure mutation proof;
- remaining caveats;
- whether moderated Product GO is still pending;
- suggested conventional commit message.

## Suggested commit

```text
test(timetable): prove old-scheduler timetable readiness
```
