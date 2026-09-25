/**
 * LANE-C C2 — the generation dead end (audit finding 1, BLOCKING).
 *
 * `docs/reviews/timetable-ux-audit-20260926/audit.md` finding 1: "a scheduler
 * who hits a blocked generation can never start". The header operator sentence
 * said "Review the item shown" and showed no item, and `diagnostic.blockers[]`
 * was never rendered anywhere in the client. The systemic note in the same
 * audit explains why it survived a fully green suite: "no fixture with
 * `curriculumReadiness.state === 'blocked'`" existed — every DOM fixture
 * hard-coded `{ state: 'ready', blockers: [] }`.
 *
 * This file is that missing fixture. Every fixture in the existing DOM suites
 * (draft-ux-c01, timetable-header-collapse-c01, timetable-relaxed-main-c01,
 * ux-audit-findings-c01, ux-audit-findings-c01-dom) hard-codes the ready
 * state; this one builds a real blocked state through the production adapter
 * `deriveGenerationReadinessState`, so the repair on every row is the exact
 * production repair and not a hand-written stub.
 *
 * Production path: the real `TimetableSimpleHeader` and the real
 * `TimetableSetupPane` in jsdom, reading the rendered DOM. Layout is not
 * measured — "visible at ≥1280 px" means "not hidden by a class that applies at
 * ≥1280 px", the same definition `draft-ux-c01` uses for the cap row.
 *
 * Run: `npm run test:generation-blockers-c02` (also named in
 * `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, mock, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable/setup' });
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
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
const { deriveGenerationReadinessState, presentGenerationBlockers } = await import('../../../lib/timetable-generation-readiness');
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

async function click(element: HTMLElement) {
	await act(async () => { element.click(); });
	await flush();
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	mock.restoreAll();
	dom.window.close();
});

// `src/components/timetable/__tests__` -> the client root is four levels up.
const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/** The routes `App.tsx` actually mounts. A repair href must be one of these. */
function mountedRoutes(): Set<string> {
	return new Set(
		Array.from(source('src/App.tsx').matchAll(/path:\s*'([^']+)'/g)).map((m) => `/${m[1].replace(/^\//, '')}`),
	);
}

/* ------------------------------------------------------------------ *
 * Fixtures — a real blocked state through the production adapter
 * ------------------------------------------------------------------ */

/** Engine text that is deliberately full of the tokens the operator must never
 * see: a code, a term identity, a subject code, and a raw entity string. */
function engineBlocker(overrides: Record<string, unknown>) {
	return {
		category: 'DEMAND_AUTHORITY',
		termIdentity: 'TERM_2030_1',
		sectionId: 701,
		subjectId: 31,
		subjectCode: 'TLE-7',
		entity: 'Section 7-A TLE-7',
		reason: 'OWNERSHIP_MISSING blocks generation.',
		owningSurface: 'Teaching Load',
		nextAction: 'Assign a qualified teacher, then re-run generation readiness.',
		...overrides,
	};
}

/**
 * THREE blockers spanning THREE repair kinds and THREE categories — the case
 * the audit said had no coverage at all:
 * - `OWNERSHIP_MISSING` / DEMAND_AUTHORITY -> navigate `/teaching-load`
 * - `ROOM_CAPACITY_INFEASIBLE` / RESOURCE_INFEASIBLE -> navigate `/map`
 * - `SEARCH_LIMIT_UNRESOLVED` / ALGORITHM_LIMIT -> retry in place
 * `blockers[0]` is deliberately NOT the algorithm one, so a test that only
 * looked at the first blocker would miss two rows and the retry action.
 */
