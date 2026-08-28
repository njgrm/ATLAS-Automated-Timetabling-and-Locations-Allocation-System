# Copilot Execution Prompt: Phase 3 Timetable G9 Slot-Starvation And Special-Program Plotting Follow-Up One-Shot

## Mission

Execute the next narrow timetable follow-up pass.

This pass exists because the previous G9/room-mismatch follow-up resolved several side failures, but the live generator still has three active contract-truth blockers:

1. regular Grade 9 sections still collapse into `NO_AVAILABLE_SLOT` with `0` generated entries even though their home-room and building truth is already valid
2. system-managed subject/template sync still overrides manual operator intent for certain timetable-relevant subjects, shown live by `G10 STE` re-materializing both `STE_APPLIED_PHYS` and `STE_ROBOTICS` after manual cleanup
3. `SPA` / `SPS` subjects still behave as blocked or missing in timetable output even when the live conflict inspector shows open slots, and specialization identity is still not plotted in the timetable artifact
4. live Grade 9 pre-draft placement testing now suggests overloaded dummy enrollment can trigger room-capacity failure against valid G9 home rooms, but that failure is currently getting buried inside post-generation `NO_AVAILABLE_SLOT` outcomes instead of surfacing honestly

Your objectives:

1. repair regular Grade 9 slot starvation under the current whole-day timetable contract
2. stop system-managed sync/generation from resurrecting timetable subjects or template bindings that operators intentionally removed or deactivated for the active school/year
3. make timetable generation and plotting respect `SPA` / `SPS` saved truth, including real specialization visibility and blocked-slot diagnosis

---

## Critical Scope Decision

### This pass must not assume grade shift windows are active

For current testing and closure, the live timetable artifact is operating as a **whole-day** schedule.

Therefore:

- do **not** treat `G7/G8 AM` and `G9/G10 PM` shift fences as the intended active runtime contract for this pass
- do **not** explain Grade 9 collapse as expected because of half-day windows unless you prove the current generator is still incorrectly enforcing them
- if legacy grade/program shift-window logic is still constraining slot search, treat that as a bug or stale-contract blocker

This pass is about timetable truth under the current whole-day stakeholder replication target.

---

## Scope

### In Scope

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts` only if needed to read specialization truth
- timetable plotting/read-model paths on the client:
  - `atlas-client/src/hooks/useTimetableData.ts`
  - `atlas-client/src/components/timetable/`
- targeted tests for:
  - G9 slot starvation
  - whole-day slot search behavior
  - manual subject intent surviving sync/generation
  - `SPA` / `SPS` plotting and specialization visibility
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- reintroducing or redesigning half-day grade shift windows
- publish/dissemination work
- broad UI polish unrelated to timetable truth
- lab/facility-booking workflows

---

## Current Verified Problems

Treat these as already verified:

### 1. Grade 9 starvation remains after the previous follow-up

- latest documented live closure check still shows:
  - `regularG9Sections=12`
  - `regularG9Entries=0`
  - `regularG9Unassigned=480`
  - `regularG9UnassignedByReason={ NO_AVAILABLE_SLOT: 480 }`
- this was already narrowed to slot-availability starvation, not missing `G9` room data
- new operator breakthrough to treat as verified lead:
  - manual pre-draft placement of a regular G9 section reports room capacity exceeded
  - live EnrollPro G9 enrollment counts are known dummy/overloaded data
  - the current generator likely treats that capacity contradiction as an implicit hard blocker during room search, then collapses the outcome into `NO_AVAILABLE_SLOT`

### 2. Manual subject cleanup is not authoritative against sync/generation

Current observed operator failure:

- `G10 STE` should not keep both `STE_APPLIED_PHYS` and `STE_ROBOTICS` active if stakeholder truth says only one should remain
- manual delete/deactivation appears to work in `Subjects`
- after generation or subject sync, the removed subject comes back

This is already consistent with current code shape:

- `subject.service.ts` still treats system-managed overlays as canonical defaults
- `reconcileSubjectContractFromUpstream()` is invoked by generation and sync paths
- `class-template.service.ts` still binds both `STE_APPLIED_PHYS` and `STE_ROBOTICS` into the default STE template

### 3. `SPA` / `SPS` timetable truth is still drifting

Current operator findings to treat as valid:

- `SPA` / `SPS` sections still show blocked subjects even when the live conflict inspector confirms open timetable slots
- both `SPA` and `SPS` specializations are still not being plotted in the timetable artifact

Interpret this as a likely contract split between:

- saved specialization truth from Teaching Load / ownership
- generated timetable demand
- timetable plotting/render contract

Do not dismiss this as “the slots are not really open” without proving it.

---

## Required Product Decisions

Follow these decisions exactly:

### 1. Whole-day timetable truth is the active contract for this pass

The current artifact must be solved as a whole-day schedule.

If stale shift-window logic is still starving Grade 9, remove or bypass that stale enforcement for this pass.

### 1a. Dummy room-capacity overload must not stay a silent hard blocker

Current live G9 testing strongly suggests that room-capacity enforcement is contributing to the zero-placement collapse.

For this pass:

- do not silently collapse room-capacity failure into generic `NO_AVAILABLE_SLOT`
- if G9 home-room placement fails because EnrollPro dummy enrollment exceeds the room capacity, surface that explicitly
- treat dummy-data room-capacity overload as a diagnosable blocker, not an invisible feasibility black hole

If stakeholder closure for this phase requires homeroom-faithful class-program replication despite dummy over-capacity data, then capacity handling must be downgraded, bypassed, or made explicitly policy-controlled for generation in this stream.

### 2. Manual subject intent must be respected for the active school/year

If an operator intentionally removes or deactivates a timetable subject for the active school/year, sync/generation must not silently resurrect it just because it exists in a generic default catalog.

System-managed defaults may seed missing baseline rows, but they must not overwrite deliberate active-year contract decisions without an explicit operator reset action.

### 3. `G10 STE` duplicate overlay truth must be resolved at the contract layer

If stakeholder truth requires one active Grade 10 STE overlay subject instead of both `STE_APPLIED_PHYS` and `STE_ROBOTICS`, fix that at the subject/template contract layer.

Do not leave the system in a state where:

- `Subjects` says one thing
- class templates say another
- generation reasserts the older default

### 4. `SPA` / `SPS` timetable plotting must reflect saved specialization truth

If the timetable keeps umbrella subjects (`SPA_SPEC`, `SPS_SPEC`) at the schedule-construction layer, the rendered artifact must still be able to show the actual section specialization identity where stakeholder output expects it.

At minimum:

- blocked `SPA` / `SPS` rows must explain the real blocker
- plotted rows must not discard specialization identity

### 5. Open slots in the conflict inspector must mean something truthful

If the conflict inspector shows two open slots for a subject/section, but the subject remains blocked or absent, the system must explain the real unresolved constraint.

Do not allow “open-looking slots” to coexist with silent hidden blockers.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/prompts/phase3-timetable-g9-placement-and-room-mismatch-followup-one-shot-prompt.md`

