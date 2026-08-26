# Prompt 4: Tactical Bottom Dock Live Sandbox V1

## Mission

Add the `/timetable` Tactical Bottom Dock for local sandbox repair.

Schedulers must be able to select one timetable cell, see eligible teachers for that subject/section, preview a reassignment locally, and reset or close without saving.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- `ScheduleReviewWorkspace.tsx`
- timetable selection state components/hooks
- manual edit preview logic
- timetable grid/cell components
- Teaching Load candidate/read helpers
- existing Drawer/Sheet primitives

## Product Decisions

- Use a context-aware bottom Drawer/Dock, not the full Teaching Load page.
- The dock is scoped to selected subject, section, teacher, term, and school year.
- Include subject-scoped bulk expansion for same-subject eligible sections only.
- Sandbox changes are local until `Commit Changes`.
- This prompt does not persist changes. Persistence comes in Prompt 5.

## Scope

In scope:

- Bottom Dock shell.
- Selection-to-dock context.
- Eligible teacher list for selected subject/section.
- Stacked load bars using Prompt 1 semantics.
- Subject-scoped bulk section selection.
- Local sandbox state and conflict highlighting.
- Reset and close-without-saving behavior.

Out of scope:

- Persisting sandbox changes.
- Published revision workflow.
- Full Teaching Load embed.
- Backend algorithm changes.

## Mandatory Outcomes

### 1. Dock shell and accessibility

- Use a named Drawer/Dock/Sheet primitive appropriate for the current design system.
- Include accessible title and description.
- Keep it collapsible and bottom-oriented for timetable context.
- Avoid viewport death and nested-scroll traps.

### 2. Context-aware candidate view

When a scheduler selects a cell, the dock must show:

- selected subject
- selected section
- current teacher
- term/school year context where available
- eligible teacher candidates only
- each candidate's teaching hours, advisory/ancillary credit, credited workload, and cap state

### 3. Subject-scoped bulk expansion

Inside the dock, show a constrained area for same-subject repair:

- other unassigned or repair-eligible sections for the selected subject
- selectable rows or checkboxes
- clear copy that bulk scope is limited to this subject
- no broad teacher table or full Teaching Load grid

### 4. Live sandbox preview

When the scheduler chooses a candidate:

- update the timetable locally
- highlight moved/changed blocks
- show red-border conflict indicators for local conflicts
- do not call commit/persistence endpoints
- keep `Reset Sandbox` and `Close without saving` visible

### 5. Compatibility with stale-input banner

If Prompt 3 stale state exists, do not hide it. The dock should coexist with stale warning and repair/regenerate choices.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- line-count check for touched React files
- primitive scan for lowercase native `<button`, lowercase native `<select`, `<details`, and `title=`

Browser/Tailnet smoke:

- open `/timetable`
- select a generated timetable cell
- verify dock opens with scoped context
- preview reassignment locally
- verify changed block highlight and conflict border behavior
- reset sandbox
- close without saving and confirm no persistence occurred
- verify subject-scoped bulk selection stays constrained

Self-correction requirement:

- If build, line-count, primitive scan, dock behavior, or sandbox reset fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- dock component/state summary
- sandbox behavior verified
- screenshots or browser-smoke notes
- build result
- prompt-scope `GO` or `NO-GO`