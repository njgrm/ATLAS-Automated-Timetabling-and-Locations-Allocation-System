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

	assert.match(timetableGrid, /const \[dragPreviewSource, setDragPreviewSource\] = useState<GridDragSource>\(null\)/);
	assert.match(timetableGrid, /atlas:timetable-drag-source/);
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

	assert.match(workspaceState, /placeGeneratedUnassigned/);
	assert.match(workspaceState, /targetFacultyId: item\.facultyId/);
	assert.match(workspaceState, /targetRoomId: item\.homeRoomId/);
	assert.match(workspaceState, /This session has no Teaching Load owner yet/);
	assert.doesNotMatch(workspaceState, /activeDragItem\.type === 'unassigned'[\s\S]{0,500}setShowAssignmentPicker\(true\)/);
	assert.doesNotMatch(workspaceState, /fakeItem\.type === 'unassigned'[\s\S]{0,500}setShowAssignmentPicker\(true\)/);
	assert.doesNotMatch(assignmentDialogs, /Assign teacher and room/);
	assert.doesNotMatch(assignmentDialogs, /Choose teacher/);
	assert.doesNotMatch(assignmentDialogs, /Choose room/);
	assert.match(generatedRail, /Fix teaching load/);
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
	assert.doesNotMatch(placementDialogs, /SearchableSelect/);
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
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const mutationHook = source('src/hooks/useTimetableMutations.ts');

	assert.match(header, /data-testid=\{`timetable-task-\$\{task\.id\}`\}/);
	assert.match(header, /className="h-11 shrink-0/);
	assert.match(header, /data-testid="timetable-foolproof-help"/);
	assert.match(header, /No precision dragging required/);
	assert.match(header, /Can place = empty slot\. Can swap = occupied slot\. Blocked = fix first\. Warning = review only\./);
	assert.match(header, /data-testid="timetable-status-legend"/);
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
