/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the `/timetable` Simple header at the
 * AGENTS.md §8 "Header budget", asserted on the REAL rendered component in BOTH
 * year states.
 *
 * ── THE OPERATOR'S WORDS, WHICH ARE THE SPECIFICATION ─────────────────────────
 * On live `/timetable` (active year 2022-2023) the header "has regressed … messy
 * … we need a less is more approach and relaxed view so users don't get
 * overwhelmed". Lane C read off the screenshot: a helper sentence under
 * `Edit draft` / `Discard draft`; `Term: Viewi…` and `school is i…` truncated; the
 * 468-items sentence truncated; `No schedule yet` AND `No 2022-2023 timetable yet`
 * both shown; disabled Undo/Redo/History on a year with no schedule. The named fix:
 * row 1 = title, tabs, ONE status chip, Generate, More; row 2 = Term, Show,
 * Schedule for.
 *
 * ── WHAT THIS FILE IS, AND WHAT IT IS NOT ────────────────────────────────────
 * Every row RENDERS the real `TimetableSimpleHeader` and reads real output. NO row
 * asserts source text about the change: a test that only greps a file is not
 * acceptance evidence for a user-facing change ("Done means seen"). H9 is the one
 * exception and is labelled IN ITS OWN NAME as a range-scope source row, because
 * its subject is "a file did not change", which no render can decide.
 *
 * H1 IS A **STRUCTURAL** ROW, NOT A PIXEL ROW, AND IT SAYS SO IN ITS OWN NAME.
 * JSDOM HAS NO LAYOUT ENGINE: it cannot set a 1366×768 viewport, cannot lay out a
 * flex row, and therefore cannot count the text bands a scheduler SEES or measure
 * their height. Exactly as `SimpleHeaderTrailingSurfaces.tsx` records, what is
 * decided here is the DOM SHAPE the band count follows from. The true 1366×768
 * PIXEL count is a BROWSER row (AGENTS.md §11/§12) owned by Lane C on A4's
 * staging, and it is not claimed here.
 *
 * ── WHY THE SUITE RENDERS THE WAY IT DOES (the memory record) ────────────────
 * The first cut of this file mounted the header through a JSDOM `createRoot` for
 * every row and died: `exitCode: -1` with no message after ~24 s, which is the
 * heap-exhaustion signature recorded in `a2-c12-header-two-rows.test.tsx` ("two
 * CONCURRENT live mounts of this component are enough to OOM … a 461 MB heap,
 * `FATAL ERROR: Committing semi space failed`") and the signature that took this
 * lane down once before, when Lane C killed a 15.3 GB run on 2026-09-29.
 *
 * So the harness is split by what each row actually needs:
 *   - EVERY row EXCEPT H4 and H8 uses `renderToStaticMarkup` from
 *     `react-dom/server`. Those rows are structural — "how many bands does the
 *     header have", "is there an ellipsis", "what is the chip's text" — and static
 *     markup answers all of them with NO client tree, NO effects, NO retained
 *     nodes, and therefore nothing that can accumulate. It is also an order of
 *     magnitude faster.
 *   - H4 and H8 genuinely need a REAL CLICK on a real control (the packet requires
 *     driving the production control, not a test-local handler), so they are the
 *     only two rows that mount a client root, and `afterEach` unmounts the root
 *     AND removes its container AND drops every portalled sibling Radix left on
 *     the shared `document.body`.
 *
 * `globalThis.fetch` is stubbed once. The header's rollover-status effect calls
 * `fetchRolloverStatus(context.schoolId)` on mount; with no stub it rejects, and a
 * rejection that races the teardown is a classic source of a non-deterministic
 * crash. The stub settles it deterministically instead.
 *
 * ── WHY EVERY IMPORT BELOW RESOLVES ON THE BASE COMMIT ───────────────────────
 * A failing-first row is only evidence if it fails BEHAVIOURALLY. An
 * `ERR_MODULE_NOT_FOUND`, or a test importing a module this change has not created
 * yet, is a FALSE failing-first — the defect that burned this lane before. So this
 * file imports ONLY modules that exist at the base `ce1257c8`, and reads the NEW
 * shared picker constant through a NAMESPACE import of an existing module
 * (`@/ui/select`). On the base that import succeeds and the constant is
 * `undefined`, so H7 fails on a real assertion about a real requirement, not on a
 * missing module.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// Radix's dismissable layer calls these on every pointer event; JSDOM implements
// none of them. Identical to the stubs in the C12/C11 header suites, so the real
// More menu and the real blocker sheet are opened through the production path.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

/* ONE stub, set up BEFORE any mount, so the header's rollover-status effect can
 * never race the teardown with a real network call or an unhandled rejection. */
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
const { TimetableUndoRedoControl } = await import('@/components/timetable/TimetableUndoRedoControl');
/* NAMESPACE import on purpose — see the file header. `@/ui/select` exists at the
 * base; only the exported constant is new, so H7 fails on an assertion, never on a
 * module resolution. */
const uiSelect = await import('@/ui/select') as { SELECT_TRIGGER_PICKER_CLASS?: string };
const SHARED_PICKER_CLASS = uiSelect.SELECT_TRIGGER_PICKER_CLASS;

/* ── TEARDOWN FOR THE TWO CLICK ROWS ONLY ─────────────────────────────────────
 * The client root, its container, and every portalled sibling are released after
 * each row, because `document.body` is shared by every row in this process and a
 * Radix `SheetContent`/`DropdownMenuContent` left attached is both a leak and a
 * way for one row's assertion to read another row's node. */
let mountedRoot: { unmount: () => void } | null = null;
let mountedHost: HTMLElement | null = null;
afterEach(() => {
	if (mountedRoot) { act(() => mountedRoot!.unmount()); mountedRoot = null; }
	if (mountedHost) { mountedHost.remove(); mountedHost = null; }
	for (const stray of [...dom.window.document.body.children]) stray.remove();
});

// ═══ RENDER HELPERS ══════════════════════════════════════════════════════════

/** STATIC render — the default for every structural row. No client tree, no
 * effects, no retained nodes. */
function headerMarkup(context: Record<string, unknown>, undoRedoControl: unknown): string {
	return renderToStaticMarkup(createElement(
		MemoryRouter as never,
		{ initialEntries: ['/timetable'] },
		createElement(TimetableSimpleHeader as never, headerProps(context, undoRedoControl) as never),
	));
}

/** Parse static markup into a detached tree for structural queries. The container
 * is never attached to `document.body`, so nothing here can leak into another row
 * even if an assertion throws. */
function headerTree(markup: string): HTMLElement {
	const host = dom.window.document.createElement('div');
	host.innerHTML = markup;
	return host;
}

/** CLIENT render — ONLY for the two rows that need a real click. */
function mountHeader(context: Record<string, unknown>, undoRedoControl: unknown) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	mountedHost = host;
	const root = createRoot(host);
	mountedRoot = root;
	act(() => { root.render(createElement(MemoryRouter as never, { initialEntries: ['/timetable'] }, createElement(TimetableSimpleHeader as never, headerProps(context, undoRedoControl) as never))); });
	return {
		host,
		/** Scoped to this row's host, so a portal from another row can never satisfy
		 * an assertion in this one. */
		el: (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null,
		/** Document-wide, for the surfaces that are PORTALLED on purpose (the
		 * blocker sheet, the More menu) and so are not inside the host. */
		doc: (id: string) => dom.window.document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null,
		click: async (id: string) => {
			const el = dom.window.document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
			assert.ok(el, `control ${id} is rendered, so it can be clicked`);
			act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
			await settle();
		},
		/** Radix `DropdownMenu` opens on POINTERDOWN, not on `click`, so a plain click
		 * silently does nothing and the menu assertions would pass vacuously. This is
		 * the same production-path idiom as `a2-c12-header-rows2.test.tsx`'s
		 * `openMenu`. */
		openMenu: async (id: string) => {
			const trigger = dom.window.document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
			assert.ok(trigger, `trigger ${id} is rendered, so the menu can be opened`);
			act(() => { trigger!.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
			await settle();
			return dom.window.document.querySelector('[role="menu"]') as HTMLElement | null;
		},
	};
}

/** Radix's dismissable/presence layers settle over several microtask ticks, which
 * is the recorded reason the committed suites flush five times after an
 * interaction. */
async function settle(): Promise<void> {
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
	}
}

function headerProps(context: Record<string, unknown>, undoRedoControl: unknown) {
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
		undoRedoControl,
		onDiscardDraft: () => {},
	};
}

/** What the operator can SEE, as opposed to `textContent`, which also carries
 * `sr-only` text. JSDOM has no layout, so this is the closest honest reading of
 * "what this element shows". */
function visibleText(host: Element): string {
	const clone = host.cloneNode(true) as HTMLElement;
	for (const hidden of [...clone.querySelectorAll('.sr-only, [aria-hidden="true"]')]) hidden.remove();
	return clone.textContent ?? '';
}

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const RUN_FINISHED_AT = '2026-09-28T08:00:00.000Z';

/** STATE A — the operator's live year: NO schedule. `draft` is `null`, so there is
 * no run on screen at all. This is the state that printed BOTH "No 2022-2023
 * timetable yet" AND "No schedule yet". */
function stateAContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return baseContext({
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
		schoolYearContext: { activeSchoolYearLabel: '2022-2023', source: 'enrollpro', activeTerm: null },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		...overrides,
	});
}

