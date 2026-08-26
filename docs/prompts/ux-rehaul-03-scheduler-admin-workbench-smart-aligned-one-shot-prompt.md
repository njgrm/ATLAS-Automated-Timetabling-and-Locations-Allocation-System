# UX Rehaul Prompt 03: Scheduler/Admin Workbench Refactor + SMART Identity One-Shot

## Mission

Refactor the largest scheduler/admin workbench files below the 1000-line rule and redesign them so ATLAS feels like the SMART product family while preserving the power needed for schedule generation, review, and repair.

This is the heavy operator pass. It must not flatten expert workflows into simplistic cards, but it must stop looking like an internal engineering console.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-full-audit-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/modals/ScheduleReviewDialog.tsx`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `atlas-client/src/components/ManualEditPanel.tsx`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`
- SMART references under `external-references/FINAL-CAPSTONE-SMART/src/layouts/*` and `src/pages/teacher/*` for identity cues only

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-algorithm-benchmark-gate/SKILL.md` only if generation behavior or algorithm outputs are touched; avoid touching them
- `.github/skills/atlas-shared-browser-qa/SKILL.md` if doing browser QA

Use Context7 for Radix/shadcn/motion behavior if uncertain.

## SMART Identity Target For Workbenches

Adopt:

- role-specific operator portal feel
- white panels on light slate background
- emerald/theme-primary active and primary states
- rounded but not oversized work surfaces
- task/object cards only for real work items like teacher, section, room request, blocker
- clear top bar/header naming the current scheduling job
- approachable copy that still respects scheduler expertise

Do not copy SMART's teacher-dashboard scale. Workbenches need compact, structured density.

## Hard Scope

Primary refactor targets:

- `FacultyAssignments.tsx`
- `ScheduleReviewWorkspace.tsx`
- `ScheduleReviewDialog.tsx`
- `LeftRailContent.tsx`
- `ManualEditPanel.tsx`

Secondary redesign targets if time remains after refactor safety:

- `RoomSchedules.tsx`
- `CampusMapEditor.tsx`
- `Subjects.tsx`
- `Faculty.tsx`
- `Sections.tsx`

Do not change backend contracts, scheduling algorithms, Prisma schema, or generation scoring unless a compile/runtime break requires a minimal fix.

## Mandatory Refactor Outcomes

### 1. Refactor `FacultyAssignments.tsx`

Bring it under 1000 lines.

Extract at minimum:

- `components/faculty-assignments/FacultyAssignmentsPageShell.tsx`
- `components/faculty-assignments/AssignmentModeRouter.tsx`
- `components/faculty-assignments/TeachingLoadStatusBanners.tsx`
- `components/faculty-assignments/AssignmentAdvancedControls.tsx`
- feature hooks/helpers if needed for data and view model state

Do not rewrite assignment business logic during extraction.

### 2. Refactor `ScheduleReviewWorkspace.tsx`

Bring it under 1000 lines, ideally under 800.

Extract at minimum:

- `components/timetable/workspace/ScheduleReviewHeader.tsx`
- `components/timetable/workspace/PublishReadinessBanner.tsx`
- `components/timetable/workspace/ScheduleGridRegion.tsx`
- `components/timetable/workspace/ScheduleWorkspaceActions.tsx`
- `components/timetable/workspace/ScheduleWorkspaceState.tsx` if useful

Add a clear `Can this be published?` readiness header.

### 3. Refactor `ScheduleReviewDialog.tsx`

Bring it under 1000 lines.

Extract:

- `ReviewSummarySection.tsx`
- `ViolationListSection.tsx`
- `PublishConfirmationSection.tsx`
- `ReviewDialogFooter.tsx`

Verify dialog title/description semantics and focus behavior.

### 4. Refactor `LeftRailContent.tsx`

Bring it under 1000 lines.

Extract:

- `ViolationsPanel.tsx`
- `UnassignedPanel.tsx`
- `PinnedPanel.tsx`
- `RoomRequestsPanel.tsx`
- `LeftRailEmptyState.tsx`

Each panel owns its empty state and copy.

### 5. Refactor `ManualEditPanel.tsx`

Bring it under 1000 lines.

Extract:

- `ManualEditForm.tsx`
- `ManualEditConflictSummary.tsx`
- `ManualEditActions.tsx`
- `ManualEditStatusBanner.tsx`
- `useManualEditDraft.ts`

Do not change save semantics.

## Mandatory UX Outcomes

### 1. Teaching Load becomes guided but still powerful

The primary view should distinguish:

- teacher transcription / assignment workflow
- shortage / allocation workflow
- advanced audit/autofill tools

The first viewport should say what is ready, what is missing, and the one next action.

### 2. Timetable becomes publish-readiness-first

The top of `/timetable` should answer:

- Can this schedule be published?
- What must be fixed before publishing?
- What warning can be reviewed later?

Use `Must fix before publishing` and `Warning` instead of hard/soft jargon in primary copy.

### 3. Room schedules hide run mechanics

Move run selectors/version details behind advanced controls.

Default copy should use:

- `Most recent schedule`
- `Official schedule` where published
- `No schedule attempt has been created yet`

### 4. Map editor gets clearer SMART-family toolbar treatment

Mode controls should be explicit and accessible:

- Select
- Draw building
- Manage rooms
- Upload photo
- Remove photo if available

Icon-only controls need tooltips and accessible labels.

### 5. Setup pages translate technical metadata

Apply the language standard on setup pages touched by this pass:

- `Offering contract` -> `Subject requirements`
- `Mirror` -> `Saved copy`
- `Source` -> `Data status`
- `Quarantine` -> `Needs review`
- `Split-brain` -> `Conflicting saved data`

Technical detail may remain behind explicit details disclosure.

## Visual Requirements

- Match SMART family through palette, shell rhythm, white surfaces, role headers, rounded active controls, and school branding.
- Keep dense tables and grids where they are the fastest operator tool.
- Reduce badge spam and rainbow row tinting.
- Use inline stat banners instead of metric-card walls.
- Keep advanced controls grouped away from primary task controls.
- Avoid decorative blobs/orbs and giant marketing-style hero sections.

## Accessibility Requirements

- No hover-only core actions.
- No raw `title` as the only accessible label.
- Dialogs must have title/description semantics.
- Icon-only controls must have tooltips and accessible names.
- Keyboard focus must stay visible in panels, dialogs, and grid controls.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- line count check for every targeted >1000-line file
- route smoke checks for:
  - `/teaching-load`
  - `/timetable`
  - `/room-schedules`
  - `/map`
  - `/subjects`
  - `/teachers`
  - `/sections`
- if backend/server is affected or built assets are required, run the relevant server build/start checks per repo rules

Do not claim algorithm correctness changes unless algorithm benchmark gates were intentionally run.

## Required Output

Return:

1. before-state problems fixed
2. files changed
3. refactor summary with before/after line counts
4. SMART identity changes applied
5. teaching-load workflow clarity summary
6. timetable publish-readiness summary
7. setup/workbench copy cleanup summary
8. accessibility notes
9. verification results
10. remaining risks
11. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- all targeted >1000-line files touched by the prompt are below 1000 lines
- teaching-load and timetable first viewports are action/blocker-first
- main-path scheduler copy avoids internal jargon
- SMART-family identity is visible without losing ATLAS operational density
- changed controls are accessible and primitive-based
- local build passes
