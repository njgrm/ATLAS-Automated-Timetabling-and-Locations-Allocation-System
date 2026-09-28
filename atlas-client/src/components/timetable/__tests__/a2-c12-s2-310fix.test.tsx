/**
 * A2 C12 S2 FIX — the RENDERED control for the `/timetable` crash in staging
 * (release candidate `e59b8ba1`, chunk `ScheduleReviewWorkspace`, minified React
 * error #310).
 *
 * ── WHAT WAS SEEN ──────────────────────────────────────────────────────────
 * 5 of 5 loads of `/timetable` rendered the loading line, and about a second later
 * the page replaced itself with "This page hit an unexpected error". The grid never
 * rendered. Minified React error #310 is "Rendered more hooks than during the
 * previous render", and the transition is exactly the loading -> resolved one: the
 * first render returns early (no draft yet), and the render that follows the latest
 * run resolving reaches a hook the first one never called.
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT MAY NOT DO ────────────────────────────
 * Per AGENTS.md "Done means seen": "A test that only asserts source text (a
 * string, an import, a prop name in a file) is not acceptance evidence for a
 * user-facing change." A source-text row could have said `useMemo` appears after
 * `if (state.loading && !state.draft)` and passed against a workspace that still
 * crashes. So every row below MOUNTS the REAL default export of
 * `ScheduleReviewWorkspace.tsx` into a real JSDOM document, with only the
 * workspace-state hook stubbed at the module boundary — the same recipe
 * `timetable-lifecycle-loading-render-c03.test.tsx` already uses to mount this
 * component. Nothing else is stubbed: the grid, the Simple header, the move
 * derivation and the M3 highlight are production code.
 *
 * ── THE DISCRIMINATION ROW ─────────────────────────────────────────────────
 * Row 1 is the failing-first control. It is stated twice, once for each side:
 *
 *   • UNFIXED source (the `useMemo` below the early return, commit `d5ea8fca`):
 *     FAILS. Render 1 (loading, no draft) returns at the loading guard having
 *     called one hook fewer; render 2 (the same mounted tree, run resolved)
 *     reaches the memo, and React throws error #310. The literal dev-build text
 *     observed on this repository — and the exact same run under the MUTANT —
 *     is `Rendered more hooks than during the previous render.`; the production
 *     build shows the same invariant as `Minified React error #310`.
 *   • FIXED source (the memo hoisted above every early return): PASSES, and the
 *     resolved tree renders the real grid cells.
 *
 * Row 4 is the MUTANT row: it is labelled as such, and the mutant (memo moved
 * back below the loading early return) was applied to the source, the suite was
 * run, the failure was captured, and the file was restored byte-exact
 * (`git diff --exit-code` on the source path). The mutant is NOT in the tree.
 *
 * JSDOM has no layout engine, so nothing here measures pixels. "The grid rendered"
 * is read from the real grid's own cells (`td[data-day][data-start-time]`), the
 * same DOM surface the existing C11 M3 rows use.
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { Component, act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	SVGElement: dom.window.SVGElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

// The resolved centre arm mounts production hooks that read a media query
// (`useTimetableState` and the compact-viewport branch). JSDOM implements
// `matchMedia` as absent, so the real component would throw before rendering.
// This is a platform stub, not a product stub: the component, its hooks and the
// grid are all the real ones.
(dom.window as any).matchMedia = (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
	dispatchEvent: () => false,
});

// Radix's dismissable layer calls these on every pointer event; JSDOM implements
// none of them. The same stubs the header-banner and draft-action slices use.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

// ═══ FIXTURES ══════════════════════════════════════════════════════════════

const noop = () => {};

/** The four slots the grid renders in this row, exactly the C11 M3 fixture's. */
const TIME_SLOTS = [
	{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	{ day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	{ day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
	{ day: 'TUESDAY', startTime: '06:00', endTime: '06:45' },
];

/** The class the operator armed as the move source. Its OWN slot is never a target. */
const SELECTED_ENTRY = {
	entryId: 'e-moving',
	day: 'MONDAY',
	startTime: '06:00',
	endTime: '06:45',
	roomId: 11,
	facultyId: 21,
	subjectId: 31,
	sectionId: 41,
	termIndex: 1,
} as any;

/** A SECOND class, so "Tuesday has no free target" is a real exclusion, not an empty day. */
const TUESDAY_ENTRY = {
	entryId: 'e-tuesday',
	day: 'TUESDAY',
	startTime: '06:00',
	endTime: '06:45',
	roomId: 12,
	facultyId: 22,
	subjectId: 32,
	sectionId: 42,
	termIndex: 1,
} as any;

const DRAFT = {
	runId: 7,
	version: 3,
	entries: [SELECTED_ENTRY, TUESDAY_ENTRY],
	unassignedItems: [],
	violations: [],
	summary: { isPublished: false, unassignedCount: 0, assignedCount: 2, hardViolationCount: 0 },
	createdAt: '2026-09-28T08:00:00.000Z',
	finishedAt: '2026-09-28T08:00:00.000Z',
} as any;

const summaryOf = (overrides: Record<string, unknown> = {}) => ({
	isPublished: false,
	unassignedCount: 0,
	assignedCount: 2,
	hardViolationCount: 0,
	...(overrides as Record<string, never>),
});

/**
 * The Simple header's context. This is the real header's prop shape, with a real
 * run and a real selected class — a fixture that renders it, not one that skips it.
 */
function headerContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 7,
		leftTab: 'sessions',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: noop,
		selectedRunId: '7',
		handleRunChange: noop,
		runs: [{ id: 7, createdAt: '2026-09-28T08:00:00.000Z', durationMs: 4200, status: 'COMPLETED' }],
		schoolId: 1,
		schoolYearId: 1,
		centerView: 'schedule',
		newDraftLoading: false,
		handleStartNewPreGenerationDraft: noop,
		openPreGenerationWorkspace: noop,
		returnToGeneratedRun: noop,
		generating: false,
		loading: false,
		handleTriggerGenerate: noop,
		draft: DRAFT,
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		setPublishAcknowledged: noop,
		setShowPublishDialog: noop,
		exitPolicyView: noop,
		enterPolicyView: noop,
		enterManualEditView: noop,
		setKbSelectedSource: noop,
		setSelectedEntry: noop,
		switchCenterViewWithGuard: (action: () => void) => action(),
		openMapWorkspace: noop,
		handleRefresh: noop,
		editHistoryCount: 0,
		editHistoryReadState: 'ready',
		setShowEditHistory: noop,
		summary: summaryOf(),
		tutorial: { start: noop, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel: (id: number) => (id === 41 ? 'GR7 - Luna' : 'Section'),
		subjectLabel: (id: number) => (id === 31 ? 'TLE' : 'Subject'),
		facultyLabel: () => 'Cruz, Pedro',
		setUnassignedReasonFilter: noop,
		requestPendingCount: 0,
		statusColor: () => 'muted',
		formatDuration: (value: number | null) => `${value}ms`,
		formatTimestamp: (value: string) => value,
		viewMode: 'section',
		setViewMode: noop,
		setEntityFilter: noop,
		focusSection: noop,
		sectionFocusId: null,
		hasSelectedEntry: true,
		setSelectedViolation: noop,
		setSeverityFilter: noop,
		entityFilter: 'all',
		groupedPivotEntities: [{ label: 'Grade 7', ids: [41] }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		DAYS: ['MONDAY', 'TUESDAY'],
		DAY_SHORT: { MONDAY: 'Mon', TUESDAY: 'Tue' },
		pivotLabel: (id: number) => `Entity ${id}`,
		programFilter: 'all',
		setProgramFilter: noop,
		entryKindFilter: 'all',
		setEntryKindFilter: noop,
		termFilter: 2,
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }, { value: '3', label: 'TERM 3' }],
		activeTermIndex: 2,
		onTermFilterChange: noop,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro' },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 0,
		hasPublishedReturnState: false,
		severityFilter: 'all',
		...overrides,
	};
}

/**
 * The centre workspace context: the real props the real `CenterWorkspace` spreads
 * into the real pane surface, so the real grid renders real cells.
 */
function centerWorkspaceContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		centerView: 'schedule',
		selectedEntry: SELECTED_ENTRY,
		violationIndex: new Map<string, any[]>(),
		followUps: new Set<string>(),
		toggleFollowUp: async () => {},
		exitPolicyView: noop,
		handleRefresh: noop,
		defaultSchoolId: 1,
		schoolYearId: 1,
		pendingAction: null,
		roomMap: new Map<number, any>([[11, { id: 11, name: 'Room 101' }], [12, { id: 12, name: 'Room 102' }]]),
		facultyMap: new Map<number, any>([
			[21, { id: 21, lastName: 'Cruz', firstName: 'Pedro' }],
			[22, { id: 22, lastName: 'Reyes', firstName: 'Ana' }],
		]),
		subjectMap: new Map<number, any>([
			[31, { id: 31, code: 'TLE', name: 'Technology' }],
			[32, { id: 32, code: 'ESP', name: 'Español' }],
		]),
		draftEntries: [SELECTED_ENTRY, TUESDAY_ENTRY],
		previewEdit: async () => null,
		commitEdit: async () => true,
		previewLoading: false,
		commitLoading: false,
		subjectLabel: (id: number) => (id === 31 ? 'Technology' : 'Subject'),
		facultyLabel: (id: number) => (id === 21 ? 'Cruz, Pedro' : 'Teacher'),
		sectionLabel: (id: number) => (id === 41 ? 'GR7 - Luna' : 'Section'),
		gradeForSection: () => 7,
		roomLabel: (id: number) => `Room ${id}`,
		roomLabelShort: (id: number) => `R${id}`,
		entryContextLabel: (entry: any) => `${entry.entryId} context`,
		formatFacultyInitials: (id: number) => (id === 21 ? 'PC' : 'XX'),
		isStaleRoom: () => false,
		timeSlots: TIME_SLOTS,
		preGenOnboarding: false,
		setCenterView: noop,
		buildings: [],
		mapBuildingId: null,
		setMapBuildingId: noop,
		openBuildingWorkspace: async () => {},
		selectedMapBuilding: null,
		selectedMapBuildingFloors: [],
		mapRoomId: null,
		openRoomGridWorkspace: noop,
		presentationMode: 'workflow',
		draftBoard: null,
		draft: DRAFT,
		runs: [{ id: 7 }],
		newDraftLoading: false,
		entityFilter: 'all',
		pivotLabel: (id: number) => `Entity ${id}`,
		viewMode: 'section',
		termFilter: '2',
		setPreGenOnboarding: noop,
		gridEntries: [SELECTED_ENTRY, TUESDAY_ENTRY],
		highlightedEntryIds: new Set<string>(),
		kbSelectedSource: null,
		handleKbPlace: async () => {},
		getCellConflict: null,
		getLiveCellConflict: () => null,
		navToFaculty: noop,
		navToSection: noop,
		navToRoom: noop,
		preGenPending: null,
		preGenPreviewLoading: false,
		preGenPreviewError: null,
		preGenPreview: null,
		commitPreGenPending: async () => {},
		preGenSaving: false,
		setPreGenPending: noop,
		setPreGenPreview: noop,
		setPreGenPreviewError: noop,
		setPreGenAllowSoftOverride: noop,
		runsPending: false,
		runsUnavailableReason: null,
		// Props `CenterWorkspace` itself owns (its sandbox dock and generators).
		selectedUnassigned: null,
		setSelectedUnassigned: noop,
		dayShort: { MONDAY: 'Mon', TUESDAY: 'Tue' },
		generating: false,
		handleTriggerGenerate: noop,
		previewTeachingLoadRepair: async () => null,
		commitTeachingLoadRepair: async () => null,
		handleStartNewPreGenerationDraft: async () => {},
		tacticalSandboxOpen: false,
		setTacticalSandboxOpen: noop,
		policyRecord: null,
		...overrides,
	};
}

