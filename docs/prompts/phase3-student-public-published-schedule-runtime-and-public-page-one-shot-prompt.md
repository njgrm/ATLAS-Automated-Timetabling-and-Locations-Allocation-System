# Copilot Execution Prompt: Phase 3 Student/Public Published Schedule Runtime And Public Page One-Shot

## Objective

Implement the real student/public published schedule experience on top of the existing published schedule APIs.

This must be:

- public and unauthenticated
- based on the latest published run only
- section-first
- mobile-friendly at the runtime/data-contract level
- honest about live vs saved state where client-side saved data exists

This pass must create the actual public route/page foundation, not just tweak APIs.

## Out of Scope

Do not:

- require login for student/public schedule viewing
- expose draft or unpublished schedule data
- redesign faculty or scheduler pages
- rebuild the existing published API family unless a narrow helper contract is genuinely needed
- start generator-readiness closure in this pass

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/phases/phase-5-publish.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`
- `ATLAS-PUBLIC-API.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/routes/published-schedule.router.ts`
- `atlas-server/src/services/published-schedule.service.ts`
- `atlas-client/src/App.tsx`
- current faculty published schedule page:
  - `atlas-client/src/pages/MySchedule.tsx`
- any public/non-auth route guards or layout shells

Use Context7 first if you need version-sensitive guidance for:

- React Router public routing
- Vite PWA/client caching patterns already in use

## Facts To Treat As Settled

- published schedule APIs already exist and are public
- faculty published schedule page now exists
- the next missing product surface is student/public viewing
- student/public viewing must be based on latest published truth only
- this must be no-login

## Required Product Outcomes

By the end of this pass:

1. there is a real public student schedule page
2. no authentication is required to open it
3. it is driven only by latest published schedule truth
4. section-first browsing is the primary workflow
5. the page supports easy navigation through search/filter/query state
6. no unpublished or draft timetable data leaks into the public experience

## Required Implementation Scope

### A. Add public route(s)

Required:

- add one or more public client routes for student/public published schedule viewing
- no auth required
- route(s) must be easy to share and re-open

Recommended shape:

- one public landing/browse page
- optional section-direct deep link behavior through query params or route params

### B. Latest published run only

Required:

- the page must resolve and show only the latest published schedule truth
- do not mix in draft, review, or faculty self-service room-request state
- if no published run exists, return and render an honest public-facing empty state

### C. Section-first public browsing

Required:

- section is the primary public/student lookup model
- support direct section lookup and browsing across all published sections
- support all student schedules being viewable from the latest published run

### D. Filters and quality-of-life navigation

Required:

- support section search
- support grade-level filtering
- support program-type or section-type filtering if available in the published dataset
- support day-based viewing or narrowing
- preserve shareable/reopenable URL state for primary filters when practical

Do not turn this into a scheduler debug screen.

### E. Saved-data continuity where practical

Required:

- if the public page has already loaded successfully once in the browser, allow last-good published data to reopen when EnrollPro or live network checks are unavailable
- clearly distinguish saved public data vs freshly loaded public data
- do not over-engineer offline write behavior here; this page is read-only

### F. Runtime-source honesty

Required:

- show honest state if the page is using:
  - latest live published data
  - last saved public data
  - no published data available

## Runtime and Architecture Rules

- controllers remain transport-only
- business logic stays in `/services`
- all changed or added endpoints stay under `/api/v1/...`
- if page dependencies or public runtime behavior changes, update:
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `ATLAS-PUBLIC-API.md` if the public contract changes

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- verify public route works without auth
- verify latest published truth only is shown
- verify no unpublished/draft data is exposed
- verify section-first browsing works
- verify search/filter state is usable and stable
- verify honest empty state when no published run exists
- verify saved-data reopen path if implemented
- Tailnet verification required

## Required Tailnet Proofs

1. Open the public page without login.
2. Confirm latest published schedule data is shown when a published run exists.
3. Confirm section-first lookup works.
4. Confirm filters/search materially improve navigation.
5. Confirm no-login access does not expose draft-only information.
6. Confirm honest no-published guidance if no published run is available.

## Required Output

Return:

1. files changed
2. public route/page implementation summary
3. latest-published-truth handling summary
4. filter and navigation support summary
5. runtime/source honesty summary
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- student/public users can view latest published schedules without login
- section-first navigation is clear and functional
- the page is based on published truth only
- public read behavior is honest and stable
