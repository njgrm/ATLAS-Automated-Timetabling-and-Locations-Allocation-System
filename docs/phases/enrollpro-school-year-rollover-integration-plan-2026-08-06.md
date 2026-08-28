# EnrollPro School-Year Rollover Integration Plan

Date: 2026-08-06  
Status: Planned  
Primary target: `https://njgrm.buru-degree.ts.net` with EnrollPro backend `http://100.120.169.123:5002/api`

## Summary

EnrollPro now has an explicit school-year rollover lifecycle and partner API. ATLAS must treat EnrollPro rollover as the boundary for creating schedules for a new school year. The current live state is mismatched: EnrollPro active year is `1 / 2026-2027`, while ATLAS runtime context still selects persisted `schoolYearId=39`.

This plan updates ATLAS from “use last persisted runtime evidence” to “detect EnrollPro rollover, mirror the new school-year context, then allow new-year setup and generation.”

## Iteration 0 — Lock the latest EnrollPro contract

- Keep the local EnrollPro checkout at `D:\EnrollPro`.
- Add read-only contract probes for:
  - `/api/integration/v1/school-year`
  - `/api/integration/v1/sections`
  - `/api/integration/v1/faculty`
  - `/api/integration/v1/default/faculty`
  - `/api/settings/public`
  - `/api/settings/scp-config`
- Assert required ATLAS fields:
  - school year: `data.id`, `data.yearLabel`
  - faculty: `teacherId`, `employeeId`, `firstName`, `lastName`, `isActive`
  - sections: `id`, `name`, `gradeLevel.id`, `gradeLevel.displayOrder`, `programType`, `maxCapacity`, `enrolledCount`
- Record unsupported endpoints explicitly, including `/api/integration/v1/subject-offerings`.

Gate:

- Read-only probes pass against Tailnet.
- Unsupported endpoints are not treated as hard dependencies.

## Iteration 1 — Active school-year mapping and drift detection

- Add a durable mapping between ATLAS school-year context and EnrollPro school-year identity if local IDs are not intended to be identical.
- Surface drift when:
  - EnrollPro active year differs from ATLAS runtime year;
  - ATLAS has schedule/generation evidence for an older year;
  - EnrollPro is reachable but not matched.
- Add scheduler-facing copy:
  - `EnrollPro is now on 2026-2027. Start new-year setup before generating schedules.`
  - `ATLAS is still showing saved schedules for the previous setup year.`
- Block new generation for mismatched active context unless an officer explicitly selects a historical year.

Gate:

- `/runtime/context?verifyUpstream=true` returns both ATLAS and EnrollPro identifiers.
- Timetable, Teaching Load, Sections, Teachers, and Dashboard show a clear active-year drift notice.
- New generation is blocked with a readable next step while drift exists.

## Iteration 2 — Rollover sync command

- Add an operator-triggered ATLAS sync action:
  - verify EnrollPro `/integration/v1/health`;
  - resolve `/integration/v1/school-year`;
  - fetch sections and faculty for the active EnrollPro year;
  - create or select the matching ATLAS school-year context;
  - snapshot faculty and sections;
  - mark prior-year runtime evidence historical.
- Preserve ATLAS-owned truth:
  - subjects stay ATLAS-owned;
  - rooms stay ATLAS-owned;
  - teaching loads stay ATLAS-owned but must be rebuilt/reviewed for the new year;
  - published schedules remain historical records.

Gate:

- Sync is idempotent.
- Sync records source endpoint, EnrollPro school-year ID, ATLAS school-year ID, row counts, and timestamp.
- Running sync twice does not duplicate sections or faculty mirrors.

## Iteration 3 — New-year setup readiness

- After rollover sync, guide the scheduler through:
  1. review sections;
  2. assign home rooms;
  3. review teachers;
  4. rebuild Teaching Load for the new school year;
  5. review policies;
  6. generate draft schedule.
- Do not auto-copy prior-year teaching loads without a review step.
- Provide an optional “copy last year as draft” action only if it is clearly marked as a starting point, not confirmed truth.

Gate:

- Dashboard next step points to the first missing new-year setup task.
- Teaching Load clearly states whether the new-year load is empty, copied draft, or saved canonical truth.
- Timetable generation remains disabled until required setup gates pass.

## Iteration 4 — Generation and timetable integration

- Make `/timetable` generation use the new active ATLAS school-year context that is mapped to the EnrollPro active year.
- Ensure generated runs include the EnrollPro source-year identifier in their input snapshot metadata.
- Ensure stale prior-year runs are visible only as historical review, not as the default “latest schedule” for a new school year.

Gate:

- New schedule creation cannot accidentally use prior-year sections/faculty.
- Latest-run resolver does not select previous-year completed runs when the active year is new.
- Timetable labels clearly distinguish `Current school year` from `Past school year`.

## Iteration 5 — Full verification

Required static gates:

```bash
npm run build --prefix atlas-server
npx tsc --noEmit --prefix atlas-client
npm run test:ux-guardrails --prefix atlas-client
npm run test:timetable-conflict --prefix atlas-client
npm run build --prefix atlas-client
```

Required Tailnet/browser gates:

- login with EnrollPro account `1234501`;
- open Dashboard and see active-year status;
- open Sections and verify EnrollPro section count/source;
- open Teachers and verify EnrollPro faculty count/source;
- open Teaching Load and verify new-year setup state;
- open Timetable and verify generation is blocked until setup is ready;
- after setup fixture, create a reversible draft generation for the new year;
- ensure previous-year schedules remain reviewable but are not default new-year truth.

Data safety:

- Live write tests must use reversible fixtures.
- No EnrollPro database writes from ATLAS.
- No direct EnrollPro database access.

## Acceptance criteria

- ATLAS authenticates the new EnrollPro admin credential without crashing.
- ATLAS can read EnrollPro active school year, faculty, sections, settings, and SCP config.
- ATLAS detects the current active-year mismatch.
- ATLAS blocks accidental new schedule generation against stale persisted year evidence.
- ATLAS provides a clear operator path to initialize the new school year after EnrollPro rollover.
- ATLAS preserves historical published/generated schedules for prior years.

## Current blockers

- ATLAS runtime context still selects `schoolYearId=39`; EnrollPro active year is `1 / 2026-2027`.
- ATLAS needs explicit active-year mapping or mirror creation before rollover scheduling can be safe.
- `/api/integration/v1/subject-offerings` is not available in the latest EnrollPro route catalog; ATLAS must keep this best-effort only or replace it with documented feeds.