function blockedReadiness() {
	return deriveGenerationReadinessState(
		{
			scope: { schoolId: 1, schoolYearId: 9 },
			status: 'BLOCKED',
			generateAllowed: false,
			schedulerExecuted: true,
			derivedDemandRevision: 'REV-BLOCKED',
			termStructure: {
				format: 'TRIMESTER',
				terms: [
					{ identity: 'TERM_2030_1', order: 1 },
					{ identity: 'TERM_2030_2', order: 2 },
				],
			},
			totals: { lines: 12, pairs: 4, sessionsByTerm: { TERM_2030_1: 12 } },
			teachingLoadCoverage: null,
			blockers: [
				engineBlocker({ code: 'OWNERSHIP_MISSING', sectionId: 701, termIdentity: 'TERM_2030_1' }),
				engineBlocker({ code: 'ROOM_CAPACITY_INFEASIBLE', category: 'RESOURCE_INFEASIBLE', sectionId: 702, subjectId: null, termIdentity: 'TERM_2030_2' }),
				engineBlocker({ code: 'SEARCH_LIMIT_UNRESOLVED', category: 'ALGORITHM_LIMIT', sectionId: 703, subjectId: null, termIdentity: 'TERM_2030_2' }),
			],
			zeroWrite: true,
		},
		{ schoolId: 1, schoolYearId: 9 },
	);
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

async function renderHeader(context: Record<string, unknown>) {
	const { TimetableSimpleHeader } = await import('../TimetableSimpleHeader');
	await mount(createElement(MemoryRouter, null,
		createElement(TimetableSimpleHeader as unknown as (props: Record<string, unknown>) => ReactElement, {
			context,
			layoutMode: 'simple',
			onLayoutModeChange: () => {},
			activeTask: null,
			onTaskChange: () => {},
		}),
	));
	const header = container().querySelector<HTMLElement>('[data-testid="timetable-simple-header"]');
	assert.ok(header, 'the Simple header renders');
	return header;
}

/* The cap definition, identical to draft-ux-c01's accepted row. */
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

/* ------------------------------------------------------------------ *
 * C2-a row 1 — the operator sentence
 * ------------------------------------------------------------------ */

test('C2-a.1 the operator sentence states the consequence, the real count, and promises no unshown item', async () => {
	viewportWidth = 1366;
	const header = await renderHeader(headerContext({ curriculumReadiness: blockedReadiness() }));
	const message = header.querySelector<HTMLElement>('[data-testid="timetable-curriculum-readiness-message"]');
	assert.ok(message, 'the operator readiness sentence renders');
	const text = message.textContent ?? '';
	// The same contract the pre-existing failing-first control
	// (timetable-dynamic-workspace-rendered.test.ts) pins.
	assert.match(text, /Setup needs attention before ATLAS can generate a timetable\./);
	// The real count of the real list, not a round one.
	assert.match(text, /3 setup items must be fixed first/);
	// The defect: it promised to show an item it never showed.
	assert.doesNotMatch(text, /Review the item shown/i);
	assert.doesNotMatch(text, /the item shown/i);
	// And it must point at a real list rather than a publication panel.
	assert.match(text, /readiness chip below lists each one/);
});

test('C2-a.2 no engine code, term identity or subject code reaches the operator sentence', async () => {
	const header = await renderHeader(headerContext({ curriculumReadiness: blockedReadiness() }));
	const message = header.querySelector<HTMLElement>('[data-testid="timetable-curriculum-readiness-message"]');
	assert.ok(message);
	const text = message.textContent ?? '';
	for (const leaked of ['OWNERSHIP_MISSING', 'ROOM_CAPACITY_INFEASIBLE', 'SEARCH_LIMIT_UNRESOLVED', 'TERM_2030_1', 'TERM_2030_2', 'TLE-7', 'DEMAND_AUTHORITY', 'ALGORITHM_LIMIT', 'RESOURCE_INFEASIBLE']) {
		assert.doesNotMatch(text, new RegExp(leaked), `${leaked} must not reach the operator sentence`);
	}
});

test('C2-a.3 the raw diagnostic stays available behind Technical detail for support', () => {
	// C2-a.4 of the packet: support detail may exist; it must simply not be the
	// only place the information lived. The tooltip keeps the engine sentence.
	const headerSource = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(headerSource, /Technical detail/, 'the support tooltip is retained');
	assert.match(headerSource, /setupBlockedDiagnostic/, 'the raw diagnostic still backs the tooltip');
});

/* ------------------------------------------------------------------ *
 * C2-a row 2/4 — every blocker, in plain words, with a real repair
 * ------------------------------------------------------------------ */

test('C2-a.4 the disclosure lists ALL THREE blockers in plain words, not just blockers[0]', async () => {
	const { SimpleGenerationBlockerSheetBody } = await import('../simple/SimpleGenerationBlockerSheet');
	const readiness = blockedReadiness();
	assert.equal(readiness.state, 'blocked');
	const rows = presentGenerationBlockers({
		diagnostic: readiness.diagnostic,
		labelForSection: (id: number) => `GR7 - Section ${id}`,
		labelForSubject: (id: number) => `Subject ${id}`,
	});
	assert.equal(rows.length, 3, 'every blocker is presented, not only the first');
	for (const row of rows) {
		assert.ok(row.sentence.length > 0, 'each row carries a sentence');
		assert.doesNotMatch(row.sentence, /_[A-Z]/, `no snake_case engine token in: ${row.sentence}`);
	}
	// The three categories produce three distinguishable plain sentences.
	assert.equal(new Set(rows.map((row) => row.sentence)).size, 3, 'each row reads differently');
	// The term clause comes from the ordered term POSITION, never the identity.
	assert.ok(rows[0].sentence.includes('Term 1'), rows[0].sentence);
	assert.ok(rows[1].sentence.includes('Term 2'), rows[1].sentence);

	await mount(createElement(MemoryRouter, null,
		createElement(SimpleGenerationBlockerSheetBody, {
			rows,
			onRetry: () => {},
			onRequestClose: () => {},
		}),
	));
	const items = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-item"]'));
	assert.equal(items.length, 3, 'all three blockers render as their own row');
	const rendered = document.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-list"]')?.textContent ?? '';
	for (const leaked of ['OWNERSHIP_MISSING', 'ROOM_CAPACITY_INFEASIBLE', 'SEARCH_LIMIT_UNRESOLVED', 'TERM_2030_1', 'TLE-7', 'Section 7-A TLE-7']) {
		assert.doesNotMatch(rendered, new RegExp(leaked), `${leaked} must not reach the blocker list`);
	}
});

test('C2-a.5 a retry blocker really retries, and a navigate blocker targets a real mounted route', async () => {
	const { SimpleGenerationBlockerSheetBody } = await import('../simple/SimpleGenerationBlockerSheet');
	const readiness = blockedReadiness();
	if (readiness.state !== 'blocked') throw new Error('fixture must be blocked');
	const rows = presentGenerationBlockers({
		diagnostic: readiness.diagnostic,
		labelForSection: (id: number) => `GR7 - Section ${id}`,
	});
	const routes = mountedRoutes();
	let retries = 0;
	await mount(createElement(MemoryRouter, null,
		createElement(SimpleGenerationBlockerSheetBody, {
			rows,
			onRetry: () => { retries += 1; },
			onRequestClose: () => {},
		}),
	));
	const retries0 = document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-retry"]');
	assert.equal(retries0.length, 1, 'exactly the ALGORITHM_LIMIT blocker offers an in-place retry');
	await click(retries0[0]);
	assert.equal(retries, 1, 'the retry control re-ran the readiness check — never a no-op');

	// Every navigate row is a real link to a mounted route.
	const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-testid="timetable-generation-blocker-navigate"]'));
	assert.equal(links.length, 2, 'the two non-retry blockers navigate');
	const hrefs = links.map((link) => new URL(link.getAttribute('href') ?? '', 'http://localhost').pathname).sort();
	assert.deepEqual(hrefs, ['/map', '/teaching-load']);
	for (const href of hrefs) {
		assert.ok(routes.has(href), `${href} must be a mounted route`);
	}
	// The repair kind matches the shared resolver, one per blocker.
	assert.deepEqual(rows.map((row) => row.repair.kind), ['navigate', 'navigate', 'retry']);
});

