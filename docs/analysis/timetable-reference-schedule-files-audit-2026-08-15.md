# Timetable Reference Schedule Files Audit — 2026-08-15

## Purpose

This audit summarizes two additional schedule reference files supplied by the user:

- `E:\aral-prog_G7_Class-Program_SY2026-2027docx.docx`
- `E:\40-minutes.xlsx`

These files are source references for expected report shapes. They are not instructions to hard-code school-specific times, teachers, rooms, sections, or subject assignments into ATLAS.

## Important findings from the Grade 7 class-program DOCX

The DOCX is an official class-program style report, not a generation input.

Observed structure:

- Four schedule tables.
- Each table is approximately `21` rows by `9` columns.
- Each section block starts with:
  - `SECTION`
  - `ADVISER`
  - `BLDG/ROOM NO.`
- Class rows are represented as paired rows:
  - one row for subject/activity values;
  - one row for subject teacher values.
- The document includes official signatory blocks for prepared, checked, noted, recommending approval, and approved by roles.
- The document uses `HEALTH BREAK` as a visible break label.
- The document uses `LUNCH BREAK` as a visible break label.

Observed time slots:

- `06:00-06:45`
- `06:45-07:30`
- `07:30-08:15`
- `08:15-09:00`
- `09:00-09:15` health break
- `09:15-10:00`
- `10:00-10:45`
- `10:45-11:30`
- `11:30-12:15`

Important implications:

- ATLAS export/reporting must support an official class-program layout, not only teacher-summary sheets.
- ATLAS must support paired subject/teacher display rows in export outputs.
- Break labels must be policy/configuration-driven because this school reference uses `HEALTH BREAK`, while prior UI discussions also used `RECESS`.
- Adviser and room rows are first-class report fields.
- Signatory/footer blocks should be configurable report metadata, not hard-coded names.

## Important findings from `40-minutes.xlsx`

The workbook contains three sheets and multiple horizontal schedule blocks.

Observed structure:

- `Sheet1` contains broad multi-section schedule blocks plus official header/signatory areas.
- `Sheet2` contains a cleaner class-program table subset with `TIME`, section names, `ADVISER`, and `BLDG./RM.` rows.
- `Sheet3` contains a larger multi-block class-program layout with many section columns.
- The workbook contains paired teacher/subject rows.
- The workbook includes placeholder teacher labels such as `TEACHER X`.
- The workbook includes `HEALTH BREAK` and `LUNCH BREAK`.

Observed time patterns include mixed slot lengths:

- 45-minute slots such as `10:00-10:45`, `12:15-1:00`, `1:00-1:45`.
- 40-minute slots such as `10:00-10:40`.
- Longer slots such as `10:20-11:20` and `09:30-10:45`.
- Short break/transition slots such as `3:15-3:30` and `3:30-3:45`.

Important implications:

- The filename `40-minutes.xlsx` must not be interpreted as “all periods are 40 minutes.”
- ATLAS must derive schedule slots from Scheduling Policy, Grade Shift Windows, special-event blocks, and generated run display slots.
- Export must support multiple horizontal class-program blocks when many sections cannot fit in one table.
- Export parsing/formatting must normalize afternoon labels such as `1:00` based on sequence/context rather than interpreting them as raw 24-hour `01:00`.
- Placeholder teacher ownership must remain visible in reports as a plain placeholder state, not as an unexplained raw value.

## Prompt-sequence changes required

The existing timetable prompt sequence should treat the target as a reference output family:

1. Summary/class-monitoring workbook.
2. Teacher schedule per subject workbook.
3. Official class-program workbook or document layout.
4. Policy-driven alternate bell schedules, including 40-minute, 45-minute, mixed-duration, break, lunch, and long-block variants.

The prompts must explicitly require:

- no hard-coded reference times;
- no hard-coded break labels;
- no hard-coded school official names;
- no raw database IDs in visible exported cells;
- support for `SECTION`, `ADVISER`, and `BLDG./RM.` report bands;
- support for paired teacher/subject rows;
- support for placeholders such as `TEACHER X` with plain-language meaning;
- support for horizontal pagination/grouping by section when the report is wider than one printable block.

## Recommended implementation stance

The next implementation prompts should not begin with a single “copy this workbook” exporter. They should first define a report-output contract that maps ATLAS data into each report family. Implementation should follow only after the contract proves:

- which fields ATLAS already provides;
- which report fields require configurable metadata;
- how time rows are generated from policy/run metadata;
- how class-program and teacher-summary outputs differ;
- how mixed-duration schedules are represented without hard-coded assumptions.
