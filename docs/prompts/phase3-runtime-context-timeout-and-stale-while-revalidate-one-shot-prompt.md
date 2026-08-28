# Copilot Execution Prompt: Phase 3 Runtime Context Timeout And Stale-While-Revalidate Recovery

## Goal

Eliminate the recurring `502`/slow-verification failures caused by runtime school-year resolution and restore instant warm navigation for pages that already have ATLAS-owned cached data.

This pass is a cross-stack resilience repair.

It must:

- stop ATLAS from hanging on EnrollPro school-year verification
- stop `Faculty`, `Sections`, and `/timetable` from blocking page render just because the browser is online
- preserve honest degraded-state labeling
- preserve ATLAS-owned cached data across navigation so repeat visits feel instant instead of re-cold-booting

Do not treat this as a cosmetic loading-state pass.
The bug is runtime-context dependency and cache policy.

---

## Why This Pass Exists

Current verified behavior in code:

1. The server runtime context path still performs an unbounded upstream fetch.
   - `atlas-server/src/services/runtime-context.service.ts`
   - `atlas-server/src/services/section-adapter.ts`
   - `resolveRuntimeContext()` calls `fetchEnrollProActiveSchoolYear()`
   - `fetchEnrollProActiveSchoolYear()` uses `fetch(...)` with no timeout or abort signal
   - if EnrollPro silently hangs instead of immediately refusing the connection, ATLAS can sit waiting until the proxy/browser gives up

2. The shared client school-year resolver has a usable cache, but key pages bypass it on every navigation.
   - `atlas-client/src/lib/enrollpro-public-settings.ts`
   - `resolveActiveSchoolYearContext()` already supports cache reads and stale fallback
   - but `Faculty.tsx` and `Sections.tsx` mount with `forceRefresh: navigator.onLine`
   - that means being “online” is currently treated as “must block on fresh verification now”

3. The current page bootstrap order still waits on runtime-context verification before showing cached ATLAS data.
   - `atlas-client/src/pages/Faculty.tsx`
   - `atlas-client/src/pages/Sections.tsx`
   - the cached roster/section previews are only considered after school-year resolution succeeds
   - so the page cannot instantly reopen from good local evidence when runtime context is slow

4. Navigation remounts recreate local page state.
   - `Faculty.tsx` and `Sections.tsx` keep their visible data in local component state
   - there is localStorage caching, but no route-lifetime in-memory shared view cache for these page payloads
   - so navigating away and back retriggers the blocking bootstrap path instead of reopening immediately from already-loaded memory

5. `/timetable` is especially exposed because it depends on the same runtime-context resolver before a very heavy page bootstrap.
   - `atlas-client/src/hooks/useTimetableData.ts`
   - even when data exists locally, runtime-context delay still hurts perceived load

So the current product is trying too hard to be live-first even when ATLAS already has enough local truth to remain operational.

---

## In Scope

- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- any tiny shared server helper needed for bounded upstream fetches
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- small shared client cache/helper additions if needed
- runtime/context consumer behavior only where needed for this exact resilience problem
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

## Out Of Scope

- timetable generator math
- subject ownership logic
- teaching-load behavior
- published schedule UI
- EnrollPro adapter redesign beyond bounded timeout/fallback behavior
- adding a large new client state library unless absolutely necessary

Do not introduce Zustand just to satisfy a generic “global store” idea if a smaller shared module-level cache solves the actual bug.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `GEMINI.md`

Inspect directly before editing:

- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- any existing page-cache helpers already used by Faculty/Sections/Teaching Load

---

## Required Product Decisions

Follow these decisions in this pass:

1. EnrollPro verification is advisory for runtime-year confirmation, not a reason to freeze ATLAS when persisted evidence already exists.
2. `navigator.onLine` must not be used as a proxy for “blockingly bypass all cache.”
3. Cached ATLAS data must render first when it is fresh enough, with verification happening in the background.
4. Degraded/stale labels must remain honest.
5. Warm navigation between pages must preserve visible data whenever the same school/year payload is already in memory.

---

## Required Changes

### 1. Add bounded timeouts to upstream runtime-year verification

Required outcome:

- `fetchEnrollProActiveSchoolYear()` must use an explicit short timeout
- use `AbortSignal.timeout(...)` or an equivalent bounded abort pattern
- target a short ceiling such as `3000ms` to `5000ms`, not browser/proxy-scale hangs
- if the upstream call times out or fails, ATLAS must fall back immediately to persisted evidence instead of letting the request hang

This is not optional.
The current unbounded fetch is a real availability bug.

### 2. Keep runtime context usable from persisted ATLAS evidence even when upstream verification is slow

Required outcome:

