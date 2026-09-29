/**
 * A2 mc R1 — C1-C4: the GRID move path, rendered for real.
 *
 * WHY THIS FILE IS A REAL MOUNT AND NOT A SOURCE-TEXT ROW. The BLOCKING finding
 * this correction closes was a WIRING defect: `ScheduleReviewWorkspace.tsx` was
 * the only caller of `describeMoveTargets`, it passed no identity, no label
 * resolvers and no `onSelectSwap`, so the derivation returned `[]` and the status
 * line rendered a reason sentence and a Cancel and nothing else. Every other gate
 * in the prior round was green. Per AGENTS.md §11 ("Prove the outcome, not the
 * wiring"), a row that matched source text would have passed again on a workspace
 * that was still broken.
 *
 * So this file MOUNTS THE REAL `ScheduleReviewWorkspace` default export, with
 * only the workspace-state HOOK stubbed at the module boundary — the same recipe
 * `a2-c12-s2-310fix.test.tsx` uses to mount this component for the #310 control,
 * and the reason this repository already runs `node --experimental-test-module-mocks`
 * for that file. Nothing else is stubbed: the grid, the header, the move
 * derivation (`describeMoveTargets` → `describeMoveSwapOffers` →
 * `findRegularSwapCandidate`) and the status line are production code, and the
 * offer buttons are read out of the rendered DOM.
 *
 * The hook stub RECORDS what the production handler dispatches, so the arming
 * claim (3c) is proved by the call it makes rather than by its name.
 *
 *   C1 the real workspace renders real swap-offer BUTTONS for an armed move whose
 *      every period is occupied — the wiring produces offers in production.
 *   C2 at least one `[data-testid="timetable-move-swap-offer"]` with
 *      `data-swap-allowed="true"`, and it is a real `<button>`.
 *   C2b CLICKING it dispatches the grid's own `handleKbPlace` for that exact slot
 *      (the existing swap workflow) and clears the armed move (3d).
 *   C3 with no legal partner: ZERO offer buttons and `timetable-move-swap-blocked`
 *      text, so nothing is offered as a control that cannot be taken.
 *   C4 the Cancel stays reachable in every no-target state, and
 *      `timetable-move-status-message` renders exactly the `message` prop.
 *   C1b the occupant projection degrades safely — no `NaN`, no `"undefined"`.
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	SVGElement: dom.window.SVGElement,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	Text: dom.window.Text,
	Comment: dom.window.Comment,
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

// Platform stubs, not product stubs — the three the #310 harness records.
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (query: string) => ({
	matches: false, media: query, onchange: null,
	addEventListener: () => {}, removeEventListener: () => {},
	addListener: () => {}, removeListener: () => {},
	dispatchEvent: () => false,
});
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

/* ─── The fixture: the class the operator is trying to move, and its neighbours ─── */

const MOVING = {
	entryId: 'e-moving', sectionId: 71, subjectId: 11, facultyId: 21, roomId: 31,
	day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
} as Record<string, unknown>;

/** Same section at 06:45 → a legal swap partner under the same-section rule. */
const SAME_SECTION_PARTNER = {
	entryId: 'e-partner', sectionId: 71, subjectId: 12, facultyId: 22, roomId: 32,
	day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1,
} as Record<string, unknown>;

/** Shares no section, teacher or room → the derivation must REFUSE the swap. */
const UNRELATED = {
	entryId: 'e-unrelated', sectionId: 91, subjectId: 93, facultyId: 94, roomId: 95,
	day: 'MONDAY', startTime: '06:45', endTime: '07:30', durationMinutes: 45, termIndex: 1,
} as Record<string, unknown>;

