/**
 * LANE-C DRAFT-UX-C01 — scheduler header, desktop session modal, cell warning
 * signs, and unassigned access in the Simple layout. Rows S1–S5 of
 * `docs/prompts/lane-c-draft-ux-c01-2026-09-25.md`.
 *
 * Production path: every row renders the real component the route renders
 * (`TimetableSimpleHeader`, `EntrySeverityIndicator`, `SimpleSessionDetails`,
 * `TimetableTaskDrawer`) in jsdom and reads the rendered DOM. Layout is not
 * measured (jsdom has no layout engine): "visible at ≥1280 px" means "not
 * hidden by a class that applies at ≥1280 px" (`hidden` without an `lg:`/`xl:`
 * display override, `lg:hidden`, `xl:hidden`, `sr-only`).
 *
 * Fixtures come from the real surface: the SOFT note is the constraint
 * validator's `FACULTY_EXCESSIVE_IDLE_GAP` shape (run 318 carried this family:
 * "has 90 minutes idle gaps on Tuesday, exceeds limit of 60 minutes"), and the
 * header context mirrors the one `timetable-header-collapse-c01` renders.
 *
 * Failing-first: each row imports its surface lazily so one missing module
 * fails only its own row on base `d6ff9a44`.
 *
 * Run: `npm run test:draft-ux-c01` (also named in `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement, useState, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
let viewportWidth = 1366;
function matchMediaStub(query: string) {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = min ? viewportWidth >= Number(min[1]) : max ? viewportWidth <= Number(max[1]) : false;
	return {
		matches,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	};
}
(dom.window as unknown as { matchMedia: typeof matchMediaStub }).matchMedia = matchMediaStub;
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	SVGElement: dom.window.SVGElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	matchMedia: matchMediaStub,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};

// react-dom must load after the DOM globals.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const atlasApi = (await import('../../../lib/api')).default;
// The header subscribes to the rollover status; keep it offline and inert.
mock.method(atlasApi, 'get', async () => { throw new Error('offline in test'); });

const PointerEventCtor = (dom.window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? dom.window.MouseEvent;
let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReactElement) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
	await flush();
}

async function flush() {
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function openMenu(trigger: HTMLElement) {
	await act(async () => {
		trigger.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
	});
	await flush();
}

async function click(element: HTMLElement) {
	await act(async () => { element.click(); });
	await flush();
}

/** Radix tooltips need their real open delay to have elapsed. */
async function wait(ms: number) {
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
	await flush();
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	mock.restoreAll();
	dom.window.close();
});

/* ── fixtures ─────────────────────────────────────────────────────────────── */

// The constraint validator's real FACULTY_EXCESSIVE_IDLE_GAP violation shape.
const IDLE_GAP_SOFT = {
	code: 'FACULTY_EXCESSIVE_IDLE_GAP',
	severity: 'SOFT',
	message: 'Faculty 12 has 90 min idle gaps on TUESDAY, exceeds limit of 60 min.',
	schoolId: 1,
	schoolYearId: 9,
	runId: 318,
	entities: { facultyId: 12, day: 'TUESDAY', entryIds: ['e-701-math-tue'] },
	meta: { facultyId: 12, day: 'TUESDAY', totalIdleMinutes: 90, excludedBreakWindows: 1, configuredThresholds: { maxIdleGapMinutesPerDay: 60 } },
};
const TEACHER_CLASH_HARD = {
	code: 'FACULTY_TIME_CONFLICT',
	severity: 'HARD',
	message: 'Faculty 12 is double-booked on TUESDAY 09:00-10:00.',
	schoolId: 1,
	schoolYearId: 9,
	runId: 318,
	entities: { facultyId: 12, day: 'TUESDAY', startTime: '09:00', endTime: '10:00', entryIds: ['e-701-math-tue'] },
};

const SELECTED_ENTRY = {
	entryId: 'e-701-math-tue',
	sectionId: 701,
	subjectId: 31,
	facultyId: 12,
	roomId: 5,
	day: 'TUESDAY',
	startTime: '09:00',
	endTime: '10:00',
	termIndex: 2,
	entryKind: 'SECTION',
};

function unassignedItem(termIndex: number, sectionId: number, session: number) {
	return {
		sectionId,
		subjectId: 31,
		gradeLevel: 7,
		session,
		reason: 'NO_AVAILABLE_SLOT',
		facultyId: 12,
		homeRoomId: 5,
		termIndex,
		entryKind: 'SECTION',
	};
}

function draft(unassignedItems: unknown[], summary: Record<string, unknown> = {}) {
	return {
		runId: 318,
		status: 'COMPLETED',
		entries: [],
		unassignedItems,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 0, unassignedCount: unassignedItems.length, ...summary },
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	};
}

