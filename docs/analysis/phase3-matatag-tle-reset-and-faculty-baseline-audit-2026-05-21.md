# Phase 3 MATATAG TLE Reset And Faculty Baseline Audit

Date: 2026-05-21

## Purpose

Capture the newly confirmed MATATAG TLE contract change and compare the current upstream/live faculty baseline against the stakeholder's official department counts.

This audit exists to reset ATLAS planning before the next generation-repair prompts.

## Confirmed Contract Change

The old ATLAS assumption that Grade 9 and 10 TLE still require split specialization cohorts is no longer valid.

Confirmed inputs:
- stakeholder instruction: Grade 9 and 10 TLE now follow the same rotating specialization model as the lower grades
- EnrollPro has already removed the old TLE split metadata from its active section feed

Implication:
- TLE should now be modeled as a per-section modular rotation contract
- TLE should no longer depend on section-level specialization splits, cohortized demand, or `tleProgramId`-driven section identity
- generation should treat TLE more like the current modular science rotation pattern than a cross-section cohort problem

## Live EnrollPro Verification

### Sections feed

Verified on `2026-05-21`:
- `GET https://dev-jegs.buru-degree.ts.net/api/integration/v1/sections?schoolYearId=55&limit=200`

Observed:
- total sections: `82`
- program mix:
  - `REGULAR = 58`
  - `SCIENCE_TECHNOLOGY_AND_ENGINEERING = 8`
  - `SPECIAL_PROGRAM_IN_THE_ARTS = 8`
  - `SPECIAL_PROGRAM_IN_SPORTS = 8`
- `tleProgramId` present on active section rows: `0`
- `tleSpecialization` present on active section rows: `0`

Conclusion:
- EnrollPro no longer exposes TLE-specialization section splits for the active school year
- the upstream section contract is now aligned to plain section roster only

### Faculty feed

Verified on `2026-05-21`:
- `GET https://dev-jegs.buru-degree.ts.net/api/integration/v1/faculty?schoolYearId=55&limit=200`

Active upstream faculty by department:
- `SCI = 18`
- `MATH = 25`
- `ENG = 33`
- `TLE = 13`
- `FIL = 14`
- `ESP = 11`
- `MAPEH = 14`
- `AP = 14`

Total active faculty in feed: `142`

## Stakeholder Department Counts Versus EnrollPro

Stakeholder-provided official counts:
- Science `19`
- Math `22`
- Eng `22`
- TLE `22`
- Fil `16`
- ESP `11`
- MAPEH `21`
- Aral Pan `13`

Comparison against active EnrollPro feed:

| Department | Stakeholder | EnrollPro Active | Delta |
|---|---:|---:|---:|
| SCI | 19 | 18 | -1 |
| MATH | 22 | 25 | +3 |
| ENG | 22 | 33 | +11 |
| TLE | 22 | 13 | -9 |
| FIL | 16 | 14 | -2 |
| ESP | 11 | 11 | 0 |
| MAPEH | 21 | 14 | -7 |
| AP | 13 | 14 | +1 |

Conclusion:
- EnrollPro does **not** match the new stakeholder department counts cleanly
- the largest upstream mismatches are:
  - `ENG +11`
  - `TLE -9`
  - `MAPEH -7`
- this must be treated as a real baseline-parity issue before ATLAS trusts department-driven coverage assumptions

## Current ATLAS Live State

Direct DB verification on `2026-05-21`:
- active schedulable faculty mirrors: `145`
- active placeholder faculty: `0`
- active subjects: `28` of `42`
- active section mirrors for `(schoolId=1, schoolYearId=55)`: `82`
- active grade/program windows: `16`
- persisted scheduling policy rows for `(1,55)`: `1`
- active instructional cohorts: `4`
- shared-facility rooms: `25`

### ATLAS section mirror parity

ATLAS mirror now matches the upstream section count:
- total mirrored sections: `82`
- no mirrored rows with:
  - `tleProgramId`
  - `tleSpecialization`
  - `tleProgramCategory`

Mirrored program mix:
- Grade 7: `16 REGULAR`, `2 STE`, `2 SPA`, `2 SPS`
- Grade 8: `17 REGULAR`, `2 STE`, `2 SPA`, `2 SPS`
- Grade 9: `12 REGULAR`, `2 STE`, `2 SPA`, `2 SPS`
- Grade 10: `13 REGULAR`, `2 STE`, `2 SPA`, `2 SPS`

Conclusion:
- the earlier pseudo-section inflation problem is no longer present in the live mirror
- ATLAS section sync has already converged to the new upstream roster shape

## Current Generator Drift Caused By The Stale TLE Model

Latest live run checked:
- `GET https://njgrm.buru-degree.ts.net/api/v1/generation/1/55/runs/latest`
- latest completed run: `63`

Key signals:
- `cohortCount = 4`
- contract warning still says:
  - `EnrollPro did not return explicit cohorts; deriving TLE cohorts from section ownership fields.`
- `termCounts = { term1: 2185, term2: 39, term3: 47 }`
- `assignedCount = 2271`
- `unassignedCount = 1205`
- `hardViolationCount = 1077`
- `policyBlockedCount = 1357`
- `LACKING_FACULTY = 68`
- `SPECIALIZED_ROOM_UNAVAILABLE = 128`
- `FACULTY_EXCESSIVE_IDLE_GAP = 347`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE = 835`

Most important stale signal:
- run `63` still emits TLE modular warnings and cohort warnings as if TLE were missing cross-section cohort inputs

That means the generator is still solving a TLE problem that no longer exists in the upstream contract.

## Steering Implications

### 1. TLE cohort logic should be retired

ATLAS should stop treating TLE as:
- cohortized
- section-split
- specialization-section-based

ATLAS should start treating TLE as:
- section-scoped
- modular/rotational
- term-aware across Grades 7-10

### 2. The old cohort-specific prompt chain is now stale

Any prompt that still optimizes:
- cohort fallback
- cohort slot resolution
- TLE split readiness

is now solving the wrong problem.

### 3. Faculty qualification should lean more on department baseline

Given the stakeholder workflow and the new TLE contract:
- subject qualification should default more strongly from department ownership
- department-head pre-decisions should remain manually lockable by the scheduler
- generation must respect those manual placements

### 4. Faculty totals still need parity validation

The stakeholder department totals and EnrollPro active faculty totals do not currently match.

Before treating faculty shortage as purely an ATLAS problem, the school should confirm:
- whether the stakeholder counts refer to all plantilla teachers, active teaching teachers, or active scheduling-year teachers
- whether EnrollPro is missing some teacher records or using different active-status filters

## Recommended Next Prompt Direction

The next prompt chain should be repointed to:

1. reset TLE generation from cohort/split logic to MATATAG term rotation
2. align qualification and autofill assumptions around department ownership plus manual locked placements
3. rerun generation only after the TLE contract reset lands

Do **not** keep spending requests on cohort-fallback tuning against the old contract.
