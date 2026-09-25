/**
 * UX-AUDIT-FINDINGS-C01 — rendered-interaction proof (jsdom).
 *
 * F3: focusing the per-entry warning indicator opens a `@/ui` Tooltip that names
 * the real violation. F6: a published run renders read-only entries (no drag
 * handle, no pointer cursor, no "Select …" action) while a draft keeps them,
 * driven by the header's `isRunPublished` through the production store.
 *
 * This is component evidence for undeployed source. It is NOT live Tailnet
 * browser evidence; the deployed two-viewport pixel acceptance is a separate
 * deployment row.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://njgrm.buru-degree.ts.net';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `${ORIGIN}/timetable` });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	Document: dom.window.Document,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	HTMLElement: dom.window.HTMLElement,
	HTMLDivElement: dom.window.HTMLDivElement,
	HTMLSpanElement: dom.window.HTMLSpanElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	SVGElement: dom.window.SVGElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const { TimetableGrid } = await import('../TimetableGrid');
const { TimetableSimpleHeader } = await import('../TimetableSimpleHeader');
const { setTimetableEntryReadOnly, useTimetableEntryReadOnly } = await import('../TimetableDraggableEntry');
const { MemoryRouter } = await import('react-router-dom');

type AnyProps = Record<string, unknown>;
const container = () => document.getElementById('root')!;
let root: Root | null = null;

async function mount(element: ReturnType<typeof createElement>) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
}

async function flush() {
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

/* ── fixtures ────────────────────────────────────────────────────────────── */

const entry = {
	entryId: 'e-1',
	sectionId: 701,
	facultyId: 9,
	roomId: 9,
	subjectId: 1,
	day: 'MONDAY',
	startTime: '11:30',
	endTime: '12:15',
	durationMinutes: 45,
	termIndex: 1,
};
const softViolation = { code: 'TEACHER_OVERLOAD_SOFT', severity: 'SOFT', message: 'Teacher is close to the load limit' };
const violationIndex = new Map<string, unknown[]>([['e-1', [softViolation]]]);

function gridProps(overrides: AnyProps = {}) {
	return {
		entries: [entry],
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex,
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: () => 'TLE',
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => 'P. CRUZ',
		facultyLabel: () => 'P. CRUZ',
		viewMode: 'section',
		termFilter: 1,
		reviewEntryIds: new Set(['e-1']),
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 103 · G7AW',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
		...overrides,
	} as AnyProps;
}

