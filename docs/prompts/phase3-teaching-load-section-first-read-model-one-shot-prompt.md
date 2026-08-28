# Copilot Execution Prompt: Phase 3 Teaching Load Section-First Read Model One-Shot

## Objective

Add dedicated section-first live teaching-load read endpoints without regressing the now-correct active staffing truth.

This pass exists because the live system is no longer mainly blocked by stale ownership drift.
That backend truth repair is already live.

What is still missing is a stable section-first API contract for:

- sister-system integrations
- the upcoming `Sections` page assigned-classes breakdown
- any consumer that needs "assigned classes per section" instead of "assigned classes per faculty"

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `api/ATLAS-LIVE-TEACHING-LOAD-INTEGRATION.md`
- `api/ATLAS-SECTION-FIRST-TEACHING-LOAD-ENDPOINTS.md`

Inspect directly:

- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- any teaching-load ownership helpers used by summary, coverage, and staffing

## Live Facts To Treat As Settled

These are already verified against Tailnet and the live DB:

- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `assignedPairs = 840`
  - `rawAssignedPairs = 840`
  - `unassignedPairs = 122`
  - `rawUnassignedPairs = 122`
- stale ownership diagnostics are now clean:
  - `staleOwnershipRowCount = 0`
  - `staleOwnedCurrentYearPairCount = 0`
- `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
  - `SCI_ES = 82 / 82 uncovered`
  - `SCI_CHEM = 35 / 82 uncovered`
  - `TLE_FCS_EXP = 5 / 58 uncovered`
  - `ENG = 0 / 82 uncovered`
  - `FIL = 0 / 82 uncovered`
- `POST /api/v1/faculty-assignments/report/staffing-needs`
  - `unassignedSections = 122`
  - `missingMinutesPerWeek = 27450`
  - `missingHoursPerWeek = 457.5`
  - `concurrentUnassignedSections = 87`
  - `concurrentMissingHoursPerWeek = 326.3`
  - `rotationAdjustedMinutesPerWeek = 7875`
- the remaining uncovered load is real current-year shortage, not stale saved ownership debt

## Scope

### In Scope

#### A. Implement dedicated section-first live teaching-load read endpoints

Add:

- `GET /api/v1/sections/:sectionId/assigned-classes?schoolYearId=<id>`
- `GET /api/v1/sections/assigned-classes?schoolId=<id>&schoolYearId=<id>`

These endpoints shall expose live teaching-load ownership by section, not by faculty.

#### B. Keep section-first truth aligned to current live ownership rules

Required:

- only active school-year section universe
- only active subject contract
- only active non-stale faculty ownership in normal assigned output
- no synthetic placeholder ownership in normal assigned output
- no stale ownership in normal assigned output

The new section-first payload shall agree with:

- `/faculty-assignments/summary`
- `/faculty-assignments/coverage/summary`
- `/faculty-assignments/report/staffing-needs`

#### C. Expose section-facing assignment identity completely

Each section-class row must include at minimum:

- `subjectId`
- `subjectCode`
- `subjectName`
- `subjectDisplayLabel` if the current live model already derives one
- `minMinutesPerWeek`
- `rotationFamily`
- `facultyId`
- `facultyName`
- `facultyDepartment`
- `facultySpecialization`
- `assignmentKind`
- `specializationCode`
- `specializationLabel`

This is required so downstream section views can show:

- what class the section has
- who teaches it
- whether a special-program umbrella subject has a more precise taught identity

#### D. Support optional diagnostics for section-first consumers

Where `includeDiagnostics=true` is provided, the section-first endpoint may also expose:

- `staleOwnership`
- `unassignedExpectedClasses`

But those diagnostic rows must not be mixed into the normal assigned class list.

#### E. Preserve current correct teaching-load math behavior

Required:

- do not regress active-vs-raw staffing truth
- do not regress rotation-family teacher load math
- do not regress staffing-needs raw-vs-concurrent split
- do not regress assignment-level specialization identity for `SPA_SPEC` and `SPS_SPEC`
- do not regress `STE_ROBOTICS` multi-owner baseline behavior

### Out Of Scope

Do not:

- redesign the `Teaching Load` page UI in this pass
- change subject ownership qualification rules
- reopen stale-ownership reconciliation logic unless a section-first query reveals a real defect
- add timetable day/time/room slots to these endpoints
- replace teacher-specific endpoints

## Implementation Direction

### 1. Build from the same ownership truth as current live coverage

Do not derive section-first output from a lossy shortcut.

The section-first endpoints must use the same active current-year ownership boundary as:

- summary
- coverage
- staffing-needs

### 2. Section-first output must not require downstream inversion

Consumers should not have to:

- iterate all teachers
- explode `faculty[].assignments[]`
- regroup by section

ATLAS should now do that server-side.

### 3. Preserve per-term family identity without overstating schedule detail

The payload should expose:

- `rotationFamily`
- subject-level duration
- section-level assignment identity

But it should not claim timetable slot detail.

This remains live teaching-load ownership, not published scheduled meetings.

### 4. Keep diagnostics optional and clearly separated

Normal consumers should get:

- currently assigned classes for the section

Diagnostic consumers may additionally ask for:

- stale ownership detail
- expected-but-unassigned rows

These must not pollute the normal class list.

## Required Live Tailnet Verification

You must test on:

- `https://njgrm.buru-degree.ts.net`

Do not stop at local builds.
Do not return `GO` without post-change live proof.

Required checks:

1. `GET /api/v1/sections/:sectionId/assigned-classes?schoolYearId=55`
   - verify one real section returns live assigned classes with teacher identity
   - verify no stale or synthetic rows appear in the normal class list

2. `GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55`
   - verify school-wide section-first index returns section rows directly
   - verify consumers no longer need faculty inversion

3. parity check against current coverage truth
   - prove `SCI_ES` still appears as uncovered in diagnostics or section-level expected gaps where relevant
   - prove `SCI_CHEM` and `TLE_FCS_EXP` reflect the current uncovered state
   - prove `ENG` and `FIL` no longer appear as uncovered

4. specialization identity check
   - verify `SPA_SPEC` / `SPS_SPEC` section rows still expose assignment-level specialization identity when present

5. rotation-family metadata check
   - verify `SCIENCE` and `TLE_ROTATION` members expose `rotationFamily`
   - verify the endpoint remains ownership-only, not timetable-slot flavored

If any required live test is missing, return `NO-GO`.

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- any targeted test coverage you add for section-first read-model logic
- post-change live Tailnet probes
- verify no regression to current staffing-truth metrics

## Required Output

Return:

1. files changed
2. new section-first endpoint contracts
3. payload shape and diagnostic rules
4. parity notes against summary, coverage, and staffing
5. live Tailnet proof
6. remaining blockers
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- section-first live teaching-load endpoints are implemented
- section payloads expose assigned classes with teacher identity directly
- section-first truth agrees with current summary, coverage, and staffing contracts
- stale or synthetic ownership is not presented as normal assigned section classes
- assignment-level specialization identity remains intact
- required live Tailnet verification was completed
