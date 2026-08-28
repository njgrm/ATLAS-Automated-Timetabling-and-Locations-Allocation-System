# Copilot Execution Prompt: Phase 3 Teaching Load Runtime + Placeholder Truth One-Shot

## Objective

Repair the live `Teaching Load` page after the post-rotation pass.

This pass exists because the latest live state has three critical problems:

- `Teaching Load` currently crashes in live Tailnet with:
  - `Cannot read properties of undefined (reading 'map')`
- the page now counts massive `Teacher X` placeholder ownership as if it were successful staffing coverage
- the top-line `assigned / total` signal is therefore operationally misleading even though the summary route is richer than before

This is not another redistribution pass.
It is a runtime-stability plus truth-segregation pass.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-post-rotation-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-bottleneck-audit-2026-05-22.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/lib/faculty-teaching-load-cache.ts`
- `atlas-client/src/types.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- any helper or view logic that computes:
  - coverage headline totals
  - placeholder/synthetic load display
  - rotation-family detail display

## Facts To Treat As Settled

- Scheduler-facing naming remains:
  - `Teachers`
  - `Teaching Load`
- Primary scheduler routes remain:
  - `/teachers`
  - `/teaching-load`
- The summary route now correctly exposes:
  - `coverageTotals`
  - `integrityDiagnostics`
  - rotation-aware load detail fields
- Live placeholder rows currently exist and are large:
  - `Teacher X / SCI_ES = 307.5h`
  - `Teacher X / TLE_FCS_EXP = 202.5h`
  - `Teacher X / SCI_CHEM = 131.3h`
- Placeholder ownership is currently making several subjects appear `FULL` even where real-faculty ownership is still weak.
- Manual scheduler placements remain authoritative.
- Placeholder coverage may remain as a recovery shim, but it must not masquerade as normal staffed load.

## Scope

### In Scope

#### A. Fix the live runtime crash first

Required:
- reproduce the current `Cannot read properties of undefined (reading 'map')` crash on live Tailnet
- identify the exact unsafe client path
- harden all new rotation/summary-derived array reads so stale or partial payloads cannot crash the page
- if cached snapshot shape is part of the crash, bump or invalidate the cache contract accordingly

Do not guess. Prove the crash is gone live.

#### B. Harden cached summary compatibility

Required:
- inspect `faculty-teaching-load-cache.ts`
- if the summary shape changed in the rotation pass, version or validate the cache payload so stale cache cannot poison `Teaching Load`
- reject or safely normalize incompatible cached snapshots

#### C. Separate real coverage from synthetic placeholder coverage

Required:
- stop using placeholder-owned pairs as if they were normal "assigned" coverage in the main operator headline
- preserve the full current-year denominator
- expose at least these three categories distinctly:
  - real faculty-owned pairs
  - synthetic placeholder-covered pairs
  - still-unowned pairs

This separation must be visible enough that schedulers cannot mistake placeholder coverage for real staffing closure.

#### D. Reframe placeholder teachers in the UI

Required:
- keep placeholder rows visibly synthetic
- do not let them dominate the normal teacher workflow
- do not present `307.5h` synthetic rows as if they were ordinary staffing loads
- ensure sorting, grouping, and headline metrics do not mislead operators because of synthetic rows

You may quarantine, collapse, or separately bucket synthetic coverage if that helps clarity.

#### E. Preserve the valid parts of the rotation pass

Do not regress:
- summary route truth fields
- rotation-family-aware load calculations for normal teachers
- route and label contract:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`

### Out Of Scope

Do not:
- re-open specialization mapping
- redesign the overall shell/sidebar
- run another broad redistribution strategy in this prompt
- remove placeholders entirely if they are still needed as a repair shim

## Implementation Direction

- Treat this as a truth-and-safety pass, not a balancing pass.
- Real-faculty staffing truth must remain primary.
- Placeholder rows should be diagnostic/support artifacts, not successful completion signals.
- Cache compatibility matters because this page already has degraded/offline behavior and can reopen from last-good snapshots.

## Verification Gates

Required:
- client build
- server build/typecheck if touched
- live Tailnet verification of:
  - opening `/teaching-load` from a clean browser state
  - opening `/teaching-load` with existing cached bootstrap present
  - opening `/teaching-load` after forced cache invalidation if cache version changed
- direct proof that the `map` crash is gone live
- live summary verification of:
  - real assigned coverage bucket
  - synthetic placeholder coverage bucket
  - remaining unowned bucket
- live verification that placeholder-heavy subjects such as:
  - `SCI_ES`
  - `TLE_FCS_EXP`
  - `SCI_CHEM`
  - `HG`
  are no longer presented as normal staffed success without qualification

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. root cause of the live `map` crash
2. files changed
3. cache-compatibility changes made
4. placeholder-truth separation changes made
5. headline/coverage-metric changes made
6. how synthetic `Teacher X` rows are now presented
7. exact live before/after proof for:
   - `SCI_ES`
   - `TLE_FCS_EXP`
   - one placeholder teacher row
   - one normal teacher row
8. verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- `/teaching-load` no longer crashes live
- stale cache no longer breaks the page
- placeholder coverage is clearly separated from real staffed coverage
- synthetic Teacher X rows no longer distort the main operator truth signal
- route and label contract remain on `Teachers` / `Teaching Load`

If not, return `NO-GO` with the exact remaining blocker.
