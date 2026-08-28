# Copilot Execution Prompt: Phase 3 Subject Contract TLE Retirement One-Shot

## Objective

Repair the stale subject-catalog contract that still treats `TLE` as a protected seedable core subject, even though the active MATATAG direction now uses the rotation-family exploratory rows as the real schedulable teaching-load model.

This pass should fix the catalog contract **before** more staffing-reconciliation work, so delete/archive behavior and subject meaning are no longer contradictory.

It must also remove the long-term hard-protected delete assumption from the subject domain. Curriculum can change, so subjects must remain fully maintainable by authorized operators.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-subject-contract-and-teaching-load-term-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-blocker-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `prisma/seed.js`
- `prisma/schema.prisma`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- any delete/archive/remediation logic for `/subjects`

## Facts To Treat As Settled

- `TLE` should no longer behave like a protected seedable BEC core subject if the live MATATAG contract is already modeling TLE through rotation-family exploratory rows.
- `TLE_AFA_EXP`, `TLE_ICT_EXP`, and `TLE_FCS_EXP` are the active TLE family members in the current live model.
- Department-first qualification remains the scheduler baseline.
- Manual Teaching Load placement remains authoritative.
- Long-term subject maintenance must support curriculum change; blanket permanent delete protection for curriculum rows is no longer the desired product direction.

## Scope

### In Scope

#### A. Retire stale protected-core treatment for `TLE`

Required:

- stop treating umbrella `TLE` as a protected seedable core row
- align seed/default subject contract and live service defaults accordingly
- ensure subject delete/archive logic no longer treats `TLE` as undeletable just because it is still marked `isSeedable`

#### B. Decide and implement the correct runtime role of the umbrella `TLE` row

Required:

- determine whether `TLE` should be:
  - inactive or deprecated
  - compatibility-only
  - or remain active but non-seedable and non-protected
- make that role explicit in code and live DB behavior

#### C. Replace hard-protected curriculum behavior with a maintainable delete contract

Required:

- remove the current `isSeedable => never deletable` assumption as the final product rule
- authorized operators must be able to fully delete subjects after explicit remediation and destructive confirmation
- preserve safety through:
  - blocker truth
  - cleanup preview and remediation
  - archive and cleanup flows where still useful
  - explicit destructive confirmation
- fix the stale `TLE` classification specifically as part of that broader maintenance reset

#### D. Verify subject-page remediation truth

Required:

- ensure the `Subjects` page delete/archive/remediation path behaves honestly after the contract reset
- if `TLE` is retired or demoted, the scheduler should no longer hit the misleading “core standard subject” delete block for it
- if any subject still cannot be deleted, the reason must be operational and remediable, not because the system treats it as permanently protected curriculum

### Out Of Scope

Do not:

- solve the whole staffing problem in this pass
- redesign `Teaching Load` UI in this pass
- re-open specialization mapping
- keep the current permanent hard-block model for curriculum rows

## Verification Gates

Required:

- server build
- client build if touched
- live Tailnet verification of:
  - `/subjects` row state for `TLE`
  - delete/archive behavior for `TLE`
  - delete/remediation behavior for at least one previously protected seedable subject row
- DB verification of the resulting `TLE` contract:
  - `isActive`
  - `isSeedable`
  - `rotationFamily`
  - any deprecation or compatibility flags if introduced

Do not return `GO` from local-only reasoning.

## Required Output

Return:

1. final decision for umbrella `TLE`
2. files changed
3. new subject delete and maintenance contract
4. `TLE` delete/archive/remediation behavior after the pass
5. live verification results
6. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `TLE` no longer behaves like a stale protected core row
- subject deletion is now maintainable for authorized operators and no longer blocked purely by legacy protected-core assumptions
- the live `Subjects` workflow now reflects the actual MATATAG/TLE contract
