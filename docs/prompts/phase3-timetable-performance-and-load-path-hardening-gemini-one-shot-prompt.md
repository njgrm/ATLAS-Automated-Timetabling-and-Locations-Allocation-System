# Gemini Execution Prompt: Phase 3 Timetable Performance And Load-Path Hardening One-Shot

## Goal

Reduce `/timetable` load and interaction latency materially.

The current scheduler complaint is valid:

- the timetable page takes roughly `5-6 seconds` to load
- this is not only a first-load problem
- the same delay happens on repeated navigation back to `/timetable`

This pass is a performance and render-path hardening pass.

Do not redesign the page.
Do not reopen generator logic.
Do not hide data.

Make the current page load faster, re-render less, and stop blocking the main thread on every navigation.

---

## In Scope

- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts` only if needed for load-path stability
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- lightweight shared caching/helpers under the current client structure if needed
- `docs/verification/evidence-log.md`

## Out Of Scope

- timetable generator math
- backend API redesign
- published schedule UI
- teaching-load changes
- broad visual redesign of timetable workspace
- replacing the whole page architecture with a new shell

---

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/RightPanel.tsx`

---

## Current Verified Performance Problems

Treat these as already verified through code audit and live runtime investigation.

### 1. The page performs a heavy bootstrap on every mount

`useTimetableData.loadAll()` currently refetches on each page entry:

- runs
- subjects
- faculty
- buildings
- sections
- draft-board summary
- room-request summary
- then draft
- then violations

This means `/timetable` pays the full bootstrap cost on every navigation, not just first visit.

### 2. Large live payloads are being reparsed every time

Latest live run evidence is already large enough to matter:

- latest draft entries: `3425`
- latest unassigned rows: `30`
- latest violations: `920`

Those payloads are then converted into:

- `Map` structures
- filtered arrays
- grid indexes
- violation indexes
- pivot lists

all on the main thread.

### 3. `cellConflictMap` is too expensive and too eager

`useTimetableData.ts` currently computes `cellConflictMap` by scanning:

- all time slots
- all weekdays
- all active entries

and also repeatedly:

- filters `activeGridEntriesBase`
- builds `allIndex`
- recomputes faculty daily minutes
- does multiple `Map` lookups
- assembles strings and conflict objects for every cell

This happens in a `useMemo`, but the dependency list is broad enough that it still reruns too often.

This should not be a whole-grid recomputation for normal page loading and ordinary UI interaction.

### 4. The root workspace still causes a large render cascade

`ScheduleReviewWorkspace.tsx` currently has very high local state density.

Verified current count:

- `47` local `useState(...)` calls

It then builds very large context objects inline via an IIFE:

- `leftRailContentContext`
- `centerWorkspaceContext`
- `rightPanelContext`
- `headerContext`
- `dialogContext`
- `overlaysContext`

Because these objects are rebuilt each render, downstream memoization is weakened and many subtrees re-render unnecessarily.

### 5. Reference data is refetched even for secondary workspace transitions

`openMapWorkspace()` and `openBuildingWorkspace()` call `fetchReferenceData()` again.

That means the app can re-download:

- subjects
- faculty
- buildings
- sections

even when the user is only switching into a map/building view inside the same timetable workflow.

### 6. Dense side rails still attempt to render too much at once

The left rail currently renders large violation and unassigned structures eagerly.

Even after correctness work, it still creates expensive DOM trees and filtering work for:

- violation groups
- unassigned rows
- pinned queue/placement lists
- room-request lists

This adds CPU and render pressure on top of the initial fetch cost.

### 7. Microtext and visual density amplify the perception of slowness

Performance is the main issue, but the current timetable still compounds it with:

- `text-[0.625rem]`
- `text-[0.5625rem]`
- `text-[0.5rem]`

in dense rails and detail panels.

This is not the primary blocker for this pass, but do not make it worse while optimizing.

---

## Required Product Decisions

Follow these decisions exactly.

### 1. `/timetable` should feel warm on repeat navigation

Once the user has already visited the timetable for the active `(schoolId, schoolYearId)`:

- re-entering the page should reuse recent client-side reference data and recent run payloads where safe
- then refresh in the background

Do not force a full cold bootstrap on every route re-entry.

### 2. The page shell should load before the heaviest diagnostics

Primary scheduler workflow must render first.

Secondary data such as:

- room-request summary
- deep diagnostics
- large grouped lists

may load after the main timetable shell is already interactive.