/**
 * The dialog context, every dialog closed.
 *
 * It is large because the production dialog set is large; it is spelled out rather
 * than `Proxy`-ed so a missing field fails loudly at the row that needs it, and it
 * is all-closed so the rows below are decided by the workspace's own render, not by
 * whichever dialog happens to be open.
 */
function dialogContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		showUnassignConfirm: false,
		setShowUnassignConfirm: noop,
		setPendingUnassignId: noop,
		pendingUnassignId: null,
		unassignDraftPlacement: async () => {},
		showGenerateConfirm: false,
		setShowGenerateConfirm: noop,
		enforceShiftWindows: true,
		setEnforceShiftWindows: noop,
		draftBoardSummary: null,
		followUps: new Set<string>(),
		confirmGenerate: noop,
		activeSchoolYearLabel: 'SY 2026-2027',
		schoolYearSource: 'enrollpro',
		termSource: null,
		showResetDraftDialog: false,
		setShowResetDraftDialog: noop,
		openPreGenerationWorkspace: async () => {},
		showLeavePreGenDialog: false,
		setShowLeavePreGenDialog: noop,
		pendingCenterSwitch: null,
		setPendingCenterSwitch: noop,
		requestPreview: null,
		requestPreviewLoading: false,
		setRequestPreview: noop,
		setSelectedRequestId: noop,
		setRequestAppeals: noop,
		setAppealReason: noop,
		requestPreviewHardConflicts: [],
		requestPreviewSoftWarnings: [],
		requestAppeals: [],
		appealsLoading: false,
		isPrivilegedUser: true,
		canRequestPublication: true,
		canApprovePublication: true,
		updateAppealStatus: async () => {},
		appealReason: '',
		appealSubmitting: false,
		submitAppeal: async () => {},
		requestReviewerNotes: '',
		setRequestReviewerNotes: noop,
		requestReviewSaving: false,
		reviewRoomRequest: async () => {},
		generating: false,
		generationElapsed: 0,
		showPublishDialog: false,
		setShowPublishDialog: noop,
		publishAcknowledged: false,
		setPublishAcknowledged: noop,
		softCount: 0,
		publishUnassignedCount: 0,
		policy: null,
		handlePublishConfirm: noop,
		captureReviewFocusReturn: noop,
		restoreReviewFocus: noop,
		showPreGenConfirm: false,
		setShowPreGenConfirm: noop,
		setPreGenConfirmCtx: noop,
		setConfirmPreview: noop,
		setConfirmRawPreview: noop,
		setConfirmPreviewError: noop,
		setConfirmAllowSoftOverride: noop,
		setConfirmAllowDailyOverride: noop,
		preGenConfirmCtx: null,
		confirmFacultyId: '',
		setConfirmFacultyId: noop,
		confirmPreview: null,
		confirmRoomId: '',
		setConfirmRoomId: noop,
		facultyMap: new Map<number, any>(),
		roomMap: new Map<number, any>(),
		DAYS: ['MONDAY', 'TUESDAY'],
		DAY_SHORT: { MONDAY: 'Mon', TUESDAY: 'Tue' },
		confirmPreviewLoading: false,
		confirmPreviewError: null,
		confirmDisplacedPlacement: null,
		toast: { error: noop },
		openSwapPrompt: noop,
		confirmAllowDailyOverride: false,
		confirmSaving: false,
		commitConfirmPlacement: async () => {},
		showSwapConfirm: false,
		setShowSwapConfirm: noop,
		setSwapAction: noop,
		swapAction: null,
		formatFacultyInitials: () => 'XX',
		roomLabelShort: (roomId: number) => `R${roomId}`,
		subjectLabel: () => 'Subject',
		sectionLabel: () => 'Section',
		swapSaving: false,
		executeSwapAction: async () => {},
		swapPreview: null,
		regularSwapPreview: null,
		regularSwapPending: null,
		setRegularSwapPending: noop,
		resetSwapClassTimesState: noop,
		regularSwapSaving: false,
		regularSwapStrategy: null,
		setRegularSwapStrategy: noop,
		executeRegularSwap: async () => {},
		showSoftConfirm: false,
		setShowSoftConfirm: noop,
		softConfirmWarnings: [],
		commitLoading: false,
		formatConstraintMessage: (message: string) => message,
		setPendingCommitProposal: noop,
		setPreviewResult: noop,
		setSoftConfirmWarnings: noop,
		setDragItem: noop,
		pendingCommitProposal: null,
		commitEdit: async () => true,
		showAssignmentPicker: false,
		setShowAssignmentPicker: noop,
		setAssignPickerTarget: noop,
		assignPickerTarget: null,
		assignPickerFacultyId: '',
		setAssignPickerFacultyId: noop,
		assignPickerRoomId: '',
		setAssignPickerRoomId: noop,
		assignPickerPreview: null,
		assignPickerPreviewLoading: false,
		assignPickerPreviewError: null,
		assignPickerSaving: false,
		confirmAssignmentPicker: async () => {},
		showEditHistory: false,
		setShowEditHistory: noop,
		editHistory: [],
		revertEditById: async () => true,
		revertLoading: false,
		currentRunVersion: null,
		publishedSwapScope: null,
		onPublishedSwapScheduled: noop,
		...overrides,
	};
}

