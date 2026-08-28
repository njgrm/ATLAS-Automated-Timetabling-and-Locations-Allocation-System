# Copilot Execution Prompt: Phase 3 Run-101 Unassigned Plotting Recovery (180 -> Closure)

## Goal
Fix the remaining run-101 unassigned blockers by addressing two verified root-cause lanes:
1. room-locality fallback dead-ends in HOME_ROOM_FIRST,
2. subject coverage gaps currently collapsed into generic `NO_AVAILABLE_SLOT`.

Do not claim closure from code inspection. Closure requires a fresh Tailnet rerun with evidence-backed deltas.

## Scope
In scope:
- generation placement-path fixes for room fallback under HOME_ROOM_FIRST
- unassigned reason taxonomy tightening (separate room dead-end vs faculty coverage dead-end)
- optional placeholder-enabled coverage path only if already supported by current Phase 3 contracts
- local regression tests and live Tailnet rerun verification
- evidence updates

Out of scope:
- unrelated timetable UX polish
- cross-phase feature expansion

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase3-generator-readiness-sequence.md`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts`

## Live Baseline (Verified)
Use completed run `101` as baseline:
- `assignedCount = 3310`
- `unassignedCount = 180`
- `hardViolationCount = 180`
- all hard rows are `UNASSIGNED_SECTION`
- all unassigned rows currently report:
  - `reason = NO_AVAILABLE_SLOT`
  - `roomAssignmentReason = FALLBACK_UNRESOLVED`
  - `homeRoomFallbackCause = HOME_ROOM_OCCUPIED`

### Root-Cause Forensics (Tailnet evidence)
From run-101 draft + map/sections diagnostics:
- affected sections: `13`
- observed timetable slots: `50`
- sections with `anyClassroomFreeSlots > 0` and `sameBuildingClassroomFreeSlots = 0`: `7`
- sections with no classroom availability at all: `0`

Section-subject pair classification (`180` total):
- `78` = cross-building feasible (room+faculty feasible in global inventory, but home-building path dead-ends)
- `64` = no subject candidate faculty observed in run assignments (coverage lane)
- `38` = same-building appears feasible in coarse diagnostics, still unassigned (needs tighter candidate-search and reason clarity)
- `0` = globally infeasible due absolute classroom exhaustion

Coverage-heavy subjects in no-candidate lane:
- `TLE_EXPLORATORY` (SPA `25`, SPS `20`)
- `SCIENCE` (SPA `7`, SPS `12`)

## Mandatory Implementation Direction

### A. Fix room-locality plotting dead-end
In `schedule-constructor.ts`, for HOME_ROOM_FIRST ordinary section placement:
1. Keep home room first.
2. Keep same-zone/same-building standard classroom fallback.
3. Add bounded cross-building standard classroom fallback before declaring unresolved, with explicit metadata markers (for example `crossBuildingFallbackUsed`, `fallbackTier`).
4. Preserve auditability by keeping `homeRoomFallbackCause` truthful and adding a specific fallback-chain trace in metadata.

Guardrail: this is a controlled fallback, not universal random rooming. Keep preference order deterministic.

### B. Split reason taxonomy (stop collapsing to NO_AVAILABLE_SLOT)
When placement fails, emit the most specific reason:
- room path exhausted (home/same-zone/cross-building tiers exhausted)
- faculty candidate exhaustion / no qualified faculty coverage
- policy/shift incompatibility

Update `generation.service.ts` and validator mapping so these reasons survive into draft + violations payloads.

### C. Handle coverage lane explicitly
For rows with true no-qualified-faculty conditions:
- if current Phase 3 placeholder flow is available and enabled, route through it;
- if not, keep unassigned but classify with explicit coverage reason (not generic slot reason), so blockers are operationally actionable.

### D. Keep severity policy honest
Do not silently downgrade unresolved hard blockers unless contract already permits it.
If severity is adjusted for Phase 3, encode an explicit marker in metadata and evidence log.

## Verification Loop (Required)

### Local
- run focused tests touching constructor + generation reason assembly
- run build/typecheck for touched app(s)

### Tailnet
Environment:
- `https://njgrm.buru-degree.ts.net`

Auth:
- `admin@deped.edu.ph` / `AdminSY2026!`

Checks:
1. Trigger fresh generation run for `schoolId=1`, `schoolYearId=55`.
2. Inspect latest completed run summary and draft.
3. Compare against run `101` on:
   - `assignedCount`, `unassignedCount`, `hardViolationCount`
   - unassigned reason breakdown
   - room fallback breakdown
   - subject/program breakdown for SPA/SPS/STE/REGULAR
4. Verify that previously cross-building-feasible blockers are no longer trapped as `FALLBACK_UNRESOLVED` with `HOME_ROOM_OCCUPIED`.
5. Verify no new regression in already-fixed lanes (specialization labels, capacity softening paths).

## Acceptance Gate
Prompt GO only if all are true:
- fresh completed run exists post-fix
- hard blockers decrease materially from `180`
- reason taxonomy is more specific than the baseline generic bucket
- evidence clearly separates residual room constraints vs faculty coverage constraints

Return NO-GO if:
- run cannot complete,
- hard blockers do not move,
- or diagnostics still collapse into generic `NO_AVAILABLE_SLOT` without actionable cause separation.

## Evidence Update Requirements
Append to `docs/verification/evidence-log.md`:
- exact run IDs compared
- exact endpoint checks performed
- before/after KPI table
- blocker-category table (room-locality vs coverage vs other)
- final GO/NO-GO with explicit blocker list
