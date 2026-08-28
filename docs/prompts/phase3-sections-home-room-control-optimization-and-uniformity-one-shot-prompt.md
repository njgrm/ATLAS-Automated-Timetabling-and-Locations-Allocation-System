# Gemini Execution Prompt: Phase 3 Sections Home-Room Control Optimization And Uniformity One-Shot

## Objective

Turn the `Sections` home-room control into a fast, scheduler-friendly room picker and bring `Sections` and `Teachers` into a more uniform UX language family without reopening page architecture.

This pass should continue from the current page designs.
Do not redesign the whole catalog system.

## Out of Scope

Do not:

- rewrite backend source-state contracts
- redesign `Teachers` or `Sections` from scratch
- add global browser scrollbars
- replace the section-first assigned-classes drawer
- reopen `Teaching Load`
- introduce raw native controls

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-sections-vs-subjects-teachers-ux-audit-2026-05-24.md`
- `docs/analysis/phase3-teachers-sections-enrollpro-recovery-and-home-room-control-audit-2026-05-26.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/ui/searchable-select.tsx`
- room-picking references already used elsewhere, especially:
  - `atlas-client/src/pages/RoomSchedules.tsx`
  - `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`
  - any map-aware room picker or grouped room selector already present in the repo

Use Context7 first if you need current guidance for:

- `shadcn/ui` popover/combobox patterns
- `motion`
- accessible searchable pickers

## Verified Current Problems

Treat these as real:

- `Sections` pagination feels laggy when moving page-to-page
- the current home-room control is likely a major contributor because every visible row mounts a full flat room `Select`
- the room picker is weak:
  - endless scroll
  - no search
  - no building grouping
  - no map affordance
- `Teachers` and `Sections` still do not feel like the same product family
- `Teachers` degraded copy is more technical while `Sections` already has some calmer language
- the recent source-honesty recovery work improved runtime truth, but wording still needs to respect this distinction:
  - EnrollPro connection is active
  - this page may still be using mirror-backed or saved payloads
  - do not phrase that as if EnrollPro is still down

The user wants:

- better room selection UX on `Sections`
- better performance
- better parity with richer room pickers already used in timetable flows

## Product Outcome

On a normal laptop viewport, the `Sections` table should remain compact and responsive while offering a much better home-room selection workflow.

Schedulers should be able to:

- open a section row
- find a room quickly by search
- understand room context by building
- avoid scrolling through a giant flat list
- jump to map-aware context if needed

The page should feel aligned with `Teachers` in polish and language quality, while still being section-first.

## Implementation Requirements

### A. Replace the current flat per-row room select with a lighter searchable control

Do not keep the current pattern where every row renders a heavy full-option `SelectContent`.

Move `Sections` toward a lighter control model such as:

- searchable picker
- grouped by building
- only rendering the large option list when needed

The chosen implementation must reduce repeated heavy row rendering.

Prefer a shared or lazy-rendered interaction model over repeated per-row full list mounting.

Acceptable directions include:

- one shared picker bound to the active row
- a compact row trigger that opens a lazy searchable grouped picker
- a lightweight sheet or popover that only renders the room list when invoked

Do not keep the current heavy row structure and merely add search on top.

### B. Reuse the app's better room-selection language

Use the same room-discovery quality already present in better room pickers elsewhere in ATLAS.

At minimum, support:

- search
- grouped rooms by building
- better label formatting than `Room - Building`

If a small map-related affordance can be added without bloating the row, include it.

That can be:

- a compact `View map` action
- a `Map` mode inside the picker
- or a route-out affordance to map context

Keep it lightweight.

At minimum, room labels should surface:

- room name
- building grouping
- useful secondary location context when available

### C. Preserve table density and no-scroll architecture

Do not make the rows taller.
Do not turn the page into a card grid.
Do not add large inline editors that consume vertical space.

This is a dense operator table.

### D. Tighten Teachers/Sections message parity

Where the two pages expose source-state or saved/live state, move them closer to one language family.

Do not reword backend truth.
Do make the page language feel consistent and calm.

Be careful with recovered live-state behavior:

- if EnrollPro connection is active but the page payload is still mirror-backed, say that plainly
- do not phrase that state as if EnrollPro is still down
- do not overclaim full live freshness unless the payload really supports it

### E. Improve `Sections` detail quality without clutter

If the home-room selection is moved out of the row's heaviest rendering path, use the regained calm to slightly improve scanability, not to add more badges.

Keep the current row identity and details drawer.

## Performance Expectations

The goal is not theoretical optimization.

The page should feel materially lighter when:

- paginating
- sorting
- opening a room picker
- changing home-room assignments

Avoid any solution that still mounts the full large room list in every visible row at all times.

Also avoid replacing one heavy pattern with another visually richer but equally expensive one.

## Verification Gates

Required:

1. `npm --prefix atlas-client run build`
2. preserve the no-scroll layout
3. no raw HTML native selects
4. verify the home-room picker supports search
5. verify rooms are grouped by building
6. verify the control is not still mounting the full large room list in every visible row
7. verify the page feels lighter when paginating than the current implementation
8. verify `Teachers` / `Sections` source-state language feels more uniform
9. verify the wording does not incorrectly say EnrollPro is down when connection is active

## Mandatory Tailnet Proof

Do not return `GO` without proving the new control behavior on Tailnet.

At minimum, prove:

- the `Sections` page still loads correctly
- home-room selection is searchable
- building grouping is visible
- the room-picker rendering path is materially lighter than the current repeated per-row full-list mount
- pagination or page-switch behavior is materially improved

If the picker is prettier but the page still feels heavy and laggy, return `NO-GO`.

## Required Output

Return:

1. files changed
2. chosen room-picker interaction model
3. how rendering cost was reduced
4. `Sections` versus `Teachers` wording/uniformity improvements
5. build result
6. Tailnet verification notes
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Sections` no longer relies on a weak endless-scroll home-room picker
- room selection now supports search and building grouping
- the page remains compact and table-first
- pagination/interaction feel materially lighter
- `Teachers` and `Sections` feel more aligned in operator-facing wording and polish