/** STATE B — a year with a DRAFT run: one run, not published, and no post-run
 * comparison, so no change notice is on screen and the two target rows are the
 * whole header. */
function stateBContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return baseContext({
		...stateAContext(),
		draft: {
			runId: 321,
			entries: [{ entryId: 'e-tle', sectionId: 41, subjectId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
			unassignedItems: [],
			violations: [],
			summary: { isPublished: false, unassignedCount: 0, assignedCount: 118, hardViolationCount: 0 },
			inputState: null,
			version: 14,
			createdAt: RUN_FINISHED_AT,
			finishedAt: RUN_FINISHED_AT,
		},
		activeGeneratedRunId: 321,
		selectedRunId: '321',
		runs: [{ id: 321, createdAt: RUN_FINISHED_AT, durationMs: 4200, status: 'COMPLETED' }],
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro', activeTerm: null },
		...overrides,
	});
}

/** STATE C (ADDED 2026-09-29, correction 1) — a year whose run is PUBLISHED and has
 * no follow-ups. This is the state the header budget had NO fixture for, which is
 * how `SimplePublishedState` kept a `truncate` class on both of its sentences while
 * H3 (the no-ellipsis row) ran on A and B only and the handoff table reported the
 * truncation as BUILT. Reachability is the production path, not a contrivance:
 * `resolveSimpleHeaderPrimary` returns `published` whenever a generated run exists,
 * `isRunPublished` is true, and the workspace is not the pre-generation one. */
function stateCContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return baseContext({
		...stateBContext(),
		draft: {
			runId: 317,
			entries: [{ entryId: 'e-tle', sectionId: 41, subjectId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
			unassignedItems: [],
			violations: [],
			summary: { isPublished: true, unassignedCount: 0, assignedCount: 133, hardViolationCount: 0 },
			inputState: null,
			version: 14,
			createdAt: RUN_FINISHED_AT,
			finishedAt: RUN_FINISHED_AT,
		},
		activeGeneratedRunId: 317,
		selectedRunId: '317',
		runs: [{ id: 317, createdAt: RUN_FINISHED_AT, durationMs: 4200, status: 'COMPLETED' }],
		summary: { isPublished: true, unassignedCount: 0, assignedCount: 133, hardViolationCount: 0 },
		...overrides,
	});
}

/** STATE C+ — the same PUBLISHED run that still has follow-ups, so the longer
 * `N follow-up items remain` sentence is on screen too. Two fixtures, because the
 * short label and the long one are the two widths the copy can take, and the row
 * below must hold for both. */
function stateCFollowUpsContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return stateCContext({
		summary: { isPublished: true, unassignedCount: 2, assignedCount: 131, hardViolationCount: 0 },
		...overrides,
	});
}

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
		...overrides,
	};
}

/** The workspace's ONE Undo / Redo / History control, built exactly as
 * `ScheduleReviewWorkspace` builds it. `hideWhenIdle` is the prop the workspace now
 * passes for the Simple layout; on the base it is simply an unknown prop, so the
 * control renders and H5 fails on a real assertion. */
function undoControl(overrides: Record<string, unknown> = {}) {
	return createElement(TimetableUndoRedoControl as never, {
		hideWhenIdle: true,
		editHistoryCount: 0,
		revertLoading: false,
		revertLastEdit: async () => {},
		redoState: null,
		redoVersionStale: false,
		redoLastEdit: async () => {},
		clearRedo: () => {},
		setShowEditHistory: () => {},
		undoNotice: null,
		undoBlockedReason: null,
		...overrides,
	} as never);
}

/** The children of the `<header>` element that render ANY visible text. A header
 * child that renders no visible text cannot be a band a scheduler sees, whatever
 * element it is — the device the accepted C12 row already uses. */
function headerBands(header: HTMLElement): HTMLElement[] {
	return [...header.children].filter((child) => visibleText(child).trim().length > 0) as HTMLElement[];
}

