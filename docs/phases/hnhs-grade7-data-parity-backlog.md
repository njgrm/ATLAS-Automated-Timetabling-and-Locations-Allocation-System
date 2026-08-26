# HNHS Grade 7 Data Parity Backlog (Deferred)

## Purpose
Capture the Grade 7 spreadsheet data points used by HNHS that are not yet fully modeled in ATLAS, so they can be implemented after current priorities:
- manual drag/drop scheduling before generation
- faculty-side room preference flow

## Status
- Deferred (do not block current Wave 4.2 closure)
- Revisit after faculty room preference workflow is production-ready

## Source References
- `assets/*image-3957a063*.png` (grade-level summary matrix)
- `assets/*image-a7be88bf*.png` (time + remarks template)
- `assets/*image-ac2cba4e*.png` (subjects/activity list)
- `assets/*image-4fd4d5ee*.png` (teacher, advisory class, ancillary tasks)
- `assets/*image-6114bac2*.png` (teacher schedule by section)
- `assets/*image-43c4de4a*.png` (section schedule by teacher)

## Deferred Gaps To Implement

1. Activity blocks as first-class schedule entities
- Flag Ceremony
- Morning Recess
- Lunch Break
- Collaboration
- Remedial/HGP Friday-only blocks

2. Day-pattern semantics beyond basic split
- Explicit support for MON/TUE, WED/THU, FRI-only patterns
- Distinct handling for specialization windows

3. Ancillary task tracking per teacher
- Persist ancillary task assignments
- Surface in teacher load/schedule views and exports

4. School-format parity exports
- Teacher-centric schedule export (time, subject, section, advisory, total)
- Section-centric schedule export (time, subject/activity, teacher, adviser)

5. Section completeness validator for institutional blocks
- Validate required non-academic blocks are present in section schedules
- Report missing required blocks before publish

6. Subject catalog split by type
- Instructional subjects
- Institutional activities
- Intervention/remedial blocks

7. Advisory class presentation parity
- Adviser row and advisory class context in both teacher and section schedule views

## Non-Goals (for this deferred pack)
- No immediate changes to current Wave 4.2 room-preference acceptance gates
- No replacement of existing policy engine behavior during this backlog capture

## Entry Criteria (when work starts)
- Wave 4.2 room request workflow is QA-complete
- Manual drag/drop scheduling before generation is stable
- Cross-repo source gate remains green

## Exit Criteria
- All deferred gaps above are implemented with tests
- Exports match HNHS spreadsheet semantics for Grade 7 pilot
- No regression to current scheduling and room preference flows