test('C2-a.6 a blocked check that reported NO blockers never claims to show items', async () => {
	// zeroWrite unproven, no blockers: the honest sentence must not promise a list.
	const { generationBlockedOperatorSentence } = await import('../../../lib/timetable-generation-readiness');
	const sentence = generationBlockedOperatorSentence({ blockerCount: 0, setupLabel: 'Setup needs attention' });
	assert.doesNotMatch(sentence, /setup item/, 'no list is promised when there is none');
	assert.match(sentence, /Retry the check/, 'the real next step is a retry');
});

/* ------------------------------------------------------------------ *
 * C2-a row 5 — the accepted cap still holds in the blocked state
 * ------------------------------------------------------------------ */

test('C2-a.7 the blocked state keeps the ≤6 visible-control cap and exactly one solid primary', async () => {
	viewportWidth = 1366;
	const ready = await renderHeader(headerContext());
	const readyControls = visibleControls(ready);
	const readySolid = readyControls.filter((element) => /\bbg-primary\b/.test(element.className)).length;

	const blocked = await renderHeader(headerContext({ curriculumReadiness: blockedReadiness() }));
	const controls = visibleControls(blocked);
	assert.ok(
		controls.length <= 6,
		`expected ≤6 visible controls while generation is blocked, got ${controls.length}: ${controls.map(describeControl).join(' | ')}`,
	);
	assert.equal(controls.length, readyControls.length, 'the blocker list adds NO header control');
	assert.equal(controls.filter((element) => /\bbg-primary\b/.test(element.className)).length, 1, 'exactly one solid primary');
	assert.equal(readySolid, 1, 'the ready state is the one-solid-primary baseline');
	// Generate is still the one visible primary, and still cannot dispatch.
	const generate = blocked.querySelector<HTMLElement>('[data-testid="timetable-simple-generate-action"]');
	assert.ok(generate && controls.includes(generate), 'Generate is the visible primary while blocked');
	assert.match(generate.className, /\bbg-primary\b/);
	assert.equal(generate.getAttribute('disabled'), '', 'Generate is disabled while generation is blocked');
});

