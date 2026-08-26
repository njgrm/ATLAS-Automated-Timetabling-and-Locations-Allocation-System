# Phase 3 Load, Mapping, and Upstream Section Audit

Date: 2026-05-18
Primary context: Phase 3 generator readiness

## Purpose
Capture the live findings from:
- teaching-load data and formula behavior
- specialization mapping state
- upstream EnrollPro section mix

This audit exists to explain why the current KPI gate is still `NO-GO` and to define the next repair prompt slices.

## Executive Summary
- EnrollPro now has live `SPA` and `SPS` sections on Tailnet.
- ATLAS has not yet reflected those sections into the persisted `SectionMirror` program mix for the active school year.
- The teaching-load summary page is still not fully policy-accurate:
  - it uses section-based load minutes
  - it adds adviser equivalent hours
  - it does not include ancillary minutes in the summary load percentage
- The specialization-mapping page is mostly healthy at the live UI layer, but the underlying alias table still contains orphan mappings to inactive legacy subjects.
- Teacher X works today as a repair shim, but it currently lives in the wrong source-of-truth boundary because it is stored in `FacultyMirror`.

## Confirmed Live Findings

### 1. EnrollPro now has SPA and SPS sections live
Verified against the live EnrollPro integration feed on `https://dev-jegs.buru-degree.ts.net`.

Observed upstream section mix for `schoolId=16`, `schoolYearId=55`:
- `REGULAR: 58`
- `SCIENCE_TECHNOLOGY_AND_ENGINEERING: 8`
- `SPECIAL_PROGRAM_IN_THE_ARTS: 8`
- `SPECIAL_PROGRAM_IN_SPORTS: 8`

Observed sample live upstream sections:
- `SPA A`
- `SPA B`
- `SPS A`
- `SPS B`

Implication:
- The dev is correct that SPA and SPS sections now exist upstream.
- ATLAS is still stale or incomplete because the persisted `SectionMirror` program mix currently shows only:
  - `REGULAR: 58`
  - `STE: 8`

### 2. Section normalization is probably not the root cause
`section-adapter.ts` already contains long-form normalization entries for:
- `SPECIAL_PROGRAM_IN_THE_ARTS`
- `SPECIAL_PROGRAM_IN_SPORTS`
- short-code aliases `SPA`, `SPS`

Implication:
- the next repair should not assume the normalization table is missing
- it should verify live sync execution, mirror persistence, and downstream consumers of the mirrored program fields

### 3. Teaching-load page is not fully aligned to policy math
Current live API summary:
- faculty rows: `152`
- placeholders visible in summary: `10`
- overloaded by `loadPercentage > 100`: `54`
- no assignments: `2`

Current summary implementation in `atlas-server/src/services/faculty-assignment.service.ts`:
- uses `computeTeachingLoadMinutes(assignments, 'section')`
- converts to hours
- adds `advisoryEquivalentHours`
- does not add `ancillaryMinutesPerWeek`

Implication:
- the load summary page is still using a narrower formula than the available faculty policy data model
- it is not a fully policy-truthful workload view yet

### 4. Placeholder exploratory TLE load looks structurally inflated
Direct DB probe shows the four exploratory TLE placeholder teachers each own:
- `subjectMinutesByGrade = 480`
- `subjectMinutesBySection = 7920`

Implication:
- section-based load is exploding for placeholders because one placeholder assignment spans many sections
- even if this is acceptable for coverage repair, it makes the teaching-load page a poor operator signal unless placeholder loads are explained or separated

### 5. Specialization mapping UI is mostly healthy, but underlying alias data is dirty
Live specialization catalog:
- departments: `9`
- specialization items: `37`
- unmapped items: `2`
- unmapped live items:
  - `CERTIFIED SPECIALIST COACH`
  - `SPORTS SCIENCE`

Direct DB alias-state probe:
- total alias rows: `98`
- alias rows pointing to active subjects: `74`
- orphan alias rows pointing to inactive subjects: `24`

Examples of orphan alias canonical targets:
- `SCI`
- `SCI_PHYS`
- `ADVANCED_CHEMISTRY`
- `ADVANCED_PHYSICS`
- `ENV_SCI`
- `SPA_SPEC`

Implication:
- the page may look mostly mapped, but the persistence layer still has legacy debt
- mapping cleanup must retire or rewrite aliases tied to inactive legacy subject contracts

### 6. Several active subjects still have no explicit `allowedSpecializations`
Active subjects with empty `allowedSpecializations` include:
- `AP`
- `ENG`
- `ESP`
- `FIL`
- `HG`
- `MAPEH`
- `MATH`
- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `STE_APPLIED_CHEM`
- `STE_APPLIED_PHYS`
- `STE_BIOTECH`
- `STE_ENV_SCI`
- `STE_RESEARCH`
- `STE_ROBOTICS`
- `TLE`

Implication:
- this is not automatically wrong for core/general subjects
- but it means specialization mapping and qualification logic are still mixed between explicit scope and fallback/alias behavior

## What These Findings Mean For Phase 3

### The next repair order should change
The previous Phase 3 sequence assumed placeholder coverage could be repaired before upstream special-program demand was reflected locally.

That is no longer safe.

The updated order should be:
1. sync and persist the new SPA/SPS section demand into ATLAS
2. add an explicit special-program subject sync/refresh path tied to upstream offerings and mirrored demand
3. clean up program normalization / mirror parity if needed
4. make teaching-load math policy-truthful enough for operator decisions
5. clean specialization alias debt and live unmapped specializations
6. rerun subject coverage and KPI gates against the new real demand mix

### The KPI gate is currently under-reading special-program demand
Because ATLAS still mirrors only `REGULAR` and `STE`, the current KPI reruns are not yet solving the full live school-year dataset that EnrollPro now exposes.

### The teaching-load page should not be treated as phase-closure evidence yet
It is useful for operator triage, but its summary formula still:
- ignores ancillary minutes
- uses section-based load aggregation
- overstates placeholder exploratory TLE load in a way that needs special handling or explanation

## Recommended Prompt Slices

### Prompt 1: Upstream section sync and program parity
Repair goal:
- ensure ATLAS mirrors live SPA/SPS sections from EnrollPro for `schoolYearId=55`
- verify persisted `SectionMirror.programType/programCode/programName/isSpecialProgram`
- rerun direct DB proof and Tailnet API proof

### Prompt 2: Teaching-load formula and placeholder presentation
Repair goal:
- align teaching-load summary to the intended policy contract
- decide and implement the canonical operator formula
- account for ancillary minutes
- explicitly handle placeholder loads so exploratory coverage does not distort operator decisions

### Prompt 2a: Special-program subject sync
Repair goal:
- make upstream special-program offerings explicitly refreshable into ATLAS subject state
- keep EnrollPro as the owner of what programs are actually active
- keep ATLAS as the owner of schedulable subject semantics
- avoid relying on static special-program seed assumptions alone

### Prompt 3: Specialization mapping cleanup
Repair goal:
- remove or migrate alias rows tied to inactive legacy subject codes
- verify live unmapped specialization items
- align SPA/SPS/STE specialization mapping with the current active subject contract

## Gate Recommendation
- Do not treat the current Phase 3 KPI gate as final until ATLAS has ingested the live SPA/SPS section demand from EnrollPro.
- Do not use the current teaching-load page as a closure-grade policy signal yet.
