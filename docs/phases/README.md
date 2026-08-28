# ATLAS Phase Docs Index

This directory holds detailed execution and verification records per phase.

## UX Planning Reference
- Cross-role UX refactor sequencing and acceptance gates: `docs/phases/ux-refactor-master-plan.md`
- Hybrid algorithm refactor sequencing and acceptance gates: `docs/phases/algorithm-hybrid-refactor-plan.md`
- Copilot skill/context7 rollout sequencing: `docs/phases/copilot-supercharge-rollout.md`
- Faculty UX/UI refactor execution details (mobile + desktop): `docs/phases/faculty-ux-ui-refactor-execution-plan.md`
- Faculty UX **expert hardening** (high bar, Playwright faculty matrix, Context7): `docs/prompts/faculty-ux-expert-hardening-pass.md`
- Office-file MCP ingestion and output-alignment plan: `docs/phases/office-files-mcp-ingestion-and-alignment-plan.md`

## Source Of Truth Order
1. `phasePlan.md` (root) — active phase pointer and high-level status
2. `docs/phases/phase-<n>-*.md` — detailed scope, checklist, blockers, and closure status
3. `docs/verification/phase-gates.md` — reusable gate template for every batch
4. `docs/verification/evidence-log.md` — dated pass/fail evidence references

## Working Rule
- Update `phasePlan.md` first when phase status changes.
- Update the matching phase file in this directory for task-level status and decisions.
- Add verification proof links or notes to `docs/verification/evidence-log.md` per accepted batch.
