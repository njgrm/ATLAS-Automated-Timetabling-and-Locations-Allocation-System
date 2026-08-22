import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
	assert.doesNotMatch(timetableGrid, /data-cell-preview-label=\{dropFeedbackMode\}/);
	assert.doesNotMatch(timetableGrid, /data-cell-status-label=\{previewStatus\}/);
	assert.doesNotMatch(timetableGrid, /previewStatus === 'swap'[\s\S]{0,80}\? 'Can swap'/);
	assert.doesNotMatch(timetableGrid, /previewStatus === 'place'[\s\S]{0,80}\? 'Can place'/);
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
	assert.match(statusLegend, /Blocked = review first/);
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
	assert.doesNotMatch(timetableGrid, /data-cell-status-label=\{previewStatus\}/);
	assert.doesNotMatch(timetableGrid, /\? 'Can swap'/);
	assert.doesNotMatch(timetableGrid, /\? 'Can place'/);
	assert.match(timetableGrid, /ring-red-500 bg-red-50\/60/);
	assert.match(timetableGrid, /ring-amber-400 bg-amber-50\/60/);
	assert.match(timetableGrid, /ring-emerald-400 bg-emerald-50\/60/);
	assert.match(timetableGrid, /info !== null \|\| kbConflictInfo !== null/);
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

test('generated placement helpers target real grid attributes, not stale preview selectors', () => {
	const qaDirectory = resolve(root, '../qa-artifacts/playwright/specs');
	const qaSources = readdirSync(qaDirectory)
		.filter((name) => name.endsWith('.spec.ts') || name.endsWith('-helpers.ts') || name.endsWith('-fixtures.ts'))
		.map((name) => readFileSync(resolve(qaDirectory, name), 'utf8'))
		.join('\n');

	// Stale selectors removed from the product must not reappear in QA tooling.
	assert.doesNotMatch(qaSources, /data-cell-preview-label/);
	assert.doesNotMatch(qaSources, /data-cell-status-label/);

	// Placement helper must use the real decoration attribute or the click-mode
	// "Move selected session to" aria-label, and must guard against special-event cells.
	const fixtures = source('../qa-artifacts/playwright/specs/older-user-session-remediation-fixtures.ts');
	assert.match(fixtures, /data-pointer-preview-status="place"/);
	assert.match(fixtures, /aria-label\^="Move selected session to"/);
	assert.match(fixtures, /Blocked slot:/);
	assert.match(fixtures, /FLAG CEREMONY\|RECESS\|HEALTH BREAK\|LUNCH/i);
});

