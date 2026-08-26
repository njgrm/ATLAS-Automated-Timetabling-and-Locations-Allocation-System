# Copilot Execution Prompt: Phase 3 Special-Program Placement Contract Repair

## Goal
Repair the gap between stakeholder-school occupancy/placement reality and the current ATLAS mirrored section placement contract.

This prompt exists because live ATLAS no longer has null placement fields as the main issue.
The current issue is that sections are now placed into a generic seeded campus model that still does not match stakeholder occupancy artifacts well.

Examples of current drift:
- ATLAS uses generic buildings such as `G7`, `G8`, `G9`, `G10`, `STEX`, `SPA`, `SPS`
- stakeholder artifacts use numbered buildings and mixed-building placement such as:
  - `BLDG 3`
  - `BLDG 9`
  - `BLDG 10`
  - `BLDG 21`
  - `BLDG 24`
  - `BLDG 26`
- Grade 10 final outputs explicitly anchor regular sections to `B9/*` rooms
- Grade 7 occupancy files anchor regular and special sections to concrete numbered-building rooms

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- any room/home-room assignment helpers used for `SectionMirror`
- any page or API surface that exposes section home-room and building-zone state

## Known Facts To Treat As Fact
- Upstream section parity is already `GO` for program mix.
- Live ATLAS sections now have filled placement fields, but the placement model is still generic and not stakeholder-faithful.
- The office-files occupancy artifacts are strong enough to prove the current seeded campus contract is not a good proxy for the stakeholder school.
- EnrollPro may not own all home-room/building-zone detail for these sections.
- ATLAS may need a manual or imported overlay contract for section placement until SSE-level ownership improves.

## Scope
In scope:
- section placement fidelity for stakeholder-critical sections
- `homeRoomId`
- `buildingZoneId`
- explicit contract for how ATLAS gets or stores stakeholder-faithful placement when upstream does not provide it
- Tailnet verification of the repaired persisted state

Out of scope:
- broad timetable algorithm changes
- subject-minute math repair
- faculty coverage redistribution

## Required Behavior
1. Audit current section placement state in API and DB against stakeholder occupancy artifacts.
2. Determine whether the missing placement should come from:
   - upstream sync
   - ATLAS manual overlay
   - a hybrid contract
3. Implement the smallest coherent repair path.
4. Verify the repaired state on Tailnet and in direct DB reads.
5. If the first fix still leaves stakeholder-critical sections placed only in a generic non-faithful topology, self-correct once in the same pass.

## Required Direction
- Do not treat "non-null placement" as equivalent to "correct placement".
- Prefer an explicit and auditable overlay path over hidden defaults.
- Keep EnrollPro as the source of truth for roster/program membership, but allow ATLAS to own missing or corrected placement overlays when upstream does not provide them.
- Use the stakeholder occupancy artifacts as the placement baseline where they are strong enough.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - GO/NO-GO
- Limit this pass to at most 2 repair iterations.

## Verification Requirements
You must verify:
- touched server build/typecheck passes
- Tailnet `GET /api/v1/sections/summary/55?schoolId=1`
- direct DB proof for `SectionMirror`
- explicit before/after proof for stakeholder-critical placement fidelity, including:
  - whether section placement still depends only on generic seeded building topology
  - whether occupancy-backed or overlay-backed placement is now persisted where appropriate

## GO Criteria
Return `GO` only if:
- stakeholder-critical section placement no longer depends only on the generic seeded campus contract without an explicit reason
- the placement contract is auditable and persisted
- Tailnet sections summary reflects the repaired state

If stakeholder-critical sections still remain trapped in a non-faithful generic placement contract after the pass, return `NO-GO`.
