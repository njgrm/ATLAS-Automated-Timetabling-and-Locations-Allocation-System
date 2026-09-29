/**
 * A7 c12b — THE CALM CLASS SCHEDULE HEADER: the rendered CONTROL BUDGET.
 *
 * ── WHO THIS IS FOR, AND WHAT MUST FEEL DIFFERENT ────────────────────────────
 * The user is an older, mouse-first scheduler on `/timetable` at 1366x768. Their
 * task is to read the state of the draft and take one obvious next step. What
 * must feel different is CALMER: one row of controls, one status chip, one
 * primary action, one plain sentence when the year changed. Subtracting is the
 * goal; meeting a row count by cramming is a failure (AGENTS.md §8/§11, decision
 * 2 in `docs/plans/operator-decisions.md`).
 *
 * ── WHAT THIS FILE DECIDES, AND WHAT IT DOES NOT ────────────────────────────
 * Every row RENDERS the real component and reads real output (the technique
 * proven in `a2-header-budget-2026-09-29.test.tsx`, copied rather than
 * reinvented). JSDOM has NO layout engine, so this is a DOM-SHAPE and
 * CONTROL-COUNT row, not a 1366x768 pixel row; the pixel count is a browser row
 * (AGENTS.md §11/§12) owned by Lane C. The counted region and its exclusions are
 * PINNED BELOW so a later test that counts a different set is a different named
 * row.
 *
 * ── WHY EVERY IMPORT BELOW RESOLVES ON THE BASE COMMIT ───────────────────────
 * A failing-first row is only evidence if it fails BEHAVIOURALLY. An
 * `ERR_MODULE_NOT_FOUND` is a FALSE failing-first. The rollover notice is a NEW
 * module on this branch, so it is imported through a guarded dynamic import: on
 * the base that import throws and the row fails on `assert.equal(typeof …,
 * 'function')` — an assertion about a requirement, never a missing module.
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
	PointerEvent: dom.window.PointerEvent,
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

(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

/* One stub, set BEFORE any mount, so the header's rollover-status effect can never
 * race the teardown with a real network call or an unhandled rejection. */
const fetchStub = () => Promise.resolve({
	ok: true,
	status: 200,
	json: () => Promise.resolve({ drift: { status: 'aligned', message: null, recommendedAction: null, conflicts: [], unacknowledgedReconfiguredSections: 0 } }),
});
beforeEach(() => { globalThis.fetch = fetchStub as unknown as typeof fetch; });

const { renderToStaticMarkup } = await import('react-dom/server');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');

/* The NEW component. On the base this module does not exist, so the guarded import
 * leaves the binding `undefined` and row B fails on its FIRST assertion. */
let RolloverAwarenessNotice: ((props: {
	notice: { schoolId: number; activeSchoolYearId: number; activeSchoolYearLabel: string; previousSchoolYearId: number; previousSchoolYearLabel: string; changedAt: string };
	onActivate?: () => void;
}) => unknown) | undefined;
try {
	RolloverAwarenessNotice = (await import('@/components/app-shell/RolloverAwarenessNotice')).RolloverAwarenessNotice;
} catch {
	RolloverAwarenessNotice = undefined;
}

let mountedRoot: { unmount: () => void } | null = null;
let mountedHost: HTMLElement | null = null;
afterEach(() => {
	if (mountedRoot) { act(() => mountedRoot!.unmount()); mountedRoot = null; }
	if (mountedHost) { mountedHost.remove(); mountedHost = null; }
	for (const stray of [...dom.window.document.body.children]) stray.remove();
});

// ═══ THE COUNTED REGION AND ITS EXCLUSIONS (PINNED) ═════════════════════════

/** The counted region: the simple-header subtree. The app-shell rollover notice is
 * the SECOND counted region and is added by the caller. */
const HEADER_SELECTOR = '[data-testid="timetable-simple-header"]';
/**
 * Excluded, and why — pinned so a later row that counts a different set must be a
 * different named row:
 *   - `timetable-sub-nav` — the TAB ROW. Decision 2 KEEPS the tabs; they are not
 *     part of the controls-above-the-grid budget.
 *   - `timetable-page-heading` — the page TITLE, not a control.
 *   - any `lg:hidden` control — the mobile-only face of a control that has a
 *     desktop face counted on the same row (the compact schedule sheet trigger).
 *     JSDOM has no CSS, so a mobile face is present in the DOM at every width;
 *     excluding the `lg:hidden` token is the closest honest desktop reading.
 */
const EXCLUDED_SUBTREES = ['timetable-sub-nav', 'timetable-page-heading'];
function isExcluded(element: Element): boolean {
	if (EXCLUDED_SUBTREES.some((id) => element.closest(`[data-testid="${id}"]`) != null)) return true;
	return (element.getAttribute('class') ?? '').split(/\s+/).includes('lg:hidden');
}

/** A stable descriptor for a control, so "the exact named list" is checkable. */
function descriptor(element: Element): string {
	const testId = element.getAttribute('data-testid');
	if (testId) return testId;
	const role = element.getAttribute('role') ?? element.tagName.toLowerCase();
	const label = element.getAttribute('aria-label') ?? '';
	if (label.startsWith('Schedule for')) return 'combobox:entity';
	return `${role}:${label}`;
}

function countedControls(root: ParentNode): Element[] {
	return [...root.querySelectorAll('button, [role="combobox"], [role="button"], a[href]')]
		.filter((element) => !isExcluded(element));
}

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

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

