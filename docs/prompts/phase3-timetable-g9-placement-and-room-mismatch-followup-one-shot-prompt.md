# Copilot Execution Prompt: Phase 3 Timetable G9 Placement, Home-Room Fidelity, And Contract-Respect Follow-Up One-Shot

## Mission

Execute the next timetable placement and contract-respect follow-up pass.

This pass exists because the live Tailnet runtime for `runId=87` still shows multiple timetable failures after the earlier day-shape and homeroom-first passes:

1. regular Grade 9 sections still produce `0` generated entries even though all `12` regular Grade 9 sections already have valid `G9` home rooms and `G9` building-zone assignments
2. lower-grade regular sections are still spilling into `G10-*` rooms under `HOME_ROOM_UNAVAILABLE`, which breaks the intended section-stays-put homeroom contract
3. `ROOM_TYPE_MISMATCH` is still hard-blocking ordinary modular-pool/classroom rows instead of behaving like a non-blocking diagnostic for this phase
4. `HG` is still being generated and left unassigned even though the subject-page/operator contract for this stream is that `HG` should not be part of the generated timetable artifact
5. SPA specialization cohorts still surface `NO_QUALIFIED_FACULTY` even though Teaching Load closure was supposed to settle staffing truth before timetable generation

Your objectives:

1. identify and repair why regular Grade 9 sections with valid `G9` home rooms still receive `0` scheduled entries
2. restore section-stays-put homeroom fidelity so ordinary section schedules stop drifting into other grade buildings like `G10-*`
3. downgrade or suppress room-type mismatch enforcement for ordinary homeroom/classroom timetable output in this phase
4. stop `HG` from entering generated timetable demand if the current subject contract says it is not schedulable in the class-program artifact
5. reconcile SPA specialization qualification truth with Teaching Load saved truth so timetable generation stops inventing `NO_QUALIFIED_FACULTY` contradictions
6. make `/timetable` respect the authoritative data already established on `/subjects`, `/sections`, `/sections/home-rooms`, and Teaching Load instead of diverging from those pages

---

## Scope

### In Scope

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/routes/section.router.ts` only if required by placement verification
- timetable review/runtime surfaces that present `ROOM_TYPE_MISMATCH`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/hooks/useTimetableData.ts`
- targeted tests for G9 room placement, homeroom fidelity, HG exclusion, SPA qualification truth, and deferred room-mismatch behavior
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad schoolwide day-shape/block-length refactor
- final umbrella term-aware master-schedule output
- unrelated timetable UI redesign
- facility-booking implementation

---

## Current Verified Problems

Treat these as already verified from live Tailnet `runId=87` and page/API checks:

- `/sections/home-rooms/55?schoolId=1` and `/sections/summary/55?schoolId=1` already show all `12` regular Grade 9 sections with valid `homeRoomId` values (`85..96`) and `buildingZoneId='G9'`
- `runId=87` still places `0` entries in `G9`
- the same `12` regular Grade 9 sections currently produce `504` unassigned rows, all `NO_AVAILABLE_SLOT`
- `G9` rooms (`G9-205` through `G9-308`) are present in the canonical room inventory and currently receive `0` entries in `runId=87`
- lower-grade regular sections are still placed into `G10-*` rooms under `HOME_ROOM_UNAVAILABLE`
- concrete example: section `MAKATAO` (`Grade 8`, `homeRoomId=57`, `buildingZoneId='G8'`) currently runs ordinary classes in `G10-203`
- run `87` still has `457` cross-grade placements into `G10-*` rooms for non-Grade-10 sections
- run `87` still has `ROOM_TYPE_MISMATCH=350` as `HARD`, with live examples showing `roomAssignmentReason='MODULAR_POOL_ASSIGNED'` and `deferredRoomTypePreference=false`
- run `87` still contains `HG` timetable demand: `116` assigned HG entries and `48` unassigned HG items
- run `87` still contains SPA specialization unassigned rows with `reason='NO_QUALIFIED_FACULTY'`
- `FACULTY_SUBJECT_NOT_QUALIFIED=0` at run-summary level does not mean specialization/cohort qualification contradictions are solved; SPA cohort demand still proves residual split-brain
- the timetable page is currently not honoring source-of-truth decisions already established elsewhere:
  - `/sections` and `/sections/home-rooms` establish home-room/building truth
  - `/subjects` establishes whether a subject should be active/schedulable in this timetable artifact
  - Teaching Load establishes staffing authority for approved section/specialization ownership

---

## Required Product Decisions

Follow these decisions exactly:

### 1. Grade 9 is no longer a map-data problem

Do not spend this pass re-proving that `G9` rooms exist.

The verified problem is that the generator is not using already-valid `G9` section placement truth.

This pass must identify why valid `G9` homerooms/building assignments still collapse into `NO_AVAILABLE_SLOT` with `0` generated entries.

### 2. Section homeroom fidelity is the artifact contract for ordinary classes

For this stakeholder class-program replication phase, ordinary section classes should keep the section in its home room / home building footprint.

Teacher movement is preferred over section movement for ordinary timetable output.

If the generator is moving Grade 7 or Grade 8 regular sections into `G10-*` rooms, treat that as a fidelity bug unless there is a verified hard constraint that truly forces it.

### 3. Deferred room mismatch is not a primary blocker for this phase

If a room-type mismatch exists only because an ordinary section class was kept in a classroom/home-room context, do not keep that as a hard blocker.

This pass must explicitly distinguish:

- real room conflicts
- real shared-facility conflicts
- non-blocking room-type preference drift for ordinary classroom output