function headerContext(isPublished: boolean) {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 42,
		leftTab: 'violations',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: () => {},
		viewMode: 'section',
		setViewMode: () => {},
		entityFilter: '701',
		setEntityFilter: () => {},
		focusSection: () => {},
		sectionFocusId: null,
		programFilter: 'all',
		entryKindFilter: 'all',
		violations: [],
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		selectedRunId: '42',
		handleRunChange: () => {},
		runs: [{ id: 42, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
		schoolId: 1,
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		centerView: 'schedule',
		newDraftLoading: false,
		schoolYearId: 9,
		handleStartNewPreGenerationDraft: async () => {},
		draftPlacementCount: 0,
		openPreGenerationWorkspace: async () => {},
		returnToGeneratedRun: () => {},
		generating: false,
		loading: false,
		handleTriggerGenerate: () => {},
		draft: {
			runId: 317,
			status: 'COMPLETED',
			entries: [],
			unassignedItems: [],
			summary: { runId: 317, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished },
			version: 3,
			finishedAt: null,
			createdAt: '2031-01-01T00:00:00.000Z',
		},
		setPublishAcknowledged: () => {},
		setShowPublishDialog: () => {},
		exitPolicyView: () => {},
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: () => {},
		openMapWorkspace: async () => {},
		handleRefresh: () => {},
		refreshReferenceLabels: () => {},
		referenceLookupStatus: { state: 'ready', label: 'References ready' },
		revertLoading: false,
		editHistoryCount: 0,
		revertLastEdit: async () => {},
		setShowEditHistory: () => {},
		tutorial: { start: () => {} },
		sectionLabel: (id: number) => `Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0,
		statusColor: () => '',
		formatDuration: () => '',
		formatTimestamp: () => '',
		groupedPivotEntities: [],
		pivotLabel: () => '',
		setSelectedEntry: () => {},
		hasSelectedEntry: false,
		setSelectedViolation: () => {},
		enterManualEditView: () => {},
		setPreGenKbSource: () => {},
		setKbSelectedSource: () => {},
		severityFilter: 'all',
		setSeverityFilter: () => {},
		setLeftTab: () => {},
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		setProgramFilter: () => {},
		setEntryKindFilter: () => {},
		policy: { teacherMoveEnabled: true },
		policyAlignmentWarning: null,
		showFullDay: false,
		setShowFullDay: () => {},
		hiddenRowCount: 0,
		termFilter: 'all',
		onTermFilterChange: () => {},
		termOptions: [],
		activeTermIndex: null,
	};
}

function ReadOnlyProbe() {
	const readOnly = useTimetableEntryReadOnly();
	return createElement('span', { 'data-testid': 'readonly-probe' }, readOnly ? 'readonly' : 'editable');
}

let disclosureCount = 0;
function harness(isPublished: boolean, layoutMode: 'simple' | 'advanced' = 'simple') {
	disclosureCount = 0;
	setTimetableEntryReadOnly(isPublished);
	return createElement(MemoryRouter, null,
		createElement('div', null,
			layoutMode === 'simple' ? createElement(TimetableSimpleHeader, {
				context: headerContext(isPublished) as never,
				layoutMode: 'simple',
				onLayoutModeChange: () => {},
				activeTask: null,
				onTaskChange: () => {},
			}) : null,
			createElement(ReadOnlyProbe),
			createElement(TimetableGrid, gridProps({ onEntryClick: () => { disclosureCount += 1; } }) as never),
		),
	);
}

/* ── F3 — hover/focus explanation ────────────────────────────────────────── */

test('F3: focusing the entry warning indicator opens a tooltip naming the real violation', async () => {
	await mount(createElement(TimetableGrid, gridProps() as never));
	await flush();
	const indicator = document.querySelector('[data-testid="timetable-entry-severity-indicator"]') as HTMLElement | null;
	assert.ok(indicator, 'the severity indicator renders');
	assert.equal(indicator!.getAttribute('role'), 'img');
	assert.match(indicator!.getAttribute('aria-label') ?? '', /1 warning: 1 Schedule note/);
	await act(async () => { indicator!.focus(); });
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
	assert.match(document.body.textContent ?? '', /Teacher is close to the load limit/, 'the tooltip explains the warning on focus');
});

/* ── F6 — published read-only vs draft editable ──────────────────────────── */

test('F6: a published run renders read-only entries; a draft keeps its edit affordances', async () => {
	await mount(harness(true));
	await flush();
	assert.equal(document.querySelector('[data-testid="readonly-probe"]')?.textContent, 'readonly', 'the header published its run state');
	const publishedEntry = document.querySelector('[data-timetable-entry="true"]') as HTMLElement;
	assert.ok(publishedEntry);
	assert.equal(publishedEntry.getAttribute('data-read-only'), 'true');
	assert.equal(publishedEntry.getAttribute('role'), 'button', 'a published cell can disclose read-only details');
	assert.match(publishedEntry.getAttribute('aria-label') ?? '', /^View /, 'a published cell offers a view-only disclosure, never a change');
	assert.doesNotMatch(publishedEntry.className, /cursor-pointer/, 'no pointer cursor on a published run');
	assert.match(publishedEntry.className, /cursor-default/);
	assert.equal(publishedEntry.querySelector('svg[class*="grip-vertical"]'), null, 'no drag handle on a published run');
	await act(async () => { publishedEntry.click(); });
	assert.equal(disclosureCount, 1, 'a published entry still discloses details on click');
	await act(async () => { publishedEntry.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
	assert.equal(disclosureCount, 2, 'a published entry discloses details with Enter');
	await act(async () => { publishedEntry.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
	assert.equal(disclosureCount, 3, 'a published entry discloses details with Space');

	await mount(harness(true, 'advanced'));
	await flush();
	const advancedPublishedEntry = document.querySelector('[data-timetable-entry="true"]') as HTMLElement;
	assert.equal(advancedPublishedEntry.getAttribute('data-read-only'), 'true', 'Advanced mode receives the shared published state without the Simple header');
	assert.doesNotMatch(advancedPublishedEntry.className, /cursor-pointer/);

	await mount(harness(false));
	await flush();
	assert.equal(document.querySelector('[data-testid="readonly-probe"]')?.textContent, 'editable', 'a draft is editable');
	const draftEntry = document.querySelector('[data-timetable-entry="true"]') as HTMLElement;
	assert.equal(draftEntry.getAttribute('data-read-only'), null);
	assert.equal(draftEntry.getAttribute('role'), 'button', 'a draft cell stays an actionable button');
	assert.match(draftEntry.getAttribute('aria-label') ?? '', /^Select /);
	assert.match(draftEntry.className, /cursor-pointer/);
	assert.ok(draftEntry.querySelector('svg[class*="grip-vertical"]'), 'a draft keeps its drag handle');
});

/* ── two-viewport structural proof ───────────────────────────────────────── */

for (const [label, width, height] of [['desktop 1366×768', 1366, 768], ['mobile 390×844', 390, 844]] as const) {
	test(`viewport ${label}: the compact header avoids global scrolling`, async () => {
		Object.defineProperty(dom.window, 'innerWidth', { value: width, configurable: true });
		Object.defineProperty(dom.window, 'innerHeight', { value: height, configurable: true });
		dom.window.dispatchEvent(new dom.window.Event('resize'));
		await mount(harness(false));
		await flush();
		const header = document.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
		assert.ok(header, 'the header renders');
		assert.doesNotMatch(header.className, /overflow-(x|y)-scroll/, 'the header never opts into a global scrollbar');
		assert.equal(document.querySelector('[data-testid="timetable-simple-daily-tasks"]'), null, 'daily repair tools remain in More so the header stays compact');
		const grid = document.querySelector('[data-testid="timetable-center-panel"]');
		if (grid) {
			assert.doesNotMatch((grid as HTMLElement).className, /overflow-(x|y)-scroll/, 'the grid never opts into a global scrollbar');
		}
		assert.equal(dom.window.location.origin, ORIGIN, 'the evidence origin is the ATLAS Tailnet origin');
	});
}
