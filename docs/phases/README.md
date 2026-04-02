# ATLAS Phase Docs Index

This directory holds detailed execution and verification records per phase.

## Source Of Truth Order
1. `phasePlan.md` (root) — active phase pointer and high-level status
2. `docs/phases/phase-<n>-*.md` — detailed scope, checklist, blockers, and closure status
3. `docs/verification/phase-gates.md` — reusable gate template for every batch
4. `docs/verification/evidence-log.md` — dated pass/fail evidence references

## Working Rule
- Update `phasePlan.md` first when phase status changes.
- Update the matching phase file in this directory for task-level status and decisions.
- Add verification proof links or notes to `docs/verification/evidence-log.md` per accepted batch.