const q = (host: Element, id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

// ═══ H1 — THE HEADER BOX IS TWO ROWS ══════════════════════════════════════

/** The ONE painting band of the header box, and the two rows it stacks.
 *
 * WHAT "TWO ROWS" MEANS HERE, STATED PLAINLY SO IT CANNOT BE MISREAD: a *band* is a
 * child of the `<header>` element that renders any visible text, and the accepted
 * `a2-c12-header-two-rows.test.tsx` already fixed the convention — its
 * `headerBands()` filters on visible text and it asserts the header renders exactly
 * one band, `timetable-simple-header-row`, which then stacks two rows. This header
 * keeps that shape: one band, two rows. What §8's "Header budget" caps is the ROW
 * COUNT, and that is what is asserted. */
function headerRowStack(host: Element): { bands: HTMLElement[]; rows: HTMLElement[]; header: HTMLElement } {
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	assert.ok(header, 'the header renders');
	const bands = headerBands(header);
	const rows = bands.length === 1 ? [...bands[0].children] as HTMLElement[] : [];
	return { bands, rows, header };
}

test('H1 STRUCTURAL (JSDOM HAS NO LAYOUT ENGINE — this is NOT a pixel row), state A: the header box stacks exactly TWO rows and nothing else', () => {
	const { bands, rows } = headerRowStack(headerTree(headerMarkup(stateAContext(), undoControl())));
	assert.equal(bands.length, 1,
		`the header box paints exactly one band, the row band; it painted ${bands.length}`);
	assert.equal(bands[0].getAttribute('data-testid'), 'timetable-simple-header-row', 'and that band is the row band');
	assert.equal((bands[0].getAttribute('class') ?? '').includes('flex-col'), true,
		'and it really is a column, so the row count follows from the child count');
	assert.equal(rows.length, 2, `the row band stacks exactly two rows; it stacked ${rows.length}`);
	assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-header-row-1', 'row 1');
	assert.equal(rows[1].getAttribute('data-testid'), 'timetable-simple-header-row-2', 'row 2');
	// DISCRIMINATION: row 1 really carries the title and the tabs, so this row is
	// not satisfied by an empty band.
	assert.ok(q(rows[0], 'timetable-page-heading'), 'row 1 carries the page title');
	assert.ok(q(rows[0], 'timetable-sub-nav'), 'row 1 carries the tabs');
	// …and row 2 really carries the three pickers.
	assert.ok(q(rows[1], 'timetable-simple-term-filter'), 'row 2 carries the Term picker');
	assert.ok(q(rows[1], 'timetable-simple-view-mode-select'), 'row 2 carries the Show picker');
	assert.ok(q(rows[1], 'timetable-simple-entity-select'), 'row 2 carries the Schedule for picker');
});

test('H1 STRUCTURAL (JSDOM HAS NO LAYOUT ENGINE — this is NOT a pixel row), state B: the header box still stacks exactly TWO rows with a draft on screen', () => {
	const { bands, rows } = headerRowStack(headerTree(headerMarkup(stateBContext(), undoControl())));
	assert.equal(bands.length, 1, `exactly one band with a draft run on screen; got ${bands.length}`);
	assert.equal(rows.length, 2, `still exactly two rows; got ${rows.length}`);
	assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-header-row-1', 'row 1');
	assert.equal(rows[1].getAttribute('data-testid'), 'timetable-simple-header-row-2', 'row 2');
});

// ═══ H2 — ONE STATUS CHIP ══════════════════════════════════════════════════

test('H2 state A: exactly ONE status chip, no run-state badge, and nothing else claims there is no schedule', () => {
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	assert.ok(q(host, 'timetable-simple-readiness-chip'), 'the readiness chip is on screen');
	assert.equal(q(host, 'timetable-run-state-badge'), null,
		'the SECOND chip — `timetable-run-state-badge` — is not in the Simple header at all');
	// THE DEFECT BEING CLOSED, stated as an assertion: on the base, a year with no
	// schedule printed BOTH `No 2022-2023 timetable yet` and `No schedule yet`. No
	// two rendered elements may now claim there is no schedule.
	//
	// THE WRAPPER IS NOT A SECOND CLAIM: the merged warnings control WRAPS the
	// readiness chip, so both carry the chip's text. Only the INNERMOST claimant
	// counts — an element that CONTAINS another claimant is the same claim rendered
	// through its control, not a second place the header says it.
	const all = [...header.querySelectorAll<HTMLElement>('[data-testid]')]
		.filter((element) => /\bno .*(timetable yet|schedule yet)\b/i.test(visibleText(element)));
	const claims = all.filter((element) => !all.some((other) => other !== element && element.contains(other)));
	assert.equal(claims.length, 1,
		`exactly ONE element claims there is no schedule; ${claims.length} do: ${all.map((e) => `${e.getAttribute('data-testid')}="${visibleText(e).trim()}"`).join(' | ')}`);
	assert.match(visibleText(claims[0]), /No 2022-2023 timetable yet/,
		'and the surviving claim is the readiness chip\'s own truthful sentence');
	assert.ok(q(host, 'timetable-simple-warnings-control'),
		'the chip is still the face of the merged warnings control — no control was added or lost');
});

test('H2 state B: exactly ONE status chip, and the run-state badge is still absent with a draft on screen', () => {
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	assert.ok(q(host, 'timetable-simple-readiness-chip'), 'the readiness chip is on screen');
	assert.equal(q(host, 'timetable-run-state-badge'), null, 'still no second chip with a draft run on screen');
});

// ═══ H3 — NO ELLIPSIS, NO TRUNCATION, NO NATIVE `title` ═════════════════════

function assertNoTruncation(label: string, header: HTMLElement): void {
	const offenders: string[] = [];
	for (const element of [header, ...header.querySelectorAll<HTMLElement>('*')]) {
		const classes = (element.getAttribute('class') ?? '').split(/\s+/);
		if (classes.includes('truncate') || classes.includes('lg:truncate') || classes.includes('text-ellipsis')) {
			offenders.push(`${element.tagName.toLowerCase()}.truncate`);
		}
		if (element.hasAttribute('title')) offenders.push(`${element.tagName.toLowerCase()}[title]`);
	}
	assert.deepEqual(offenders, [], `${label}: no header element carries a truncate class or a native title`);
	for (const element of [header, ...header.querySelectorAll<HTMLElement>('*')]) {
		const text = visibleText(element);
		assert.equal(/…|\.\.\./.test(text), false,
			`${label}: no rendered text is cut off with an ellipsis (offending: ${JSON.stringify(text.slice(0, 120))})`);
	}
}

test('H3 state A: nothing inside the header is truncated, ellipsized, or given a raw `title`', () => {
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	assertNoTruncation('state A', host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement);
});

test('H3 state B: nothing inside the header is truncated, ellipsized, or given a raw `title`', () => {
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	assertNoTruncation('state B', host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement);
});

/* H3 state C — ADDED 2026-09-29, correction 1 of `a2-header-budget`. The row above
 * ran on states A and B only, and the published state is the ONE state an ordinary
 * scheduler reaches with a finished year, the one state with no rendered evidence,
 * and the one state that still carried `truncate` on both sentences. So the row is
 * EXTENDED, not replaced: the shared `assertNoTruncation` helper is unchanged and
 * the A and B rows are byte-for-byte the rows QA accepted. */
test('H3 state C (PUBLISHED, no follow-ups): nothing inside the header is truncated, ellipsized, or given a raw `title`', () => {
	const host = headerTree(headerMarkup(stateCContext(), undoControl()));
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	assertNoTruncation('state C', header);
	// DISCRIMINATION: the published surface is really on screen in this state, so
	// the row above is not satisfied by a header that never reached the copy at
	// all. `resolveSimpleHeaderPrimary` puts it in row 1's PRIMARY slot.
	const published = q(header, 'timetable-simple-published-state');
	assert.ok(published, 'the published state is the primary slot owner here');
	assert.equal(q(header, 'timetable-simple-publish-action'), null, 'and no publish control competes with it');
});

test('H3 state C+ (PUBLISHED, 2 follow-ups): the longer follow-up sentence is rendered WHOLE, and the surface is what makes it so', () => {
	const host = headerTree(headerMarkup(stateCFollowUpsContext(), undoControl()));
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	assertNoTruncation('state C+', header);
	const published = q(header, 'timetable-simple-published-state');
	assert.ok(published, 'the published state is the primary slot owner here');
	// THE COPY IS WHOLE. Not "has no ellipsis" — the exact sentences, so a future
	// change that shortens or drops one of them fails here instead of quietly
	// winning a narrower claim. `SimpleHeaderHelpers` owns these two strings and
	// three OTHER committed suites pin them; this row reads them from the real
	// component rather than from a literal.
	assert.equal(published.getAttribute('data-published-follow-ups'), '2', 'the fixture really is the follow-up state');
	assert.equal(visibleText(published),
		'Published schedule — 2 follow-up items remainChanges start on a date you choose',
		'every sentence in the published surface is rendered in full');
	assert.equal(published.getAttribute('aria-label'),
		'Published schedule — 2 follow-up items remain. Changes start on a date you choose.',
		'and the accessible name carries the same two sentences');
	// THE STRUCTURAL REASON, asserted because it is load-bearing: `truncate` could
	// never paint here because `shrink-0` gives the surface its full content width.
	// If a future layout makes the surface elastic, THIS row is where the
	// consequence has to be decided (a real height, or a bounded width) instead of
	// being absorbed by putting `truncate` back.
	const classes = (published.getAttribute('class') ?? '').split(/\s+/);
	assert.equal(classes.includes('shrink-0'), true,
		`the published surface must keep shrink-0, or the removed truncate becomes reachable again; got "${published.getAttribute('class')}"`);
	assert.equal(classes.filter((token) => /^h-/.test(token)).length, 1,
		'and it must keep exactly ONE h-* class, because timetable-header-collapse-c01 D2/D3 measure it');
});

// ═══ H4 — SETUP BLOCKERS: ONE SHORT LINK (a REAL CLICK, so a client root) ════

/** `blockers.length === 468` — the operator's own screen. 468 is FIXTURE DATA and
 * never a literal in the product: the label is derived from the live
 * `diagnostic.blockers.length` this feeds through the real context. */
function engineBlocker(index: number) {
	return {
		category: 'DEMAND_AUTHORITY',
		code: 'OWNERSHIP_MISSING',
		termIdentity: 'TERM_2030_1',
		sectionId: 700 + index,
		subjectId: 31,
		subjectCode: 'TLE-7',
		entity: `Section 7-${index} TLE-7`,
		reason: 'OWNERSHIP_MISSING blocks generation.',
		owningSurface: 'Teaching Load',
		nextAction: 'Assign a qualified teacher, then re-run generation readiness.',
	};
}

const BLOCKER_TOTAL = 468;

function blockedContext(base: Record<string, unknown>): Record<string, unknown> {
	return {
		...base,
		curriculumReadiness: {
			state: 'blocked',
			message: 'Setup is not ready: OWNERSHIP_MISSING blocks generation.',
			diagnostic: {
				generateAllowed: false,
				zeroWrite: true,
				blockers: Array.from({ length: BLOCKER_TOTAL }, (_, index) => engineBlocker(index)),
			},
			repair: { kind: 'navigate', href: '/teaching-load', label: 'Fix teaching load' },
		},
	};
}

test('H4 state A with 468 setup blockers: the ONE chip reads exactly `468 setup items to fix`, and clicking it opens the EXISTING blocker sheet', async () => {
	const view = mountHeader(blockedContext(stateAContext()), undoControl());
	const header = view.host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;

	// THE SHORT LABEL, and the long paragraph it replaced is GONE from the header.
	const chip = view.el('timetable-simple-readiness-chip');
	assert.ok(chip, 'the status chip is on screen');
	assert.equal(visibleText(chip).trim(), `${BLOCKER_TOTAL} setup items to fix`,
		`the chip's visible label is the short live-count link, exactly; got ${JSON.stringify(visibleText(chip).trim())}`);
	assert.equal(view.el('timetable-curriculum-readiness-message'), null,
		'the long setup-blocked paragraph is not a header row any more — its fact is the chip label');
	assert.equal(visibleText(header).includes('OWNERSHIP_MISSING'), false,
		'the raw engine diagnostic is not printed in the header');
	assert.match(chip!.getAttribute('aria-label') ?? '', /setup items to fix/,
		'the chip\'s aria-label still names the action and carries the live count');

	// CLICKING THE REAL CONTROL OPENS THE REAL SHEET — no new component, no new
	// route, no new fetch, driven through the production control.
	const entry = view.el('timetable-simple-warnings-control');
	assert.ok(entry, 'the merged warnings control is rendered');
	assert.equal(entry!.getAttribute('data-warnings-dispatch'), 'generation-blockers',
		'and it still owns the existing `generation-blockers` dispatch');
	await view.click('timetable-simple-warnings-control');
	const sheet = view.doc('timetable-generation-blocker-sheet');
	assert.ok(sheet, 'one real click opens the existing `SimpleGenerationBlockerSheet` — the detail is still reachable');
	assert.equal(header.contains(sheet!), false, 'the sheet is a body-level portal, never a band of the header box');
	assert.equal(sheet!.parentElement, dom.window.document.body, 'and it really is portalled to the body');
	assert.ok(sheet!.querySelector('[data-testid="timetable-generation-blocker-list"]'), 'and it renders the real blocker list');
	// It really is the LIVE list, not a sample or a capped summary: the last of the
	// 468 the fixture put in the diagnostic is present, so the sheet is not showing a
	// truncated head.
	const items = sheet!.querySelectorAll('[data-testid="timetable-generation-blocker-item"]');
	assert.ok(items.length > 1, `the list has rows (${items.length})`);
	assert.ok(visibleText(items[items.length - 1]).includes(`GR7 - ${700 + BLOCKER_TOTAL - 1}`),
		`and its last row is the LAST of the live count, so the list is not truncated: ${JSON.stringify(visibleText(items[items.length - 1]).slice(0, 80))}`);
	// NOT asserted here: `items.length === 468`. Materialising 468 JSDOM rows inside a
	// portalled Radix sheet is what exhausted the heap in the first cut of this file
	// (`exitCode: -1` after ~24 s), and the disclosure's own completeness is already a
	// rendered row in `generation-blockers-c02.test.tsx` ("C2-a.4 the disclosure lists
	// ALL THREE blockers in plain words, not just blockers[0]"). This row's subject is
	// the CHIP: its label, its tooltip target and its dispatch.
});

test('H4 state B with 468 setup blockers: the same short label, and a run on screen does not change the rule', () => {
	const host = headerTree(headerMarkup(blockedContext(stateBContext()), undoControl()));
	const chip = q(host, 'timetable-simple-readiness-chip');
	assert.ok(chip, 'the chip is on screen in state B too');
	assert.equal(visibleText(chip).trim(), `${BLOCKER_TOTAL} setup items to fix`, 'the same short live-count label');
	assert.equal(q(host, 'timetable-curriculum-readiness-message'), null, 'and still no long paragraph in the header');
});

// ═══ H5 — IDLE ACTIONS ARE HIDDEN ══════════════════════════════════════════

test('H5 state A: no draft means no `Discard draft`, no undo cluster inside the header, and `More` is present', () => {
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	assert.equal(q(host, 'timetable-draft-strip-discard'), null,
		'`Discard draft` renders NOTHING when there is no draft on screen (state A)');
	assert.equal(header.querySelector('[data-testid="timetable-undo-redo-control"]'), null,
		'the Undo / Redo / History cluster is not rendered when nothing can act on it');
	assert.ok(q(host, 'timetable-simple-more-trigger'), '`More` is still on screen — the menu is never the thing that disappears');
	assert.equal(headerBands(header).length, 1, 'and the header box still paints only the one row band');
	assert.equal(headerBands(header)[0].children.length, 2, 'which still stacks exactly two rows');
});

test('H5 state B, idle history: a draft with `editHistoryCount === 0` and no redo still hides the undo cluster', () => {
	const host = headerTree(headerMarkup(stateBContext({ editHistoryCount: 0 }), undoControl({ editHistoryCount: 0 })));
	assert.equal(q(host, 'timetable-undo-redo-control'), null,
		'an empty edit history and no redo is "nothing to act on", so the cluster is hidden');
	// DISCRIMINATION: the DRAFT actions themselves ARE on screen now, so this row is
	// not passing because row 2 rendered nothing.
	assert.ok(q(host, 'timetable-draft-strip-discard'), 'a draft exists, so `Discard draft` is on screen in state B');
});

test('H5 state B with history: `editHistoryCount === 3` renders the cluster with all three controls', () => {
	const host = headerTree(headerMarkup(stateBContext({ editHistoryCount: 3 }), undoControl({ editHistoryCount: 3 })));
	const cluster = q(host, 'timetable-undo-redo-control');
	assert.ok(cluster, 'a non-empty history renders the cluster');
	for (const id of ['timetable-visible-undo', 'timetable-visible-redo', 'timetable-visible-history']) {
		assert.ok(cluster!.querySelector(`[data-testid="${id}"]`), `${id} is still present and reachable`);
	}
	// …and the controls are LIVE, which is what "renders in full whenever anything is
	// present" has to mean.
	const undo = cluster!.querySelector('[data-testid="timetable-visible-undo"]') as HTMLElement;
	const history = cluster!.querySelector('[data-testid="timetable-visible-history"]') as HTMLElement;
	assert.equal(undo.hasAttribute('disabled'), false, 'Undo is enabled with history to undo');
	assert.equal(history.hasAttribute('disabled'), false, 'History is enabled with history to open');
});

// ═══ H6 — NO HELPER SENTENCE UNDER A BUTTON ════════════════════════════════

test('H6 state B: `Edit draft` / `Discard draft` have NO visible reason, the reason is in a @/ui tooltip, and `aria-label` still carries it', () => {
	const host = headerTree(headerMarkup(stateBContext({ hasSelectedEntry: false }), undoControl()));
	// No selection => `Edit draft` is disabled, which is exactly the state where the
	// operator saw a sentence printed under the button.
	const edit = q(host, 'timetable-draft-strip-edit');
	assert.ok(edit, '`Edit draft` is on screen in state B');
	assert.equal(edit!.hasAttribute('disabled'), true, 'it is the disabled control under test');
	const expected = 'Pick a class on the grid first, then choose Edit.';
	assert.equal(q(host, 'timetable-draft-strip-edit-reason'), null,
		'NO visible sibling reason element is rendered under `Edit draft`');
	assert.equal(edit!.getAttribute('aria-label'), `Edit draft — ${expected}`,
		'and the disabled control\'s aria-label still carries the reason verbatim, so nothing depends on a hover');
	// The reason is REACHABLE: it is a `@/ui` Tooltip on the focusable wrapper the
	// disabled button sits in, and the wrapper is in the tab order.
	const wrapper = edit!.parentElement;
	assert.ok(wrapper, 'the disabled button is wrapped');
	assert.equal(wrapper!.tagName.toLowerCase(), 'span', 'in a wrapper span (a disabled button cannot fire a Radix tooltip)');
	assert.equal(wrapper!.getAttribute('tabindex'), '0', 'and that wrapper is focusable, so the reason is reachable by keyboard');

	const discard = q(host, 'timetable-draft-strip-discard');
	assert.ok(discard, '`Discard draft` is on screen in state B');
	assert.equal(q(host, 'timetable-draft-strip-discard-reason'), null, 'and no visible reason under `Discard draft` either');
});

test('H6 state A: `Discard draft` is absent entirely, so it can print no reason', () => {
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	assert.equal(q(host, 'timetable-draft-strip-discard'), null, '`Discard draft` is not rendered in state A');
	assert.equal(q(host, 'timetable-draft-strip-discard-reason'), null, 'so there is no reason element under it either');
});

// ═══ H7 — ONE LOOK PER CONTROL ════════════════════════════════════════════

test('H7 state A: all three row-2 pickers carry the ONE shared @/ui chrome, a non-empty accessible name, and no page-local look override', () => {
	assert.equal(typeof SHARED_PICKER_CLASS === 'string', true,
		'`@/ui/select` exports the one shared picker chrome constant; on the base it does not exist at all');
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	assertNoTruncation('state A', host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement);

	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	const row2 = q(header, 'timetable-simple-header-row-2');
	assert.ok(row2, 'row 2 exists');
	const chromeTokens = (SHARED_PICKER_CLASS as string).split(/\s+/);
	const triggers: Record<string, HTMLElement | null> = {
		Term: q(header, 'timetable-simple-term-filter'),
		Show: q(header, 'timetable-simple-view-mode-select'),
		'Schedule for': row2.querySelector('button[role="combobox"]'),
	};
	for (const [name, trigger] of Object.entries(triggers)) {
		assert.ok(trigger, `the ${name} picker trigger is rendered`);
		const classes = (trigger!.getAttribute('class') ?? '').split(/\s+/);
		for (const token of chromeTokens) {
			assert.equal(classes.includes(token), true,
				`the ${name} picker carries the shared chrome token \`${token}\`; its class is ${JSON.stringify(trigger!.getAttribute('class'))}`);
		}
		// §8 also requires a non-empty accessible name, and the same search behaviour
		// for the same control.
		const accessible = trigger!.getAttribute('aria-label') ?? trigger!.getAttribute('aria-labelledby');
		assert.ok(accessible && accessible.trim().length > 0, `the ${name} picker has a non-empty accessible name`);
		// …and the shared height, not the `h-8` the two selects used beside the `h-9`
		// term picker.
		assert.equal(classes.includes('h-9'), true, `the ${name} picker is the shared h-9 height`);
	}
});

test('H7 state B: the two Select pickers look identical in state B too', () => {
	assert.equal(typeof SHARED_PICKER_CLASS === 'string', true, 'the shared @/ui constant is exported');
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	const chromeTokens = (SHARED_PICKER_CLASS as string).split(/\s+/);
	for (const id of ['timetable-simple-term-filter', 'timetable-simple-view-mode-select']) {
		const trigger = q(host, id);
		assert.ok(trigger, `${id} is rendered`);
		const classes = (trigger!.getAttribute('class') ?? '').split(/\s+/);
		for (const token of chromeTokens) {
			assert.equal(classes.includes(token), true, `${id} carries the shared token \`${token}\``);
		}
	}
});

// ═══ H8 — NOTHING LOST (a REAL CLICK, so a client root) ═════════════════════

test('H8 state B: every action reachable before is still reachable — the real More menu, opened through the real control', async () => {
	const view = mountHeader(stateBContext(), undoControl({ editHistoryCount: 2 }));
	// DISCRIMINATION: the menu must really open, or the rows below would pass
	// vacuously.
	const menu = await view.openMenu('timetable-simple-more-trigger');
	assert.ok(menu, 'the real More menu opens through the production trigger');
	const rows = menu!.querySelectorAll('[role="menuitem"]');
	assert.ok(rows.length > 0, `and it has rows (${rows.length})`);
	for (const id of [
		'timetable-more-generate',
		'timetable-more-schedule-history',
		'timetable-more-unassigned-sessions',
		'timetable-simple-review-setup',
		'timetable-simple-edit-draft-action',
		'timetable-more-discard-draft',
	]) {
		assert.ok(menu!.querySelector(`[data-testid="${id}"]`), `${id} is still reachable from the More menu`);
	}
});

test('H8 state A: the More menu keeps BOTH draft rows even though row 2 hides `Discard draft`', async () => {
	// §8's rule is "hidden OR live under More". Hiding an action from row 2 loses
	// nothing only if the More menu still carries it — this row is that check.
	const view = mountHeader(stateAContext(), undoControl());
	assert.equal(view.el('timetable-draft-strip-discard'), null, 'row 2 renders no `Discard draft` in state A');
	const menu = await view.openMenu('timetable-simple-more-trigger');
	assert.ok(menu, 'the real More menu opens through the production trigger');
	assert.ok(menu!.querySelector('[data-testid="timetable-more-discard-draft"]'),
		'but the More menu still carries `Discard draft`, with its existing gate and reason');
	assert.ok(menu!.querySelector('[data-testid="timetable-simple-edit-draft-action"]'), 'and still carries `Edit draft`');
	// `timetable-more-generate` is deliberately NOT required in state A: with no
	// generated run the ONE solid primary IS `Generate`, and DRAFT-UX-C01's contract
	// is that `More` does not duplicate the visible primary
	// (`generate.visible: headerPrimary !== 'generate'`). H8 state B is the row that
	// pins the More `Generate` row, where the primary is `Publish schedule`.
	assert.equal(menu!.querySelector('[data-testid="timetable-more-generate"]'), null,
		'and `More` does NOT duplicate `Generate`, because in state A Generate is the visible primary — the accepted one-primary rule');
});

// ═══ H9 — RANGE SCOPE (a source row, honestly labelled) ════════════════════

/**
 * H9 IS **NOT** A BEHAVIOURAL ROW AND IS LABELLED AS ONE IN ITS OWN NAME. It reads
 * source files to prove the two things the packet explicitly parked — the
 * section-switch speed work (P) and the past-year read-only view — are
 * byte-identical across this range. Every behavioural claim in this file is made
 * on RENDERED output; this one cannot be, because its subject is "a file did not
 * change".
 *
 * The comparison is against a real commit (`git show` at the accepted base), not
 * against a note in this file. The paths were located with a grep, not guessed:
 * `useScheduleReviewWorkspaceState` is a hook under `src/hooks`, and
 * `buildPastYearBackHref` / `resolvePastYearViewState` / `usePastYearTimetable`
 * all live in `simple/pastYearViewState.ts` and `simple/usePastYearTimetable.ts`.
 */
const BASE_SHA = 'ce1257c815e4393f638e0c3cd19c71c561c2d1d1';
const CLIENT_ROOT = resolve(import.meta.dirname, '../../../..');
const REPO_ROOT = resolve(CLIENT_ROOT, '..');

const SCOPE_FILES = [
	'hooks/useScheduleReviewWorkspaceState.ts',
	'components/timetable/simple/SimplePastYearView.tsx',
	'components/timetable/simple/SimplePastYearReadOnlySurface.tsx',
	'components/timetable/simple/usePastYearTimetable.ts',
	'components/timetable/simple/pastYearViewState.ts',
] as const;

test('H9 RANGE-SCOPE ROW (NOT a behavioural row): the parked section-switch file and every past-year module are byte-identical to the base', () => {
	// LINE ENDINGS ARE NORMALISED, AND THAT IS DELIBERATE. `git show` returns the
	// committed blob with LF endings, while the worktree checkout is CRLF, so a raw
	// byte comparison reports a difference on a file nobody touched — which is a
	// false alarm, not evidence. What must be identical is the CONTENT, so both
	// sides are normalised to LF first. (The worktree is not modified: `git status`
	// for each of these paths is empty.)
	const normalise = (text: string) => text.replace(/\r\n/g, '\n');
	for (const relative of SCOPE_FILES) {
		const atBase = execFileSync('git', ['-C', REPO_ROOT, 'show', `${BASE_SHA}:atlas-client/src/${relative}`], {
			encoding: 'utf8',
			maxBuffer: 32 * 1024 * 1024,
		});
		const onDisk = readFileSync(resolve(CLIENT_ROOT, 'src', relative), 'utf8');
		assert.equal(normalise(onDisk), normalise(atBase),
			`atlas-client/src/${relative} is identical to the base across this range (line endings normalised) — it is explicitly out of scope`);
	}
});

/**
 * H10 - THE MEMORY DEFECT THIS SLICE CAUSED, AND ITS EXACT CAUSE.
 *
 * WHAT HAPPENED, measured 2026-09-29: `draft-ux-c01.test.tsx` died before it
 * reported a single row - `tests 1`, zero subtests, ~7 s, exit code
 * 4294967295 - and with the heap pinned it printed
 * `FATAL ERROR: ... JavaScript heap out of memory` in ~6 s. The default heap
 * limit HIDES it: the process is killed before V8 prints, so it presents as a
 * silent hang, which is how it was mis-diagnosed twice.
 *
 * IT WAS NOT THE PRODUCTION CODE, and this row is the proof rather than the
 * claim. Bisected one test at a time (34 rows, each in its own process at
 * `--max-old-space-size=512`): exactly ONE row OOMs - `A2-C12-ITEM4`, the row
 * this slice ADDED. Its render alone completes in 877 ms at 112 MB. The failing
 * statement was
 *
 *     assert.equal(controlRow.querySelector(`[data-testid="${id}"]`), null, msg)
 *
 * When that assertion FAILS, `node:assert` builds its message with
 * `util.inspect(actual, { depth: 1000, maxArrayLength: Infinity })` - and
 * `actual` is a jsdom `Element`. A DOM node's property graph (parentNode ->
 * ownerDocument -> the whole document, plus live collections) expands
 * combinatorially under that depth, and the message alone exhausts the heap.
 * Coercing the same value to a boolean first - `... === null` asserted against
 * `true` - makes the identical failure report in ~1.2 s with no OOM.
 *
 * So the rule this row locks in is narrow and behavioural: A FAILING ASSERTION
 * MUST NOT BE THE THING THAT EXHAUSTS THE HEAP. The row re-runs the real file,
 * the real row, in a child process with a 256 MB heap, and fails if the child
 * dies of heap exhaustion or if the row is not reported at all.
 */
function stripTestContext(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	// node refuses to run a test file inside a test file, and the child must be
	// allowed to, or the row asserts nothing. The child sets it for ITSELF.
	const out = { ...env };
	delete out.NODE_TEST_CONTEXT;
	return out;
}

test('H10 a failing assertion in draft-ux-c01 reports its row; it never exhausts the heap (the 2026-09-29 OOM)', () => {
	const child = spawnSync(process.execPath, [
		'--max-old-space-size=256',
		'--import', 'tsx',
		'--test', '--test-reporter=tap',
		'--test-name-pattern=A2-C12-ITEM4',
		resolve(CLIENT_ROOT, 'src/components/timetable/__tests__/draft-ux-c01.test.tsx'),
	], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: CLIENT_ROOT, env: stripTestContext(process.env) });
	const output = [child.stdout, child.stderr].filter(Boolean).join(String.fromCharCode(10));

	assert.doesNotMatch(output, /heap out of memory/i,
		'draft-ux-c01 A2-C12-ITEM4 must not exhaust its heap; a failing assert.equal against a jsdom Element is the shape that did');
	assert.match(output, /A2-C12-ITEM4/,
		'the child really ran that row (a silently-skipped row would satisfy the OOM assertion vacuously)');
	assert.equal(child.signal, null, 'the child exited on its own; it was not killed by a signal');
});