test('C2-a.8 the entry point is the EXISTING merged warnings control, now enabled and honest', async () => {
	const header = await renderHeader(headerContext({ curriculumReadiness: blockedReadiness() }));
	const chip = header.querySelector<HTMLElement>('[data-testid="timetable-simple-warnings-control"]');
	assert.ok(chip, 'the merged warnings control renders');
	assert.equal(chip.getAttribute('data-warnings-dispatch'), 'generation-blockers');
	assert.equal(chip.getAttribute('disabled'), null, 'the control that was dead in this state is now a way in');
	assert.match(chip.getAttribute('aria-label') ?? '', /See what to fix/);
	// No no-op: clicking it opens the real sheet.
	await click(chip);
	const sheet = document.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-list"]');
	assert.ok(sheet, 'clicking the control reaches the real blocker list');
	assert.equal(document.querySelectorAll('[data-testid="timetable-generation-blocker-item"]').length, 3);
	// The blocker rows live in a portal, outside the header element.
	assert.equal(header.querySelectorAll('[data-testid="timetable-generation-blocker-item"]').length, 0, 'rows are not header chrome');
});

/* ------------------------------------------------------------------ *
 * C2-b — /timetable/setup must reach generation blockers
 * ------------------------------------------------------------------ */

test('C2-b.1 the setup pane readiness entry reaches the generation blockers, not the publication sheet', async () => {
	viewportWidth = 1366;
	const { TimetableSetupPane, simpleSetupGuidance } = await import('../TimetableSetupPane');
	const inputs = {
		schoolId: 1,
		schoolYearId: 9,
		activeGeneratedRunId: null,
		onStartRevision: () => {},
		draft: null,
		isPreGenerationWorkspace: false,
		loading: false,
		generating: false,
		onRefresh: () => {},
		onRefreshSetupNames: () => {},
		curriculumReadiness: blockedReadiness(),
		hasSelectedEntry: false,
		requestPendingCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
		violations: [],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
		latestRunStatus: null,
		setLeftTab: () => {},
		setPresentationMode: () => {},
		setUnassignedReasonFilter: () => {},
		setSelectedViolation: () => {},
		setSeverityFilter: () => {},
	};
	await mount(createElement(MemoryRouter, null,
		createElement(TimetableSetupPane as unknown as (props: Record<string, unknown>) => ReactElement, {
			inputs,
			sectionLabel: (id: number) => `GR7 - Section ${id}`,
			subjectLabel: (id: number) => `Subject ${id}`,
			facultyLabel: (id: number) => `Teacher ${id}`,
			onStartSimpleTask: () => {},
			onSetRepairOrigin: null,
		}),
	));
	const entry = container().querySelector<HTMLElement>('[data-testid="timetable-setup-review-readiness"]');
	assert.ok(entry, 'the readiness entry renders');
	assert.equal(entry.getAttribute('data-readiness-target'), 'generation-blockers');
	assert.match(entry.textContent ?? '', /See what to fix/);
	// The guidance names the real thing.
	const guidance = container().querySelector<HTMLElement>('[data-testid="timetable-setup-guidance"]');
	assert.match(guidance?.textContent ?? '', /cannot make a timetable yet/);
	assert.doesNotMatch(guidance?.textContent ?? '', /Review readiness/);

	await click(entry);
	// It lands on the GENERATION blockers...
	assert.ok(document.querySelector('[data-testid="timetable-generation-blocker-list"]'), 'the generation blocker list opens');
	assert.equal(document.querySelectorAll('[data-testid="timetable-generation-blocker-item"]').length, 3);
	// ...and NOT on the publication sheet, which answers "No timetable generated yet".
	assert.equal(document.querySelector('[data-testid="timetable-simple-publish-readiness-sheet"]'), null, 'the publication sheet did not open');
	// The published-copy defect, closed.
	assert.doesNotMatch(simpleSetupGuidance({ state: 'blocked' }) ?? '', /Review readiness/);
});