const TIME_SLOTS = [
	{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	{ day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
];

const subjectLabel = (id: number) => (id === 11 ? 'TLE' : id === 12 ? 'ESP' : `Subject ${id}`);
const facultyLabel = (id: number) => (id === 21 ? 'Mr Cruz' : id === 22 ? 'Mr Diaz' : `Teacher ${id}`);
const sectionLabel = (id: number) => `7-Rizal ${id}`;
const noop = () => {};

const DRAFT = {
	runId: 7, version: 3, entries: [MOVING, SAME_SECTION_PARTNER], unassignedItems: [], violations: [],
	summary: { isPublished: false, unassignedCount: 0, assignedCount: 2, hardViolationCount: 0 },
	createdAt: '2026-09-29T08:00:00.000Z', finishedAt: '2026-09-29T08:00:00.000Z',
};

/** What the production handler actually dispatched, in order. */
let dispatched: Array<{ kind: string; args: unknown[] }> = [];

function summary() {
	return { isPublished: false, unassignedCount: 0, assignedCount: 2, hardViolationCount: 0 };
}

function headerContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		isPreGenerationWorkspace: false, activeGeneratedRunId: 7, leftTab: 'sessions',
		leftPanelRef: { current: null }, presentationMode: 'workflow', setPresentationMode: noop,
		selectedRunId: '7', handleRunChange: noop,
		runs: [{ id: 7, createdAt: '2026-09-29T08:00:00.000Z', durationMs: 4200, status: 'COMPLETED' }],
		schoolId: 1, schoolYearId: 1, centerView: 'schedule', newDraftLoading: false,
		handleStartNewPreGenerationDraft: noop, openPreGenerationWorkspace: noop, returnToGeneratedRun: noop,
		generating: false, loading: false, handleTriggerGenerate: noop, draft: DRAFT,
		hardCount: 0, blockingHardCount: 0, softCount: 0, setPublishAcknowledged: noop,
		setShowPublishDialog: noop, exitPolicyView: noop, enterPolicyView: noop, enterManualEditView: noop,
		setKbSelectedSource: (value: unknown) => { dispatched.push({ kind: 'setKbSelectedSource', args: [value] }); },
		setSelectedEntry: noop, switchCenterViewWithGuard: (action: () => void) => action(),
		openMapWorkspace: noop, handleRefresh: noop, editHistoryCount: 0, editHistoryReadState: 'ready',
		setShowEditHistory: noop, summary: summary(),
		tutorial: { start: noop, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel, subjectLabel, facultyLabel, setUnassignedReasonFilter: noop,
		requestPendingCount: 0, statusColor: () => 'muted',
		formatDuration: (value: number | null) => `${value}ms`, formatTimestamp: (value: string) => value,
		viewMode: 'section', setViewMode: noop, setEntityFilter: noop, focusSection: noop,
		sectionFocusId: null, hasSelectedEntry: true, setSelectedViolation: noop, setSeverityFilter: noop,
		entityFilter: 'all', groupedPivotEntities: [{ label: 'Grade 7', ids: [71] }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [], ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(), CONFLICT_CODES: new Set<string>(),
		DAYS: ['MONDAY', 'TUESDAY'], DAY_SHORT: { MONDAY: 'Mon', TUESDAY: 'Tue' },
		pivotLabel: (id: number) => `Entity ${id}`, programFilter: 'all', setProgramFilter: noop,
		entryKindFilter: 'all', setEntryKindFilter: noop, termFilter: 2,
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }],
		activeTermIndex: 2, onTermFilterChange: noop,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro' },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 0, hasPublishedReturnState: false, severityFilter: 'all',
		...overrides,
	};
}