function headerContext(overrides: Record<string, unknown> = {}) {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: null,
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
		selectedRunId: 'latest',
		handleRunChange: () => {},
		runs: [],
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
		draft: null,
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
		sectionLabel: (id: number) => `GR7 - Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0,
		statusColor: () => '',
		formatDuration: () => '',
		formatTimestamp: () => '',
		groupedPivotEntities: [{ label: 'Grade 7', ids: [701] }],
		pivotLabel: (id: number) => `GR7 - Section ${id}`,
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
		termFilter: 2,
		onTermFilterChange: () => {},
		termOptions: [
			{ value: '1', label: 'TERM 1' },
			{ value: '2', label: 'TERM 2' },
			{ value: '3', label: 'TERM 3' },
		],
		activeTermIndex: 2,
		...overrides,
	};
}

/** Draft run 318 (Term 2, unpublished, 194 SOFT notes) — the evidence state. */
function withRunContext(overrides: Record<string, unknown> = {}) {
	const run = draft([]);
	return headerContext({
		draft: run,
		activeGeneratedRunId: 318,
		selectedRunId: '318',
		runs: [{ id: 318, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		summary: run.summary,
		softCount: 194,
		...overrides,
	});
}

async function renderHeader(context: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const { TimetableSimpleHeader } = await import('../TimetableSimpleHeader');
	await mount(createElement(MemoryRouter, null,
		createElement(TimetableSimpleHeader as unknown as (props: Record<string, unknown>) => ReactElement, {
			context,
			layoutMode: 'simple',
			onLayoutModeChange: () => {},
			activeTask: null,
			onTaskChange: () => {},
			...extra,
		}),
	));
	const header = container().querySelector<HTMLElement>('[data-testid="timetable-simple-header"]');
	assert.ok(header, 'the Simple header renders');
	return header;
}

const DESKTOP_DISPLAY = /^(lg|xl):(flex|inline-flex|block|inline|grid|inline-block)$/;
function hiddenAtDesktop(element: Element, stop: Element): boolean {
	for (let node: Element | null = element; node && node !== stop.parentElement; node = node.parentElement) {
		const tokens = (node.getAttribute('class') ?? '').split(/\s+/);
		if (tokens.includes('sr-only') || tokens.includes('lg:hidden') || tokens.includes('xl:hidden')) return true;
		if (tokens.includes('hidden') && !tokens.some((token) => DESKTOP_DISPLAY.test(token))) return true;
		if (node.getAttribute('aria-hidden') === 'true') return true;
	}
	return false;
}

function visibleControls(header: HTMLElement): HTMLElement[] {
	const all = Array.from(header.querySelectorAll<HTMLElement>('button, a[href], [role="combobox"], input, select'));
	return [...new Set(all)].filter((element) => !hiddenAtDesktop(element, header));
}

function describeControl(element: HTMLElement): string {
	return element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName;
}

async function openHeaderMore(): Promise<HTMLElement> {
	const trigger = container().querySelector<HTMLElement>('[data-testid="timetable-simple-more-trigger"]');
	assert.ok(trigger, 'More renders');
	await openMenu(trigger);
	const menu = document.querySelector<HTMLElement>('[role="menu"]');
	assert.ok(menu, 'More opens a menu');
	return menu;
}

/* ── S1 — at most 6 visible header controls; the primary follows the run ──── */

test('S1 no generated run: ≤6 visible controls, Generate is the one primary; Download/School information live in More', async () => {
	viewportWidth = 1366;
	const header = await renderHeader(headerContext());
	const controls = visibleControls(header);
	assert.ok(controls.length <= 6, `expected ≤6 visible controls at ≥1280 px, got ${controls.length}: ${controls.map(describeControl).join(' | ')}`);
	const generate = header.querySelector<HTMLElement>('[data-testid="timetable-simple-generate-action"]');
	assert.ok(generate && controls.includes(generate), 'Generate is visible');
	assert.match(generate.className, /\bbg-primary\b/, 'Generate is the solid primary when no run exists');
	assert.equal(header.querySelector('[data-testid="timetable-simple-publish-action"]'), null, 'no Publish without a run');
	assert.equal(header.querySelector('[data-testid="timetable-simple-primary-action"]'), null, 'no second lifecycle primary');
	assert.equal(controls.filter((element) => /\bbg-primary\b/.test(element.className)).length, 1, 'exactly one solid primary');
	for (const text of ['Download schedules', 'School information']) {
		assert.ok(!controls.some((element) => element.textContent?.includes(text)), `${text} is not a visible header control`);
	}
	const menu = await openHeaderMore();
	assert.match(menu.textContent ?? '', /School information/, 'School information is reachable from More');
	const setupLink = menu.querySelector<HTMLAnchorElement>('[data-testid="timetable-simple-review-setup"]');
	assert.ok(setupLink, 'the same School information link, now inside More');
	assert.equal(setupLink.getAttribute('href'), '/timetable/setup');
});

test('S1 run exists: Publish is the primary; Generate, Download and School information move into More', async () => {
	viewportWidth = 1366;
	const header = await renderHeader(withRunContext());
	const controls = visibleControls(header);
	assert.ok(controls.length <= 6, `expected ≤6 visible controls at ≥1280 px, got ${controls.length}: ${controls.map(describeControl).join(' | ')}`);
	const publish = header.querySelector<HTMLElement>('[data-testid="timetable-simple-publish-action"]');
	assert.ok(publish && controls.includes(publish), 'Publish is visible');
	assert.match(publish.className, /\bbg-primary\b/, 'Publish is the solid primary once a run exists');
	assert.equal(header.querySelector('[data-testid="timetable-simple-generate-action"]'), null, 'Generate is not a visible header control once a run exists');
	const warnings = header.querySelector<HTMLElement>('[data-testid="timetable-simple-warnings-control"]');
	assert.ok(warnings && controls.includes(warnings), 'one merged warnings control is visible');
	assert.match(warnings.textContent ?? '', /194 warnings/);
	assert.equal((header.textContent ?? '').match(/Review warnings/g)?.length ?? 0, 0, 'no separate "Review warnings" button beside the count');
	const expected = [
		header.querySelector('[data-testid="timetable-simple-term-filter"]'),
		header.querySelector('[data-testid="timetable-simple-view-mode-select"]'),
		header.querySelector('[data-testid="timetable-simple-entity-select"] [role="combobox"]'),
		warnings,
		publish,
		header.querySelector('[data-testid="timetable-simple-more-trigger"]'),
	];
	for (const element of expected) assert.ok(element && controls.includes(element as HTMLElement), `expected visible control ${element ? describeControl(element as HTMLElement) : 'missing'}`);
	assert.equal(controls.length, 6, 'Term · View · picker · warnings · primary · More');

	const menu = await openHeaderMore();
	const text = menu.textContent ?? '';
	assert.match(text, /Download schedules/, 'Download is reachable from More');
	assert.match(text, /School information/, 'School information is reachable from More');
	assert.ok(menu.querySelector('[data-testid="timetable-more-generate"]'), 'the other primary (Generate) is reachable from More');
	assert.ok(menu.querySelector('[data-testid="timetable-simple-more-schedule-actions"]'), 'More groups the moved actions');
});

test('S1 the merged warnings control dispatches the review-warnings task, and More does not duplicate it', async () => {
	viewportWidth = 1366;
	const tasks: Array<string | null> = [];
	const header = await renderHeader(withRunContext(), { onTaskChange: (task: string | null) => tasks.push(task) });
	const warnings = header.querySelector<HTMLElement>('[data-testid="timetable-simple-warnings-control"]');
	assert.ok(warnings);
	await click(warnings);
	assert.deepEqual(tasks, ['review-issues'], 'the warnings control opens the warning review');
	const menu = await openHeaderMore();
	assert.equal(menu.querySelector('[data-testid="timetable-more-review-issues"]'), null, 'More does not repeat the review action');
});

/* ── S2 — no visible "Term" / "View type" labels; accessible names kept ─────── */

test('S2 SUPERSEDED by LANE-C-PLAIN-LANGUAGE-C03 (J5) — the Term and View type text labels are gone and both dropdowns keep their accessible names', async () => {
	viewportWidth = 1366;
	const header = await renderHeader(withRunContext());
	const walker = document.createTreeWalker(header, dom.window.NodeFilter.SHOW_TEXT);
	const visibleTexts: string[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || hiddenAtDesktop(parent, header)) continue;
		const text = node.textContent?.trim();
		if (text) visibleTexts.push(text);
	}
	// ── SUPERSEDED IN PLACE by LANE-C-PLAIN-LANGUAGE-C03 (J5), 2026-09-26 ──
	// The operator asked for the two highest-traffic dropdowns to be labelled in
	// plain words again, reversing this DRAFT-UX-C01 decision. The original two
	// assertions are retained VERBATIM below as the record of the decision being
	// superseded; they are not run as pass/fail. The control cap they existed to
	// protect is NOT given up — it is still enforced, by the replacement row S2R
	// below, which asserts the cap, the one-solid-primary contract, and that the
	// new labels are non-interactive text.
	//   assert.ok(!visibleTexts.includes('Term'), `no visible "Term" label (visible texts: ${visibleTexts.join(' | ')})`);
	//   assert.ok(!visibleTexts.includes('View type'), 'no visible "View type" label');
	//
	// ── J5r (QA F4): a THIRD label, `Term`, was added by the candidate without
	// this row naming it, so `!visibleTexts.includes('Term')` was superseded too.
	// Planner decision: KEEP all three labels (`Term`, `Show`, `Schedule for`).
	// The term control is exactly as high-traffic as the other two, and leaving
	// it unlabelled would preserve the defect this cycle exists to remove. The
	// purpose of this row — the ≤6 interactive-control budget and the preserved
	// accessible names — is asserted by S2R, which is what the replacement
	// protects; the absence of a label is a means, not the purpose, and it is
	// given up deliberately here.
	// Retained and STILL TRUE: the accessible names are unchanged by J5.
	assert.equal(header.querySelector('[data-testid="timetable-simple-term-filter"]')?.getAttribute('aria-label'), 'Term');
	assert.equal(header.querySelector('[data-testid="timetable-simple-view-mode-select"]')?.getAttribute('aria-label'), 'View type');
	// The supersession above is explicit, not silent: the label this row used to
	// forbid is now required, and it is a non-interactive span.
	const termLabel = header.querySelector<HTMLElement>('[data-testid="timetable-simple-term-label"]');
	assert.ok(termLabel, 'the "Term" label the superseded assertion forbade is present on purpose');
	assert.equal(termLabel.textContent?.trim(), 'Term');
	assert.equal(termLabel.tagName, 'SPAN', 'the "Term" label is non-interactive text, not a control');
	assert.ok(!visibleControls(header).includes(termLabel), 'the "Term" label does not consume a control slot');
});

/* ── S2R — LANE-C-PLAIN-LANGUAGE-C03 (J5): the cap survives, the labels land ── */

test('S2R every header dropdown keeps its accessible name AND gains a visible, non-interactive plain label; the ≤6 cap and one solid primary are unchanged', async () => {
	// ── J5r (QA F4): the PURPOSE of the superseded S2 row is the ≤6 interactive-
	// control budget (plus the preserved accessible names), NOT the absence of
	// visible labels. This row therefore names ALL THREE labelled controls —
	// `Term`, `Show` and `Schedule for` — and asserts the budget, not the silence.
	// `Term` is included because the candidate added it and S2R originally did
	// not name it, which left the supersession implicit.
	viewportWidth = 1366;
	const header = await renderHeader(withRunContext());

	// 1. The real intent of the superseded S2 row: the control budget is intact.
	const controls = visibleControls(header);
	assert.ok(controls.length <= 6, `expected ≤6 visible controls at ≥1280 px, got ${controls.length}: ${controls.map(describeControl).join(' | ')}`);
	assert.equal(controls.filter((element) => /\bbg-primary\b/.test(element.className)).length, 1, 'exactly one solid primary');

	// 2. Each dropdown has BOTH a visible plain label and its accessible name.
	const expected = [
		{ testid: 'timetable-simple-term-filter', control: '[data-testid="timetable-simple-term-filter"]', label: 'Term', labelTestid: 'timetable-simple-term-label' },
		{ testid: 'timetable-simple-view-mode-select', control: '[data-testid="timetable-simple-view-mode-select"]', label: 'Show', labelTestid: 'timetable-simple-view-mode-label' },
		// The entity picker's testid is a sizing wrapper; the control inside it is the combobox.
		{ testid: 'timetable-simple-entity-select [role="combobox"]', control: '[data-testid="timetable-simple-entity-select"] [role="combobox"]', label: 'Schedule for', labelTestid: 'timetable-simple-entity-label' },
	];
	for (const { testid, control, label, labelTestid } of expected) {
		const controlElement = header.querySelector<HTMLElement>(control);
		assert.ok(controlElement, `${testid} renders`);
		assert.ok(controls.includes(controlElement), `${testid} is still inside the control budget`);

		const visibleLabel = header.querySelector<HTMLElement>(`[data-testid="${labelTestid}"]`);
		assert.ok(visibleLabel, `${labelTestid} renders a visible label`);
		assert.equal(visibleLabel.textContent?.trim(), label, `${labelTestid} says "${label}" in plain words`);
		assert.equal(visibleLabel.tagName, 'SPAN', 'the label is non-interactive text, not a control');
		assert.ok(!hiddenAtDesktop(visibleLabel, header), `${labelTestid} is actually visible at ≥1280 px`);
		// Load-bearing: the label must not have consumed one of the six controls.
		assert.ok(!controls.includes(visibleLabel), `${labelTestid} is NOT counted as a control`);
	}

	// 3. The accessible names the superseded row already protected are unchanged.
	assert.equal(header.querySelector('[data-testid="timetable-simple-term-filter"]')?.getAttribute('aria-label'), 'Term');
	assert.equal(header.querySelector('[data-testid="timetable-simple-view-mode-select"]')?.getAttribute('aria-label'), 'View type');

	// 4. The labels are plain words, not the old engineer vocabulary.
	const headerText = header.textContent ?? '';
	assert.match(headerText, /Show/, 'the view-type label is visible text');
	assert.doesNotMatch(headerText, /View type(?!\s*$)/, 'no raw "View type" jargon is rendered as visible copy');
});

/* ── S3 — cell warnings are severity signs, not "Schedule note · N" text ─── */

test('S3 a SOFT idle-gap note renders the warning sign; a HARD violation renders the Must-fix sign', async () => {
	const { EntrySeverityIndicator } = await import('../TimetableGridConflictBadge');
	await mount(createElement('div', null,
		createElement(EntrySeverityIndicator, { severity: 'SOFT', reasons: [IDLE_GAP_SOFT.message], warnings: [IDLE_GAP_SOFT] as never }),
		createElement(EntrySeverityIndicator, { severity: 'HARD', reasons: [TEACHER_CLASH_HARD.message, IDLE_GAP_SOFT.message], warnings: [TEACHER_CLASH_HARD, IDLE_GAP_SOFT] as never }),
	));
	const [soft, hard] = Array.from(container().querySelectorAll<HTMLElement>('[data-testid="timetable-entry-severity-indicator"]'));
	assert.ok(soft && hard);
	for (const indicator of [soft, hard]) {
		assert.doesNotMatch(indicator.textContent ?? '', /Schedule note/, 'no "Schedule note ·" text in the cell');
	}
	assert.equal(soft.querySelector('svg')?.getAttribute('data-severity-icon'), 'warning');
	assert.equal(hard.querySelector('svg')?.getAttribute('data-severity-icon'), 'must-fix');
	assert.notEqual(soft.querySelector('svg')?.getAttribute('class'), hard.querySelector('svg')?.getAttribute('class'), 'distinct icons per severity');
	assert.match(soft.getAttribute('aria-label') ?? '', /^1 warning$/i, 'SOFT accessible label says "warning"');
	assert.match(hard.getAttribute('aria-label') ?? '', /Must fix/, 'HARD accessible label says "Must fix"');
	assert.equal((soft.textContent ?? '').trim(), '', 'a single note shows the sign only');
	assert.equal((hard.textContent ?? '').trim(), '2', 'N>1 shows the count beside the sign');
});

/* ── S4 — desktop session details are a centred dialog; mobile keeps the drawer ── */

async function renderSessionDetails(width: number) {
	viewportWidth = width;
	const { SimpleSessionDetails } = await import('../simple/SimpleSessionDetails');
	const calls: string[] = [];
	await mount(createElement(SimpleSessionDetails as unknown as (props: Record<string, unknown>) => ReactElement, {
		open: true,
		onOpenChange: (open: boolean) => { if (!open) calls.push('close'); },
		entry: SELECTED_ENTRY,
		subjectLabel: (id: number) => `Subject ${id}`,
		sectionLabel: (id: number) => `GR7 - Section ${id}`,
		teacherLabel: (id: number) => `Teacher ${id}`,
		roomLabel: (id: number) => `Room ${id}`,
		warnings: [IDLE_GAP_SOFT, TEACHER_CLASH_HARD],
		formatWarningMessage: (message: string) => message,
		onMoveTime: () => calls.push('move'),
		onChangeRoom: () => calls.push('room'),
		onSwap: () => calls.push('swap'),
		onChangeOwner: () => calls.push('owner'),
		onExpertDetails: () => calls.push('expert'),
	}));
	return calls;
}

test('S4 at desktop width the selected session opens a centred role="dialog", not the drawer', async () => {
	const calls = await renderSessionDetails(1366);
	const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-testid="timetable-simple-details-dialog"]');
	assert.ok(dialog, 'a centred dialog renders at desktop width');
	assert.match(dialog.className, /left-\[50%\]/);
	assert.match(dialog.className, /top-\[50%\]/);
	assert.match(dialog.className, /max-w-\[720px\]/, 'about 720 px wide at most');
	assert.match(dialog.className, /overflow-y-auto/, 'scrolls internally');
	assert.equal(document.querySelector('[data-testid="timetable-simple-details-sheet"]'), null, 'no bottom drawer at desktop width');
	const time = dialog.querySelector<HTMLElement>('[data-testid="simple-details-time"]');
	assert.ok(time);
	assert.match(time.textContent ?? '', /Tuesday/);
	assert.match(time.textContent ?? '', /09:00–10:00/);
	assert.doesNotMatch(dialog.textContent ?? '', /Section view ·/, 'the TIME card no longer shows the view name');
	const signs = Array.from(dialog.querySelectorAll('[data-testid="simple-details-warning"] svg[data-severity-icon]')).map((icon) => icon.getAttribute('data-severity-icon'));
	assert.deepEqual(signs.sort(), ['must-fix', 'warning'], 'warnings use the cell severity signs');
	const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-testid="simple-details-actions"] button')).map((button) => button.textContent?.trim());
	assert.deepEqual(buttons, ['Move time', 'Change room', 'Swap', 'Change owner', 'Expert details', 'Close'], 'one action row, each action once');
	assert.doesNotMatch(dialog.textContent ?? '', /Move time: choose a new slot/, 'the duplicate ACTIONS list is gone');
	const move = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Move time');
	await click(move!);
	assert.deepEqual(calls, ['close', 'move'], 'Move time closes the details, then runs the existing move handler (the old action order)');
});

test('S4 at mobile width the same details keep the bottom drawer', async () => {
	await renderSessionDetails(390);
	assert.ok(document.querySelector('[data-testid="timetable-simple-details-sheet"]'), 'the drawer stays below 768 px');
	assert.equal(document.querySelector('[data-testid="timetable-simple-details-dialog"]'), null);
	assert.match(document.querySelector('[data-testid="simple-details-time"]')?.textContent ?? '', /Tuesday · 09:00–10:00/);
});

/* ── S5 — unassigned sessions are reachable from the Simple layout ─────────── */

function railContext(items: ReturnType<typeof unassignedItem>[], summary: Record<string, unknown>) {
	const known: Record<string, unknown> = {
		leftTab: 'violations',
		isPreGenerationWorkspace: false,
		summary,
		filteredUnassignedItems: items,
		programKindFilteredUnassignedItems: items,
		UNASSIGNED_REASON_LABELS: { NO_AVAILABLE_SLOT: { label: 'No slot', className: '' } },
		unassignedReasonFilter: 'all',
		setUnassignedReasonFilter: () => {},
		sectionLabel: (id: number) => `GR7 - Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		buildUnassignedKey: (item: { sectionId: number; subjectId: number; session: number }) => `${item.sectionId}-${item.subjectId}-${item.session}`,
		unassignedFixSuggestions: {},
		GRADE_BADGE: {},
		followUps: new Set<string>(),
		kbSelectedSource: null,
		resolveEntryProgramType: () => null,
		resolveEntryProgramCode: () => null,
		toast: { info: () => {}, success: () => {}, error: () => {} },
	};
	return new Proxy(known, { get: (target, key: string) => (key in target ? target[key] : () => {}) });
}

