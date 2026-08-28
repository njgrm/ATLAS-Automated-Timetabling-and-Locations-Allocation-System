# Copilot Execution Prompt: Phase 3 Schedule Output Subject Normalization

## Goal
Keep ATLAS internal scheduling subject granularity where it helps generation, while normalizing stakeholder-facing schedule output so it matches the school's actual timetable language more closely.

This prompt exists because the stakeholder PDFs mostly show normalized labels such as:
- `SCIENCE`
- `TLE`
- `SPECIALIZATION`
- `RESEARCH`

But live ATLAS internally uses more granular codes such as:
- `SCI_BIO`
- `SCI_CHEM`
- `SCI_ES`
- `TLE_ICT_EXP`
- `TLE_AFA_EXP`
- `TLE_FCS_EXP`
- `TLE_IA_EXP`
- `SPA_SPEC`
- `SPS_SPEC`

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/subject.service.ts`
- timetable/review output surfaces
- faculty schedule output surfaces
- room schedule output surfaces
- any API serializer or display helper that emits subject labels

## Known Facts To Treat As Fact
- Internal subject granularity is still useful for generation, rooming, and qualification.
- Stakeholder-facing output should not expose every internal subject code literally.
- Some explicit labels should remain explicit where stakeholder outputs already use them, such as:
  - `APPLIED CHEMISTRY`
  - `APPLIED PHYSICS`
  - `BIOTECH`
  - `ICT`
- The normalization target is the outward-facing schedule language, not the internal canonical data model.

## Scope
In scope:
- normalized display contract for timetable-facing labels
- room schedule labels
- faculty schedule labels
- any shared helper/API contract needed to keep output consistent

Out of scope:
- deleting internal subject granularity
- broad generation algorithm changes
- room-placement repair
- upstream subject sync logic

## Required Behavior
1. Audit where subject labels are emitted in user-facing schedule outputs.
2. Define the smallest coherent normalization contract.
3. Implement it without breaking internal canonical subject semantics.
4. Verify the output on the touched schedule surfaces.
5. If a safe local regression is discovered, fix it in the same pass and log it explicitly.

## Required Direction
- Keep canonical/internal subject codes for generation and qualification.
- Normalize outward-facing labels for stakeholder-facing schedule views.
- Prefer one shared display contract over duplicating label logic across pages.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries.
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
- timetable/review output reflects normalized labels
- room schedule output reflects normalized labels
- faculty-facing schedule output reflects normalized labels if applicable
- internal canonical subject data remains unchanged for generation and qualification purposes

## GO Criteria
Return `GO` only if:
- user-facing schedule outputs are normalized toward stakeholder language
- internal canonical subject semantics remain intact
- the normalization is applied consistently on the touched output surfaces

If the output still leaks raw internal subject codes in primary stakeholder-facing schedule views, return `NO-GO`.