test('Iteration C keeps setup and teaching-load headers compact', () => {
	const adminWorkspace = source('src/components/admin-workspace/AdminWorkspace.tsx');
	const teachingToolbar = source('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	const teachingLoad = source('src/pages/TeachingLoad.tsx');

	assert.match(adminWorkspace, /data-testid="admin-command-header"/);
	assert.match(adminWorkspace, /px-4 py-1\.5/);
	assert.match(adminWorkspace, /data-testid="admin-content-shell"/);
	assert.match(adminWorkspace, /data-testid="admin-source-truth-summary"/);
	assert.match(adminWorkspace, /data-testid="setup-source-details-popover"/);
	assert.match(adminWorkspace, /data-testid="setup-readiness-strip"/);
	assert.match(adminWorkspace, /aria-live="polite"/);
	assert.doesNotMatch(adminWorkspace, />Source truth:/);
	assert.doesNotMatch(adminWorkspace, /px-6 py-4/);
	assert.doesNotMatch(adminWorkspace, /mt-4 rounded-2xl/);

	assert.match(teachingToolbar, /data-testid="teaching-load-command-header"/);
	assert.match(teachingToolbar, /data-testid="teaching-load-compact-command-header"/);
	assert.match(teachingToolbar, /data-testid="teaching-load-source-truth-summary"/);
	assert.doesNotMatch(teachingToolbar, />Source truth:/);
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

test('Phase 4.1: Teaching Load has a single next-step surface (TaskGuide removed)', () => {
	const teachingLoad = source('src/pages/TeachingLoad.tsx');

	// The standalone TaskGuide is gone; the repair queue is the single
	// "next step" surface (it duplicated the readiness strip's % staffed
	// badge and the repair queue's next-fix prompt).
	assert.doesNotMatch(teachingLoad, /<TeachingLoadTaskGuide/);
	assert.match(teachingLoad, /<TeachingLoadRepairQueue/);
	// No "Fix first" / "repair" jargon in the page's user-visible copy.
	assert.doesNotMatch(teachingLoad, /Fix first/);
	assert.doesNotMatch(teachingLoad, /repair action first/);
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
	assert.match(subjectRow, /programText/);
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
	// Phase 3.3: attention chips use plain DepEd language (no "Needs load",
	// "Over cap", "Review placeholders" engineering jargon).
	assert.match(faculty, /No subjects assigned/);
	assert.match(faculty, /Above weekly max/);
	assert.match(faculty, /Temporary teachers/);
	assert.match(faculty, /aria-pressed=\{attentionFilter === chip\.id\}/);
	assert.match(table, /menuTestId/);
	assert.match(table, /data-testid=\{testId\}/);

	assert.match(teachingLoad, /<TeachingLoadRepairQueue/);
	assert.match(teachingLoad, /<TeachingLoadDraftActionBar/);
	assert.match(draftActionBar, /data-testid="teaching-load-draft-action-bar"/);
	assert.match(teachingLoad, /formatTeachingLoadSaveError/);
	assert.match(teachingLoad, /This teacher is already above the weekly maximum/);
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

test('Phase 0A.1: ATLAS DepEd glossary exists and expands made-up department codes', () => {
	const glossary = source('src/lib/deped-glossary.ts');
	assert.match(glossary, /export const DEPARTMENT_LABELS/);
	assert.match(glossary, /SCI:\s*'Science'/);
	assert.match(glossary, /FIL:\s*'Filipino'/);
	assert.match(glossary, /ENG:\s*'English'/);
	assert.match(glossary, /export const PROGRAM_LABELS/);
	assert.match(glossary, /Special Program in the Arts/);
	assert.match(glossary, /Special Program in Sports/);
	assert.match(glossary, /Science, Technology, and Engineering/);
	// Compact grade format must be GR{grade}, never the G7 shorthand.
	assert.match(glossary, /return `GR\$\{grade\}`/);
	assert.doesNotMatch(glossary, /return `G\$\{grade\}`/);
});

test('Phase 0A.3: AccessibleInfo is keyboard-focusable and never hover-only', () => {
	const accessibleInfo = source('src/components/smart/AccessibleInfo.tsx');
	// Trigger must be a real Button (keyboard-focusable), not a span/div.
	assert.match(accessibleInfo, /<Button[\s\S]*?aria-label=/);
	// Tooltip must wrap a focusable trigger (asChild on a Button), not a Badge/span.
	assert.match(accessibleInfo, /<TooltipTrigger asChild>/);
	// When longHelp is provided, click/tap opens a Popover -- not hover-only.
	assert.match(accessibleInfo, /<Popover/);
	assert.match(accessibleInfo, /onClick=\{\(\) => longHelp && setPopoverOpen/);
});

test('Phase 0A.4: AdminDataTable exposes sort + pagination a11y to assistive tech', () => {
	const table = source('src/components/admin-workspace/AdminDataTable.tsx');
	// Sortable columns expose aria-sort.
	assert.match(table, /aria-sort=\{/);
	// Sort buttons expose direction in their accessible name.
	assert.match(table, /aria-label=\{sortAriaLabel/);
	// Sort buttons also surface a visible Tooltip (not icon-only).
	assert.match(table, /<TooltipTrigger asChild>/);
	assert.match(table, /sortAriaLabel\(column as AdminDataTableColumn/);
	// Pagination icon buttons get aria-labels and larger (size-9) touch targets.
	assert.match(table, /aria-label="First page"/);
	assert.match(table, /aria-label="Previous page"/);
	assert.match(table, /aria-label="Next page"/);
	assert.match(table, /aria-label="Last page"/);
	assert.match(table, /className="size-9"/);
	// Page-size Select is labelled for screen readers.
	assert.match(table, /aria-label="Rows per page"/);
});

test('Phase 0A.2: high-density readable-label floor rule is established', () => {
	// Phase 0A.2 establishes the rule; the per-page sweep happens in Phases 1-4.
	// This guardrail pins the structural baseline: the glossary documents the
	// compact-vs-long grade rule, AccessibleInfo exists (Phase 0A.3), and
	// AdminDataTable no longer uses sub-0.7rem tracking-widest header captions.
	const glossary = source('src/lib/deped-glossary.ts');
	assert.match(glossary, /Compact grade format is `GR\{grade\}`/);
	assert.match(glossary, /Long form is/);
	assert.match(glossary, /never `G\{grade\}`/);

	const adminTable = source('src/components/admin-workspace/AdminDataTable.tsx');
	// The header description sub-label was bumped from text-[0.6rem] to text-[0.7rem]
	// as part of Phase 0A. Regressions that drop below 0.7rem with tracking-widest fail.
	assert.doesNotMatch(
		adminTable,
		/text-\[0\.6[0-9]?rem\][^"']{0,80}tracking-widest/,
		'AdminDataTable must not render sub-10px tracking-widest header captions',
	);

	// Per-page label cleanups (SubjectFormModal, FacultyRow, etc.) get their own
	// guardrail tests added in Phases 1-4 when those files are touched.
});

test('Phase 0A.5: EnrollPro intro popover exists and is one-time dismissible', () => {
	const intro = source('src/components/smart/EnrollProIntro.tsx');
	// Renders a Popover that opens once when localStorage key is absent.
	assert.match(intro, /Popover open=\{open\}/);
	assert.match(intro, /window\.localStorage\.getItem\(storageKey\)/);
	assert.match(intro, /Got it/);
	// Dismiss persists the key.
	assert.match(intro, /window\.localStorage\.setItem\(storageKey, '1'\)/);
	const adminWorkspace = source('src/components/admin-workspace/AdminWorkspace.tsx');
	// Source details now carry the EnrollPro explanation directly. The intro
	// component remains available, but it must not steal the source-chip click.
	assert.match(adminWorkspace, /EnrollPro roster source/);
	assert.doesNotMatch(adminWorkspace, /<EnrollProIntro>[\s\S]{0,500}<PopoverTrigger asChild>/);
});

test('Phase 0B.1: RolloverGuidanceCard is dismissible and non-destructive on setup pages', () => {
	const card = source('src/components/runtime/RolloverGuidanceCard.tsx');
	// Dismissible via localStorage per drift status.
	assert.match(card, /DISMISS_STORAGE_PREFIX/);
	assert.match(card, /window\.localStorage\.setItem\(dismissStorageKey, '1'\)/);
	assert.match(card, /data-testid="rollover-banner-dismiss"/);
	// Destructive reset is no longer inline: the card links to the admin route instead.
	assert.doesNotMatch(card, /Reset dummy data/);
	assert.doesNotMatch(card, /variant="destructive"/);
	assert.doesNotMatch(card, /RESET_DUMMY_SCHOOL_YEAR_1/);
	assert.match(card, /Open year setup/);
	// Jargon replacements via Phase 0A.1 glossary rule.
	assert.doesNotMatch(card, /Migration needed/);
	assert.match(card, /New year needs setup|Old year's data needs clearing/);
});

test('Phase 0B.2: /admin/year-setup route exists, is admin-only, and uses a two-step reset confirmation', () => {
	const app = source('src/App.tsx');
	assert.match(app, /AdminYearSetup/);
	assert.match(app, /path: 'admin\/year-setup'/);

	const page = source('src/pages/AdminYearSetup.tsx');
	// Admin role guard.
	assert.match(page, /ADMIN_ROLES/);
	assert.match(page, /admin['"]|SYSTEM_ADMIN['"]|officer['"]/);
	assert.match(page, /<Navigate to="\/" replace \/>/, 'Non-admin role must redirect to dashboard');

	const panel = source('src/components/runtime/RolloverResetPanel.tsx');
	// Two-step confirmation: checkbox + a non-default-focused destructive button.
	assert.match(panel, /Checkbox/);
	assert.match(panel, /onCheckedChange/);
	assert.match(panel, /Yes, erase and sync/);
	assert.match(panel, /data-testid="rollover-reset-confirm"/);
	// Friendly reset count labels (no internal domain jargon like "Section mirrors").
	assert.match(panel, /Show what will be erased/);
	assert.doesNotMatch(panel, /Section mirrors/);
	assert.doesNotMatch(panel, /Follow-up flags/);
	assert.doesNotMatch(panel, /RESET_DUMMY_SCHOOL_YEAR_1/);
});

test('Phase 0C.1: DepEd grade red is reserved for grade-level meaning only', () => {
	// SectionRow used to color over-full sections with bg-red-600 -- the same
	// hue as the G9 grade color (CC-7 / TL-30). The fill-state over-full band
	// now uses a neutral dark slate so the visual signal does not collide with
	// grade-level meaning. The G9 grade color itself stays red (DepEd rule).
	const sectionRow = source('src/components/sections/SectionRow.tsx');
	assert.doesNotMatch(sectionRow, /bg-red-600 text-white/);
	assert.match(sectionRow, /bg-slate-800 text-white/);
	// Fill pill carries a text alternative so color is not the only signal.
	assert.match(sectionRow, new RegExp('aria-label=.*fill.*% full'));
	assert.match(sectionRow, new RegExp('fill >= 95.*at or over capacity'));
});

test('Phase 0C.1: Section blocked-edit banner uses destructive semantic, not raw red', () => {
	const sections = source('src/pages/Sections.tsx');
	// The blocked tone used border-red-200 bg-red-50 text-red-900 -- raw red
	// collides with G9. It now uses the destructive semantic tokens.
	const blockedExpr = /homeRoomEditStatus\.tone === 'blocked' && 'border-destructive\/30 bg-destructive\/10 text-destructive'/;
	assert.match(sections, blockedExpr);
});

test('Phase 0C.1: completion dots carry role="img" text alternatives', () => {
	const subjectRow = source('src/components/faculty-assignments/SubjectRow.tsx');
	const sectionGrid = source('src/components/faculty-assignments/SectionGridMode.tsx');
	assert.match(subjectRow, /role="img"[\s\S]{0,200}aria-label=\{completedSectionIds\?\.has\(section\.id\) \? 'Assigned' : 'Pending'\}/);
	assert.match(sectionGrid, /role="img"[\s\S]{0,200}aria-label=\{completedSectionIds\.has\(row\.section\.id\) \? 'Assigned' : 'Pending'\}/);
});

test('Phase 0C.2: dead SubjectAddForm.tsx is removed and the no-reintroduction guardrail is in place', () => {
	// Per Decision 4, SubjectAddForm.tsx is dead code. The implementation pass
	// re-confirmed zero imports; this test pins the file as removed so a
	// future refactor cannot silently revive it.
	assert.equal(
		existsSync(resolve(root, 'src/components/subjects/SubjectAddForm.tsx')),
		false,
		'SubjectAddForm.tsx must stay removed; Subjects uses SubjectFormModal only',
	);
});

test('Phase 0C.2: grade-labels helper documents the GR{grade} compact form (Decision 5)', () => {
	const gradeLabels = source('src/lib/grade-labels.ts');
	assert.match(gradeLabels, /official compact grade format is `GR\{grade\}`/);
	assert.doesNotMatch(gradeLabels, /"Gx" format/);
	assert.match(gradeLabels, /return `GR\$\{grade\}`/);
});

test('Phase 0C.2: SPECIALIZATION_PRIMARY dead branch is removed from QUALIFICATION_PRIORITY_LABELS', () => {
	const constants = source('src/lib/subject-constants.ts');
	// The labels record should no longer carry the dead SPECIALIZATION_PRIMARY
	// key. The form's qualificationPriority default remains DEPARTMENT_FIRST
	// (the only option the UI actually exposes).
	assert.doesNotMatch(
		constants,
		/QUALIFICATION_PRIORITY_LABELS[\s\S]{0,200}SPECIALIZATION_PRIMARY/,
		'SPECIALIZATION_PRIMARY must not be in the labels record (dead option)',
	);
	assert.match(constants, /QUALIFICATION_PRIORITY_LABELS[\s\S]{0,200}Record<'DEPARTMENT_FIRST', string>/);
});

test('Phase 1.5: Sections table exposes aria-sort, accessible sort labels, and the renamed % Full column', () => {
	const sections = source('src/pages/Sections.tsx');
	// aria-sort on the sortable <th> elements.
	assert.match(sections, /aria-sort=/);
	// Sort buttons announce the direction in their accessible name.
	assert.match(sections, /Sort by \$\{label\}, currently \$\{direction\}/);
	// Visible Tooltip on sort buttons (not icon-only).
	assert.match(sections, /<TooltipContent side="top" className="text-xs">\{ariaLabel\}<\/TooltipContent>/);
	// Column rename: "% Full" replaces "Status"; "Home room" replaces "Home-room readiness".
	assert.match(sections, /label="% Full"/);
	assert.match(sections, new RegExp('<th[^>]*>Home room</'));
	assert.doesNotMatch(sections, new RegExp('>Status <SortIcon'));
	assert.doesNotMatch(sections, new RegExp('>Home-room readiness<'));
	// Home-room cell no longer carries the 224px min-w-56.
	const sectionRow = source('src/components/sections/SectionRow.tsx');
	assert.doesNotMatch(sectionRow, /min-w-56/);
});

test('Phase 1.7: program filter shows the full program labels in a plain legend (no hover dependency)', () => {
	const sections = source('src/pages/Sections.tsx');
	// The SelectItem renders the short label (e.g. "STE") and the legend
	// below renders the full label via the Phase 0A.1 glossary.
	assert.match(sections, /programShortLabel\(p\)/);
	assert.match(sections, /data-testid="program-code-legend"/);
	assert.match(sections, /\$\{programShortLabel\(p\)\} = \$\{programFullLabel\(p\)\}/);
});

test('Phase 1.1: Sections page renders a start-here banner when sections need a home room', () => {
	const sections = source('src/pages/Sections.tsx');
	// Top-level sectionsNeedingRooms derivation (not nested inside sectionStats).
	assert.match(sections, /const sectionsNeedingRooms = state\.status === 'ok' \? Math\.max\(0, state\.data\.totalSections - assignedCount\) : 0/);
	// Banner rendered when count > 0; data-testid present for Playwright.
	assert.match(sections, /data-testid="sections-start-here-banner"/);
	assert.match(sections, /Use the "Choose home room" control on each row\./);
});

test('Phase 1.1+1.4: SectionRoomPicker exposes an ARIA combobox pattern (aria-controls, aria-haspopup, listbox/option roles)', () => {
	const picker = source('src/components/sections/SectionRoomPicker.tsx');
	// Trigger -> listbox linkage.
	assert.match(picker, /role="combobox"/);
	assert.match(picker, /aria-controls=\{listboxId\}/);
	assert.match(picker, /aria-haspopup="listbox"/);
	// Listbox + option semantics on the option container + each option.
	assert.match(picker, /role="listbox" aria-labelledby=\{triggerId\}/);
	assert.match(picker, new RegExp('role="option"\\s+aria-selected=\\{'));
	// The opaque onOpenAutoFocus suppression is gone (Phase 1.4).
	assert.doesNotMatch(picker, /onOpenAutoFocus=\{\(e\) => \{ e\.preventDefault\(\); \}\}/);
	// Phase 1.1: occupied-room hint with the swap cue.
	assert.match(picker, /data-testid="room-picker-occupied-hint"/);
	assert.match(picker, /Selecting this will move \{focusedOccupant\} out of this room/);
});

test('Phase 1.6: Sections row keeps only the section-name button and the kebab (Users icon removed)', () => {
	const sectionRow = source('src/components/sections/SectionRow.tsx');
	// The actions cell is the last <td> in the row and contains the kebab.
	// Anchor on the DropdownMenu block to isolate the actions cell.
	const dropdownIdx = sectionRow.indexOf('<DropdownMenu>');
	assert.ok(dropdownIdx > -1, 'Expected a DropdownMenu in SectionRow');
	const actionsCell = sectionRow.slice(0, sectionRow.indexOf('</tr>', dropdownIdx));
	// No Users-icon button next to the kebab (audit S-8 dedup).
	assert.doesNotMatch(actionsCell, /aria-label="View class coverage for/);
	assert.doesNotMatch(actionsCell, /aria-label="Open teaching load for/);
	assert.doesNotMatch(actionsCell, /<TooltipTrigger asChild>\s*<Button[\s\S]{0,200}View class coverage/);
	assert.doesNotMatch(actionsCell, /<TooltipContent>View class coverage and room context<\/TooltipContent>/);
	// Kebab remains.
	assert.match(actionsCell, /More actions for/);
	// Section-name button still has a visible tooltip.
	assert.match(sectionRow, /<TooltipContent>View section details<\/TooltipContent>/);
});

test('Phase 1.2: SwapConfirmationModal uses plain English and fixes the "becomes moved to" grammar', () => {
	const modals = source('src/components/sections/SectionHomeRoomModals.tsx');
	// Audit S-3 / S-4 / S-9.
	assert.doesNotMatch(modals, new RegExp('>Source Section<'));
	assert.doesNotMatch(modals, new RegExp('>Displaced Section<'));
	assert.doesNotMatch(modals, new RegExp('>Final Outcome<'));
	assert.doesNotMatch(modals, /becomes moved to/);
	// "becomes" appears in JSDoc comments and in the friendly "will have no home
	// room" copy; the audit specifically targeted the ungrammatical "becomes
	// moved to" construction, so we assert that pattern only.
	// Plain-language labels and copy.
	assert.match(modals, />This section</);
	assert.match(modals, />The other section</);
	assert.match(modals, />After this swap</);
	assert.match(modals, /moves to <span className="font-bold text-emerald-600">/);
	assert.match(modals, /will have no home room/);
	// Unassigned-path warning announces via role="alert".
	assert.match(modals, /role="alert"/);
	assert.match(modals, /data-testid="swap-displaced-unassigned-warning"/);
	assert.match(modals, /Reassign it before generating the timetable/);
	// Confirm icon switched to a plain ArrowRight (audit: "refresh icon reinforces ambiguity").
	assert.match(modals, new RegExp('<ArrowRight className="mr-2 size-4" />'));
	assert.match(modals, new RegExp('Confirm swap'));
});

test('Phase 1.3: UnassignConfirmationModal inverts the button order (safe first, destructive second)', () => {
	const modals = source('src/components/sections/SectionHomeRoomModals.tsx');
	// Safe "Keep" button appears before destructive in the rendered footer.
	const keepIndex = modals.search(/data-testid="unassign-modal-keep"/);
	const confirmIndex = modals.search(/data-testid="unassign-modal-confirm"/);
	assert.ok(keepIndex > -1 && confirmIndex > -1, 'Both buttons must be present');
	assert.ok(keepIndex < confirmIndex, 'Keep (safe) must precede destructive in the DOM');
	// Safe button gets autoFocus so a stray Enter does not destroy the assignment.
	assert.match(modals, new RegExp('autoFocus[\\s\\S]{0,200}data-testid="unassign-modal-keep"'));
	// Destructive button is second and visually distinct.
	assert.match(modals, /variant="destructive"[\s\S]{0,200}data-testid="unassign-modal-confirm"/);
});

test('Phase 2.1: SubjectFormModal stepper, default hours, and Available-for-timetable default', () => {
	const modal = source('src/components/subjects/SubjectFormModal.tsx');
	const constants = source('src/lib/subject-constants.ts');

	// Decision 2: emptyForm.isSeedable defaults to true.
	assert.match(constants, /isSeedable: true,/);

	// Step indicator (4 sections) so the scheduler knows where they are.
	assert.match(modal, /data-testid="subjects-form-stepper"/);
	assert.match(modal, /Identity/);
	assert.match(modal, /Time and room/);
	assert.match(modal, /Programs and owner/);
	assert.match(modal, /Advanced/);

	// Default unit is hours (was minutes before this pass).
	assert.match(modal, /useState<'minutes' \| 'hours'>\('hours'\)/);
	assert.match(modal, /setTimeMode\('hours'\)/);

	// "Skip if unsure" gate: Advanced collapsed by default in add mode.
	assert.match(modal, /setShowAdvanced\(mode === 'edit'\)/);
	assert.match(modal, /Skip if you are unsure/);

	// Decision 2: rename "Can be scheduled" to plain-language "Available for
	// timetable" with helper.
	assert.match(modal, /Available for timetable/);
	assert.doesNotMatch(modal, />Can be scheduled</);
	// Expanded helper text mentions the two use cases from the old tooltip.
	assert.match(modal, /Homeroom Guidance/);
	assert.match(modal, /consultation periods/);

	// Phase 0A.2 label floor: field labels are sentence case text-sm, not
	// sub-0.7rem uppercase.
	assert.match(modal, /text-sm font-semibold text-foreground/);
	assert.doesNotMatch(modal, /text-\[0\.7rem\] font-bold text-muted-foreground uppercase/);
});

test('Phase 2.2: SubjectFormModal shows inline validation errors and a tooltip on the disabled Save button', () => {
	const modal = source('src/components/subjects/SubjectFormModal.tsx');
	// Inline error text per field: role="alert" rendered per field; the
	// message strings exist in the validation builder.
	assert.match(modal, /nextValidationErrors\.code = 'Subject code is required\.'/);
	assert.match(modal, /nextValidationErrors\.name = 'Subject name is required\.'/);
	assert.match(modal, /nextValidationErrors\.programScopes = 'Pick at least one program scope\.'/);
	// role="alert" renders the interpolated per-field error.
	assert.match(modal, /role="alert"[\s\S]{0,300}\{validationErrors\.code\}/);
	// Tooltip on the disabled Save button names the missing field.
	assert.match(modal, /saveDisabledReason/);
	assert.match(modal, /'Enter a subject code\.'/);
	assert.match(modal, /'Enter a subject name\.'/);
	// Form is a real <form> with onSubmit.
	assert.match(modal, /<form[\s\S]{0,200}onSubmit=\{/);
});

test('Phase 2.3: Coverage drawer distinguishes fetch failure from empty coverage, gates panels, fixes width', () => {
	const subjects = source('src/pages/Subjects.tsx');
	// Failure-vs-empty distinction (audit Sub-5).
	assert.match(subjects, /coverageError/);
	assert.match(subjects, /Could not load coverage right now/);
	assert.match(subjects, /data-testid="coverage-drawer-error"/);
	// Term rotation panel gated on rotationFamily (audit Sub-4). The
	// header text "Term rotation" only renders inside that gate; the
	// negative assertion is intentionally not used because the literal
	// string legitimately appears inside the conditional branch.
	assert.match(subjects, /coverageSubject\.rotationFamily \? \(/);
	// Sheet width fix (audit Sub-10): proper Tailwind instead of "w-100 sm:w-135".
	assert.match(subjects, /<SheetContent className="w-full sm:max-w-md overflow-y-auto">/);
	assert.doesNotMatch(subjects, /<SheetContent className="w-100 sm:w-135/);
	// Resource requirements panel renders for non-classroom OR required features
	// (audit Sub-6). The expression uses defensive grouping; the test
	// accepts the core OR condition.
	assert.match(subjects, /coverageSubject\.preferredRoomType !== 'CLASSROOM'/);
	assert.match(subjects, /coverageSubject\.requiredFeatures\.length > 0/);
	assert.match(subjects, /Resource requirements/);
	// Coverage gaps title replaces "Uncovered scope" (which ignored program scopes).
	assert.doesNotMatch(subjects, />Uncovered scope</);
	assert.match(subjects, /Coverage gaps/);
	// The misleading green-check is replaced by a verify-in-Teaching-Load hint
	// when program scopes are set.
	assert.match(subjects, /Verify per-program coverage in Teaching Load/);
});

test('Phase 2.4: Subjects table exposes Teacher coverage column and accessible sort headers', () => {
	const subjects = source('src/pages/Subjects.tsx');
	// Teacher coverage column + 6-col layout (was 7 with orphaned Program/Grades split).
	assert.match(subjects, /<SortableHeader field="isSeedable" label="Teacher coverage"/);
	assert.match(subjects, /colSpan=\{6\}/);
	// aria-sort on the sortable <th>.
	assert.match(subjects, /aria-sort=/);
	// SortableHeader helper added (mirrors Phase 1.5).
	assert.match(subjects, /const SortableHeader = \(\{/);
});

test('Phase 2.5: Subjects page error banner has Try-again; Reset filters clears search; Checking is a spinner', () => {
	const subjects = source('src/pages/Subjects.tsx');
	// Error banner uses destructive semantic + has a Try again button.
	assert.match(subjects, /data-testid="subjects-error-retry"/);
	assert.match(subjects, /data-testid="subjects-error-banner"/);
	assert.doesNotMatch(subjects, /<div className="shrink-0 mx-6 mt-3 rounded-xl border border-red-200 bg-red-50/);
	// Reset filters also clears the search query.
	assert.match(subjects, /data-testid="subjects-reset-filters"/);
	assert.match(subjects, /setSearchQuery\(''\)/);
	// "Checking" string replaced by a spinner in the readiness strip.
	assert.match(subjects, /data-testid="subjects-missing-coverage-spinner"/);
	assert.doesNotMatch(subjects, /coverageRiskCount \?\? 'Checking'/);
	// hasActiveFilters now includes search.
	assert.match(subjects, /searchQuery\.trim\(\) !== ''/);
	// "All attention states" renamed to plain language.
	assert.doesNotMatch(subjects, /All attention states/);
});

test('Phase 2.6: SubjectRow uses compact grade format and accessible info for jargon badges', () => {
	const row = source('src/components/subjects/SubjectRow.tsx');
	// Compact grade format (Decision 5) -- template literal `GR${...}`, not `G${...}`.
	assert.ok(row.includes('GR${sorted[0]}') && row.includes('GR${g}'), 'compact grade format must use the GR${...} template');
	assert.ok(!row.includes('G${sorted[0]}') && !row.includes('G${g}'), 'legacy G${...} shorthand must be gone');
	// Sub-0.55rem uppercase-tracked sentence labels removed (Phase 0A.2 floor).
	assert.doesNotMatch(row, /text-\[0\.55rem\]/);
	// Accessible info used for jargon-y badges (room features).
	assert.match(row, /AccessibleInfo/);
	// Program text still rendered via programFullLabel in the Grades / program column.
	assert.match(row, /programFullLabel/);
});

test('Phase 3.1: Teachers desktop table has compact columns with load status, weekly load, and assigned classes', () => {
	const faculty = source('src/pages/Faculty.tsx');
	// Compact column layout: Teacher, Load status, Weekly load, Assigned classes.
	assert.match(faculty, /<FacultyAssignedClassesCell[\s\S]*faculty=\{teacher\}/);
	assert.match(faculty, /<FacultyWeeklyLoadCell faculty=\{teacher\} \/>/);
	assert.match(faculty, /label: 'Assigned classes'/);
	assert.match(faculty, /label: 'Weekly load'/);
	assert.match(faculty, /label: 'Load status'/);
	// No column descriptions in headers (simplified scanning).
	assert.doesNotMatch(faculty, /description: 'Name, adviser/);

	const row = source('src/components/faculty/FacultyRow.tsx');
	// The standard/cap must be visible in the tooltip (audit T-8).
	assert.match(row, /h standard/);
	assert.match(row, /max \$\{maxHours\}h/);
});

test('Phase 3.2: placeholders are visibly distinct with plain "Temporary" labels', () => {
	const row = source('src/components/faculty/FacultyRow.tsx');
	// "Temporary" label replaces the "Teacher X" brand string; AccessibleInfo
	// explains what a placeholder is.
	assert.match(row, /Temporary<\/Badge>/);
	assert.doesNotMatch(row, />Teacher X<\/Badge>/);
	assert.match(row, /AccessibleInfo/);
	assert.match(row, /TEACHER_X_LABEL/);
	// Violet avatar tint distinguishes placeholders from real teachers.
	assert.match(row, /isPlaceholder \? 'border-violet-200 bg-violet-50 text-violet-700'/);
});

test('Phase 3.3: attention chips use plain language, aria-pressed, tooltips, and no silent reset', () => {
	const faculty = source('src/pages/Faculty.tsx');
	// Plain-language chip labels.
	assert.match(faculty, /'No subjects assigned'/);
	assert.match(faculty, /'Above weekly max'/);
	assert.match(faculty, /'No sections assigned'/);
	assert.match(faculty, /'Temporary teachers'/);
	assert.match(faculty, /'All teachers'/);
	// aria-pressed + per-chip tooltips.
	assert.match(faculty, /aria-pressed=\{attentionFilter === chip\.id\}/);
	assert.match(faculty, /<TooltipContent side="bottom" className="max-w-60 text-xs">\{chip\.helper\}<\/TooltipContent>/);
	// "All teachers" no longer resets the department filter (audit T-6).
	assert.match(faculty, /if \(filter === 'all'\) \{\s*return;/);
});

test('Phase 3.4: Teachers strip stops saying "Load data is still loading" forever', () => {
	const faculty = source('src/pages/Faculty.tsx');
	// Heading renamed per the "fix" language rule.
	assert.doesNotMatch(faculty, /Next teacher to fix/);
	assert.match(faculty, /Next teacher to review/);
	// The perpetual "Load data is still loading." is replaced by a real
	// loading/empty/ready state machine.
	assert.doesNotMatch(faculty, /Load data is still loading/);
	assert.match(faculty, /Checking the teacher roster\.\.\./);
	assert.match(faculty, /No active teachers to review\. Sync the roster first\./);
	assert.match(faculty, /Every teacher looks ready to review\./);
});

test('Phase 3.5: CreatePlaceholderDialog uses empty defaults, plain labels, inline validation, and Enter-to-save', () => {
	const dialog = source('src/components/faculty/CreatePlaceholderDialog.tsx');
	// No more "Teacher X" default name.
	assert.doesNotMatch(dialog, /setFirstName\('Teacher'\)/);
	assert.doesNotMatch(dialog, /setLastName\('X'\)/);
	assert.match(dialog, /setFirstName\(''\)/);
	assert.match(dialog, /setLastName\(''\)/);
	// Inline field validation instead of toasts.
	assert.match(dialog, /fieldErrors\.firstName/);
	assert.match(dialog, /role="alert"/);
	// Plain labels: "Maximum weekly hours" + DepEd helper; no silent clamp.
	assert.match(dialog, />Maximum weekly hours</);
	assert.match(dialog, /Default 30h\. The DepEd maximum is \{MAX_WEEKLY_HOURS\}h per week\./);
	assert.doesNotMatch(dialog, /Math\.max\(1, Math\.min\(60/);
	// "Can teach outside their department" (full word, no "Dept").
	assert.match(dialog, />Can teach outside their department</);
	// Real <form> so Enter saves.
	assert.match(dialog, /<form[\s\S]{0,200}onSubmit=\{/);
	// Department options show plain labels.
	assert.match(dialog, /departmentLabel\(d\)/);
});

test('Phase 3.6: Teachers copy uses plain DepEd language (no credited/hard-repair/approval jargon)', () => {
	const sheet = source('src/components/faculty/FacultyProfileSheet.tsx');
	const helpers = source('src/lib/faculty-assignment-helpers.ts');
	const row = source('src/components/faculty/FacultyRow.tsx');
	// Profile sheet: "Credited workload" -> "Total weekly hours"; "hard repair
	// limit" -> plain-language absolute limit.
	assert.doesNotMatch(sheet, />Credited workload</);
	assert.doesNotMatch(sheet, /hard repair limit/);
	assert.doesNotMatch(sheet, />Credited load: /);
	assert.match(sheet, />Total weekly hours</);
	assert.match(sheet, /absolute limit before ATLAS cannot generate/);
	// Department badge expands codes via the glossary.
	assert.match(sheet, /departmentLabel\(faculty\.department\)/);
	// Decision 3: no fake "approval needed" process.
	assert.doesNotMatch(helpers, /approval needed/);
	assert.doesNotMatch(helpers, /must fix/);
	assert.match(helpers, /review before generating/i);
	assert.match(helpers, /move classes before generating/i);
	// Row load-state badge shows the standard/cap inline (not only in tooltip).
	assert.match(row, /h standard/);
	assert.doesNotMatch(row, /must be repaired before generation/);
});

test('Phase 4.5: Teaching Load coverage modes use plain DepEd labels', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(page, /Standard Teacher Load \(30h\)/);
	assert.doesNotMatch(page, /Hard Cap Utilization \(40h\)/);
	assert.doesNotMatch(page, /Hybrid Staffing \(Real \+ Temp\)/);
	assert.match(page, /Real teachers first, up to 30h\/week/);
	assert.match(page, /Maximum allowed hours \(40h\)/);
	assert.match(page, /Real teachers first, then substitutes/);
});

test('Phase 4.1: Teaching Load has a single next-step surface (TaskGuide removed)', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(page, /<TeachingLoadTaskGuide/);
	assert.match(page, /<TeachingLoadRepairQueue/);
	assert.doesNotMatch(page, /Fix first/);
	assert.doesNotMatch(page, /repair action first/);
});

test('Phase 4.2: repair queue is one-at-a-time with visible Skip and a skipped-items note', () => {
	const queue = source('src/components/faculty-assignments/TeachingLoadRepairQueue.tsx');
	// "Next fix" -> "Next step".
	assert.doesNotMatch(queue, />Next fix</);
	assert.ok(queue.includes('Next step'), 'repair queue badge must be plain-language "Next step"');
	// Next-items disclosure closed by default.
	assert.match(queue, /useState\(false\);\s*\/\/ Phase 4\.2/);
	assert.match(queue, /data-testid="teaching-load-next-items-toggle"/);
	assert.match(queue, /aria-expanded=\{showNextItems\}/);
	// Skip visible at all breakpoints (no sm:hidden).
	assert.doesNotMatch(queue, /className="h-8 px-2 text-xs font-bold sm:hidden"/);
	// Description/status no longer hidden at max-height:800px.
	assert.doesNotMatch(queue, /\[@media\(max-height:800px\)\]:hidden/);
	// Skipped-items note.
	assert.match(queue, /data-testid="teaching-load-skipped-note"/);
	assert.match(queue, /Skipped items still need action before generation/);
	// No "No urgent repair queued" jargon.
	assert.doesNotMatch(queue, /No urgent repair queued/);
});

test('Phase 4.3: Teaching Load has one save bar, a Discard confirmation, and a plain save-warning modal', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	// Discard opens a confirmation.
	assert.match(page, /showDiscardConfirm/);
	assert.match(page, /onDiscard=\{\(\) => setShowDiscardConfirm\(true\)\}/);
	assert.match(page, /Discard all/);
	// Save-warning modal in plain English (no "stale"/"displaced"/"allocations").
	assert.doesNotMatch(page, /will make the current active draft timetable stale/);
	assert.doesNotMatch(page, /will be displaced to the unassigned list/);
	assert.doesNotMatch(page, /subject allocations were modified/);
	assert.match(page, /will be moved back to the unassigned list/);
	const actionBar = source('src/components/faculty-assignments/TeachingLoadDraftActionBar.tsx');
	// Footer save bar stays visible at every viewport height.
	assert.doesNotMatch(actionBar, /\[@media\(max-height:500px\)\]:hidden/);
	assert.doesNotMatch(actionBar, /saveDisabledReason/);
});

test('Phase 4.4: split-brain copy is plain language; Quarantined badge renamed "Editing locked"', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(page, /Saved-truth reconcile requires writable runtime evidence/);
	assert.doesNotMatch(page, /Reloading current Teaching Load truth/);
	assert.doesNotMatch(page, /Saved coverage reconcile failed/);
	assert.doesNotMatch(page, /Repair saved scope drift/);
	assert.match(page, /Reconcile needs a live connection/);
	assert.match(page, /Reloaded the saved assignments/);
	// Quarantine state described in plain language.
	assert.doesNotMatch(page, /data\.splitBrainReasonLabel,\s*$/);
	assert.ok(page.includes('saved Teaching Load links that no longer match'), 'quarantine copy must use plain language');
	const subjectRow = source('src/components/faculty-assignments/SubjectRow.tsx');
	assert.doesNotMatch(subjectRow, />Quarantined</);
	assert.ok(subjectRow.includes('Editing locked'), 'quarantine badge must be plain-language "Editing locked"');
});

test('Phase 4.6: Teaching Load grid cells and row headers are keyboard-operable', () => {
	const subjectRow = source('src/components/faculty-assignments/SubjectRow.tsx');
	// Section cell exposes role="button" + Enter/Space handling.
	assert.match(subjectRow, /role=\{isClickable \? 'button' : undefined\}/);
	assert.match(subjectRow, /event\.key === 'Enter' \|\| event\.key === ' '/);
	assert.match(subjectRow, /tabIndex=\{isClickable \? 0 : undefined\}/);
	assert.match(subjectRow, /focus-visible:ring-2 focus-visible:ring-primary\/50/);
	const teacherGrid = source('src/components/faculty-assignments/TeacherGridMode.tsx');
	// Department + teacher row headers are keyboard-operable with aria-expanded.
	assert.match(teacherGrid, /role="button"[\s\S]{0,300}aria-expanded=\{!isCollapsed\}/);
	assert.match(teacherGrid, /role="button"[\s\S]{0,300}aria-expanded=\{isExpanded\}/);
	// Undo/Redo buttons are in the footer TeachingLoadDraftActionBar, not in expanded rows.
	const draftActionBar = source('src/components/faculty-assignments/TeachingLoadDraftActionBar.tsx');
	assert.match(draftActionBar, /aria-live="polite"/);
});

test('Phase 4.7: subject rows cap badges at one priority alert with an AccessibleInfo summary', () => {
	const subjectRow = source('src/components/faculty-assignments/SubjectRow.tsx');
	// Quarantined badge renamed to plain language; other signals moved into
	// AccessibleInfo.
	assert.doesNotMatch(subjectRow, />Rotating Term Lane</);
	assert.doesNotMatch(subjectRow, />Requires Specialization</);
	assert.doesNotMatch(subjectRow, />Outside Dept</);
	assert.ok(!subjectRow.includes('DB Conflict'), '"DB Conflict" must be fully removed (header + per-section)');
	assert.ok(subjectRow.includes('Owner conflict'), 'priority alert badge must be plain-language "Owner conflict"');
	assert.match(subjectRow, /<AccessibleInfo/);
	// Weekly load shown in hours, not the cryptic "m".
	assert.doesNotMatch(subjectRow, /\{subject\.minMinutesPerWeek\}m \/ week/);
	assert.match(subjectRow, /h \/ week/);
});

test('Phase 4.8: mobile inspector is accessible below lg via a Sheet', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.match(page, /data-testid="teaching-load-mobile-inspector-open"/);
	assert.match(page, /data-testid="teaching-load-mobile-inspector-sheet"/);
	assert.match(page, /className="fixed bottom-16 right-4 z-40 h-10 gap-2 font-bold shadow-lg lg:hidden"/);
});

test('Phase 4.9: StaffingAuditSheet uses a dense inline stat banner and plain headers', () => {
	const sheet = source('src/components/faculty-assignments/StaffingAuditSheet.tsx');
	assert.doesNotMatch(sheet, />Staffing Health Audit</);
	assert.doesNotMatch(sheet, /Operational report on current school year teaching load coverage/);
	assert.doesNotMatch(sheet, /Temp Roles/);
	assert.doesNotMatch(sheet, />Teacher X Assignments</);
	assert.doesNotMatch(sheet, /Overload States/);
	assert.doesNotMatch(sheet, /Go to Allocation Workflow/);
	assert.doesNotMatch(sheet, /w-100 sm:w-135/);
	assert.match(sheet, />Staffing summary</);
	assert.match(sheet, /InlineStat/);
	assert.match(sheet, /Assign by section/);
	assert.match(sheet, /className="w-full sm:max-w-md overflow-y-auto"/);
});

test('Phase 4.10: Teaching Load workspace state uses plain DepEd copy', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(page, /Write actions stay off until the connection returns/);
	assert.doesNotMatch(page, /it cannot safely write assignment changes yet/);
	assert.doesNotMatch(page, /Offline saved data/);
	assert.match(page, /Saving is off until ATLAS reconnects/);
	assert.match(page, /Saving is off while ATLAS verifies the roster with EnrollPro/);
	assert.match(page, /Editing is temporarily locked/);
});

test('Teaching Load lock recovery: helper checks broad quarantine conditions', () => {
	const helper = source('src/lib/teaching-load-lock-helpers.ts');
	// Must check quarantine.required and quarantine.severity (via local alias q)
	assert.match(helper, /\.required/);
	assert.match(helper, /\.severity/);
	// Must check stale ownership reason codes
	assert.match(helper, /STALE_OWNERSHIP_PRESENT/);
	assert.match(helper, /TRUTH_RECONCILE_PENDING/);
	assert.match(helper, /INTEGRITY_MISSING_OWNERSHIP/);
	assert.match(helper, /INTEGRITY_OWNERSHIP_WITHOUT_SCOPE/);
	assert.match(helper, /INTEGRITY_OUT_OF_SUBJECT_SCOPE/);
	// Must check counter-based conditions
	assert.match(helper, /staleOwnedCurrentYearPairs/);
	assert.match(helper, /loadReviewRows/);
	assert.match(helper, /integrityMissingOwnershipPairs/);
	assert.match(helper, /integrityOwnershipWithoutScopePairs/);
	assert.match(helper, /integrityOutOfSubjectScopePairs/);
});

test('Teaching Load lock recovery: dialog exists and does not use AutoFillSummaryModal', () => {
	const dialog = source('src/components/faculty-assignments/TeachingLoadLockRecoveryDialog.tsx');
	assert.match(dialog, /Review and unlock Teaching Load editing/);
	assert.match(dialog, /Unlock Teaching Load editing/);
	assert.match(dialog, /reconcile-split-brain|onConfirm/);
	assert.doesNotMatch(dialog, /AutoFillSummaryModal/);
	assert.doesNotMatch(dialog, /Suggested Teaching Load/);
});

test('Teaching Load lock recovery: TeachingLoad.tsx wires lock recovery dialog', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	// Must import the lock recovery helper
	assert.match(page, /hasTeachingLoadLockRecoveryAction/);
	// Must import the lock recovery dialog
	assert.match(page, /TeachingLoadLockRecoveryDialog/);
	// Must have lockRecoveryOpen state
	assert.match(page, /lockRecoveryOpen/);
	// Must NOT call applySplitBrainReconcile directly from toolbar reconcile click
	assert.doesNotMatch(page, /onReconcileClick.*applySplitBrainReconcile/);
});

test('Teaching Load lock recovery: RepairQueue has no interactive controls inside sr-only', () => {
	const queue = source('src/components/faculty-assignments/TeachingLoadRepairQueue.tsx');
	// Find all sr-only blocks and check they don't contain button elements
	const srOnlyBlocks = queue.match(/className="sr-only"[\s\S]*?<\/div>/g) ?? [];
	for (const block of srOnlyBlocks) {
		assert.doesNotMatch(block, /<Button/);
		assert.doesNotMatch(block, /<button/);
	}
});
