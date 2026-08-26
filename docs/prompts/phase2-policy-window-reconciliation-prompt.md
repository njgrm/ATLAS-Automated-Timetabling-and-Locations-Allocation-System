  # Copilot Execution Prompt: Phase 2 Policy + Shift Window Reconciliation UX

Run this after:
- `docs/prompts/phase2-timetable-shape-refactor-prompt.md`

This prompt is a focused UX and workflow correction pass for scheduler-facing policy and shift controls.

## Goal
Make policy bounds and grade/program window edits understandable, mutually consistent, and explicitly guided for the scheduler.

This pass must also reflect the current EnrollPro ownership model:
- EnrollPro decides which special programs are offered,
- EnrollPro already owns live TLE specialization catalog and section-level TLE specialization assignments,
- ATLAS policy/window UX must not assume a static local-only TLE or special-program model.

## Scope

In scope:
- `SchedulingPolicyPane`
- any related scheduling settings UI that exposes policy bounds or shift windows
- validation and messaging needed to explain policy/window consequences

Out of scope:
- unrelated timetable polish
- backend timetable-shape refactor already handled in the prior prompt
- final Phase 2 closure claim

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/verification/evidence-log.md`
- `docs/prompts/phase2-template-subject-contract-reset-prompt.md`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/types.ts`
- `atlas-client/src/types.d.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-server/src/services/cohort.service.ts`
- `EnrollPro/docs/features/integration/ENROLLPRO-API.md`

## Known Immediate Breakage To Absorb
The prior prompt execution introduced a client contract mismatch:
- `SchedulingPolicyPane.tsx` reads `GradeShiftWindow.programType`
- client `GradeShiftWindow` types do not currently expose `programType`

This is not optional follow-up. Fix this during this prompt's pass and treat it as part of the policy/window reconciliation surface.

## Incidental Error Recovery Rule
If you discover a concrete compile error, type drift, contract mismatch, or adjacent regression while executing this prompt:
- fix it in the same pass when the fix is local and low-risk,
- do not defer it just because it was not named in the original prompt,
- explicitly log it in the final response and evidence update as:
  - `discovered out-of-scope issue`
  - `why it blocked or threatened the scoped work`
  - `how it was fixed`
  - `what verification was rerun`

If the discovered issue is too large to fix safely in the same pass:
- stop and return `NO-GO`,
- list it explicitly as a blocker with file references.

## Context7 Preflight
Before changing any Radix/shadcn interaction pattern:
- use Context7 if available,
- otherwise check official docs for dialog/sheet/alert dialog patterns used for guided confirmation flows,
- mention the doc source used in the final response.

## Workbook Assumption
Use the Grade 8 workbook as representative of stakeholder expectations for timetable-shape configurability:
- scheduler needs to express different day structures for regular vs special programs,
- scheduler needs to understand what happens when one timing rule affects another.

## Live EnrollPro Context To Treat As Fact
These findings were validated against the live `dev-jegs` Tailnet environment on `2026-05-17`.

- `GET /api/settings/scp-config` confirms offered SCP programs but does not expose detailed SPA/SPS strand lists.
- `GET /api/integration/v1/sections` already exposes:
  - `programType`
  - `gradeLevel`
  - `tleProgramId`
  - `tleSpecialization`
  - `tleProgramCategory`
- `GET /api/admin/tle-programs` exposes the active TLE specialization catalog.

Implication for this prompt:
- policy/window UX must not present TLE specialization ownership as if it were only a local ATLAS concern,
- Grade + Program window controls should be compatible with the fact that some Grade 9-10 sections already carry EnrollPro-assigned TLE specialization context,
- future reconciliation logic must leave room for SPA/SPS becoming equally upstream-driven once EnrollPro starts populating their specialization arrays.

## Mandatory First Step
Before editing:
1. Audit the current policy/shift-settings workflow.
2. List every place where the UX is misleading or incomplete, including:
   - hardcoded override defaults
   - non-editable grade selection
   - bottom-append override UX
   - save-time failure messaging without guided resolution
   - any mismatch between local ATLAS controls and live EnrollPro-owned TLE/program context
   - any compile-time or type-contract mismatch currently blocking this surface
3. Then implement the fix.

## Required Direction

### A. Fix override creation flow
- `Add Override` must not create a hardcoded Grade 7 STE row.
- Scheduler must be able to choose the grade and program explicitly.
- Override creation must feel intentional, not like form spam appended at the bottom.

### B. Add guided reconciliation behavior
When policy bounds and windows conflict, the scheduler should be told:
- what changed,
- what will be clipped, expanded, or invalidated,
- what the system will do next if they confirm.

Use an informative modal or equivalent guided confirmation flow.

### C. Respect first-touch intent
If the scheduler edits:
- policy first, explain how windows will be affected
- window first, explain how policy must respond or why save is blocked

### D. Do not fight upstream program ownership
- The UX should acknowledge that some program context comes from EnrollPro, especially TLE specialization ownership.
- Do not frame TLE timing behavior as if ATLAS invented those specialization assignments locally.
- Where the UI needs to label or filter program-aware windows, it should stay compatible with live EnrollPro program types and TLE-derived section context.

### E. Preserve design-system rules
- no native selects
- no global scroll regressions
- use project UI primitives

## Hard Rules
- Do not leave override creation hardcoded to Grade 7.
- Do not rely on raw toast-only save failure for policy/window conflicts.
- Do not complete this prompt with only copy tweaks; the workflow must materially improve.
- Do not introduce policy/window UX that assumes every TLE or special-program dimension is configured only inside ATLAS.

## Verification Gates
- affected client build/typecheck
- relevant server checks for validation behavior
- explicit verification that `GradeShiftWindow` client types match the current policy/window payload contract
- explicit verification that the UI still behaves coherently for program-aware windows when live program ownership comes from EnrollPro
- manual QA of:
  - adding an override
  - editing grade/program override
  - editing policy bounds first
  - editing window first
  - conflict confirmation behavior

## Evidence Update
Append a narrow evidence entry that records:
- the new scheduler workflow
- commands run
- screenshots or notes for the guided reconciliation flow
- how the updated UX accounts for EnrollPro-owned TLE/program context
- any discovered out-of-scope issue fixed during this pass, including the exact fix and why it was repaired here
- remaining follow-up, if any

## GO / NO-GO
Return `GO` only if:
- override creation is fully editable,
- policy/window conflicts are explained with a guided flow,
- scheduler intent is preserved and visible.

Return `NO-GO` if the workflow still depends on confusing append-and-fail behavior.
