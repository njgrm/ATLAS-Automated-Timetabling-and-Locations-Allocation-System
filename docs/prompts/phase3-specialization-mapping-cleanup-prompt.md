# Copilot Execution Prompt: Phase 3 Specialization Mapping Cleanup

## Goal
Clean up specialization mapping so qualification logic and operator mapping state are aligned with the current active subject contract.

Current live state:
- specialization catalog has only `2` live unmapped items:
  - `CERTIFIED SPECIALIST COACH`
  - `SPORTS SCIENCE`
- alias table still contains `24` orphan rows pointing to inactive legacy subjects
- several active general/special-program subjects still rely on mixed explicit-scope and fallback behavior

This prompt must clean the mapping layer without reopening inactive legacy subject semantics.

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/pages/SpecializationMapping.tsx`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/services/qualification.service.ts`
- `atlas-server/src/routes/specialization-alias.router.ts`
- `atlas-server/src/services/subject.service.ts`

## Known Facts To Treat As Fact
- The live mapping UI mostly looks healthy.
- The persistence layer still contains orphan alias rows for inactive legacy subject codes like:
  - `SCI`
  - `SCI_PHYS`
  - `ADVANCED_CHEMISTRY`
  - `ADVANCED_PHYSICS`
  - `ENV_SCI`
  - `SPA_SPEC`
- The live unmapped specialization items are sports-related and now matter more because SPA/SPS sections exist upstream.
- The Grade 10 monitoring workbook shows visible SPA/SPS specialization blocks, but it is not a literal subject-schema contract; use it as evidence that specialization granularity matters, not as a direct canonical naming source.

## Scope
In scope:
- alias cleanup for inactive legacy canonical targets
- live specialization catalog mapping accuracy
- active subject contract alignment for qualification/mapping behavior
- Tailnet verification of mapping status after repair

Out of scope:
- broad subject-template resets
- timetable algorithm changes
- section sync/parity repair
- faculty load formula repair

## Required Behavior
1. Audit current alias rows and specialization catalog state.
2. Identify which alias rows are legacy debt versus still needed active mappings.
3. Repair the alias/mapping layer with the smallest coherent change.
4. Verify the live specialization catalog after the repair.
5. If a discovered local regression blocks the cleanup, fix it in the same pass when safe and log it explicitly.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate audit retries.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - GO/NO-GO
- Limit this pass to at most 2 repair iterations.

## Verification Requirements
You must verify:
- touched server build/typecheck passes
- touched client typecheck/build passes if applicable
- Tailnet `GET /api/v1/faculty/specialization-catalog?schoolId=1`
- Tailnet `GET /api/v1/specialization-aliases?schoolId=1`
- direct DB alias proof for active versus orphan canonical targets

### Required live checks
- count remaining unmapped specialization items
- verify inactive legacy canonical targets are not left as misleading live mappings
- verify current active subject contract still maps correctly for live specializations

## GO Criteria
Return `GO` only if:
- alias rows tied to inactive legacy subject codes are removed, migrated, or explicitly neutralized
- live specialization catalog no longer overstates mapping health through stale legacy canonical rows
- remaining unmapped items are either intentionally open or correctly fixed

If stale alias debt still materially distorts qualification/mapping behavior, return `NO-GO`.
