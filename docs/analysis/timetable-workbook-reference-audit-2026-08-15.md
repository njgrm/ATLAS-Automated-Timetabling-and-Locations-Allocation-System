# Timetable Reference Workbook Audit — 2026-08-15

## Purpose

Inspect the reference schedule-output files to document their structure, identify ATLAS field gaps, and inform the workbook output contract.

## Files Inspected

1. `D:\ATLAS\SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`
2. `D:\ATLAS\aral-prog_G7_Class-Program_SY2026-2027docx.docx`
3. `D:\ATLAS\40-minutes.xlsx`

## 1. SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx

### Sheet Inventory

| Sheet | Rows | Cols | Purpose |
|-------|------|------|---------|
| SUMMARY (2) | 76 | 16 | Grade 8 class-monitoring grid (alternate) |
| SUMMARY | 76 | 16 | Grade 8 class-monitoring grid (primary) |
| SCIENCE | 89 | 16 | Per-teacher Science schedule blocks |
| MATH | 44 | 12 | Per-teacher Math schedule blocks |
| ENGLISH | 44 | 16 | Per-teacher English schedule blocks |
| FIL | 44 | 12 | Per-teacher Filipino schedule blocks |
| AP | 44 | 14 | Per-teacher AP schedule blocks |
| ESPGMRC | 66 | 12 | Per-teacher ESP/GMRC schedule blocks |
| MAPEH | 44 | 16 | Per-teacher MAPEH schedule blocks |
| TLE | 66 | 16 | Per-teacher TLE schedule blocks |

### SUMMARY Sheet Row Patterns

- **Row 2**: Time labels (`6:00-6:45`, `6:45-7:30`, etc.)
- **Row 3**: Section names (column headers)
- **Row 4**: Adviser surnames
- **Data rows**: Paired groups of 2 rows per period
  - Odd row = Teacher surname
  - Even row = Subject name
  - Blank row between period pairs
- **Special rows**: `RECESS` (row 17), `LUNCH BREAK` (row 31)
- **Afternoon rows**: Specialization subjects (RESEARCH II, BIOTECH, SPA/SPS SPECIALIZATION)

### Per-Subject Sheet Row Patterns

- **Block header**: Teacher surname in C2
- **Time rows**: Time string in C2, Subject in C3/C7/C11/C15, Section in C4/C8/C12/C16
- **Trailing metadata**: ADVISORY CLASS, ANCILLARY TASK, TOTAL rows
- **Placeholder names**: "FIL X", "AP X", "ESP X", "MAPEH X"

### Time Slot Patterns

| Slot | Duration | Type |
|------|----------|------|
| 6:00-6:45 | 45 min | Regular |
| 6:45-7:30 | 45 min | Regular |
| 7:30-8:15 | 45 min | Regular |
| 8:15-9:00 | 45 min | Regular |
| 9:00-9:15 | 15 min | RECESS |
| 9:15-10:00 | 45 min | Regular |
| 10:00-10:45 | 45 min | Regular |
| 10:45-11:30 | 45 min | Regular |
| 11:30-12:15 | 45 min | Regular |
| 12:15-1:00 | 45 min | LUNCH BREAK |
| 1:00-1:45 | 45 min | Afternoon |
| 1:45-2:30 | 45 min | Afternoon |

## 2. aral-prog_G7_Class-Program_SY2026-2027docx.docx

### Document Structure

- 4 tables, each 21 rows x 9 columns
- Title: `GRADE 7 CLASS PROGRAM, SY 2026-2027`
- Legend: Subjects on top row, Subject Teacher on bottom row

### Table Row Patterns

| Row | Content |
|-----|---------|
| 0 | SECTION header |
| 1 | ADVISER row |
| 2 | BLDG/ROOM NO. row |
| 3-10 | Paired teacher/subject rows (4 periods) |
| 11 | HEALTH BREAK |
| 12-19 | Paired teacher/subject rows (4 periods) |
| 20 | LUNCH BREAK |

### Key Differences from SUMMARY

- Uses `HEALTH BREAK` instead of `RECESS`
- Section name merges across 2 columns (teacher + subject)
- Includes BLDG/ROOM NO. band
- Signatory/footer block after tables

### Section Counts

| Table | Sections |
|-------|----------|
| Table 0 | 6 active + 1 empty |
| Table 1 | 7 active |
| Table 2 | 7 active |
| Table 3 | 4 active + 3 empty |
| **Total** | **24 sections** |

## 3. 40-minutes.xlsx

### Sheet Inventory

| Sheet | Rows | Cols | Purpose |
|-------|------|------|---------|
| Sheet1 | 56 | 37 | Multi-block class-program with DepEd headers |
| Sheet2 | 33 | 14 | Cleaner class-program subset (12 sections) |
| Sheet3 | 78 | 59 | Large multi-block layout (18+ sections) |

### Mixed-Duration Time Slots

| Slot | Duration | Notes |
|------|----------|-------|
| 10:00-10:40 | 40 min | Short period |
| 10:00-10:45 | 45 min | Standard |
| 10:20-11:20 | 60 min | Long block |
| 11:20-12:15 | 55 min | LUNCH BREAK (different start) |
| 3:15-3:30 | 15 min | HEALTH BREAK |
| 3:30-3:45 | 15 min | Short period |

### Key Observations

- Different periods within the same school can have different durations
- Horizontal blocks with 3 schedule groups across the width
- Uses `TEACHER X` as placeholder for unfilled positions
- Rotation/swapping indicators in afternoon slots

## 4. ATLAS Field Mapping

### Fields ATLAS Already Provides

| Reference Field | ATLAS Source |
|----------------|-------------|
| Section name | `SectionMirror.name` |
| Grade level | `SectionMirror.gradeLevelName` |
| Adviser name | `FacultyMirror` where `isClassAdviser=true` |
| Subject name/code | `Subject.code` or `Subject.name` |
| Teacher surname | `FacultyMirror.lastName` |
| Day of week | `ScheduledEntry.day` |
| Start/end time | `ScheduledEntry.startTime/endTime` |
| Room | `Room.name` + `Building.name` |
| Program type | `SectionMirror.programType` |
| Placeholder | `FacultyMirror.isPlaceholder` |

### Fields Missing or Needing Normalization

| Reference Field | Status | Action Needed |
|----------------|--------|---------------|
| School header (DepEd hierarchy) | MISSING | Configurable report metadata |
| Break label (RECESS vs HEALTH BREAK) | MISSING | Configurable per school |
| Lunch break label | MISSING | Configurable per school |
| Signatory names/titles | MISSING | Report metadata |
| Room display format ("BLDG 3 / ROOM 301") | PARTIAL | String assembly |
| Ancillary task label | MISSING | Not stored in ATLAS |
| Horizontal page break position | MISSING | Report-rendering logic |
| Time format (12h vs 24h) | DERIVABLE | Format consistently |
| Teacher name format (surname-only) | DERIVABLE | Configurable formatter |
