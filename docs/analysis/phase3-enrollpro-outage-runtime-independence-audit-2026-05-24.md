# Phase 3 EnrollPro Outage and Runtime Independence Audit - 2026-05-24

## Purpose

This audit checks whether ATLAS can continue functioning when EnrollPro is unavailable, using only data ATLAS has already mirrored or cached at least once.

The immediate concern is not theoretical PWA language. It is current operator failure:

- no active school year when EnrollPro is down
- `Sections` does not load
- `Teachers` cache is slow to appear
- `Teaching Load` may not reopen
- ATLAS remains too dependent on EnrollPro at runtime even after it already has local snapshots and mirrors

## Main Verdict

ATLAS already has enough persisted data to survive many EnrollPro outages, but the runtime contract still behaves as if EnrollPro is required to grant access to that data.

The problem is mostly:

1. **bootstrap dependency**
2. **incomplete client-side cached bootstrap reuse**
3. **mirror-first versus upstream-first inconsistency**
4. **truthful degraded-mode reporting gaps**

So the current system is:

- **data-capable of degraded operation**
- but **not runtime-independent enough yet**

## What ATLAS Already Persists

Direct database inspection confirms that ATLAS already has durable local state for the current live school year:

- `faculty_snapshots` includes `schoolYearId=55`
- `section_snapshots` includes `schoolYearId=55`
- `section_mirrors` contains `82` rows for `schoolYearId=55`
- `scheduling_policies` contains a persisted row for `schoolYearId=55`
- `generation_runs` already contain multiple runs for `schoolYearId=55`

This matters because it means the outage problem is **not** "ATLAS has no data."

It is "ATLAS still asks EnrollPro first for runtime context even after ATLAS already has enough local context to operate in degraded mode."

## Current Failure Pattern

### 1. Active school year is still treated as EnrollPro-owned runtime context

The core client helper [enrollpro-public-settings.ts](/d:/ATLAS/atlas-client/src/lib/enrollpro-public-settings.ts:1) still resolves the active school year from:

- `fetchPublicSettings()`
- which calls `/enrollpro-api/settings/public`

It can fall back to cached local storage, but only if:

- a prior client-side cache exists
- and the cache path is reached in time

That means ATLAS still has no proper **ATLAS-owned runtime context contract** for:

- current school
- last known active school year
- freshness/staleness of that context

This is the biggest structural reason pages fail open when EnrollPro is down.

### 2. Several pages still hard-depend on `fetchPublicSettings()`

Current direct dependencies remain in:

- [Sections.tsx](/d:/ATLAS/atlas-client/src/pages/Sections.tsx:1)
- [Subjects.tsx](/d:/ATLAS/atlas-client/src/pages/Subjects.tsx:1)
- [Dashboard.tsx](/d:/ATLAS/atlas-client/src/pages/Dashboard.tsx:1)
- [RoomSchedules.tsx](/d:/ATLAS/atlas-client/src/pages/RoomSchedules.tsx:1)
- [Audit.tsx](/d:/ATLAS/atlas-client/src/pages/Audit.tsx:1)
- multiple officer/faculty preference pages
- [AppShell.tsx](/d:/ATLAS/atlas-client/src/components/AppShell.tsx:1)

So even where ATLAS has the data, the page often cannot begin because it still wants EnrollPro to tell it which school year to ask for.

### 3. `Sections` is especially weak

[Sections.tsx](/d:/ATLAS/atlas-client/src/pages/Sections.tsx:1) still:

- calls `fetchPublicSettings()` directly
- does not use the shared active-school-year resolver
- does not use a local last-good section bootstrap cache like `Teachers` and `Teaching Load`

This explains why `Sections` fails harder than it should during an EnrollPro outage.

### 4. `Teachers` and `Teaching Load` have cache logic, but bootstrap is still too network-gated

`Teachers` and `Teaching Load` already use:

- active-school-year cache helper
- last-good summary cache
- last-good subjects/sections cache for `Teaching Load`

But they still gate initial behavior through active school year resolution first.

That creates two practical issues:

1. cached content can appear too late
2. if active-school-year resolution is blocked or slow, the cached page still feels broken

This matches your observation that `Teachers` cache takes too long to show and `Teaching Load` may not reopen when EnrollPro is down.

## Server-Side Findings

### 1. Section summary is already mirror-first, but only if the school year is known

[section.service.ts](/d:/ATLAS/atlas-server/src/services/section.service.ts:1) reads `SectionMirror` first and only triggers sync when the mirror is empty.

That is good.

But it still depends on the client already knowing `schoolYearId`.

So the client bootstrap problem still blocks it.

### 2. Section summary source reporting is misleading

`getSectionSummary()` currently returns:

- `source: 'enrollpro'`

even when the response is purely mirror-based.

That is wrong for degraded mode and makes outage behavior harder to understand and audit.

### 3. Faculty sync has durable snapshot fallback

