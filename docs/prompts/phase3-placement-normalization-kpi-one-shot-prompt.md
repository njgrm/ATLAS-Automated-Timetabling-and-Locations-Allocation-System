# Copilot Execution Prompt: Phase 3 Placement + Output Normalization + KPI Gate

## Goal
Execute the remaining Phase 3 stream in one strong-model pass by:
1. repairing stakeholder-faithful section placement contract where the current generic seeded campus model is still too inaccurate
2. normalizing stakeholder-facing schedule output labels without deleting internal canonical subject granularity
3. running the honest KPI rerun gate after those repairs

This is a one-shot prompt for a strong model.
It replaces the separate execution order:
- `phase3-special-program-placement-contract-prompt.md`
- `phase3-schedule-output-normalization-prompt.md`
- `phase3-kpi-rerun-root-cause-gate-prompt.md`

Use this only when you can guarantee a strong model and enough attention for a full repair-plus-gate pass.

## Why This One-Shot Is Viable
- The earlier Phase 3 setup/readiness prompts are already `GO`:
  - template capacity/control math
  - policy persistence
  - policy/cohort/room readiness
  - section sync/program parity
  - subject sync/offerings
  - teaching-load alignment
  - specialization mapping cleanup
  - schoolwide day-shape alignment
  - placeholder faculty/coverage
- The remaining work is now tightly connected:
  - placement fidelity affects stakeholder-faithful room/home-room interpretation
  - output normalization affects how stakeholder-facing schedules are judged
  - KPI rerun should happen only after those two are repaired

