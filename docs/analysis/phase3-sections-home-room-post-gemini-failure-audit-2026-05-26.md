# Phase 3 Sections Home-Room Post-Gemini Failure Audit - 2026-05-26

## Scope

Audit the latest Gemini `Sections` home-room pass against the user's reported failures:

- confirmation modals not actually behaving as expected
- room-assignment CRUD not behaving as a trustworthy workflow
- custom building interior UI created even though ATLAS already has `BuildingView`
- saved-data regression still visible on normal page re-entry

## Files Inspected

- `GEMINI.md`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionRoomMapModal.tsx`
- `atlas-client/src/components/sections/SectionHomeRoomModals.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- `docs/verification/evidence-log.md`

## Findings

### 1. Gemini built a parallel building-room surface instead of reusing the existing ATLAS one

Confirmed:

- ATLAS already has `BuildingView` in `atlas-client/src/components/BuildingView.tsx`
- it is already used by `Dashboard` and timetable surfaces
- Gemini instead created a custom "Building Interior View" inside `SectionRoomMapModal.tsx`

This is a repo-pattern miss, not just a design preference issue.

### 2. The current pass still over-relies on visual claims instead of end-to-end proof

The new code adds:

- pending assignment state
- swap and unassign modals
- local building-selection state

But the evidence claim still reads like a feature-complete verdict without durable proof that every trigger path was exercised on the live page.

### 3. The saved-data regression is only partially addressed

Confirmed in `Sections.tsx`:

- mount now calls `fetchSections({ forceRefresh: navigator.onLine })`
- browser `online` event also triggers a forced refresh

This is better than before, but the page still uses broad visible wording branches like:

- `Working from saved data`
- `Using saved mirror`

and still treats multiple non-live states too coarsely.

The main lesson is that Gemini must verify normal route re-entry directly, not assume the state machine is solved because the code looks reasonable.

### 4. The current workflow is still a custom client-side orchestration over a simple backend write contract

Confirmed in backend:

- `PUT /api/v1/sections/home-rooms/:schoolYearId` supports batched section/home-room updates
- `updateSectionHomeRooms()` simply writes the requested assignments

That means the client-side workflow must be tested carefully for:

- direct assign
- confirmed unassign
- confirmed swap

because the backend is not doing a rich workflow preview for it.

### 5. Gemini still needs stronger repo-specific constraints

The main misses were:

- not reusing the existing `BuildingView`
- claiming `GO` without strong live workflow evidence
- not writing a concrete evidence entry to `docs/verification/evidence-log.md`

These need to become mandatory in `GEMINI.md`.

## Conclusion

The next Gemini pass must be stricter than the previous ones.

It should:

1. reuse the existing `BuildingView` instead of maintaining a custom room-tile replacement
2. prove each real workflow path on Tailnet before claiming `GO`
3. keep fixing within the same pass if direct assign, unassign, swap, or page re-entry truth still fail
4. append a real evidence entry to `docs/verification/evidence-log.md`
