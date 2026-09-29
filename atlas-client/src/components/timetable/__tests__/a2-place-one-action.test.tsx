/**
 * A2 place-one-action — the DRAFT placement the operator just made must appear in
 * the grid IMMEDIATELY, in the term it was placed into, and still be there after a
 * reload. The defect: the draft projection dropped the placement's persisted
 * `termIndex`, so the grid's numeric-term filter (`matchesTermScope`) removed the
 * freshly placed class the moment it was committed — "invisible after placing".
 *
 * WHY THIS FILE MOUNTS THE REAL WORKSPACE. A source-text row would pass on the
 * broken projection. This test MOUNTS the real `ScheduleReviewWorkspace` default
 * export with only the workspace-state HOOK stubbed at the module boundary — the
 * same recipe `a2-mc-move-swap-grid-wiring.test.tsx` and `a2-c12-s2-310fix.test.tsx`
 * use. The grid, the term predicate and the draft projection are production code:
 * `gridEntries` is derived by the REAL `projectDraftPlacementsToEntries` and the
 * REAL `filterDraftEntriesForView` from a `draftBoard` whose placement carries
 * `termIndex`, exactly as `useTimetableData` now derives it.
 *
 *   P1  with the carried `termIndex`, the placed class renders in the grid under a
 *       numeric term filter.
 *   P2  MUTANT — the SAME placement projected without `termIndex` (the defect) is
 *       filtered out, and the grid says the draft is empty. This is the control
 *       that proves P1 is not vacuous.
 *   P3  an all-term view shows the placement either way, so the filter — not the
 *       projection — is the discriminator.
 *
 * Run: npx tsx --test src/components/timetable/__tests__/a2-place-one-action.test.tsx
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
	HTMLButtonElement: dom.window.HTMLButtonElement, HTMLInputElement: dom.window.HTMLInputElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
	DocumentFragment: dom.window.DocumentFragment, Node: dom.window.Node, Text: dom.window.Text, Comment: dom.window.Comment,
	Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent, MouseEvent: dom.window.MouseEvent, PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter, MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
	matches: false, media: query, onchange: null,
	addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
});
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const SLOT = { day: 'MONDAY', startTime: '06:00', endTime: '06:45' };
const TIME_SLOTS = [SLOT];
const PLACEMENT_ID = 501;

/** The REAL projection + the REAL view filter, as `useTimetableData` derives them. */
const { projectDraftPlacementsToEntries, filterDraftEntriesForView } = await import('@/lib/timetable-draft-entries');

function placement(termIndex: number | null) {
	return {
		id: PLACEMENT_ID,
		schoolId: 1,
		schoolYearId: 9,
		entryKind: 'SECTION',
		sectionId: 71,
		subjectId: 11,
		facultyId: 21,
		roomId: 31,
		day: 'MONDAY',
		startTime: '06:00',
		endTime: '06:45',
		cohortCode: null,
		status: 'DRAFT',
		lockedRunId: null,
		notes: null,
		version: 1,
		createdBy: 9,
		createdAt: '2026-09-30T00:00:00.000Z',
		updatedAt: '2026-09-30T00:00:00.000Z',
		termIndex,
	} as Record<string, unknown>;
}

/** The grid entries the workspace will render for a given placement term. */
function gridEntriesFor(termIndex: number | null, termFilter: 'all' | number) {
	const entries = projectDraftPlacementsToEntries([placement(termIndex) as never]);
	return filterDraftEntriesForView(entries, {
		programFilter: 'all',
		entryKindFilter: 'all',
		termFilter,
		sectionMap: new Map([
			[71, { id: 71, name: '7-A', programType: 'REGULAR' } as never],
		]),
	});
}

const subjectLabel = (id: number) => (id === 11 ? 'TLE' : `Subject ${id}`);
const sectionLabel = (id: number) => (id === 71 ? '7-Rizal' : `Section ${id}`);
const facultyLabel = (id: number) => (id === 21 ? 'Mr Cruz' : `Teacher ${id}`);
const noop = () => {};
const summary = () => ({ isPublished: false, unassignedCount: 0, assignedCount: 1, hardViolationCount: 0 });

function headerContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		isPreGenerationWorkspace: true, activeGeneratedRunId: null, leftTab: 'unassigned',
		leftPanelRef: { current: null }, presentationMode: 'workflow', setPresentationMode: noop,
		selectedRunId: null, handleRunChange: noop, runs: [],
		schoolId: 1, schoolYearId: 9, centerView: 'pre-generation', newDraftLoading: false,
		handleStartNewPreGenerationDraft: noop, openPreGenerationWorkspace: noop, returnToGeneratedRun: noop,
		generating: false, loading: false, handleTriggerGenerate: noop, draft: null,
		hardCount: 0, blockingHardCount: 0, softCount: 0, setPublishAcknowledged: noop,
		setShowPublishDialog: noop, exitPolicyView: noop, enterPolicyView: noop, enterManualEditView: noop,
		setKbSelectedSource: noop, setSelectedEntry: noop, switchCenterViewWithGuard: (action: () => void) => action(),
		openMapWorkspace: noop, handleRefresh: noop, editHistoryCount: 0, editHistoryReadState: 'ready',
		setShowEditHistory: noop, summary: summary(),
		tutorial: { start: noop, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel, subjectLabel, facultyLabel, setUnassignedReasonFilter: noop,
		requestPendingCount: 0, statusColor: () => 'muted',
		formatDuration: (value: number | null) => `${value}ms`, formatTimestamp: (value: string) => value,
		viewMode: 'section', setViewMode: noop, setEntityFilter: noop, focusSection: noop,
		sectionFocusId: null, hasSelectedEntry: false, setSelectedViolation: noop, setSeverityFilter: noop,
		entityFilter: 'all', groupedPivotEntities: [{ label: 'Grade 7', ids: [71] }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [], ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(), CONFLICT_CODES: new Set<string>(),
		DAYS: ['MONDAY'], DAY_SHORT: { MONDAY: 'Mon' },
		pivotLabel: (id: number) => `Entity ${id}`, programFilter: 'all', setProgramFilter: noop,
		entryKindFilter: 'all', setEntryKindFilter: noop, termFilter: 2,
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }],
		activeTermIndex: 2, onTermFilterChange: noop,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro' },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 1, hasPublishedReturnState: false, severityFilter: 'all',
		...overrides,
	};
}

function centerWorkspaceContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		centerView: 'pre-generation', selectedEntry: null,
		violationIndex: new Map<string, any[]>(), followUps: new Set<string>(),
		toggleFollowUp: async () => {}, exitPolicyView: noop, handleRefresh: noop,
		defaultSchoolId: 1, schoolYearId: 9, pendingAction: null,
		roomMap: new Map<number, any>([[31, { id: 31, name: 'Room 101', buildingShortCode: 'MN', buildingName: 'Main' }]]),
		facultyMap: new Map<number, any>([[21, { id: 21, lastName: 'Cruz', firstName: 'Pedro' }]]),
		subjectMap: new Map<number, any>([[11, { id: 11, code: 'TLE' }]]),
		draftEntries: [], previewEdit: async () => null, commitEdit: async () => true,
		previewLoading: false, commitLoading: false, subjectLabel, facultyLabel, sectionLabel,
		gradeForSection: () => 7, roomLabel: (id: number) => `Room ${id}`, roomLabelShort: (id: number) => `R${id}`,
		entryContextLabel: (entry: any) => `${entry.entryId} context`, formatFacultyInitials: () => 'XX',
		isStaleRoom: () => false, timeSlots: TIME_SLOTS, preGenOnboarding: false, setCenterView: noop,
		buildings: [], mapBuildingId: null, setMapBuildingId: noop, openBuildingWorkspace: async () => {},
		selectedMapBuilding: null, selectedMapBuildingFloors: [], mapRoomId: null, openRoomGridWorkspace: noop,
		presentationMode: 'workflow', draftBoard: null, draft: null, runs: [], newDraftLoading: false,
		entityFilter: 'all', pivotLabel: (id: number) => `Entity ${id}`, viewMode: 'section', termFilter: 2,
		setPreGenOnboarding: noop, gridEntries: [], highlightedEntryIds: new Set<string>(),
		kbSelectedSource: null, handleKbPlace: async () => {}, handleKbPlaceStart: noop,
		getCellConflict: null, getLiveCellConflict: () => null,
		navToFaculty: noop, navToSection: noop, navToRoom: noop,
		preGenPending: null, preGenPreviewLoading: false, preGenPreviewError: null, preGenPreview: null,
		commitPreGenPending: async () => {}, preGenSaving: false, setPreGenPending: noop,
		setPreGenPreview: noop, setPreGenPreviewError: noop, setPreGenAllowSoftOverride: noop,
		runsPending: false, runsUnavailableReason: null, selectedUnassigned: null, setSelectedUnassigned: noop,
		dayShort: { MONDAY: 'Mon' }, generating: false, handleTriggerGenerate: noop,
		previewTeachingLoadRepair: async () => null, commitTeachingLoadRepair: async () => null,
		handleStartNewPreGenerationDraft: async () => {}, tacticalSandboxOpen: false,
		setTacticalSandboxOpen: noop, policyRecord: null,
		...overrides,
	};
}

