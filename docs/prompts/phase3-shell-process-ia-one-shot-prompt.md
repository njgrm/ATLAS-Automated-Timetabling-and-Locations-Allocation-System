# Gemini Execution Prompt: Phase 3 Shell Process IA + Sidebar One-Shot

## Objective

Repair the scheduler shell so the sidebar and page grouping reflect the real chronological ATLAS workflow instead of a loose domain dump.

This pass exists to:
- reduce setup overwhelm
- make the privileged scheduler flow legible from first use
- demote advanced/secondary tools that should not dominate the main path
- bring the shell into alignment with the revised subject-domain workflow
- reflect the cleaned `Faculty` and `Teaching Load` boundaries after the focused UX simplification passes
- finalize the renamed scheduler-facing route and label contract so later passes do not drift back to legacy wording

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/analysis/phase3-subject-domain-and-shell-audit-2026-05-21.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-subject-followup-audit-2026-05-21.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-faculty-teaching-load-performance-and-offline-audit-2026-05-22.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect these files directly:
- `atlas-client/src/components/AppShell.tsx`
- any related shell/sidebar UI primitives used by the current app shell
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/App.tsx`

## Context7 Preflight Summary

Before importing or changing shell/sidebar UI primitives or motion behavior:
- inspect local repo usage first
- use Context7 if any import path or version-sensitive behavior is uncertain
- do not guess APIs from memory

Record in your final output:
1. whether Context7 was needed
2. which behavior it confirmed
3. which local shell or page pattern you reused

## Facts To Treat As Settled

- The current sidebar grouping is not aligned to the actual scheduler process.
- `Specialization Mapping` is now assumed removed from the normal workflow.
- `Map Editor` should be expressed as part of school setup, not as an isolated technical tool.
- `Teaching Load` is now the correct home for:
  - assignment creation and editing
  - assignment reset / cleanup actions
  - subject-scoped remediation launched from blocked subject deletion
- `Subjects` is now a catalog + contract page, not the main assignment workflow.
- `Teachers` is the preferred scheduler-facing label for the roster/sync/quick-inspection page, even if internal model names remain `Faculty`.
- The preferred scheduler-facing frontend route contract is:
  - `/teachers`
  - `/teaching-load`
- The shell must not regress visible labels or primary nav links back to:
  - `Faculty`
  - `Assignments`
  - `/faculty`
  - `/assignments`
- The scheduler should not be forced through specialization-first setup before normal subject and teaching-load work.
- The current subject workflow still has some cleanup debt and jargon; the shell should not amplify that by over-promoting advanced or technical pages.
- The shell must anticipate this subject-page direction:
  - no `Specialization Mapping` in the core path
  - `Teaching Load` is the operational page for section/faculty assignment work
  - `Subjects` should be discoverable before `Teaching Load`, but should not contain destructive global reset controls
- The shell must also reflect the teaching-load simplification direction:
  - department-first assignment logic
  - reduced specialization-first framing
  - `Teachers` before `Teaching Load`
- The privileged scheduler workflow is better expressed as:
  1. overview
  2. setup
  3. faculty planning
  4. input collection
  5. build and validation
  6. advanced tools

## Required Target Order

For privileged scheduler/admin users, bias toward this order:

1. `Dashboard`

2. `School Setup`
- `Sections`
- `Campus & Rooms`
- `Subjects`

3. `Faculty Planning`
- `Teachers`
- `Teaching Load`

4. `Input Collection`
- `Preferences`
- `Room Requests`

5. `Build & Validate`
- `Timetable`
- `Room Schedules`
- `Audit`

6. `Advanced`
- only true advanced/admin tools that remain after the qualification reset

Faculty self-service pages remain grouped separately under faculty-only navigation.

Where legacy route aliases still exist for compatibility, they must be hidden from the primary scheduler nav and not presented as the preferred visible path.

## Scope

### A. Restructure the sidebar information architecture

Reorder and relabel groups so the shell communicates chronology clearly.

The shell should make it obvious that:
- subject catalog/contract setup happens before teaching-load assignment
- teaching-load assignment happens before timetable generation
- advanced mapping/repair pages are not part of the default happy path

### B. Improve page naming where necessary

Prefer operator-language labels over implementation-language labels.

Examples:
- `Map Editor` -> `Campus & Rooms`
- keep `Teaching Load` explicit rather than a vague staffing label
- prefer `Teachers` instead of `Faculty` for scheduler-facing shell labels, breadcrumbs, and page grouping
- preserve `Teachers` and `Teaching Load` in the primary scheduler nav even if internal component, file, or model names still use `Faculty`
- preserve `/teachers` and `/teaching-load` as the primary visible scheduler routes

### C. Demote advanced tools

Do not reserve privileged sidebar prominence for a removed or dead workflow concept.

### D. Reflect subject-workflow boundaries in navigation language

The shell labels and grouping should reinforce these boundaries:
- `Subjects` = subject contract, duration, scope, room preference, archive/reactivate
- internal `Faculty` model/page can remain implementation detail if needed
- visible scheduler-facing label should prefer `Teachers` for the roster, sync, and quick-inspection surface
- `Teaching Load` = teacher-to-subject and section assignment operations
- `Campus & Rooms` = physical inventory and room topology
- `Timetable` = generation, review, and validation

Do not use labels or grouping that suggest:
- teaching-load reset belongs inside `Subjects`
- specialization eligibility setup is the main prerequisite before `Teaching Load`
- advanced data repair pages belong in the main linear scheduler flow

### E. Reflect the calmer faculty-planning workflow

The shell should reinforce this faculty-planning sequence:
- open `Teachers` to inspect and sync roster state
- move to `Teaching Load` to create or adjust actual assignments

Do not imply that:
- `Faculty` and `Teaching Load` are interchangeable
- assignment work starts before subject and roster setup are visible

### F. Preserve shell quality

Do not regress:
- the no-scroll layout contract
- route transitions
- faculty-only shell behavior
- sidebar collapse behavior
- the already-established `Teachers` / `Teaching Load` naming and primary route contract

## UX/UI Audit Requirements

Audit and explicitly report:
- scanability of the sidebar
- workflow coherence
- label clarity
- group hierarchy
- faculty/admin role separation
- collapse-state behavior
- whether the shell makes the `Subjects` -> `Teaching Load` -> `Timetable` sequence obvious
- whether the shell makes the `Teachers` -> `Teaching Load` relationship obvious
- whether technical/repair pages are properly demoted
- whether labels reduce the mental load created by current subject-page complexity instead of amplifying it
- whether the shell now supports the calmer department-first teaching-load workflow rather than the older specialization-heavy one
- whether the shell now keeps primary scheduler navigation aligned to:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- whether any stale `Faculty` / `Assignments` wording remains in privileged scheduler nav, breadcrumbs, or shell-level route labels

## Explicit Non-Goals

Do not:
- redesign page internals in this prompt
- change underlying business logic for generation
- reopen subject-domain data issues already handled in the subject reset prompt
- reintroduce `Faculty` / `Assignments` as the preferred scheduler-facing shell labels

You may, however, rename navigation labels and regroup pages based on the verified subject-workflow direction above.

## Verification Gates

- client build/typecheck
- shell/navigation code review
- if a live shell check is available, verify the reordered navigation visually
- verify that primary scheduler nav links and labels resolve to `Teachers` and `Teaching Load`, not back to legacy names

## Required Output

Return:
1. before-state shell problems
2. files changed
3. final sidebar/process order
4. any labels renamed
5. any route-label regressions removed or compatibility aliases intentionally hidden
6. role-specific behavior preserved
7. how the shell now reflects `Teachers`, `Subjects`, and `Teaching Load` boundaries
8. verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the sidebar now reflects the chronological scheduler process
- advanced tools are demoted appropriately
- shell layout behavior is preserved
- labels are clearer and less technical for operators
- the primary scheduler shell no longer regresses to visible `Faculty` / `Assignments` naming or links

If not, return `NO-GO` with the exact remaining shell IA blockers.