function SimpleLayoutHarness({ context, rail }: { context: Record<string, unknown>; rail: Record<string, unknown> }) {
	const [task, setTask] = useState<string | null>(null);
	return createElement(MemoryRouter, null,
		createElement(HeaderRef.current as unknown as (props: Record<string, unknown>) => ReactElement, {
			context,
			layoutMode: 'simple',
			onLayoutModeChange: () => {},
			activeTask: task,
			onTaskChange: setTask,
		}),
		createElement(DrawerRef.current as unknown as (props: Record<string, unknown>) => ReactElement, {
			task,
			onTaskChange: setTask,
			leftRailContentContext: rail,
			hardCount: 0,
			softCount: 0,
			unassignedCount: (context.summary as { unassignedCount: number }).unassignedCount,
			assignedCount: 400,
			runId: 318,
			isPreGenerationWorkspace: false,
			onPublish: () => {},
		}),
	);
}
const HeaderRef: { current: unknown } = { current: null };
const DrawerRef: { current: unknown } = { current: null };

test('S5 a Term 2 unassigned session is reachable from the visible More entry and shows in the unassigned list; a Term 1 item is not counted', async () => {
	viewportWidth = 1366;
	HeaderRef.current = (await import('../TimetableSimpleHeader')).TimetableSimpleHeader;
	DrawerRef.current = (await import('../TimetableTaskDrawer')).TimetableTaskDrawer;
	const term2 = unassignedItem(2, 701, 3);
	const term1 = unassignedItem(1, 702, 1);
	const run = draft([term2, term1]);
	const context = withRunContext({ draft: run, summary: run.summary });
	// The rail context carries the hook's selected-term list (`useTimetableData`
	// already drops items whose termIndex ≠ the selected term).
	await mount(createElement(SimpleLayoutHarness, { context, rail: railContext([term2], run.summary) }));
	assert.equal(container().querySelectorAll('[role="group"][aria-label^="Unassigned session"]').length, 0, 'the list is not open yet');

	const menu = await openHeaderMore();
	const entry = menu.querySelector<HTMLElement>('[data-testid="timetable-more-unassigned-sessions"]');
	assert.ok(entry, 'More carries an "Unassigned sessions (N)" entry in the Simple layout');
	assert.match(entry.textContent ?? '', /Unassigned sessions \(1\)/, 'only the selected term (Term 2) is counted');
	assert.notEqual(entry.getAttribute('data-disabled'), '', 'the entry is enabled with a non-zero count');
	await click(entry);

	const panel = container().querySelector('#panel-unassigned');
	assert.ok(panel, 'the existing unassigned panel opens');
	const pins = Array.from(container().querySelectorAll<HTMLElement>('[role="group"][aria-label^="Unassigned session"]'));
	assert.deepEqual(pins.map((pin) => pin.getAttribute('aria-label')), ['Unassigned session 701-31-3'], 'the Term 2 item is listed as a draggable pin');
});