## Required Context
Read first:
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase3-generator-readiness-sequence.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`
- `docs/analysis/phase3-grade10-workbook-comparison-2026-05-18.md`
- `docs/analysis/phase3-load-mapping-upstream-audit-2026-05-18.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/scripts/validate-run-preferences.ts`
- timetable/review output surfaces
- room schedule output surfaces
- faculty schedule output surfaces
- any API serializer or shared helper that emits subject labels or placement-facing section metadata

## Stakeholder Artifact Rule
Use direct artifact reading if your active tool surface can read the stakeholder PDFs or office occupancy files.
If not, use the analysis documents above as the authoritative fallback summaries for those artifacts.

Treat the stakeholder files this way:
- schoolwide class-program PDFs are the strongest baseline for stakeholder-facing output and school topology expectations
- office occupancy artifacts are the strongest baseline for room-tied section placement where they are explicit enough
- the Grade 8 workbook and Grade 10 monitoring workbook are secondary structural evidence, not the final output contract
- `SY 2026-2027` grade/program shift windows remain valid temporary controls and do not need to be undone

## Known Facts To Treat As Fact
- Program parity is already aligned upstream and in the live mirror:
  - `REGULAR=58`
  - `STE=8`
  - `SPA=8`
  - `SPS=8`
- Special-program placement nulls are no longer the main issue.
- Current live issue is placement fidelity:
  - sections are persisted with placement
  - but many are still solving against a generic seeded campus model rather than a stakeholder-faithful numbered-building topology
- Internal subject granularity is still useful for:
  - generation
  - qualification
  - room suitability
- Stakeholder-facing outputs should not leak raw internal subject codes where normalized labels are expected.
- Latest generator state is still not closure-grade:
  - `assignedCount=1989`
  - `unassignedCount=1471`
  - `hardViolationCount=606`
  - `homeRoomSuccessRate=42.75`
  - `termCounts={ term1: 1989, term2: 0, term3: 0 }`
- The remaining Phase 3 blocker classes still include:
  - template math overload pressure
  - tri-sem / term distribution collapse
  - specialized-room scarcity
  - faculty idle-gap / travel-distance pressure
  - residual lacking-faculty pressure

## Scope
In scope:
- stakeholder-faithful section placement contract repair where the current persisted placement is still too generic
- outward-facing subject label normalization for timetable, room schedule, and faculty-facing schedule outputs
- required shared helper/API contract changes to keep those outputs consistent
- fresh KPI rerun and root-cause gate after the repairs
- Tailnet verification and direct DB proof where applicable

Out of scope:
- undoing dual-mode day-shape support
- deleting internal canonical subject granularity
- broad new upstream integration design outside what is required for placement or output correctness
- speculative algorithm refactors not directly needed by this pass

## Mandatory Execution Order Inside This One Prompt

### Phase A: Placement Fidelity Repair
1. Audit current section placement state in API and DB against stakeholder occupancy artifacts.
2. Determine whether the remaining fidelity gap should be repaired by:
   - upstream sync use as-is
   - ATLAS manual overlay
   - imported occupancy-backed overlay
   - a hybrid contract
3. Implement the smallest coherent repair path.
4. Do not treat `non-null placement` as equivalent to `correct placement`.
5. Prefer an explicit and auditable overlay path over hidden defaults.

### Phase B: Schedule Output Normalization
1. Audit where subject labels are emitted in:
   - timetable/review
   - room schedules
   - faculty-facing schedules
2. Define one shared normalization contract.
3. Keep internal canonical subject semantics intact.
4. Normalize outward-facing labels toward stakeholder language.
5. Preserve explicit labels where stakeholder outputs already care about them, such as:
   - `APPLIED CHEMISTRY`
   - `APPLIED PHYSICS`
   - `BIOTECH`
   - `ICT`

### Phase C: KPI Rerun + Root-Cause Gate
1. Re-run any required upstream-aware refresh or mirror sync first if the live state depends on them:
   - `POST /api/v1/sections/sync`
   - `POST /api/v1/subjects/sync-offerings`
2. Run fresh generation after Phase A and Phase B are complete.
3. Capture exact before/after KPI deltas.
4. Classify remaining blockers honestly if the rerun still fails.
5. Do not perform major speculative implementation during the KPI gate portion.

## Required Direction
- Keep EnrollPro as source of truth for roster/program membership.
- Allow ATLAS to own explicit placement overlays when upstream does not provide stakeholder-faithful room/building placement.
- Keep internal subject granularity for generation and qualification.
- Normalize outward-facing schedule language for stakeholder-facing views.
- If a safe local regression is discovered during this pass, fix it in the same pass and log it explicitly as discovered out-of-scope but required for completion.

## Execution Discipline
- Provide at most one short execution preamble, then act.
- Do not narrate retries or probe filtering.
- If a probe is too noisy, narrow it silently and continue.
- Report only:
  - before-state summary
  - files changed
  - verification results
  - final GO/NO-GO
- Limit this pass to at most 2 repair iterations total before returning explicit blockers.

## Verification Requirements

### Core Verification
You must verify:
- touched server build/typecheck passes
- touched client build/typecheck passes if applicable
- Tailnet `GET /api/v1/sections/summary/55?schoolId=1`
- direct DB proof for repaired `SectionMirror` placement state where applicable
- timetable/review output reflects normalized labels
- room schedule output reflects normalized labels
- faculty-facing schedule output reflects normalized labels if applicable
- internal canonical subject data remains intact for generation and qualification

### KPI Verification
You must also verify:
- required sync/refresh state confirmed before rerun
- fresh generation run completed
- latest run summary captured
- latest violations captured
- latest timetable/draft route inspected as needed
- direct comparison against:
  - run `41` minimum baseline
  - run `52` repaired baseline
  - current latest pre-pass baseline if newer

## KPI Baselines To Compare Against

### Minimum failure baseline: run 41
- `assignedCount = 939`
- `unassignedCount = 2661`
- `hardViolationCount = 731`
- `homeRoomSuccessRate = 19.42%`
- `SPECIALIZED_ROOM_UNAVAILABLE = 1930`
- `policyOrShiftWindowIncompatible = 2133`
- `termCounts = { term1: 939, term2: 0, term3: 0 }`

### Post-repair comparison baseline: run 52
- `assignedCount = 1121`
- `unassignedCount = 1451`
- `hardViolationCount = 610`
- `homeRoomSuccessRate = 32.11%`
- `SPECIALIZED_ROOM_UNAVAILABLE = 841`
- `policyOrShiftWindowIncompatible = 1044`
- `termCounts = { term1: 1121, term2: 0, term3: 0 }`

## Root-Cause Classification Rules
If KPIs still fail, classify the remaining causes into the most honest buckets, such as:
- timetable math still infeasible
- room/specialized facility shortage
- policy/shift incompatibility
- cohort/readiness gap
- faculty/placeholder coverage gap
- tri-sem / term distribution bug
- special-program section placement fidelity gap
- stakeholder-output normalization gap
- special-program subject-model compression gap

Use stakeholder workbooks only as secondary structural evidence.
Do not treat quarter labels or monitoring-sheet formatting as the target ATLAS output contract.

## Evidence Update
Append evidence that records:
- exact before-state for placement fidelity
- exact before-state for outward-facing subject-label leakage
- exact runs used
- exact commands run
- exact live endpoints checked
- whether section sync and subject sync were rerun before KPI pass
- exact placement repair contract used:
  - upstream
  - overlay
  - imported overlay
  - hybrid
- exact KPI before/after values
- final `GO` or `NO-GO`
- remaining blocker list if `NO-GO`

## GO Criteria
Return `GO` only if all of the following are true:
- stakeholder-critical section placement no longer depends only on the generic seeded campus contract without explicit reason
- placement contract is auditable and persisted
- stakeholder-facing schedule outputs are normalized toward stakeholder language
- internal canonical subject semantics remain intact
- fresh KPI rerun demonstrates materially recovered generator behavior
- no critical remaining blocker stays open for this one-shot scope

Return `NO-GO` if any of these remain true:
- placement is still generically persisted without stakeholder-faithful justification
- primary schedule outputs still leak raw internal subject codes
- KPI rerun still fails with unresolved critical blocker classes
- root cause is still not isolated cleanly

## Final Output Required From Implementer
Return:
1. before-state summary
2. grouped implementation summary:
   - placement fidelity
   - output normalization
   - KPI rerun/gate
3. verification results with exact commands and outcomes
4. evidence-log update confirmation
5. final `GO` or `NO-GO`