function headerMarkup(context: Record<string, unknown>): string {
	return renderToStaticMarkup(createElement(
		MemoryRouter as never,
		{ initialEntries: ['/timetable'] },
		createElement(TimetableSimpleHeader as never, headerProps(context) as never),
	));
}

function headerTree(markup: string): HTMLElement {
	const host = dom.window.document.createElement('div');
	host.innerHTML = markup;
	return host;
}

const NOTICE = {
	schoolId: 1,
	activeSchoolYearId: 5,
	activeSchoolYearLabel: '2026-2027',
	previousSchoolYearId: 4,
	previousSchoolYearLabel: '2025-2026',
	changedAt: '2026-09-30T00:02:00.000Z',
};

function bannerMarkup(onActivate?: () => void): string {
	assert.equal(typeof RolloverAwarenessNotice, 'function',
		'the rollover notice is a real, renderable component (this fails on the base, where the module does not exist)');
	return renderToStaticMarkup(createElement(RolloverAwarenessNotice as never, { notice: NOTICE, onActivate } as never));
}

// ═══ ROW A — THE HEADER'S CONTROL INVENTORY IS EXACT AND ≤6 ═════════════════

test('A (PINNED COUNT) state A no draft: the header renders EXACTLY the six named controls and no seventh', () => {
	const host = headerTree(headerMarkup(baseContext()));
	const header = host.querySelector(HEADER_SELECTOR);
	assert.ok(header, 'the simple header renders');
	const found = countedControls(header).map(descriptor).sort();
	const expected = [
		'combobox:entity',
		'timetable-simple-generate-action',
		'timetable-simple-more-trigger',
		'timetable-simple-term-filter',
		'timetable-simple-view-mode-select',
		'timetable-simple-warnings-control',
	].sort();
	assert.deepEqual(found, expected,
		`the header's counted-control inventory is exactly the six named controls; got ${JSON.stringify(found)}`);
	assert.ok(found.length <= 6, `and it is at most six; got ${found.length}`);
	// DISCRIMINATION: the tabs and the title ARE rendered, and are excluded by the
	// pinned rule rather than by the header having lost them.
	assert.ok(header.querySelector('[data-testid="timetable-sub-nav"]'), 'the tabs are still on the header row');
	assert.ok(header.querySelector('[data-testid="timetable-page-heading"]'), 'and the page title is still there');
});

// ═══ ROW B — THE YEAR BANNER IS ONE SENTENCE WITH ONE LINK ══════════════════

test('B state A: the rollover notice is ONE role="status" sentence with exactly ONE interactive element — the `Year Setup` link — and ZERO buttons', () => {
	const host = headerTree(bannerMarkup());
	const notice = host.querySelector('[data-testid="rollover-awareness-notice"]');
	assert.ok(notice, 'the rollover notice renders');
	assert.equal(notice!.getAttribute('role'), 'status', 'it is one status line');

	const links = [...notice!.querySelectorAll('a[href]')];
	assert.equal(links.length, 1, `exactly ONE interactive element; got ${links.length}: ${links.map((a) => a.textContent).join(' | ')}`);
	assert.equal(links[0].getAttribute('href'), '/admin/year-setup', 'and it points at Year Setup');
	assert.equal((links[0].textContent ?? '').trim(), 'Year Setup', 'and it reads `Year Setup`');
	assert.equal(notice!.querySelectorAll('button').length, 0, 'and there are ZERO buttons on the banner');

	const text = notice!.textContent ?? '';
	assert.ok(text.includes('2026-2027'), 'the sentence names the new active year');
	assert.ok(text.includes('2025-2026'), 'and the archived year');
	assert.equal(text.includes('View past years'), false, 'the `View past years` control is gone from the banner');
	assert.equal(text.includes('This page refreshed with the new active year.'), false,
		'the trailing sentence is dropped so the line reads as one sentence');
});

test('B state A: activating the ONE link clears the notice (dismissal preserved in effect)', async () => {
	assert.equal(typeof RolloverAwarenessNotice, 'function', 'the notice component exists');
	let cleared = 0;
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	mountedHost = host;
	const root = createRoot(host);
	mountedRoot = root;
	act(() => { root.render(createElement(RolloverAwarenessNotice as never, { notice: NOTICE, onActivate: () => { cleared += 1; } } as never)); });
	const link = host.querySelector('a[href]') as HTMLAnchorElement | null;
	assert.ok(link, 'the link is rendered');
	act(() => { link!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(cleared, 1, 'activating the link clears the notice exactly once');
});

// ═══ ROW C — THE COMPOSITE BUDGET IS ≤7 ══════════════════════════════════════

test('C state A: the composite budget — header controls PLUS the banner\'s interactive elements — is at most SEVEN', () => {
	const header = headerTree(headerMarkup(baseContext())).querySelector(HEADER_SELECTOR)!;
	const banner = headerTree(bannerMarkup()).querySelector('[data-testid="rollover-awareness-notice"]')!;
	const headerCount = countedControls(header).length;
	const bannerCount = banner.querySelectorAll('a[href], button').length;
	const composite = headerCount + bannerCount;
	assert.equal(composite <= 7, true,
		`header ${headerCount} + banner ${bannerCount} must be at most the seven-control budget; got ${composite}`);
	assert.equal(composite, 7,
		`the expected inventory is exactly seven: chip, Generate a draft, More, Term, Show, Schedule for (6) + the banner link (1); got ${composite}`);
});
