# Gemini Execution Prompt: Phase 3 Faculty Modernization One-Shot

## Objective

Modernize the `Faculty` page so it matches the newer ATLAS scheduler UX standard established by `Subjects`, while keeping `Faculty` clearly scoped as:

- the roster and sync page
- the quick-inspection page
- the entrypoint into `Teaching Load`

This is a focused UX/UI and interaction pass.
It is not a broad teaching-load or generator refactor.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-subject-page-post-gemini-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/AppShell.tsx`
- any shared UI primitives or page-local components used by `Faculty.tsx`

## Context7 Preflight Summary

Before importing or changing any UI primitive or animation pattern:
- inspect local repo usage first
- use Context7 if any import path, Radix/shadcn behavior, or `motion` behavior is uncertain
- do not guess component APIs from memory

Record in your final output:
1. whether Context7 was needed
2. which component or library behavior it was used to confirm
3. which local page/component pattern you reused as the primary baseline

## Facts To Treat As Settled

- `Faculty` should feel calmer and simpler than `Teaching Load`.
- `Faculty` should not become a second assignment-management workspace.
- `Faculty` should follow the modern visual direction already present on `Subjects`.
- `Teaching Load` remains the authoritative page for assignment creation/editing.
- The current `Faculty` page still has:
  - legacy-feeling toolbar density
  - plain loading treatment
  - no quick profile drilldown
  - raw HTML button usage
  - visible mojibake/encoding issues

## Scope

### In Scope

#### A. Modernize the page header and filter layout

Bring `Faculty` in line with the `Subjects` interaction model.

Target direction:
- stronger primary toolbar
- clearer separation of search, primary actions, and optional filters
- cleaner visual grouping
- sticky/translucent header pattern if appropriate within current shell constraints

#### B. Improve roster scanability

Make the roster easier to scan quickly.

Target direction:
- clearer hierarchy for name, department, and roster status
- calmer table density
- stronger sync-state communication
- better handling of zero-subject / excluded / overloaded states

#### C. Add quick profile drilldown

Add a scheduler-friendly read-only profile drilldown for a selected faculty member.

The drilldown should help users inspect:
- roster identity
- department
- contact info if present
- scheduling status
- high-level current load summary
- current assigned subjects and section count summary

Do not turn this into a second full teaching-load editor.

#### D. Improve loading and empty states

Replace unfinished-feeling loading and empty states with structural, polished states.

#### E. Remove polish regressions

Fix:
- visible mojibake / replacement-character issues
- raw HTML interactive controls where ATLAS UI primitives should be used

### Out Of Scope

Do not:
- redesign `Teaching Load` in this prompt
- move assignment-editing actions onto `Faculty`
- change generator/business logic
- rewrite shell/sidebar grouping in this prompt

## UX Requirements

- Preserve the no-scroll architecture.
- Use ATLAS UI primitives only for interactive controls.
- Avoid micro-text as the main way to fit content.
- Keep destructive or repair actions secondary to the main sync/inspection flow.
- Ensure the page remains friendly on smaller laptop widths and mobile-responsive states.

## Implementation Steps

1. Audit the current `Faculty` structure against `Subjects`.
2. Refactor page structure if needed into extracted subcomponents rather than growing one large file.
3. Modernize the header/filter region.
4. Improve the roster table hierarchy and empty/loading states.
5. Add a read-only quick profile sheet or similarly durable drilldown surface.
6. Fix encoding and primitive-usage regressions.
7. Run verification.

## Verification Gates

Required:
- client build/typecheck
- code review for raw HTML interactive controls
- visual/code verification of:
  - loading state
  - empty roster state
  - filtered no-results state
  - populated roster state
  - quick profile drilldown

If live page validation is available, check the rendered `Faculty` page as well.

## Required Output

Return:
1. before-state problems
2. files changed
3. header/filter modernization completed
4. roster scanability improvements completed
5. quick profile drilldown added
6. loading/empty-state improvements completed
7. encoding and primitive fixes completed
8. verification results
9. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- `Faculty` now visually aligns with the newer ATLAS page standard
- the page is clearly roster-first and not assignment-overloaded
- quick profile inspection exists
- loading and empty states no longer feel unfinished
- raw HTML control regressions are removed
- visible encoding glitches are removed

If not, return `NO-GO` with exact remaining blockers.
