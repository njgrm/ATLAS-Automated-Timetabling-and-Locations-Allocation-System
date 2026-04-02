# Phase 4 Plan - Review And Manual Adjustment

## Status
- State: In Progress
- Started: 2026-04-02

## Scope
- Officer review workspace for generated schedules
- Conflict/warning visibility and resolution workflow
- Manual adjustments with optimistic locking and auditability

## Planned Deliverables
- [x] Review console UI with conflict overlays and filtering (Batch 1)
- [x] Generate + Publish workflow with violation guardrails (Batch 2)
- [x] Grid pivot modes: View By Section / Faculty / Room (Batch 2)
- [ ] Manual move/reassign actions with validation guards
- [ ] Revalidation trigger and updated violation report after edits
- [ ] Audit log entries for manual adjustments

## Batch 1 — Review Console UI Foundation (2026-04-02)
- Unlocked Timetable sidebar nav for admin/officer/SYSTEM_ADMIN
- Created `ScheduleReview.tsx` page at `/timetable` route
- Three-panel layout: violation panel (left), timetable grid (center), entry detail (right)
- Run selector (latest + specific run ID) and section filter
- Filter chips: All / Hard / Soft / Conflicts
- Inline stat banner: status, assigned/total, hard violations, total violations, duration, timestamp
- Violation panel with search, grouped by code, severity badges, click-to-highlight
- Timetable grid with day x time matrix, color-coded entries by violation severity
- Entry detail panel with subject/section/faculty/room info, linked violations, DepEd grade badges
- Placeholder action buttons (Reassign Faculty, Move Timeslot, Change Room) with tooltip "Phase 4 edit API pending"
- Mark for Follow-up session-local triage tag
- Loading skeletons, empty states (no runs, no entries, no violations), error state with retry
- Types added: GenerationRun, RunSummary, ScheduledEntry, Violation, ViolationReport, DraftReport

## Batch 2 — Review UI Workflow Expansion (2026-04-02)
- **Generate New Timetable:** Play button triggers `POST /generation/:schoolId/:schoolYearId/runs`; confirmation dialog warns if follow-up flags exist; disabled while generating/loading
- **Publish Schedule:** Send button disabled when hard violations > 0; dialog with soft violation summary + acknowledgment Checkbox; publish action is Phase 5 placeholder (toast)
- **Grid Pivot Modes:** View By selector (Section / Faculty / Room) in toolbar; client-side pivot with `pivotEntityIds`, `pivotLabel`, `pivotKeyOf`; room reference data from buildings endpoint
- Installed `@radix-ui/react-checkbox`; created `atlas-client/src/ui/checkbox.tsx` (shadcn Checkbox)
- Enhanced empty state: no-runs now includes Generate button
- Room map loaded from buildings API at `/map/schools/:schoolId/buildings`

## Exit Criteria
- Officer can resolve findings and revalidate
- Publish path is blocked while hard violations remain
- Edit conflicts are safely handled and communicated