test('S5 with only another term\'s item the entry shows 0 and is disabled with a reason, never hidden', async () => {
	viewportWidth = 1366;
	HeaderRef.current = (await import('../TimetableSimpleHeader')).TimetableSimpleHeader;
	DrawerRef.current = (await import('../TimetableTaskDrawer')).TimetableTaskDrawer;
	const run = draft([unassignedItem(1, 702, 1)]);
	const context = withRunContext({ draft: run, summary: run.summary });
	await mount(createElement(SimpleLayoutHarness, { context, rail: railContext([], run.summary) }));
	const menu = await openHeaderMore();
	const entry = menu.querySelector<HTMLElement>('[data-testid="timetable-more-unassigned-sessions"]');
	assert.ok(entry, 'the entry stays visible with 0');
	assert.match(entry.textContent ?? '', /Unassigned sessions \(0\)/);
	assert.equal(entry.getAttribute('data-disabled'), '', 'disabled at 0');
	assert.match(entry.textContent ?? '', /No unassigned sessions in Term 2/, 'the disabled entry says why');
});

/* ── C1-a — the repair banner states the REAL affected-session count ───────── */

test('C1-a following a blocker repair states the real group count, never a hard-coded 0', async () => {
	viewportWidth = 1366;
	// Two unresolved sessions share one reason, so the readiness sheet renders ONE
	// blocker group whose `count` is 2. That is the number the banner must state.
	const run = draft([unassignedItem(2, 701, 1), unassignedItem(2, 702, 1)]);
	const context = withRunContext({
		draft: run,
		summary: run.summary,
		blockingHardCount: 0,
		hardCount: 0,
	});
	const origins: Array<Record<string, unknown>> = [];
	const header = await renderHeader(context, { onSetRepairOrigin: (origin: Record<string, unknown>) => origins.push(origin) });

	// Open the real readiness sheet through the real visible control.
	const warnings = header.querySelector<HTMLElement>('[data-testid="timetable-simple-warnings-control"]');
	assert.ok(warnings, 'the merged warnings control renders');
	await click(warnings);
	const nextAction = document.querySelector<HTMLElement>('[data-testid="timetable-simple-blocker-next-action"]');
	assert.ok(nextAction, 'the readiness sheet renders the blocker repair action');
	// The sheet itself already states the true count one click away.
	assert.match(nextAction.getAttribute('aria-label') ?? '', /2 sessions affected/, 'the sheet states the real group count');
	await click(nextAction);

	assert.equal(origins.length, 1, 'following the repair sets exactly one repair origin');
	assert.equal(origins[0].groupCount, 2, 'the origin carries the followed group\'s real count, not a hard-coded 0');
	assert.equal(origins[0].plainReason, 'No available slot', 'the rest of the banner meaning is unchanged');

	// The banner is the production surface that renders this origin.
	const { RepairContextBanner } = await import('../simple/SimpleTaskDrawerHelpers');
	await mount(createElement(RepairContextBanner, { repairOrigin: origins[0] as never }));
	const banner = container().querySelector<HTMLElement>('[data-testid="timetable-repair-context-banner"]');
	assert.ok(banner, 'the repair banner renders');
	assert.equal(banner.getAttribute('role'), 'status', 'the banner keeps its status role');
	assert.equal(banner.getAttribute('aria-label'), 'Repairing: No available slot', 'the banner keeps its accessible name');
	assert.match(banner.textContent ?? '', /2 sessions affected\./, 'the banner states the real count');
	assert.doesNotMatch(banner.textContent ?? '', /0 sessions affected/, 'the hard-coded 0 can never render');
	assert.match(banner.textContent ?? '', /ATLAS cannot test slots until this is resolved\./, 'the second sentence is kept');
});

test('C1-a an unknown count omits the affected-sessions clause entirely; 0 is unreachable', async () => {
	viewportWidth = 1366;
	const { RepairContextBanner } = await import('../simple/SimpleTaskDrawerHelpers');
	// The shared dispatcher has a second caller (`/timetable/setup`) with no
	// blocker group, so `groupCount` is genuinely absent there.
	for (const groupCount of [undefined, null]) {
		await mount(createElement(RepairContextBanner, {
			repairOrigin: { reason: 'UNKNOWN', plainReason: 'Unknown issue', groupCount } as never,
		}));
		const banner = container().querySelector<HTMLElement>('[data-testid="timetable-repair-context-banner"]');
		assert.ok(banner, 'the repair banner renders');
		assert.match(banner.textContent ?? '', /Fixing publish blockers → Unknown issue/, 'the banner still says what is being fixed');
		assert.match(banner.textContent ?? '', /ATLAS cannot test slots until this is resolved\./, 'the second sentence is kept');
		assert.doesNotMatch(banner.textContent ?? '', /session/, 'no count is printed and no zero is invented');
		assert.doesNotMatch(banner.textContent ?? '', /0\s*session/, 'a literal 0 is unreachable in rendered output');
	}
});

/* ── S1 guard — the tutorial never points at a control this change removed ── */

test('S1 every Simple tutorial step targets a control that still renders somewhere', async () => {
	const { readFileSync, readdirSync, statSync } = await import('node:fs');
	const { join, resolve } = await import('node:path');
	const { simpleTutorialSteps } = await import('../simple/SimpleHeaderHelpers');
	const srcRoot = resolve(import.meta.dirname, '../../..');
	const sources: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) { if (name !== '__tests__') walk(path); } else if (/\.tsx?$/.test(name)) sources.push(readFileSync(path, 'utf8'));
		}
	};
	walk(srcRoot);
	const corpus = sources.join('\n');
	for (const lifecycle of ['ready-no-run', 'generated-issues', 'published'] as const) {
		for (const step of simpleTutorialSteps(lifecycle)) {
			assert.ok(corpus.includes(`data-testid="${step.targetTestId}"`), `${lifecycle}: "${step.title}" targets a live control (${step.targetTestId})`);
		}
	}
	assert.equal(corpus.includes('data-testid="timetable-simple-primary-action"'), false, 'the removed lifecycle primary is not a target');
});

/* ── PL (J1) — one concept, one name, one stated relationship ──────────────
 *
 * The 2026-09-26 audit finding 3: the same HARD problem was rendered as
 * "Must fix" (grid sign), "Blocked" (grid badge), "blocker" (header chip) and
 * "Hard" (summary stat), with three different hard counts and nothing saying
 * they can legitimately differ.
 *
 * These are RENDERED-DOM rows on purpose (audit "systemic" finding: a
 * readFileSync+regex control cannot catch a wrong value or an unmounted
 * component, which is how C1's false statement survived a green suite).
 *
 * ONE EXCEPTION, stated rather than hidden (QA F10): `PL-J4.5` is a
 * readFileSync + regex row, because the property it protects is the SOURCE of
 * a JSX attribute (`variant="destructive"` next to `onRegenerate`), which no
 * rendered-DOM assertion can distinguish from a destructive button rendered
 * for any other reason. It is not vacuous — it reads the real file and its
 * three "unchanged" assertions are load-bearing — but it is not a rendered row
 * and does not claim to be. `PL-J4.5R` below renders the real banner and
 * asserts the same outcome on rendered output, so the styled claim is now
 * backed by the DOM as well.
 */

/** The grid cell's hard conflict badge — the surface that said "Blocked". */
async function renderHardCellBadge() {
	const { ConflictBadgeWithTooltip } = await import('../TimetableGridConflictBadge');
	await mount(createElement('div', null,
		createElement(ConflictBadgeWithTooltip, {
			info: {
				kind: 'hard',
				reasons: ['Teacher is double-booked at this time.'],
				displaced: [],
			} as never,
			onNavToFaculty: () => {},
			onNavToSection: () => {},
			onNavToRoom: () => {},
		}),
	));
	return container();
}

test('PL-J1.1 the grid hard badge says "Must fix", never "Blocked"', async () => {
	const host = await renderHardCellBadge();
	const text = host.textContent ?? '';
	assert.match(text, /Must fix/, 'the hard cell badge uses the one plain word');
	assert.doesNotMatch(text, /Blocked/, 'the fourth name for the same concept is gone from the grid');
	// The SR-only disclosure names the same word, so a screen reader is not told
	// a different name than the sighted one.
	assert.match(host.querySelector('.sr-only')?.textContent ?? '', /Must fix/, 'the screen-reader detail uses the same word');
});

