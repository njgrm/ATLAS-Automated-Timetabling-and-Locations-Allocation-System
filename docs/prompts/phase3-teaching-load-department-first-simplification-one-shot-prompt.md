# Gemini Execution Prompt: Phase 3 Teaching Load Department-First Simplification One-Shot

## Objective

Simplify the `Teaching Load` page (`FacultyAssignments`) so it becomes a scheduler-friendly, department-first assignment workspace instead of a specialization-heavy control room.

This pass should reduce cognitive overload while preserving the page's role as:

- the authoritative manual placement surface
- the home of assignment save/discard/reset behavior
- the place where schedulers translate department decisions into actual teacher-to-subject and section ownership

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-subject-domain-and-shell-audit-2026-05-21.md`
- `docs/analysis/phase3-subject-followup-audit-2026-05-21.md`

Inspect directly:
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/qualification.service.ts`
- any route/service files directly used by the page if UI wording or interaction depends on their response contract

## Context7 Preflight Summary

Before importing or changing UI primitives, motion behavior, or any component pattern:
- inspect local repo usage first
- use Context7 if component API or import behavior is unclear
- do not guess current library behavior

Record in your final output:
1. whether Context7 was used
2. which behavior it confirmed
3. which local pattern you followed instead of inventing a new one

## Facts To Treat As Settled

- `Teaching Load` is the authoritative manual placement surface.
- Manual placements must remain authoritative and must not be silently overwritten.
- Qualification direction is department-first, not specialization-first.
- The scheduler should not have to reason about specialization-tier theory on this page.
- `Specialization Mapping` is being removed from the normal workflow.
- The current page still has too much visible complexity:
  - specialization filters and labels
  - tiny type
  - overloaded sidebar
  - tooltip-only breakdown
  - destructive/global repair actions too close to everyday actions

## Scope

### In Scope

#### A. Reset the page around department-first qualification

The page must visibly and behaviorally align with the department-first model.

Required direction:
- remove or demote scheduler-facing specialization-first framing
- remove wording such as:
  - `Qualified Based On Specialization`
  - `Outside Specialization`
  - `Specialization Match`
  - similar tier-language that no longer reflects the intended workflow
- default qualification communication should be department-based

#### B. Simplify the left sidebar

The left rail should primarily help users find a teacher.

Reduce clutter by reassessing:
- specialization filter prominence
- unmapped-specialization toggles
- too many small chips/toggles in the navigation rail
- dense control packing

The result should be:
- easier scanning
- clearer teacher selection
- less control noise before any teacher is selected

#### C. Improve selected-teacher workspace clarity

The right workspace should more clearly separate:
- teacher summary
- current load status
- assignment editing
- advanced analysis

Required direction:
- calmer and more legible summary area
- less micro-text
- better hierarchy for actual load, credited load, and policy load

#### D. Replace fragile breakdown patterns

Important load details must not depend on tooltip-only reading.

Replace or redesign the current `Breakdown` interaction into a more durable inspection pattern.

#### E. Separate routine actions from destructive/admin actions

The page should not visually treat:
- save/discard/undo/redo
- global reset
- staffing repair
- autofill

as if they are the same kind of action.

Keep routine assignment actions closest to the assignment workspace.
Push broader repair/admin actions into a calmer, more explicitly advanced zone.

#### F. Preserve assignment authority and repair flows

Do not regress:
- save/discard/undo/redo
- selected-faculty reset draft behavior
- global reset confirmation safety
- staffing-needs inspection

But make those flows clearer and less overwhelming.

### Out Of Scope

Do not:
- redesign the shell/sidebar grouping in this prompt
- rework the entire backend generation strategy
- turn the page into a read-only analytics dashboard
- move assignment editing out of Teaching Load

## UX Requirements

- No raw HTML interactive controls where ATLAS primitives should be used.
- No micro-text as the default density strategy.
- The page must remain keyboard- and touch-friendly.
- Important operational detail should live in persistent or durable inspection surfaces, not only hover states.
- The left rail should be calmer than it is now.
- The page should feel more guided and less like an admin console.

## Implementation Steps

1. Audit the current page against the department-first direction and the latest UX audit.
2. Simplify the left rail around teacher navigation first.
3. Remove specialization-first visible framing.
4. Improve the selected-teacher summary hierarchy.
5. Replace tooltip-only breakdown with a stronger inspection pattern.
6. Reorganize action zones so routine vs destructive actions are more clearly separated.
7. Verify that manual assignment authority is preserved.
8. Run verification.

## Verification Gates

Required:
- client build/typecheck
- code verification that specialization-first scheduler-facing wording is removed or materially reduced
- code verification that manual save/discard/reset authority remains intact
- inspection of:
  - left rail before teacher selection
  - selected teacher summary
  - assignment editing flow
  - breakdown/detail inspection
  - global reset and staffing-needs affordances

If live validation is available, visually check the page too.

## Required Output

Return:
1. before-state problems
2. files changed
3. department-first simplifications completed
4. sidebar simplifications completed
5. workspace clarity improvements completed
6. breakdown/inspection improvements completed
7. action-separation improvements completed
8. preserved authority/repair behaviors
9. verification results
10. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the page is materially less overwhelming
- specialization-first scheduler-facing complexity is removed or clearly demoted
- the sidebar is calmer and more navigator-focused
- important load details are no longer trapped in fragile tooltip-only patterns
- manual assignment authority remains intact
- destructive/admin actions are more clearly separated from daily assignment work

If not, return `NO-GO` with the exact remaining blockers.
