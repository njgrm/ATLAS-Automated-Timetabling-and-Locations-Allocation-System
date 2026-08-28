# Prompt 14 — True Two-Way Section Swap

## Goal
Transform the current "Swap" button from a one-way transfer into a true two-way section exchange, and eliminate the confirmation modal to make it a fast, 1-click action.

## Context
Currently, clicking the swap icon next to another teacher's section opens a "Transfer Section Ownership" modal, but it only performs a one-way transfer (it gives the section to the current teacher, but the donor teacher gets nothing in return). The user wants this to be a true swap: if the current teacher already owns a section in that same subject, the system should automatically trade that section with the donor teacher. Because schedulers do this frequently between shared subjects, the modal is unnecessary and slows them down.

## Target files
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/TeachingLoadModals.tsx`

## Tasks

### 1. Update the Swap Logic in `TeachingLoad.tsx`
Replace `handleSwapRequest` and `executeSwap` with a single, immediate swap function.
- Find the `handleSwapRequest` and `executeSwap` functions.
- Combine them into a single `handleSwapRequest` function that executes the swap logic immediately (without setting a `swapCandidate`).
- **The Two-Way Swap Logic**:
  - Resolve the `destinationFacultyId` (defaults to `data.selectedId`). If null, show an error toast.
  - Clone the current draft assignments for the donor (`fromFacultyId`) and the recipient (`destinationFacultyId`).
  - Check if the recipient already owns any sections in this `subjectId`.
  - **If YES**: Pick the **first** section they own (e.g. `sectionToGiveBack = toCurrent[toIndex].sectionIds[0]`).
    - Remove `sectionId` from the donor, and add `sectionToGiveBack` to the donor.
    - Remove `sectionToGiveBack` from the recipient, and add `sectionId` to the recipient.
  - **If NO**: Fallback to a one-way transfer (remove `sectionId` from donor, add to recipient).
  - Update `data.setDraftAssignmentsByFaculty` with the new arrays.
  - Call `toast.success('Sections swapped in draft mode.')`.
- Remove all references to `ui.setSwapCandidate` and the `executeSwap` function entirely.

### 2. Remove the Modal from `TeachingLoadModals.tsx`
- Open `TeachingLoadModals.tsx`.
- Remove the `ConfirmationModal` block that checks `open={Boolean(swapCandidate)}` and renders the "Transfer Section Ownership?" UI.
- You may safely remove the `swapCandidate`, `onSwapCandidateChange`, and `onSwapConfirm` props from the `TeachingLoadModals` interface and component signature, as they are no longer needed. Be sure to also remove them from where `<TeachingLoadModals>` is rendered in `TeachingLoad.tsx`.

## UX requirements
- Clicking the swap icon should instantly execute the swap without any confirmation popups.
- If the current teacher has a class to trade in that subject, it must be given to the donor teacher.
- If the current teacher has NO classes in that subject, it should safely fall back to a 1-way transfer.

## Acceptance criteria
- [ ] `ConfirmationModal` for swapping is completely removed.
- [ ] `handleSwapRequest` directly updates the draft assignments.
- [ ] The logic explicitly checks for a `sectionToGiveBack` and trades it if available.

## Verification commands
```bash
npm run build
```

## Report requirements
- Confirm that the modal has been removed and the swap is now instant.
