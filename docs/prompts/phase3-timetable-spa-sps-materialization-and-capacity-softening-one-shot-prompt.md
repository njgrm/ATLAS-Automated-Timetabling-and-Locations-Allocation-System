# Copilot Execution Prompt: Phase 3 Timetable SPA/SPS Materialization And Capacity Softening One-Shot

## Mission

Execute the next narrow timetable closure pass.

This pass exists because the `G9` placement blocker is materially closed, but the live timetable still has one remaining special-program truth failure and one remaining policy-contract blocker:

1. `SPA` / `SPS` specialization truth is present in `Teaching Load` and `/sections`, but `/timetable` still does not materialize it faithfully
2. `ROOM_CAPACITY_EXCEEDED` is still acting as a hard placement blocker, which is unacceptable for this stakeholder-replication phase while active enrollment contains known dummy overload values
3. the remaining `150` unassigned rows in the latest live run still need to be reduced and placed into the timetable artifact instead of being left as residual debt

Your objectives:

1. make `SPA` / `SPS` specialization ownership authoritative for timetable demand and plotted output
2. stop timetable generation from collapsing specialization rows into generic `MAPEH` behavior or dropping them entirely
3. downgrade room-capacity overflow from a hard placement blocker to a soft diagnostic/policy-controlled condition for this phase
4. place the remaining `150` unassigned rows wherever feasible under the stakeholder class-program contract

---

## Scope

### In Scope

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/cohort.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- timetable output/read-model and client consumption where needed:
  - `atlas-client/src/hooks/useTimetableData.ts`
  - `atlas-client/src/components/timetable/`
- targeted regression tests for:
  - `SPA_SPEC` / `SPS_SPEC` materialization
  - specialization-label propagation
  - capacity-softened placement under homeroom-first timetable generation
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad timetable UX redesign
- publish/dissemination work
- lab/facility booking workflows
- reintroducing half-day grade shift fences
- unrelated Teaching Load UX polish

---

## Current Verified Live Findings

Treat these as already verified from live Tailnet investigation on `2026-05-28`.

### 1. Specialization ownership truth already exists

Live `/sections/assigned-classes?schoolId=1&schoolYearId=55` currently shows:

- `8` `SPA` sections and `8` `SPS` sections
- every one of those sections already has one specialization class:
  - `SPA_SPEC` for `SPA`
  - `SPS_SPEC` for `SPS`
- each specialization row already has persisted specialization identity (`specializationLabel`, section ownership)

This means the source-of-truth pages already know the specialization assignments.

### 2. Timetable draft output is not faithfully materializing that truth

Latest live draft summary remains approximately:

- `assignedCount=3305`
- `unassignedCount=150`
- `hardViolationCount=630`

Special-program-specific live truth from the latest draft:

- `SPA` unassigned: `70`
- `SPS` unassigned: `70`
- `SPA_SPEC` plotted by `subjectCode`: `0`
- `SPS_SPEC` plotted by `subjectCode`: `0`
- visible `SPA` cohortized entries exist only partially (`10`)
- visible `SPS` cohortized entries currently appear as `0`

Therefore:

- `SPA` specialization plotting is only partial
- `SPS` specialization plotting is missing from timetable output
- timetable output is not aligned with `/sections` or Teaching Load truth

### 3. The remaining unassigned rows are mostly ordinary subjects, not only specialization rows

Latest live distribution shows the special-program unassigned debt is landing on ordinary section subjects such as:

- `ESP`
- `DEVL_READING`
- `MAPEH`
- `TLE_ICT_EXP`
- `AP`
- `SCI_BIO`

This means specialization materialization failure is now causing downstream slot pressure on ordinary subject placement.

### 4. Room capacity is still behaving like a hard blocker

Current live policy payload still exposes:

- `constraintConfig.ROOM_CAPACITY_EXCEEDED.enabled = true`
- `constraintConfig.ROOM_CAPACITY_EXCEEDED.treatAsHard = true`

Current runtime and operator evidence already established:

- live data includes known dummy enrollment overload in some sections
- room-capacity pressure has already blocked otherwise-valid home-room placement during manual pre-draft testing
- this phase is stakeholder class-program replication, not final seat-capacity certification

So `ROOM_CAPACITY_EXCEEDED` must not remain a hard blocker for this pass.

### 5. The current fallback reason is overstating policy/window incompatibility

The latest live unassigned `SPA` / `SPS` samples still show:

- `homeRoomFallbackCause = POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`

But live `/generation/1/55/grade-windows` now shows whole-day windows (`07:30-17:00`) for all grades and all `SPA` / `SPS` rows.

Therefore:

- this is no longer a real half-day shift-fence explanation
- either the reason text is stale, or the constructor is still routing through an outdated fallback path

### 6. Timetable identity is still collapsing specialization rows incorrectly

Live evidence suggests:

- section-facing truth still has `SPA_SPEC` / `SPS_SPEC`
- timetable output is still over-collapsing that demand into generic section scheduling behavior, especially `MAPEH`-like section rows
- generated specialization entries are not preserving `subjectCode`, `specializationCode`, and `specializationLabel` coherently in the draft payload

This is a contract bug, not just a presentation issue.

---

## Required Product Decisions

Follow these decisions exactly.

### 1. Section and Teaching Load truth are authoritative for SPA/SPS specialization demand