test('PL-J1.2 the header chip says "N Must fix", never "N blockers"', async () => {
	viewportWidth = 1366;
	const header = await renderHeader(withRunContext({
		blockingHardCount: 2,
		hardCount: 5,
		softCount: 0,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 5, unassignedCount: 0 },
		draft: draft([], { hardViolationCount: 5, unassignedCount: 0 }),
	}));
	const text = header.textContent ?? '';
	assert.match(text, /2 Must fix/, 'the readiness chip uses the one plain word with the allowlist-filtered count');
	assert.doesNotMatch(text, /\d+\s+blockers?\b/, 'the "blocker" name is gone from the header chip');
});

test('PL-J1.3 the publish checklist names the one word and states WHY the two hard numbers differ', async () => {
	const { PublishChecklistContent } = await import('../simple/SimpleTaskDrawerHelpers');
	// Deliberately divergent, as the audit says they legitimately may be:
	// 2 publication-blocking, 5 serious problems in total.
	await mount(createElement(PublishChecklistContent, {
		runId: 318,
		assignedCount: 400,
		unassignedCount: 2,
		hardCount: 5,
		blockingHardCount: 2,
		softCount: 194,
		violationScopeLabel: 'Selected term only',
		violations: [],
		sectionLabel: (id: number) => `GR7 - Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		onPublish: () => {},
		onReviewIssues: () => {},
		onPlaceUnresolved: () => {},
	} as never));
	const checklist = container().querySelector<HTMLElement>('[data-testid="timetable-publish-readiness-summary"]');
	assert.ok(checklist, 'the checklist renders');

	// The numbers are unchanged: no new number is invented.
	assert.match(checklist.textContent ?? '', /Must fix \(whole year\): 2/, 'the publication-relevant count keeps its value');
	assert.match(checklist.textContent ?? '', /All serious problems \(whole year\): 5/, 'the serious-problem total keeps its value');
	// SUPERSEDED IN PLACE by J1r (QA F3/F6), 2026-09-26. The candidate wrote
	// "2 classes still to place" here. `unassignedCount` is SESSIONS — the
	// unresolved queue holds (session, term) placement obligations, and five
	// other consumers of the same field already say "session" — so the original
	// assertion is retained VERBATIM as the record of the wrong unit and is not
	// run as pass/fail. The replacement is PL-J1.3R, which renders the state
	// where BOTH lines are visible so the two units can be compared directly.
	//   assert.match(checklist.textContent ?? '', /2 classes still to place \(whole year\)/, 'unplaced classes are named in plain words');
	assert.match(checklist.textContent ?? '', /2 sessions still to place \(whole year\)/, 'the one count is named in the unit every other consumer uses');

	// The relationship is stated ONCE, in plain words, where both are visible.
	const note = container().querySelector<HTMLElement>('[data-testid="timetable-hard-count-relationship"]');
	assert.ok(note, 'the relationship is stated where more than one hard number is visible');
	const noteText = note.textContent ?? '';
	assert.match(noteText, /Must fix/, 'the note uses the one plain word');
	assert.match(noteText, /total can be higher/, 'the note says why the two numbers may differ');
	assert.match(noteText, /can still be published/, 'the note says what a zero in the first column means');

	// One concept, one name: none of the other three names appear.
	assert.doesNotMatch(checklist.textContent ?? '', /Blocking hard violations/, 'the "blocking hard violations" jargon is gone');
	assert.doesNotMatch(noteText, /blocker|Blocked|Hard violations/, 'the note introduces no competing name');
});

test('PL-J1.3R the checklist and the unplaced panel name ONE unit for the same count (sessions, never classes)', async () => {
	// J1r (QA F7). PL-J1.3 passes `blockingHardCount: 2, unassignedCount: 2`, and
	// the "Sessions still unresolved" branch is `unassignedCount > 0 &&
	// runWideBlocking === 0 && …`, so that branch was SUPPRESSED and the
	// classes/sessions contradiction was invisible to the very row that asserted
	// it. This fixture is the shape the contradiction needs: zero blocking
	// problems, so BOTH lines render and can be compared on screen.
	const { PublishChecklistContent } = await import('../simple/SimpleTaskDrawerHelpers');
	await mount(createElement(PublishChecklistContent, {
		runId: 318,
		assignedCount: 400,
		unassignedCount: 2,
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		violationScopeLabel: 'Selected term only',
		violations: [],
		sectionLabel: (id: number) => `GR7 - Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		onPublish: () => {},
		onReviewIssues: () => {},
		onPlaceUnresolved: () => {},
	} as never));
	const host = container();
	const checklist = host.querySelector<HTMLElement>('[data-testid="timetable-publish-readiness-summary"]');
	assert.ok(checklist, 'the checklist renders');

	// Load-bearing: the branch that PL-J1.3 could not reach IS rendered here.
	const panel = Array.from(host.querySelectorAll<HTMLElement>('p'))
		.find((node) => node.textContent?.includes('need placement'));
	assert.ok(panel, 'the unplaced panel renders in this fixture (PL-J1.3 suppressed it)');

	// The SAME number, in the SAME unit, in both places.
	assert.match(checklist.textContent ?? '', /2 sessions still to place \(whole year\)/, 'the checklist line names sessions');
	assert.match(panel.textContent ?? '', /2 sessions need placement before publishing\./, 'the panel line names sessions');
	// The regression itself: "classes" is not a plainer word for this count, it
	// is a different one, and it contradicted the panel three lines below.
	assert.doesNotMatch(checklist.textContent ?? '', /2 classes\b/, 'the checklist no longer calls the session count "classes"');
	assert.doesNotMatch(panel.textContent ?? '', /classes\b/, 'the unplaced panel does not call the session count "classes"');
	// And the count is genuinely the same number on both lines.
	assert.equal(panel.textContent?.match(/(\d+) sessions need placement/)?.[1], '2');
});

test('PL-J1.5 the summary stat carries the TOTAL serious problems, never the blocking "Must fix" word', async () => {
	// J1r (QA F1). The candidate labelled this stat MUST_FIX_LABEL while the
	// number it renders is `RunSummary.hardViolationCount` — the run's TOTAL.
	// The publication-blocking count is a different field
	// (`blockingHardViolationCount` -> `blockingHardCount`), so with
	// `hardViolationCount: 4, blockingHardViolationCount: 0` the viewport said
	// "Must fix: 4" and, three lines under it, "a schedule with any Must fix
	// cannot be published".
	const { ScheduleReviewWorkspaceSummaryStats } = await import('../ScheduleReviewWorkspaceSummaryStats');
	await mount(createElement(ScheduleReviewWorkspaceSummaryStats, {
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 4 },
		presence: [],
		statusColor: () => '',
		draftStatus: 'COMPLETED',
		durationMs: null,
		formatDuration: () => '—',
	} as never));
	const host = container();
	const text = host.textContent ?? '';
	// The value is untouched — only the label and the explanation moved.
	assert.match(text, /All serious problems:4/, 'the total carries the checklist\'s own plain wording, and the value is unchanged');
	// The blocking word belongs to `blockingHardCount` alone.
	assert.doesNotMatch(text, /Must fix/, 'this stat never wears the publication-blocking word');
	assert.doesNotMatch(text, /Hard Violation/, 'the old "Hard Violations" wording is gone');

	// The explanation is rendered inside the real Radix tooltip, so it is opened
	// the way a scheduler opens it (keyboard focus) rather than read from source.
	const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
		.find((button) => button.textContent?.includes('All serious problems'));
	assert.ok(trigger, 'the labelled stat is a focusable trigger');
	await act(async () => { trigger.focus(); });
	await wait(400);
	const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
	assert.ok(tooltip, 'the explanation really renders in the tooltip');
	const explanation = tooltip.textContent ?? '';
	// The component must name the idea ONE way. The old explanation said "A
	// schedule with any Hard Violations cannot be published", which is false of
	// this count and reintroduced two retired names three lines under the label.
	assert.doesNotMatch(explanation, /cannot be published/, 'the explanation no longer claims this total blocks publication');
	assert.doesNotMatch(explanation, /Hard Violation/i, 'the explanation introduces no competing name');
	assert.match(explanation, /do not stop you publishing/, 'the explanation says which of these stop publishing');
	assert.match(explanation, /“Must fix”/, 'the explanation names the blocking count by the one plain word it does not mean');
});

test('PL-J1.4 the readiness sheet uses the one word and says whose schedule decides publishing', async () => {
	const { SimplePublishReadinessSheetBody } = await import('../SimplePublishReadinessSheet');
	await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness: {
			hasGeneratedRun: true,
			isClean: false,
			runWideBlockingHard: 2,
			runWideUnassigned: 2,
			selectedTermViolationCount: 1,
			selectedTermBlockingHard: 0,
			blockerGroups: [],
			warningGroups: [],
			canPublish: false,
			unacknowledgedWarningCount: 0,
		},
		onNavigate: () => {},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));
	const scope = container().querySelector<HTMLElement>('[data-testid="timetable-simple-readiness-scope"]');
	assert.ok(scope, 'the readiness scope block renders');
	const text = scope.textContent ?? '';
	assert.match(text, /Must fix/, 'the sheet uses the one plain word');
	assert.doesNotMatch(text, /blocking hard/, 'the "blocking hard" jargon is gone from the sheet');
	assert.match(text, /The whole year/, 'the scope is stated in plain words, not "Run-wide"');
	assert.match(text, /decides whether you can publish/, 'the sheet says whose schedule decides publishing');
	// The two figures are preserved exactly.
	assert.equal(scope.querySelector('[data-testid="timetable-simple-run-wide-blocking"]')?.textContent, '2');
	assert.equal(scope.querySelector('[data-testid="timetable-simple-run-wide-unassigned"]')?.textContent, '2');
	assert.equal(scope.querySelector('[data-testid="timetable-simple-selected-term-blocking"]')?.textContent, '0');
});

/* ── J1r (QA F2/F8) — one rendered row per readiness STATE ───────────────────
 *
 * PL-J1.4 passed `isClean: false, canPublish: false, blockerGroups: []`, which is
 * exactly what disables the sheet's three state branches (`:258` clean, `:268`
 * blockers, `:286` warnings-only). The retired words "hard blockers",
 * "blocking hard" and "run-wide" live in those three branches, so PL-J1.4 was
 * green while every one of them was still on the surface. These rows render the
 * state each branch belongs to, so each of the three is a row of its own.
 */

/** One plain word per idea: no retired name may reach the Simple surface. */
function assertNoRetiredNames(text: string, where: string) {
	assert.doesNotMatch(text, /hard blocker/i, `${where}: "hard blocker" is retired`);
	assert.doesNotMatch(text, /blocking hard/i, `${where}: "blocking hard" is retired`);
	assert.doesNotMatch(text, /\brun-wide\b/i, `${where}: "run-wide" is retired`);
	assert.doesNotMatch(text, /\bblocked\b/i, `${where}: "Blocked" is retired`);
	assert.doesNotMatch(text, /unresolved classes|\bclasses still to place\b/i, `${where}: the session count is not called "classes"`);
}

type SheetReadiness = Record<string, unknown>;

async function renderReadinessSheetBody(readiness: SheetReadiness) {
	const { SimplePublishReadinessSheetBody } = await import('../SimplePublishReadinessSheet');
	await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness,
		onNavigate: () => {},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));
	return container();
}

/** A complete readiness object; each state row overrides only what it needs. */
function sheetReadiness(overrides: SheetReadiness = {}): SheetReadiness {
	return {
		totalUnresolved: 0,
		totalHardBlockers: 0,
		totalSoftWarnings: 0,
		blockerGroups: [],
		warningGroups: [],
		blockerSentence: '',
		summaryText: '',
		hasBlockers: false,
		hasWarnings: false,
		isClean: false,
		hasGeneratedRun: true,
		runWideBlockingHard: 0,
		runWideUnassigned: 0,
		runWideSoft: 0,
		selectedTermWarningCount: 0,
		selectedTermViolationCount: 0,
		selectedTermBlockingHard: 0,
		hasSelectedTermBlockers: false,
		...overrides,
	};
}

test('PL-J1.4a the CLEAN state renders the one plain word and no retired name', async () => {
	const host = await renderReadinessSheetBody(sheetReadiness({ isClean: true, totalSoftWarnings: 0 }));
	const clean = host.querySelector<HTMLElement>('[data-testid="timetable-simple-ready-to-publish"]');
	assert.ok(clean, 'the clean branch actually renders in this state');
	assertNoRetiredNames(clean.textContent ?? '', 'the clean card');
	assert.match(clean.textContent ?? '', /Ready to publish/, 'the state is named');
	// The branch that used to read "No hard blockers or unresolved sessions
	// remain run-wide" now routes both retired words through the module.
	assert.match(clean.textContent ?? '', /No “Must fix” problems and no unresolved sessions remain for the whole year\./, 'the clean sentence states the one word and the plain scope');
	assertNoRetiredNames(host.textContent ?? '', 'the whole clean sheet');
});

test('PL-J1.4b the HAS-BLOCKERS state renders the one plain word and no retired name', async () => {
	// J1r (QA F8/F7): this state is derived by the REAL resolver from a real
	// producer-shaped draft, not by a hand-written readiness object. A synthetic
	// `blockerSentence` is exactly the F7 defect again — it would let the row
	// pass on copy the production path can never emit.
	const { deriveSimplePublishReadiness } = await import('../simplePublishReadiness');
	const realRun = draft([unassignedItem(2, 701, 1), unassignedItem(2, 702, 1)], {
		hardViolationCount: 2, blockingHardViolationCount: 2, unassignedCount: 2, softViolationCount: 1,
	});
	const realReadiness = deriveSimplePublishReadiness(
		realRun as never,
		[TEACHER_CLASH_HARD as never],
		(id: number) => `GR7 - Section ${id}`,
		(id: number) => `Subject ${id}`,
		(id: number) => `Teacher ${id}`,
		{ blockingHardCount: 2, unassignedCount: 2, softCount: 1 },
	);
	assert.equal(realReadiness.hasBlockers, true, 'the fixture really is the has-blockers state');
	assert.ok(realReadiness.blockerGroups.length > 0, 'and it really has a blocker group to render');

	const host = await renderReadinessSheetBody(sheetReadiness(realReadiness as unknown as SheetReadiness));
	const group = host.querySelector<HTMLElement>('[data-testid="timetable-simple-blocker-group"]');
	assert.ok(group, 'the has-blockers branch actually renders in this state');
	// The "Fix blockers first" line is the one at issue.
	const sheet = host.querySelector<HTMLElement>('[data-testid="timetable-simple-publish-blocker-summary"]');
	assert.ok(sheet);
	const sheetText = sheet.textContent ?? '';
	assert.match(sheetText, /Fix the “Must fix” problems first\. Warnings can be reviewed once they are clear\./, 'the fix-first line states the one word');
	// ── DISCLOSED RESIDUAL, NOT SILENTLY RENAMED. The resolver's own
	// `blockerSentence` (`simplePublishReadiness.ts:642`) still says "hard
	// blockers". It is the C07B/R2 sentence-authority contract and its exact
	// wording is pinned by committed rows in `tt-warning-surface-realism-c07b`
	// (F1 (a), the F1 summaryText row, R2 (a) and the two mutant controls) that
	// this packet must not weaken, and it is outside the F2 line list. It is
	// pinned here so the residue is visible in a test rather than discovered
	// later. Everything ELSE the sheet renders — which is what F2 named — is
	// asserted clean below, with this one sentence removed.
	assert.ok(sheetText.includes(realReadiness.blockerSentence), 'the resolver sentence renders verbatim (documented residual, see the note above)');
	assertNoRetiredNames(sheetText.split(realReadiness.blockerSentence).join(' '), 'the blocked sheet apart from the disclosed resolver sentence');
	// The unplaced count is sessions here too (QA F3/F6 repeated at the sheet).
	assert.match(sheetText, /2 sessions still to place/, 'the sheet names the unplaced count in sessions');
});

test('PL-J1.4c the WARNINGS-ONLY state renders the one plain word and no retired name', async () => {
	const host = await renderReadinessSheetBody(sheetReadiness({
		hasWarnings: true,
		totalSoftWarnings: 3,
		selectedTermWarningCount: 3,
		selectedTermViolationCount: 3,
		warningGroups: [{ code: 'FACULTY_EXCESSIVE_IDLE_GAP', plainLabel: 'Long teacher idle gap', count: 3, items: [] }],
	}));
	assert.equal(host.querySelector('[data-testid="timetable-simple-blocker-group"]'), null, 'no blocker group renders in the warnings-only state');
	assert.equal(host.querySelector('[data-testid="timetable-simple-ready-to-publish"]'), null, 'the clean card does not render in the warnings-only state');
	const sheet = host.querySelector<HTMLElement>('[data-testid="timetable-simple-publish-blocker-summary"]');
	assert.ok(sheet);
	// The branch that used to read "No hard blockers remain. Review the warnings…"
	assert.match(sheet.textContent ?? '', /No “Must fix” problems remain for the whole year\. Review the warnings, then publish if the schedule is acceptable\./, 'the warnings-only sentence states the one word and the plain scope');
	assertNoRetiredNames(sheet.textContent ?? '', 'the warnings-only sheet');
});

test('PL-J1.4R the copy text the operator pastes reads in the same plain words as the sheet', async () => {
	// The three copy-summary lines are what leaves ATLAS in an email or a
	// ticket, so they are operator-facing copy and carry the same contract. They
	// are reached through the real button and the real clipboard, not by reading
	// the source.
	const written: string[] = [];
	Object.defineProperty(dom.window.navigator, 'clipboard', {
		value: { writeText: async (text: string) => { written.push(text); } },
		configurable: true,
	});
	const { SimplePublishReadinessSheetContent } = await import('../SimplePublishReadinessSheet');
	await mount(createElement(MemoryRouter, null,
		createElement(SimplePublishReadinessSheetContent as unknown as (p: Record<string, unknown>) => ReactElement, {
			draft: draft([unassignedItem(2, 701, 1), unassignedItem(2, 702, 1)], { hardViolationCount: 2, unassignedCount: 2, softViolationCount: 1 }),
			violations: [TEACHER_CLASH_HARD],
			sectionLabel: (id: number) => `GR7 - Section ${id}`,
			subjectLabel: (id: number) => `Subject ${id}`,
			facultyLabel: (id: number) => `Teacher ${id}`,
			runWide: { blockingHardCount: 2, unassignedCount: 2, softCount: 1 },
			onNavigateToRepair: () => {},
			onRequestClose: () => {},
		}),
	));
	const copy = container().querySelector<HTMLElement>('button[data-testid], button');
	assert.ok(copy);
	const copyButton = Array.from(container().querySelectorAll<HTMLButtonElement>('button'))
		.find((button) => /Copy summary/.test(button.textContent ?? ''));
	assert.ok(copyButton, 'the real Copy summary control renders');
	await click(copyButton);
	assert.equal(written.length, 1, 'copying writes exactly one report');

	const text = written[0];
	// The three retired lines, now routed through the shared vocabulary:
	//   "Gate (run-wide): 2 blocking hard, 2 unresolved"
	//   "Selected term detail: 1 shown, 0 blocking hard"
	//   "Hard blockers: 2"
	assertNoRetiredNames(text, 'the copied report');
	assert.match(text, /Gate \(Whole year\): 2 Must fix, 2 unresolved sessions/, 'the gate line states the plain scope, the one word, and the unit');
	assert.match(text, /Detail for the selected term only: 1 shown, 1 Must fix/, 'the detail line states the plain scope and the one word (the one allowlisted selected-term HARD violation)');
	assert.match(text, /Must fix in total: 2/, 'the combined line states the one word');
	// Load-bearing: the values are untouched, only the words changed.
	assert.match(text, /Warnings: 1/, 'the warning count keeps its value');
});

/* ── PL (J4) — calm the false alarms: styling and copy only, no new control ── */

async function renderReadinessChip(props: Record<string, unknown>) {
	const { SimpleReadinessChip } = await import('../simple/SimpleSetupSharedControls');
	await mount(createElement(SimpleReadinessChip as unknown as (p: Record<string, unknown>) => ReactElement, props));
	const chip = container().querySelector<HTMLElement>('[data-testid="timetable-simple-readiness-chip"]');
	assert.ok(chip, 'the readiness chip renders');
	return chip;
}

test('PL-J4.1 unplaced classes are a calm notice, not a fire: no destructive tint, no warning triangle, neutral height', async () => {
	// NOTE (J1r, QA F7): this row drives the chip component directly, so its
	// `readiness` prop is synthetic — the production `readinessLabel` returns
	// "N unresolved" for this state, not "N classes still to place". The row is
	// RETAINED unchanged because what it proves (the alarm register is gone) is
	// still true and still only provable here; the real production path, where
	// the label is derived rather than supplied, is PL-J4.1R below.
	const chip = await renderReadinessChip({ readiness: '2 classes still to place', publishBlocked: true, blockingHardCount: 0 });
	// The FACT is kept — it is still a publish blocker and still says so.
	assert.match(chip.textContent ?? '', /2 classes still to place/, 'the blocking fact is still stated in plain words');
	assert.equal(chip.getAttribute('data-readiness-state'), 'unplaced');
	// The ALARM register is gone: no destructive colour, no AlertTriangle, and
	// the chip is no longer twice the height of the neutral chip.
	assert.doesNotMatch(chip.className, /destructive/, 'no destructive tint on a routine, pre-work state');
	assert.doesNotMatch(chip.innerHTML, /lucide-alert-triangle/, 'no warning triangle on a routine, pre-work state');
	assert.match(chip.className, /\bh-6\b/, 'the chip is back to the neutral height');
	assert.doesNotMatch(chip.className, /\bh-10\b/, 'the double-height fire chip is gone');
	// One consistent, non-alarming signal.
	assert.match(chip.innerHTML, /lucide-info/, 'a neutral info sign is used instead');
});

/* ── J1r (QA F5) — a publish-BLOCKING state and a non-blocking one must not
 * look identical ────────────────────────────────────────────────────────────
 *
 * J4.1 gave the blocking chip the calm register and, in doing so, gave it the
 * SAME classes and the SAME `Info` sign as the neutral "5 warnings" chip. The
 * two differed only by label text and a `data-readiness-state` attribute nobody
 * can see, the blocking label was `readinessLabel`'s bare "3 unresolved" which
 * never says publishing is shut, and `publishBlockedReason` — the one honest
 * consequence sentence on this surface — was computed and thrown away.
 *
 * These rows render the REAL header (not the chip in isolation) so the label,
 * the predicate and the consequence sentence all come from the production
 * derivation, and they separate the two states by TEXT and by a border WEIGHT
 * that survives greyscale, never by colour or by the data attribute alone.
 */

async function renderRealReadinessChip(overrides: Record<string, unknown>) {
	viewportWidth = 1366;
	const header = await renderHeader(withRunContext(overrides));
	const chip = header.querySelector<HTMLElement>('[data-testid="timetable-simple-readiness-chip"]');
	assert.ok(chip, 'the real Simple header renders the readiness chip');
	return { header, chip };
}

test('PL-J4.1R the real blocking chip states the publish consequence, so "3 unresolved" cannot read as informational', async () => {
	const { publishBlockedSentence } = await import('../../../lib/timetable-plain-language');
	const { chip } = await renderRealReadinessChip({
		blockingHardCount: 3,
		hardCount: 7,
		softCount: 0,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 7, unassignedCount: 0 },
	});
	const text = chip.textContent ?? '';
	// The chip's own text carries the consequence, and it is the sentence the
	// shared resolver produced — not a second wording invented here.
	assert.match(text, /3 Must fix — this schedule cannot be published yet\./, 'the blocking chip states the count and the consequence');
	assert.equal(text.trim(), publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }), 'the chip renders exactly the shared resolver sentence');
	assert.doesNotMatch(text, /\d+ blocker/i, 'the consequence introduces no retired name');
	// The fact is still there, and still calm.
	assert.match(chip.className, /\bh-6\b/, 'the calm height is preserved');
	assert.doesNotMatch(chip.className, /destructive/, 'still no destructive register');
	assert.doesNotMatch(chip.innerHTML, /lucide-alert-triangle/, 'still no warning triangle');
	assert.match(chip.innerHTML, /lucide-info/, 'still the neutral info sign');
});

test('PL-J4.1S an unassigned-only block names SESSIONS on the chip, the same unit as every other surface', async () => {
	// J1r (QA F3/F6 follow-through): the unassigned count is sessions, so the
	// chip's own consequence sentence says so too.
	const { chip } = await renderRealReadinessChip({
		blockingHardCount: 0,
		hardCount: 0,
		softCount: 0,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 0, unassignedCount: 3 },
		draft: draft([unassignedItem(2, 701, 1), unassignedItem(2, 702, 1), unassignedItem(2, 703, 1)], { hardViolationCount: 0, unassignedCount: 3 }),
	});
	const text = chip.textContent ?? '';
	assert.match(text, /3 sessions still need fixing — this schedule cannot be published yet\./, 'the unplaced clause names sessions');
	assert.doesNotMatch(text, /classes/, 'the chip never calls the session count "classes"');
});

test('PL-J4.1T the blocking and the non-blocking chip are distinguishable by TEXT and by a greyscale-visible border, not by colour or the data attribute', async () => {
	const { publishBlockedSentence } = await import('../../../lib/timetable-plain-language');
	const blocked = await renderRealReadinessChip({
		blockingHardCount: 3,
		hardCount: 7,
		softCount: 0,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 7, unassignedCount: 0 },
	});
	const warned = await renderRealReadinessChip({
		blockingHardCount: 0,
		hardCount: 0,
		softCount: 5,
		summary: { assignedCount: 400, classesProcessed: 401, hardViolationCount: 0, unassignedCount: 0 },
	});
	const blockedText = (blocked.chip.textContent ?? '').trim();
	const warnedText = (warned.chip.textContent ?? '').trim();

	// (1) DISTINGUISHABLE BY TEXT ALONE. This is the assertion that fails if the
	// two states are made to render identically.
	assert.notEqual(blockedText, warnedText, 'the two states read differently');
	assert.equal(blockedText, publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }), 'the blocked chip states the consequence');
	assert.equal(warnedText, '5 warnings', 'the non-blocked chip states only its warning count');
	assert.match(blockedText, /cannot be published yet/, 'only the blocking chip says publishing is shut');
	assert.doesNotMatch(warnedText, /cannot be published|before publish/i, 'the non-blocking chip does not imply publishing is shut');
	// The plain word, too: the blocking chip is the one carrying the consequence.
	assert.match(blockedText, /Must fix/, 'the blocking chip names the problem in the one plain word');
	assert.doesNotMatch(warnedText, /Must fix/, 'the non-blocking chip does not claim a must-fix problem');

	// (2) GREYSCALE-VISIBLE STRUCTURE. A 2px border against a 1px `border` is a
	// weight difference, not a hue, so it survives a monochrome rendering; the
	// neutral chip has no 2px border at all.
	assert.match(blocked.chip.className, /\bborder-2\b/, 'the blocking chip has a heavier border than the neutral chip');
	assert.doesNotMatch(warned.chip.className, /\bborder-2\b/, 'the non-blocking chip does not share the heavier border');
	assert.doesNotMatch(blocked.chip.className, /\bborder-border\b/, 'the blocking chip is not the neutral border');
	assert.doesNotMatch(blocked.chip.className, /\bbg-muted\b/, 'the blocking chip is not the neutral field');

	// (3) THE DATA ATTRIBUTE IS NOT THE ONLY CARRIER. It is asserted for the
	// record, but the distinction above already held without reading it.
	assert.equal(blocked.chip.getAttribute('data-readiness-state'), 'unplaced');
	assert.equal(warned.chip.getAttribute('data-readiness-state'), 'outstanding');
	assert.equal(blocked.chip.getAttribute('data-publish-blocked'), 'true');
	assert.equal(warned.chip.getAttribute('data-publish-blocked'), null);
});

/**
 * The green tick is `lucide-circle-check` in the installed lucide version. The
 * lookahead makes this an exact class match, so a negative assertion here CAN
 * fail — an earlier draft of this row used `lucide-circle-check-big` and
 * therefore passed vacuously.
 */
const GREEN_TICK = /lucide-circle-check(?![\w-])/;
const INFO_SIGN = /lucide-info(?![\w-])/;

test('PL-J4.2 the chip never shows a green tick beside outstanding problems', async () => {
	// (a) the exact audited contradiction: a tick beside "5 warnings".
	const warned = await renderReadinessChip({ readiness: '5 warnings', publishBlocked: false, blockingHardCount: 0, softCount: 5 });
	assert.equal(warned.getAttribute('data-readiness-state'), 'outstanding');
	assert.doesNotMatch(warned.innerHTML, GREEN_TICK, 'no green tick beside "5 warnings"');

	// (b) the worse case: a green tick inside a destructive badge.
	const blocked = await renderReadinessChip({ readiness: '1 Must fix', publishBlocked: false, blockingHardCount: 1, softCount: 0 });
	assert.equal(blocked.getAttribute('data-readiness-state'), 'blockers');
	assert.doesNotMatch(blocked.innerHTML, GREEN_TICK, 'a destructive chip never wears a green tick');

	// (c) the tick is still earned when nothing is outstanding.
	const clear = await renderReadinessChip({ readiness: 'Ready to publish', publishBlocked: false, blockingHardCount: 0, softCount: 0 });
	assert.equal(clear.getAttribute('data-readiness-state'), 'clear');
	assert.match(clear.innerHTML, GREEN_TICK, 'the tick remains for a genuinely clear schedule');

	// (d) the negatives above are load-bearing: the info sign really is reachable
	// in this same rendering path, so (a)/(b) are not passing for a structural
	// reason (e.g. an icon that never renders at all).
	assert.match(warned.innerHTML, INFO_SIGN, 'the non-clear states do render the info sign');
	assert.doesNotMatch(clear.innerHTML, INFO_SIGN, 'the clear state does not');
});

/** A run whose recorded input comparison is STALE, from the real derivation. */
function staleRun() {
	return {
		runId: 318, status: 'COMPLETED', entries: [], unassignedItems: [], version: 3,
		createdAt: '2031-01-01T00:00:00.000Z', summary: {},
		inputState: {
			status: 'STALE' as const,
			message: 'Teaching Load changed after this run.',
			actionHint: 'Regenerate to apply.',
			changedDomains: ['teachingLoad'],
			checkedAt: '2031-01-02T00:00:00.000Z',
		},
	};
}

/** The same run, but the freshness check could not be completed. */
function unknownRun() {
	return {
		...staleRun(),
		inputState: {
			status: 'UNKNOWN' as const,
			message: 'Freshness could not be determined.',
			actionHint: 'Check school information.',
			changedDomains: [],
			checkedAt: null,
		},
	};
}

const DRIFT_BANNER_PROPS = {
	layout: 'banner',
	isPreGenerationWorkspace: false,
	loading: false,
	onRefresh: () => {},
	onRolloverStatus: null,
	capabilities: { canViewExpert: true, canGenerate: true, gates: { setupInputStatus: { allowed: false, reason: null } } },
	isPublished: false,
	activeGeneratedRunId: 318,
	showRolloverGuidance: false,
	showActions: true,
};

async function renderDriftBanner(run: Record<string, unknown>) {
	const { SimpleDriftBanner } = await import('../simple/SimpleDriftBanner');
	await mount(createElement(MemoryRouter, null,
		createElement(SimpleDriftBanner as unknown as (p: Record<string, unknown>) => ReactElement, { ...DRIFT_BANNER_PROPS, draft: run } as never),
	));
	const banner = container().querySelector<HTMLElement>('[data-testid="timetable-simple-input-drift"]');
	assert.ok(banner, 'the drift notice renders');
	return banner;
}

test('PL-J4.3 a drift we could not CHECK is not styled as a confirmed drift, and the wording says so', async () => {
	const stale = await renderDriftBanner(staleRun());
	const unknown = await renderDriftBanner(unknownRun());

	// The derivation really produced the two different confidences we are styling.
	assert.equal(stale.getAttribute('data-drift-status'), 'STALE');
	assert.equal(unknown.getAttribute('data-drift-status'), 'UNKNOWN');

	// Different confidence must not share one alarm.
	assert.match(stale.className, /amber/, 'a confirmed change keeps the amber register');
	assert.doesNotMatch(unknown.className, /amber/, '"could not be checked" is not styled as a confirmed change');
	assert.notEqual(stale.className, unknown.className, 'the two confidences are visually distinct');
	// And the wording distinguishes them too, so colour is not the only signal.
	assert.match(stale.textContent ?? '', /changed after this schedule was made/, 'STALE says the information changed');
	assert.match(unknown.textContent ?? '', /could not check the latest school information/, 'UNKNOWN says it could not be checked');
	assert.match(unknown.textContent ?? '', /nothing is known to have changed/, 'UNKNOWN says plainly that nothing is known to have changed');
});

test('PL-J4.4 the "schedule stays unchanged" reassurance is not wrapped in alarm styling', async () => {
	const unknown = await renderDriftBanner(unknownRun());
	assert.match(unknown.textContent ?? '', /The current schedule stays unchanged/, 'the reassurance is preserved verbatim');
	assert.doesNotMatch(unknown.className, /amber/, 'the register matches the message: a calm notice, not a band of alarm');
});

test('PL-J4.5 the routine rebuild is not the one destructive header button', async () => {
	// RETAINED, and it is a readFileSync + regex row — see the exception noted in
	// the PL block comment above. The rendered counterpart is PL-J4.5R.
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const source = readFileSync(resolve(import.meta.dirname, '../ScheduleReviewInputStateBanner.tsx'), 'utf8');
	assert.doesNotMatch(source, /variant="destructive"[^>]*onRegenerate/, 'Regenerate Draft no longer wears the destructive variant');
	// The action itself is unchanged: same handler, same label, same disabled rule.
	assert.match(source, /onClick=\{onRegenerate\}/, 'the rebuild action is unchanged');
	assert.match(source, /Regenerate Draft/, 'the rebuild label is unchanged');
	assert.match(source, /disabled=\{!generationEnabled \|\| loading\}/, 'the rebuild disabled rule is unchanged');
});

test('PL-J4.5R the rendered banner gives the routine rebuild the neutral variant and keeps every other action', async () => {
	// J1r (QA F10): the rendered counterpart of the source row above. It asserts
	// the OUTCOME on the mounted component — the Rebuild button is not the
	// destructive variant — so the styled claim is no longer carried by a regex
	// alone. A substring test for "destructive" is useless here (every button
	// carries `aria-invalid:*destructive*` base classes), so the control is the
	// destructive variant's OWN tokens, rendered in this same test so the
	// assertion cannot pass for want of a reachable token.
	const { ScheduleReviewInputStateBanner } = await import('../ScheduleReviewInputStateBanner');
	const { Button } = await import('../../../ui/button');
	await mount(createElement('div', null,
		createElement(ScheduleReviewInputStateBanner, {
			inputState: staleRun().inputState,
			changedDomainLabels: ['Teaching Load'],
			loading: false,
			syncing: false,
			hasSelectedEntry: true,
			generationEnabled: true,
			onPreviewImpact: () => {},
			onSync: () => {},
			onManualRepair: () => {},
			onRegenerate: () => {},
		} as never),
		createElement(Button, { variant: 'destructive' }, 'destructive reference'),
	));
	const tokensOf = (element: Element) => new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
	const buttons = Array.from(container().querySelectorAll<HTMLButtonElement>('button'));
	const rebuild = buttons.find((button) => button.textContent?.includes('Regenerate Draft'));
	assert.ok(rebuild, 'the rebuild control renders');
	const reference = buttons.find((button) => button.textContent === 'destructive reference');
	assert.ok(reference, 'a destructive button is rendered in this same DOM');

	const DESTRUCTIVE_TOKENS = ['bg-destructive/10', 'text-destructive'];
	const rebuildTokens = tokensOf(rebuild);
	const referenceTokens = tokensOf(reference);
	for (const token of DESTRUCTIVE_TOKENS) {
		assert.ok(referenceTokens.has(token), `control: the destructive variant really does apply ${token}`);
		assert.ok(!rebuildTokens.has(token), `the rebuild button does not carry the destructive token ${token}`);
	}
	assert.equal(rebuild.disabled, false, 'the rebuild is enabled in this state');
	// The other three actions are unchanged, so the routine rebuild really is
	// the only button that lost its alarm register — not all of them.
	const labels = buttons
		.filter((button) => !button.textContent?.includes('destructive reference'))
		.map((button) => button.textContent?.replace(/\s+/g, ' ').trim());
	assert.deepEqual(labels, ['Preview Impact', 'Sync with Setup', 'Manually Repair', 'Regenerate Draft'], 'all four banner actions still render, once each');
});
