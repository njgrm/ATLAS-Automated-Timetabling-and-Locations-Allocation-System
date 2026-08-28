# Prompt 04 — Workbook Output Contract

## Role

You are the ATLAS reporting contract agent. Implement only this prompt after Prompt 03 is GO.

## Background

The first target workbook is:

```text
D:\ATLAS\SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx
```

Additional schedule-output references:

```text
E:\aral-prog_G7_Class-Program_SY2026-2027docx.docx
E:\40-minutes.xlsx
docs/analysis/timetable-reference-schedule-files-audit-2026-08-15.md
```

It contains:

- class monitoring summary sheets;
- per-subject teacher schedule sheets;
- fixed time rows;
- adviser rows;
- teacher-name rows;
- subject rows;
- recess/lunch rows;
- empty cells for free periods.

The files are reference output shapes, not scheduling truth.

## Objective

Create a precise export/reporting contract that maps ATLAS timetable data to the reference schedule-output family.

## Scope

### In scope

- Analyze workbook sheets, ranges, row patterns, and cell semantics.
- Analyze the Grade 7 class-program DOCX table patterns and signatory/footer semantics.
- Analyze `40-minutes.xlsx` as an alternate bell-layout reference with mixed period durations.
- Define ATLAS data fields needed for each workbook area.
- Define ATLAS data fields needed for official class-program areas.
- Define export acceptance tests.
- Identify data currently missing or ambiguous.
- Produce documentation only.

### Out of scope

- Implementing XLSX export.
- Implementing DOCX export.
- Changing generation.
- Changing policy defaults.
- Editing the reference workbook.
- Editing the reference DOCX.

## Required output

Create:

```text
docs/reference/timetable-workbook-output-contract-2026-08-15.md
```

The contract shall include:

- report family purpose;
- workbook sheet inventory;
- class-program document/table inventory;
- summary/class-monitoring sheet structure;
- per-subject teacher sheet structure;
- official class-program structure;
- horizontal section grouping/pagination rules;
- `SECTION`, `ADVISER`, and `BLDG./RM.` band rules;
- paired teacher/subject row rules;
- time-row source rule;
- adviser-row source rule;
- teacher-name source rule;
- subject-cell source rule;
- section-cell source rule;
- recess/lunch/special-event source rule;
- configurable break-label source rule, including `HEALTH BREAK`, `RECESS`, and `LUNCH BREAK`;
- placeholder teacher display rule, including labels such as `TEACHER X`;
- signatory/footer metadata rule;
- empty-cell behavior;
- sorting/grouping rules;
- formatting goals;
- required ATLAS API/data inputs;
- known gaps;
- acceptance criteria.

## Policy rule

The contract shall state that workbook/class-program time rows are generated from the selected run’s `timetableDisplaySlots` or current in-system policy, never copied as constants from the sample workbook or DOCX.

## Test/documentation requirements

Add a lightweight workbook inspection artifact or summary under:

```text
docs/analysis/timetable-workbook-reference-audit-2026-08-15.md
```

It shall list:

- sheet names;
- sheet dimensions;
- sample row semantics;
- class-program DOCX table dimensions;
- mixed 40/45/long-period examples from `40-minutes.xlsx`;
- fields ATLAS can already provide;
- fields ATLAS cannot yet provide or needs to normalize.

## Report format

Return:

1. GO / NO-GO
2. Files created
3. Workbook sheets and DOCX table patterns found
4. ATLAS capability assessment
5. Export implementation blockers
6. Decision on whether DOCX class-program generation is included now or deferred