If `/sections/assigned-classes` and Teaching Load saved truth say a section owns `SPA_SPEC` or `SPS_SPEC`, the generator shall create corresponding timetable demand.

Do not silently drop, absorb, or rewrite those rows into generic subject demand during construction.

### 2. Qualification normalization must not erase timetable subject identity

It is acceptable for staffing eligibility to normalize through `MAPEH`.

It is not acceptable for plotted timetable rows to lose:

- `subjectCode = SPA_SPEC` or `SPS_SPEC`
- `specializationCode`
- `specializationLabel`

The staffing pool may normalize; the timetable artifact identity may not.

### 3. `ROOM_CAPACITY_EXCEEDED` must become a soft constraint for this phase

For this stakeholder master-schedule replication pass:

- room-capacity overflow shall not remain a hard blocker on timetable placement
- capacity overflow shall be preserved as an explicit soft diagnostic
- ordinary section scheduling must still be allowed to place into the home-room path when capacity is the only remaining contradiction

This is a phase-scoped policy decision, not a statement that capacity never matters.

### 4. The remaining `150` unassigned rows are in scope for active placement recovery

Do not treat this pass as “specialization labels only.”

The pass must also reduce the remaining live unassigned debt by placing rows that are currently being stranded because specialization materialization and capacity-hardening are still misconfigured.

### 5. Stale shift-window fallback messaging must be corrected

If whole-day windows are active, do not keep emitting `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` for cases that are actually caused by other fallback failure paths.

The reported blocker reason must match the real cause.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/prompts/phase3-timetable-g9-slot-starvation-and-special-program-plotting-followup-one-shot-prompt.md`

Inspect directly before editing:

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/cohort.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`

---

## Required Outcomes

### 1. Fully materialize SPA/SPS specialization demand

Required result:

- every active `SPA` section with saved `SPA_SPEC` truth produces timetable specialization demand
- every active `SPS` section with saved `SPS_SPEC` truth produces timetable specialization demand
- specialization rows no longer disappear between `/sections` truth and `/timetable` draft output

### 2. Preserve specialization identity in the draft contract

Required result:

- plotted specialization entries keep an explicit specialization-aware identity in the draft payload
- the timetable output contract exposes enough identity to render:
  - specialization subject identity
  - specialization label
  - any cohort/breakout identity where used
- `SPS` is no longer invisible in timetable output
- `SPA` is no longer only partially visible

### 3. Stop collapsing specialization demand into generic MAPEH-like behavior

Required result:

- the generator may still use `MAPEH` as an eligibility/staffing pool
- but the plotted rows must remain `SPA_SPEC` / `SPS_SPEC`
- ordinary `MAPEH` section rows must not silently replace specialization rows in the timetable artifact

### 4. Soften room-capacity overflow and place more of the remaining unassigned rows

Required result:

- `ROOM_CAPACITY_EXCEEDED` no longer prevents placement as a hard blocker for this phase
- capacity overflow is still surfaced as a soft diagnostic or explicit warning
- the remaining `150` live unassigned rows are actively reduced where capacity-hardening was the blocking condition
- evidence must show before/after counts for:
  - total unassigned
  - `SPA` unassigned
  - `SPS` unassigned
  - `ROOM_CAPACITY_EXCEEDED`

### 5. Correct stale fallback cause reporting

Required result:

- if a row fails because of specialization materialization drift, slot exhaustion, or another real cause, that reason is surfaced honestly
- `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE` is not emitted as a generic placeholder when whole-day windows are already active

### 6. Keep `/timetable` aligned with upstream ATLAS truth surfaces

Required result:

- `/timetable` respects truth already accepted in:
  - `/subjects`
  - `/sections`
  - `/sections/assigned-classes`
  - Teaching Load specialization ownership

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. add/update targeted regression tests for:
   - `SPA_SPEC` / `SPS_SPEC` demand creation from saved truth
   - specialization identity propagation into draft entries
   - softened room-capacity overflow not blocking home-room placement
   - corrected fallback reason reporting when whole-day windows are active

### Live checks

1. verify the latest active draft before changes:
   - total unassigned
   - `SPA` unassigned
   - `SPS` unassigned
   - `ROOM_CAPACITY_EXCEEDED`
2. rerun generation after the repair
3. confirm every `SPA` and `SPS` section now has timetable-visible specialization presence
4. confirm `SPS` specialization is plotted in `/timetable`, not just `/sections`
5. confirm `SPA` specialization is fully plotted, not only partial cohorts
6. confirm `ROOM_CAPACITY_EXCEEDED` no longer acts as a hard placement blocker in the pass
7. confirm the remaining unassigned count decreases from the current `150`

### Evidence requirements

Document:

- before/after unassigned totals
- before/after `SPA` and `SPS` unassigned totals
- before/after `ROOM_CAPACITY_EXCEEDED` treatment
- which specialization rows were missing before and how they materialize after
- whether the draft payload now carries usable specialization identity
- whether any residual unassigned `SPA` / `SPS` debt is still real after the fix
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

1. `SPA` and `SPS` specialization truth now materializes in timetable output for all active sections
2. specialization identity is no longer lost between `/sections` truth and draft output
3. `ROOM_CAPACITY_EXCEEDED` is no longer a hard placement blocker for this phase
4. the remaining live unassigned count is reduced from the current `150`
5. fallback blocker reporting is honest and no longer hides behind stale shift-window language

Otherwise declare `NO-GO` with the exact remaining blocker set.