/**
 * H11 - A SOURCE-SHAPE ROW, AND IT SAYS SO IN ITS OWN NAME, like H9.
 *
 * Its subject is code shape, which no render can decide, so it greps. It exists
 * because H10 fixes ONE occurrence and the same landmine is one keystroke away
 * in any test in this client: hand a `querySelector` / `querySelectorAll` RESULT
 * to `assert.equal` / `notEqual` / `deepEqual` and a failing comparison inspects
 * a DOM node at depth 1000 and can take the process down. The fix is always the
 * same shape - assert the boolean, the count, or the testid - so that is what
 * this row requires. A wrapped or pre-coerced call does not match, and is
 * allowed.
 */
/**
 * H11 - A SOURCE-SHAPE ROW, AND IT SAYS SO IN ITS OWN NAME, like H9.
 *
 * H10 above is the BEHAVIOURAL guard: it runs the real row in a real child and
 * fails if the heap dies. This row is the cheap, instant companion for the one
 * site this slice actually introduced, so the shape cannot come back through a
 * keystroke in the file that carried the OOM.
 *
 * SCOPE, STATED PLAINLY, because a wider version of this row is tempting and
 * would be a lie: the narrow shape (`assert.equal(<node>, null)`) occurs 61
 * times across this client TODAY, all of them pre-existing and none of them
 * reported as OOMing - `draft-ux-c01` passes those rows at the base. The hazard
 * is real (see H10) but its blast radius scales with the size of the document
 * being inspected, so a blanket sweep is not this slice's to land and is not
 * claimed here. Those 61 sites are recorded as a dated follow-up row in
 * `docs/handoffs/lane-a-to-c.md` for the lanes that own them.
 *
 * What this row DOES require: the exact statement that OOMed is the boolean
 * form. Reverting `... === null` to the bare node fails this row.
 */
