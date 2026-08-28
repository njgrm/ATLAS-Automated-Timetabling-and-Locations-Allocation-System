# Prompt 05 — Workbook Export Parity Proof

## Role

You are the ATLAS workbook/export verifier. Implement only this prompt after Prompt 04 is GO.

## Context

The target output family is represented by:

- `D:\ATLAS\SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`
- `E:\aral-prog_G7_Class-Program_SY2026-2027docx.docx`
- `E:\40-minutes.xlsx`

ATLAS does not need to generate official DOCX forms, signatory blocks, or manually polished footer metadata. Staff can paste/copy exported worksheet data into their existing official documents.

ATLAS must export the schedule worksheet parts it owns:

- section schedule cells;
- teacher schedule cells;
- subject labels;
- teacher names;
- room/building labels;
- adviser bands;
- policy-derived time rows;
- policy-derived break/lunch/special-event rows;
- empty free-period cells.

## Objective

Prove that workbook export follows the real policy-derived schedule shape and remains usable as source material for school-maintained official documents.

## Scope

### In scope

- Workbook export content tests.
- Class-program worksheet shape proof.
- Summary/teacher schedule worksheet proof.
- Break/lunch/health event label proof.
- Room/building/adviser band proof.
- Placeholder teacher display proof.
- Empty-cell behavior proof.
- Documentation cleanup if the contract still contradicts implemented export behavior.

### Out of scope

- DOCX export generation.
- Configurable signatory/footer metadata.
- Configurable teacher-name formatting.
- Hard-coded workbook constants.
- Changing generation/publish behavior.

## Required behavior

- Workbook time rows shall derive from generated run `timetableDisplaySlots` or current in-system policy.
- Workbook break rows shall use configured policy/special-event labels.
- Workbook section schedules shall include `SECTION`, `ADVISER`, and `BLDG./RM.` bands where data exists.
- Workbook teacher/subject cells shall not show raw `Unknown ... (#id)` labels on normal export paths.
- Placeholder/substitute teachers shall use plain labels such as `Unassigned` or configured substitute labels, not raw internal IDs.
- Empty free-period cells shall stay empty.
- Export documentation shall not claim implemented items are still known gaps.
- Export documentation shall explicitly state that signatories, footer metadata, final DOCX layout, and manually polished official formatting are outside the current ATLAS export responsibility.

## Required tests

Add or update workbook export tests proving:

- report headers include school, year, run ID, and export date;
- class-program sheet exists;
- summary/teacher schedule sheet exists;
- time rows are chronological and policy-derived;
- health break, lunch, and other special events appear from configured display slots;
- room/building labels hydrate correctly;
- adviser rows hydrate correctly when available;
- no visible raw unknown-ID labels appear;
- empty cells remain blank;
- official DOCX-only metadata remains out of scope.

## Verification commands

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
npm run test:workbook-export

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

If export is reachable through the timetable UI, also run the relevant timetable browser smoke:

```bash
cd D:\ATLAS\atlas-client
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Export sheets verified
4. Proof that time rows and breaks are policy-derived
5. Proof that DOCX/signatory formatting is out of scope
6. Exact commands and results
7. Remaining export gaps

## Acceptance criteria

Prompt 05 is GO only if:

- workbook export uses policy/run display slots;
- configured special-event labels appear correctly;
- exported labels are human-readable;
- docs no longer contradict implemented metadata/break behavior;
- no export test or timetable smoke regression occurs.

