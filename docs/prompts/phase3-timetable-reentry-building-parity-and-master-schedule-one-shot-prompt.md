# Copilot Execution Prompt: Phase 3 Timetable Re-Entry, Building Parity, And Master-Schedule Feasibility One-Shot

> Execution note:
> Treat this file as the umbrella re-entry brief.
> Do not use it as the first direct Copilot execution prompt.
> Execute the split sequence instead:
> 1. `phase3-timetable-baseline-truth-and-building-parity-one-shot-prompt.md`
> 2. `phase3-timetable-room-demand-and-home-room-reconcile-one-shot-prompt.md`
> 3. `phase3-timetable-term-aware-master-schedule-output-one-shot-prompt.md`

## Mission

Re-enter the `Timetable` stream now that `Teaching Load` data integrity is materially closed for the active year.

This pass must be treated as a substantial backend-plus-runtime repair pass, not a cosmetic UI pass.

Your job is to:

1. re-establish truthful current timetabling baseline metrics
2. repair building-registration and campus-topology parity inside `/timetable`
3. contract room-demand assumptions so the generator matches stakeholder reality more closely
4. improve the master-schedule outcome used to derive teacher and section schedules
5. preserve or repair section home-room truth if campus reseed/topology reconciliation changes room/building identity
6. make term-aware rotational scheduling honest to stakeholder output style

Do not stop after one small fix.
Iterate within this pass until you either:

- reach an evidence-backed `GO` for the current re-entry gate
- or produce an explicit `NO-GO` with exact remaining blocker metrics and why they are still hard blockers

The priority is the real schedulable master schedule.
Stakeholders currently care more about:

- master schedule outcome
- teacher schedules
- section schedules

than about a perfect explicit building-level schedule for every class transition.

Room/building logic should therefore be strict only where the stakeholder files and current school operations truly require it.

---

## Current Verified Re-Entry Baseline

Treat the following as current verified findings that this pass must start from.

### Teaching Load baseline is now clean enough

- `quarantine.required = false`
- `coverageAssignedPairs = 1034`
- `coverageUnassignedPairs = 0`
- `integrityMissingOwnershipPairs = 0`
- `integrityOwnershipWithoutScopePairs = 0`
- `integrityOutOfSubjectScopePairs = 0`
- `truthRowsToUpdate = 0`
- active zero-load eligible `MAPEH` teachers = `0`

Do not spend this pass reopening Teaching Load truth unless a timetable issue directly depends on it.

### Timetable is still the primary NO-GO surface

The current runtime map still marks `/timetable` as the main convergence-point failure surface.

### Building/topology parity is still wrong

Live map API currently returns this generic campus topology for `schoolId=1`:

- `MAIN`
- `SCI`
- `TLE`
- `GYM`
- `ADMIN`
- `G7`
- `G8`
- `G9`
- `G10`
- `STEX`
- `SPS`
- `SPA`

Important live fact:

- `G9` **does exist** in the live map API
- if `G9` is missing in `/timetable`, that is a timetable consumption/parity bug, not a missing map record

There is also live seed drift:

- current live map still includes `MAIN`
- current `prisma/seed.js` building template no longer defines `MAIN`

So this pass must reconcile:

- live campus-map data
- current seed files
- timetable workspace consumption

instead of assuming a single clean source is already in control

### Stakeholder campus references are still more concrete than ATLAS live topology

Stakeholder artifacts reference numbered buildings and real room labels such as:

- `BLDG 3`
- `BLDG 9`
- `BLDG 10`
- `BLDG 11`
- `BLDG 12`
- `BLDG 13`
- `BLDG 14`
- `BLDG 21`
- `BLDG 23`
- `BLDG 26`
- `PAGCOR BLDG`

ATLAS live topology is still more invented/generic than those stakeholder artifacts.

### Current generator truth is not stable enough yet

There is a latest-run truth problem:

