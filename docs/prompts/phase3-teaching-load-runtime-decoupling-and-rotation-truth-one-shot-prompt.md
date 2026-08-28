# Copilot Execution Prompt: Phase 3 Teaching Load Runtime Decoupling and Rotation Truth One-Shot

## Objective

Finish the remaining backend/runtime closure for `Teaching Load` by fixing the slow control path and making rotation-family assignment effects explicit enough for the frontend to show honestly.

This pass is not a broad redesign.
This pass is not a return to placeholder recovery or stale-ownership cleanup.

It is a focused runtime and truth pass for:

- `Audit` / staffing-needs latency
- `Auto-Fill` latency
- mirror-first outage behavior
- explicit rotation-lane assignment semantics for `SCIENCE` and `TLE_ROTATION`

## Out of Scope

Do not:

- redesign the `Teaching Load` page layout
- reopen stale-ownership reconciliation
- reintroduce `Teacher X`
- rewrite the current subject catalog again
- explode rotating subjects into separate top-level term-specific subject rows

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-post-outage-discrepancy-audit-2026-05-24.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Audit.tsx`

## Facts To Treat As Settled

- stale ownership is fixed and must stay fixed
- `SCIENCE` and `TLE_FCS_EXP` are the only remaining live staffing blockers
- live shortage is now concentrated as:
  - `SCIENCE`: `117 raw`, `82 concurrent`
  - `TLE`: `3 raw`, `3 concurrent`
- `SPA_SPEC` and `SPS_SPEC` are covered, but low-load `MAPEH` redistribution still needs better operator support
- teacher-side load math is already rotation-family aware
- staffing-needs math is already rotation-family aware
- the main latency problem is now runtime source selection, not the pure shortage algorithm itself

## Live Problem To Fix

Current live timings show:

- `GET /faculty-assignments/summary`: about `153-279ms`
- `GET /sections/summary/:schoolYearId`: about `12-57ms`
- `POST /faculty-assignments/report/staffing-needs`: about `10.5s`
- `POST /faculty-assignments/auto-fill` with `previewOnly=true`: about `10.7s`

This means the slow controls are not blocked by the fast mirror-backed section summary route.

They are still blocked by EnrollPro-first section fetch attempts inside backend services before cached/mirrored ATLAS data is used.

## Product Outcome

After this pass:

- `Audit` and `Auto-Fill` should remain usable and materially faster while EnrollPro is down
- teaching-load staffing and automation services should use ATLAS-owned current-year section evidence first when runtime context is degraded or upstream is unreachable
- the page should still communicate whether data is upstream-backed or degraded
- manual assignment logic should expose a clean backend truth model for:
  - raw row ownership impact
  - concurrent weekly load delta
  - rotation-family / lane identity

## Implementation Requirements

### A. Remove the EnrollPro-first timeout tax from teaching-load control actions

Investigate and fix the current slow path in:

- staffing-needs
- auto-fill
- special-program redistribution preview
- any other `Teaching Load` control action still using the same section-source pattern

Required behavior:

- if ATLAS already has current-school-year mirrored or snapshotted section evidence, these operations must not wait for an upstream EnrollPro failure before using it
- use the same runtime philosophy as the fast mirror-backed section summary path
- preserve source metadata so the UI can still say whether the result is:
  - upstream-backed
  - ATLAS cached / degraded
  - unavailable

Do not silently fake `live` when the result is degraded.

### B. Unify teaching-load control section sourcing

Today multiple services duplicate fallback logic around:

- `sectionAdapter.fetchSectionsBySchoolYear(...)`
- mirror fallback
- snapshot fallback

Refactor toward one explicit helper or shared contract for teaching-load control reads.

That contract must:

- prefer active current-school-year ATLAS section evidence first when runtime context is degraded
- avoid re-triggering a slow upstream-first wait for every staffing or automation control
- preserve:
  - `source`
  - `fallbackReason`
  - `isStale`

### C. Keep coverage and staffing truth aligned

Do not regress:

- live `summary`
- live `coverage/summary`
- live staffing-needs
- section-first assigned-class endpoints

The shortage numbers after this pass must still reflect the same blocker shape unless a genuine logic bug is found.

### D. Make rotation-lane semantics explicit in backend read models

The frontend still lacks a clean operator-facing contract for manual placement preview.

Add or expose enough backend truth so the frontend can show, per relevant assignment interaction:

- `rotationFamily`
- a stable lane or section-family identity
- `rawMinutes`
- `concurrentDeltaMinutes`
- whether the assignment expands current weekly demand or only joins an already-owned family lane

This is especially important for:

- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `TLE_AFA_EXP`
- `TLE_ICT_EXP`
- `TLE_FCS_EXP`

Do not create a separate full teaching-load record per term.
Keep one canonical adjusted weekly load model.

### E. Preserve the current canonical load model

The desired behavior remains:

- one canonical adjusted teacher load
- family-aware weekly collapse for rotation subjects
- optional operator visibility into per-family / per-term meaning

Do not switch to three separate canonical teacher loads for Term 1, Term 2, and Term 3.

### F. Tighten special-program operational truth where needed

If current live `summary` or related read models still underexpose `SPA_SPEC` / `SPS_SPEC` ownership in a way that weakens scheduler redistribution workflows, fix that contract while staying within current subject/assignment boundaries.

Do not reopen the subject catalog.
Do not remove current assignment-level specialization identity.

### G. Preserve degraded writable behavior

Do not regress current degraded writable-mode work.

If this runtime decoupling work touches source-state or write gating, preserve:

- writable ATLAS-owned assignment actions in degraded mode when local evidence is sufficient
- blocked destructive/reset actions where live-only safety is still required

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- live Tailnet verification with EnrollPro still down, if it remains down at execution time

Required live checks:

1. measure or compare:
   - `POST /faculty-assignments/report/staffing-needs`
   - `POST /faculty-assignments/auto-fill` with `previewOnly=true`
   after the fix
2. verify these no longer stall on an upstream-first timeout path when ATLAS already has section evidence
3. verify returned source metadata remains honest
4. verify staffing shortage still reflects the same real blocker shape unless a real bug is fixed:
   - `SCIENCE`
   - `TLE_FCS_EXP`
5. verify section-first endpoints still work
6. verify degraded writable `Teaching Load` still opens
7. verify no stale-ownership metrics regress

## Required Output

Return:

1. files changed
2. runtime-source selection changes
3. teaching-load control performance changes
4. rotation-lane contract additions or adjustments
5. any special-program truth-contract adjustments
6. live timing comparison before vs after
7. live data verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Audit` / staffing-needs and `Auto-Fill` no longer pay the current EnrollPro-first timeout tax when ATLAS local evidence exists
- degraded/cached source honesty is preserved
- `SCIENCE` / `TLE_ROTATION` load truth is not regressed
- the frontend now has a clean enough backend contract to explain raw vs concurrent rotation-family assignment impact
