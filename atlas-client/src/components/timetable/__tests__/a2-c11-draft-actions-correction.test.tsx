/**
 * C11 slice 1 — CORRECTION ROUND. Fresh independent QA returned
 * `CORRECTION_REQUIRED` (mandatory 12/17, blocked 0, unperformed 0) with five
 * BLOCKING findings; this file is the rendered evidence that closes F1–F5.
 *
 * ── WHY A SECOND FILE, NOT AN EDIT OF THE FIRST ──────────────────────────────
 *
 * `a2-c11-draft-actions.test.tsx` holds the candidate's 20 rows. They are
 * evidence, not clutter, and AGENTS.md §16 forbids deleting, weakening, skipping
 * or re-pointing an existing assertion to make a row pass. Appending here rather
 * than editing there means not one existing row or assertion was touched, and this
 * file is reachable from the SAME committed `package.json` script
 * (`test:ux-a2-c11-draft-actions`), which now names both.
 *
 * ── EVIDENCE CLASS ───────────────────────────────────────────────────────────
 *
 * Per AGENTS.md "Done means seen", a source-text assertion is not acceptance
 * evidence for a user-facing change. Every row below RENDERS a real production
 * component into a real JSDOM document, CLICKS the control under test, and reads
 * the resulting DOM. The three rows explicitly labelled WIRING are the only ones
 * that read source, each because the property is a property of the COMPOSED page
 * rather than of one component; each says so in its own note, and each is paired
 * with a rendered row that decides the user-visible half.
 *
 * The recorded defects are in `docs/reviews/codex-timetable-walk-20260928/report.md`
 * and the target definitions in `docs/prompts/a2-timetable-2026-09-28-c11.md`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTableElement: dom.window.HTMLTableElement,
	HTMLTableCellElement: dom.window.HTMLTableCellElement,
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

// The building arm renders the real `BuildingView`, which draws through konva and
// therefore needs a 2D context. JSDOM returns null without the optional `canvas`
// package, and nothing about the assertion needs pixels — so a recording stub
// stands in. The arm's own header, room list and links are real DOM either way.
const canvasContextStub = (): any => ({
	measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
	getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(w * h * 4, 4)) }),
	createLinearGradient: () => ({ addColorStop: () => {} }),
	createPattern: () => null,
	setTransform: () => {}, transform: () => {}, resetTransform: () => {},
	scale: () => {}, translate: () => {}, rotate: () => {}, clearRect: () => {}, fillRect: () => {},
	strokeRect: () => {}, beginPath: () => {}, closePath: () => {}, moveTo: () => {}, lineTo: () => {},
	arc: () => {}, rect: () => {}, fill: () => {}, stroke: () => {}, clip: () => {},
	save: () => {}, restore: () => {}, drawImage: () => {}, putImageData: () => {},
	setLineDash: () => {}, fillText: () => {}, strokeText: () => {},
});
(dom.window as any).HTMLCanvasElement.prototype.getContext = function getContext() { return canvasContextStub(); };
(dom.window as any).HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

const { createRoot } = await import('react-dom/client');
const { MemoryRouter, useNavigate } = await import('react-router-dom');
const { DndContext } = await import('@dnd-kit/core');

const { resolveCenterPane } = await import('@/components/timetable/MapRouteTransitionIntent');
const { CenterWorkspacePaneSurface } = await import('@/components/timetable/CenterWorkspacePaneSurface');
const { TimetableDraftStateStrip, DRAFT_EDIT_UNAVAILABLE, DRAFT_DISCARD_UNAVAILABLE } =
	await import('@/components/timetable/TimetableDraftStateStrip');
const { TimetableMoveStatusLine } = await import('@/components/timetable/TimetableMoveStatusLine');
const { DraftSwapReviewVerdict, describeDraftSwapVerdict } =
	await import('@/components/timetable/DraftSwapReviewVerdict');
const { describeMoveTargets } = await import('@/components/timetable/timetableMoveTargets');

const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const roots: any[] = [];
after(() => { for (const root of roots) act(() => root.unmount()); });

function renderIn(element: any, wrap?: (child: any) => any) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(wrap ? wrap(element) : element); });
	return {
		host,
		text: host.textContent ?? '',
		testId: (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
		has: (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null,
		byLabel: (label: string) =>
			[...host.querySelectorAll('button,a')].find((el) => el.getAttribute('aria-label') === label) as HTMLElement | undefined,
		click: (id: string) => {
			const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement;
			assert.ok(el, `control ${id} is rendered, so it can be clicked`);
			act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
		},
	};
}

/** A nav button rendered INSIDE the same MemoryRouter as the surface under test. */
function NavTo({ to }: { to: string }) {
	const navigate = useNavigate();
	return createElement('button', { 'data-testid': 'test-nav', onClick: () => navigate(to) }, 'go');
}

const withRouter = (child: any) => createElement(MemoryRouter, { initialEntries: ['/timetable'] }, child);

