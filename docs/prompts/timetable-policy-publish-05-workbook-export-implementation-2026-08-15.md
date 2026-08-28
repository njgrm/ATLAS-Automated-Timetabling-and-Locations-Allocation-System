# Prompt 05 — Workbook Export Implementation

## Role

You are the ATLAS timetable export implementation agent. Implement only this prompt after Prompt 04 is GO.

## Objective

Add a policy-driven Excel export that recreates the reference schedule-output reporting family from a generated or published ATLAS timetable.

## Scope

### In scope

- Backend export endpoint.
- Frontend export action.
- Workbook generation from ATLAS timetable data.
- Class-program-style workbook generation from ATLAS timetable data where included by the Prompt 04 contract.
- Tests comparing exported workbook structure to the contract.

### Out of scope

- Pixel-perfect Excel formatting.
- Hard-coding school-specific bell times.
- Hard-coding school-specific break labels.
- Hard-coding school official/signatory names.
- Changing generation output.
- Changing publish rules.
- DOCX export, unless Prompt 04 explicitly marks it in scope for this implementation pass.

## Backend behavior

Add a privileged export endpoint under `/api/v1/generation`, for example:

```text
GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/summary-teacher-schedule.xlsx
```

If the Prompt 04 contract includes class-program workbook export, add a second explicit endpoint, for example:

```text
GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx
```

The endpoint shall:

- require admin/officer/system-admin role;
- load the selected generated or published run;
- reject missing runs with plain `404`;
- reject runs with no entries using a plain empty-state error;
- derive time rows from the run’s `summary.timetableDisplaySlots`;
- derive teacher, section, subject, adviser, recess, lunch, and special event labels from ATLAS reference data;
- derive break labels from stored policy/configuration or run metadata;
- derive class-program `SECTION`, `ADVISER`, and `BLDG./RM.` rows from ATLAS reference data;
- generate:
  - summary/class-monitoring sheet(s);
  - one sheet per subject or subject family;
- generate official class-program sheet(s) if included in the Prompt 04 contract;
- never hard-code workbook bell times;
- never hard-code class-program bell times;
- preserve historical/published run truth.

## Frontend behavior

Add a Simple timetable export action:

- visible when a generated run exists;
- grouped near Publish or under More → Schedule data if header space is tight;
- label: `Export workbook`;
- disabled with reason if no generated/published run exists;
- success/failure feedback is persistent and plain-language.

## Workbook behavior

The generated workbook shall:

- include the active school year label;
- include time rows from the selected run;
- include adviser row when adviser data exists;
- show teacher surname/name in class-monitoring cells;
- show subject label below teacher label;
- support paired teacher/subject rows for class-program reports;
- support horizontal section grouping when there are more sections than fit in one printable block;
- show special event rows for recess/lunch/flag ceremony when in `timetableDisplaySlots`;
- show configurable break labels such as `HEALTH BREAK`, `RECESS`, and `LUNCH BREAK`;
- create per-subject teacher schedule sheets with time, subject, and section columns;
- show placeholder teachers in plain form without raw database IDs;
- avoid raw database IDs in visible cells.

## Test requirements

Add backend/export tests:

- endpoint rejects unauthorized users;
- endpoint rejects missing run;
- endpoint returns `.xlsx` content type;
- exported workbook has expected sheets;
- exported workbook time rows match run display slots;
- exported class-program workbook, if included, has `SECTION`, `ADVISER`, `BLDG./RM.`, paired teacher/subject rows, and configurable break labels;
- exported workbook contains no raw unknown labels in visible cells.

Add browser tests:

- Simple mode exposes `Export workbook`;
- disabled export explains why;
- export downloads an `.xlsx`;
- downloaded workbook opens and matches basic structure.

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
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-current-full-function-matrix.spec.ts --workers=1
```

## Report format

Return:

1. GO / NO-GO
2. Files changed
3. Export endpoint details
4. Browser download proof
5. Workbook structural comparison against the report family contract
6. Remaining formatting gaps
