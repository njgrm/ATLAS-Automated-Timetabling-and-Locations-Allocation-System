# Gemini Execution Prompt: Phase 3 Student/Public Published Schedule UX One-Shot

## Objective

Turn the new public student schedule experience into a simple, mobile-friendly, no-login schedule browser that is easy for students and guardians to navigate.

This pass must build on the public route/runtime implementation once it lands.
Do not invent new data models.
Do not make the page feel like an internal scheduler tool.

## Out of Scope

Do not:

- rewrite backend published schedule logic
- add authentication
- redesign faculty or scheduler pages
- expose internal technical schedule metadata that public users do not need

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/phases/phase-5-publish.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- evidence from the public runtime/page implementation pass after it lands

Inspect directly:

- the new public published-schedule page(s)
- any shared schedule display components
- current faculty published schedule page for contract reference only

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tabs`
- `Popover`
- `Sheet`
- `Command`
- `motion`

## Facts To Treat As Settled

- this page is public and no-login
- section-first viewing is the primary browsing model
- it must reflect latest published truth only
- it must be usable on mobile
- it must support easy navigation and filtering

## Current UX Goal

A student or guardian should be able to:

1. open the page with no account
2. quickly find a section
3. narrow by grade or program if needed
4. understand the schedule without internal jargon
5. tell whether the page is showing the latest live published data or a saved copy

## Required UX Changes

### A. Make section lookup the first thing users see

Required:

- section-first lookup must be the primary control
- search should be immediate and forgiving
- section selection should feel obvious on mobile and desktop

### B. Add practical filters and navigation

Required:

- grade filter
- section search
- program or section-type filter where supported
- day-based narrowing or tabbing if useful
- easy reset/clear controls
- preserve useful filter state in the URL if the runtime pass already supports it

### C. Keep the page public-friendly

Required:

- use plain language
- avoid scheduler/admin wording
- avoid technical diagnostics in the main public path
- make the empty state and no-published state understandable

### D. Make schedule reading easy

Required:

- clear schedule cards/list/grid for day/time, subject, room, and teacher where appropriate
- readable mobile hierarchy
- scannable day grouping
- no dense inspector-style metadata blocks

### E. Honest source-state messaging

Required:

- if showing live latest published data, say so simply
- if showing saved public data, say so simply
- if no published schedule exists, explain what that means in layman’s terms

## Implementation Direction

- prioritize section lookup and day grouping
- favor simple controls and strong readability
- keep the page shareable and easy to return to
- make the design feel intentional and public-facing, not like a reduced admin panel

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify public page is mobile-friendly
- verify section lookup is easy
- verify filters materially improve navigation
- verify copy is plain-language and public-safe
- verify no scheduler-only diagnostics leak into the main public path

## Required Output

Return:

1. files changed
2. public schedule UX summary
3. section-first navigation summary
4. filters and QoL summary
5. source-state copy summary
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- a student or guardian can find a section quickly with no login
- the page is easy to navigate on mobile
- schedule reading is simple and public-friendly
- live vs saved vs unavailable states are easy to understand
