# EnrollPro <> ATLAS Integration Contract Notes

## Purpose
Capture cross-service source-of-truth boundaries and required payload fields.

## Ownership Split
- EnrollPro: personnel/designation source of truth (faculty profile and role designations)
- ATLAS: scheduling policy interpretation, generation logic, timetable lifecycle enforcement

## Required For Load Semantics
ATLAS consumes designation metadata per faculty and school year to compute:
- actual teaching hours
- credited equivalent hours
- overload hours

Suggested fields:
- `isClassAdviser`
- `advisoryEquivalentHoursPerWeek`
- `isTIC`
- `isTeachingExempt`
- `customTargetTeachingHoursPerWeek`
- `designationNotes`

## Change Management
- Keep schema additions backward-compatible
- Version externally visible contract changes
- Log major contract decisions in `docs/decisions/adr-log.md`
