# Copilot Execution Prompt: Phase 3 Runtime Context Live Promotion And Cache Honesty Fix

## Goal

Fix the regression introduced by the cache-first runtime-context recovery pass where `Faculty` and `Sections` keep presenting cached/degraded/offline-style state even after live data has successfully loaded.

This pass must preserve the good part of the previous repair:

- fast cache-first reopen
- bounded upstream timeout
- stale-while-revalidate behavior

But it must remove the false “Saved Data / atlas-mirror / offline-feeling” persistence when EnrollPro-backed verification is actually healthy.

---

## Why This Pass Exists

Current verified regression:

1. `resolveActiveSchoolYearContext({ preferCache: true, backgroundRefresh: true })` returns `source: 'cache'` immediately whenever cached school-year context exists.
2. `Faculty.tsx` and `Sections.tsx` store that first-return `yearContext.source` in a local variable and later use it to determine their visible source badge.
3. The pages then proceed to fetch fresh summary data successfully, but they do not re-promote the runtime/source badge once live verification has succeeded.
4. As a result, the user can be looking at fresh live data while the UI still says:
   - `Saved Data`
   - `Working from saved data`
   - `atlas-mirror`
   - or another degraded-sounding state

This is a source-honesty bug, not the original timeout bug.

### Concrete code paths already verified

- `atlas-client/src/lib/enrollpro-public-settings.ts`
  - `preferCache` returns cached context immediately with `source: 'cache'`
  - background refresh only updates cache for future callers; it does not inform the current caller
- `atlas-client/src/pages/Faculty.tsx`
  - uses the initial `yearContextSource` variable to decide final `dataSource`
  - if the initial value was `cache`, the page remains `cached` even after the main data request succeeds
- `atlas-client/src/pages/Sections.tsx`
  - requires both:
    - `yearContextSource` to be upstream-backed
    - `summaryRes.data.source === 'enrollpro'`
  - so a cached initial runtime context can incorrectly suppress `live` even when the section summary itself is live

The regression is made worse because:

- background refresh only fires when cache is stale, not whenever live promotion would be useful
- so a fresh local runtime cache can pin the page into “cache” presentation for its whole freshness window even while live requests are succeeding

---

## In Scope

- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/hooks/useTimetableData.ts` only if the same source-honesty bug exists there
- any small shared client helper needed to represent:
  - immediate cached result
  - later verified result / promotion result
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

## Out Of Scope

- changing the bounded upstream timeout added in the previous pass
- reverting cache-first reopen behavior
- adding a large client state library
- broad timetable performance work
- backend source-truth logic unless a tiny payload aid is absolutely required

Do not throw away stale-while-revalidate just because the current promotion logic is wrong.

---

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`

---

## Required Product Decisions

Follow these decisions:

1. Cache-first reopen is correct.
2. Source badges and degraded notices must describe the currently effective truth, not the first bootstrap step.
3. If live verification succeeds during the same page load, the visible state must promote from cached/degraded to live without requiring a manual refresh.
4. “Saved Data” / degraded wording must only remain while the page is actually operating on cache-only or mirror-only truth.

---

## Required Changes

### 1. Separate immediate cache-return behavior from final source-truth promotion

Required outcome:

- do not let the first cached `source: 'cache'` result permanently define the page badge
- the current caller must have a way to learn whether background or follow-up verification later succeeded

Acceptable implementation directions:

- return a richer runtime-context result shape that can expose:
  - immediate cached source
  - later verified source
- or provide an explicit promotion/revalidation helper
- or re-resolve non-blockingly after the main page data request completes

Do not keep the current “read one cached source and never upgrade it” pattern.

### 2. Fix `Faculty.tsx` source-state promotion

Required outcome:

- `Faculty` may still show cached data immediately
- but if the summary request succeeds and runtime-year verification is live/upstream-backed, the page must promote to `live`
- cached/degraded notice must clear when live truth is confirmed

Important:

- if the data request succeeds but runtime-year remains only ATLAS-persisted, keep the honest degraded label
- do not blindly label everything `live` just because the network request returned `200`

### 3. Fix `Sections.tsx` source-state promotion

Required outcome:

- do not require an initial cached year-context source to stay authoritative for the full page load
- if the section summary is truly EnrollPro/live-backed, and runtime verification has successfully promoted, show `live`
- only show `atlas-mirror` when that is the real current source
- only show `cached` when the page is truly operating from saved data/offline fallback

### 4. Do not restrict background re-verification to stale cache only if that prevents honest promotion

Required outcome:

- review the current `backgroundRefresh && !hasFreshCache` rule in `resolveActiveSchoolYearContext()`
- if this rule causes live promotion to remain stale for the whole cache freshness window, relax it

The fix may be:

- always allow a deduplicated non-blocking verification when `backgroundRefresh: true`
- or another small mechanism that preserves performance but still lets the current page promote honestly

Do not reintroduce blocking cold-boot behavior.

### 5. Keep fast warm navigation

Required outcome:

- repeat navigation must stay fast
- do not regress to the old blocking behavior
- any live-promotion recheck must be non-blocking and deduplicated

### 6. Audit timetable bootstrap for the same source-honesty issue

Required outcome:

- if `/timetable` or `useTimetableData.ts` is using the same cached-source-first pattern for visible status, fix it in this pass
- if not, leave it untouched and document that it was checked

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-client run build`

### Manual / Runtime QA

Use live Tailnet by default when reachable.

Verify:

1. `Faculty` still reopens instantly from cache on warm navigation
2. `Faculty` promotes from cached/refreshing to `live` automatically when live verification succeeds
3. `Sections` still reopens instantly from cache on warm navigation
4. `Sections` promotes from cached/atlas-mirror-style state to `live` automatically when live verification succeeds
5. degraded wording remains only when truly degraded
6. no blocking cold-boot behavior is reintroduced

If Tailnet is unavailable during implementation, document that clearly and still verify the promotion logic through code-path inspection and local/manual checks.

### Evidence

Append only to `docs/verification/evidence-log.md`.

Include:

- touched files
- whether cached-first reopen was preserved
- whether live promotion now happens automatically on successful verification
- whether `Faculty` and `Sections` source badges became honest again
- whether timetable was audited for the same issue
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO

### GO only if

- cache-first reopen still works
- `Faculty` and `Sections` automatically promote to `live` when appropriate
- cached/degraded notices no longer persist falsely after successful live verification

### NO-GO if

- pages still stay stuck in cached/degraded presentation after successful live verification
- the fix reintroduces blocking runtime-context fetches on every navigation
- source badges are still derived only from the initial cached bootstrap result

---

## Completion Rule

This pass is successful only if the user can get the speed benefit of stale-while-revalidate without the UI lying about being offline/degraded after live verification has already succeeded.
