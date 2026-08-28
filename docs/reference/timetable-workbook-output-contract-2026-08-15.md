# Timetable Workbook Output Contract — 2026-08-15

## Report Family Purpose

This contract defines how ATLAS timetable data maps to the reference schedule-output reporting family. ATLAS exports accurate schedule worksheet data that school staff may copy into their existing DOCX or official templates.

All time rows are generated from the selected run's `timetableDisplaySlots` or current in-system policy. No time values are copied as constants from the reference workbook or DOCX.

## Out of Scope for Current Export Phase

The following items are **explicitly out of scope** for this export phase:

1. Configurable signatory/footer metadata.
2. Configurable teacher-name format controls.
3. Official DOCX export generation.
4. Automated placement of names/signatures/approval blocks.

**Rationale:** The school already has existing DOCX/template workflows for names, signatures, approval blocks, and final document formatting. It is simpler and safer for ATLAS to provide accurate schedule worksheet data that staff can copy into those documents. Building DOCX/signatory tooling now would add UI and configuration complexity without blocking AIMS connectivity or schedule validation.

## Current ATLAS Responsibility

ATLAS shall export accurate schedule worksheet data for:

- **Class-Monitoring Summary** — sections across columns, time down rows, teacher+subject in cells
- **Class-Program Schedule Table** — sections across columns, paired teacher/subject rows, building/room bands
- **Per-subject teacher schedule worksheets** — deferred; implement as a separate prompt if required

The exported worksheets shall contain reliable schedule data:

- section names
- adviser labels when available
- teacher labels (last name, or "Last, First" when first name is available)
- subject labels
- room/building labels
- time slots
- break/lunch/flag rows
- school year and run metadata

## Intended Manual Workflow

School staff may copy the exported schedule tables into their existing DOCX or official templates and add:

- names
- signatories
- approval blocks
- formatting
- final school-specific document polish

## Workbook Sheet Inventory

### Class-Monitoring Summary (SUMMARY)

- One sheet per grade-level group
- Sections arranged horizontally across columns
- Time slots arranged vertically down rows
- Two horizontal bands per sheet when sections exceed ~12

### Official Class-Program (CLASS PROGRAM)

- One table per page of sections (6-7 sections per table)
- Sections across columns
- Paired teacher/subject rows per period
- SECTION / ADVISER / BLDG.ROOM NO. header bands

## Class-Monitoring Summary Sheet Structure

### Row Layout

```
Row 1: Report title (e.g., "CLASS-MONITORING SUMMARY")
Row 2: Metadata — School name, Year label, Run ID, Export date
Row 3: (blank)
Row 4: TIME labels (one per period slot) + SECTION names (column headers)
Row 5: ADVISER surnames
Row 6: Teacher label (period 1)
Row 7: Subject name (period 1)
Row 8: Teacher label (period 2)
Row 9: Subject name (period 2)
...repeating for each period...
Special row: RECESS / HEALTH BREAK (label in every column)
Special row: LUNCH BREAK (label in every column)
```

### Cell Semantics

- **Teacher cells**: Last name, or "Last, First" when first name is available
- **Subject cells**: Subject name (e.g., "SCIENCE")
- **Empty cells**: Free period (no class scheduled)
- **Break rows**: Identical label in every column

## Official Class-Program Structure

### Table Layout

```
Row 1: Report title (e.g., "CLASS PROGRAM")
Row 2: Metadata — School name, Year label, Run ID, Export date
Row 3: (blank)
Row 4: SECTION header (section names)
Row 5: ADVISER row (adviser surname per section)
Row 6: BLDG./RM. row (building/room labels)
Row 7: Teacher label (period 1)
Row 8: Subject name (period 1)
Row 9: Teacher label (period 2)
Row 10: Subject name (period 2)
...repeating for each period...
Special row: RECESS / HEALTH BREAK (label in every column)
Special row: LUNCH BREAK (label in every column)
```

### Paired Row Pattern

Each period uses 2 rows:
- **Row N**: Teacher label
- **Row N+1**: Subject name

Time labels are NOT shown in the class-program table (time is implicit from row position).

## Section Grouping / Horizontal Pagination Rules

- Maximum sections per table block: configurable (default: 7 for class-program, 12 for summary)
- When sections exceed the maximum, split into multiple horizontal bands
- Each band has its own SECTION / ADVISER header rows
- Bands are separated by a blank row

## SECTION, ADVISER, and BLDG./RM. Band Rules

### SECTION Band

- One section name per column
- Grade-level prefix optional (e.g., "9 - QUISUMBING")
- Program prefix for non-REGULAR sections (e.g., "STE DEL ROSARIO")

### ADVISER Band

- Adviser surname in the column below the section name
- Source: `FacultyMirror` where `advisedSectionId` matches the section's external ID
- If no adviser: leave empty

### BLDG./RM. Band (Class-Program only)

- Format: `{Building.name} / {Room.name}` (e.g., "BLDG 3 / ROOM 301")
- Source: Most frequently used room from entries for each section
- If no room data: leave empty

