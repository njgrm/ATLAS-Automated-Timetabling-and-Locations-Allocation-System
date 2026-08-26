# Phase 3 Sections Home-Room Behavior Gap Audit - 2026-05-26

## Scope

Investigate the remaining `Sections` home-room workflow failures after the recent Gemini room-picker and map-modal pass.

## Files Inspected

- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionRoomMapModal.tsx`
- `atlas-client/src/components/sections/SectionRow.tsx`
- `atlas-client/src/components/CampusMap.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`

## Confirmed Gaps

### 1. Unassign still has no confirmation step

Confirmed in `SectionRoomPicker.tsx`:

- choosing `Unassigned` calls `onSelect(null)` immediately
- the map modal `Clear Selection` also clears local selection immediately with no confirmation workflow

There is no confirmation modal guarding room removal.

### 2. The map view is not a real building-detail picker

Confirmed in `SectionRoomMapModal.tsx` and `CampusMap.tsx`:

- clicking a building on the map only changes `activeBuildingId`
- room selection still happens in the left building list
- the map itself does not transition into a building-specific selectable room view

So the current modal is still mostly a building highlighter plus sidebar list, not a true building-view room picker.

### 3. Left room list and map are not a fully unified selection model

The map modal currently has:

- one left sidebar room selector
- one campus map canvas that only selects buildings

This means:

- the left selector cannot "pick up" room changes from the map because the map does not select rooms
- there is no single shared selection model across both surfaces beyond the current local `selectedRoomId`

### 4. Save does not implement real room-conflict behavior

Confirmed in frontend and backend:

- `SectionRoomMapModal` only calls `onSelect(selectedRoomId)` on confirm
- `Sections.tsx` only calls `handleHomeRoomChange(section, roomId)`
- backend `updateSectionHomeRooms()` simply writes the requested room IDs
- there is no preview or commit path for occupied-room swap behavior

Current state:

- occupied rooms are visually marked
- but there is no swap confirmation flow
- and no visual before/after summary
- and no atomic "swap this section with the current room owner" interaction

### 5. Current occupancy handling is only cosmetic

`roomOccupancy` is currently used to display labels such as `OCCUPIED` and `Used by: ...`.

It is not yet used to drive:

- blocked assignment
- swap preview
- swap confirmation
- displaced-section update

### 6. The saved-data bug is still not truly fixed

Confirmed in `Sections.tsx`:

- the recent pass added `dataSource = "refreshing"` for warm-cache reopen
- but it only force-refreshes on the browser `online` event
- normal route navigation back into `Sections` while the browser is already online does not trigger that event

So page re-entry still depends on:

- warm cache
- then asynchronous fetch

and can still show degraded-state wording or banners again during normal navigation.

### 7. There are still stray saved-data wordings tied to non-failure states

Confirmed in `Sections.tsx`:

- some banners and badge branches still map non-live states back into `Working from saved data`
- this is still too coarse for the recovered-online case

The page needs a cleaner distinction between:

- refreshing live data
- connection active but mirror-backed payload
- truly saved-data fallback because live verification failed

### 8. The new modal still contains raw controls

Confirmed in:

- `SectionRoomPicker.tsx`
- `SectionRoomMapModal.tsx`
- `CampusMap.tsx`

There are still raw `<input>` and raw `<button>` controls in the workflow, which violates the project UI rules.

## Backend Constraint Worth Preserving

The current backend already accepts batched home-room updates:

- `PUT /api/v1/sections/home-rooms/:schoolYearId`

That means a section-home-room swap can be implemented without inventing a full new persistence model, as long as the client:

- detects the occupied target room
- identifies the displaced section
- prepares a two-row assignment payload
- confirms the swap explicitly before commit

## Conclusion

The remaining problem is no longer list rendering or modal shell polish.
It is workflow completeness.

The next follow-up must explicitly solve:

1. confirmed unassign
2. real building-view room selection inside the map modal
3. synchronized room selection state between sidebar and map view
4. occupied-room swap preview and confirmation
5. reliable persisted save behavior
6. saved-data/reconnecting state truth on normal page re-entry
