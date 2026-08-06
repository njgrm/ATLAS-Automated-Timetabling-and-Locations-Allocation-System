import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

test('shared controls use the older-user-safe default target sizes', () => {
	const buttonVariants = source('src/ui/button-variants.ts');
	const input = source('src/ui/input.tsx');

	assert.match(buttonVariants, /sm:\s*["'][^"']*h-10/);
	assert.match(buttonVariants, /'icon-sm':\s*["'][^"']*size-10/);
	assert.match(input, /flex h-10 w-full/);
});

test('the global typography contract does not force negative tracking', () => {
	const css = source('src/index.css');

	assert.doesNotMatch(css, /letter-spacing:\s*-0\.0/);
	assert.match(css, /focus-visible[^}]*outline/i);
});

test('faculty room-request zoom controls use accessible labels instead of title help', () => {
	const layout = source('src/components/faculty-room-preferences/DesktopRoomRequestLayout.tsx');

	assert.doesNotMatch(layout, /title=['"](?:Zoom Out|Zoom In|Reset)['"]/);
	assert.match(layout, /aria-label=['"]Zoom out campus view['"]/);
	assert.match(layout, /aria-label=['"]Zoom in campus view['"]/);
	assert.match(layout, /aria-label=['"]Reset campus zoom['"]/);
});

test('scheduler room-request preview uses plain-language conflict labels', () => {
	const page = source('src/pages/OfficerRoomPreferences.tsx');

	assert.doesNotMatch(page, /Hard (?:Δ|Î”)/);
	assert.doesNotMatch(page, /Soft (?:Δ|Î”)/);
	assert.match(page, /Blocking conflicts/);
	assert.match(page, /Warnings/);
});

test('faculty room-request surfaces use project controls instead of raw interactive elements', () => {
	const directory = resolve(root, 'src/components/faculty-room-preferences');
	const combined = readdirSync(directory)
		.filter((name) => name.endsWith('.tsx'))
		.map((name) => readFileSync(resolve(directory, name), 'utf8'))
		.join('\n');

	assert.doesNotMatch(combined, /<button\b/);
	assert.doesNotMatch(combined, /<input\b/);
});

test('high-risk scheduler pages keep the primary task obvious and expert controls disclosed', () => {
	const teachingLoad = source('src/pages/TeachingLoad.tsx');
	const roomSchedules = source('src/pages/RoomSchedules.tsx');
	const audit = source('src/pages/Audit.tsx');

	assert.match(teachingLoad, /Choose a teacher or section/);
	assert.match(teachingLoad, /Review the load and coverage/);
	assert.match(teachingLoad, /Save your changes/);
	assert.match(roomSchedules, /Expert tools/);
	assert.match(roomSchedules, /Inspect a specific generation run/);
	assert.match(audit, /Fix these first/);
});

test('setup pages expose attention-first filters in plain language', () => {
	const subjects = source('src/pages/Subjects.tsx');
	const sections = source('src/pages/Sections.tsx');
	const faculty = source('src/pages/Faculty.tsx');

	assert.match(subjects, /Missing teacher coverage/);
	assert.match(subjects, /Room-constrained subjects/);
	assert.match(sections, /Needs a home room/);
	assert.match(faculty, /Needs teaching load/);
});

test('timetable selection keeps advanced teaching repair explicit and lazily mounted', () => {
	const rightPanel = source('src/components/timetable/RightPanel.tsx');
	const centerWorkspace = source('src/components/timetable/CenterWorkspace.tsx');

	assert.match(rightPanel, /Fix Teaching Load owner/);
	assert.match(centerWorkspace, /<TacticalSandboxDock[^>]+open=\{tacticalSandboxOpen\}/);
	assert.doesNotMatch(centerWorkspace, /setTacticalSandboxOpen\(true\);\s*setAutoOpenedSandboxEntryId/);
});

test('timetable tactical sandbox caps candidate DOM and uses delta load projection', () => {
	const dock = source('src/components/timetable/TacticalSandboxDock.tsx');
	const parts = source('src/components/timetable/TacticalSandboxDock.parts.tsx');
	const helpers = source('src/components/timetable/TacticalSandboxDock.helpers.ts');

	assert.match(dock, /const MAX_RENDERED_TEACHER_CANDIDATES = 30/);
	assert.match(dock, /visibleCandidates = useMemo/);
	assert.match(parts, /data-teacher-candidate-row="true"/);
	assert.match(dock, /projectedTeachingHoursForFaculty/);
	assert.match(helpers, /buildFacultyTeachingMinuteIndex/);
	assert.match(helpers, /projectedTeachingHoursForFaculty/);
	assert.doesNotMatch(dock, /draftEntries\.map\(\(entry\) => projectEntryFaculty/);
	assert.doesNotMatch(dock, /selectedUnassigned\s*\?\s*teachingHoursForFaculty\(draftEntries,\s*faculty\.id\)/);
});

test('timetable workspace throttles collaboration selection and removes artificial pivot delay', () => {
	const collaboration = source('src/hooks/useTimetableCollaboration.ts');
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');

	assert.match(collaboration, /lastSelectionSentAtRef/);
	assert.match(collaboration, /elapsed >= 100/);
	assert.match(collaboration, /setTimeout\(send, 100 - elapsed\)/);
	assert.doesNotMatch(workspaceState, /setTimeout\(\(\) => setPivotTransitionLoading\(false\), 180\)/);
	assert.match(workspaceState, /const pivotTransitionLoading = false/);
});

test('timetable loading and preview paths use latest-request guards', () => {
	const dataHook = source('src/hooks/useTimetableData.ts');
	const mutationHook = source('src/hooks/useTimetableMutations.ts');

	assert.match(dataHook, /latestRunDataFetchSeqRef/);
	assert.match(dataHook, /requestSeq !== latestRunDataFetchSeqRef\.current/);
	assert.match(mutationHook, /latestRequestPreviewSeqRef/);
	assert.match(mutationHook, /latestManualPreviewSeqRef/);
	assert.match(mutationHook, /latestTeachingLoadPreviewSeqRef/);
	assert.match(mutationHook, /requestSeq !== latestManualPreviewSeqRef\.current/);
	assert.match(mutationHook, /requestSeq !== latestTeachingLoadPreviewSeqRef\.current/);
});

test('timetable heavy repair dock is code-split from initial schedule workspace', () => {
	const centerWorkspace = source('src/components/timetable/CenterWorkspace.tsx');

	assert.match(centerWorkspace, /const TacticalSandboxDock = lazy/);
	assert.match(centerWorkspace, /import\('@\/components\/timetable\/TacticalSandboxDock'\)/);
	assert.match(centerWorkspace, /shouldMountTacticalSandbox/);
	assert.match(centerWorkspace, /centerView === 'schedule' && selectedUnassigned !== null/);
	assert.match(centerWorkspace, /<Suspense fallback=\{null\}>/);
	assert.doesNotMatch(centerWorkspace, /import \{ TacticalSandboxDock \} from '@\/components\/timetable\/TacticalSandboxDock'/);
});

test('timetable drag-over ignores repeated events inside the same cell', () => {
	const timetableGrid = source('src/components/timetable/TimetableGrid.tsx');
	const dragDropHook = source('src/hooks/useTimetableDragDrop.ts');

	assert.match(timetableGrid, /id: 'timetable-grid-drop-zone'/);
	assert.match(timetableGrid, /publishActiveDragCell/);
	assert.match(timetableGrid, /activeDragCellState\?\.cellId === cellId/);
	assert.match(timetableGrid, /const isDropOver = isOver \|\| \(hasKbSource && isKbHovered\)/);
	assert.doesNotMatch(timetableGrid, /id: `timetable-cell-\$\{cellId\}`/);
	assert.doesNotMatch(timetableGrid, /const \{ setNodeRef: setCellDropRef, isOver: isCellDroppableOver \} = useDroppable/);
	assert.match(dragDropHook, /resolveCellFromTranslatedRect/);
	assert.match(dragDropHook, /cellId === lastGridCellIdRef\.current/);
	assert.doesNotMatch(timetableGrid, /setDropTarget/);
});

test('timetable click-to-move mode keeps visible conflict inspector feedback on hovered cells', () => {
	const timetableGrid = source('src/components/timetable/TimetableGrid.tsx');

	assert.match(timetableGrid, /getCellConflict:\s*\(\(cellId: string\) => CellConflictInfo \| null\) \| null/);
	assert.match(timetableGrid, /const \[kbConflictInfo, setKbConflictInfo\] = useState<CellConflictInfo \| null>\(null\)/);
	assert.match(timetableGrid, /setKbConflictInfo\(hasKbSource \? getCellConflict\?\.\(cellId\) \?\? null : null\)/);
	assert.match(timetableGrid, /const activeInfo = info \?\? kbConflictInfo/);
	assert.match(timetableGrid, /activeInfo\.kind === 'hard' \|\| activeInfo\.kind === 'soft'/);
});

test('timetable source selection shows grid-wide placement guidance without pointer-frequency recomputation', () => {
	const timetableGrid = source('src/components/timetable/TimetableGrid.tsx');
	const dragDropHook = source('src/hooks/useTimetableDragDrop.ts');

	assert.doesNotMatch(timetableGrid, /const \[dragPreviewSource, setDragPreviewSource\] = useState<GridDragSource>\(null\)/);
	assert.doesNotMatch(timetableGrid, /const \[deferredDragPreviewSource, setDeferredDragPreviewSource\] = useState<GridDragSource>\(null\)/);
	assert.match(timetableGrid, /atlas:timetable-drag-source/);
	assert.match(timetableGrid, /cancelPreviewDecorations = decoratePointerPreview\(nextSource\)/);
	assert.match(timetableGrid, /const fullPreviewByCell = useMemo/);
	assert.match(timetableGrid, /getLiveCellConflict\(activePreviewSource, cellId\)/);
	assert.match(timetableGrid, /data-cell-preview-label=\{dropFeedbackMode\}/);
	assert.match(timetableGrid, /data-cell-status-label=\{previewStatus\}/);
	assert.match(timetableGrid, /previewStatus === 'swap'[\s\S]{0,80}\? 'Can swap'/);
	assert.match(timetableGrid, /previewStatus === 'place'[\s\S]{0,80}\? 'Can place'/);
	assert.match(dragDropHook, /atlas:timetable-drag-source/);
	assert.doesNotMatch(dragDropHook, /getLiveCellConflict/);
	assert.doesNotMatch(dragDropHook, /getCellConflict/);
});

test('generated unassigned placement does not reopen the deprecated teacher-room assignment modal', () => {
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const assignmentDialogs = source('src/components/timetable/modals/TimetableAssignmentDialogs.tsx');
	const generatedRail = source('src/components/timetable/GeneratedRunRailPanels.tsx');
	const placementDialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');

	assert.match(workspaceState, /placeGeneratedUnassigned/);
	assert.match(workspaceState, /const targetFacultyId = item\.facultyId/);
	assert.match(workspaceState, /resolveGeneratedPlacementRoomId/);
	assert.match(workspaceState, /setShowAssignmentPicker\(true\)/);
	assert.match(workspaceState, /This session has no Teaching Load owner yet/);
	assert.doesNotMatch(assignmentDialogs, /Assign teacher and room/);
	assert.doesNotMatch(assignmentDialogs, /Choose teacher/);
	assert.doesNotMatch(assignmentDialogs, /Choose room/);
	assert.match(placementDialogs, /Review generated placement/);
	assert.match(placementDialogs, /The teacher is locked from Teaching Load/);
	assert.match(placementDialogs, /Room source/);
	assert.match(generatedRail, /Fix teaching load/);
	assert.match(generatedRail, /Pick room/);
	assert.doesNotMatch(generatedRail, /Choose teacher/);
	assert.doesNotMatch(generatedRail, /Choose a teacher/);
});

test('timetable Phase 3 uses readonly ownership review instead of timetable teacher-room assignment', () => {
	const placementDialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	const mutationHook = source('src/hooks/useTimetableMutations.ts');
	const tacticalDock = source('src/components/timetable/TacticalSandboxDock.tsx');

	assert.match(placementDialogs, /Teaching Load owner/);
	assert.match(placementDialogs, /Suggested room/);
	assert.match(placementDialogs, /Review visual switch/);
	assert.match(placementDialogs, /Ownership stays from Teaching Load/);
	assert.match(placementDialogs, /Blocking .* Warnings/s);
	assert.match(placementDialogs, /SearchableSelect/);
	assert.doesNotMatch(placementDialogs, /placeholder="Choose teacher"/);
	assert.doesNotMatch(placementDialogs, /placeholder="Choose room"/);
	assert.doesNotMatch(placementDialogs, /Assign teacher and room/);

	assert.match(mutationHook, /return item\.facultyOptions\[0\] \?\? 0;/);
	assert.doesNotMatch(mutationHook, /item\.facultyOptions\[0\] \?\? Array\.from\(facultyMap\.keys\(\)\)\[0\]/);
	assert.doesNotMatch(mutationHook, /Select a faculty member and a room/);

	assert.match(tacticalDock, /Fix Teaching Load Owner/);
	assert.match(tacticalDock, /Select Teaching Load owner/);
	assert.doesNotMatch(tacticalDock, /Choose a teacher/);
	assert.doesNotMatch(tacticalDock, /Choose teacher/);
});

test('timetable Phase 4 keeps the default workspace grid-first and progressively disclosed', () => {
	const toolbar = source('src/components/timetable/TimetableToolbar.tsx');
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const sidebar = source('src/components/timetable/ViolationsSidebar.tsx');
	const rightPanel = source('src/components/timetable/RightPanel.tsx');

	assert.match(toolbar, /data-testid="timetable-filters-trigger"/);
	assert.match(toolbar, /<Popover/);
	assert.match(toolbar, /<PopoverContent/);
	assert.match(toolbar, /Program/);
	assert.match(toolbar, /Entry type/);
	assert.match(toolbar, /Attention type/);

	assert.match(header, /Next task/);
	assert.doesNotMatch(header, /What to do next/);

	assert.match(state, /useState\(\(\) => !isDesktop\)/);
	assert.match(state, /if \(!isDesktop\) \{/);
	assert.match(sidebar, /collapsedSize=\{isDesktop \? 3 : 0\}/);
	assert.match(rightPanel, /collapsedSize=\{isDesktop \? 3 : 0\}/);
	assert.match(rightPanel, /const hasDetailContent = Boolean/);
	assert.match(rightPanel, /if \(!hasDetailContent\)/);
});

test('timetable Phase 5 foolproofing keeps persistent help, large task targets, and on-page save status', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const statusLegend = source('src/components/timetable/TimetableStatusLegend.tsx');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const mutationHook = source('src/hooks/useTimetableMutations.ts');

	assert.match(header, /data-testid=\{`timetable-task-\$\{task\.id\}`\}/);
	assert.match(header, /className="h-11 shrink-0/);
	assert.match(header, /data-testid="timetable-foolproof-help"/);
	assert.match(header, /No precision dragging required/);
	assert.match(header, /<TimetableStatusLegend \/>/);
	assert.match(statusLegend, /data-testid="timetable-status-legend"/);
	assert.match(statusLegend, /Can place = empty slot/);
	assert.match(statusLegend, /Can swap = occupied slot to review/);
	assert.match(statusLegend, /Blocked = fix first/);
	assert.match(statusLegend, /Warning = review before saving/);
	assert.match(statusLegend, /Occupied = already scheduled/);
	assert.match(statusLegend, /Current = selected session location/);
	assert.match(header, /Review draft placement/);
	assert.match(header, /Review occupied-slot swap/);
	assert.match(header, /data-testid="timetable-visible-undo"/);
	assert.match(workspace, /role="status"/);
	assert.match(workspace, /aria-live="polite"/);
	assert.match(workspaceState, /setTimeout\(\(\) => setInlineActionStatus\(null\), 6000\)/);
	assert.match(mutationHook, /setInlineActionStatus\(\{\s*tone: data\.preview\.softViolations\.length > 0 \? 'warning' : 'success'/);
	assert.match(mutationHook, /Sessions switched\. The grid and edit history were updated\./);
});

test('timetable Phase 5 reduces badge noise while keeping plain placement states visible', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const timetableGrid = source('src/components/timetable/TimetableGrid.tsx');
	const generatedRail = source('src/components/timetable/GeneratedRunRailPanels.tsx');

	assert.match(header, /formatTaskCount\(hardCount, 'blocked'\)/);
	assert.match(header, /formatTaskCount\(unassignedCount, 'to place'\)/);
	assert.match(timetableGrid, /data-cell-status-label=\{previewStatus\}/);
	assert.match(timetableGrid, /\? 'Can swap'/);
	assert.match(timetableGrid, /\? 'Can place'/);
	assert.match(timetableGrid, /\? 'Blocked'/);
	assert.match(timetableGrid, /\? 'Warning'/);
	assert.match(generatedRail, /data-unassigned-status=\{itemStatus\.label\}/);
	assert.match(generatedRail, /Ready to place/);
	assert.match(generatedRail, /Needs owner/);
	assert.match(generatedRail, /Check slot/);
	assert.match(generatedRail, /renderUnassignedReasonBadge\(item\.reason\)[\s\S]{0,500}matchesProgramFilter/);
	assert.match(generatedRail, /className="h-10 px-3 text-xs gap-1\.5 border-green-200/);
});

test('timetable Phase 6 drag overlay keeps plain-language drop guidance', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const phaseSixGate = source('../qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts');

	assert.match(workspace, /Release on a highlighted cell to review move or swap\./);
	assert.match(phaseSixGate, /Release on a highlighted cell to review move or swap/i);
});

test('Iteration C keeps setup and teaching-load headers compact', () => {
	const adminWorkspace = source('src/components/admin-workspace/AdminWorkspace.tsx');
	const teachingToolbar = source('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	const teachingLoad = source('src/pages/TeachingLoad.tsx');

	assert.match(adminWorkspace, /data-testid="admin-command-header"/);
	assert.match(adminWorkspace, /px-4 py-1\.5/);
	assert.match(adminWorkspace, /data-testid="admin-content-shell"/);
	assert.match(adminWorkspace, /data-testid="admin-source-truth-summary"/);
	assert.match(adminWorkspace, /Source truth:/);
	assert.match(adminWorkspace, /aria-live="polite"/);
	assert.doesNotMatch(adminWorkspace, /px-6 py-4/);
	assert.doesNotMatch(adminWorkspace, /mt-4 rounded-2xl/);

	assert.match(teachingToolbar, /data-testid="teaching-load-command-header"/);
	assert.match(teachingToolbar, /data-testid="teaching-load-source-truth-summary"/);
	assert.match(teachingToolbar, /Source truth:/);
	assert.match(teachingToolbar, /Compact workflow guide/);
	assert.doesNotMatch(teachingToolbar, /<button/);
	assert.match(teachingLoad, /data-testid="teaching-load-content-shell"/);
	assert.match(teachingLoad, /className="sr-only" aria-label="Teaching load workflow"/);
});

test('Iteration D keeps timetable placement and swap reviews on one action-sheet pattern', () => {
	const reviewActionSheet = source('src/components/timetable/modals/ReviewActionSheet.tsx');
	const placementDialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');

	assert.match(reviewActionSheet, /data-testid="review-action-sheet"/);
	assert.match(reviewActionSheet, /data-review-action-type=\{type\}/);
	assert.match(reviewActionSheet, /What changes/);
	assert.match(reviewActionSheet, /Blocks/);
	assert.match(reviewActionSheet, /Warnings/);
	assert.match(reviewActionSheet, /After save/);

	assert.match(placementDialogs, /type="generated-placement"/);
	assert.match(placementDialogs, /type="draft-placement"/);
	assert.match(placementDialogs, /type="draft-swap"/);
	assert.match(placementDialogs, /type="generated-swap"/);
	assert.match(placementDialogs, /Swap sessions/);
	assert.match(placementDialogs, /Teacher ownership remains sourced from Teaching Load/);
	assert.doesNotMatch(placementDialogs, /Assign teacher and room/);
	assert.doesNotMatch(placementDialogs, /placeholder="Choose teacher"/);
	assert.doesNotMatch(placementDialogs, /placeholder="Choose room"/);
});

test('timetable default layout uses a simple first shell with disclosed expert rails', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const body = source('src/components/timetable/ScheduleReviewWorkspaceBody.tsx');
	const simpleHeader = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const taskDrawer = source('src/components/timetable/TimetableTaskDrawer.tsx');
	const centerWorkspace = source('src/components/timetable/CenterWorkspace.tsx');
	const grid = source('src/components/timetable/TimetableGrid.tsx');

	assert.match(workspace, /atlas_timetable_layout_mode/);
	assert.match(workspace, /<TimetableSimpleHeader/);
	assert.match(workspace, /data-testid="timetable-layout-toggle"/);
	assert.match(workspace, /Simple view/);
	assert.match(body, /layoutMode === 'simple'/);
	assert.match(body, /data-testid="timetable-simple-body"/);
	assert.match(body, /<TimetableTaskDrawer/);
	assert.match(simpleHeader, /data-testid="timetable-simple-header"/);
	assert.match(simpleHeader, /data-testid="timetable-simple-primary-action"/);
	assert.match(simpleHeader, /role="status"/);
	assert.match(simpleHeader, /aria-live="polite"/);
	assert.match(simpleHeader, /No dragging required/);
	assert.match(taskDrawer, /data-testid="timetable-task-drawer"/);
	assert.match(taskDrawer, /Choose first class/);
	assert.match(taskDrawer, /Teacher ownership stays in Teaching Load/);
	assert.match(centerWorkspace, /const centerDefaultSize = simpleMode/);
	assert.match(centerWorkspace, /defaultSize=\{centerDefaultSize\}/);
	assert.match(grid, /showTeacherDetails \? `\$\{teacherText\} · \$\{roomText\}` : roomText/);
});

test('timetable teacher departure recovery is simple, discoverable, and source-truth safe', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const simpleHeader = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const sheet = source('src/components/timetable/TeacherDepartureRecoverySheet.tsx');
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	const gridBadges = source('src/components/timetable/TimetableGridEntryBadges.tsx');
	const repairService = source('../atlas-server/src/services/timetable-teaching-load-repair.service.ts');

	assert.match(simpleHeader, /Teacher leaving \/ Reassign load/);
	assert.match(simpleHeader, /data-testid="teacher-departure-trigger"/);
	assert.match(workspace, /data-testid="teacher-departure-selected-action"/);
	assert.match(workspace, /TeacherDepartureRecoverySheet/);
	assert.match(sheet, /Which teacher is leaving\?/);
	assert.match(sheet, /Replacement teacher/);
	assert.match(sheet, /Save reassignment/);
	assert.match(sheet, /data-testid="teacher-departure-save-reason"/);
	assert.match(sheet, /Published schedules require an effective-date revision/);
	assert.match(grid, /TeacherDepartureEntryBadge/);
	assert.match(gridBadges, /data-testid="teacher-departure-grid-badge"/);
	assert.match(gridBadges, /Needs new teacher/);
	assert.match(repairService, /targetFacultyIds\.has\(facultyId\)/);
	assert.match(repairService, /The replacement teacher is no longer active for scheduling/);
	assert.doesNotMatch(sheet, /Assign teacher and room/);
	assert.doesNotMatch(sheet, /placeholder="Choose teacher"/);
	assert.doesNotMatch(sheet, /placeholder="Choose room"/);
});

test('timetable regression specs pin Simple mode as default and opt into Advanced deliberately', () => {
	const defaultLayoutSpec = source('../qa-artifacts/playwright/specs/timetable-default-layout-iteration-e-f.spec.ts');
	const iterationASpec = source('../qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts');
	const iterationBSpec = source('../qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts');
	const iterationCSpec = source('../qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts');
	const iterationDSpec = source('../qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts');
	const adaptedSpecs = `${iterationASpec}\n${iterationBSpec}\n${iterationCSpec}\n${iterationDSpec}`;

	assert.match(defaultLayoutSpec, /timetable-task-guide'\)\)\.toHaveCount\(0\)/);
	assert.match(iterationASpec, /openTimetableAdvanced/);
	assert.match(adaptedSpecs, /timetable-simple-primary-action|openTaskDrawer|openTimetableSimple/);
	assert.doesNotMatch(adaptedSpecs, /getByTestId\('timetable-task-place'\)/);
});

test('stale latest timetable data falls back to the same explicit read-only run', () => {
	const timetableData = source('src/hooks/useTimetableData.ts');

	assert.match(timetableData, /runId === 'latest' && code === 'STALE_RUN_DATA'/);
	assert.match(timetableData, /fetchRunData\(syId, String\(latestRunId\)/);
});

test('timetable performance harness enforces the published Prompt 0 and Prompt 1 gates', () => {
	const harness = source('../qa-artifacts/playwright/specs/timetable-performance.spec.ts');

	assert.match(harness, /const REQUIRED_SELECTION_COUNT = 20/);
	assert.match(harness, /const MIN_DRAG_FPS = 55/);
	assert.match(harness, /const MAX_DRAG_COMMIT_MS = 16/);
	assert.match(harness, /const MAX_LONG_TASK_MS = 50/);
	assert.match(harness, /Mandatory Prompt 0 and Prompt 1 gate verdict/);
	assert.doesNotMatch(harness, /Touch placement tested via keyboard\/click abstractions/);
	assert.doesNotMatch(harness, /Covered by preview and placement scenarios/);
});

test('setup-first Iteration 3 gives Teaching Load an explicit next-task guide without expanding the header', () => {
	const teachingLoad = source('src/pages/TeachingLoad.tsx');
	const taskGuide = source('src/components/faculty-assignments/TeachingLoadTaskGuide.tsx');

	assert.match(teachingLoad, /<TeachingLoadTaskGuide/);
	assert.match(teachingLoad, /data-testid="teaching-load-content-shell"[\s\S]{0,500}<TeachingLoadTaskGuide/);
	assert.doesNotMatch(teachingLoad, /<TeachingLoadTaskGuide[\s\S]{0,500}\{splitBrainNeedsAttention/);
	assert.match(taskGuide, /data-testid="teaching-load-task-guide"/);
	assert.match(taskGuide, /data-testid="teaching-load-next-action"/);
	assert.match(taskGuide, /Fix first/);
	assert.match(taskGuide, /Fill missing teaching loads/);
	assert.match(taskGuide, /Teachers without load/);
	assert.doesNotMatch(taskGuide, /<button\b/);
	assert.match(teachingLoad, /hidden w-80 shrink-0[\s\S]{0,120}lg:block/);
});

test('setup-first Iteration 4 keeps table controls simple by default and details disclosed', () => {
	const adminWorkspace = source('src/components/admin-workspace/AdminWorkspace.tsx');
	const teacherGrid = source('src/components/faculty-assignments/TeacherGridMode.tsx');
	const sectionGrid = source('src/components/faculty-assignments/SectionGridMode.tsx');
	const subjectRow = source('src/components/subjects/SubjectRow.tsx');
	const sectionRow = source('src/components/sections/SectionRow.tsx');

	assert.match(adminWorkspace, /data-testid="admin-search-filter-toolbar"/);
	const campusOverview = source('src/components/campus-map/CampusMapOverview.tsx');
	assert.match(campusOverview, /RoomReadinessList/);
	assert.match(campusOverview, /const CampusMapCanvasPreview = lazy/);
	assert.match(campusOverview, /<Suspense fallback/);
	const roomReadiness = source('src/components/campus-map/RoomReadinessList.tsx');
	assert.match(roomReadiness, /Needs capacity/);
	assert.match(roomReadiness, /Needs room type/);
	assert.match(roomReadiness, /Needs section/);
	assert.match(roomReadiness, /Unavailable/);
	const dashboard = source('src/pages/Dashboard.tsx');
	assert.match(dashboard, /data-testid='dashboard-readiness-hub'/);
	assert.match(dashboard, /Timetable generated and reviewed/);
	assert.match(dashboard, /Ready to publish/);
	assert.match(adminWorkspace, /More filters/);
	assert.match(teacherGrid, /aria-expanded=\{showFilters\}/);
	assert.match(teacherGrid, /\{showFilters && \(/);
	assert.match(teacherGrid, /More filters/);
	assert.match(teacherGrid, /p-3 space-y-3/);
	assert.match(sectionGrid, /p-3 space-y-3/);
	assert.match(subjectRow, /programScopeSummary/);
	assert.match(subjectRow, /Program scope:/);
	assert.doesNotMatch(subjectRow, /\(subject\.programScopes \?\? \[\]\)\.map/);
	assert.match(sectionRow, /Needs home room\. Choose a room\./);
	assert.doesNotMatch(sectionRow, /Choose a room to make this section schedulable/);
});

test('teachers and Teaching Load expose guided repair workflows before dense controls', () => {
	const faculty = source('src/pages/Faculty.tsx');
	const teachingLoad = source('src/pages/TeachingLoad.tsx');
	const repairQueue = source('src/components/faculty-assignments/TeachingLoadRepairQueue.tsx');
	const draftActionBar = source('src/components/faculty-assignments/TeachingLoadDraftActionBar.tsx');
	const table = source('src/components/admin-workspace/AdminDataTable.tsx');
	const workflowSpec = source('../qa-artifacts/playwright/specs/teachers-teaching-load-guided-workflow.spec.ts');

	assert.match(faculty, /data-testid="teachers-next-action-strip"/);
	assert.match(faculty, /data-testid="teacher-repair-card"/);
	assert.match(faculty, /data-testid="teacher-row-primary-action"/);
	assert.match(faculty, /task=\$\{repairIntent\.task\}/);
	assert.match(faculty, /Needs load/);
	assert.match(faculty, /Over cap/);
	assert.match(faculty, /Review placeholders/);
	assert.match(table, /menuTestId/);
	assert.match(table, /data-testid=\{testId\}/);

	assert.match(teachingLoad, /<TeachingLoadRepairQueue/);
	assert.match(teachingLoad, /<TeachingLoadDraftActionBar/);
	assert.match(draftActionBar, /data-testid="teaching-load-draft-action-bar"/);
	assert.match(teachingLoad, /formatTeachingLoadSaveError/);
	assert.match(teachingLoad, /This teacher is already over the weekly cap/);
	assert.match(teachingLoad, /This section already has an owner for this subject/);
	assert.match(repairQueue, /data-testid="teaching-load-repair-queue"/);
	assert.match(repairQueue, /data-testid="teaching-load-current-repair"/);
	assert.match(repairQueue, /data-testid="teaching-load-next-repair"/);
	assert.match(repairQueue, /data-testid="teaching-load-repair-review"/);
	assert.match(repairQueue, /data-testid="teaching-load-repair-disabled-reason"/);
	assert.match(repairQueue, /data-testid="teaching-load-advanced-grid-toggle"/);
	assert.doesNotMatch(repairQueue, /<button\b/);

	assert.match(workflowSpec, /teachers-next-action-strip/);
	assert.match(workflowSpec, /teaching-load-repair-queue/);
	assert.match(workflowSpec, /assertNoGlobalOverflow/);
	assert.match(workflowSpec, /assertNoVisibleOverlap/);
});

test('older-user Phase 2 separates dashboard source health from setup repair steps', () => {
	const dashboard = source('src/pages/Dashboard.tsx');
	const phaseTwoSpec = source('../qa-artifacts/playwright/specs/dashboard-source-health-guidance.spec.ts');

	assert.match(dashboard, /data-testid='dashboard-source-health-panel'/);
	assert.match(dashboard, /data-source-decision=\{readinessSourceState\}/);
	assert.match(dashboard, /Source unavailable: review saved data now; wait for EnrollPro before final sync\./);
	assert.match(dashboard, /Saved ATLAS data is useful for repair work, but it is not a replacement for live EnrollPro verification\./);
	assert.match(dashboard, /Source verified: continue setup normally\./);
	assert.match(dashboard, /No saved data: reconnect EnrollPro before repairing setup\./);
	assert.match(dashboard, /data-source-repair-link/);
	assert.match(dashboard, /data-testid='dashboard-readiness-hub'/);
	assert.doesNotMatch(dashboard, /data-testid='dashboard-readiness-hub'[\s\S]{0,900}data-source-state=\{readinessSourceState\}/);

	assert.match(phaseTwoSpec, /using_saved_data/);
	assert.match(phaseTwoSpec, /verified_live/);
	assert.match(phaseTwoSpec, /no_saved_data/);
	assert.match(phaseTwoSpec, /assertNoGlobalOverflow/);
});

test('older-user Phase 3 review dialogs restore focus and announce preview status', () => {
	const placementDialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const phaseThreeSpec = source('../qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts');

	assert.match(workspaceState, /reviewFocusReturnRef/);
	assert.match(workspaceState, /captureReviewFocusReturn/);
	assert.match(workspaceState, /restoreReviewFocus/);
	assert.match(workspaceState, /data-review-focus-temporary/);
	assert.match(workspaceState, /timetableCellFocusSelector/);
	assert.match(workspaceState, /timetableEntryFocusSelector/);
	assert.match(placementDialogs, /onOpenAutoFocus=\{focusCancelButton/);
	assert.match(placementDialogs, /role="status" aria-live="polite"/);
	assert.match(placementDialogs, /generated-placement-preview-status/);
	assert.match(placementDialogs, /draft-placement-preview-status/);
	assert.match(placementDialogs, /draft-swap-preview-status/);
	assert.match(placementDialogs, /generated-swap-preview-status/);
	assert.match(placementDialogs, /data-testid="draft-placement-review-dialog"/);
	assert.match(placementDialogs, /data-testid="generated-swap-review-dialog"/);
	assert.match(phaseThreeSpec, /expectFocusContainedAndRestored/);
	assert.match(phaseThreeSpec, /blockedWrites/);
});

test('older-user Phase 4 keeps generated unassigned queues touch-scrollable without global page scroll', () => {
	const virtualizedRailList = source('src/components/timetable/VirtualizedRailList.tsx');
	const draggablePins = source('src/components/timetable/DraggablePinWrappers.tsx');
	const generatedRail = source('src/components/timetable/GeneratedRunRailPanels.tsx');
	const phaseFourSpec = source('../qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts');

	assert.match(virtualizedRailList, /touchScrollRef/);
	assert.match(virtualizedRailList, /onTouchMove/);
	assert.match(virtualizedRailList, /event\.preventDefault\(\)/);
	assert.match(virtualizedRailList, /event\.stopPropagation\(\)/);
	assert.match(draggablePins, /window\.matchMedia\('\(pointer: coarse\)'\)/);
	assert.match(draggablePins, /const dragDisabled = disabled \|\| coarsePointer/);
	assert.match(draggablePins, /touchAction: 'pan-y'/);
	assert.match(generatedRail, /touch-pan-y overscroll-contain overflow-auto/);
	assert.match(phaseFourSpec, /Input\.dispatchTouchEvent/);
	assert.match(phaseFourSpec, /type: 'touchMove'/);
	assert.match(phaseFourSpec, /assertNoGlobalOverflow/);
	assert.match(phaseFourSpec, /font-size: 200% !important/);
	assert.match(phaseFourSpec, /blockedWrites/);
});