test('C2-b.1a the setup guidance is honest in BOTH blocked sub-cases', async () => {
	const { simpleSetupGuidance } = await import('../TimetableSetupPane');
	// A real list exists: the copy names the real count and the real entry.
	const withList = simpleSetupGuidance({ state: 'blocked' }, 3);
	assert.match(withList, /each of the 3 setup items/);
	assert.match(withList, /See what to fix/);
	// No list exists (the check itself did not finish): it must not point at one.
	const withoutList = simpleSetupGuidance({ state: 'blocked' }, 0);
	assert.doesNotMatch(withoutList, /See what to fix/, 'never point at a list that does not exist');
	assert.match(withoutList, /no list to show/);
	assert.match(withoutList, /Retry the schedule check/);
	// The other branches stay honest and unchanged in meaning.
	assert.match(simpleSetupGuidance({ state: 'loading' }) ?? '', /Nothing is changed by this check/);
	assert.match(simpleSetupGuidance({ state: 'failed' }) ?? '', /generation stays unavailable/);
	assert.match(simpleSetupGuidance({ state: 'unavailable' }) ?? '', /generation stays unavailable/);
	assert.match(simpleSetupGuidance({ state: 'ready' }) ?? '', /checked the schedule information/);
});

test('C2-b.2 the setup pane keeps the publication readiness entry when generation is not blocked', async () => {
	viewportWidth = 1366;
	const { TimetableSetupPane } = await import('../TimetableSetupPane');
	await mount(createElement(MemoryRouter, null,
		createElement(TimetableSetupPane as unknown as (props: Record<string, unknown>) => ReactElement, {
			inputs: {
				schoolId: 1,
				schoolYearId: 9,
				activeGeneratedRunId: null,
				onStartRevision: () => {},
				draft: null,
				isPreGenerationWorkspace: false,
				loading: false,
				generating: false,
				onRefresh: () => {},
				onRefreshSetupNames: () => {},
				curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
				hasSelectedEntry: false,
				requestPendingCount: 0,
				blockingHardCount: 0,
				softCount: 0,
				summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
				violations: [],
				schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
				latestRunStatus: null,
				setLeftTab: () => {},
				setPresentationMode: () => {},
				setUnassignedReasonFilter: () => {},
				setSelectedViolation: () => {},
				setSeverityFilter: () => {},
			},
			sectionLabel: (id: number) => `GR7 - Section ${id}`,
			subjectLabel: (id: number) => `Subject ${id}`,
			facultyLabel: (id: number) => `Teacher ${id}`,
			onStartSimpleTask: () => {},
			onSetRepairOrigin: null,
		}),
	));
	const entry = container().querySelector<HTMLElement>('[data-testid="timetable-setup-review-readiness"]');
	assert.ok(entry);
	assert.equal(entry.getAttribute('data-readiness-target'), 'publish-readiness');
	assert.match(entry.textContent ?? '', /Review readiness/);
	await click(entry);
	assert.ok(document.querySelector('[data-testid="timetable-simple-publish-readiness-sheet"]'), 'the publication sheet still opens when it is the right answer');
	assert.equal(document.querySelector('[data-testid="timetable-generation-blocker-list"]'), null);
});