/** LOADING: the very first render of `/timetable` — no draft yet, so the early return fires. */
function loadingState(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		loading: true,
		draft: null,
		error: null,
		showTopLoadingStrip: true,
		headerContext: headerContext({ draft: null, loading: true }),
		centerWorkspaceContext: centerWorkspaceContext(),
		dialogContext: dialogContext(),
		overlaysContext: {
			dialogContext: dialogContext(),
			tutorial: { active: false, complete: noop },
			userRole: 'REGISTRAR',
			TUTORIAL_STEPS: [],
			blockerModalData: null,
			setBlockerModalData: noop,
			showExplainDrawer: false,
			setDrawerViolation: noop,
			setDrawerUnassigned: noop,
			drawerViolation: null,
			drawerUnassigned: null,
			formatDrawerMessage: (message: string) => message,
		},
		rightPanelContext: { rightPanelRef: { current: null }, formatConstraintMessage: (message: string) => message },
		leftRailContentContext: {},
		leftPanelRef: { current: null },
		setIsLeftCollapsed: noop,
		isLeftCollapsed: false,
		isDesktop: true,
		isPreGenerationWorkspace: false,
		leftTab: 'sessions',
		setLeftTab: noop,
		violations: [],
		summary: summaryOf(),
		roomRequestSummary: null,
		selectedEntry: null,
		subjectLabel: () => 'Subject',
		sectionLabel: () => 'Section',
		publishedChangeScope: null,
		publishedEntryChange: null,
		setPublishedEntryChange: noop,
		concurrentCommitNotice: null,
		dismissConcurrentCommit: noop,
		inlineActionStatus: null,
		setInlineActionStatus: noop,
		inlinePlacementPending: null,
		inlinePlacementRoomOptions: [],
		inlinePlacementSaving: false,
		inlinePlacementRoomChanging: false,
		changeInlinePlacementRoom: async () => {},
		confirmInlinePlacement: async () => {},
		cancelInlinePlacement: noop,
		lastAutoSaveUndo: null,
		setLastAutoSaveUndo: noop,
		revertEditById: noop,
		revertDraftEditById: noop,
		sensors: [],
		handleGlobalDragStart: noop,
		handleGlobalDragMove: noop,
		handleGlobalDragOver: noop,
		handleGlobalDragEnd: noop,
		handleGlobalDragCancel: noop,
		swapClassTimesMode: 'inactive',
		setSwapClassTimesMode: noop,
		setSwapClassAEntryId: noop,
		setSwapClassBEntryId: noop,
		resetSwapClassTimesState: noop,
		facultyMap: new Map<number, any>(),
		previewTeachingLoadRepair: async () => null,
		commitTeachingLoadRepair: async () => null,
		handleRefresh: noop,
		pendingFacultyIssuePivot: null,
		confirmFacultyIssuePivot: noop,
		loadAll: noop,
		redoState: null,
		redoVersionStale: false,
		undoNotice: null,
		clearRedo: noop,
		revertLoading: false,
		redoLastEdit: async () => {},
		...overrides,
	};
}