const draftBoard = {
	placements: [placement(2)],
	queue: [],
	periodSlots: TIME_SLOTS,
	classPeriodSlots: TIME_SLOTS,
	counts: { draft: 1, lockedForRun: 0, archived: 0, unscheduled: 0 },
	filters: { grades: [7], departments: [], buildings: [] },
};

function resolvedState(options: { termFilter: 'all' | number; placementTerm: number | null }): Record<string, any> {
	const gridEntries = gridEntriesFor(options.placementTerm, options.termFilter);
	return {
		loading: false, error: null, draft: null, showTopLoadingStrip: false, selectedEntry: null,
		headerContext: headerContext({ termFilter: options.termFilter }),
		centerWorkspaceContext: centerWorkspaceContext({
			centerView: 'pre-generation', draftBoard, draftEntries: gridEntries, gridEntries, termFilter: options.termFilter,
		}),
		dialogContext: dialogContext(),
		overlaysContext: {
			dialogContext: dialogContext(),
			tutorial: { active: false, complete: noop }, userRole: 'REGISTRAR', TUTORIAL_STEPS: [],
			blockerModalData: null, setBlockerModalData: noop, showExplainDrawer: false,
			setDrawerViolation: noop, setDrawerUnassigned: noop, drawerViolation: null, drawerUnassigned: null,
			formatDrawerMessage: (message: string) => message,
		},
		rightPanelContext: { rightPanelRef: { current: null }, formatConstraintMessage: (message: string) => message },
		leftRailContentContext: {}, leftPanelRef: { current: null },
		setIsLeftCollapsed: noop, isLeftCollapsed: false, isDesktop: true,
		isPreGenerationWorkspace: true, leftTab: 'unassigned', setLeftTab: noop,
		violations: [], summary: summary(), roomRequestSummary: null,
		subjectLabel, sectionLabel, facultyLabel,
		roomLabelShort: (id: number) => `R${id}`, formatFacultyInitials: () => 'XX',
		publishedChangeScope: null, publishedEntryChange: null, setPublishedEntryChange: noop,
		concurrentCommitNotice: null, dismissConcurrentCommit: noop,
		inlineActionStatus: null, setInlineActionStatus: noop,
		inlinePlacementPending: null, inlinePlacementRoomOptions: [], inlinePlacementSaving: false,
		inlinePlacementRoomChanging: false, changeInlinePlacementRoom: async () => {},
		confirmInlinePlacement: async () => {}, cancelInlinePlacement: noop,
		lastAutoSaveUndo: null, setLastAutoSaveUndo: noop, revertEditById: noop,
		revertDraftEditById: noop, sensors: [],
		handleGlobalDragStart: noop, handleGlobalDragMove: noop, handleGlobalDragOver: noop,
		handleGlobalDragEnd: noop, handleGlobalDragCancel: noop,
		swapClassTimesMode: 'inactive', setSwapClassTimesMode: noop, setSwapClassAEntryId: noop,
		setSwapClassBEntryId: noop, resetSwapClassTimesState: noop,
		facultyMap: new Map<number, any>(), previewTeachingLoadRepair: async () => null,
		commitTeachingLoadRepair: async () => null, handleRefresh: noop,
		pendingFacultyIssuePivot: null, confirmFacultyIssuePivot: noop, loadAll: noop,
		redoState: null, redoVersionStale: false, undoNotice: null, clearRedo: noop,
		revertLoading: false, redoLastEdit: async () => {},
		hasPublishedReturnState: false,
	};
}