test('H11 SOURCE-SHAPE ROW: the draft-ux-c01 statement that OOMed on 2026-09-29 compares a BOOLEAN, not a DOM node', () => {
	const text = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/__tests__/draft-ux-c01.test.tsx'), 'utf8');
	const offenders = text.replace(/\r\n/g, '\n').split('\n')
		.map((line, index) => ({ line: line.trim(), at: index + 1 }))
		.filter(({ line }) => /assert\.(equal|notEqual|strictEqual|deepEqual|deepStrictEqual)\(\s*[A-Za-z0-9_$?.!\[\]]*\.(querySelector|querySelectorAll)\([^)]*\)\s*,\s*(null|undefined)\b/.test(line)
			&& line.includes('controlRow'));
	assert.deepEqual(offenders.map(({ at }) => at), [],
		'the A2-C12-ITEM4 rows must assert `querySelector(...) === null` against a boolean: a bare node here exhausts the heap on failure (H10)');
	assert.match(text, /querySelector\(`\[data-testid="\$\{id\}"\]`\) === null, true/,
		'the boolean form is present in draft-ux-c01 (this is the fix H10 measures)');
});

// ═══ H12 — CORRECTION 2 (2026-09-29): ONE STATUS PER FACT ═════════════════════
//
// The design-judgement reviewer (AGENTS.md §11 gate item 4) returned REJECT_UX on
// this slice with SIX of SEVEN rubric items passing and ONE failing: "One status
// per fact". The operator's complaint was two elements claiming the same thing, and
// the header budget had moved the disease rather than removed it. These four rows
// are the slice's answer, one per named finding, and every one of them renders the
// REAL header in the state the reviewer measured.

