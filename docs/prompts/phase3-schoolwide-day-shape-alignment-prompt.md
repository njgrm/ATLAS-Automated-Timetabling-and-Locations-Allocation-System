# Copilot Execution Prompt: Phase 3 Schoolwide Day-Shape Alignment

## Goal
Realign ATLAS scheduling controls and timetable assumptions with the stakeholder school's schoolwide final class-program output.

This prompt exists because the new stakeholder PDFs show that the current ATLAS shift-window model is structurally wrong for the target school:
- final outputs across Grades 7 to 10 are full-day schedules beginning at `7:30`
- regular sections include late `ARAL-READING (MON-THURS)` blocks
- special programs use late specialization/research blocks
- the current ATLAS windows still model `G7/8 = 06:00-12:00` and `G9/10 = 12:00-18:00`

Important clarification:
- the stakeholder-provided grade shift windows are intended for `SY 2026-2027`
- the stakeholder PDFs are `SY 2025-2026` final outputs
- so this prompt must preserve grade/program shift windows as a valid temporary control path while restoring support for a whole-day schoolwide model

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- any template or policy helper that constructs the timetable day shape

Stakeholder artifacts to compare against:
- `stakeholderFiles/ARAL_G7_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G8_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G9_Class-Program_SY2025-2026.pdf`
- `stakeholderFiles/ARAL_G10_Class-Program_SY2025-2026.pdf`
- `SSE-PLAN/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- `quarter-3_grade-10-schedule-monitoring.xlsx`

## MCP / Artifact Reading Requirement
- If your Copilot session has a document/PDF-capable MCP or extension available, use it to inspect the four stakeholder PDFs directly before making control-model decisions.
- If your session does not have a document/PDF-capable MCP available, use:
  - `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
  - `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
  as the required fallback evidence summary.
- Do not pretend to have read the PDFs directly if your active tool surface cannot do that.

## Known Facts To Treat As Fact
- The stakeholder PDFs are now the strongest schoolwide output reference.
- The Grade 8 workbook supports the same full-day shape and also shows Teacher X in active use.
- The Grade 10 monitoring workbook remains useful secondary evidence, but it should no longer drive the main day-shape assumption.
- Current live ATLAS grade/program windows are not faithful to the `SY 2025-2026` final outputs, but they may still be a valid temporary `SY 2026-2027` operating mode.

## Scope
In scope:
- schoolwide timetable day-shape assumptions
- grade/program shift-window defaults and overrides
- policy-window alignment with actual school-day structure
- protected break/block semantics needed for final-output fidelity
- explicit handling of `ARAL-READING` and related non-standard late-day blocks if required

Out of scope:
- room-placement repair
- broad faculty redistribution
- specialization alias cleanup
- SSE-level automation

## Required Behavior
1. Audit the stakeholder PDFs and compare them against current live ATLAS policy/window behavior.
   - Prefer direct PDF/MCP reading if available in-session.
   - Otherwise use the deep-dive analysis doc as the artifact-reading fallback.
2. Identify the minimum coherent control-model repair needed so ATLAS can represent the school's real school-day shape.
3. Implement the repair.
4. Verify persisted policy/window state and live Tailnet API behavior.
5. If the first fix is still structurally misaligned with the PDFs, perform one more repair iteration in the same pass.

## Required Direction
- Treat the PDFs as the primary structural output reference.
- Treat the Grade 10 monitoring workbook as secondary operational evidence only.
- Do not hardcode only one mode.
- Preserve the current half-day grade/program split as a configurable temporary override path for `SY 2026-2027`.
- Restore or preserve ATLAS's ability to represent a full-day schoolwide schedule shape as the broader baseline model.
- Prefer configurable protected blocks over hardcoded school-specific scheduling hacks.

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
- touched client build/typecheck passes if applicable
- artifact comparison source used is stated explicitly:
  - direct PDF/MCP read
  - or deep-dive fallback
- direct DB proof for:
  - `SchedulingPolicy`
  - `GradeShiftWindow`
- Tailnet proof for:
  - `GET /api/v1/policies/scheduling/1/55`
  - `GET /api/v1/generation/1/55/grade-windows`
- evidence that the new control model can represent:
  - full-day teaching structure
  - lunch/health-break boundaries
  - regular late reading/intervention blocks
  - special-program late research/specialization usage where applicable
  - temporary grade/program shift-window override mode for `SY 2026-2027`

### Required Comparison Points
Your verification summary must explicitly compare the repaired control model against:
- the schoolwide full-day PDF pattern
- the Grade 8 workbook pattern
- the Grade 10 monitoring workbook as secondary evidence

At minimum, address:
- start/end shape
- lunch and health-break placement
- `ARAL-READING` / intervention-block handling
- special-program late-block handling
- whether the temporary `SY 2026-2027` grade shift-window mode remains representable

## GO Criteria
Return `GO` only if:
- the live control model can represent both:
  - the stakeholder school's whole-day final-output shape
  - the temporary grade/program shift-window override mode
- policy and grade/program windows are structurally compatible with that dual-mode requirement
- the repaired state is persisted and visible on Tailnet

If ATLAS still cannot represent the school's final day shape coherently, return `NO-GO`.
