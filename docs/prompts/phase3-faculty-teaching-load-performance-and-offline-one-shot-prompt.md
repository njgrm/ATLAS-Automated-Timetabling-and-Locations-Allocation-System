# Gemini Execution Prompt: Phase 3 Teachers / Teaching Load Performance And Offline One-Shot

## Objective

Improve the runtime performance, degraded-state resilience, and offline-readiness baseline of the `Teachers` and `Teaching Load` pages.

This pass exists because live Tailnet investigation showed that:

- switching between `Teachers` and `Teaching Load` feels slow
- both pages repeatedly bootstrap through EnrollPro public settings
- `faculty-assignments/summary` is heavy and intermittently fails
- the current UI implies cached/offline support that is not yet honestly implemented

This is not a generic visual-polish pass.
It is a runtime and offline-readiness pass for two critical scheduler workflows.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-teaching-load-performance-and-offline-audit-2026-05-22.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-teaching-load-runtime-and-teachers-followup-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- any current cache/offline helpers already used by faculty-facing pages
- any service worker, manifest, or PWA-related client setup currently present
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`

## Context7 Preflight Summary

Before importing or introducing any PWA/runtime primitives:
- inspect local repo usage first
- use Context7 if any service-worker, storage, React Router, or shadcn behavior is uncertain
- do not guess browser caching or offline API behavior from memory

Record in your final output:
1. whether Context7 was used
2. which runtime/offline behavior it was used to confirm
3. which local project pattern you reused as the primary baseline

## Facts To Treat As Settled

- Scheduler-facing labels remain `Teachers` and `Teaching Load`.
- `Teachers` remains a roster-first page.
- `Teaching Load` remains the authoritative assignment-editing page.
- The current visible slowdown is mainly caused by repeated active-school-year bootstrap plus the heavy `faculty-assignments/summary` request.
- Live probing already showed that `faculty-assignments/summary` can intermittently fail.
- The app's PWA/offline objective is real and still open.
- Room-request flows already have partial offline/outbox behavior; `Teachers` and `Teaching Load` do not yet have an equivalent baseline.
- Do not claim cached/offline support unless a real cached/offline path exists.

## Scope

### In Scope

#### A. Reduce repeated bootstrap cost

Improve the startup path for `Teachers` and `Teaching Load`.

Required direction:
- remove unnecessary repeated `fetchPublicSettings()` lookups on every page entry when active-school-year context can be shared or cached
- avoid forcing the same expensive bootstrap sequence twice when navigating back and forth between these pages
- keep the implementation school-safe and school-year-safe

#### B. Improve `faculty-assignments/summary` resilience

Reduce the impact of intermittent summary failure on the scheduler workflow.

Required direction:
- add a calmer retry/fallback path for `Teachers` and `Teaching Load`
- avoid blank-or-crash behavior when summary bootstrap fails
- preserve last-good usable state where appropriate
- make degraded states explicit and operator-friendly

#### C. Add a real cached read path for `Teachers` and `Teaching Load`

Create the first honest offline/degraded-read baseline for these pages.

At minimum:
- cache the last-good bootstrap data needed to reopen `Teachers`
- cache the last-good bootstrap data needed to reopen `Teaching Load`
- allow users to inspect the most recent successfully fetched data when EnrollPro or the bridge is down
- clearly label when the user is viewing cached data instead of live data

This pass may be read-only for offline mode if full offline editing is not yet safe.

#### D. Audit and tighten page copy around offline/degraded state

Required:
- remove or correct any misleading `"showing cached data"` or similar claims where no real cache exists
- make offline/unreachable state language honest and scheduler-friendly
- do not surface raw infrastructure jargon when a simpler operator-facing explanation is enough

#### E. Preserve existing workflow authority

Do not regress:
- current `Teachers` inspection flow
- current `Teaching Load` manual-assignment authority
- current subject and section bootstrap dependencies needed for correct read behavior

If offline editing is not safely supported yet, the page must say so clearly instead of pretending otherwise.

### Out Of Scope

Do not:
- redesign the overall shell/sidebar in this prompt
- perform a broad subject/qualification domain rewrite in this prompt
- promise fully offline write-back if only read-only offline support is safely achievable now
- introduce fake/mock data to simulate live scheduling state

## Runtime And Offline Requirements

- Preserve the no-scroll architecture.
- Keep interactive controls on ATLAS UI primitives only.
- Keep the page usable during slow responses; do not freeze the whole surface behind a single spinner if partial last-good data is available.
- If cached data is shown, the UI must clearly distinguish:
  - live data
  - stale cached data
  - live fetch failure with no cache available
- If EnrollPro is down, `Teachers` and `Teaching Load` should still open in a useful read mode when cached data exists.
- If offline write support is not implemented in this pass, the UI must block or clearly disable unsupported edit actions while offline.

## Implementation Steps

1. Audit the current bootstrap path for `Teachers` and `Teaching Load`.
2. Identify which active-school-year and summary data can be shared or cached safely.
3. Add a real last-good cache strategy for these pages.
4. Add degraded-state and retry behavior around summary/bootstrap failures.
5. Update page copy so offline/cached messaging is truthful.
6. Verify both pages under:
   - normal live load
   - simulated bridge or offline failure
   - cached-data reopen path
7. Record exactly what now works offline and what still does not.

## Verification Gates

Required:
- client build
- any touched server build/typecheck needed by the implementation
- live Tailnet verification of:
  - `Teachers` initial load
  - `Teaching Load` initial load
  - navigation back and forth between both pages
  - degraded behavior when `faculty-assignments/summary` or public settings bootstrap fails
- direct verification that cached/offline copy is honest
- direct verification that a last-good cached read path actually exists if claimed

Manual/offline checks required:
- temporarily simulate loss of EnrollPro/public-settings or bridge reachability
- reload `Teachers`
- reload `Teaching Load`
- confirm whether the page opens with last-good cached data, explicit stale labeling, or a hard-blocked error state
- state clearly which one now happens

Do not return `GO` from local-only reasoning.

## Required Output

Return:
1. live performance bottlenecks identified
2. files changed
3. bootstrap/performance changes made
4. summary-failure resilience changes made
5. offline/cached-read changes made
6. exact live degraded/offline behavior after the pass
7. what still does not work offline
8. verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- `Teachers` and `Teaching Load` bootstrap more efficiently than before
- repeated school-year/bootstrap cost is materially reduced or clearly centralized
- intermittent summary failure no longer collapses the whole operator experience when last-good data exists
- cached/offline messaging is honest
- there is a real, verified last-good offline/degraded read path for these pages
- the final output explicitly states what remains unsupported offline

If not, return `NO-GO` with the exact remaining blocker.
