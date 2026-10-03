/**
 * A7 c14 (operator, 2026-09-30 08:15) — the RELAXED Class Schedule header: ONE
 * control row above the grid, plus ONE plain status line under it.
 *
 * ── WHO THIS IS FOR, AND WHAT MUST FEEL DIFFERENT ────────────────────────────
 * An older, mouse-first scheduler opens `/timetable` at 1366×768. Above the grid
 * there must be ONE calm control row — the page heading, `Term`, `Show`,
 * `Schedule for`, the ONE primary and `More` — and ONE status line, and nothing
 * else competing with them. The tabs, the warnings control, `See what changed`,
 * `Update schedule`, `Edit draft` and `Discard draft` all leave the row: the tabs
 * and the draft/apply actions into `More`, the warnings control and the change
 * notice into the status line.
 *
 * ── WHAT THIS FILE DECIDES, AND WHAT IT DOES NOT ────────────────────────────
 * Every row RENDERS the real `TimetableSimpleHeader` into a real JSDOM document
 * and reads real output. JSDOM has no layout engine, so this is DOM-SHAPE, not a
 * 1366×768 pixel row; the pixel count is a BROWSER row (AGENTS.md §11/§12) owned
 * by Lane C. The FAILING-FIRST rows assert the shape the operator asked for and
 * are RED on the base commit, where the header still renders `timetable-sub-nav`
 * in the row and has no `timetable-simple-status-line`.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
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
for (const method of ['scrollIntoView', 'hasPointerCapture', 'releasePointerCapture', 'setPointerCapture'] as const) {
	(dom.window.HTMLElement.prototype as unknown as Record<string, unknown>)[method] = method === 'hasPointerCapture' ? () => false : () => {};
}

const fetchStub = () => Promise.resolve({
	ok: true,
	status: 200,
	json: () => Promise.resolve({ drift: { status: 'aligned', message: null, recommendedAction: null, conflicts: [], unacknowledgedReconfiguredSections: 0 } }),
});
beforeEach(() => { globalThis.fetch = fetchStub as unknown as typeof fetch; });

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');

const roots: Array<{ unmount: () => void }> = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const mounted of roots.splice(0)) act(() => mounted.unmount());
	for (const host of hosts.splice(0)) host.remove();
});

function baseContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	const noop = () => {};
	return {
		isPreGenerationWorkspace: false,
		leftTab: 'sessions',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: noop,
		handleRunChange: noop,
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
		setPublishAcknowledged: noop,
		setShowPublishDialog: noop,
		exitPolicyView: noop,
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: noop,
		openMapWorkspace: noop,
		handleRefresh: noop,
		editHistoryReadState: 'ready',
		setShowEditHistory: noop,
		tutorial: { start: noop, step: 0, totalSteps: 0, seen: true, open: false },
		sectionLabel: (id: number) => `GR7 - ${id}`,
		subjectLabel: () => 'TLE',
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
		setSelectedEntry: noop,
		setSelectedViolation: noop,
		setSeverityFilter: noop,
		enterManualEditView: noop,
		setPreGenKbSource: noop,
		setKbSelectedSource: noop,
		entityFilter: 'all',
		groupedPivotEntities: [{ label: 'Grade 7', ids: [41] }],
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		DAYS: ['MONDAY'],
		DAY_SHORT: { MONDAY: 'Mon' },
		pivotLabel: (id: number) => `Entity ${id}`,
		programFilter: 'all',
		setProgramFilter: noop,
		entryKindFilter: 'all',
		termFilter: 2,
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }, { value: '3', label: 'TERM 3' }],
		activeTermIndex: 2,
		onTermFilterChange: noop,
		draftPlacementCount: 0,
		hasPublishedReturnState: false,
		severityFilter: 'all',
		draft: null,
		activeGeneratedRunId: null,
		selectedRunId: 'latest',
		runs: [],
		hasSelectedEntry: false,
		editHistoryCount: 0,
		blockingHardCount: 0,
		hardCount: 0,
		softCount: 0,
		summary: { isPublished: false, unassignedCount: 0, assignedCount: 0, hardViolationCount: 0 },
		schoolYearContext: { activeSchoolYearLabel: '2026-2027', source: 'enrollpro', activeTerm: null },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		...overrides,
	};
}

function headerProps(context: Record<string, unknown>) {
	return {
		context,
		layoutMode: 'simple',
		onLayoutModeChange: () => {},
		activeTask: null,
		onTaskChange: () => {},
		onSetRepairOrigin: () => {},
		readinessSheetOpen: false,
		onReadinessSheetOpenChange: () => {},
		swapClassTimesMode: null,
		onSwapClassTimesStart: () => {},
		onSwapClassTimesCancel: () => {},
		undoRedoControl: null,
		onDiscardDraft: () => {},
	};
}

function renderHeader(context: Record<string, unknown>) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(
			MemoryRouter as never,
			{ initialEntries: ['/timetable'] },
			createElement(TimetableSimpleHeader as never, headerProps(context) as never),
		));
	});
	return host;
}

function header(host: HTMLElement): HTMLElement {
	const el = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement | null;
	assert.ok(el, 'the simple header renders');
	return el;
}

function countedControls(root: ParentNode): string[] {
	return [...root.querySelectorAll('button, [role="combobox"], [role="button"], a[href]')]
		.filter((element) => {
			if (element.closest('[data-testid="timetable-page-heading"]') != null) return false;
			return !(element.getAttribute('class') ?? '').split(/\s+/).includes('lg:hidden');
		})
		.map((element) => {
			const testId = element.getAttribute('data-testid');
			if (testId) return testId;
			const label = element.getAttribute('aria-label') ?? '';
			if (label.startsWith('Schedule for')) return 'combobox:entity';
			return `${element.getAttribute('role') ?? element.tagName.toLowerCase()}:${label}`;
		})
		.sort();
}

// ═══ FAILING-FIRST (RED on the base commit) ═════════════════════════════════

test('A (FAILING-FIRST) the header has ONE control row, no tab band above the grid, and ONE status line', () => {
	const head = header(renderHeader(baseContext()));

	// The tab band is GONE from the header DOM — the five section links are only
	// reachable from the More menu (asserted below), never as a band above the grid.
	// (These use boolean forms on purpose: `assert.equal(<jsdom node>, null)` would
	// try to `util.inspect` a live DOM node on failure and exhaust the heap.)
	assert.ok(head.querySelector('[data-testid="timetable-sub-nav"]') === null,
		'the tab band is not rendered above the grid (it moved into More)');

	// Exactly ONE control row, and the old second row / change row are absent.
	const rows = [...head.querySelectorAll('[data-testid="timetable-simple-header-row"]')];
	assert.equal(rows.length, 1, `exactly one control row; got ${rows.length}`);
	assert.ok(head.querySelector('[data-testid="timetable-simple-header-row-1"]') === null, 'the old row 1 testid is gone');
	assert.ok(head.querySelector('[data-testid="timetable-simple-header-row-2"]') === null, 'the old row 2 testid is gone');
	assert.ok(head.querySelector('[data-testid="timetable-simple-header-change-row"]') === null, 'the change row is gone');

	// ONE status line, directly under the row.
	const status = head.querySelector('[data-testid="timetable-simple-status-line"]') as HTMLElement | null;
	assert.ok(status, 'the ONE status line is rendered');
	assert.equal(status!.getAttribute('role'), 'status', 'and it is a plain status region');

	// The draft actions are NOT row controls any more.
	for (const id of ['timetable-draft-strip-edit', 'timetable-draft-strip-discard']) {
		assert.ok(head.querySelector(`[data-testid="${id}"]`) === null, `${id} is not a header-row control`);
	}
});

test('B (FAILING-FIRST) the warnings control lives in the status line, NOT in the control row', () => {
	const head = header(renderHeader(baseContext()));
	const warnings = head.querySelector('[data-testid="timetable-simple-warnings-control"]') as HTMLElement | null;
	assert.ok(warnings, 'the warnings control is still reachable');
	assert.ok(warnings!.closest('[data-testid="timetable-simple-header-row"]') === null,
		'the warnings control is NOT a row control (it is in the status line)');
	assert.ok(warnings!.closest('[data-testid="timetable-simple-status-line"]') !== null,
		'and it renders inside the ONE status line');
});

test('C the control row carries exactly the named controls and NO ellipsis inside the header', () => {
	const head = header(renderHeader(baseContext()));
	assert.deepEqual(countedControls(head), [
		'combobox:entity',
		'timetable-simple-generate-action',
		'timetable-simple-more-trigger',
		'timetable-simple-term-filter',
		'timetable-simple-view-mode-select',
		'timetable-simple-warnings-control',
	].sort(), 'the named controls: Term, Show, Schedule for, primary, More, and the status-line chip');
	assert.ok(head.querySelector('[data-testid="timetable-page-heading"]'), 'the page heading is present');

	for (const element of [...head.querySelectorAll('*')]) {
		const classes = (element.getAttribute('class') ?? '').split(/\s+/);
		assert.equal(classes.includes('truncate') || classes.includes('text-ellipsis'), false,
			`no clipping class inside the header: ${element.tagName} ${element.getAttribute('class')}`);
	}
});

test('D the five section links and `Update schedule` are reachable from the More menu', async () => {
	const host = renderHeader(baseContext());
	const trigger = host.querySelector('[data-testid="timetable-simple-more-trigger"]') as HTMLElement;
	assert.ok(trigger, 'the More trigger is rendered');
	await act(async () => {
		trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
	});
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
	const menu = dom.window.document.querySelector('[role="menu"]') as HTMLElement | null;
	assert.ok(menu, 'More opens a menu');
	const sectionGroup = menu!.querySelector('[data-testid="timetable-sub-nav"]') as HTMLElement | null;
	assert.ok(sectionGroup, 'the rehomed section links have one labelled group');
	assert.equal(sectionGroup!.getAttribute('role'), 'group', 'menu rows use menu/group semantics, never a tablist');
	assert.equal(sectionGroup!.querySelector('[role="tab"]'), null, 'no tab role is nested inside the menu');
	for (const key of ['schedule', 'draft', 'setup', 'policies', 'runs']) {
		assert.ok(menu!.querySelector(`[data-testid="timetable-sub-nav-${key}"]`),
			`the \`${key}\` section link is reachable inside More`);
	}
	assert.equal(menu!.querySelector('[data-testid="timetable-sub-nav-schedule"]')!.getAttribute('aria-current'), 'page',
		'the active section remains exposed after the links move into More');
	assert.equal(menu!.querySelector('[data-testid="timetable-sub-nav-draft"]')!.hasAttribute('aria-current'), false,
		'an inactive section does not claim the current page');
	assert.ok(menu!.querySelector('[data-testid="timetable-simple-more-sections"]'), 'the sections are a labelled group');
});
