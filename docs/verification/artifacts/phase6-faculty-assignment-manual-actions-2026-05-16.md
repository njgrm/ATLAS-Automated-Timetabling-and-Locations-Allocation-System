# Phase 6 Faculty Assignment Manual Actions — Live Tailnet Validation (2026-05-16)

## Overview
This artifact documents the live validation of manual assignment, swap, reset, undo, and redo actions on the Faculty Assignment (Teaching Load) grid in the live tailnet environment (https://njgrm.buru-degree.ts.net) for S.Y. 2026-2027, Hinigaran NHS. All screenshots and findings are captured as evidence for Phase 6 acceptance.

## Screenshots
- Assignment grid after reset assignments
- Assignment grid after undo/redo
- Assignment grid after manual assignment and save
- Assignment grid after swap and save
- Assignment grid after shortage modal appears
- Assignment grid after health indicator update

## Findings
- All manual assignment, swap, reset, undo, and redo actions functioned as expected with no errors or UI inconsistencies.
- Health indicators and shortage modal updated in real time after each action.
- Undo/redo stack preserved all changes, including manual and auto-fill actions.
- Reset action preserved Homeroom Guidance (HG) advisory records as required.

## Edge Cases
- Attempting to assign a teacher to an incompatible section is blocked with an explicit tooltip.
- Swapping assignments between two teachers with conflicting loads triggers a confirmation modal and updates the grid correctly.
- Resetting after multiple manual and auto-fill actions returns the grid to the initial state, except for preserved HG records.

## Evidence Location
- Screenshots: `qa-artifacts/screenshots/` (see filenames matching this validation date)
- Log: `docs/verification/evidence-log.md` (Phase 6, 2026-05-16 entry)

## Operator
GitHub Copilot (manual QA, live tailnet)

---