- recent runtime docs and direct run audits have contradictory generation summaries
- at least one latest completed run summary is internally inconsistent and must not be treated as trustworthy until repaired

This means the first step is not “optimize blindly.”
The first step is “repair the truth contract of the run baseline.”

### Specialized room pressure should now be treated more conservatively

Stakeholder discussions and artifact review indicate:

- there is no strong stakeholder-owned per-period building schedule process right now
- grade-level buildings matter more than constant fine-grained specialized-room routing
- special rooms still matter where they are truly singleton or explicitly required
- but broad specialized-building assumptions should not dominate ordinary timetable feasibility

So this pass may relax specialized room/building requirements where that matches stakeholder reality.

Do **not** delete support for specialized rooms.
Do **not** allow shared singleton facilities to double-book.
Do **not** turn this into “everything can happen anywhere.”

The correct model is:

- classroom/homeroom first by default
- explicit specialized-room enforcement only for clearly specialized demand
- shared-facility hard protection preserved

### Term-awareness is partially present but not yet product-aligned

Current backend/generation code already contains real term-aware mechanics:

- `termIndex`
- `termCounts`
- modular assignment handling for rotation families

But stakeholder timetable output behaves differently from how ATLAS currently exposes that truth:

- the same timetable slot stays stable across the year
- what changes by term is the teacher and the subject identity inside that slot
- stakeholder-facing master schedules commonly show normalized labels like `SCIENCE` and `TLE`
- detailed rotational subject identity is shown in a separate per-term / per-quarter style view

So this pass must not confuse:

- backend term-awareness
- with product-ready stakeholder-facing timetable term presentation

ATLAS needs both:

1. a stable master-schedule view that can normalize rotating `SCIENCE` and `TLE` families into stakeholder-familiar umbrella labels
2. a separate rotational detail view or contract that shows which concrete science/TLE subject and teacher applies in each term

---

## Scope

### In Scope

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/pages/ScheduleReview.tsx` or current `/timetable` shell only where required
- `atlas-client/src/pages/Sections.tsx` and directly related section home-room components only if room/building reseed or identity repair changes visible home-room truth
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`
- targeted tests covering changed generator/building/runtime logic
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- reopening Teaching Load data-integrity logic unless strictly required by timetable consumption
- redesigning unrelated app shell navigation
- broad Faculty / Subjects / Sections UX changes unrelated to timetable correctness
- hardcoding school-specific logic into generic generator behavior

If stakeholder-school fidelity needs data repair, do it through:

- configurable seed data
- map data repair
- placement/topology normalization

not through school-specific conditional logic inside the generic scheduler.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-timetabling-readiness-against-teaching-load-audit-2026-05-26.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`

Inspect directly before editing:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`

You must also inspect the live map/building contract and the live `/timetable` workspace behavior before declaring `GO`.

---

## Required Work Order

Follow this order.
Do not skip ahead.

### 1. Re-establish truthful latest-run baseline

You must first verify what the latest trustworthy generation baseline actually is.

Required outcomes:

- identify the latest completed runs for the active school/year
- verify whether the latest run summary is internally consistent
- if the newest run reports contradictory numbers, repair the summary/reporting contract before making optimization claims
- ensure `assignedCount`, `unassignedCount`, `hardViolationCount`, `policyBlockedCount`, and detailed violation arrays describe the same real run state

If run-summary truth is broken, this is a first-class defect.
Do not proceed as if the generator is healthy while its reporting contract lies.

### 2. Repair building registration parity inside timetable

Trace the exact building path through:

- live map API
- pre-generation draft context
- timetable workspace bootstrap
- building/map workspace
- building filters or pivots used by `/timetable`

Required outcomes:

- if `G9` exists in map API, it must be visible to timetable surfaces that consume buildings
- building lists used by `/timetable` must not silently diverge from map API unless intentionally filtered and explained
- pre-generation draft filters and map/building workspace must use an honest building list
- remove stale assumptions that cause buildings to disappear from timetable even though they exist in campus map