function dialogContext(overrides: Record<string, any> = {}): Record<string, any> {
	const closed = new Proxy({}, { get: () => undefined }) as Record<string, unknown>;
	return {
		showUnassignConfirm: false, setShowUnassignConfirm: noop, setPendingUnassignId: noop,
		pendingUnassignId: null, unassignDraftPlacement: async () => {},
		showGenerateConfirm: false, setShowGenerateConfirm: noop, enforceShiftWindows: true,
		setEnforceShiftWindows: noop, draftBoardSummary: null, followUps: new Set<string>(),
		confirmGenerate: noop, activeSchoolYearLabel: 'SY 2026-2027', schoolYearSource: 'enrollpro',
		termSource: null, showResetDraftDialog: false, setShowResetDraftDialog: noop,
		openPreGenerationWorkspace: async () => {}, showLeavePreGenDialog: false, setShowLeavePreGenDialog: noop,
		pendingCenterSwitch: null, setPendingCenterSwitch: noop, requestPreview: null,
		requestPreviewLoading: false, setRequestPreview: noop, setSelectedRequestId: noop,
		setRequestAppeals: noop, setAppealReason: noop, requestPreviewHardConflicts: [],
		requestPreviewSoftWarnings: [], requestAppeals: [], appealsLoading: false,
		isPrivilegedUser: true, canRequestPublication: true, canApprovePublication: true,
		updateAppealStatus: async () => {}, appealReason: '', appealSubmitting: false,
		submitAppeal: async () => {}, requestReviewerNotes: '', setRequestReviewerNotes: noop,
		requestReviewSaving: false, reviewRoomRequest: async () => {}, generating: false,
		generationElapsed: 0, showPublishDialog: false, setShowPublishDialog: noop,
		publishAcknowledged: false, setPublishAcknowledged: noop, softCount: 0, publishUnassignedCount: 0,
		policy: null, handlePublishConfirm: noop, captureReviewFocusReturn: noop, restoreReviewFocus: noop,
		showPreGenConfirm: false, setShowPreGenConfirm: noop, setPreGenConfirmCtx: noop,
		setConfirmPreview: noop, setConfirmRawPreview: noop, setConfirmPreviewError: noop,
		setConfirmAllowSoftOverride: noop, setConfirmAllowDailyOverride: noop, preGenConfirmCtx: null,
		confirmFacultyId: '', setConfirmFacultyId: noop, confirmPreview: null, confirmRoomId: '',
		setConfirmRoomId: noop, facultyMap: new Map<number, any>(), roomMap: new Map<number, any>(),
		DAYS: ['MONDAY'], DAY_SHORT: { MONDAY: 'Mon' },
		confirmPreviewLoading: false, confirmPreviewError: null, confirmDisplacedPlacement: null,
		toast: { error: noop }, openSwapPrompt: noop, confirmAllowDailyOverride: false,
		confirmSaving: false, commitConfirmPlacement: async () => {}, showSwapConfirm: false,
		setShowSwapConfirm: noop, setSwapAction: noop, swapAction: null, formatFacultyInitials: () => 'XX',
		roomLabelShort: (roomId: number) => `R${roomId}`, subjectLabel, sectionLabel, swapSaving: false,
		executeSwapAction: async () => {}, swapPreview: null, regularSwapPreview: null,
		regularSwapPending: null, setRegularSwapPending: noop, resetSwapClassTimesState: noop,
		regularSwapSaving: false, regularSwapStrategy: null, setRegularSwapStrategy: noop,
		executeRegularSwap: async () => {}, showSoftConfirm: false, setShowSoftConfirm: noop,
		softConfirmWarnings: [], commitLoading: false,
		formatConstraintMessage: (message: string) => message, setPendingCommitProposal: noop,
		setPreviewResult: noop, setSoftConfirmWarnings: noop, setDragItem: noop, pendingCommitProposal: null,
		commitEdit: async () => true, showAssignmentPicker: false, setShowAssignmentPicker: noop,
		setAssignPickerTarget: noop, assignPickerTarget: null, assignPickerFacultyId: '',
		setAssignPickerFacultyId: noop, assignPickerRoomId: '', setAssignPickerRoomId: noop,
		assignPickerPreview: null, assignPickerPreviewLoading: false, assignPickerPreviewError: null,
		assignPickerSaving: false, confirmAssignmentPicker: async () => {}, showEditHistory: false,
		setShowEditHistory: noop, editHistory: [], revertEditById: async () => true, revertLoading: false,
		currentRunVersion: null, publishedSwapScope: null, onPublishedSwapScheduled: noop,
		...closed,
		...overrides,
	};
}

