# UX Rehaul Prompt 09: Subjects SMART Curriculum One-Shot

## Mission

Redesign `/subjects` around curriculum readiness and coverage clarity, not raw catalog management.

This page should answer: what subjects are schedulable, what coverage risk exists, and what the scheduling officer should fix next.

Do not touch `/timetable`.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect:

- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/components/subjects/DeleteSubjectDialog.tsx`

## Current UX Findings

- Live sampling showed a table-first page with `Filters`, `Add Subject`, table headers, and many row actions, but weak first-screen explanation.
- `Sync Offering Contract` is technical and unclear to non-developer operators.
- `Room Pref.`, owner/scope labels, rotating term labels, and archive/reactivate actions need clearer task framing.
- The page risks feeling like a database catalog instead of a scheduler-facing curriculum readiness tool.

## Scope

Allowed source files:

- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/*`
- shared admin pattern components from Prompt 07
- docs/evidence files

Do not change subject API behavior, generation behavior, or timetable components.

## Mandatory Outcomes

### 1. Page Header And Primary Action

Add a clear page header:

- title: `Subjects`
- purpose: `Review the curriculum subjects that can be scheduled for this school year.`
- primary action: `Add subject`
- secondary action: rename/clarify sync as `Refresh offerings` or `Refresh from enrollment setup`

Explain sync in plain language: it checks which subjects/program offerings should be active for the current school year.

### 2. Curriculum Readiness Summary

Add compact inline stats:

- active subjects
- archived subjects
- subjects missing teacher coverage
- specialized/room-constrained subjects, if data is available

Avoid huge metric cards.

### 3. Row And Column Language

Improve labels:

- `Duration` -> `Weekly time`
- `Room Pref.` -> `Room need`
- `Scope & Owner` -> `Programs and owner`
- explain rotating term subjects in plain language
- make archive/reactivate intent clear and confirm destructive or risky actions

### 4. Coverage Drilldown

Make coverage drilldown easier to understand:

- show assigned teachers first
- show uncovered grade/program scope clearly
- link to Teaching Load for fixes
- avoid raw implementation labels in the primary view

### 5. Form And Dialog Clarity

Subject add/edit dialogs must use labeled field groups and helper copy that explains why fields matter.

Dangerous actions must use `Dialog` with accessible title/description.

### 6. Mobile/Tablet Behavior

At narrow widths, the page must still show purpose, stats, and the primary action before the table/list.

## Verification Requirements

Run:

- `npm --prefix atlas-client run build`

Browser QA:

- `/subjects` desktop
- `/subjects` mobile portrait
- subject coverage drilldown
- add/edit subject dialog
- archive/reactivate dialog

Check:

- no native `<select>`, no raw `title`, no `<details>`
- dialogs have title and description
- no hardcoded emerald for brand surfaces
- no global horizontal overflow

Evidence screenshots:

- `qa-artifacts/playwright/20260530-admin-subjects-desktop-after.png`
- `qa-artifacts/playwright/20260530-admin-subjects-coverage-after.png`
- `qa-artifacts/playwright/20260530-admin-subjects-mobile-after.png`

## Required Output

Return files changed, UX improvements, copy changes, screenshots, build result, and `GO`/`NO-GO`.
