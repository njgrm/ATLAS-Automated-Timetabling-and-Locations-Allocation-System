# EnrollPro Rollover Contract: 2026-2027

Date: 2026-08-06  
Last live sanity check: 2026-08-07  
Target: `https://njgrm.buru-degree.ts.net`

## Ownership

- EnrollPro owns active school-year identity, section identity, faculty identity, and public school settings.
- ATLAS owns timetable runs, draft placements, Teaching Load, scheduling policies, published schedule artifacts, and rollover mirror evidence.
- ATLAS uses the EnrollPro school-year ID directly as the ATLAS scheduling `schoolYearId`.
- ATLAS does not write back to EnrollPro.

## Required EnrollPro feeds

| Feed | Documented source | Current ATLAS expectation |
|---|---|---|
| Active school year | `/api/integration/v1/school-year` | Returns the active numeric EnrollPro school-year ID and label. The ID must not be hard-coded by ATLAS clients. |
| Sections | `/api/integration/v1/sections` | Returns active sections for the current scheduling scope. Live counts may change as EnrollPro data changes. |
| Faculty | `/api/integration/v1/default/faculty` with `/api/integration/v1/faculty` fallback | Returns active faculty candidates. Live counts may change as EnrollPro data changes. |
| Public settings | `/api/settings/public` | Reachable and may provide active school-year/public branding context. |

## Optional probes

- Subject offerings are not documented as a required ATLAS integration feed in the current `ENROLLPRO-API.md` catalog.
- Missing subject-offerings probes must be treated as optional until EnrollPro publishes a replacement contract.

## Field-level expectations

### School year

- The system shall preserve EnrollPro `id` as the ATLAS `schoolYearId`.
- The system shall display the EnrollPro year label to officers when available.
- The system shall expose drift states as `aligned`, `atlas-stale`, `enrollpro-unreachable`, or `mapping-conflict`.

### Sections

- The system shall treat EnrollPro section IDs as `SectionMirror.externalId`.
- The system shall retain section name, grade-level label, program code/type, capacity, and enrollment count when supplied.
- If EnrollPro section data cannot be verified, then the system shall keep using saved ATLAS section mirrors and surface source uncertainty.

### Faculty

- The system shall treat EnrollPro teacher/personnel IDs as `FacultyMirror.externalId`.
- The system shall retain faculty display names, department/specialization, scheduling-active status, and advisory section linkage when supplied.
- If EnrollPro faculty data cannot be verified, then the system shall keep existing saved faculty mirrors and surface source uncertainty.

## Current verified 2026-2027 state

2026-08-07 live Tailnet sanity check:

- EnrollPro active year: `id=3`, label `2026-2027`.
- ATLAS selected/mirrored year before re-sync: `schoolYearId=1`.
- Runtime drift: `atlas-stale`.
- Recommended action: `RUN_ROLLOVER_SYNC`.
- EnrollPro sections reported through rollover status: `20`.
- EnrollPro faculty candidates reported through rollover status: `23`.
- Mirror state: not yet synced for active EnrollPro `schoolYearId=3`.

2026-08-06 previous reset proof:

- Runtime drift after dummy reset and sync: `aligned`.
- Mirrored current-year sections: `20`.
- Active faculty candidates: `24` at that time.
- Current-year generation runs: `0`.
- Scheduling policy baseline rows: `1`.
- Teaching Load rows: `0 FacultySubject`, `0 SubjectSectionOwnership`.
- Current-year generation guard: `409 TEACHING_LOAD_REVIEW_REQUIRED`.
- Stale-year generation guard: `409 ACTIVE_YEAR_DRIFT`.

## Setup-to-generation fixture proof

The setup-to-generation proof uses the Teaching Load automation path to write normalized `SubjectSectionOwnership` rows, triggers a controlled current-year generation run, verifies generated timetable entries, then deletes the generated run, run-scoped audit evidence, and Teaching Load fixture rows. The verified fixture created `257` normalized ownership rows and generated a completed run with `790` scheduled entries before cleanup restored `0` current-year runs, `0` Teaching Load rows, and the original current-year audit log count.

The controlled fixture is a technical compatibility proof, not a production-ready schedule: the generated run still reported `135` unassigned sessions caused by remaining staffing/room feasibility pressure. Officers must still review Teaching Load and setup readiness before accepting a production timetable.
