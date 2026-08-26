# Copilot Execution Prompt: Phase 3 Subject Qualification Reset One-Shot

## Objective

Reset the ATLAS subject and teaching-load qualification contract so it matches the real scheduler workflow:
- department ownership is the default qualification baseline
- manual Teaching Load placements remain authoritative
- specialization-based qualification and `Specialization Mapping` are removed from the normal product flow

This is a broad contract-reset pass, not a narrow UI polish pass.

## Required Context

Read these first:
- `phasePlan.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-subject-followup-audit-2026-05-21.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/qualification.service.ts`
- `atlas-server/src/routes/subject.router.ts`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `prisma/schema.prisma`
- `prisma/seed.js`

## Facts To Treat As Settled

- The scheduler is not responsible for specialization-level qualification decisions.
- Department heads decide real teacher ownership outside the system; the scheduler translates that into Teaching Load when needed.
- `Teaching Load` is the authoritative surface for assigning which teacher teaches which subject/section.
- Manual placements in `Teaching Load` must be preserved and respected by automation/generation.
- Department ownership should be the default qualification baseline.
- `Specialization Mapping` is no longer worth keeping as a first-class scheduler page or qualification dependency.
- The subject page still has unresolved noise:
  - replacement-character/mojibake strings
  - `Core` and `System` badges
  - owner emphasis in `Scope & Owner`
  - lingering specialization drawer/tier language
  - `Match Priority` control still visible
  - weak coverage inspection
- Current local/live subject reset direction already includes:
  - `sessionPattern` removal
  - `TLE_IA_EXP` removal
  - `STE_ICT` retirement
  - `225`-minute normalization for class-program subjects with narrow explicit exceptions

## Scope

### A. Remove specialization-based qualification as a product concept

Remove specialization-driven qualification and mapping from the normal ATLAS workflow.

That includes:
- `Specialization Mapping` page
- sidebar/nav entry
- specialization-tier teacher eligibility messaging
- subject-page explanation text that implies specialization-first assignment
- backend qualification logic that depends on `allowedSpecializations` for default teacher qualification

If any backend artifact must remain temporarily for compatibility, it must be fully non-user-facing and documented as legacy.

### B. Make department ownership the default qualification baseline

Implement a clear department-owned subject contract.

Required direction:
- subject ownership is defined by department
- automation qualifies teachers by department ownership by default
- scheduler can see subjects with no department
- subject CRUD uses normalized department values, not free text
- `qualificationPriority` / match-priority complexity should be removed from scheduler-facing CRUD

### C. Keep Teaching Load authoritative

Manual Teaching Load placements must remain the source of truth for real teacher ownership.

Required behavior:
- automation may fill gaps only where the scheduler has not already assigned ownership
- automation must not silently overwrite manual placements
- subject-page coverage must remain read-only context
- all assignment creation/editing stays on `Teaching Load`

### D. Simplify subject-page UX around the new contract

Required cleanup:
- remove `Core` badge
- remove `System` badge
- move department signal out of the current `Scope & Owner` emphasis
- make program scope the main visible contract signal
- remove specialization drawer/tier wording
- remove `Match Priority` from Create/Update modal
- improve modular `Term Rank` explanation so schedulers understand its meaning
- keep `Auto-Schedule` only where it truly belongs; do not leave many subjects disabled without a clear contract reason

### E. Clean up coverage and deletion flows

Required behavior:
- coverage drawer shows currently assigned teachers plus section ownership detail where available
- no assignment actions in the drawer
- blocked delete keeps actionable remediation
- inactive/archived remediation remains intact

## Explicit Non-Goals

Do not:
- redesign the whole shell/sidebar in this prompt
- change broader generator algorithm strategy beyond the qualification baseline and manual-placement authority
- reintroduce specialization-first teacher matching as a fallback

## Required Verification

You must prove:
1. `Specialization Mapping` is removed from the app workflow
2. default teacher qualification is department-based, not specialization-based
3. subject CRUD no longer exposes match-priority and specialization-tier complexity
4. manual Teaching Load assignments remain authoritative
5. subject coverage drawer is read-only and more informative
6. subject-page visual noise is materially reduced
7. automation/generation no longer depends on specialization mapping for normal qualification

At minimum verify with:
- server build/typecheck
- client build/typecheck
- direct code-path verification of qualification logic
- direct DB check of subject ownership fields
- live or local UI verification of Subjects + Teaching Load navigation and flows

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- If a check is noisy, narrow it silently.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Required Output

Return:
1. before-state summary
2. files changed
3. exact specialization-removal decision implemented
4. exact department-qualification contract implemented
5. exact Teaching Load authority guarantees implemented
6. subject-page UX simplifications completed
7. coverage/delete workflow changes
8. verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if all of the following are true:
- `Specialization Mapping` is removed from the normal workflow
- department ownership is the only default qualification baseline
- subject CRUD no longer exposes specialization-tier or match-priority workflow complexity
- Teaching Load remains authoritative for actual placements
- subject coverage is read-only and informative
- the subject page is materially simpler for schedulers
- no hidden specialization-first backend dependency still drives normal teacher qualification

If not, return `NO-GO` with the exact remaining blocker cluster.
