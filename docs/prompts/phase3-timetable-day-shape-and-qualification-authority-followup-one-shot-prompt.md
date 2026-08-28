# Copilot Execution Prompt: Phase 3 Timetable Day-Shape And Qualification Authority Follow-Up One-Shot

## Mission

Execute the next timetable follow-up pass.

This pass exists because the recent timetable contract cleanup only fixed the main display contract. It did **not** fully repair the underlying day-shape math, the staffing-authority split-brain, or the post-generation manual-assignment fallback model.

Your objectives:

1. restore stakeholder-faithful `45`-minute timetable blocks as the active generated timetable baseline for the target school/year
2. expose block/day-shape configuration as a real scheduling policy control instead of leaving period length trapped inside stale class-template defaults
3. make Teaching Load saved truth authoritative enough that already-approved pairings do not continue surfacing as `FACULTY_SUBJECT_NOT_QUALIFIED`
4. demote post-generation unassigned drag/assign workflow from normal expected completion path to explicit diagnostic/emergency tooling only

---

## Scope

### In Scope

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/grade-window.service.ts`
- timetable day-shape helpers and policy/window contract surfaces
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/pages/ScheduleReview.tsx` only where required
- targeted tests for day-shape selection, 45-minute slot normalization, and qualification-authority behavior
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad topology reseed
- final term-aware umbrella master-schedule output
- unrelated timetable UI redesign
- facility-booking workflows

---

## Current Verified Problems

Treat these as already verified:

- recent cleanup changed `summary.timetableDisplaySlots` to one primary display contract, but the constructor still computes and normalizes demand against mixed per-program shapes
- live subject/session behavior still allows `225` minutes to resolve as `4` sessions in some cases and `5` in others
- current stakeholder class-program artifacts expect `45`-minute blocks
- the current system does not expose a first-class operator control for the active timetable block length/day shape that drives generation truth
- timetable UI wording was softened from qualification failure to teaching-load review, but runtime qualification blocking still survives in latest metrics
- unassigned/manual placement tooling is still framed as a normal review workflow rather than a residual-diagnostic workflow

---

## Required Product Decisions

Follow these decisions exactly:

### 1. Stakeholder block length is now the baseline

For the active stakeholder replication stream, the generated timetable baseline must align to `45`-minute blocks unless direct current evidence in this repo proves otherwise.

### 2. Block length must become a real control

Do **not** leave the active day shape trapped in per-program template defaults alone.

The active school/year must have a real policy/control path for:

- block length / period length
- periods per day or equivalent active day-shape contract
- protected recess/lunch/special-event boundaries

This control must drive generation truth, not just presentation.

### 3. One active generated day shape per school/year review contract

Do not keep a mixed generated review contract where the main schedule effectively uses multiple incompatible slot sizes at once.

### 4. Teaching Load is the staffing authority for this phase

If the active school/year Teaching Load truth already approves a faculty-subject-section pairing, timetable validation must not continue blocking it as if it were an unrelated independent qualification failure.

### 5. Manual post-generation assignment is not the happy path

Emergency/manual tools may remain, but the schedule review surface must not keep teaching operators that the expected next step after generation is to drag unresolved sessions into place manually.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/prompts/phase3-schoolwide-day-shape-alignment-prompt.md`

Inspect directly before editing:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/timetable/`
- current `/timetable` shell and related hooks

---

## Required Outcomes

### 1. Restore a true 45-minute day-shape baseline

Required result:

- active generation for the target school/year uses a stakeholder-faithful `45`-minute day shape
- generated timetable rows no longer behave like a hidden mix of `45` and `60`
- `225`-minute subjects resolve consistently under the active timetable shape

### 2. Add or repair operator-facing day-shape control

Required result:

- scheduling policy (or its canonical equivalent control surface) exposes the active block/day-shape contract
- operators can inspect and persist the effective block length instead of inheriting it invisibly from stale template defaults
- the control path remains compatible with lunch/recess/special-event display rules

### 3. Align qualification enforcement with Teaching Load authority

Required result:

- already-approved active school/year pairings no longer surface as normal qualification blockers
- any remaining `FACULTY_SUBJECT_NOT_QUALIFIED` debt must represent true unresolved saved-truth mismatch, not duplicated authority logic

### 4. Reframe manual-unassigned review as residual diagnostics

Required result:

- unassigned debt stays visible
- tutorial/copy/header/rail wording no longer frames dragging unassigned sessions as the normal schedule-completion workflow
- emergency/manual tooling may remain, but it must be clearly secondary

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. run relevant tests for timetable shape and qualification behavior
4. add/update targeted tests if day-shape or validation authority changes

### Live checks

1. rerun generation on the active school/year
2. verify the generated timetable now reflects `45`-minute block behavior
3. verify representative `225`-minute subjects now land as `5` sessions where the stakeholder baseline requires it
4. verify the active policy/control response exposes the repaired day-shape contract
5. verify already-approved Teaching Load pairings no longer inflate `FACULTY_SUBJECT_NOT_QUALIFIED`
6. verify timetable review copy no longer presents manual-unassigned drag placement as the standard next step

### Evidence requirements

Document:

- exact before/after day-shape contract
- where the active block-length/day-shape control now lives
- whether generation truth now follows the `45`-minute stakeholder baseline
- whether `225`-minute subject session counts now align consistently
- whether `FACULTY_SUBJECT_NOT_QUALIFIED` was repaired or only reduced
- which timetable review/manual-unassigned copy or interaction assumptions were demoted or retained
- final run metrics
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

1. the active generated timetable day shape is stakeholder-faithful and `45`-minute based
2. block/day-shape truth is operator-visible through a real persisted control path
3. `225`-minute subject session counts now align to that active shape consistently
4. Teaching Load authority and timetable qualification checks no longer contradict each other for approved pairings
5. manual-unassigned workflow is clearly secondary rather than the expected normal finish path

Otherwise declare `NO-GO` with the exact remaining blocker set.
