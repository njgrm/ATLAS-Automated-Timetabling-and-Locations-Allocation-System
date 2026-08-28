# Gemini Execution Prompt: Phase 3 Sections Room Picker Follow-Up And Map Modal One-Shot

## Objective

Fix the remaining `Sections` home-room workflow regressions after the first room-picker optimization pass.

This is a narrow follow-up.
Do not redesign the `Sections` page.
Do not reopen backend source contracts unless absolutely required.

The goal is to make home-room assignment feel scheduler-friendly, viewport-safe, and honest about live versus saved state.

## Out of Scope

Do not:

- redesign the `Sections` table layout from scratch
- replace the section-first assigned-classes drawer
- move home-room editing to another page
- reintroduce heavy per-row full-list rendering
- add global browser scrollbars
- keep route-out map browsing as the primary room-selection workflow
- use raw native inputs or raw ad hoc buttons inside the picker workflow

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teachers-sections-enrollpro-recovery-and-home-room-control-audit-2026-05-26.md`
- `docs/analysis/phase3-sections-room-picker-followup-audit-2026-05-26.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionDetailsSheet.tsx`
- `atlas-client/src/App.tsx`
- room and map patterns already present in:
  - `atlas-client/src/pages/MapEditor.tsx`
  - `atlas-client/src/components/CampusMapEditor.tsx`
  - `atlas-client/src/pages/RoomSchedules.tsx`
  - timetable room-selection surfaces already in the repo

Use Context7 first if needed for:

- `shadcn/ui` command/combobox/popover/sheet/dialog patterns
- viewport-safe popover behavior
- accessible searchable lists

## Verified Problems

Treat these as confirmed:

- the room picker can extend below the visible workspace and is not comfortable to scroll near the bottom of the page
- the `Sections` page can fall back to `Working from saved data` again on navigation/re-entry even after EnrollPro has already recovered
- `Browse in Campus Map` is currently wired to the wrong route and is the wrong workflow for this page
- the current picker regressed into raw `<input>` and raw `<button>` internals instead of using project UI primitives

## Product Outcome

Schedulers should be able to:

- open a room picker from a section row
- search and browse rooms without the picker spilling below the workspace
- optionally open a richer map-based room browser without leaving `Sections`
- choose a room from that map surface and return directly to the current section workflow
- understand whether they are seeing verified live data, mirror-backed data, or saved data without the page falsely suggesting an outage after a successful recovery

## Implementation Requirements

### A. Make the compact room picker fully viewport-safe

The compact row-level picker must:

- stay within the visible page workspace
- capture wheel and trackpad scrolling inside the picker itself
- never force the user to scroll the underlying page to finish browsing rooms

Use a viewport-aware max-height strategy for the entire picker surface, not just the list fragment.

If the compact picker cannot safely support the full rich workflow alone, it may remain compact and delegate to a secondary map modal for richer browsing.

### B. Replace raw controls with project primitives

The follow-up must remove the raw picker internals and use ATLAS-standard primitives.

Do not leave:

- raw `<input>`
- raw list-row `<button>`
- ad hoc anchor shortcuts as the primary interaction path

Use the project's standard `@/ui/*` surfaces for:

- searchable input
- option list
- dialog/sheet/popover structure
- action buttons

### C. Stop false saved-data regressions on page re-entry

The page must no longer present `Working from saved data` as the visible operator truth merely because a warm local cache was used during reopen.

Required behavior:

- if the page is reopening from cache while live verification is still in flight, communicate that as a refresh or reconnecting state
- if runtime context is already verified and the fresh payload later confirms live source, the page should settle back to live cleanly
- do not phrase warm-cache reopen as if EnrollPro is down when it is actually reachable

The distinction should be:

- reconnecting / refreshing
- mirror-backed while connection is active
- truly working from saved data because live verification failed

### D. Replace route-out map browsing with an in-page map modal

Do not keep `Browse in Campus Map` as a separate route jump for this workflow.

Instead:

- add an in-page modal, sheet, or dialog launched from the room picker
- reuse the existing campus/building map direction already present in ATLAS
- keep the scheduler inside the `Sections` workflow

This surface should support:

- building-aware browsing
- room picking from map context
- clear current selection
- clear cancel/save behavior

### E. Add section-aware map quality-of-life

Inside the new map-based room browser, include enough context that schedulers can make a good room choice quickly.

At minimum provide:

- current section identity
- current assigned home room if one exists
- visible selected room state before confirming
- building-aware browsing
- easy way to clear the home room

Where it can be shown without clutter, also expose whether a room is already used as a saved home room by another section.

This should help the scheduler avoid blind picking.

### F. Preserve the compact table

Do not make section rows taller.
Do not move the whole room-selection workflow inline into the row.
Do not bloat the table with map previews.

The table remains compact.
The richer browsing mode belongs in secondary disclosure.

## Verification Gates

Required:

1. `npm --prefix atlas-client run build`
2. preserve no-scroll page architecture
3. verify no raw native select/input/button regression remains inside the final picker workflow
4. verify the compact picker remains searchable
5. verify the compact picker stays within the visible workspace and scrolls internally
6. verify the page no longer re-enters with a false `Working from saved data` state when EnrollPro is actually reachable
7. verify mirror-backed-but-connected messaging is distinct from truly offline/saved-data messaging
8. verify the old route-out map shortcut is removed or demoted behind the new in-page map modal
9. verify the new map modal can select a room and return to the section workflow cleanly

## Mandatory Tailnet Proof

Do not return `GO` without proving the behavior on Tailnet.

At minimum prove:

- the room picker opens and remains usable near the bottom of the visible workspace
- the list can be scrolled comfortably without the page becoming the scroll target
- navigating away from `Sections` and back does not incorrectly leave the page in a saved-data state when EnrollPro is reachable
- the in-page map browser opens from the room picker
- selecting a room from the map browser updates the current section workflow correctly

If the page looks nicer but still flips back to false saved-data wording or still ejects the user into another route for map browsing, return `NO-GO`.

## Required Output

Return:

1. files changed
2. compact picker viewport/scroll fix
3. saved-data re-entry state fix
4. in-page map modal interaction model
5. room-selection QoL added
6. build result
7. Tailnet verification notes
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the compact room picker is viewport-safe and internally scrollable
- the page no longer misreports a saved-data state after successful EnrollPro recovery
- the map browsing workflow stays inside `Sections`
- the home-room workflow is faster and calmer for schedulers than the current version
