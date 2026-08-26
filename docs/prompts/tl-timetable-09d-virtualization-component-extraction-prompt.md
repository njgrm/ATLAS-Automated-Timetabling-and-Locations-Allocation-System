# Prompt 9d: Virtualization And Oversized Component Extraction

## Mission

Reduce render pressure by virtualizing large lists/grids and extracting oversized React files before adding more feature logic.

This prompt is a performance and maintainability follow-up after UI contracts and pagination/search have stabilized.

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

Inspect before editing:

- `ScheduleReviewWorkspace.tsx`
- `ScheduleReviewDialogs.tsx`
- `LeftRailContent.tsx`
- `ManualEditPanel.tsx`
- `FacultyRoomPreferences.tsx`
- Teaching Load grids/lists
- Room Schedules and public schedule selectors

## Scope

In scope:

- Extract oversized React files into focused components.
- Virtualize high-volume lists where current rendering is heavy.
- Memoize heavy row/cell components where warranted.
- Preserve keyboard and mobile usability.

Out of scope:

- New product features.
- Backend query redesign.
- Visual redesign beyond necessary extraction.
- Generator algorithm changes.

## Mandatory Outcomes

### 1. File-size compliance

Any touched React file must be under 1000 lines after the pass.

If a file is already over 1000 lines and must be touched, extract before adding logic.

### 2. Virtualize only where it helps

Prioritize:

- Teaching Load large grids/lists
- Schedule Review side rails
- Room Schedules large selectors
- public schedule selectors
- room request lists if large

Do not virtualize tiny lists just to satisfy a pattern.

### 3. Preserve accessibility and interaction

Virtualized rows must still support:

- keyboard navigation where previously supported
- visible focus states
- screen-reader labels for actions
- stable mobile behavior

### 4. Prove performance improvement

Capture before/after evidence where feasible:

- load/render timing
- row count handled
- browser responsiveness notes
- no horizontal overflow

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- line-count report for touched React files
- primitive scan for touched files
- browser smoke for each virtualized/extracted surface
- basic keyboard/focus check for virtualized rows

Self-correction requirement:

- If build, line-count, focus, or smoke checks fail, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- extraction summary
- virtualization targets and rationale
- line-count table
- performance/browser evidence
- build result
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`