# Copilot Execution Prompt: Phase 3 Subject Contract Follow-Up One-Shot

## Objective

Finish the `Subjects` + `Teaching Load` contract reset for the scheduler workflow after the first subject-domain pass, the Gemini/Sonnet UI pass, and the MATATAG TLE reset.

This pass must remove leftover technical complexity from the subject page, align the subject inventory with stakeholder workflow, and stop subject/teaching-load drift from creating false generation blockers.

## Required Context

Read these first:
- `phasePlan.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase3-subject-domain-and-shell-audit-2026-05-21.md`
- `docs/analysis/phase3-subject-followup-audit-2026-05-21.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/lib/subject-constants.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/subject-ownership.service.ts`
- `atlas-server/src/routes/subject.router.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `prisma/schema.prisma`
- `prisma/seed.js`

## Facts To Treat As Settled

- `ADVANCED_CHEMISTRY` delete blocker is real:
  - `46` active assignments
  - `2` historical assignments
- current delete blocker behavior is backend-correct but workflow-incomplete
- current ownership snapshot is still too heuristic and not a strong scheduler-facing contract
- current live TLE-related subject rows include:
  - `TLE`
  - `TLE_ICT_EXP`
  - `TLE_AFA_EXP`
  - `TLE_FCS_EXP`
  - `TLE_IA_EXP`
  - `STE_ICT`
- current live faculty-subject assignments prove overlapping TLE load semantics:
  - `TLE = 13`
  - `TLE_ICT_EXP = 22`
  - `TLE_AFA_EXP = 9`
  - `TLE_FCS_EXP = 0`
  - `TLE_IA_EXP = 0`
  - `STE_ICT = 2`
- `TLE_IA_EXP` must be removed from the active TLE rotation family
- `STE_ICT` is stale and must be retired
- the scheduler should still see explicit subject rows; do not hide them behind a `Show system` toggle
- all active subjects currently have `sessionPattern = ANY`
- the day-pattern/session-pattern feature is dead weight and must be removed end-to-end
- specialization-based teacher eligibility is no longer the desired scheduling model on this page
- scheduler and automation should use department-level qualification as the baseline
- SPA/SPS specialization values may remain visible for contract confirmation but should not drive Tier-1 / specialization-first faculty gating in the subject UI
- stakeholder-facing schedules normalize labels such as:
  - `SCIENCE`
  - `TLE`
  - `SPECIALIZATION`
  - `RESEARCH`
- stakeholder schedules show 45-minute daily blocks, so for this pass the target scheduling-minute contract is:
  - `225` minutes/week for class-program subjects
- inactive subjects can still retain `faculty_subjects` rows that are not surfaced clearly enough in Teaching Load today
- the global teaching-load reset belongs on the Teaching Load page, not the Subjects page
- archived subjects need an explicit reactivate action
- status filtering should be a simple explicit active/archive switch, not a dropdown
- the subject coverage drawer should be read-only subject context:
  - show currently assigned teachers
  - show better teacher detail and section ownership detail
  - do not allow assignment creation there
- the subject page must stop explaining specialization logic in technical terms such as Tier-1 candidate language

## Scope

### A. Remove the day-pattern feature end-to-end

Delete the `sessionPattern` / day-pattern contract everywhere it influences behavior.

That includes:
- Prisma schema
- server subject service and validation
- client subject types/constants
- subject CRUD UI
- table columns and badges
- explainability text
- scheduler heuristics and constraint evaluation if still wired

Do not leave an `ANY`-only dead control behind.

### B. Replace free-text ownership with normalized department qualification controls

Implement a real scheduler-facing subject-to-department contract.

Required direction:
- use normalized department values sourced from EnrollPro faculty departments
- expose department ownership as a bounded dropdown, not a free-text field
- support a visible `No department` / `Unassigned` state
- allow the scheduler to define which department owns or can teach the subject as the qualification baseline

This pass must materially reduce heuristic-only ownership inference.

### C. Reset TLE identity and overlap correctly

Repair the TLE family so schedulers do not assign overlapping subject identities for the same curriculum concept.

Required direction:
- remove `TLE_IA_EXP`
- retire `STE_ICT`
- stop allowing teaching-load ownership to be split across both umbrella `TLE` and child TLE rows
- keep remaining scheduler-relevant TLE rows visible without technical hiding
- keep the MATATAG non-split TLE direction intact

### D. Simplify specialization handling radically

The subject page must no longer present specialization as the main qualification model.

Required changes:
- remove editable specialization restriction toggling from normal subject CRUD
- remove technical text about Tier-1 / specialization-first teacher eligibility
- keep SPA/SPS specialization values visible only when needed for contract confirmation
- do not drive faculty qualification from specialization lists on this page

### E. Normalize subject duration to stakeholder block math

Treat `225` minutes/week as the settled duration contract for class-program subjects.

Apply this to:
- regular core
- TLE family
- STE rows
- SPA/SPS rows
- research rows

If any row must remain different, do not assume silently. Document the exact exception and why.

### F. Complete delete, archive, reactivation, and cleanup workflow

Repair the operator flow for blocked subject deletion and archived subject recovery.

You must add or improve:
- explicit archive action visibility
- explicit reactivate action visibility for archived rows
- active/archive discoverability through a simple switch
- direct remediation path for active blockers
- direct jump-to-Teaching-Load action already scoped to the blocking subject
- full-cleanup-and-delete path for inactive subjects that intentionally removes linked teaching-load rows
- historical cleanup flow that is explicit and safe

The page should no longer leave the scheduler in a state where delete is blocked, the row refreshes, and nothing actionable happens.

### G. Move global reset to Teaching Load

Do not keep the global teaching-load reset on the Subjects page.

Instead:
- move it to the Teaching Load page
- keep it privileged-only
- make it school-year-scoped
- keep it confirmation-gated
- keep it auditable
- show preview counts before reset

### H. Simplify the main subject table

Repair scanability and remove low-value technical noise.

Required changes:
- remove the dedicated pattern column
- remove day-pattern badges
- remove `System` button/toggle and `System` badge noise
- keep program scope fully visible in the table
- remove owner-department emphasis from the current `Scope & Owner` presentation
- reduce duplicated SPA/SPS badge signaling
- remove inter-section prominence from the everyday subject-table workflow

### I. Rework the subject coverage drawer into read-only subject context

The subject page is not the Teaching Load page.

Required changes:
- remove the `Assign` action from the drawer
- show currently assigned teachers only
- show better teacher detail
- show which sections they currently own/teach where data exists
- keep the Teaching Load page as the assignment/editing surface

## UX/UI Audit Requirements

You must re-audit and repair:
- subject row density
- active/archive discoverability
- archive/reactivate affordances
- delete/remediation flows
- CRUD form controls
- program-scope visibility
- department ownership controls
- specialization messaging
- subject-to-Teaching-Load handoff
- teacher-coverage drawer information architecture

Specific current concerns to validate and address:
- delete blocker modal needs actionable remediation, not just explanation
- program scope should replace lower-value owner-centric prominence in the table
- specialization technical messaging is wrong for the scheduler workflow
- the `Show system` control is unnecessary
- archived-subject reactivation is missing
- department filtering should let schedulers see which subjects are owned by which department and which still have no department
- current coverage drawer duplicates Teaching Load assignment behavior and should stop doing that
- duplicated SPA/SPS badges are visually noisy
- overlapping TLE/TLE-child subject assignments are real and must be cleaned up

## Explicit Non-Goals

Do not:
- redesign the whole shell/sidebar in this prompt
- reopen old TLE cohort logic
- keep day-pattern remnants around as hidden technical state
- preserve specialization-tier language just because it existed before
- silently keep stale `STE_ICT` / `TLE_IA_EXP` contract rows active

## Required Verification

You must prove:
1. day-pattern/session-pattern behavior is fully removed
2. department ownership is now a normalized, scheduler-usable control
3. `TLE_IA_EXP` is removed and `STE_ICT` is retired
4. TLE load overlap is no longer left in an ambiguous scheduler-facing state
5. specialization is no longer presented as a teacher-eligibility gate on this page
6. durations are normalized to `225` or any explicit exception is documented
7. blocked-delete remediation is usable
8. archived-subject reactivation works
9. global reset is removed from Subjects and correctly relocated to Teaching Load if implemented
10. the subject coverage drawer is read-only and more informative

At minimum verify with:
- server build/typecheck
- client build/typecheck
- direct DB checks on subject durations
- direct DB checks on TLE / `STE_ICT` / `TLE_IA_EXP` assignment rows
- direct DB checks on inactive-subject assignment blockers
- live UI validation of subject page filters, delete/archive/reactivate flow, and drawer behavior if feasible

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- If a check is noisy, narrow it silently.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Required Output

Return:
1. before-state summary
2. files changed
3. exact day-pattern removal completed
4. exact department-ownership control implemented
5. exact TLE family decision implemented
6. specialization simplification implemented
7. duration normalization applied
8. delete/archive/reactivation/remediation repairs
9. reset-flow relocation details
10. coverage-drawer changes
11. verification results
12. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if all of the following are true:
- day-pattern/session-pattern logic is fully removed from the subject workflow
- normalized department ownership controls are in place and scheduler-usable
- `TLE_IA_EXP` is removed and `STE_ICT` is retired
- TLE load overlap is no longer left as a confusing subject-page contract
- specialization values are no longer used as scheduler-facing teacher-eligibility rules on this page
- class-program subject durations are normalized to `225` min/week unless an explicit documented exception is proven
- delete remediation is actionable
- archived-subject reactivation is available
- program scope is clearer and more visible than before
- global reset no longer lives on the Subjects page
- the coverage drawer is read-only and supports better teacher/section inspection

If not, return `NO-GO` with the exact remaining blocker cluster.
