# EnrollPro <> ATLAS Integration Contract Notes

## Purpose
Capture cross-service source-of-truth boundaries and required payload fields.

## Ownership Split
- EnrollPro: personnel/designation source of truth (faculty profile and role designations)
- EnrollPro: section roster, special-program metadata, and cohort-specialization metadata used for ATLAS generation
- ATLAS: scheduling policy interpretation, generation logic, timetable lifecycle enforcement

## Canonical Verification Commands
- EnrollPro authoritative seed: `npm --prefix EnrollPro/server run db:seed-atlas-source`
- ATLAS live upstream mirror seed: `npm --prefix atlas-server run seed:enrollpro-source -- --schoolId=1 --schoolYearId=1 --reset`
- ATLAS source verification: `npm --prefix atlas-server run verify:enrollpro-source -- --schoolId=1 --schoolYearId=1`
- Cross-repo gate: `npm run verify:cross-repo-source-gate -- --schoolId=1 --schoolYearId=1`

## ATLAS-Facing Contract Shapes

### `GET /api/teachers/atlas/faculty-sync?schoolYearId=:id`
- Authoritative EnrollPro -> ATLAS faculty mirror feed.
- Response shape:

```json
{
	"teachers": [
		{
			"teacherId": 101,
			"firstName": "Maria",
			"lastName": "Santos",
			"email": "maria.santos@enrollpro.local",
			"contactNumber": "09171234567",
			"department": "Mathematics",
			"specialization": "Mathematics",
			"isActive": true,
			"advisoryEquivalentHoursPerWeek": 5,
			"isTeachingExempt": false,
			"advisedSectionId": 41,
			"advisedSectionName": "7-Einstein"
		}
	]
}
```

### `GET /api/sections/:ayId`
- Authoritative section roster for ATLAS section sync.
- Response shape:

```json
{
	"gradeLevels": [
		{
			"gradeLevelId": 7,
			"gradeLevelName": "Grade 7",
			"displayOrder": 7,
			"sections": [
				{
					"id": 41,
					"name": "7-Einstein",
					"programType": "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
					"programCode": "STE",
					"programName": "Science, Technology, and Engineering",
					"maxCapacity": 45,
					"enrolledCount": 42,
					"fillPercent": 93,
					"adviserId": 101,
					"adviserName": "Santos, Maria",
					"advisingTeacher": {
						"id": 101,
						"name": "Santos, Maria"
					}
				}
			]
		}
	]
}
```

### `GET /api/curriculum/:ayId/scp-config`
- Authoritative SCP + cohort contract for ATLAS cohort sync.
- Response shape:

```json
{
	"scpProgramConfigs": [
		{
			"id": 1,
			"scpType": "SPECIAL_CURRICULAR_PROGRAMS",
			"isOffered": true
		}
	],
	"cohorts": [
		{
			"cohortCode": "G7-TLE-IA",
			"specializationCode": "IA",
			"specializationName": "Industrial Arts",
			"gradeLevel": 7,
			"memberSectionIds": [41, 42, 43],
			"expectedEnrollment": 118,
			"preferredRoomType": "TLE_WORKSHOP"
		}
	]
}
```

## Stability Rules
- EnrollPro remains the single source of truth for teachers, sections, special programs, and cohort-specialization metadata.
- ATLAS may persist mirrors and cached upstream snapshots, but must reject `stub` or local fixture sources during production-like verification.
- If explicit `cohorts` are absent, the EnrollPro contract must still expose enough specialization data for ATLAS to derive cohort groupings deterministically.

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