### 4. `HG` must respect the subject-page contract

If `HG` was already decided to be out of scope for this generated timetable artifact, then it must stop contributing assigned rows and unassigned debt in generation.

Do not leave the system in a split state where `/subjects` says one thing and `/timetable` still schedules `HG`.

### 5. Teaching Load remains the staffing authority for SPA specialization truth

If Teaching Load has already established valid SPA specialization ownership/coverage, timetable generation must not resurrect `NO_QUALIFIED_FACULTY` for those same specialization lanes without a concrete unresolved contradiction.

### 6. `/timetable` must respect upstream page truth inside ATLAS itself

This pass is explicitly about contract alignment across ATLAS pages.

If `/sections`, `/sections/home-rooms`, `/subjects`, and Teaching Load already hold the accepted truth, `/timetable` must consume and respect that truth instead of drifting away from it.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- latest evidence entry for `runId=87`

Inspect directly before editing:

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- timetable review components and hooks that expose violation labels/counts and room-mode placement truth

---

## Required Outcomes

### 1. Repair Grade 9 generation usage, not just Grade 9 visibility

Required result:

- regular Grade 9 sections with valid `G9` home rooms no longer produce `0` generated entries by default
- this repair must use the existing section home-room/building truth instead of inventing a new placement baseline
- if the real blocker is policy/window starvation, room-occupancy starvation, or another constructor contradiction, document it exactly with live proof

### 2. Restore section-stays-put homeroom fidelity for ordinary classes

Required result:

- ordinary regular-section timetable rows should strongly prefer the section home room/building
- cross-grade drift into rooms like `G10-*` must stop for normal section schedules unless a verified hard conflict requires it
- examples like `MAKATAO -> G10-203` must either be eliminated or explained by a real documented blocker

### 3. Remove `HG` from generated timetable truth if it is out of artifact scope

Required result:

- `HG` no longer appears as generated assigned timetable rows for this artifact if the agreed subject contract excludes it
- `HG` no longer contributes unassigned session debt in generation for this phase
- if `HG` must remain in data for advisory/ownership purposes, keep it outside the generated timetable artifact and document that separation explicitly

### 4. Reconcile SPA specialization qualification truth with Teaching Load

Required result:

- live SPA specialization rows no longer surface `NO_QUALIFIED_FACULTY` when Teaching Load already established valid ownership/coverage truth
- if the real gap is missing specialization ownership or a lane-resolution mismatch, document that exact contradiction and repair it at the correct authority layer

### 5. Make room-type mismatch behavior phase-correct

Required result:

- `ROOM_TYPE_MISMATCH` for ordinary classroom/homeroom timetable rows is no longer treated as a primary hard blocker in this phase
- modular-pool/classroom fallback for ordinary section output does not inflate hard-blocker counts as if it were a fatal rooming failure
- retained mismatch diagnostics must stay inspectable for later facility-booking work

### 6. Preserve real hard truths

Required result:

- keep real room conflicts hard
- keep section/faculty occupancy protection intact
- keep explicit shared-facility collisions hard
- do not fake closure by only altering selectors, labels, or frontend grouping
- do not solve this pass by hiding bad data from the timetable page

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. run relevant tests for homeroom-first rooming, room-mismatch semantics, HG exclusion, and qualification authority
4. add/update targeted tests for Grade 9 placement if room-selection logic changes

### Live checks

1. inspect live section placement truth for Grade 9 sections
2. rerun generation on the active school/year
3. verify whether `G9` receives entries after the repair
4. verify whether lower-grade regular sections still spill into `G10-*` rooms
5. verify whether `ROOM_TYPE_MISMATCH` remains visible only as an honest secondary diagnostic rather than a dominant hard blocker
6. verify whether `HG` still appears in generated timetable entries or unassigned lists
7. verify whether SPA specialization still produces `NO_QUALIFIED_FACULTY`
8. verify that `/timetable` now matches source-of-truth decisions already visible on `/subjects`, `/sections`, `/sections/home-rooms`, and Teaching Load

### Evidence requirements

Document:

- how many active Grade 9 sections have `homeRoomId/buildingZoneId` aligned to `G9` before and after the pass
- how many of those Grade 9 sections still generated `0` entries before and after the pass
- whether the root cause was data baseline, rooming logic, policy/window starvation, or another constructor contradiction
- whether `G9` received generated entries after the pass
- how many lower-grade regular entries were still placed into `G10-*` rooms before and after the pass
- whether `HG` was still generated before and after the pass
- whether SPA `NO_QUALIFIED_FACULTY` contradictions were removed or traced to a specific unresolved saved-truth gap
- how room-type mismatch enforcement/reporting changed, especially for `MODULAR_POOL_ASSIGNED` rows
- final before/after run metrics
- final verdict: `GO` or `NO-GO`

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only for `evidence-log.md`.

---

## GO / NO-GO Rule

Declare `GO` only if:

1. the root cause of `G9` zero-placement is explicitly identified
2. `G9` placement is repaired when the cause is within ATLAS placement/generator scope, or clearly documented as blocked by another unresolved contract
3. ordinary section schedules no longer drift into wrong-grade buildings like `G10-*` without a real hard blocker
4. `HG` no longer pollutes generated timetable truth if it is out of scope for the timetable artifact
5. SPA specialization qualification truth no longer contradicts Teaching Load authority
6. room-type mismatch no longer acts like a misleading hard blocker for ordinary homeroom/classroom output
7. homeroom-first schedule behavior remains intact

Otherwise declare `NO-GO` with the exact remaining blocker set.