### 3. Conflict computation should be scoped to active interaction

Whole-grid conflict precomputation is not justified for ordinary idle page load.

Preferred direction:

- compute conflict state only when needed for an active drag, keyboard placement, or targeted slot preview
- or at least compute only for visible/currently relevant cells instead of the full grid

### 4. Memoization must be structural, not decorative

Do not add random `useMemo` everywhere.

Memoize:

- context objects
- expensive indexes
- derived lists used by large children
- fetch/cache state keyed by active school year and run

in a way that actually stabilizes child props.

### 5. No regression in source-of-truth honesty

Do not fake data.
Do not delay critical truth so aggressively that the user sees the wrong run state.

Use cached-or-last-known data only with explicit refresh behavior that keeps the page honest.

---

## Required Changes

### 1. Add route-lifetime caching / reuse for heavy timetable bootstrap data

Required outcome:

- repeated navigation to `/timetable` for the same active school year should not always cold-fetch:
  - subjects
  - faculty
  - buildings
  - sections
  - latest draft
  - latest violations
- reuse recent in-memory data where safe
- then refresh in background

You may use a lightweight module-level cache or similarly scoped client cache.

Do not add a new global state library.

### 2. Split critical-first loading from secondary loading

Required outcome:

- load the minimum data needed for the shell and active timetable view first
- defer secondary payloads such as room-request summary and nonessential side diagnostics
- avoid blocking the initial page render on every ancillary request

### 3. Reduce `cellConflictMap` cost drastically

Required outcome:

- stop computing a full-grid conflict map for ordinary idle load
- compute conflicts lazily, incrementally, or only for the active interaction target
- avoid repeated whole-array scans of `activeGridEntriesBase` per cell where possible

This is one of the main targets of the pass.

### 4. Stabilize context object identity

Required outcome:

- replace the inline context-building IIFE in `ScheduleReviewWorkspace.tsx` with stable memoized context values
- ensure large memoized children are not being invalidated just because parent render recreated giant objects

### 5. Reduce repeated reference-data refetching inside workspace transitions

Required outcome:

- `openMapWorkspace()` and `openBuildingWorkspace()` should reuse already-loaded reference data when still valid
- they should not blindly trigger another full reference bootstrap every time

### 6. Soften large rail rendering cost

Required outcome:

- avoid rendering overly large rail lists all at once when not visible or not needed
- add pagination, chunking, or list-windowing where the current structure is too expensive

Keep this pragmatic.
Do not build a huge virtualized-list architecture unless necessary.

### 7. Preserve no-scroll architecture and current workflow

Required outcome:

- no browser-level scrollbar regressions
- no broken drag/drop behavior
- no broken left/right/center panel workflow
- no regression in pre-generation versus generated-run switching

---

## Verification Requirements

### Automated

- `npm --prefix atlas-client run build`

### Manual QA

Validate the real `/timetable` page.

At minimum:

1. first open still works correctly
2. repeated navigation back to `/timetable` is materially faster
3. the page shell becomes interactive earlier than before
4. drag/drop still works
5. section / faculty / room pivots still work
6. pre-generation and generated-run modes still work
7. map/building workspace transitions no longer feel like a full page cold boot

### Performance Evidence

You must capture before/after evidence in the pass.

Include at least:

- what was refetched before vs after
- whether repeated navigation reused cached timetable/reference data
- whether `cellConflictMap` was narrowed or deferred
- whether context identity stabilization reduced child rerenders

If you can capture rough timing observations in browser/manual QA, include them.

Do not claim exact performance numbers you did not measure.

---

## Evidence Log

Append only to `docs/verification/evidence-log.md`.

The entry must state:

- touched files
- which load-path changes were made
- which timetable subtrees were memoized/stabilized
- whether full-grid conflict precomputation was narrowed
- whether repeated navigation became materially faster
- any remaining known performance debt
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO

### GO only if

- repeated `/timetable` navigation is materially faster than before
- the page no longer feels like a full cold bootstrap on every re-entry
- render churn from giant context-object recreation is materially reduced
- heavy conflict computation is narrowed enough to stop dominating idle load

### NO-GO if

- the page still pays the same full bootstrap on every navigation
- full-grid conflict computation still runs eagerly for normal idle load
- or memoized children still re-render broadly because context props remain unstable

---

## Completion Rule

This pass is successful only if the timetable page becomes:

- faster to re-enter
- lighter to render
- less blocking on the main thread
- and still fully honest about current run data

