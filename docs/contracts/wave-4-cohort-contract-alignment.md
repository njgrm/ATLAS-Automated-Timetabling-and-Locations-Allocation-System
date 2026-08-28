# Wave 4 Cohort Contract Alignment

> Historical note: this document is no longer authoritative for TLE generation after the `2026-05-21` MATATAG update. Use `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md` for the current direction. TLE split/cohort logic is now considered stale unless a newer stakeholder instruction overrides that reset.

## Scope

This note captures the verified EnrollPro payload shapes used by Wave 4 cohort-aware generation and the normalization rules applied inside ATLAS before data reaches generation or review UX.

## Verified Upstream Shapes

### Sections

Verified live contract path:

- `GET /api/sections/:ayId`

Relevant payload shape consumed by ATLAS:

```json
{
  "gradeLevels": [
    {
      "gradeLevelId": 7,
      "gradeLevelName": "Grade 7",
      "displayOrder": 7,
      "sections": [
        {
          "id": 701,
          "name": "7-Einstein",
          "maxCapacity": 45,
          "enrolledCount": 42,
          "programType": "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          "advisingTeacher": {
            "id": 9001,
            "name": "Ada Lovelace"
          }
        }
      ]
    }
  ]
}
```

Normalization applied in ATLAS:

- `programType` is mapped to ATLAS program metadata (`REGULAR`, `STE`, `SPA`, `SPS`, `SPJ`, `SPFL`, `SPTVE`, `OTHER`)
- `advisingTeacher.id` maps to `adviserId`
- `advisingTeacher.name` maps to `adviserName`
- unknown upstream program values are normalized to `OTHER` and surfaced through `contractWarnings`

### SCP Config

Verified live contract path:

- `GET /api/curriculum/:ayId/scp-config`

Relevant payload shape observed by ATLAS:

```json
{
  "scpProgramConfigs": [
    {
      "id": 1,
      "scpType": "SPECIAL_CURRICULAR_PROGRAMS",
      "isOffered": true
    }
  ]
}
```

Key alignment note:

- the live EnrollPro contract does not currently expose a top-level `cohorts` array
- legacy ATLAS assumptions that `body.cohorts` exists are invalid

## ATLAS Fallback Rules

When EnrollPro returns explicit `cohorts`, ATLAS persists them as-is after validation.

When EnrollPro returns only `scpProgramConfigs`, ATLAS:

- emits a `contractWarnings` entry explaining that explicit cohorts were not supplied
- derives fallback TLE cohorts from the current section roster for the active grade level
- marks the cohort source as `derived-sections`

When the live payload has no usable cohort data and no section roster is available, ATLAS:

- preserves existing local cohorts instead of deleting them
- returns a warning indicating that existing cohorts were preserved

## Generation Behavior

Wave 4 generation consumes stored `InstructionalCohort` rows together with `Subject.interSectionEnabled` and `Subject.interSectionGradeLevels`.

For matching inter-section subjects:

- demand is created once per cohort rather than once per section
- room-capacity validation uses `cohortExpectedEnrollment`
- section occupancy is applied to every member section in the cohort
- draft entries and unassigned items carry cohort/program/adviser metadata into the review console

For non-cohort subjects or grades without cohorts:

- existing per-section generation behavior remains unchanged