function centerWorkspaceContext(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		centerView: 'schedule', selectedEntry: MOVING,
		violationIndex: new Map<string, any[]>(), followUps: new Set<string>(),
		toggleFollowUp: async () => {}, exitPolicyView: noop, handleRefresh: noop,
		defaultSchoolId: 1, schoolYearId: 1, pendingAction: null,
		roomMap: new Map<number, any>([[31, { id: 31, name: 'Room 101' }], [32, { id: 32, name: 'Room 102' }]]),
		facultyMap: new Map<number, any>([[21, { id: 21, lastName: 'Cruz', firstName: 'Pedro' }], [22, { id: 22, lastName: 'Diaz', firstName: 'Ana' }]]),
		subjectMap: new Map<number, any>([[11, { id: 11, code: 'TLE' }], [12, { id: 12, code: 'ESP' }]]),
		draftEntries: [MOVING, SAME_SECTION_PARTNER],
		previewEdit: async () => null, commitEdit: async () => true,
		previewLoading: false, commitLoading: false, subjectLabel, facultyLabel, sectionLabel,
		gradeForSection: () => 7, roomLabel: (id: number) => `Room ${id}`, roomLabelShort: (id: number) => `R${id}`,
		entryContextLabel: (entry: any) => `${entry.entryId} context`, formatFacultyInitials: () => 'XX',
		isStaleRoom: () => false, timeSlots: TIME_SLOTS, preGenOnboarding: false, setCenterView: noop,
		buildings: [], mapBuildingId: null, setMapBuildingId: noop, openBuildingWorkspace: async () => {},
		selectedMapBuilding: null, selectedMapBuildingFloors: [], mapRoomId: null, openRoomGridWorkspace: noop,
		presentationMode: 'workflow', draftBoard: null, draft: DRAFT, runs: [{ id: 7 }], newDraftLoading: false,
		entityFilter: 'all', pivotLabel: (id: number) => `Entity ${id}`, viewMode: 'section', termFilter: '2',
		setPreGenOnboarding: noop, gridEntries: [MOVING, SAME_SECTION_PARTNER], highlightedEntryIds: new Set<string>(),
		kbSelectedSource: { type: 'entry', entry: MOVING },
		handleKbPlace: async (day: string, startTime: string, endTime: string) => {
			dispatched.push({ kind: 'handleKbPlace', args: [day, startTime, endTime] });
		},
		handleKbPlaceStart: noop, getCellConflict: null, getLiveCellConflict: () => null,
		navToFaculty: noop, navToSection: noop, navToRoom: noop,
		preGenPending: null, preGenPreviewLoading: false, preGenPreviewError: null, preGenPreview: null,
		commitPreGenPending: async () => {}, preGenSaving: false, setPreGenPending: noop,
		setPreGenPreview: noop, setPreGenPreviewError: noop, setPreGenAllowSoftOverride: noop,
		runsPending: false, runsUnavailableReason: null, selectedUnassigned: null, setSelectedUnassigned: noop,
		dayShort: { MONDAY: 'Mon', TUESDAY: 'Tue' }, generating: false, handleTriggerGenerate: noop,
		previewTeachingLoadRepair: async () => null, commitTeachingLoadRepair: async () => null,
		handleStartNewPreGenerationDraft: async () => {}, tacticalSandboxOpen: false,
		setTacticalSandboxOpen: noop, policyRecord: null,
		...overrides,
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
		DAYS: ['MONDAY', 'TUESDAY'], DAY_SHORT: { MONDAY: 'Mon', TUESDAY: 'Tue' },
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

/** RESOLVED: the latest run arrived, so no loading early return is taken. */
function resolvedState(options: { entries: Record<string, unknown>[]; status: string }): Record<string, any> {
	const entries = options.entries;
	return {
		loading: false,
		error: null,
		draft: { ...DRAFT, entries },
		showTopLoadingStrip: false,
		selectedEntry: MOVING,
		headerContext: headerContext({ draft: { ...DRAFT, entries } }),
		centerWorkspaceContext: centerWorkspaceContext({
			draft: { ...DRAFT, entries },
			draftEntries: entries,
			gridEntries: entries,
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
		isPreGenerationWorkspace: false, leftTab: 'sessions', setLeftTab: noop,
		violations: [], summary: summary(), roomRequestSummary: null,
		subjectLabel, sectionLabel, facultyLabel,
		roomLabelShort: (id: number) => `R${id}`, formatFacultyInitials: () => 'XX',
		publishedChangeScope: null, publishedEntryChange: null, setPublishedEntryChange: noop,
		concurrentCommitNotice: null, dismissConcurrentCommit: noop,
		inlineActionStatus: { tone: 'warning', message: options.status },
		setInlineActionStatus: (status: unknown) => { dispatched.push({ kind: 'setInlineActionStatus', args: [status] }); },
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

let currentState: Record<string, any> = resolvedState({ entries: [MOVING, SAME_SECTION_PARTNER], status: '' });
mock.module(import.meta.resolve('@/hooks/useScheduleReviewWorkspaceState'), {
	namedExports: { useScheduleReviewWorkspaceState: () => currentState },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { default: ScheduleReviewWorkspace } = await import('../ScheduleReviewWorkspace');
const { toMoveOccupants } = await import('@/components/timetable/timetableMoveTargets');

async function mountWorkspace(state: Record<string, any>): Promise<HTMLElement> {
	currentState = state;
	dispatched = [];
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(ScheduleReviewWorkspace)));
	});
	return host;
}

const NO_TARGET_SENTENCE = 'Every period in this view already has a class in it.';

test('C1 the REAL grid workspace renders swap-offer buttons for an armed move with no free period', async () => {
	const host = await mountWorkspace(resolvedState({
		entries: [MOVING, SAME_SECTION_PARTNER],
		status: NO_TARGET_SENTENCE,
	}));
	// The precondition, so C1/C2 cannot pass vacuously: the REAL status line is on
	// screen, and it is the no-target state (which is the only state offers appear in).
	assert.ok(host.querySelector('[data-testid="timetable-inline-status"]'), 'the real move status line renders');
	assert.equal(host.querySelector('[data-testid="timetable-move-status-message"]')?.textContent, NO_TARGET_SENTENCE);

	// THE ROW. At c605df85 this was 0: the caller passed no identity and no
	// resolvers, so `describeMoveSwapOffers` returned [].
	const offers = host.querySelectorAll('[data-testid="timetable-move-swap-offer"]');
	assert.equal(offers.length, 1, 'the production wiring produces a swap offer');

	// C2 — a real control, not a span.
	const offer = offers[0] as HTMLElement;
	assert.equal(offer.tagName, 'BUTTON', 'an offer the operator may take is a real <button>');
	assert.equal(offer.getAttribute('data-swap-allowed'), 'true');
	assert.equal(offer.getAttribute('data-swap-occupant'), 'e-partner', 'and it names the partner it would trade with');
	assert.match(offer.textContent ?? '', /^Swap with ESP \(Mr Diaz\)/, 'the label is the packet shape, from the REAL resolvers');
	assert.match(offer.className ?? '', /h-11/, 'and it is at the 44px target floor');
});

test('C2b CLICKING the offer arms the EXISTING swap workflow and disarms the move (3c/3d)', async () => {
	const host = await mountWorkspace(resolvedState({
		entries: [MOVING, SAME_SECTION_PARTNER],
		status: NO_TARGET_SENTENCE,
	}));
	dispatched = [];
	const offer = host.querySelector('[data-testid="timetable-move-swap-offer"]') as HTMLElement;
	await act(async () => { offer.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });

	// The production handler dispatches the grid's OWN place handler for that slot.
	// Inside the real hook that handler runs `findRegularSwapCandidate` and then
	// `openRegularSwapPrompt`; the boundary stub records the dispatch, which is what
	// proves the offer routes into the existing workflow rather than a new one.
	assert.deepEqual(
		dispatched.filter((call) => call.kind === 'handleKbPlace').map((call) => call.args),
		[['MONDAY', '06:45', '07:30']],
		'the offer dispatches the grid place handler for exactly the offered slot',
	);
	assert.ok(
		dispatched.some((call) => call.kind === 'setKbSelectedSource' && call.args[0] === null),
		'3d — the armed move is cleared when the offer is taken, so no armed move is left without a status line',
	);
});

test('C3 with no legal partner: ZERO offer buttons and the blocked text (nothing is offered that cannot be taken)', async () => {
	const host = await mountWorkspace(resolvedState({
		entries: [MOVING, UNRELATED],
		status: NO_TARGET_SENTENCE,
	}));
	assert.equal(host.querySelectorAll('[data-testid="timetable-move-swap-offer"]').length, 0,
		'no offer button when the partner rule refuses the swap');
	const blocked = host.querySelectorAll('[data-testid="timetable-move-swap-blocked"]');
	assert.equal(blocked.length, 1, 'the occupied period still states its verdict');
	assert.match(blocked[0].textContent ?? '', /^Cannot swap with Subject 93 \(Teacher 94\): /,
		'it LEADS with the reason. A2 mc R2 polish: the row used to read `Swap with … — not allowed: …`, which states an action and then refuses it in the same breath.');
});

test('C4 no regression: the Cancel stays reachable and the message renders exactly the prop', async () => {
	for (const entries of [[MOVING, SAME_SECTION_PARTNER], [MOVING, UNRELATED]]) {
		const host = await mountWorkspace(resolvedState({ entries, status: NO_TARGET_SENTENCE }));
		assert.equal(host.querySelector('[data-testid="timetable-move-status-message"]')?.textContent, NO_TARGET_SENTENCE,
			'the message span is EXACTLY the message prop — offers never speak over it');
		const cancel = host.querySelector('[data-testid="timetable-move-no-target-cancel"]');
		assert.ok(cancel, 'the one Cancel is reachable in the no-target state, whatever the swap verdict');
		dispatched = [];
		await act(async () => { (cancel as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
		assert.ok(dispatched.some((call) => call.kind === 'setKbSelectedSource' && call.args[0] === null),
			'and it still disarms the armed move');
	}
});

test('C1b the occupant projection degrades safely — no NaN, no "undefined"', () => {
	// The projection moved next to the derivation (3a) precisely so this is testable
	// at all: it reads `draft.entries`, which arrives typed `unknown`.
	const projected = toMoveOccupants([
		{ entryId: 'e-1', day: 'MONDAY', startTime: '06:00', endTime: '06:45', sectionId: 71, roomId: 31, facultyId: 21, subjectId: 11, termIndex: 1 },
		// A row the run cannot describe: ids absent, one non-numeric.
		{ entryId: 'e-2', day: 'TUESDAY', startTime: '07:30', endTime: '08:15', sectionId: 'seventy-one', roomId: undefined },
	]);
	assert.equal(projected[0].sectionId, 71, 'a real identity passes through');
	assert.equal(projected[1].sectionId, null, 'a non-numeric id degrades to null, never NaN');
	assert.equal(projected[1].roomId, null, 'an absent id degrades to null');
	assert.equal(projected[1].facultyId, null);
	assert.equal(projected[1].entryId, 'e-2');
	assert.doesNotMatch(JSON.stringify(projected[1]), /undefined|NaN/, 'and no "undefined" or NaN reaches the derivation');
});
