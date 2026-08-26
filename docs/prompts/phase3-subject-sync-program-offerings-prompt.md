# Copilot Execution Prompt: Phase 3 Special-Program Subject Sync and Offerings Repair

## Goal
Make ATLAS subject activation/materialization explicitly refreshable from live upstream program offerings and mirrored section demand.

This prompt exists because:
- EnrollPro is now the source of truth for which special programs are actually offered
- live EnrollPro now has SPA/SPS sections upstream
- ATLAS still needs to own schedulable subject rows and minutes
- relying only on static seed assumptions is no longer safe for special-program subject state

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/section.service.ts`
- any route or service that currently triggers subject reconciliation from upstream

## Known Facts To Treat As Fact
- EnrollPro now has live SPA/SPS sections upstream.
- ATLAS owns schedulable subject definitions and minutes.
- ATLAS should not permanently hard-seed special-program offerings as if they were always active.
- Until SSE-level orchestration exists, ATLAS needs an explicit syncable contract for special-program subject state.

## Scope
In scope:
- special-program subject activation/materialization from upstream offerings and mirrored section demand
- explicit subject sync or refresh control if one is needed
- Tailnet verification of active special-program subject state after sync

Out of scope:
- full SSE orchestration
- timetable algorithm changes
- faculty placeholder redesign
- specialization alias cleanup beyond what is required for subject sync correctness

## Required Behavior
1. Audit current upstream-aware subject reconciliation behavior.
2. Audit whether operators can explicitly refresh subject contract state when EnrollPro offerings change.
3. Implement the minimum coherent sync/refresh path.
4. Ensure the post-sync active subject state matches live offered/mirrored program demand.
5. Re-verify on Tailnet.

## Required Direction
- Do not make EnrollPro the owner of ATLAS minutes, room requirements, or full subject semantics.
- Do make EnrollPro the owner of whether special programs are actually active this year.
- Do make ATLAS capable of explicitly syncing that reality into schedulable subject state.
- Prefer an auditable operator-triggered sync path now; SSE-level automation can replace or wrap it later.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - GO/NO-GO
- Limit this pass to at most 2 repair iterations.

## Verification Requirements
You must verify:
- touched server build/typecheck passes
- Tailnet proof of live upstream offered programs and section demand
- Tailnet proof of ATLAS active subject state after sync
- direct DB proof for active subject rows tied to SPA/SPS/STE/TLE special-program demand

## GO Criteria
Return `GO` only if:
- ATLAS has an explicit and auditable way to refresh special-program subject state from upstream reality
- active subject state after sync reflects live offered and mirrored demand
- this no longer depends on stale static assumptions alone

If special-program subject state still cannot be refreshed coherently from upstream changes, return `NO-GO`.
