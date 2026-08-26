# Gemini Execution Prompt: Phase 3 Published Schedule Refresh And Stale Cache Fix One-Shot

## Goal

Fix the published schedule surfaces so they actually reflect the latest published run after publish.

Current live reality:

- the backend published endpoint is already returning the correct latest published run
- but the browser can still show an older run on `/public/schedules`
- manual refresh is not reliably correcting it

This is a stale-client-data bug, not a publish-lifecycle bug.

## Why This Pass Exists

Current verified live findings:

1. Live backend truth is correct
- `GET /api/v1/schools/1/schedules/published` currently returns:
  - `source.runId = 126`
  - `source.schoolYearId = 55`
  - valid `publishedAt`

2. The latest run is actually published
- `GET /api/v1/generation/1/55/runs/126` shows:
  - `summary.isPublished = true`
  - `summary.publishedAt` is populated

3. Public UI can still show stale published data
- the user observed the page still showing an old run after manually publishing the newer one

4. The most likely current culprit is client-side caching
- `atlas-client/public/sw.js` currently includes:
  - `/api/v1/schools/:id/schedules/published`
  in `FACULTY_API_PATTERNS`
- those requests are handled by `networkFirst(..., { timeoutMs: 3000 })`
- if the published payload does not resolve within `3s`, the service worker can serve an older cached response
- the React page then treats that as a successful live response

5. There is also a secondary local snapshot fallback
- `PublicPublishedSchedule.tsx` uses localStorage snapshot helpers
- that fallback is only supposed to be used for offline/5xx cases
- but if the service worker serves stale cached API data as a normal `200`, the page cannot distinguish it from true fresh live data

This means a user can publish a new run successfully and still keep seeing an old published schedule.

---

## In Scope

- `atlas-client/public/sw.js`
- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MySchedule.tsx` if the same stale published-data pattern applies there
- `atlas-client/src/lib/public-schedule-cache.ts` only if needed
- `docs/verification/evidence-log.md`

## Out Of Scope

- backend publish lifecycle changes
- timetable generator logic
- teaching-load changes
- broad redesign of published schedule pages

---

## Required Changes

### 1. Stop the service worker from trapping published schedule freshness behind stale API cache

Required outcome:

- the latest published schedule endpoint must not silently serve stale cached run data after a successful publish

Safe acceptable directions:

- remove published schedule endpoints from the service-worker API cache list
- or give them a stricter network strategy that does not silently prefer old cached responses on short timeout
- or version/invalidate the cache properly when a newer published run is available

Preferred direction:

- do not service-worker cache published schedule API responses as if they were faculty preference/offline workflow data

### 2. Preserve explicit saved/offline fallback honesty at the page level

Required outcome:

- if the page must fall back to a saved snapshot, it must remain visibly marked as saved/stale
- the page must never label stale cached published data as if it were unquestionably live current publish truth

### 3. Make refresh behavior actually revalidate published truth

Required outcome:

- pressing refresh on `/public/schedules` must force a real live revalidation path
- after a newer run is published, the page must update to the latest `source.runId`

### 4. Keep no-published-run handling intact

Required outcome:

- do not regress the honest `PUBLISHED_RUN_NOT_FOUND` empty state
- do not synthesize draft/review data into published views

### 5. Check whether the same stale pattern affects `/my/schedule`

Required outcome:

- if the faculty published schedule route is exposed to the same stale published cache behavior, fix it too
- if not, document why not

---

## Verification Requirements

### Automated

- `npm --prefix atlas-client run build`

### Live Verification

Using the current live Tailnet environment:

1. verify the published API currently returns the latest run id
2. open `/public/schedules`
3. verify the displayed run id matches the API run id
4. trigger refresh and verify it still matches
5. if `/my/schedule` is touched, verify the same there

Evidence must explicitly state:

- whether the service worker caching rule for published schedule endpoints changed
- whether stale cached published data can still masquerade as fresh live data
- whether `/public/schedules` now shows the actual current latest published run

---

## Evidence Log

Append only to `docs/verification/evidence-log.md`.

Include:

- touched files
- whether published endpoint SW caching was removed or changed
- whether page-level saved snapshot fallback behavior stayed honest
- live API run id vs displayed run id after fix
- GO / NO-GO verdict

---

## GO / NO-GO

### GO only if

- `/public/schedules` reflects the real current published run
- refresh actually revalidates instead of pinning stale run data
- stale saved snapshot state remains explicitly labeled when used

### NO-GO if

- the service worker can still silently pin old published run data
- the public page can still show stale run ids after successful publish