Inspect directly before editing:

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`

---

## Required Outcomes

### 1. Repair Grade 9 starvation under the whole-day contract

Required result:

- regular Grade 9 sections no longer remain at `0` generated entries by default
- if stale shift-window gating is still affecting slot search, identify and remove/bypass it for this pass
- if room-capacity overload on dummy G9 enrollment is the real blocker, surface it explicitly and stop collapsing it into generic `NO_AVAILABLE_SLOT`
- if phase-closure policy requires capacity overload to be non-blocking for this artifact, implement that behavior deliberately and document it
- evidence must show the exact cause of `NO_AVAILABLE_SLOT` before and after the repair

### 2. Make manual subject cleanup survive sync/generation

Required result:

- if an operator removes or deactivates one of the conflicting `G10 STE` overlay subjects, sync/generation no longer silently restores it
- default subject seeding and default template binding must respect active-year manual override truth
- if an explicit reset-to-default action is needed, that reset must be deliberate and separate from ordinary generation

### 3. Resolve `G10 STE` duplicate overlay truth

Required result:

- the active subject/template contract no longer forces both `STE_APPLIED_PHYS` and `STE_ROBOTICS` into generation when stakeholder truth requires one effective overlay
- timetable demand, subject activation, and template bindings all align to the same active truth

### 4. Repair `SPA` / `SPS` blocked-slot and plotting truth

Required result:

- if `SPA` / `SPS` rows are blocked despite open slots, the real hidden blocker is surfaced and corrected
- `SPA` / `SPS` timetable rows are actually plotted when saved truth supports them
- specialization identity is visible in timetable output where available from ownership metadata

### 5. Keep the timetable page aligned with ATLAS source-of-truth pages

Required result:

- `/timetable` respects accepted truth from:
  - `/subjects`
  - `/sections`
  - `/sections/home-rooms`
  - Teaching Load specialization ownership

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. add/update targeted regression coverage for:
   - G9 slot starvation under whole-day assumptions
   - room-capacity-overloaded homeroom behavior
   - system-managed subject/template override persistence
   - `SPA` / `SPS` plotting / specialization-label rendering if changed

### Live checks

1. verify latest active subject/template truth for `G10 STE`
2. intentionally remove/deactivate the unwanted duplicate `G10 STE` overlay subject
3. run sync/generation and prove it does not come back
4. rerun timetable generation and verify regular Grade 9 sections now receive entries
5. verify whether `SPA` / `SPS` blocked subjects still fail when conflict inspector shows open slots
6. verify whether `SPA` / `SPS` plotted rows now show specialization-aware identity

### Evidence requirements

Document:

- whether stale shift-window logic was still affecting slot search
- exact root cause of G9 `NO_AVAILABLE_SLOT`
- whether room-capacity overload was the real hidden G9 blocker
- whether room-capacity overload now surfaces explicitly instead of being buried under `NO_AVAILABLE_SLOT`
- whether room-capacity overload remains hard, becomes soft, or becomes policy-controlled for this phase
- before/after truth for `G10 STE` duplicate overlay subjects
- why manual subject cleanup previously failed to persist
- before/after `SPA` / `SPS` blocked-slot behavior
- before/after `SPA` / `SPS` plotting behavior
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

1. regular Grade 9 sections no longer collapse to `0` entries under the current whole-day contract
2. manual subject cleanup for the active school/year survives sync/generation
3. the `G10 STE` duplicate overlay contract is aligned across subjects, templates, and generation
4. `SPA` / `SPS` blocked-slot truth is explained and repaired
5. `SPA` / `SPS` specialization identity is plotted or explicitly documented at the correct layer

Otherwise declare `NO-GO` with the exact remaining blocker set.