- `resolveRuntimeContext()` must still return a valid `atlas-persisted` result quickly when local evidence exists
- upstream verification should only upgrade the result to `enrollpro-verified` when it succeeds within the bounded window
- do not regress current evidence ranking behavior
- do not turn missing upstream verification into a `500`/`502` scenario when ATLAS has local evidence

### 3. Stop blocking cache reads on “online = force refresh”

Required outcome:

- remove the `forceRefresh: navigator.onLine` bootstrap pattern from `Faculty.tsx` and `Sections.tsx`
- bootstrap should prefer fresh cache first when available
- use a stale-while-revalidate flow:
  - render cached data immediately
  - verify/runtime-refresh in the background
  - update the page once the fresh request completes

Do not regress offline support.

### 4. Improve the shared client active-school-year resolver for stale-while-revalidate behavior

Required outcome:

- `resolveActiveSchoolYearContext()` must support a non-blocking cache-first path for warm page loads
- if a fresh local runtime-year cache exists, return it immediately without forcing the caller to wait on `/runtime/context`
- allow callers to request background verification separately instead of encoding “freshness” only through `forceRefresh`

Acceptable implementation directions:

- add explicit `preferCache` / `backgroundRefresh` style options
- or a similarly clear API that separates immediate cached return from later verification

Do not keep the current binary `forceRefresh` shape as the only practical control.

### 5. Add route-lifetime in-memory view cache for heavy page payloads

Required outcome:

- `Faculty` and `Sections` should reopen instantly on navigation when their last payload for the same school/year is already in memory
- localStorage cache may remain the durable fallback
- but there should also be a lightweight module-level or shared in-memory cache so React remounts do not always feel like cold boots

This should be small and pragmatic.
Do not introduce unnecessary architecture churn.

### 6. Apply the same non-blocking runtime-year behavior to `/timetable`

Required outcome:

- `useTimetableData.ts` must not block the whole timetable bootstrap on a needlessly forced runtime-context refresh when recent local context exists
- keep the data truth honest
- but prevent repeat navigation from paying the same runtime-year verification penalty every time

This pass is not the full timetable performance pass.
Only touch timetable here where runtime-context bootstrap is part of the 5-6 second recurring delay.

### 7. Keep degraded-state messaging honest and useful

Required outcome:

- if cached data is being shown while verification is pending or upstream is unavailable, the UI must say so clearly
- do not degrade into scary fatal errors when cached ATLAS data is still operational
- keep existing “cached / refreshing / degraded” concepts coherent across `Faculty`, `Sections`, and timetable bootstrap notices

### 8. Avoid duplicate verification waterfalls

Required outcome:

- do not allow one page mount to trigger multiple overlapping runtime-context requests for the same school
- if a shared in-flight promise or deduped request pattern is practical in the current resolver, use it
- repeated quick navigations should not spawn avoidable duplicate verification requests

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build`

### Manual / Runtime QA

Use the live Tailnet environment by default.

Verify at minimum:

1. `/api/v1/runtime/context` still returns a valid context when local evidence exists
2. `Faculty` opens from cache immediately on repeat navigation
3. `Sections` opens from cache immediately on repeat navigation
4. `/timetable` no longer blockingly waits on forced runtime-year refresh on every navigation
5. degraded labeling remains honest when upstream verification is unavailable
6. repeat navigations do not feel like full cold boot every time

If feasible in this environment, explicitly test a degraded-path scenario where upstream verification is unavailable or slow.
If a real outage cannot be induced safely, prove the timeout path through focused code-level verification and any existing test harness you can add reasonably.

### Evidence

Append only to `docs/verification/evidence-log.md`.

The evidence entry must state:

- whether bounded upstream timeout was added to runtime-year verification
- which client pages/hooks were changed
- whether `forceRefresh: navigator.onLine` bootstrap behavior was removed
- whether stale-while-revalidate cache-first reopen behavior was verified
- whether repeat navigation improved
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO

### GO only if

- runtime-year verification no longer hangs indefinitely on upstream silence
- ATLAS falls back quickly to persisted runtime evidence
- `Faculty` and `Sections` render cached data immediately when available
- repeat navigation is materially faster
- degraded-state messaging remains explicit and honest

### NO-GO if

- server runtime-context can still hang waiting on EnrollPro
- pages still use `navigator.onLine` to force a blocking refresh on mount
- cache is only used after a long failure timeout
- warm navigation still feels like a cold boot every time

---

## Completion Rule

This pass is successful only if the runtime-context path becomes resilient enough that EnrollPro unavailability no longer freezes everyday ATLAS scheduler pages when ATLAS already has local evidence.

Do not declare closure based only on “build passes.”
Prove the runtime behavior and repeat-navigation improvement.
