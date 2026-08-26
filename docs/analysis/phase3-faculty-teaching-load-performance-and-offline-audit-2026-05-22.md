# Phase 3 Faculty / Teaching Load Performance And Offline Audit - 2026-05-22

## Verdict

The current `Teachers` and `Teaching Load` pages are usable, but they are not yet aligned with the project's stronger PWA/offline objective.

Two separate issues exist:

1. **Runtime performance and resilience**
2. **Offline/EnrollPro-down behavior**

These should be treated as the next dedicated workstream before assuming the workflow is closure-grade.

## Live Runtime Findings

### Measured live latency

Direct Tailnet probes showed:

- `GET /enrollpro-api/settings/public`: about `275ms`
- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`: about `794ms`
- `GET /api/v1/subjects?schoolId=1`: about `7ms`
- `GET /api/v1/sections/summary/55?schoolId=1`: about `12ms`

This means the visible slowdown when switching between `Teachers` and `Teaching Load` is mostly caused by:

- a repeated call to `fetchPublicSettings()`
- followed by the heavy `faculty-assignments/summary` request

### Intermittent instability

During live probing, `faculty-assignments/summary` also intermittently failed with:

- `SERVER_ERROR`
- `fetch failed`

That matters more than the raw latency because it means the experience is not just slow, it can also be inconsistent when upstream dependencies wobble.

## Current Client Data Flow

### Teachers

`Teachers` currently does:

1. `fetchPublicSettings()`
2. `GET /faculty-assignments/summary`

This happens on load and after sync.

### Teaching Load

`Teaching Load` currently does:

1. `fetchPublicSettings()`
2. `GET /faculty-assignments/summary`
3. `GET /subjects`
4. `GET /sections/summary/:schoolYearId`
5. later `GET /faculty/:id/homeroom-hint`

So page entry is a multi-request bootstrap with the same active-school-year lookup repeated again.

## Root Performance Causes

### 1. Repeated school-year bootstrap

Both pages independently call `fetchPublicSettings()` just to recover `activeSchoolYearId`.

That adds avoidable latency and extra EnrollPro dependency on every entry.

### 2. Heavy `faculty-assignments/summary` payload

The summary route is doing a lot of work:

- rebuilding roster index via section adapter
- reading all faculty mirrors
- reading all `facultySubjects`
- normalizing assignment scope
- reading ownership rows
- deriving load metrics for every faculty row

That is a reasonable truth endpoint, but expensive as a page bootstrap dependency for multiple views.

### 3. No dedicated cached/offline bootstrap for these pages

Unlike the room-request workflow, there is no real cached bootstrap path for:

- `Teachers`
- `Teaching Load`

When upstream is slow or unavailable, these pages currently degrade poorly.

## Offline / EnrollPro-Down Audit

## Current PWA Progress

The project has **partial offline behavior**, not a complete PWA-grade offline foundation.

### What exists now

- explicit online/offline state tracking in several pages and shell
- room-request outbox workflow in:
  - `atlas-client/src/lib/roomPreferenceOutbox.ts`
  - `FacultyRoomPreferences.tsx`
- some faculty-facing pages already present queued/sync/offline states
- shell sync badges react to offline state

### What does not exist yet

- no service worker registration found
- no `vite-plugin-pwa`
- no Workbox setup
- no manifest/service-worker pipeline found in current client package/config
- no shared cached bootstrap layer for settings, teachers, teaching-load summary, or sections
- no IndexedDB/local cache strategy for `Teachers` or `Teaching Load`

So the current app is **not yet an offline-first PWA** in the stronger sense required by the long-term objective.

## Behavior When EnrollPro Is Down

### Teachers page

Current behavior:

- tries `fetchPublicSettings()`
- then tries `faculty-assignments/summary`
- on failure, it sets:
  - `syncError`
  - `error`
- it shows wording like:
  - `EnrollPro bridge is currently unreachable. Displaying cached roster data.`

Problem:

- there is no real page-level cached roster bootstrap implemented here
- the page can show `"cached roster"` language even though this surface is still network-driven

So the wording is ahead of the implementation.

### Teaching Load page

Current behavior:

- also depends on `fetchPublicSettings()`
- then fetches summary + subjects + sections
- if one fails, it falls into a general error state

There is currently no equivalent offline queue/cached-load strategy for this page.

So if EnrollPro or upstream dependencies are down:

- the page does not remain meaningfully operational
- manual assignment work is not protected by a local-first sync model

## Objective Status Relative To PWA Goal

If the intended objective is:

- "ATLAS must function even if EnrollPro servers are down"

then current status is:

- **Partially achieved only for room-request workflows**
- **Not achieved for Teachers / Teaching Load**

## What Needs To Happen Next

### Performance

1. Stop re-fetching public settings on each page entry when active school-year context can be shared/cached.
2. Add a cached summary bootstrap for `Teachers` and `Teaching Load`.
3. Reduce or split the `faculty-assignments/summary` dependency if a lighter roster bootstrap path is possible.
4. Add clearer retry/fallback behavior around intermittent `summary` failures.

### Offline/PWA

1. Introduce a real PWA baseline:
   - service worker
   - cache strategy
   - manifest/runtime registration
2. Add cached bootstrap data for:
   - settings/public
   - teachers roster summary
   - teaching-load summary
   - sections summary
   - subjects
3. Decide which actions in `Teaching Load` must support:
   - read-only offline inspection
   - queued local edits
   - sync-on-reconnect
4. Remove misleading "showing cached data" copy until real cached data exists.

## Recommended Next Prompt Direction

The next prompt should combine:

- runtime performance optimization for `Teachers` / `Teaching Load`
- resilience against intermittent `faculty-assignments/summary` failure
- explicit offline-readiness audit and first implementation steps for those pages

## Outcome

You can continue iterating on these pages, but not by pretending the offline objective is already satisfied.

Current honest state:

- **runtime:** works, but summary bootstrap is heavy and somewhat fragile
- **offline/PWA:** meaningful implementation exists for room requests only
- **Teachers / Teaching Load offline support:** still not good enough