You must prove which layer caused the missing-building symptom.
Do not guess.

### 3. Reconcile live topology against current seed ownership

Inspect both:

- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`

and determine which one should own the active school’s campus baseline.

Required outcomes:

- explain and repair live drift such as `MAIN` existing live while newer seed templates no longer define it
- determine whether old generic seeded topology is still polluting the pilot-school map
- if needed, normalize the current school map/seed path so timetable uses one coherent, current topology contract

Do not blindly delete buildings.
Do not destroy user data.
If data reconciliation is needed, make it deliberate and auditable.

### 4. Shift timetable rooming toward stakeholder reality

You may relax specialized building/room requirements where stakeholder evidence supports it.

Required rule set:

- default ordinary academic sessions to classroom/homeroom-first behavior
- keep grade-level buildings as the primary meaningful rooming footprint
- preserve hard protection for real shared/singleton facilities
- do **not** treat building identity by itself as a hard feasibility blocker for normal academic timetable construction
- require specialized rooms only when the subject demand explicitly justifies them
- where exact specialized-room inventory is uncertain or stakeholder data does not support strict enforcement, relax that demand to non-hard guidance instead of failing the master schedule

This means you should do a broad relaxation of **building-level hard violations**.
Normal classes should not fail simply because they are not in a named specialized building.

What must still remain hard:

- room double-booking
- shared singleton facility double-booking
- true explicit same-resource collisions for retained specialized resources

Minimum retained anti-collision expectation:

- `TLE` sessions must not crash into each other on the same retained constrained room/resource if such a room/resource is still explicitly modeled

If exact lab inventory is not trustworthy enough to enforce hard room-type scarcity globally, prefer:

- master-schedule success
- honest soft diagnostics
- preservation of only the clearly real singleton/shared collisions

Examples of demand that may remain explicitly specialized if current contract still supports it:

- true labs
- computer labs
- gym/court demand
- explicit workshop demand

Examples of what should **not** stay over-constrained:

- ordinary academic blocks being forced into invented dedicated special-program buildings when stakeholder operations do not support that
- broad fallback rules that make generic master-schedule feasibility hinge on aggressive specialized-room routing

### 4a. Preserve and repair section home-room truth if topology changes

If this pass reseeds, resets, reconciles, renames, or remaps campus buildings/rooms in a way that changes room identity, building identity, or building-zone assumptions:

- you must patch section `homeRoomId`
- you must patch `buildingZoneId`
- you must verify the `Sections` page still sees coherent home-room assignments
- you must verify `/sections/home-rooms/:schoolYearId` remains usable and truthful

Do not leave `/sections` broken after a timetable topology repair.
If room IDs or building ownership moved, section home rooms must be reconciled in the same pass.

### 5. Improve feasibility on the real current dataset

After repairing truth and topology, rerun generation and contract logic on the real active dataset.

Target improvement areas:

- `UNASSIGNED_SECTION`
- `SPECIALIZED_ROOM_UNAVAILABLE`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `homeRoomSuccessRate`

You do not need perfect closure in one pass if hard structural blockers remain.
But you must materially improve the correct blocker classes without lying about results.

### 6. Keep the master schedule outcome primary

The success lens is:

- better master schedule
- better section schedules
- better teacher schedules

not:

- a theoretically pretty building-routing model that stakeholders do not actually use operationally

If tradeoffs are required, prefer the contract that improves publishable schedule outcomes while keeping explicit hard conflicts prevented.

### 6a. Make rotational SCIENCE and TLE presentation stakeholder-honest

Required outcomes:

- the master schedule may show normalized umbrella labels like `SCIENCE` and `TLE` where that matches stakeholder files
- term-aware concrete taught identity must still be preserved in the runtime contract
- timetable surfaces must support a separate rotational-detail view or equivalent contract showing:
  - which concrete subject applies in Term 1 / 2 / 3
  - which teacher applies in Term 1 / 2 / 3
  - for the same stable slot

The important stakeholder rule is:

- the slot remains stable
- the term-specific teacher/subject changes inside that slot

Do not regress term-aware truth just because the umbrella master schedule becomes simpler.

---

## Product Decisions To Follow

### 1. Do not overfit building scheduling

Stakeholder feedback indicates building-level movement scheduling is a separate process right now.

Therefore:

- do not make broad building-specialization rules the dominant feasibility gate
- do keep building topology relevant for home-room ownership and travel well-being checks

### 2. Grade-level buildings matter most

The important room/building contract in current school operations is the grade-level footprint first.

So the pass should favor:

- grade-level building ownership
- classroom-default placements
- explicit exceptions only where needed

### 3. Preserve school-agnostic generator logic

If pilot-school topology needs to become closer to stakeholder files:

- repair school data
- repair seeds
- repair overlays

Do not put pilot-specific building logic inside the generic scheduling algorithm.

### 4. Shared facilities remain hard-protected

Even if room demand is relaxed overall:

- no shared facility double-booking
- no fake “everything is a classroom” shortcut

### 5. Do not declare success on contradictory metrics

If the latest generation run still contradicts itself, verdict must remain `NO-GO` until reporting truth is fixed.

---

## Verification Requirements

You must verify both code-level correctness and live runtime behavior.

### Automated

At minimum:

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if any client/timetable files are touched
3. run relevant existing timetable/generation regression tests
4. add or update targeted tests if building registration or room-demand semantics changed

### Live runtime checks

At minimum:

1. verify live map API building list for `schoolId=1`
2. verify `/timetable` can consume and expose the corrected building list
3. verify `G9` is present anywhere it should be present if the map API contains it
4. rerun generation on the active school/year
5. verify the resulting run summary is internally consistent
6. if topology reseed/reconciliation occurred, verify section home-room assignments still resolve cleanly in `/sections`
7. verify timetable output supports both:
   - stable umbrella master schedule semantics for rotating `SCIENCE` / `TLE`
   - rotational term-detail visibility for those same slots
8. capture the final blocker counts:
   - `assignedCount`
   - `unassignedCount`
   - `hardViolationCount`
   - `policyBlockedCount`
   - `UNASSIGNED_SECTION`
   - `SPECIALIZED_ROOM_UNAVAILABLE`
   - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
   - `FACULTY_EXCESSIVE_IDLE_GAP`
   - `homeRoomSuccessRate`

### Stakeholder-parity checks

At minimum:

1. compare live building topology against stakeholder building references
2. state whether the repaired topology is:
   - still generic but operationally coherent
   - or materially closer to stakeholder layout
3. explicitly state whether room-demand relaxation improved master-schedule feasibility without breaking shared-facility protection

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only for `evidence-log.md`.
Do not overwrite prior evidence.

The evidence entry must include:

- exact building list observed from live map API
- whether `G9` or other buildings were missing in timetable before the pass
- which layer caused the mismatch
- whether live seed/topology drift was found
- whether any reseed/reconciliation required section home-room patching, and what was updated
- whether specialized room/building requirements were relaxed, and exactly how
- whether term-aware rotational schedule truth is now exposed in a stakeholder-honest way
- latest trustworthy run metrics before and after the pass
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO Rule

You may declare `GO` for this re-entry pass only if all of the following are true:

1. latest run summary is internally trustworthy
2. timetable building consumption no longer hides map buildings like `G9` when they exist in live map data
3. live room/building contract is more honest to stakeholder operations
4. specialized-room pressure is reduced or correctly bounded without introducing shared-facility corruption
5. the master-schedule outcome materially improves on the active dataset

If you cannot achieve that, declare `NO-GO` and provide the exact remaining blocker class and counts.

Do not stop at a partial cosmetic improvement and call it closure.
