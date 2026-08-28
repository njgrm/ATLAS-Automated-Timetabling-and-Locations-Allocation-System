# UX Rehaul Prompt 15: Admin Pages Cross-QA Gate

## Mission

Run the post-implementation UX gate for the admin pages from Sections through Audit.

This prompt is QA/repair only. Do not redesign `/timetable` and do not start new feature work.

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
- `docs/prompts/ux-rehaul-08-sections-smart-setup-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-09-subjects-smart-curriculum-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-10-teachers-roster-health-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-11-teaching-load-state-clarity-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-12-campus-rooms-polish-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-13-schedules-browser-one-shot-prompt.md`
- `docs/prompts/ux-rehaul-14-audit-readiness-report-one-shot-prompt.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`
- `atlas-shared-browser-qa`

## Routes In Scope

Audit and verify:

- `/sections`
- `/subjects`
- `/teachers`
- `/teaching-load`
- `/map`
- `/map?mode=editor`
- `/schedules`
- `/audit`

Explicitly out of scope:

- `/timetable`
- `/my/*`
- `/public/schedules`

## Required Checks

### 1. Design-System Compliance

Confirm:

- no native `<select>` in touched surfaces
- no raw `title=` in touched surfaces
- no `<details>` in touched surfaces
- icon-only controls have `aria-label` and tooltip/explanation
- dialogs/sheets/drawers have accessible title and description
- no hardcoded emerald brand surfaces
- grade colors follow G7 green, G8 yellow, G9 red, G10 blue only when grade meaning is encoded

### 2. Page Communication

Every page must visibly answer:

- what this page is for
- what status the data is in
- what the user should do next
- what to do if data is missing or unavailable

### 3. SMART Identity

Confirm:

- token-driven brand surfaces
- light slate/white page rhythm
- task-first hierarchy
- compact inline stats instead of huge metric walls
- one dominant primary action per page state
- no ornamental hero/decorative redesign

### 4. Layout QA

Check desktop, mobile portrait, and mobile landscape/tablet where practical.

Confirm:

- no global horizontal overflow
- primary scroll is local
- toolbar/header does not cover content
- important text does not clip
- tables/grids remain usable

### 5. Functional Smoke Checks

Verify:

- Sections: search/filter, home-room state visibility, detail sheet
- Subjects: search/filter, coverage drilldown, add/edit/archive dialog accessibility
- Teachers: search/filter, teacher profile/detail surface
- Teaching Load: mode switching, read-only/degraded copy, staffing audit/auto-fill surfaces
- Campus & Rooms: overview/editor modes, zoom/pan, building click, room overlay
- Schedules: mode switching, entity selection, latest/run ID controls
- Audit: readiness groups, fix links, no duplicate-key console warning

## Verification Commands

Run:

- `npm --prefix atlas-client run build`

Line-count check all touched React files. No touched file may exceed 1000 lines.

## Evidence Requirements

Capture before/after if any Critical or Major issue remains during this gate.

Minimum after screenshots:

- `qa-artifacts/playwright/20260530-admin-sections-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-subjects-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-teachers-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-teaching-load-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-campus-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-schedules-gate-after.png`
- `qa-artifacts/playwright/20260530-admin-audit-gate-after.png`

## Required Output

Return:

1. Route-by-route GO/NO-GO table.
2. Remaining findings by severity.
3. Files changed during repair loop, if any.
4. Screenshot evidence.
5. Build result.
6. Final cross-page `GO`, `CONDITIONAL GO`, or `NO-GO`.