let currentState: Record<string, any> = resolvedState({ termFilter: 2, placementTerm: 2 });
mock.module(import.meta.resolve('@/hooks/useScheduleReviewWorkspaceState'), {
	namedExports: { useScheduleReviewWorkspaceState: () => currentState },
});

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter } = await import('react-router-dom');
const { default: ScheduleReviewWorkspace } = await import('../ScheduleReviewWorkspace');

async function mountWorkspace(state: Record<string, any>): Promise<HTMLElement> {
	currentState = state;
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(createElement(MemoryRouter, { initialEntries: ['/timetable/pre-generation'] }, createElement(ScheduleReviewWorkspace)));
	});
	return host;
}

const ENTRY_SELECTOR = `[data-timetable-entry-id="draft-placement-${PLACEMENT_ID}"]`;

test('P1 the placed class renders in the grid under a numeric term filter', async () => {
	const host = await mountWorkspace(resolvedState({ termFilter: 2, placementTerm: 2 }));
	const entry = host.querySelector(ENTRY_SELECTOR);
	assert.ok(entry, 'a draft placement carrying termIndex 2 must render in the Term 2 grid');
	// Precondition, so P1 cannot pass on an empty stub grid: the entry carries its
	// real subject label reachable through the production projection.
	assert.match(entry!.textContent ?? '', /TLE/, 'the rendered cell names the placed subject');
	assert.equal(host.querySelectorAll('[data-testid="timetable-draft-empty-note"]').length, 0, 'the grid is not empty');
});

test('P2 MUTANT — without the carried termIndex the same placement disappears', async () => {
	// The projection the defect shipped: a placement whose term is not carried.
	// `null` is what the old inline projection produced for every placement.
	const host = await mountWorkspace(resolvedState({ termFilter: 2, placementTerm: null }));
	assert.equal(host.querySelector(ENTRY_SELECTOR), null, 'an unscoped placement is invisible under a numeric term filter');
	assert.equal(host.querySelectorAll('[data-testid="timetable-draft-empty-note"]').length, 1,
		'the grid reports the draft as empty — the exact "invisible after placing" symptom');
});

test('P3 an all-term view shows the placement regardless, so the filter is the discriminator', async () => {
	const host = await mountWorkspace(resolvedState({ termFilter: 'all', placementTerm: null }));
	assert.ok(host.querySelector(ENTRY_SELECTOR),
		'all-term review shows an unscoped placement, so P2 fails on the filter and not on a broken projection');
});
