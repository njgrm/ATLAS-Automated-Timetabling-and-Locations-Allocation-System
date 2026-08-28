# Prompt 2: Teachers AdminDataTable Pilot

## Mission

Create the first UI-only `AdminDataTable` pilot on `/teachers`.

This prompt proves the shared admin table pattern without changing backend pagination/search contracts.

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

- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/*`
- existing admin shell/table helpers such as `AdminWorkspaceFrame`, `AdminSearchFilterToolbar`, `AdminTableShell`, and `AdminStatePanel`
- `atlas-client/src/ui/*` for available primitives

## Product Decisions

- `/teachers` is the pilot page.
- This pass is UI-only over existing client-side data.
- The new shared component must accept future pagination props, but must not require backend pagination now.

## Scope

In scope:

- Shared `AdminDataTable` component/pattern.
- `/teachers` conversion to the pattern.
- Mobile-card fallback for teacher rows.
- Loading, empty, error, no-results, and saved-data states.
- Evidence-log update.

Out of scope:

- Backend pagination/search.
- Subjects/Sections/Teaching Load table conversions.
- Route renames.
- Faculty sync behavior changes beyond preserving existing actions.

## Mandatory Outcomes

### 1. Build reusable table contract

Create or refine a shared `AdminDataTable` pattern with:

- column definitions with labels and optional descriptions
- visible sort state where sorting exists
- clear empty/loading/error/no-results states
- row action contract: one visible primary action, secondary actions in a menu, destructive actions separated
- mobile/narrow card fallback
- optional `page`, `pageSize`, `total`, and `onPageChange` props for later backend pagination

### 2. Convert `/teachers`

Preserve:

- faculty sync/refresh action
- source-state badges
- placeholder/Teacher X status
- department and specialization metadata
- `Review teaching load` action
- current filtering/search behavior unless broken

Improve:

- row hierarchy: name first, department/source/load second, metadata third
- action clarity
- mobile readability
- saved/live/no-data state copy

### 3. Keep visual system compliant

- Use shadcn/Radix primitives and lucide icons.
- No raw native `<button>`, native `<select>`, `<details>`, or `title=` in touched UI.
- No nested card-inside-card table shells.
- Preserve ATLAS SMART-family page rhythm.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- line-count check for touched React files
- primitive scan for lowercase native `<button`, lowercase native `<select`, `<details`, and `title=`

Browser/Tailnet smoke:

- `/teachers` desktop
- `/teachers` narrow/mobile viewport
- search/filter behavior
- primary `Review teaching load` action
- teacher detail/profile action if still present

Self-correction requirement:

- If build, scan, line-count, or smoke check fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- `AdminDataTable` API summary
- `/teachers` behavior preserved and changed
- viewport/smoke evidence
- build result
- prompt-scope `GO` or `NO-GO`