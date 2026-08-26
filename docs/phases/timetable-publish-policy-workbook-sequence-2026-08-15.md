# Timetable Publish, Policy, and Workbook Output Sequence — 2026-08-15

## Purpose

This sequence closes the next timetable readiness gap: Simple mode publish discoverability, publish blocker repair guidance, policy-driven bell schedule behavior, and the ability to recreate the stakeholder schedule-output family from ATLAS timetable data.

The reference workbook is `SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`. It is a target reporting shape, not a source of scheduling truth.

Additional reference files inspected on 2026-08-15:

- `E:\aral-prog_G7_Class-Program_SY2026-2027docx.docx`
- `E:\40-minutes.xlsx`

See `docs/analysis/timetable-reference-schedule-files-audit-2026-08-15.md`.

## Current verified live state

Live Tailnet target: `https://njgrm.buru-degree.ts.net`

Observed on 2026-08-15:

- Active school year: `5 / 2026-2027`
- Runtime source: `enrollpro-verified`
- Drift state: `aligned`
- Latest generated run: `#424`
- Latest generated run status: `COMPLETED`
- Assigned entries: `780`
- Unassigned sessions: `145`
- Hard violations: `145`
- Soft warnings: `278`
- Publish endpoint result for latest run: `422 PUBLISH_BLOCKED_HARD_VIOLATIONS`
- Hard blocker groups:
  - `FACULTY_OVERLOADED`: `75`
  - `NO_QUALIFIED_FACULTY`: `40`
  - `NO_AVAILABLE_SLOT`: `30`

## Core policy decision

ATLAS must never hard-code the workbook bell schedule into generation, display, export, or validation.

The source of scheduling time truth is:

1. `SchedulingPolicy`
2. `GradeShiftWindow`
3. generated run `summary.timetableShapeContracts`
4. generated run `summary.timetableDisplaySlots`

The reference files include `6:00-6:45`, `6:45-7:30`, 40-minute periods, 45-minute periods, longer blocks, `HEALTH BREAK`, and `LUNCH BREAK` rows. These are examples of school-specific schedule shapes that ATLAS must be able to represent when the in-system policy is configured that way.

## Sequencing

Execute in this order:

1. `docs/prompts/timetable-policy-publish-01-simple-publish-readiness-2026-08-15.md`
2. `docs/prompts/timetable-policy-publish-02-publish-blocker-repair-guidance-2026-08-15.md`
3. `docs/prompts/timetable-policy-publish-03-policy-driven-bell-schedule-alignment-2026-08-15.md`
4. `docs/prompts/timetable-policy-publish-04-workbook-output-contract-2026-08-15.md`
5. `docs/prompts/timetable-policy-publish-05-workbook-export-implementation-2026-08-15.md`
6. `docs/prompts/timetable-policy-publish-06-release-proof-2026-08-15.md`

## Gates between prompts

Do not proceed to the next prompt until the current prompt produces:

- exact files changed;
- exact commands run;
- Tailnet endpoint/browser evidence where requested;
- GO / NO-GO verdict;
- blocker list with reproduction steps for every NO-GO.

## Non-negotiable constraints

- Simple mode remains the default scheduler experience.
- Advanced mode remains available for power users.
- Generation truth, Teaching Load truth, published schedule audit truth, and EnrollPro ownership boundaries must not change unless a prompt explicitly requests it.
- No timetable time, recess, lunch, health break, flag ceremony, grade window, period duration, section grouping, teacher name, room label, adviser label, signatory name, or period count may be hard-coded from the reference files.
- All schedule shape behavior must derive from stored policy, stored shift windows, or generated run summary metadata.
- The workbook and DOCX are reporting contract references only.
- Export/reporting must support a family of report shapes, including summary/class-monitoring, teacher schedule per subject, and official class-program style layouts.
- No global browser scrollbar.
- No horizontal overflow.
- No visible text overlap.
- No obsolete teacher/room assignment modal.
- Every disabled publish/generation/export action must explain why in plain language.

## Required recurring checks

Run after any implementation prompt that changes source code:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Run Tailnet checks when the prompt touches timetable UX, generation, publish, or export:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1
```

## Final release expectation

This sequence is complete only when:

- Simple mode has a visible publish path.
- Blocked publish explains what to fix next.
- 6:00 scheduling is controlled by policy and grade windows, not hard-coded.
- The reference workbook and class-program layouts are captured as explicit export/reporting contracts.
- ATLAS can generate an `.xlsx` workbook in the same reporting family when a valid completed or published run exists.
- The contract identifies whether official class-program `.docx` generation is in scope now or deferred after workbook export.
- Browser and API tests prove the behavior on Tailnet.