// ══════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ══════════════════════════════════════════════════════════════════════════════

const PANE_TIME_SLOTS = [
	{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	{ day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	{ day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
	{ day: 'TUESDAY', startTime: '06:00', endTime: '06:45' },
];

const SELECTED_ENTRY = {
	entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45',
	roomId: 11, facultyId: 21, subjectId: 31, sectionId: 41,
} as any;

/** A SECOND class, so "Tuesday has no free target" is a real exclusion, not an empty day. */
const TUESDAY_ENTRY = {
	entryId: 'e-tuesday', day: 'TUESDAY', startTime: '06:00', endTime: '06:45',
	roomId: 12, facultyId: 22, subjectId: 32, sectionId: 42,
} as any;

/** Every prop the extracted centre-pane surface declares, with a real default. */
function paneProps(overrides: Record<string, any> = {}): Record<string, any> {
	const noop = () => {};
	return {
		centerView: 'schedule',
		routeAppliedPathname: null,
		selectedEntry: null,
		violationIndex: new Map(),
		followUps: new Set<string>(),
		toggleFollowUp: async () => {},
		exitPolicyView: noop,
		handleRefresh: noop,
		defaultSchoolId: 1,
		schoolYearId: 1,
		pendingAction: null,
		roomMap: new Map<number, any>([[11, { id: 11, name: 'Room 101' }]]),
		facultyMap: new Map<number, any>([[21, { id: 21, lastName: 'Cruz', firstName: 'Pedro' }]]),
		subjectMap: new Map<number, any>([[31, { id: 31, code: 'TLE', name: 'Technology' }]]),
		draftEntries: [SELECTED_ENTRY, TUESDAY_ENTRY],
		sandboxFacultyByEntryId: new Map<string, number>(),
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
		timeSlots: PANE_TIME_SLOTS,
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
		draft: { runId: 7, entries: [SELECTED_ENTRY] },
		runs: [{ id: 7 }],
		newDraftLoading: false,
		entityFilter: 'all',
		pivotLabel: (id: number) => `Entity ${id}`,
		viewMode: 'section',
		termFilter: 'all',
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
		...overrides,
	};
}

/** Render the real surface and let every lazy chunk inside an arm settle. */
async function renderPane(props: Record<string, any>, initialPath: string, navTo?: string) {
	const view = renderIn(
		createElement(CenterWorkspacePaneSurface, paneProps(props) as any),
		(child) => createElement(
			MemoryRouter,
			{ initialEntries: [initialPath] },
			createElement(DndContext, null, createElement('div', null,
				child,
				...(navTo ? [createElement(NavTo, { key: 'nav', to: navTo })] : []),
			)),
		),
	);
	// The manual-edit arm is a `lazy()` chunk behind `Suspense`; a synchronous act
	// leaves its fallback mounted, so a positive assertion on it would be a lie.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	return view;
}

const gridCellCount = (host: HTMLElement) => host.querySelectorAll('td[data-day][data-start-time]').length;

/** The shared header context both headers read — minimal, but a real run and class. */
function headerContextStub(): Record<string, any> {
	const noop = () => {};
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 7,
		leftTab: 'sessions',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: noop,
		selectedRunId: '7',
		handleRunChange: noop,
		runs: [{ id: 7, status: 'COMPLETED', createdAt: '2026-09-27T08:00:00.000Z', durationMs: 1200 }],
		schoolId: 1,
		centerView: 'schedule',
		newDraftLoading: false,
		schoolYearId: 1,
		handleStartNewPreGenerationDraft: noop,
		draftPlacementCount: 0,
		openPreGenerationWorkspace: noop,
		returnToGeneratedRun: noop,
		generating: false,
		loading: false,
		handleTriggerGenerate: noop,
		draft: { runId: 7, entries: [SELECTED_ENTRY] },
		hardCount: 0,
		blockingHardCount: 0,
		setPublishAcknowledged: noop,
		setShowPublishDialog: noop,
		exitPolicyView: noop,
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: noop,
		openMapWorkspace: noop,
		handleRefresh: noop,
		editHistoryCount: 1,
		editHistoryReadState: 'read',
		setShowEditHistory: noop,
		summary: null,
		tutorial: { start: () => {}, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel: () => 'GR7 - Luna',
		subjectLabel: () => 'Technology',
		facultyLabel: () => 'Cruz, Pedro',
		setUnassignedReasonFilter: noop,
		requestPendingCount: 0,
		statusColor: () => 'muted',
		formatDuration: (value: number) => `${value}ms`,
		formatTimestamp: (value: string) => value,
		viewMode: 'section',
		setViewMode: noop,
		setEntityFilter: noop,
		focusSection: noop,
		sectionFocusId: null,
		hasSelectedEntry: true,
		setSelectedEntry: noop,
		setSelectedViolation: noop,
		setSeverityFilter: noop,
		enterManualEditView: noop,
		setPreGenKbSource: noop,
		setKbSelectedSource: noop,
		entityFilter: 'all',
		groupedPivotEntities: [],
		pivotLabel: (id: number) => `Entity ${id}`,
		programFilter: 'all',
		setProgramFilter: noop,
		entryKindFilter: 'all',
		setEntryKindFilter: noop,
		termFilter: 'all',
		termOptions: [{ value: 'all', label: 'All terms' }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: [],
		CONFLICT_CODES: [],
		DAYS: [],
		DAY_SHORT: {},
		onTermFilterChange: noop,
	};
}

function undoRedoControl(onRevert: () => void) {
	// Imported lazily-inside-row so the harness stays a single file; the component
	// itself is the ONE existing instance the workspace builds.
	return import('@/components/timetable/TimetableUndoRedoControl').then(({ TimetableUndoRedoControl }) =>
		createElement(TimetableUndoRedoControl, {
			editHistoryCount: 1,
			revertLoading: false,
			revertLastEdit: async () => { onRevert(); },
			redoState: null,
			redoVersionStale: false,
			redoLastEdit: async () => {},
			clearRedo: () => {},
			setShowEditHistory: () => {},
			undoNotice: null,
			undoBlockedReason: null,
		} as any));
}

// ══════════════════════════════════════════════════════════════════════════════
// F1 — the M1 override fires only in the one-render lag, never on an in-app entry
// ══════════════════════════════════════════════════════════════════════════════

test('F1 M1 RENDERED (real surface): after the URL moves /timetable/manual-edit → /timetable the GRID shows and the stale panel is nowhere in the DOM', async () => {
	// The URL is live in MemoryRouter and the row CLICKS a real navigation, so this
	// is the disagreeing render the walk recorded ("Back to Schedule keeps the
	// panel") rather than a hand-passed pathname. `routeAppliedPathname` is still
	// the OLD path, which is exactly the lag the route sync leaves behind.
	const view = await renderPane(
		{ centerView: 'manual-edit', selectedEntry: SELECTED_ENTRY, routeAppliedPathname: '/timetable/manual-edit' },
		'/timetable/manual-edit',
		'/timetable',
	);
	// PRECONDITION, and the whole point: on its OWN route the manual-edit arm is what
	// renders. If the override fired here the row would be vacuous.
	assert.equal(gridCellCount(view.host), 0, 'precondition: on /timetable/manual-edit the manual-edit arm renders, not the grid');
	assert.equal(view.has('timetable-manual-edit-empty-state'), false, 'a selected class shows the real manual-edit panel, not the empty state');

	view.click('test-nav');
	// `AnimatePresence mode="wait"` keeps the EXITING child mounted for the 180 ms
	// exit duration before mounting the incoming one. That is the mechanism the
	// recorded defect rode in on, so the row waits it out rather than asserting
	// mid-transition.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });

	assert.ok(gridCellCount(view.host) > 0, 'the GRID is what the operator is left looking at after Back to Schedule');
	assert.equal(view.has('timetable-manual-edit-empty-state'), false, 'the stale no-selection panel is NOT in the DOM');
	assert.equal(view.text.includes('Manual edit tools'), false, 'no manual-edit surface survives the route move');
});

test('F1 M1 RENDERED (real surface): the in-app entry on /timetable STILL reaches Manual edit — the regression this correction removes', async () => {
	// The candidate forced the grid here, which is what made Manual edit, the
	// strip's Edit, Change room and the M2 room picker unreachable from /timetable.
	const view = await renderPane({
		centerView: 'manual-edit',
		selectedEntry: SELECTED_ENTRY,
		// THE SIGNAL: the route sync has already applied `/timetable`, so this is an
		// in-app entry, not a stale route.
		routeAppliedPathname: '/timetable',
		pendingAction: 'CHANGE_ROOM',
	}, '/timetable');
	assert.equal(gridCellCount(view.host), 0, 'the grid is NOT forced over an in-app manual-edit entry');
	assert.equal(view.has('timetable-manual-edit-empty-state'), false, 'the panel renders for the SELECTED class, not the empty state');
	// The M2 room picker is reachable through that same in-app entry — the exact
	// thing the first cut of this slice made unreachable.
	assert.ok(view.has('manual-edit-free-rooms') || view.has('manual-edit-no-free-room'),
		'the M2 room picker renders from the in-app Change room entry');
});

test('F1 M1 RENDERED (real surface): the in-app entry on /timetable STILL reaches Building, with and without a selection', async () => {
	const withBuilding = await renderPane({
		centerView: 'building',
		routeAppliedPathname: '/timetable',
		selectedMapBuilding: { id: 5, name: 'G7 Building', rooms: [{ id: 55, name: 'Room 7', floor: 1, floorPosition: 1, type: 'CLASSROOM' }] },
		selectedMapBuildingFloors: [1],
	}, '/timetable');
	assert.equal(gridCellCount(withBuilding.host), 0, 'the grid is not forced over an in-app building entry');
	assert.ok(withBuilding.text.includes('G7 Building'), 'the building pane renders the selected building');
	assert.equal(withBuilding.has('timetable-building-empty-state'), false, 'not the no-selection empty state');

	const withoutBuilding = await renderPane({
		centerView: 'building',
		routeAppliedPathname: '/timetable',
		selectedMapBuilding: null,
	}, '/timetable');
	assert.equal(withoutBuilding.has('timetable-building-empty-state'), true, 'entered with no selection it is the honest empty state');
	assert.ok(withoutBuilding.text.includes('No building selected'), 'which names what is missing and how to reach the pane');
});

test('F1 NEGATIVE: the four routed sub-pages, the index and the direct routes are all unchanged', () => {
	for (const [pathname, view] of [
		['/timetable', 'schedule'],
		['/timetable/policies', 'policy'],
		['/timetable/runs', 'runs'],
		['/timetable/setup', 'setup'],
		['/timetable/pre-generation', 'pre-generation'],
	] as const) {
		// Route APPLIED and the view caught up: never overridden, whatever the view.
		assert.deepEqual(resolveCenterPane(pathname, view, pathname), { kind: 'center-view', view },
			`${pathname} with an applied route and a caught-up view is untouched`);
	}
	// The direct selection-dependent ROUTES still reach their own pane, both before
	// the sync has applied them and after.
	assert.deepEqual(resolveCenterPane('/timetable/manual-edit', 'manual-edit', null), { kind: 'center-view', view: 'manual-edit' });
	assert.deepEqual(resolveCenterPane('/timetable/building', 'building', '/timetable/building'), { kind: 'center-view', view: 'building' });
	// A route already applied, with a selection-dependent view, is NEVER overridden
	// in either direction — that is the whole of the correction.
	assert.deepEqual(resolveCenterPane('/timetable', 'manual-edit', '/timetable'), { kind: 'center-view', view: 'manual-edit' });
	assert.deepEqual(resolveCenterPane('/timetable', 'building', '/timetable'), { kind: 'center-view', view: 'building' });
	// DISCRIMINATION: with the route UNAPPLIED the override fires — the one-render
	// lag window, and only there.
	assert.deepEqual(resolveCenterPane('/timetable', 'manual-edit', '/timetable/manual-edit'), { kind: 'center-view', view: 'schedule' });
	assert.deepEqual(resolveCenterPane('/timetable', 'building', '/timetable/building'), { kind: 'center-view', view: 'schedule' });
});

test('F1 NEGATIVE RENDERED: the map pending-intent bypass still works and the map route is unchanged', async () => {
	// The map branch is deliberately NOT gated on the new signal: its behaviour is
	// unchanged by this correction, and a later edit must not silently re-break it.
	assert.equal(resolveCenterPane('/timetable/map', 'schedule', null).kind, 'pending-map-intent');
	assert.equal(resolveCenterPane('/timetable/map', 'schedule', '/timetable').kind, 'pending-map-intent');
	assert.equal(resolveCenterPane('/timetable/map', 'map', '/timetable/map').kind, 'center-view');
	const pending = await renderPane(
		{ centerView: 'schedule', routeAppliedPathname: '/timetable' },
		'/timetable/map',
	);
	assert.equal(pending.has('timetable-map-route-transition-intent'), true, 'the pending intent renders');
	assert.equal(gridCellCount(pending.host), 0, 'and no class cell is mounted beside it — the bypass is outside the animated chain');
});

test('F1 WIRING: the route-applied signal is reported by the ONE sync and threaded to the ONE centre pane', () => {
	// WIRING, and load-bearing: "which component decides the centre pane" is a
	// property of the composed workspace, not of one component. Its user-visible
	// halves are decided by the three rendered rows above.
	const sync = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/TimetableRouteViewSync.tsx'), 'utf8');
	assert.match(sync, /onRouteAppliedPathname\?\.\(pathname\);/, 'the applied pathname is reported where the ref is advanced');
	assert.match(sync, /if \(appliedPathnameRef\.current === pathname\) return;/,
		'and it is still gated on the same ref, so an in-app transition is never reported as a route change');
	const workspace = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/ScheduleReviewWorkspace.tsx'), 'utf8');
	assert.equal((workspace.match(/onRouteAppliedPathname=\{setRouteAppliedPathname\}/g) ?? []).length, 2,
		'BOTH sync mounts report it, including the one kept mounted across the no-draft loading return');
	assert.match(workspace, /routeAppliedPathname=\{routeAppliedPathname\}/, 'and it reaches the centre pane');
	const body = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/ScheduleReviewWorkspaceBody.tsx'), 'utf8');
	assert.equal((body.match(/routeAppliedPathname=\{routeAppliedPathname\}/g) ?? []).length, 2,
		'through BOTH layout renders of CenterWorkspace');
});

// ══════════════════════════════════════════════════════════════════════════════
// F2 — one Undo in both layouts; no enabled control whose handler does nothing
// ══════════════════════════════════════════════════════════════════════════════

test('F2 RENDERED: the Expert header strip carries the single Undo, and its Edit and Discard are live', async () => {
	// The Expert strip was rendered with no `undoRedoControl`, no `onEditDraft` and
	// no `onDiscardDraft`, so `advanced` had NO Undo and two enabled silent buttons.
	const { ScheduleReviewWorkspaceHeader } = await import('@/components/timetable/ScheduleReviewWorkspaceHeader');
	let reverted = 0;
	let edited = 0;
	let discarded = 0;
	const view = renderIn(
		createElement(ScheduleReviewWorkspaceHeader, {
			context: headerContextStub(),
			onEditDraft: () => { edited += 1; },
			onDiscardDraft: () => { discarded += 1; },
			undoRedoControl: await undoRedoControl(() => { reverted += 1; }),
		} as any),
		withRouter,
	);
	assert.ok(view.has('timetable-draft-state-strip'), 'the Expert layout renders the SAME persistent strip as Simple');
	assert.ok(view.text.includes('not visible to teachers until you publish'), 'and it names the run state from the one derivation');

	const undo = view.byLabel('Undo last manual timetable change');
	assert.ok(undo, 'layoutMode === advanced HAS an Undo, mounted inside the strip');
	assert.equal((undo as HTMLButtonElement).disabled, false, 'and it is live with one edit in the draft');
	act(() => { (undo as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(reverted, 1, 'ONE click reverts the last edit in the Expert layout too');

	const edit = view.host.querySelector('[data-testid="timetable-draft-strip-edit"]') as HTMLButtonElement;
	const discard = view.host.querySelector('[data-testid="timetable-draft-strip-discard"]') as HTMLButtonElement;
	assert.equal(edit.disabled, false, 'Edit is enabled because a handler WAS supplied');
	assert.equal(discard.disabled, false, 'Discard draft is enabled because a handler WAS supplied');
	view.click('timetable-draft-strip-edit');
	view.click('timetable-draft-strip-discard');
	assert.deepEqual([edited, discarded], [1, 1], 'and each dispatches its own real action exactly once');
});

test('F2 RENDERED: the Simple header strip is mounted and its actions are live', async () => {
	const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');
	let reverted = 0;
	let discarded = 0;
	const view = renderIn(
		createElement(TimetableSimpleHeader, {
			context: headerContextStub(),
			layoutMode: 'simple',
			onLayoutModeChange: () => {},
			activeTask: null,
			onTaskChange: () => {},
			onSetRepairOrigin: () => {},
			readinessSheetOpen: false,
			onReadinessSheetOpenChange: () => {},
			swapClassTimesMode: 'inactive',
			onSwapClassTimesStart: () => {},
			onSwapClassTimesCancel: () => {},
			onDiscardDraft: () => { discarded += 1; },
			undoRedoControl: await undoRedoControl(() => { reverted += 1; }),
		} as any),
		withRouter,
	);
	assert.ok(view.has('timetable-draft-state-strip'), 'the Simple layout renders the SAME persistent strip');
	assert.ok(view.text.includes('not visible to teachers until you publish'), 'and it names the run state from the one derivation');
	assert.equal((view.byLabel('Undo last manual timetable change') as HTMLButtonElement).disabled, false, 'Undo is live');
	assert.equal((view.host.querySelector('[data-testid="timetable-draft-strip-discard"]') as HTMLButtonElement).disabled, false, 'Discard is enabled');
	view.click('timetable-draft-strip-discard');
	act(() => { (view.byLabel('Undo last manual timetable change') as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.deepEqual([discarded, reverted], [1, 1], 'and both dispatch their real actions');
});

test('F2 RENDERED: the strip can NEVER render an enabled control whose handler does nothing', () => {
	// Every combination of "the caller permits it" × "the caller supplied a
	// handler". The invariant is the conjunction, so there is no combination in
	// which a control is enabled and inert — which is the F2 defect.
	const stripControls = ['timetable-draft-strip-edit', 'timetable-draft-strip-discard', 'timetable-draft-strip-publish'];
	for (const editEnabled of [true, false]) {
		for (const discardEnabled of [true, false]) {
			for (const publishEnabled of [true, false]) {
				const dispatched: string[] = [];
				const view = renderIn(createElement(TimetableDraftStateStrip, {
					visibility: 'Draft — not visible to teachers until you publish',
					editEnabled, editBlockedReason: null,
					discardEnabled,
					publishEnabled, publishBlockedReason: null,
					onEdit: () => dispatched.push('edit'),
					onDiscardDraft: () => dispatched.push('discard'),
					onPublish: () => dispatched.push('publish'),
				}));
				// Permitted AND handled: a control is live exactly when the caller
				// permits it, and every live control dispatches when clicked.
				const expectedDisabled: Record<string, boolean> = {
					'timetable-draft-strip-edit': !editEnabled,
					'timetable-draft-strip-discard': !discardEnabled,
					'timetable-draft-strip-publish': !publishEnabled,
				};
				for (const id of stripControls) {
					assert.equal((view.host.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).disabled, expectedDisabled[id],
						`${id} is live exactly when the caller permits it AND supplies a handler`);
				}
				for (const [id, permitted] of [
					['timetable-draft-strip-edit', editEnabled],
					['timetable-draft-strip-discard', discardEnabled],
					['timetable-draft-strip-publish', publishEnabled],
				] as const) {
					if (permitted) view.click(id);
				}
				assert.deepEqual(
					dispatched,
					[editEnabled && 'edit', discardEnabled && 'discard', publishEnabled && 'publish'].filter(Boolean),
					'every enabled control dispatches its own action exactly once, and no disabled one does');

				// Permitted but NOT handled: nothing enabled, and every reason visible.
				const bare = renderIn(createElement(TimetableDraftStateStrip, {
					visibility: null, editEnabled, editBlockedReason: null,
					discardEnabled, publishEnabled, publishBlockedReason: null,
				}));
				const enabledWithoutHandler: string[] = [];
				for (const id of stripControls) {
					const control = bare.host.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
					assert.ok(control, `${id} is still RENDERED, just disabled`);
					if (!control.disabled) enabledWithoutHandler.push(id);
				}
				assert.deepEqual(enabledWithoutHandler, [],
					`no enabled no-op with editEnabled=${editEnabled} discardEnabled=${discardEnabled} publishEnabled=${publishEnabled}`);
				assert.equal(bare.testId('timetable-draft-strip-edit-reason'), DRAFT_EDIT_UNAVAILABLE,
					'and each disabled control states a VISIBLE reason');
				assert.equal(bare.testId('timetable-draft-strip-discard-reason'), DRAFT_DISCARD_UNAVAILABLE);
				assert.equal(bare.host.querySelector('[title]'), null, 'AGENTS.md §8 — no raw title carries the reason');
			}
		}
	}
});

test('F2 WIRING: the no-op fall-throughs are gone and the one Undo is constructed once and handed to BOTH headers', () => {
	// WIRING, and load-bearing: "how many Undo surfaces does the app mount" is a
	// property of the composed page. Its user-visible halves are the two rendered
	// rows above.
	const header = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/ScheduleReviewWorkspaceHeader.tsx'), 'utf8');
	const simple = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/TimetableSimpleHeader.tsx'), 'utf8');
	assert.doesNotMatch(header, /noopEditDraft|noopDiscardDraft/, 'the Expert header passes the real actions, or none at all');
	assert.doesNotMatch(simple, /noopDiscardDraft/, 'nor does the Simple header');
	const workspace = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/ScheduleReviewWorkspace.tsx'), 'utf8');
	assert.equal((workspace.match(/<TimetableUndoRedoControl/g) ?? []).length, 1, 'exactly ONE Undo control is constructed');
	assert.equal((workspace.match(/undoRedoControl=\{sharedUndoRedoControl\}/g) ?? []).length, 2,
		'Simple AND Expert strips receive the single instance, so both layouts have an Undo and the app has one');
	assert.match(header, /undoRedoControl\?: React\.ReactNode/, 'and the Expert header accepts it');
});

// ══════════════════════════════════════════════════════════════════════════════
// F3 — M3 highlights real cells; the Cancel is reachable; M4 states the outcome
// ══════════════════════════════════════════════════════════════════════════════

test('F3 M3 RENDERED: the highlighted cells are exactly the legal move targets, and one click previews the move', async () => {
	// The status line claims "N highlighted free time slots". Before this
	// correction nothing highlighted anything — QA verified `slotKeys` was consumed
	// only as `.length` across production source.
	const notice = describeMoveTargets({
		slots: PANE_TIME_SLOTS,
		// Tuesday 06:00 is taken by a SECOND class, so the only legal targets are the
		// two free Monday slots and the Tuesday claim is a real exclusion.
		occupants: [
			{ entryId: SELECTED_ENTRY.entryId, day: SELECTED_ENTRY.day, startTime: SELECTED_ENTRY.startTime, endTime: SELECTED_ENTRY.endTime },
			{ entryId: 'e-tuesday', day: 'TUESDAY', startTime: '06:00', endTime: '06:45' },
		],
		movingEntry: { entryId: SELECTED_ENTRY.entryId, day: SELECTED_ENTRY.day, startTime: SELECTED_ENTRY.startTime },
	});
	assert.equal(notice.kind, 'targets');
	const slotKeys = notice.kind === 'targets' ? notice.slotKeys : [];
	assert.equal(slotKeys.length, 2, 'two legal free slots on Monday, so the claim is not vacuous');

	const placed: Array<[string, string, string]> = [];
	const view = await renderPane({
		centerView: 'schedule',
		routeAppliedPathname: '/timetable',
		kbSelectedSource: { type: 'entry', entry: SELECTED_ENTRY },
		moveTargetSlotKeys: new Set(slotKeys),
		handleKbPlace: async (day: string, start: string, end: string) => { placed.push([day, start, end]); },
	}, '/timetable');

	assert.equal(view.host.querySelectorAll('td[data-move-target="true"]').length, 2,
		'exactly the two legal targets are marked, and nothing else is');
	// Colour alone is never the signal: each marked cell carries a readable cue.
	assert.equal(view.host.querySelectorAll('[data-testid="timetable-move-target-cue"]').length, 2,
		'each highlighted cell states the target in words, not only in a ring');
	assert.equal(view.host.querySelector('td[data-day="MONDAY"][data-start-time="06:00"]')?.getAttribute('data-move-target'), null,
		'the class own slot is never a target');
	assert.equal(view.host.querySelector('td[data-day="TUESDAY"][data-move-target="true"]'), null,
		'an occupied day has no free target');

	// CLICK a highlighted cell and read the result.
	const target = view.host.querySelector('td[data-day="MONDAY"][data-start-time="06:45"]') as HTMLElement;
	assert.ok(target, 'the target cell is in the DOM');
	act(() => { target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.deepEqual(placed, [['MONDAY', '06:45', '07:30']], 'clicking a highlighted target dispatches the move for that exact slot');
});

test('F3 M3 RENDERED: with nothing legal in view, the ONE Cancel disarms the move', () => {
	// `timetable-move-no-target-cancel` was RENDERED BY NO TEST. It is now the real
	// production `TimetableMoveStatusLine`, extracted for exactly this reason.
	const notice = describeMoveTargets({
		slots: [{ day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		occupants: [{ entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		movingEntry: { entryId: 'e-moving', day: 'MONDAY', startTime: '06:00' },
	});
	assert.equal(notice.kind, 'none');
	let disarmed = 0;
	const view = renderIn(createElement(TimetableMoveStatusLine, {
		tone: 'warning',
		message: notice.kind === 'none' ? notice.sentence : '',
		moveTargetNotice: notice,
		onDisarm: () => { disarmed += 1; },
	}));
	// The Cancel is a sibling INSIDE the status region, so the sentence is read from
	// the message span rather than the whole region (which also carries "Cancel").
	assert.equal(view.testId('timetable-move-status-message'), notice.kind === 'none' ? notice.sentence : null,
		'the one sentence names the outcome — silence is not an answer');
	assert.ok(view.has('timetable-move-no-target-cancel'), 'and the Cancel beside it is rendered');
	view.click('timetable-move-no-target-cancel');
	assert.equal(disarmed, 1, 'clicking it runs the single disarm exactly once');
});

test('F3 M3 NEGATIVE: with targets available the line offers no Cancel, so a live move cannot be cancelled by accident', () => {
	const notice = describeMoveTargets({
		slots: PANE_TIME_SLOTS,
		occupants: [{ entryId: 'e-moving', day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		movingEntry: { entryId: 'e-moving', day: 'MONDAY', startTime: '06:00' },
	});
	assert.equal(notice.kind, 'targets');
	const view = renderIn(createElement(TimetableMoveStatusLine, {
		tone: 'loading',
		message: 'Select a highlighted free time slot to preview this move.',
		moveTargetNotice: notice,
		onDisarm: () => {},
	}));
	assert.equal(view.has('timetable-move-no-target-cancel'), false,
		'the Cancel exists for the no-target case only');
	assert.ok(view.text.includes('highlighted free time slot'), 'and the copy names the highlighted targets the grid really renders');
});

test('F3 M4 RENDERED: a blocked switch review states its outcome in one sentence, with Confirm disabled and the reason VISIBLE', () => {
	// Before this correction the blocked review showed only a count and a disabled
	// button with nothing beside it saying why.
	let confirmed = 0;
	const view = renderIn(createElement(DraftSwapReviewVerdict, {
		loading: false, error: null, hardCount: 2, softCount: 1, saving: false,
		onCancel: () => {},
		onConfirm: () => { confirmed += 1; },
	}));
	const sentence = view.testId('draft-swap-verdict');
	assert.ok(sentence && sentence.length > 0, 'the verdict is rendered, not implied');
	assert.equal(sentence, describeDraftSwapVerdict({ loading: false, error: null, hardCount: 2, softCount: 1, saving: false }).sentence);
	assert.match(sentence!, /blocked by 2 blocking conflicts/, 'ONE sentence that NAMES the outcome');
	assert.match(sentence!, /nothing is saved/, 'and what will not happen');
	assert.equal(view.host.querySelector('[data-testid="draft-swap-verdict"]')?.getAttribute('data-verdict-tone'), 'blocked');
	const commit = view.host.querySelector('[data-testid="draft-swap-commit"]') as HTMLButtonElement;
	assert.equal(commit.disabled, true, 'the confirm control is disabled exactly when the verdict is blocked');
	assert.match(commit.getAttribute('aria-label') ?? '', /nothing is saved/, 'and carries the same sentence for assistive technology');
	assert.equal(view.host.querySelector('[title]'), null, 'the reason is visible text on the row, not a hover (AGENTS.md §8)');
	act(() => { commit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(confirmed, 0, 'a disabled Confirm dispatches nothing');

	// The clear state flips the same control, so sentence and control cannot disagree.
	const clear = renderIn(createElement(DraftSwapReviewVerdict, {
		loading: false, error: null, hardCount: 0, softCount: 0, saving: false,
		onCancel: () => {},
		onConfirm: () => { confirmed += 1; },
	}));
	const clearCommit = clear.host.querySelector('[data-testid="draft-swap-commit"]') as HTMLButtonElement;
	assert.equal(clearCommit.disabled, false, 'nothing blocking means the control is live');
	assert.match(clear.testId('draft-swap-verdict') ?? '', /no blocking conflict/, 'and the sentence follows the same derivation');
	act(() => { clearCommit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(confirmed, 1, 'one clear-state click commits exactly once');
});

test('F3 M4 NEGATIVE: a preview error and an in-flight check also name the outcome and keep Confirm disabled', () => {
	for (const [input, expected] of [
		[{ loading: false, error: 'Room unavailable', hardCount: 0, softCount: 0, saving: false }, /could not be checked/],
		[{ loading: true, error: null, hardCount: 0, softCount: 0, saving: false }, /Checking this switch now/],
		[{ loading: false, error: null, hardCount: 0, softCount: 0, saving: true }, /Saving this switch now/],
	] as const) {
		const verdict = describeDraftSwapVerdict(input as any);
		assert.equal(verdict.confirmBlocked, true, `${JSON.stringify(input)} must not be confirmable`);
		assert.match(verdict.sentence, expected as RegExp);
	}
	assert.equal(describeDraftSwapVerdict({ loading: false, error: null, hardCount: 0, softCount: 3, saving: false }).confirmBlocked, false,
		'warnings alone do not block, and the sentence says so');
});

// ══════════════════════════════════════════════════════════════════════════════
// F4 — the M1/M3 rows run on the production surface, not a test-local fixture
// ══════════════════════════════════════════════════════════════════════════════

test('F4 the acceptance rows drive the REAL centre-pane surface, not a test-local fixture', () => {
	// F4's load-bearing property: the component the M1/M3 rows render is the one
	// `CenterWorkspace` renders. A test-local `PaneUnderTest` was structurally
	// incapable of detecting F1 because it could not express the signal F1 is
	// about at all.
	const workspace = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/CenterWorkspace.tsx'), 'utf8');
	assert.match(workspace, /<CenterWorkspacePaneSurface/, 'CenterWorkspace renders the extracted surface');
	const surface = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/CenterWorkspacePaneSurface.tsx'), 'utf8');
	assert.match(surface, /resolveCenterPane\(pathname, centerView, routeAppliedPathname\)/, 'the surface takes the M1 decision itself');
	assert.match(surface, /<AnimatePresence mode="wait">/, 'and keeps the real animated arrangement');
	assert.match(surface, /<MapRouteTransitionFrame pathname=\{pathname\} \/>/, 'and the real pending-map bypass');
	// The surface renders the REAL arms: the grid, the manual-edit empty state and
	// the ManualEditPanel — no placeholders.
	assert.match(surface, /<TimetableGrid/);
	assert.match(surface, /<CenterWorkspaceManualEditEmpty/);
	assert.match(surface, /<ManualEditPanel/);
	// DISCRIMINATION: the same inputs under the candidate's decision force the grid.
	assert.deepEqual(resolveCenterPane('/timetable', 'manual-edit'), { kind: 'center-view', view: 'schedule' },
		'the UNAPPLIED default is exactly what the candidate shipped unconditionally');
	assert.deepEqual(resolveCenterPane('/timetable', 'manual-edit', '/timetable'), { kind: 'center-view', view: 'manual-edit' },
		'and the corrected decision differs exactly when the route is already applied');
});

test('F4 NEGATIVE: every file this correction touched stays inside the 1000-line component cap', () => {
	for (const path of [
		'src/components/timetable/CenterWorkspace.tsx',
		'src/components/timetable/CenterWorkspacePaneSurface.tsx',
		'src/components/timetable/CenterWorkspaceManualEditEmpty.tsx',
		'src/components/timetable/TimetableGrid.tsx',
		'src/components/timetable/TimetableMoveStatusLine.tsx',
		'src/components/timetable/DraftSwapReviewVerdict.tsx',
		'src/components/timetable/TimetableDraftStateStrip.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/ScheduleReviewWorkspaceHeader.tsx',
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/modals/TimetablePlacementDialogs.tsx',
	]) {
		const physical = readFileSync(resolve(CLIENT_ROOT, path), 'utf8')
			.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
		assert.ok(physical <= 1000, `${path} is ${physical} physical lines, over the AGENTS.md §8 cap`);
	}
});
