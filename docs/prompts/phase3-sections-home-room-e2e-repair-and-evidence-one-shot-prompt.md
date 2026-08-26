# Gemini Execution Prompt: Phase 3 Sections Home-Room E2E Repair And Evidence One-Shot

## Objective

Repair the `Sections` home-room workflow end to end and prove it in the same pass.

This is not another cosmetic pass.
Do not return a shell-level or build-only success.

The current problem is that the workflow still does not behave reliably enough in real use:

- confirmation paths are not trusted
- CRUD behavior is not trusted
- Gemini invented a custom building interior UI even though ATLAS already has an existing building-room view
- saved-data truth on page re-entry is still not reliable enough

## Out of Scope

Do not:

- redesign the whole `Sections` page
- invent another custom room-browser surface if an existing ATLAS component already fits
- replace the section-first assigned-classes drawer
- broaden this into a multi-page UI cleanup
- claim `GO` from build success alone

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-sections-home-room-behavior-gap-audit-2026-05-26.md`
- `docs/analysis/phase3-sections-home-room-post-gemini-failure-audit-2026-05-26.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/components/sections/SectionRoomPicker.tsx`
- `atlas-client/src/components/sections/SectionRoomMapModal.tsx`
- `atlas-client/src/components/sections/SectionHomeRoomModals.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-server/src/routes/section.router.ts`
- `atlas-server/src/services/section.service.ts`
- swap/confirmation references in:
  - `atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx`

## Verified Current Problems

Treat these as real until disproven on Tailnet in this pass:

- the latest pass created a custom building interior view instead of reusing the existing `BuildingView`
- the room-assignment workflow is still not trusted in practice
- unassign and swap flows still require real end-to-end proof, not just presence of modal code
- the page can still drift back into misleading saved-data wording on normal page re-entry
- prior Gemini passes have claimed `GO` without strong enough live workflow evidence

## Non-Negotiable Implementation Rules

### A. Reuse existing ATLAS building-room surface

Do not keep or expand the custom building interior room-tile surface if `BuildingView` already satisfies the need.

The map modal must build on the existing ATLAS building-room view unless Gemini can prove a hard blocker.

If any custom wrapper is needed, it must be thin and must not replace the building-room logic that already exists.

### B. Treat this as a workflow repair pass, not a visual pass

You must verify and fix the actual event chain for:

- direct assign
- unassign with confirmation
- occupied-room swap with confirmation
- persisted post-save row update
- saved-data versus reconnecting truth on route re-entry

### C. Keep fixing in the same pass if validation fails

If your first implementation still fails any of the above flows:

- do not stop
- do not report `GO`
- keep iterating within the same pass until the feature either works or you can prove the blocker precisely

### D. Write evidence to the canonical evidence log

Before finishing, append a dated entry to:

- `docs/verification/evidence-log.md`

The entry must include:

- scope
- files changed
- commands run
- Tailnet verification steps
- actual observed results
- `GO` or `NO-GO`

Do not leave evidence only in your chat response.

## Product Outcome

Schedulers should be able to:

- open a section's room picker
- choose a room from the compact picker or map modal
- use the existing ATLAS building-room view in the modal
- unassign safely through explicit confirmation
- attempt to assign to an occupied room and get a clear swap confirmation summary
- save and see the row actually reflect the persisted outcome
- leave `Sections`, come back, and see truthful live/reconnecting/saved state messaging

## Implementation Requirements

### 1. Replace the custom building interior view with the existing `BuildingView`

The map modal should:

- keep the campus/building navigation shell if useful
- use `BuildingView` for the actual building-specific room selection surface
- keep room selection synchronized with the left selector

Do not maintain a separate custom room-tile implementation if `BuildingView` can be adapted.

### 2. Make direct assign, unassign, and swap fully real

The workflow must support:

- direct assign
- confirmed unassign
- confirmed swap

Each one must:

- trigger from the intended UI path
- persist through the existing home-room update contract
- update the visible section state after save

### 3. Confirmation modals must be triggered by the real user paths

Required:

- selecting `Unassigned` when a section currently has a room must trigger `UnassignConfirmationModal`
- selecting an occupied room must trigger `SwapConfirmationModal`
- both modal confirm actions must lead to real persisted updates

### 4. Keep sidebar and map selection synchronized

Required:

- selecting in the compact/sidebar list updates the building view
- selecting in `BuildingView` updates the sidebar and active selection

### 5. Fix route re-entry source-state truth

The page must distinguish:

- `Refreshing` while live verification is in flight
- active EnrollPro connection with mirror-backed payload
- truly working from saved data because live verification failed

Do not regress to `Working from saved data` on normal page re-entry while EnrollPro is already reachable.

## Verification Gates

Required:

1. `npm --prefix atlas-client run build`
2. verify the modal uses the existing `BuildingView` rather than a parallel custom room-tile implementation
3. verify direct assign works
4. verify unassign confirmation opens and works
5. verify occupied-room swap confirmation opens and works
6. verify the saved row reflects the persisted outcome after each path
7. verify normal route re-entry while EnrollPro is reachable does not regress to false saved-data wording
8. append evidence to `docs/verification/evidence-log.md`

## Mandatory Tailnet Proof

Do not return `GO` without proving these flows on Tailnet:

- direct room assignment
- unassign with confirmation
- occupied-room swap with confirmation
- route away from `Sections` and back while EnrollPro is reachable

You must state exactly what you clicked, what the UI showed, and what persisted.

If any of those fail, keep fixing in the same pass or return `NO-GO` with a precise blocker.

## Required Output

Return:

1. files changed
2. how `BuildingView` was reused
3. direct assign result
4. unassign confirmation result
5. occupied-room swap result
6. route re-entry state result
7. build result
8. evidence-log entry summary
9. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `BuildingView` is the real building-room surface in the modal
- direct assign, unassign, and swap all work end to end
- row state visibly matches the persisted outcome
- saved-data messaging is truthful on normal re-entry
- evidence is written to `docs/verification/evidence-log.md`