/** H12/F1 — the run's state is said ONCE. The reviewer's words, on the rendered
 * 1366×768 state B: "`State: Draft — teachers and students cannot see it yet.
 * (Run 321)` in grey is followed 14px later, with no separator and no line break,
 * by bold `Draft — not visible to teachers until you publish`. Same fact, same
 * strip, said twice. It reads as one run-on sentence with a font change in the
 * middle."
 *
 * The row therefore asserts BOTH halves of "once": the surviving sentence is there
 * with its RUN NUMBER (the one thing a scheduler can act on — `History 3` gives
 * them the list, and #41 requires the screen to name the run it is showing), and
 * the restatement is GONE from this band.
 *
 * DISCRIMINATION: putting the `visibility` span back is a one-line change and this
 * row fails on it. */
test('H12 F1 state B: the run\'s state is stated ONCE in the band — the sentence survives with its run number, the restatement is gone', () => {
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	const band = q(host, 'timetable-simple-status-band');
	assert.ok(band, 'the trailing status band is on screen (otherwise this row is vacuous)');
	const identity = q(band, 'timetable-run-identity');
	assert.ok(identity, 'the run-identity clause is on screen');
	assert.match(visibleText(identity), /Draft — teachers and students cannot see it yet\. \(Run 321\)/,
		'the surviving sentence keeps both halves: what a draft MEANS, and WHICH run it is');
	// THE RESTATEMENT IS GONE FROM THIS BAND. `timetable-draft-visibility` is the
	// OTHER surface's testid — `DraftVisibilityState` inside
	// `TimetableDraftStateStrip`, used by the EXPERT header — and that surface is
	// untouched; `a2-c11-draft-actions.test.tsx:173,239` still assert its copy.
	// What this row decides is that the SIMPLE band does not render it as well.
	assert.equal(q(band, 'timetable-draft-visibility'), null,
		'the band states the run\'s state once — the visibility restatement is not rendered beside it');
	assert.doesNotMatch(visibleText(band), /not visible to teachers/,
		'and no element in the band repeats who can see this run');
	// …and the band's own text is ONE sentence about the run, not two clauses with
	// a font change in the middle.
	assert.equal((visibleText(band).match(/cannot see it yet/g) ?? []).length, 1,
		'exactly one statement of "nobody can see this run yet" in the whole band');
});

