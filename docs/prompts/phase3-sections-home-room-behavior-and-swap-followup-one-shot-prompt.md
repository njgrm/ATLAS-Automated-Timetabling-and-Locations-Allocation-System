# Gemini Execution Prompt: Phase 3 Sections Home-Room Behavior And Swap Follow-Up One-Shot

## Objective

Finish the `Sections` home-room workflow properly.

The recent pass improved the container and map-modal shell, but it did not complete the actual scheduler workflow.

This follow-up must fix the remaining behavior gaps:

- confirmed unassign
- real building-view room selection
- synchronized selector state
- occupied-room swap handling
- reliable save behavior
- truthful reconnect-versus-saved messaging on normal page re-entry

## Out of Scope

Do not:

- redesign the full `Sections` page
- replace the section-first assigned-classes drawer
- remove the compact row-level room picker
- reopen the entire EnrollPro runtime contract across unrelated pages
- add global browser scrollbars
- keep the current map modal as a cosmetic shell only

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-sections-room-picker-followup-audit-2026-05-26.md`
- `docs/analysis/phase3-sections-home-room-behavior-gap-audit-2026-05-26.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionRoomMapModal.tsx`
- `atlas-client/src/components/CampusMap.tsx`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- timetable swap-confirmation references:
  - `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`

## Verified Failures

Treat these as confirmed:

- `Unassigned` still commits immediately and has no confirmation modal
- the map modal is not a true building-view room picker; the map only selects buildings and the room list is still doing the real work
- the left room selector and the map do not share a truly complete room-selection interaction model
- occupied rooms are only labeled, not handled through a swap workflow
- current save behavior does not provide a trustworthy swap-or-apply contract
- the `Working from saved data` issue still persists on normal page navigation because the current recovery logic only listens for the browser `online` event

## Product Outcome

Schedulers should be able to:

- unassign a section from its current room safely through explicit confirmation
- open the map modal and click a building to enter a building-specific room-selection view
- choose a room from either the left selector or the building view and see one shared active selection
- attempt to choose an occupied room and get a clear swap confirmation modal with visual summary
- save the result and see the section row update correctly
- navigate away and back without the page falsely claiming it is merely working from saved data when EnrollPro is actually reachable

## Implementation Requirements

### A. Add confirmed unassign behavior

Do not let `Unassigned` apply instantly.

Required behavior:

- choosing `Unassigned` from the compact picker must open a confirmation modal if the section currently has a room
- clearing selection from the map modal must use the same confirmation flow
- the confirmation copy must name the affected section and current room

If the section already has no room, no confirmation is needed.

### B. Turn the map modal into a real building-view selector

Clicking a building in the map must do more than just highlight it.

Required behavior:

- selecting a building must open or reveal a building-specific room view
- that building view must allow the scheduler to choose a room directly from the building context
- room picking should not rely solely on the left sidebar list

The modal should still preserve a compact left explorer, but the main map region must become meaningfully interactive for room selection.

### C. Synchronize left selector and map selection

The sidebar room list can stay.
But it must stay in sync with the map/building view.

Required behavior:

- selecting a room from the sidebar updates the building view selection
- selecting a room from the map/building view updates the sidebar
- one shared active selection state drives both surfaces

### D. Add occupied-room swap behavior

Current occupied-room labels are not enough.

Required behavior:

- if the scheduler selects a room already owned by another section, do not silently overwrite and do not pretend it is a normal save
- show a swap confirmation modal
- the modal should visually summarize:
  - current section
  - current room of that section, if any
  - target room
  - displaced section currently owning that target room
  - what that displaced section will receive after swap:
    - the source room, if the source section had one
    - or `Unassigned`, if the source section had none

Use the timetable swap confirmation style as the reference for clarity and seriousness.

### E. Make save behavior actually persist the chosen outcome

The final confirm action must perform a real persisted update.

At minimum support:

- normal direct assign
- confirmed unassign
- confirmed swap

You may use the existing batched home-room update contract if that is sufficient.

Do not leave the UI in a state where confirm only updates local selection chrome.

### F. Fix the false saved-data regression on page re-entry

The current logic only force-refreshes on the browser `online` event.
That is insufficient.

Required behavior:

- normal route re-entry while already online must not leave the page in a stale saved-data state
- warm-cache reopen should present as `Refreshing` or equivalent while live verification is in flight
- `Working from saved data` should only appear when live verification actually failed or the page truly had to stay on saved data

This fix must cover:

- the top badge
- the banner
- any other visible source-state messaging branch on `Sections`

### G. Keep design-system compliance

Do not keep raw picker/modal controls if project primitives are available.

The final workflow must stay inside the `@/ui/*` surface family as much as possible.

## Verification Gates

Required:

1. `npm --prefix atlas-client run build`
2. preserve no-scroll architecture
3. verify unassign now requires confirmation when a section currently has a room
4. verify selecting a building reveals a usable building-level room-selection view
5. verify the left selector and map/building view stay in sync
6. verify selecting an occupied room opens a swap confirmation modal
7. verify confirmed swap persists correctly
8. verify confirmed direct assignment persists correctly
9. verify normal page re-entry while EnrollPro is already reachable does not regress to false saved-data messaging

## Mandatory Tailnet Proof

Do not return `GO` without proving the workflow on Tailnet.

At minimum prove:

- direct room assignment works and visibly persists
- unassign works with confirmation
- occupied-room selection triggers swap confirmation
- confirmed swap updates both affected sections correctly
- leaving `Sections` and coming back while EnrollPro is still reachable does not falsely return the page to `Working from saved data`

If the modal looks better but save, unassign, swap, or re-entry truth is still wrong, return `NO-GO`.

## Required Output

Return:

1. files changed
2. unassign confirmation fix
3. building-view selection fix
4. sidebar and map synchronization behavior
5. occupied-room swap behavior
6. persisted save behavior
7. page re-entry source-state fix
8. build result
9. Tailnet verification notes
10. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- unassign is confirmed and works
- building view is a real room-selection path
- sidebar and map selection remain synchronized
- occupied-room assignment uses a real swap confirmation workflow
- final save persists the intended result
- the false saved-data regression is gone on normal page re-entry