## Paired Teacher/Subject Row Rules

- Each period uses 2 rows: teacher on top, subject on bottom
- Teacher row shows last name (or "Last, First" when first name available)
- Subject row shows subject name or code
- If no class scheduled: both cells are empty
- Placeholder teachers show "Unassigned"

## Time-Row Source Rule

Time rows are generated from the selected run's `timetableDisplaySlots` or computed from:

1. `SchedulingPolicy.earliestStartTime` through `SchedulingPolicy.latestEndTime`
2. `SchedulingPolicy.periodLengthMinutes` increment
3. Blocked windows: flag ceremony, recess, lunch
4. `GradeShiftWindow` bounds per grade/program

**Never copy time labels from reference files.**

## Adviser-Row Source Rule

- Source: `FacultyMirror` records where `advisedSectionId` matches section external ID
- Display: surname only
- If no adviser: leave empty

## Teacher-Name Source Rule

- Source: `FacultyMirror.lastName` + `FacultyMirror.firstName`.
- Display: `Last, First` when first name is available.
- Display: `Last` when first name is unavailable.
- Placeholder/unassigned: show `Unassigned`.
- Configurable teacher-name format controls are out of scope for this phase.

## Subject-Cell Source Rule

- Source: `Subject.name` (fallback: `Subject.code`)
- Display: Subject name (consistent within a report)

## Section-Cell Source Rule

- Source: `SectionMirror.name`
- Optional prefix: grade level or program type for non-REGULAR sections

## Recess/Lunch/Special-Event Source Rule

- Recess: `SchedulingPolicy.enableRecess` + `recessStartTime`/`recessEndTime`
- Lunch: `SchedulingPolicy.enableLunchWindow` + `lunchStartTime`/`lunchEndTime`
- Flag ceremony: `SchedulingPolicy.enableFlagCeremony` + `flagCeremonyStartTime`/`flagCeremonyEndTime`
- Display: Row with label across all section columns
- Time: Derived from policy, never hard-coded

## Break-Label Source Rule

| Event | Default Label |
|-------|--------------|
| Recess | RECESS |
| Health break | HEALTH BREAK |
| Lunch break | LUNCH BREAK |
| Flag ceremony | FLAG CEREMONY |

## Room/Building Source Rule

- Source: `Room.name` + `Building.name` via `roomId` on each entry
- Hydration: Bulk-load rooms with nested building data from Prisma
- Class-program BLDG./RM. band: Uses most frequently assigned room per section
- If no room data: leave empty

## Signatory/Footer Metadata

**Out of scope.** Signatory data is report metadata, not schedule data. School staff add signatories manually when copying exported data into their official templates.

## Empty-Cell Behavior

- No class scheduled in a slot → both teacher and subject cells are empty string
- No teacher assigned → show "Unassigned"
- No section data → leave column empty

## Sorting/Grouping Rules

- Sections: Sorted by grade level, then by name
- Time slots: Chronological order from policy

## Formatting Goals

- Bold headers for SECTION, ADVISER, time labels
- Report title and metadata header on each sheet
- Borders around section columns (optional)

## Required ATLAS API/Data Inputs

| Input | Source |
|-------|--------|
| Generated/published run | `prisma.generationRun` |
| Run entries | `run.draftEntries` (JSONB) |
| Display slots | `run.summary.timetableDisplaySlots` |
| Sections | `prisma.sectionMirror` |
| Faculty | `prisma.facultyMirror` |
| Subjects | `prisma.subject` |
| Rooms/Buildings | `prisma.room` with nested `building` |
| School | `prisma.school` |
| School year label | `prisma.enrollProSchoolYearMirror.yearLabel` |

## Remaining Product Gap

The only workbook-family parity item that remains a real product gap is:

- **Per-subject teacher schedule worksheets** (one sheet per subject with teacher blocks and section schedules)

If that output is required, it should be implemented as a separate prompt. If not required, it should be documented as out of scope.

## Acceptance Criteria

| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Time rows derive from policy | No hard-coded time values from reference files |
| AC-02 | Break rows present | RECESS, LUNCH BREAK, FLAG CEREMONY rows appear when configured |
| AC-03 | Teacher names resolve | No raw faculty IDs in visible cells |
| AC-04 | Section names resolve | No raw section IDs in visible cells |
| AC-05 | Subject names resolve | No raw subject IDs in visible cells |
| AC-06 | Empty cells handled | Free periods show empty cells, not placeholder text |
| AC-07 | Paired rows correct | Teacher row above subject row for each period |
| AC-08 | Adviser row present | Adviser surname shown when available |
| AC-09 | Building/room present | BLDG./RM. shown when room data exists |
| AC-10 | Horizontal pagination | Sections split into multiple tables when exceeding max |
| AC-11 | Mixed-duration slots | Variable-length periods render correctly |
| AC-12 | School year label | Year label and run metadata included in workbook header |
| AC-13 | No raw IDs | No "Unknown ... (#id)" labels in visible cells |
