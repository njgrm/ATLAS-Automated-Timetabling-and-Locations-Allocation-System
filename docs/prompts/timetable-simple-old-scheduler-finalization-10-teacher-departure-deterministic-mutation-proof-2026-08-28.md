# Prompt 10 - Teacher Departure Deterministic Mutation Proof

## Role

You are the ATLAS executor assigned to prove that a scheduler can replace a leaving teacher after generation without damaging live schedule truth.

The current UI path and preview endpoint are reachable. The remaining blocker is that the reversible save/revert Playwright proof fails with `NO_FIXTURE_SOURCE`. Fix the proof path so teacher departure is tested end to end on an isolated unpublished run.

## Required preflight

Before editing:

1. Confirm Prompt 09 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-remaining-issues-sequence-2026-08-28.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
   - `ATLAS_AGENT_KI.md`
3. Inspect:
   - `qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts`
   - `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`
   - `atlas-client/src/hooks/useTimetableMutations.ts`
   - `atlas-server/src/routes/timetable-teaching-load-repair.router.ts`
   - `atlas-server/src/services/timetable-teaching-load-repair.service.ts`
   - any fixture-source endpoint used by the failing spec
4. Check git state.

## Scope

In scope:

- deterministic fixture source for teacher-departure save/revert proof;
- Playwright test repair for full open, preview, save, verify, revert, verify-restored flow;
- fixture cleanup after test completion;
- source guards that prevent published schedules from using direct Teaching Load rewrite;
- plain-language user-facing states inside the teacher-departure sheet if the proof exposes wall-of-text issues.

Out of scope:

- changing published schedule repair semantics;
- changing Teaching Load ownership rules beyond the selected isolated test fixture;
- broad generation algorithm changes;
- saving changes against the operator's normal live run without isolation and rollback.

## Required investigation

First reproduce and document the current blocker:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --project=desktop --workers=1 --reporter=line
```

If it fails with `NO_FIXTURE_SOURCE`, inspect the server route or helper that supplies `/performance-fixture-source`.

Decide the smallest safe fix:

- Preferred: create an isolated unpublished fixture run from an existing generated run with enough data for one reversible teacher reassignment.
- Acceptable: update the fixture resolver to allow a completed unpublished run with existing hard violations if the specific selected reassignment preview has `errorCount=0` and the test restores all changed ownership/timetable rows.
- Not acceptable: marking save/revert proof as skipped when a previewable reassignment exists.

## Required behavior to prove

The final test must prove:

- teacher-departure action is reachable from Simple More;
- teacher-departure action is reachable from a selected generated class;
- affected classes are visible and highlighted;
- replacement teacher can be selected;
- preview returns `errorCount=0`;
- save applies to the isolated unpublished run;
- affected timetable entries update to the replacement teacher;
- affected Teaching Load ownership changes are visible or API-verifiable;
- revert restores the original teacher and ownership;
- cleanup removes or neutralizes any fixture run created by the test;
- published schedules still open revision review instead of direct save.

## Old-scheduler UX requirements

During the teacher-departure flow:

- the sheet must show one current step at a time;
- each step must have one plain-language instruction sentence;
- the replacement step must show affected class groups visually, not as a long paragraph;
- the preview step must say whether the change is safe in plain language;
- conflict details must be behind disclosure if they exceed five rows;
- primary actions must remain visible at `844x390`;
- no scheduler-facing visible state may require interpreting raw enums.

## Required commands

Focused:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure-live-reversible.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-finalization-published-revision.spec.ts --project=desktop --workers=1 --reporter=line
```

Server, if backend or fixture endpoint changes:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npm run test:timetable-teaching-load-repair
```

Client:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Tailnet proof

Use live Tailnet. Save screenshots and JSON evidence under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\10-teacher-departure-mutation-proof\
```

Required evidence:

- fixture source response before fix and after fix;
- selected run ID and fixture run ID;
- original teacher ID/name;
- replacement teacher ID/name;
- preview summary;
- save response summary;
- post-save verification;
- revert response summary;
- post-revert verification;
- cleanup result;
- desktop, mobile portrait, and mobile landscape screenshots for the visible teacher-departure flow.

## Internal gate before Prompt 11

Prompt 10 is GO only when:

- full reversible teacher-departure proof passes;
- no live non-fixture run remains modified;
- published teacher-departure remains revision-only;
- static gates pass;
- any backend runtime change is proven by server build and a health check.

## Final report requirements

Report:

- Prompt 10 verdict;
- original blocker and exact fix;
- files changed;
- commands and results;
- fixture IDs and cleanup proof;
- Tailnet screenshot/artifact paths;
- published revision-only proof;
- whether Prompt 11 may proceed.

## Suggested commit

```text
test(timetable): prove reversible teacher departure repair
```
