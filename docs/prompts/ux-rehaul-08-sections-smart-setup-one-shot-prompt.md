# UX Rehaul Prompt 08: Sections SMART Setup One-Shot

## Mission

Redesign `/sections` as a SMART-family section readiness workspace.

The page should help a scheduling officer understand section roster readiness, home-room assignment progress, special-program mix, and what action to take next.

Do not touch `/timetable`.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`
- `atlas-shared-browser-qa` for live checks

Inspect:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- shared admin pattern from Prompt 07

## Current UX Findings

- Live sampling showed the first viewport collapses into `Search`, `Filters`, `Browse Map`, `Saved Data`, `Sync Sections`, and table headers without a strong page title or purpose.
- The page over-communicates maintenance controls and under-communicates the real task: make every section schedulable with a home room and assigned classes.
- `Saved Data` is too terse for mixed-literacy operators.
- `Browse Map` appears as a global action without enough context about how it helps home-room assignment.
- Empty state copy is minimal and does not provide enough recovery guidance.

## Scope

Allowed source files:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/*`
- shared admin pattern components from Prompt 07
- `docs/verification/evidence-log.md`
- `CHANGELOG.md`

Do not change backend APIs or timetable components.

## Mandatory Outcomes

### 1. Page Purpose And First Action

Add a clear page header:

- title: `Sections`
- purpose: explain that this page verifies section roster data and home-room readiness before scheduling
- primary action: `Sync sections` when live sync is available
- secondary action: `Review campus rooms` or `Browse room map`

The first action must be understandable in under 5 seconds.

### 2. Readiness Summary

Add compact inline stats for:

- total sections
- home rooms assigned
- sections needing room assignment
- queued offline edits, when present

Do not use large metric cards.

### 3. Source Honesty

Replace terse source labels with shared copy from Prompt 07:

- `Verified live`
- `Checking source`
- `Using saved data`
- `No saved data`

The tooltip or inline notice must explain whether home-room edits are currently writable, queued, or blocked.

### 4. Table And Row Communication

Keep the compact table, but improve row identity:

- section name and grade are the primary identity
- program type is visible but not shouty
- home-room state is visibly actionable
- details action clearly says what it opens
- room assignment conflicts or occupancy warnings use plain language

### 5. Section Detail Surface

Ensure the detail sheet/drawer answers:

- which classes belong to this section
- which classes are assigned to teachers
- which expected classes are still uncovered
- current home-room and building context
- special-program context, if any

Use the existing section-first assigned-class APIs. Do not invent new endpoints.

### 6. Responsive Behavior

At mobile/tablet widths, avoid a titleless table-first page.

Use stacked summary + toolbar + data list/table behavior while preserving local scroll.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/sections` desktop
- `/sections` mobile portrait
- `/sections` mobile landscape/tablet

Check:

- no global horizontal overflow
- source-state copy is clear
- home-room edit/read-only state is understandable
- details surface opens and has accessible title/description
- no native `<select>`, no raw `title`, no `<details>`

Evidence screenshot names:

- `qa-artifacts/playwright/20260530-admin-sections-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-sections-mobile-after.png`

## Required Output

Return files changed, UX findings resolved, source-state behavior, screenshots, build result, and `GO`/`NO-GO`.