/** RESOLVED: the latest run arrived, so the loading early return is not taken. */
function resolvedState(overrides: Record<string, any> = {}): Record<string, any> {
	return loadingState({
		loading: false,
		draft: DRAFT,
		showTopLoadingStrip: false,
		selectedEntry: SELECTED_ENTRY,
		headerContext: headerContext(),
		inlineActionStatus: { tone: 'loading', message: 'Select one of the 2 highlighted free time slots to preview this move.' },
		...overrides,
	});
}

// ═══ MOUNT THE REAL WORKSPACE ═════════════════════════════════════════════

let currentState: Record<string, any> = loadingState();
const capturedErrors: Array<{ message: string; stack: string }> = [];

mock.module(import.meta.resolve('@/hooks/useScheduleReviewWorkspaceState'), {
	namedExports: { useScheduleReviewWorkspaceState: () => currentState },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { default: ScheduleReviewWorkspace } = await import('../ScheduleReviewWorkspace');

/**
 * A real error boundary above the workspace.
 *
 * The staging page reported the crash through the app's own route error surface, so
 * "no error boundary fires" is the acceptance condition, not a bare absence of a
 * thrown exception: a row that only checked that `act` returned would pass on a
 * workspace that unmounted itself and rendered nothing.
 */
class RecordingBoundary extends Component<{ children: any }, { failed: boolean }> {
	constructor(props: { children: any }) {
		super(props);
		this.state = { failed: false };
	}
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch(error: any) {
		capturedErrors.push({ message: String(error?.message ?? error), stack: String(error?.stack ?? '') });
	}
	render() {
		return this.state.failed ? createElement('div', { 'data-testid': 'workspace-error-boundary' }) : this.props.children;
	}
}

const roots: any[] = [];
after(() => {
	for (const mounted of roots.splice(0)) {
		try { mounted.unmount(); } catch { /* an unmount after a caught error is not a row failure */ }
	}
	dom.window.close();
	mock.restoreAll();
});

/**
 * Mount the REAL workspace once and hand back a way to re-render that SAME mounted
 * tree with a new state object — the shape of the real lifecycle (the latest run
 * resolves into an already-mounted workspace), and the only way the hook-count
 * difference of React error #310 can be observed at all.
 */
async function mountWorkspace(initial: Record<string, any>) {
	currentState = initial;
	capturedErrors.length = 0;
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	const tree = createElement(MemoryRouter, { initialEntries: ['/timetable'] },
		createElement(RecordingBoundary, null, createElement(ScheduleReviewWorkspace)));
	await act(async () => { root.render(tree); });
	// The centre arm is behind `lazy()` + `Suspense`; a synchronous tick would leave
	// its fallback mounted and a positive assertion on the grid would be a lie.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	// A FRESH element object per render. Re-rendering the identical element makes
	// React bail out on `oldProps === newProps` and never re-run the component, so
	// the same element would silently pass a hook-count row without re-running it.
	const renderTree = () => createElement(MemoryRouter, { initialEntries: ['/timetable'] },
		createElement(RecordingBoundary, null, createElement(ScheduleReviewWorkspace)));
	return {
		host,
		async settleWith(state: Record<string, any>) {
			currentState = state;
			await act(async () => { root.render(renderTree()); });
			await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
		},
		gridCells: () => host.querySelectorAll('td[data-day][data-start-time]'),
		el: (testId: string) => host.querySelector(`[data-testid="${testId}"]`),
		all: (selector: string) => [...host.querySelectorAll(selector)] as HTMLElement[],
		text: () => host.textContent ?? '',
	};
}

// ═══ ROW 1 — FAILING-FIRST CONTROL: loading -> resolved on the SAME tree ═══

test('ROW 1 (failing-first) loading -> resolved on the same mounted tree raises no error boundary and renders the real grid', async () => {
	// UNFIXED: this row FAILS with React error #310 — render 1 returned at the
	// loading guard with one hook fewer than render 2 reaches. FIXED: it passes.
	// See the file header and the MUTANT section for both sides, run literally.
	const view = await mountWorkspace(loadingState());
	assert.equal(view.el('workspace-error-boundary'), null, 'precondition: the loading render itself did not fail');

	await view.settleWith(resolvedState());

	assert.equal(capturedErrors.length, 0,
		`no error boundary may fire on the loading -> resolved transition. Observed: ${capturedErrors.map((error) => error.message).join(' | ')}`);
	assert.equal(view.el('workspace-error-boundary'), null, 'the workspace is still mounted, not replaced by an error surface');
	assert.ok(view.gridCells().length > 0,
		'the resolved tree renders the real grid cells — the surface the staging page never reached');
	assert.equal(view.el('timetable-first-paint'), null, 'and the loading skeleton is gone once the run has resolved');
});

test('ROW 1b the same transition is stable across repeated loading/resolved cycles, not just once', async () => {
	// A fix that merely balanced the two renders of ONE cycle could still leave a
	// later loading -> resolved pair imbalanced, so the transition is driven twice
	// through the same mounted tree.
	const view = await mountWorkspace(loadingState());
	for (const cycle of [1, 2]) {
		await view.settleWith(resolvedState());
		assert.equal(capturedErrors.length, 0, `cycle ${cycle}: no error boundary fires`);
		assert.ok(view.gridCells().length > 0, `cycle ${cycle}: the grid is rendered`);
		await view.settleWith(loadingState());
		assert.ok(view.el('timetable-first-paint') !== null, `cycle ${cycle}: back to loading is still the loading surface`);
	}
});

// ═══ ROW 2 — the loading screen did not change ═════════════════════════════

test('ROW 2 loading alone still renders the first-paint skeleton and NOT the grid', async () => {
	// If the fix had moved the early return, or started computing grid state while
	// loading, the loading screen would have changed. This row pins it: the same
	// `timetable-first-paint` shell, the same sentence, and no grid cells.
	const view = await mountWorkspace(loadingState());

	const firstPaint = view.el('timetable-first-paint');
	assert.ok(firstPaint, 'the loading surface is the real first-paint skeleton');
	assert.match(firstPaint!.className ?? '', /h-\[calc\(100svh-3\.5rem\)\]/,
		'and it keeps the bounded no-scroll viewport shell');
	assert.match(firstPaint!.textContent ?? '', /Loading timetable/,
		'and it still says what is loading and what arrives later');
	assert.equal(view.gridCells().length, 0, 'no grid cell is rendered while the run is still loading');
	assert.equal(view.el('timetable-route-loading-state'), null,
		'and `/timetable` itself is the plain skeleton, not a route-specific loading pane');
	assert.equal(capturedErrors.length, 0, 'loading on its own never raises an error boundary');
});

// ═══ ROW 3 — the C11 M3 highlight survived the hoist ══════════════════════

test('ROW 3 with a move armed, the highlighted cells are STILL exactly the legal targets', async () => {
	// Guards against a "fix" that removes the conditional hook by dropping the
	// highlight: the memo is load-bearing for C11 M3, and the two free Monday slots
	// must still be the ones the grid marks.
	const view = await mountWorkspace(resolvedState({
		// The armed source is the CENTRE context's own `kbSelectedSource` — the exact
		// signal the hoisted memo reads.
		centerWorkspaceContext: centerWorkspaceContext({
			kbSelectedSource: { type: 'entry', entry: SELECTED_ENTRY },
			handleKbPlace: async () => {},
		}),
	}));

	const targets = view.all('td[data-move-target="true"]');
	assert.equal(targets.length, 2, 'exactly the two legal free Monday slots are marked, and nothing else is');
	assert.deepEqual(
		targets.map((cell) => `${cell.getAttribute('data-day')} ${cell.getAttribute('data-start-time')}`).sort(),
		['MONDAY 06:45', 'MONDAY 07:30'],
		'the marked cells are the free slots, not the class\'s own slot and not the occupied Tuesday',
	);
	assert.equal(view.host.querySelector('td[data-day="MONDAY"][data-start-time="06:00"]')?.getAttribute('data-move-target'), null,
		'the class\'s own slot is never a target');
	assert.equal(view.host.querySelector('td[data-day="TUESDAY"][data-move-target="true"]'), null,
		'an occupied day has no free target');
	// Colour alone is never the signal: each marked cell carries a readable cue.
	assert.equal(view.host.querySelectorAll('[data-testid="timetable-move-target-cue"]').length, 2,
		'each highlighted cell states the target in words, not only in a ring');
	// The status line the highlight belongs to is on screen and names the same count.
	assert.match(view.text(), /highlighted free time slots/,
		'the armed-move status line is still rendered, so the claim and the cells are one feature');
	assert.equal(capturedErrors.length, 0, 'an armed move is not an error');
});

test('ROW 3b with NO move armed, no cell is highlighted — the arming flag still gates the memo', async () => {
	// The hoisted memo must keep its `moveArmed` dependency meaning. If the hoist had
	// collapsed the flag, every free cell would glow at all times.
	const view = await mountWorkspace(resolvedState());
	assert.ok(view.gridCells().length > 0, 'the grid is rendered');
	assert.equal(view.host.querySelectorAll('td[data-move-target="true"]').length, 0,
		'nothing is highlighted when no move is armed');
	assert.equal(capturedErrors.length, 0, 'an unarmed view is not an error');
});

// ═══ ROW 4 — MUTANT (labelled; the mutant is NOT in this tree) ════════════

/**
 * ROW 4 — MUTANT CONTROL (not a test; a record of one that was run and reverted).
 *
 * MUTATION: `ScheduleReviewWorkspace.tsx` was edited so the `moveTargetSlotKeys`
 * `useMemo` (and the `moveTargetNotice` derivation it reads) sat BELOW the
 * `if (state.loading && !state.draft)` early return again — i.e. the pre-fix shape
 * from commit `d5ea8fca` (`git diff --numstat` against the base was EMPTY, so the
 * mutant really was the old source). `npm run test:ux-a2-c12-310fix` was then run
 * and the suite FAILED. The literal output was:
 *
 *   > atlas-client@0.1.0 test:ux-a2-c12-310fix
 *   > node --experimental-test-module-mocks --import tsx --test src/components/timetable/__tests__/a2-c12-s2-310fix.test.tsx
 *
 *   ℹ tests 5
 *   ℹ pass 3
 *   ℹ fail 2
 *
 *   ✖ failing tests:
 *
 *   ✖ ROW 1 (failing-first) loading -> resolved on the same mounted tree raises no
 *     error boundary and renders the real grid
 *     AssertionError [ERR_ASSERTION]: no error boundary may fire on the loading ->
 *     resolved transition. Observed: Rendered more hooks than during the previous render.
 *
 *       1 !== 0
 *
 *   ✖ ROW 1b the same transition is stable across repeated loading/resolved cycles,
 *     not just once
 *     AssertionError [ERR_ASSERTION]: cycle 1: no error boundary fires
 *
 * (The staging build shows the same invariant minified as
 * `Minified React error #310`; this repository runs the development build, where
 * React prints the full sentence. Row 1's assertion message is deliberately shaped
 * so the invariant lands inside the failure text rather than in a stack trace.)
 *
 * The source file was then restored byte-exact (SHA-256
 * `05A5629C2DAA3AAF4C0495C9B7A060EB367A2464B2DAF634BF5085F502CE50C1` before the
 * mutation and after the restore), so the mutant is NOT in this tree. Rows 2, 3
 * and 3b passed under the mutant (they render a single state each, never the
 * transition), which is why row 1 is the row that decides.
 */
