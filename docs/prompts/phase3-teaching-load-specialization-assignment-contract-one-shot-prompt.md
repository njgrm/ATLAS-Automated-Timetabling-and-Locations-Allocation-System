# Copilot Execution Prompt: Phase 3 Teaching Load Specialization Assignment Contract One-Shot

## Objective

After the runtime and placeholder-truth pass stabilizes `Teaching Load`, repair how specialization identity is modeled for scheduler operations and teacher-facing outputs.

This pass exists because the current live contract is still mixing three different concerns:

- schedulable umbrella subjects
- qualification baseline
- actual specialization identity taught by a teacher

Right now:

- `SPA_SPEC` and `SPS_SPEC` are only umbrella subjects
- EnrollPro-sourced specialization lists still exist as subject metadata
- some legacy specialization fields still remain in subject and constructor paths
- the system does not yet have a clean assignment-level way to say:
  - which `SPA_SPEC` section is really `MUSIC`
  - which `SPS_SPEC` section is really `BASKETBALL`
  - which teacher is teaching that exact specialization

This pass should fix the contract without exploding the subject catalog.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-post-rotation-audit-2026-05-23.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/analysis/phase3-teaching-load-bottleneck-audit-2026-05-22.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- any current API, type, or persistence model carrying:
  - `allowedSpecializations`
  - `rotationFamily`
  - `ownerDepartment`
  - teacher-facing assignment detail

## Facts To Treat As Settled

- Scheduler-facing qualification is department-first.
- Manual `Teaching Load` placement remains authoritative.
- `SPA_SPEC` and `SPS_SPEC` should remain umbrella schedulable subjects for the master-schedule layer.
- The stakeholder-facing master schedule does not require one top-level subject row per actual arts/sports specialization.
- Teacher-facing outputs and teaching ownership do need more precise identity than the umbrella label alone.
- `SCIENCE` and `TLE_ROTATION` are rotation families and should remain family-aware in load accounting.
- The old specialization-mapping page is out of the normal workflow.
- Do not reintroduce specialization-tier qualification gating for schedulers.

## Scope

### In Scope

#### A. Define assignment-level specialization identity

Required:
- design and implement a persisted assignment-level contract for specialization identity where needed
- this contract must support at least:
  - `SPA_SPEC`
  - `SPS_SPEC`
  - any other subject family where the scheduler needs to preserve a more specific taught identity than the umbrella subject code

At minimum, the contract should be able to capture:
- specialization code
- specialization label
- section-scoped teaching ownership context

#### B. Keep umbrella schedulable subjects intact

Required:
- do not explode `SPA_SPEC` and `SPS_SPEC` into many top-level active subject rows by default
- keep umbrella subjects as the main schedulable master-schedule entity
- preserve current subject catalog simplicity for schedulers

#### C. Demote subject-level specialization metadata from qualification control to reference metadata

Required:
- ensure EnrollPro-sourced specialization lists are treated as reference/options where appropriate
- do not let those lists quietly drive scheduler-facing eligibility tiers again
- if `allowedSpecializations` remains in the DB for compatibility, make its runtime role explicit and narrow

#### D. Make teacher-facing outputs specialization-aware

Required:
- ensure the assignment contract can be surfaced in teacher-facing views or exports
- the master schedule may keep normalized labels like `SPECIALIZATION`
- teacher-facing detail should be able to show the actual specialization identity if assigned

#### E. Audit TLE dynamic specialization remnants

Required:
- inspect the current `TLE_SPEC_*` / dynamic TLE specialization path
- confirm whether it should remain dormant, compatibility-only, or be formally retired from the normal contract
- do not let dormant dynamic specialization logic silently distort the current MATATAG TLE model

### Out Of Scope

Do not:
- rebuild the entire subject catalog around one-row-per-specialization
- reintroduce specialization mapping as a first-class scheduler page
- run broad staffing redistribution in this prompt
- rewrite shell/sidebar IA in this prompt

## Implementation Direction

- Master-schedule subject identity should stay simple.
- Teaching ownership identity can be more precise than master-schedule identity.
- Treat specialization as assignment metadata, not as the default top-level schedulable subject explosion.
- Keep EnrollPro specialization signals useful, but not scheduler-overwhelming.

## Verification Gates

Required:
- client build
- server build/typecheck
- DB verification of the new persisted specialization-assignment contract if a schema change is introduced
- live Tailnet verification of:
  - `SPA_SPEC`
  - `SPS_SPEC`
  - at least one teacher-facing assignment detail path
  - at least one subject/assignment workflow that preserves the umbrella subject while exposing more specific taught identity
- direct proof that:
  - schedulable umbrella rows remain intact
  - specialization identity can be persisted without exploding the subject list
  - scheduler-facing qualification remains department-first

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. specialization-contract problem repaired
2. files changed
3. persisted assignment-level specialization contract introduced
4. umbrella-subject preservation decisions made
5. EnrollPro specialization metadata role after the pass
6. TLE dynamic specialization path decision
7. live verification results
8. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- specialization identity is no longer forced into the wrong layer
- `SPA_SPEC` / `SPS_SPEC` remain simple umbrella schedulable subjects
- teacher-facing assignment detail can preserve more precise specialization identity
- department-first scheduler qualification is preserved

If not, return `NO-GO` with the exact remaining blocker.
