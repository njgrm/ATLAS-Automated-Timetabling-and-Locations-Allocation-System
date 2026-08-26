# Phase 3 Teachers + Sections EnrollPro Recovery And Home-Room Control Audit

Date: 2026-05-26

## Scope

This audit compares the current `Teachers` and `Sections` pages across:

- source-state honesty when EnrollPro is back online
- degraded/live messaging quality
- row/detail completeness
- `Sections` pagination responsiveness
- `Sections` home-room picker usability

## Live Verification

Verified on Tailnet on 2026-05-26:

- `POST /api/v1/auth/login`
  - admin login succeeded
- `GET /api/v1/runtime/context?schoolId=1`
  - `runtimeSource = "enrollpro-verified"`
  - `activeSchoolYearId = 55`
  - `activeSchoolYearLabel = "2026-2027"`
  - `upstream.reachable = true`
  - `upstream.verified = true`
- `GET /api/v1/sections/summary/55?schoolId=1`
  - returned `200`
  - `source = "atlas-mirror"`

## Main Findings

### 1. EnrollPro is back, but the UI can still look degraded

The backend runtime context is currently healthy and upstream-verified.

But the client helper in `atlas-client/src/lib/enrollpro-public-settings.ts` flattens ATLAS runtime context into:

- `source = "atlas"`

even when backend runtime truth is:

- `source = "enrollpro-verified"`

That means pages using `resolveActiveSchoolYearContext()` cannot distinguish:

- ATLAS runtime with live EnrollPro verification
- ATLAS runtime using only persisted fallback

This is the first reason the UI can continue to act like EnrollPro is still down.

### 2. `Sections` has a second source-truth issue

`atlas-server/src/services/section.service.ts` currently returns:

- `source = "atlas-mirror"`

for `getSectionSummary()` whenever mirror data exists, even if EnrollPro is back and runtime context is verified.

The route is operationally fine, but the source label is too pessimistic for the live state.

This is the second reason the `Sections` page remains stuck in non-live presentation.

### 3. `Teachers` and `Sections` are inconsistent in degraded wording

`Teachers` still uses more technical copy such as:

- `Teacher roster is available from ATLAS runtime cache while upstream verification is unavailable.`

`Sections` is not perfect, but it already contains a better plain-language pattern:

- `Working from saved data. EnrollPro is temporarily unreachable. You can keep working; your changes are safe and will sync automatically when the connection returns.`

So the user’s complaint is valid:

- `Teachers` is more technical
- `Sections` is calmer and clearer
- the two pages do not feel like they share one source-state language system

### 4. `Sections` is more complete than before, but still behind `Teachers` in control quality

`Sections` now has:

- stronger row identity
- section detail sheet
- section-first assigned-classes drilldown
- direct path into `Teaching Load`

But its home-room control is still much weaker than the best room-picking patterns already present elsewhere in the app.

### 5. `Sections` pagination lag is plausibly caused by the per-row home-room picker

`atlas-client/src/components/sections/SectionRow.tsx` renders a full Radix `Select` in every visible row.

Each row mounts:

- one trigger
- one full `SelectContent`
- every home-room option

The option list is currently:

- flat
- unsearchable
- ungrouped
- repeated in every row

This is a heavy pattern for pagination and row rerendering.

The lag complaint is credible.

### 6. The current home-room picker is not scheduler-friendly

Current issues:

- endless scroll
- no search
- no building grouping
- no map-aware affordance
- no consistent parity with the richer room picker patterns already used in timetable/room-request flows

The app already has better patterns available:

- `SearchableSelect`
- grouped room lists by building
- map-aware room selection flows in faculty room-request surfaces

`Sections` is not reusing that quality yet.

## Comparison Summary

### Teachers strengths

- stronger identity anchors
- better natural scanability
- better faculty detail drilldown
- clearer assignment breakdown once inside the profile sheet

### Teachers weaknesses

- degraded/live wording is too technical
- source-state decision is too dependent on flattened helper output
- can present saved data as if EnrollPro is still unavailable even after upstream recovery

### Sections strengths

- better section-first drilldown than before
- stronger detail drawer
- clearer path into assigned classes and teaching load
- some better plain-language outage messaging already exists

### Sections weaknesses

- source-state can remain pessimistic after EnrollPro recovery
- home-room picker is much weaker than timetable room pickers
- pagination likely pays too much cost for repeated option rendering
- room-choice UX is flat and low-discovery

## Pages Likely Affected By The Same Recovery-State Bug

Anything relying on `resolveActiveSchoolYearContext()` is at risk of stale degraded-state presentation because the helper currently collapses verified runtime context into generic `atlas`.

Confirmed users of that helper include:

- `Dashboard`
- `Audit`
- `Teachers`
- `Teaching Load`
- `Sections`
- `Subjects`
- `Room Schedules`
- `FacultyPreferences`
- `FacultyRoomPreferences`
- `MyDashboard`
- `MySchedule`
- officer preference pages

## Conclusions

1. The current EnrollPro-back-online behavior is not being communicated honestly across the app.
2. `Teachers` and `Sections` need a shared source-state language system.
3. `Sections` pagination and home-room interaction need a targeted frontend optimization pass.
4. The right fix is not another redesign.
5. The right fix is:

- repair the runtime/source-state contract first
- then upgrade the `Sections` home-room control to a lighter searchable grouped picker that matches existing room-selection quality