/** H12/F2 — a REAL separator before the amber term clause. The reviewer's words:
 * "The band already has `gap-x-2 gap-y-1` on its container, so spacing alone is not
 * enough — the reviewer asked for a visible separator. … Once the duplicate is
 * gone and a separator (a middot, a bullet, or a line of its own) sits between the
 * draft state and the term warning, the amber reads as a warning about terms,
 * which is what it is."
 *
 * The row asserts the separator EXISTS, that it sits BETWEEN the two facts in DOM
 * order, that it is its own element rather than punctuation inside either clause,
 * and that it is hidden from assistive technology — `visibleText` strips
 * `aria-hidden`, so asserting on `visibleText(band)` proves the bullet is not read
 * as part of either sentence.
 *
 * DISCRIMINATION: deleting the separator is a one-line change and this row fails. */
test('H12 F2 state B: a real separator sits BETWEEN the run clause and the amber term notice, and belongs to neither', () => {
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	const band = q(host, 'timetable-simple-status-band');
	assert.ok(band, 'the trailing status band is on screen');
	const identity = q(band, 'timetable-run-identity');
	const notice = q(band, 'timetable-term-authority-unverified');
	// NON-VACUITY: the separator row is only meaningful with BOTH facts on screen,
	// which is the state the reviewer measured. If either were absent the row would
	// pass for the wrong reason.
	assert.ok(identity, 'the run clause is on screen');
	assert.ok(notice, 'the amber term-authority notice is on screen in this state');
	assert.match((notice.getAttribute('class') ?? ''), /text-amber-800/,
		'and the notice keeps its attention colour — it is a warning about TERMS, not a tail on the draft sentence');

	const separator = q(band, 'timetable-status-band-separator');
	assert.ok(separator, 'a visible separator sits between the two facts');
	// IT IS ITS OWN ELEMENT, BETWEEN THEM, not a character inside either clause.
	const order = [...band.children].indexOf(separator);
	assert.ok(order > [...band.children].indexOf(identity) && order < [...band.children].indexOf(notice),
		'the separator is a SIBLING positioned after the run clause and before the term notice');
	assert.equal((identity.textContent ?? '').includes('·'), false,
		'and the run clause itself contains no separator character');
	assert.equal((notice.textContent ?? '').includes('·'), false,
		'and neither does the amber notice');
	// IT IS NOT SPOKEN: a screen reader hears the two facts, not a bullet.
	assert.equal(separator.getAttribute('aria-hidden'), 'true',
		'the separator is aria-hidden, so assistive technology reads two facts and no mark');
	// …and it is not READ either. `visibleText` strips `aria-hidden` descendants, so
	// asking about the BAND (not about the separator itself) is what proves the mark
	// never joins the two sentences in the text a scheduler actually reads.
	assert.equal(visibleText(band).includes('·'), false,
		'and the band\'s readable text contains no separator character joining the two facts');
});

