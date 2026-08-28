# Copilot Execution Prompt: Phase 3 Scheduling Policy Persistence Fix

Run this before retrying:
- `docs/prompts/phase3-policy-cohort-room-readiness-prompt.md`

This is a narrow blocker-removal prompt. Do not treat it as a broad generator-readiness pass.

## Goal
Fix the live scheduling policy persistence path so the active school year has a real persisted `SchedulingPolicy` row and the Tailnet write path no longer fails with `POLICY_SCHEMA_DRIFT`.

This prompt exists because the broader Phase 3 policy/cohort/room readiness pass is currently blocked by one specific contradiction:
- live API `GET /api/v1/policies/scheduling/1/55` returns a policy object
- direct DB reads show **no persisted row** in `scheduling_policies` for `(schoolId=1, schoolYearId=55)`
- live `PUT /api/v1/policies/scheduling/1/55` fails with `POLICY_SCHEMA_DRIFT`

## Scope

In scope:
- `SchedulingPolicy` schema/write-path drift
- persistence bootstrap for `schoolId=1`, `schoolYearId=55`
- Tailnet API write verification
- direct DB proof that the row exists after the repair

Out of scope:
- cohort logic
- room shared-facility logic
- Teacher X workflows
- KPI closure claim

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase3-policy-cohort-room-readiness-prompt.md`
- `prisma/schema.prisma`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/routes/scheduling-policy.router.ts`
- `atlas-server/src/server.ts`

## Verified Blocker To Treat As Fact
As of `2026-05-18`:
- `GET /api/v1/policies/scheduling/1/55` returns a synthetic/fallback policy object with `id = -1`
- direct DB read shows `scheduling_policies` row for `(1,55)` is missing
- `PUT /api/v1/policies/scheduling/1/55` returns `POLICY_SCHEMA_DRIFT`

## Mandatory Behavior
- audit the policy read/write path first
- identify why the runtime can read a fallback object but cannot persist a real row
- implement the minimum coherent fix
- verify locally
- verify live on Tailnet
- verify directly in the DB
- if the first fix still leaves the row missing or the PUT path broken, iterate once more

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate intermediate probe reruns or obvious next steps.
- If a probe is noisy, narrow it silently and continue.
- Report only: blocker summary, repairs made, verification results, `GO`/`NO-GO`.
- Limit this pass to at most `2` repair iterations.

## Required Direction

### A. Fix the write path
- `PUT /api/v1/policies/scheduling/1/55` must stop failing with `POLICY_SCHEMA_DRIFT`
- if the error is caused by schema verification logic, make the logic reflect the real current schema
- if the error is caused by migration/runtime drift, repair the drift and prove it

### B. Fix persistence, not just fallback reads
- a synthetic fallback policy response is not enough
- the repaired system must create or persist a concrete `SchedulingPolicy` row for `(schoolId=1, schoolYearId=55)`

### C. Keep the persisted shape compatible with current controls
- the row must support the active policy/window model already in use by the scheduler
- do not regress the current Tailnet policy surface while fixing persistence

## Tailnet QA Requirements
Primary environment:
- `https://njgrm.buru-degree.ts.net`

ATLAS login:
- `identifier = 1000001`
- `password = AdminSY2026!`

Minimum live checks:
1. `POST /api/v1/auth/login`
2. `GET /api/v1/policies/scheduling/1/55`
3. `PUT /api/v1/policies/scheduling/1/55` with a valid payload
4. `GET /api/v1/policies/scheduling/1/55` again after the write

## Direct DB Verification Requirement
After the live write succeeds, prove directly from the DB-connected runtime that:
- a row now exists in `scheduling_policies` for `(schoolId=1, schoolYearId=55)`
- the persisted values match the active policy model

## Verification Gates
- touched build/typecheck
- diagnostics on touched files
- successful live `PUT` without `POLICY_SCHEMA_DRIFT`
- direct DB proof of the persisted row

## Evidence Update
Append evidence that records:
- exact root cause of the policy persistence failure
- exact files changed
- exact commands run
- exact live API results before/after
- exact direct DB proof before/after
- final `GO` or `NO-GO`

## GO / NO-GO
Return `GO` only if:
- live `PUT /api/v1/policies/scheduling/1/55` succeeds
- direct DB proof shows a real `scheduling_policies` row for `(1,55)`
- subsequent `GET` returns the persisted row, not only a synthetic fallback

Return `NO-GO` if:
- `POLICY_SCHEMA_DRIFT` still occurs
- the row is still absent in the DB
- or the API still depends on fallback-only behavior