[faculty.service.ts](/d:/ATLAS/atlas-server/src/services/faculty.service.ts:1) does have a real cached fallback:

- if upstream fetch fails and a snapshot exists
- source becomes `cached-enrollpro`

This is the right direction and should be the baseline expectation for other EnrollPro-backed data domains.

### 4. `Teaching Load` still uses section adapter instead of mirror-first section service

[faculty-assignment.service.ts](/d:/ATLAS/atlas-server/src/services/faculty-assignment.service.ts:2398) builds its roster index using:

- `sectionAdapter.fetchSectionsBySchoolYear(...)`

instead of using a mirror-first section summary service.

This is safer than a pure live call because the adapter has snapshot fallback, but it is still not the strongest runtime-independence path.

If ATLAS already has valid `SectionMirror` rows for the requested year, `Teaching Load` should prefer the local mirror path rather than treating the adapter as the main bootstrap.

## Why The Current "Offline" Story Still Fails

The current degraded-mode story is incomplete because it relies on three separate layers that are not fully unified:

### Layer 1. Browser-local page caches

These exist for some scheduler pages:

- active school year local storage cache
- `Teachers` summary cache
- `Teaching Load` summary/subjects/section cache

But they are inconsistent across pages.

### Layer 2. ATLAS-persisted mirrors and snapshots

These exist for:

- faculty
- sections

and are the real durable source of degraded operation.

But the client does not have a single ATLAS-owned runtime-context endpoint built around them.

### Layer 3. EnrollPro public bootstrap

This is still used too broadly for:

- active school year discovery
- shell state
- page entry readiness

That is the current architectural choke point.

## What Proper Behavior Should Be

If ATLAS has successfully synced EnrollPro at least once for a school year, then during EnrollPro outage the system should still be able to:

- determine the last known active school year from ATLAS-owned runtime context
- open `Sections` from `SectionMirror`
- open `Teachers` from ATLAS mirror + last-good summary
- open `Teaching Load` from last-good summary plus local subject and section data
- distinguish:
  - live data
  - cached ATLAS snapshot
  - no cache available
- block unsafe mutating actions when upstream sync is unavailable, but still allow read-only inspection where data exists

When EnrollPro recovers, ATLAS should then:

- reattempt sync/update
- refresh mirrors/snapshots
- restore live status automatically or via explicit sync action

## Most Important Missing Contract

ATLAS needs an **ATLAS-owned runtime context resolver**.

This should not depend first on EnrollPro.

It should derive the last known usable runtime context from ATLAS-held data such as:

- persisted last-known active school year
- latest valid section snapshot
- latest valid faculty snapshot
- persisted scheduling policy year
- latest run year

Then it may optionally refresh that context from EnrollPro when available.

Without this, every page keeps asking EnrollPro whether it is allowed to use data ATLAS already owns.

## Recommended Next Steps

### 1. Build an ATLAS-owned runtime-context endpoint

Required purpose:

- return last known usable `schoolId`
- return last known usable `activeSchoolYearId`
- return freshness metadata
- indicate whether the context is live-refreshed or stale-cached

This should become the default client bootstrap contract instead of direct `fetchPublicSettings()` dependence.

### 2. Migrate scheduler-critical pages to that resolver

First priority pages:

- `AppShell`
- `Sections`
- `Teachers`
- `Teaching Load`
- `Subjects`
- `Dashboard`
- `Audit`

### 3. Add real cached bootstrap to `Sections`

`Sections` should gain:

- last-good section summary cache
- last-good home-room option cache
- immediate cached render path
- truthful degraded/offline banners

### 4. Make `Teaching Load` and `Teachers` show cache immediately when available

The current resolver should not block visible cached render on slow/unavailable settings bootstrap when stale but usable local context already exists.

### 5. Make server reads mirror-first where possible

Especially for read-only runtime recovery:

- prefer local mirrors/snapshots when sufficient
- only hit EnrollPro to refresh when needed
- label the response source honestly

### 6. Keep sync recovery explicit

When EnrollPro returns:

- allow explicit sync/update actions
- update ATLAS mirrors/snapshots
- restore live badges cleanly

## Relation To Teaching Load Closure

This outage/runtime-independence work should be prioritized before more `Teaching Load` polishing.

Reason:

- current teaching-load distribution and clarity work assumes the page opens reliably
- outage resilience is now a product objective blocker, not a nice-to-have

After runtime independence, the remaining `Teaching Load` closure work should continue with:

- special-program redistribution for `SPA_SPEC` / `SPS_SPEC`
- rotation-family clarity for `SCIENCE` and `TLE_ROTATION`
- a better operator view separating:
  - coverage shortage
  - underutilized teachers by department
  - redistributable special-program ownership

## Bottom Line

ATLAS already has enough persisted section and faculty data to behave far better during EnrollPro outages.

The current failure is that:

> ATLAS still relies on EnrollPro for runtime permission to use data that ATLAS already mirrors and stores locally.

That is the next architecture fix.