/** H12/F3 — the follow-up count is said ONCE. The reviewer's words: "a small pill
 * reading `Published with 2 follow-up items`, and 30px to its right the green
 * primary surface `Published schedule — 2 follow-up items remain`. The follow-up
 * count is stated twice, side by side, in the same row."
 *
 * The count moves OFF the chip and STAYS on the published primary surface, which
 * is the dominant object in that state (`h-11`, emerald, and the lifecycle PRIMARY
 * slot). The row asserts the count appears exactly once across the whole header,
 * and that it is on the primary — not merely that some element stopped repeating it.
 *
 * `schedule-clarity-c03`'s exact no-follow-ups `aria-label` is asserted here too,
 * so the case with no count is decided on the REAL header and not only in that
 * suite's own render.
 *
 * DISCRIMINATION: putting the count back into `readinessLabel` is a one-line change
 * and this row fails. */
test('H12 F3 state C+ (PUBLISHED, 2 follow-ups): the follow-up count is stated ONCE, on the published primary surface', () => {
	const host = headerTree(headerMarkup(stateCFollowUpsContext(), undoControl()));
	const header = host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement;
	const chip = q(header, 'timetable-simple-readiness-chip');
	const published = q(header, 'timetable-simple-published-state');
	assert.ok(chip, 'the readiness chip is on screen');
	assert.ok(published, 'the published primary surface is on screen');
	assert.equal(published.getAttribute('data-published-follow-ups'), '2', 'the fixture really is the follow-up state');
	// THE CHIP NAMES THE STATE AND NOTHING ELSE.
	assert.equal(visibleText(chip).trim(), 'Published',
		'the status chip says the state, and no number — it is one fact in one role');
	assert.doesNotMatch(visibleText(chip), /follow-up/,
		'the chip does not restate the follow-up count beside the surface that owns it');
	// THE PRIMARY SURFACE OWNS THE COUNT.
	assert.match(visibleText(published), /2 follow-up items remain/,
		'the dominant green surface keeps the count a scheduler acts on');
	// …AND THE WHOLE HEADER SAYS IT ONCE. One element, one mention: the general
	// form of the finding, so a future third claimant fails here too. The INNERMOST
	// filter must compare against the CANDIDATE set, not against every testid'd
	// element — otherwise a candidate is dropped merely for containing an unrelated
	// labelled descendant, which is the same over-correction `a2-c12-header-rows2`
	// warns about.
	const candidates = [...host.querySelectorAll<HTMLElement>('[data-testid]')]
		.filter((element) => /follow-up/.test(visibleText(element)));
	const claimants = candidates.filter((element) => !candidates
		.some((other) => other !== element && element.contains(other)));
	assert.deepEqual(claimants.map((element) => element.getAttribute('data-testid')),
		['timetable-simple-published-state'],
		`exactly ONE element in the header names the follow-up count; ${candidates.length} candidates: ${candidates.map((e) => e.getAttribute('data-testid')).join(' | ')}`);
});

test('H12 F3 state C (PUBLISHED, no follow-ups): the exact `schedule-clarity-c03` accessible name survives the deduplication', () => {
	const host = headerTree(headerMarkup(stateCContext(), undoControl()));
	const published = q(host, 'timetable-simple-published-state');
	assert.ok(published, 'the published primary surface is on screen');
	assert.equal(published.getAttribute('aria-label'),
		'Published schedule. Changes start on a date you choose.',
		'the no-follow-ups accessible name is byte-identical to the one `schedule-clarity-c03` pins');
	assert.equal(visibleText(q(host, 'timetable-simple-readiness-chip')!).trim(), 'Published',
		'and the chip agrees with it, which is the point: one state, one surface saying it');
});

/** H12/F4 — no control with nothing to do on row 2. The reviewer's words: "The
 * disabled `Edit draft` on row 2 in state A — it should not be there. … In the base
 * it was `Edit draft` (grey) + a printed sentence explaining why it was dead. This
 * slice deleted the sentence and kept the dead button. That is the worst half of
 * the pair kept and the better half removed. Hide it in state A, or move it under
 * `More`."
 *
 * The rule asserted is the general one — "no control with nothing to do is rendered
 * on row 2" — in BOTH directions: absent with no draft, present with one. The
 * second half is what stops a lazy fix that simply deletes `Edit draft` everywhere,
 * and the `More` menu's own row is what stops a fix that hides the action instead
 * of the dead control.
 *
 * DISCRIMINATION: removing `hideEditWhenAbsent` from `SimpleHeaderDraftActions` (or
 * gating the control on `actions.edit.enabled` instead of `actions.hasDraft`) fails
 * one of the two halves: the state-A row for the former, the state-B row for the
 * latter, because `edit.enabled` is false in state B with nothing selected. */
test('H12 F4 state A: row 2 renders NO draft control at all — with no draft on screen there is nothing to edit or discard', () => {
	const host = headerTree(headerMarkup(stateAContext(), undoControl()));
	// DISCRIMINATION, PART 1: state A really is the no-draft state, so this row is
	// not passing because the strip rendered nothing for an unrelated reason.
	assert.equal(q(host, 'timetable-run-identity'), null,
		'there is no run on screen in state A, so there is no draft to act on');
	assert.equal(q(host, 'timetable-draft-strip-edit'), null,
		'`Edit draft` renders NOTHING in state A — the dead button the reviewer named is gone');
	assert.equal(q(host, 'timetable-draft-strip-edit-reason'), null,
		'and so is any reason that might have explained it');
	// `Discard draft` is absent too, but on ITS OWN signal and for its own honest
	// reason, and that difference is deliberate rather than an accident: the
	// committed `draft-ux-c01` `A2-C12-ITEM4R` rows (4) and (5) require
	// `Discard draft` to be hidden when the surface supplies no handler even with a
	// draft on screen, and to return as soon as one is. So `Discard draft` reads
	// `discard.enabled` and `Edit draft` reads `hasDraft`; this row only has to
	// decide that in state A neither control is on screen.
	assert.equal(q(host, 'timetable-draft-strip-discard'), null,
		'`Discard draft` is absent as well, so row 2 carries no dead draft control at all');
	// NOTHING IS LOST: the `More` menu keeps both entries, disabled, with their
	// visible reasons — so the action is still one click away.
	assert.ok(q(host, 'timetable-simple-more-trigger'), '`More` is on screen — the menu is never the thing that disappears');
	assert.equal(headerTree(headerMarkup(stateAContext(), undoControl()))
		.querySelectorAll('[data-testid="timetable-draft-strip-edit"], [data-testid="timetable-draft-strip-discard"]').length, 0,
		'and row 2 introduces no other draft control in its place');
});

test('H12 F4 state B: a draft IS on screen, so BOTH draft controls stay — the fix hides the dead one, not the verb', () => {
	const host = headerTree(headerMarkup(stateBContext(), undoControl()));
	assert.ok(q(host, 'timetable-draft-strip-edit'),
		'`Edit draft` is still on screen in state B (a real draft is there to edit)');
	assert.ok(q(host, 'timetable-draft-strip-discard'),
		'and so is `Discard draft`');
	// It is the DISABLED shape the reviewer accepted for state B, with the reason in
	// a `@/ui` tooltip and the aria-label — H6 above already owns the tooltip half;
	// this row owns only "present, and disabled rather than hidden".
	assert.equal(q(host, 'timetable-draft-strip-edit')!.hasAttribute('disabled'), true,
		'`Edit draft` is present and disabled, not hidden — no class is selected in this fixture');
});
