# Prompt 5 — Navigation, Data Loading, Preview, and Commit Latency

## Objective

Flatten the first-visit waterfall, prevent unrelated reloads, and make preview/commit work cancelable, bounded, and immediately understandable.

## Preconditions

- Prompt 0 request waterfall and timings exist.
- Prompts 1–4 have stabilized client render costs.

## Required work

1. Define the minimum data required to render an accurate core grid.
2. Parallelize independent reads after the active school year is resolved, or introduce a narrowly shaped bootstrap endpoint if measured request overhead justifies it.
3. Render the core grid before secondary policy, requests, follow-ups, history, and diagnostic rails when correctness allows.
4. Remove room-request filter state from the core `loadAll` dependency path.
5. Deduplicate and cancel repeated requests; stale run, filter, preview, and background-refresh responses must not overwrite newer or explicitly selected state.
6. Add navigation-intent prefetch where it improves warm navigation without competing with the current page's critical work.
7. On drop, show immediate pending acknowledgement with explicit rollback/failure behavior.
8. Abort or supersede stale previews and limit preview concurrency to the latest relevant source/target.
9. Bound and version-scope preview caching.
10. Return updated violation/history metadata with commit or refresh independent resources concurrently. Preserve revision-effective and selected-run truth.
11. Replace generic full-page network failure with feature-specific recovery when minimum grid data is still available.

## Files to inspect first

- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- timetable generation/review route and service handlers
- `docs/reference/atlas-runtime-source-of-truth-map.md`

## Acceptance gates

- Cold core-grid interactive p75 ≤1.5 s on the agreed profile.
- Warm in-app grid interactive p75 ≤500 ms.
- A request-filter change causes zero core timetable reloads.
- No duplicate equivalent requests appear in the first-visit waterfall.
- Visual drop acknowledgement <100 ms; preview p95 <300 ms; successful settled state <800 ms on LAN.
- At most one relevant preview remains in flight; stale responses never win.
- Explicit historical run selection cannot be overwritten by delayed latest/background data.
- Optimistic failure rolls back visibly and explains the next action.
- Query-shaping changes prove both behavioral parity and reduced heavy-field/broad-query shape per `AGENTS.md`.

## Verification

- Run request-count/timing assertions for cold, warm, filter, refresh, selected-run, preview, commit, and network-failure scenarios.
- Add race tests for rapid target changes and run changes.
- Verify representative matching/missing cases if any backend query shape changes.
- Capture Tailnet timing; local-only evidence cannot close the phase.

## Out of scope

- Changing schedule generation, violation semantics, or publish gates.
- Loading less data by silently dropping required truth.
