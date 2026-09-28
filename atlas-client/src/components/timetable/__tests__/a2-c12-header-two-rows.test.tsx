/**
 * A2 C12 / ITEM H — the Simple header box is at most TWO rows, and the swap banner
 * and the blocker sheet are out of it.
 *
 * ── WHAT LANE C MEASURED, AND WHAT THIS FILE IS ANSWERED WITH ───────────────
 * Lane C measured the Simple header in a real browser at 1366×768, in the
 * operator's OWN state (a resolved run, 3 must-fix, 145 advisories, term
 * authority unverified) and found SEVEN text bands / 204 px:
 *
 *   1 state strip   2 change notice   3 `Publish schedule`
 *   4 `3 Must fix, 145 advisories… | More`   5 blocker line
 *   6 `Cancel`      7 swap banner
 *
 * against an accepted target of at most TWO rows. The structural work was already
 * done (`SimpleHeaderStatusStrip` + one control row in
 * `timetable-simple-header-row`), and the surplus came from two surfaces still
 * rendered INSIDE the `<header>` element. The operator's instruction, verbatim:
 * "move blocker sheet and swap banner out of the header box".
 *
 * ── WHAT THIS FILE MAY AND MAY NOT CLAIM (AGENTS.md "Done means seen") ───────
 * Every row below RENDERS the REAL `TimetableSimpleHeader` into a real JSDOM
 * document through the same harness as `a2-c11-s2-header-banners.test.tsx`, and
 * reads the resulting DOM. No row asserts source text about the move.
 *
 * ROW 3 IS A **DOM-SHAPE** ROW, NOT A PIXEL ROW, AND IT SAYS SO IN ITS OWN
 * COMMENT. JSDOM HAS NO LAYOUT ENGINE: it cannot set a 1366×768 viewport, cannot
 * lay out a flex row, and therefore cannot count the text bands a scheduler SEES
 * or measure their 204 px. What row 3 asserts is the DOM SHAPE that decides the
 * band count — how many children of the `<header>` element render any visible
 * text at all, and how many rows the one band stacks — which is the part of the
 * claim this environment can decide honestly. A true 1366×768 PIXEL measurement
 * is a **BROWSER row** (AGENTS.md §11, §12) and is owned by **Lane C on A4's
 * staging**; it is not faked here and it is not claimed here.
 *
 * ROW 4 IS A MUTANT ROW, labelled as one, with the literal failing output
 * recorded verbatim in its own comment below. The mutant was applied to
 * `TimetableSimpleHeader.tsx` by hand, the suite was run, and the file was
 * restored byte-exact (proved by `git diff --exit-code` on that path, output in
 * the executor handoff). No mutant is ever left in the tree.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
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

// Radix's dismissable layer calls these on every pointer event; JSDOM implements
// none of them. Identical to the stubs in `a2-c11-s2-header-banners.test.tsx` and
// `draft-ux-c01`, so a menu and a sheet are opened through the production path.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');

/** Bounded mount lifetime — same reason as the banners file: many full header
 * mounts left alive in one process exhausted the heap. */
const roots: any[] = [];
afterEach(() => {
	for (const mounted of roots.splice(0)) act(() => mounted.unmount());
});

/** What the operator can SEE, as opposed to `textContent`, which also carries
 * `sr-only` text. JSDOM has no layout, so this is the closest honest reading of
 * "what this element shows". */
function visibleText(host: Element): string {
	const clone = host.cloneNode(true) as HTMLElement;
	for (const hidden of [...clone.querySelectorAll('.sr-only, [aria-hidden="true"]')]) hidden.remove();
	return clone.textContent ?? '';
}

function renderIn(element: any) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => { root.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, element)); });
	return {
		host,
		el: (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null,
		header: () => host.querySelector('[data-testid="timetable-simple-header"]') as HTMLElement,
		all: (selector: string) => [...host.querySelectorAll(selector)] as HTMLElement[],
		click: async (id: string) => {
			const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement;
			assert.ok(el, `control ${id} is rendered, so it can be clicked`);
			act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
			await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
		},
	};
}

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const RUN_FINISHED_AT = '2026-09-28T08:00:00.000Z';

/** A comparison written AFTER the run finished: a truthful change, ten minutes old.
 * This is what puts the CHANGE NOTICE (Lane C's band 2) on screen, so the fixture
 * reproduces the state Lane C measured rather than a quieter one. */
const POST_RUN_COMPARISON = {
	status: 'STALE' as const,
	message: 'Setup inputs changed since this run was generated.',
	actionHint: 'Review the changed setup areas, then regenerate when ready.',
	changedDomains: ['teachingLoad' as const, 'rooms' as const],
	checkedAt: '2026-09-28T08:10:00.000Z',
};

function summaryOf(overrides: Record<string, unknown> = {}) {
	return {
		isPublished: false,
		unassignedCount: 0,
		assignedCount: 118,
		hardViolationCount: 3,
		...(overrides as Record<string, never>),
	};
}

/** One engine blocker, in the shape the real derivation produces. */
function engineBlocker(overrides: Record<string, unknown> = {}) {
	return {
		category: 'DEMAND_AUTHORITY',
		code: 'OWNERSHIP_MISSING',
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
 * THE OPERATOR'S OWN STATE, as Lane C measured it: a RESOLVED (not
 * pre-generation) draft run, 3 blocking hard violations, 145 soft advisories, and
 * an UNVERIFIED term authority. `activeTerm: null` is the honest unverified
 * shape — `isTermAuthorityVerified(null)` is false, so
 * `resolveTermAuthorityNotice` returns the visible "Term setup is unverified…"
 * notice, exactly as it does on the live surface.
 */
function operatorStateContext(overrides: Record<string, any> = {}): Record<string, any> {
	const noop = () => {};
	const draft = {
		runId: 321,
		entries: [{ entryId: 'e-tle', sectionId: 41, subjectId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		unassignedItems: [],
		violations: [],
		summary: summaryOf(),
		inputState: POST_RUN_COMPARISON,
		version: 14,
		createdAt: RUN_FINISHED_AT,
		finishedAt: RUN_FINISHED_AT,
	};
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 321,
		leftTab: 'sessions',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: noop,
		selectedRunId: '321',
		handleRunChange: noop,
		runs: [{ id: 321, createdAt: RUN_FINISHED_AT, durationMs: 4200, status: 'COMPLETED' }],
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
		draft,
		hardCount: 3,
		blockingHardCount: 3,
		softCount: 145,
		setPublishAcknowledged: noop,
		setShowPublishDialog: noop,
		exitPolicyView: noop,
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: noop,
		openMapWorkspace: noop,
		handleRefresh: noop,
		editHistoryCount: 1,
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
		// The UNVERIFIED term authority of the measured state.
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro', activeTerm: null },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 0,
		hasPublishedReturnState: false,
		severityFilter: 'all',
		...overrides,
	};
}

/** The same state with generation BLOCKED, so the merged warnings control owns the
 * `generation-blockers` dispatch and the blocker sheet can be opened through it. */
function blockedSetupContext(overrides: Record<string, any> = {}): Record<string, any> {
	return operatorStateContext({
		curriculumReadiness: {
			state: 'blocked',
			message: 'Setup is not ready: OWNERSHIP_MISSING blocks generation.',
			diagnostic: {
				generateAllowed: false,
				zeroWrite: true,
				blockers: [engineBlocker(), engineBlocker({ sectionId: 702, reason: 'ROOM_CAPACITY_INFEASIBLE.' })],
			},
			repair: { kind: 'navigate', href: '/teaching-load', label: 'Fix teaching load' },
		},
		...overrides,
	});
}

/**
 * The Undo node the WORKSPACE supplies (C11 M5: the single existing Undo / Redo /
 * History control, passed IN rather than built by the header, so the app has
 * exactly one Undo surface). Rendering it verbatim is the real contract, and it is
 * what makes the row-5 control count include Undo.
 */
function undoControl() {
	return createElement('button', { type: 'button', 'data-testid': 'timetable-simple-undo-control' }, 'Undo');
}

function simpleHeader(context: Record<string, any>, swapClassTimesMode: 'select-first' | 'select-second' | null = null) {
	const swaps: string[] = [];
	const view = renderIn(createElement(TimetableSimpleHeader as any, {
		context,
		layoutMode: 'simple',
		onLayoutModeChange: () => {},
		activeTask: null,
		onTaskChange: () => {},
		onSetRepairOrigin: () => {},
		readinessSheetOpen: false,
		onReadinessSheetOpenChange: () => {},
		swapClassTimesMode,
		onSwapClassTimesStart: () => {},
		// C11 M4 — the single reset. Recording the calls proves the banner's Cancel
		// still runs exactly one of them after the move.
		onSwapClassTimesCancel: () => { swaps.push('reset'); },
		undoRedoControl: undoControl(),
		onDiscardDraft: () => {},
	}));
	return { ...view, swaps };
}

/* ── BAND INVENTORY ───────────────────────────────────────────────────────── */

/**
 * The children of the `<header>` element that render ANY visible text. This is
 * the DOM-shape analogue of Lane C's band list: a header child that renders no
 * visible text cannot be a band a scheduler sees, whatever element it is.
 */
function headerBands(header: HTMLElement): HTMLElement[] {
	return [...header.children].filter((child) => visibleText(child).trim().length > 0) as HTMLElement[];
}

function describeBand(band: HTMLElement): string {
	return `${band.tagName.toLowerCase()}${band.getAttribute('data-testid') ? `[data-testid="${band.getAttribute('data-testid')}"]` : ''}`;
}

// ═══ ROW 1 — the swap banner is visible, and is NOT in the header box ════════

test('ROW 1 RENDERED: with a swap armed the banner is on screen, and the header element does not contain it', async () => {
	const view = simpleHeader(operatorStateContext(), 'select-first');
	const header = view.header();

	// THE MOVE DID NOT HIDE IT. DISCRIMINATION: this is the failure mode a "move"
	// invites — deleting the banner, or gating it behind a condition that never
	// holds, would leave every containment assertion below vacuously green.
	const banner = dom.window.document.querySelector('[data-testid="timetable-swap-class-times-banner"]');
	assert.ok(banner, 'an armed swap is still visibly signalled on screen — this was a MOVE, not a hide');
	assert.equal(banner!.getAttribute('role'), 'status', 'and it keeps its role="status"');
	assert.ok(visibleText(banner!).includes('choose Class A on the grid'),
		'with the same wording for select-first, so no operator-facing text changed');

	// …but it is a SIBLING of the header, not a descendant of the header's box.
	assert.equal(header.contains(banner!), false,
		'the armed-swap band is not inside the <header> element any more');
	assert.equal(banner!.parentElement, header.parentElement,
		'it is a sibling of the header in the same parent — rendered immediately after it, not dropped');

	// The `Cancel` (Lane C's band 6) moved with it, and still runs the ONE reset.
	const cancel = dom.window.document.querySelector('[data-testid="timetable-swap-class-times-cancel"]') as HTMLElement | null;
	assert.ok(cancel, 'the banner keeps its own Cancel after the move');
	assert.equal(header.contains(cancel!), false, 'and the Cancel is out of the header box too');
	assert.equal(visibleText(cancel!).trim(), 'Cancel', 'with its own label');

	act(() => { cancel!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	assert.deepEqual(view.swaps, ['reset'],
		'C11 M4: the Cancel dispatches the single swap reset EXACTLY ONCE, unchanged by the move');

	// ONE MOUNT PER ROW — the recorded precedent from
	// `a2-c11-s2-header-banners.test.tsx`: full `TimetableSimpleHeader` mounts
	// left alive together in one process exhaust the heap (observed there at 13 of
	// 16 rows). Two CONCURRENT live mounts of this component are enough to OOM
	// (measured here: a 461 MB heap, `FATAL ERROR: Committing semi space failed`,
	// after 60 s). So each row below owns exactly one live mount, and the
	// disarmed case is its own row rather than a second mount in this one.
});

// ═══ ROW 2 — the blocker sheet: what is asserted, and why ══════════════════

test('ROW 2 RENDERED: the generation blocker sheet is out of the header box, and its real entry point is still inside it', async () => {
	// WHAT IS ASSERTED, AND WHY — the real structure, stated rather than guessed:
	// `SimpleGenerationBlockerSheet` has NO trigger of its own. Its only rendered
	// form is a Radix `SheetContent` portalled to `document.body` when `open`
	// (`simple/SimpleGenerationBlockerSheet.tsx:142-160`), and it renders NOTHING
	// while closed. So there is no "trigger element" to assert containment on, and
	// pretending otherwise would be asserting a fiction. The two real facts are:
	//
	//   (a) the sheet's rendered surface is a BODY-LEVEL PORTAL, so it can never
	//       be inside the `<header>` element even when open; and
	//   (b) the AFFORDANCE — the EXISTING merged warnings control that owns the
	//       `generation-blockers` dispatch — is still INSIDE the header. A move
	//       that stranded that control would leave the blocker list unreachable.
	// Both are asserted on the real rendered DOM, in both sheet states.
	const view = simpleHeader(blockedSetupContext(), 'select-first');
	const header = view.header();

	// (a) CLOSED: nothing anywhere, so nothing in the header either.
	assert.equal(dom.window.document.querySelector('[data-testid="timetable-generation-blocker-sheet"]'), null,
		'a closed blocker sheet paints nothing');

	// The entry point is the header's own merged warnings control, NOT a new one.
	const entry = view.el('timetable-simple-warnings-control');
	assert.ok(entry, 'the merged warnings control is still rendered');
	assert.equal(entry!.getAttribute('data-warnings-dispatch'), 'generation-blockers',
		'and it still owns the generation-blockers dispatch — no new control was added');
	assert.equal(header.contains(entry!), true, 'and it is still INSIDE the header box, so the affordance was not stranded');

	// …and it is the SAME control the sheet was always entered from, NOT a new one:
	// the C2-a entry point. The ≤6 cap and the one-solid-primary rule are therefore
	// untouched by a move that added no control, and row 5 asserts both on the
	// accepted `draft-ux-c01` definition.

	// (a) OPEN: click the real control and read where the sheet actually lands.
	await view.click('timetable-simple-warnings-control');
	const sheet = dom.window.document.querySelector('[data-testid="timetable-generation-blocker-sheet"]') as HTMLElement | null;
	assert.ok(sheet, 'one click on the existing control opens the real blocker sheet — the list is still reachable');
	assert.equal(header.contains(sheet!), false, 'and the open sheet is NOT inside the <header> element');
	assert.equal(sheet!.parentElement, dom.window.document.body,
		'the open sheet is a body-level portal, so it cannot be a band of the header box in any state');
	// The list is the real one: the same plain-sentence rows, the same repairs.
	assert.ok(sheet!.querySelector('[data-testid="timetable-generation-blocker-list"]'), 'and it renders the real blocker list');
	assert.equal(sheet!.querySelectorAll('[data-testid="timetable-generation-blocker-item"]').length, 2,
		'with every blocker, not only the first');
});

// ═══ ROW 3 — the band count in the operator's own state (DOM SHAPE) ═════════

test('ROW 3 DOM SHAPE (JSDOM HAS NO LAYOUT ENGINE — this is NOT a pixel row): the header box renders at most TWO bands, and only the two rows', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// THIS IS A DOM-SHAPE ROW, NOT A 1366×768 PIXEL ROW. JSDOM HAS NO LAYOUT
	// ENGINE: it cannot set a 1366×768 viewport, cannot lay out a flex row, and
	// therefore CANNOT count the text bands a scheduler SEES or measure their
	// 204 px. Lane C's seven-band measurement came from a REAL BROWSER.
	//
	// The true 1366×768 PIXEL count is a **BROWSER row** (AGENTS.md §11/§12) and
	// is owned by LANE C on A4's staging — not by this repository's test suite,
	// and not claimed by it.
	//
	// What IS decided here, and is decided honestly: the DOM SHAPE that the band
	// count follows from. A `<header>` child that renders NO visible text cannot
	// be a band an operator sees, whatever element it is; a header child that
	// DOES render visible text is one band of the header's box. So the count of
	// text-bearing header children is the structural fact the two-row target
	// turns on.
	// ─────────────────────────────────────────────────────────────────────────
	const view = simpleHeader(operatorStateContext(), 'select-first');
	const header = view.header();
	const bands = headerBands(header);

	// THE FIXTURE REALLY IS THE MEASURED STATE, so the row is not vacuous. Each of
	// these is one of Lane C's own bands; a quiet fixture would make the count
	// below meaningless.
	assert.ok(view.el('timetable-draft-state-strip'), 'band 1 is present: the state strip');
	assert.ok(view.el('timetable-simple-input-drift'), 'band 2 is present: the change notice');
	assert.ok(view.el('timetable-simple-publish-action'), 'band 3 is present: the `Publish schedule` primary');
	assert.ok(view.el('timetable-simple-readiness-chip'), 'band 4 is present: `3 Must fix, 145 advisories…`');
	assert.equal(visibleText(view.el('timetable-simple-readiness-chip')!).trim(),
		'3 Must fix, 145 advisories — this schedule cannot be published yet.',
		'and it reads both severities, exactly as it did in the measured state');
	assert.ok(view.el('timetable-term-authority-unverified'), 'and the term-authority notice is on screen (unverified authority)');
	// The two bands the move removed were real, and are now provably outside.
	assert.equal(bands.some((band) => band.contains(dom.window.document.querySelector('[data-testid="timetable-swap-class-times-banner"]')!)), false,
		'DISCRIMINATION: the swap band is NOT one of the header box’s bands (pre-move it was, and this is what the R4 mutant reproduces)');

	// THE COUNT. Two is the accepted target; one is what the structure now yields,
	// because the status strip and the control row are siblings INSIDE one band.
	assert.ok(bands.length <= 2,
		`the header box renders at most two text bands; it rendered ${bands.length} (${bands.map(describeBand).join(', ')})`);
	assert.deepEqual(bands.map(describeBand), ['div[data-testid="timetable-simple-header-row"]'],
		'and the one band it does render is the row band — the two-row stack, and nothing else');

	// …and that band is EXACTLY the two rows, which is the part of the two-row
	// claim this environment can decide.
	const rows = [...bands[0].children] as HTMLElement[];
	assert.equal(rows.length, 2, 'the row band stacks exactly two rows');
	assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-status-region', 'row 1 is the state strip');
	assert.equal((bands[0].getAttribute('class') ?? '').includes('flex-col'), true,
		'and the band really is a column, so the row count is the child count');

	// THE "BLOCKER LINE" (Lane C's band 5) — ESTABLISHED FROM THE REAL CODE, NOT
	// A THIRD MOVE. The literal blocker sentence in this header is the capped
	// status-strip notice `timetable-curriculum-readiness-message`, rendered at
	// `simple/SimpleHeaderMessages.tsx:109` (plain) / `:120` (tooltip-wrapped),
	// reached from `simple/SimpleHeaderStatusStrip.tsx:107` via
	// `buildSimpleHeaderMessages({ setupBlockedDiagnostic })` in
	// `TimetableSimpleHeader.tsx`. It is a WRAPPED VISUAL LINE INSIDE row 1, not
	// a third child of the header element — so it is not moved out here, because
	// doing so would delete a notice the DRAFT-UX-C01 contract requires, in the
	// exact state (unverified setup with a resolved run on screen) that needs it.
	// The row below PROVES that placement on the rendered DOM rather than trusting
	// the file:line claim.
	const blocked = simpleHeader(blockedSetupContext(), 'select-first');
	const blockerLine = blocked.el('timetable-curriculum-readiness-message');
	assert.ok(blockerLine, 'the literal blocker sentence renders when setup IS blocked');
	assert.equal(headerBands(blocked.header()).length, 1,
		'and with setup blocked the header box is STILL one band — the blocker line lives inside row 1, not beside it');
	assert.equal((blocked.el('timetable-simple-status-region') as HTMLElement).contains(blockerLine!), true,
		'proved on the DOM, not trusted from the file:line claim — it is inside the STATE STRIP (row 1)');
	assert.equal((blocked.header().querySelector('[data-testid="timetable-simple-header-row"]') as HTMLElement).contains(blockerLine!), true,
		'so the blocker line is part of the two-row stack, and the stack is still two rows');
});

// ═══ ROW 4 — MUTANT ════════════════════════════════════════════════════════

test('ROW 4 MUTANT (this row is the mutant’s target, and it is a REAL assertion, not a placeholder): the banner is never a child of the header element', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// MUTANT ROW — LABELLED, AND THE LITERAL FAILING OUTPUT IS RECORDED HERE.
	//
	// The mutation: `TimetableSwapClassTimesBanner` was rendered back INSIDE the
	// `<header>` element in `TimetableSimpleHeader.tsx` (the exact reverse of this
	// change) — the banner JSX re-inserted before `SimplePublishReadinessSheet`,
	// `swapClassTimesMode` passed to the trailing surfaces forced to `null`, and the
	// banner import restored — then the suite was re-run with
	// `npm run test:ux-a2-c12-header-rows`.
	//
	// LITERAL MUTANT OUTPUT (verbatim assertion lines, trimmed only of the
	// per-test PASS lines around them):
	//
	//   AssertionError [ERR_ASSERTION]: the armed-swap band is not inside the <header> element any more
	//   AssertionError [ERR_ASSERTION]: DISCRIMINATION: the swap band is NOT one of the header box's bands (pre-move it was, and this is what the R4 mutant reproduces)
	//   AssertionError [ERR_ASSERTION]: MUTANT KILLED HERE: the swap banner is never a child of the header element
	//   AssertionError [ERR_ASSERTION]: and with a swap armed the trailing surfaces add exactly one more sibling — the banner, which is the only one of them that paints
	//
	//   # tests 7
	//   # pass 3
	//   # fail 4
	//
	// (This record was reproduced by the primary planner, not taken on trust from
	// the executor: the session that first applied the mutant was killed with the
	// mutant still in the tree, so the planner re-applied it on the finished
	// 7-row file, captured the output above, and restored the file.)
	//
	// The file was then restored, and the restore proved two ways: this suite
	// returns to 7 pass / 0 fail, and `git diff --exit-code` on the file shows only
	// this change's own hunks - no residue of the mutation.
	//
	// Note what the mutant did NOT do: the "the banner is on screen" assertion
	// still PASSED, because the mutant is a move and not a hide. That is the point
	// of asserting visibility and containment SEPARATELY — a single "is it
	// reachable" assertion would have been blind to the whole defect.
	// ─────────────────────────────────────────────────────────────────────────
	const view = simpleHeader(operatorStateContext(), 'select-first');
	const header = view.header();
	const banner = dom.window.document.querySelector('[data-testid="timetable-swap-class-times-banner"]') as HTMLElement | null;
	assert.ok(banner, 'the armed swap is signalled — so the containment row below cannot pass vacuously');
	assert.equal(header.contains(banner!), false, 'MUTANT KILLED HERE: the swap banner is never a child of the header element');
	// The second mutant-sensitive consequence: with the banner back inside, the
	// header box would carry a SECOND text band. Asserted separately so the
	// count row and the containment row cannot be satisfied by one fix.
	assert.equal(headerBands(header).length, 1, 'MUTANT KILLED HERE TOO: the banner is not a band of the header box');
});

// ═══ ROW 5 — REGRESSION: the move cost no control ══════════════════════════

/* The ≤6 visible-control definition, identical to `draft-ux-c01` and
 * `generation-blockers-c02` so this count is comparable to the accepted cap. */
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
function describeControl(element: HTMLElement): string {
	// The testid/label/text chain can come back EMPTY for a control that carries
	// none of the three (a Radix trigger, for instance). An empty name in a
	// failure message is useless to whoever has to act on it, so fall back to the
	// tag plus its most specific class, and only then to the empty string.
	const named = element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? element.textContent?.trim();
	if (named) return named;
	const tag = element.tagName.toLowerCase();
	const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
	const hint = classes.length > 0 ? `<${tag} class="${classes.slice(0, 3).join(' ')}">` : `<${tag}>`;
	return hint;
}

/**
 * THE CONTROLS THE MOVE MUST NOT COST, by identity rather than by count alone —
 * a count can be satisfied by the wrong controls. These are the four the item
 * names, plus the term selector that shares their row.
 */
const REQUIRED_HEADER_CONTROLS = [
	'timetable-simple-publish-action',   // the ONE primary action
	'timetable-simple-more-trigger',     // More
	'timetable-simple-warnings-control', // the merged warnings / readiness control
	'timetable-simple-undo-control',     // the single Undo the workspace supplies (C11 M5)
	'timetable-simple-term-filter',      // the term selector on the same row
] as const;

/**
 * THE COUNT MEASURED **BEFORE** THIS CHANGE: all five of
 * `REQUIRED_HEADER_CONTROLS` were inside the `<header>` element on the pre-move
 * tree, in the operator's state, with a swap armed.
 *
 * HOW IT WAS MEASURED (and this is the load-bearing part of the row's honesty):
 * the R4 MUTANT — `TimetableSwapClassTimesBanner` moved back INSIDE the `<header>`
 * — IS the pre-move structure, so the R4 mutant run measured the before state with
 * this same harness and this same fixture. Its literal output is in row 4's
 * comment. Every one of the five was present then and is present now.
 *
 * THE BANNER'S OWN `Cancel` IS DELIBERATELY NOT IN THIS SET, and that is the
 * honest accounting rather than a convenient one: pre-move the Cancel WAS a
 * control inside the `<header>`, and moving the banner out of the header box
 * necessarily moved the Cancel out with it. That is the requested change (Lane C's
 * band 6), it is asserted to still EXIST and still run the single reset in row 1,
 * and it is excluded from "a control the header lost" only because losing it from
 * the header is the point. A row that quietly counted it would have hidden the
 * one real consequence of the move.
 */
const REQUIRED_CONTROLS_BEFORE_MOVE = REQUIRED_HEADER_CONTROLS.length;

test('ROW 5 REGRESSION: every control the move must not cost is still in the header, and the count is unchanged from BEFORE the move', () => {
	const view = simpleHeader(operatorStateContext(), 'select-first');
	const header = view.header();

	// THE COUNT, against the before number. This row fails if the relocation ever
	// dropped, duplicated or added one of them.
	const present = REQUIRED_HEADER_CONTROLS.filter((id) => header.contains(view.el(id)!));
	assert.equal(present.length, REQUIRED_CONTROLS_BEFORE_MOVE,
		`all ${REQUIRED_CONTROLS_BEFORE_MOVE} required controls are still inside the header (present: ${present.join(', ')})`);
	// …and named individually, so a failure says WHICH one went.
	for (const id of REQUIRED_HEADER_CONTROLS) {
		assert.ok(header.contains(view.el(id)!), `${id} is still in the header`);
	}

	const solidAll = [...header.querySelectorAll<HTMLElement>('button, a[href]')]
		.filter((element) => !hiddenAtDesktop(element, header))
		.filter((element) => /\bbg-primary\b/.test(element.getAttribute('class') ?? ''));
	assert.equal(solidAll.length, 1,
		'and there is still exactly ONE solid primary even with the change notice on screen (DRAFT-UX-C01)');
	// The ≤6 count itself is asserted in ROW 7, in the fixture `draft-ux-c01` uses
	// for it. It cannot be asserted HERE and stay honest: this row's fixture has the
	// change notice up, and that band carries its own pair of actions, so the number
	// here (9) measures a different question than the accepted cap row does. Row 5's
	// count is the FIVE REQUIRED CONTROLS, which is the question this change could
	// actually have broken.

	// The move changed the component's ROOT SHAPE, which is a real regression risk
	// for anything that assumed one root. It is checked here, not assumed: the
	// header is still the FIRST sibling, and the trailing surfaces follow it.
	assert.equal((view.host.children[0] as HTMLElement).getAttribute('data-testid'), 'timetable-simple-header',
		'the header is still the first thing the component renders');
	assert.equal(view.host.children.length, 2,
		'and with a swap armed the trailing surfaces add exactly one more sibling — the banner, which is the only one of them that paints');
});

// ═══ ROW 7 — the ≤6 cap itself, on the fixture the accepted row uses ════════

test('ROW 7 REGRESSION: the move cost NO control — the count is identical before and after, and the pre-existing surplus is named', () => {
	// WHAT THIS ROW DECIDES, AND WHAT IT DELIBERATELY DOES NOT.
	//
	// The claim this row was first written with — "the header is still within the
	// ≤6 visible-control cap" — is FALSE on this fixture, and it was false BEFORE
	// this change too. Measured both ways on this exact fixture, with the same
	// query and the same `hiddenAtDesktop` filter:
	//
	//   pre-move  (this row run against a materialized BASE tree):  7 controls
	//   post-move (this candidate):                                   7 controls
	//   the 7th in BOTH: <button class="inline-flex shrink-0 items-center">
	//
	// The "before" figure comes from running THIS row against the base tree, not
	// from the ROW 4 mutant: ROW 4's mutant arms the swap, and this row's fixture
	// is disarmed, so that mutation is a no-op here and cannot be its evidence.
	//
	// So the number is unchanged by item H, and the surplus is a PRE-EXISTING
	// condition, not one this slice created. Weakening the row to "<= 7", or
	// deleting it, would hide that; AGENTS.md §16 forbids closing a finding by
	// removing the row that found it. So the row now asserts the truth it can
	// decide - the count did not move - and it NAMES the surplus control and its
	// accessible-name problem, which is a real defect for a follow-up slice.
	//
	// The ≤6 cap itself is still asserted where it is true and accepted: on the
	// `draft-ux-c01` S1 fixture, in that suite, which is green. It is not restated
	// here on a richer fixture, because restating it here would be a claim this
	// repository does not currently satisfy.
	const context = operatorStateContext();
	const view = simpleHeader({ ...context, draft: { ...context.draft, inputState: null } });
	const header = view.header();
	assert.equal(view.el('timetable-simple-input-drift'), null, 'the fixture really has no change notice');
	const controls = [...header.querySelectorAll<HTMLElement>('button, a[href], [role="combobox"], input, select')]
		.filter((element) => !hiddenAtDesktop(element, header));
	// 7 = the 6 named controls + ONE pre-existing unlabelled button. See the
	// comment above for the pre-move measurement that makes this a comparison and
	// not a number someone chose.
	assert.equal(controls.length, 7, `item H changed no control count (got ${controls.length}: ${controls.map(describeControl).join(' | ')})`);
	// The pre-existing surplus, named rather than absorbed: a visible button with
	// no testid, no aria-label and no text has NO ACCESSIBLE NAME. This assertion
	// documents the finding as a fact about the current tree; it is a follow-up
	// row for the next slice, not something item H introduced or may silently fix.
	const unnamed = controls.filter((element) => !element.getAttribute('data-testid') && !element.getAttribute('aria-label') && !(element.textContent ?? '').trim());
	assert.equal(unnamed.length, 1, `exactly one header control is unlabelled today (found ${unnamed.length})`);
	// And the same five required controls, minus the change notice, are all present.
	for (const id of REQUIRED_HEADER_CONTROLS) {
		assert.ok(header.contains(view.el(id)!), `${id} is still in the header`);
	}
});

// ═══ ROW 6 — the disarmed guard, unchanged (its own row: one live mount) ═══

test('ROW 6 RENDERED: no armed swap, no banner — the `swapClassTimesMode != null` guard is unchanged', () => {
	// Its own row because two CONCURRENT live `TimetableSimpleHeader` mounts
	// exhaust the heap (see row 1's comment). One mount per row.
	const view = simpleHeader(operatorStateContext(), null);
	assert.ok(view.el('timetable-simple-header'), 'the header still renders with a disarmed swap');
	assert.equal(dom.window.document.querySelector('[data-testid="timetable-swap-class-times-banner"]'), null,
		'no armed swap, no banner — the guard is intact, and the move did not change WHEN it renders');
	// The trailing surfaces paint only when they have something to show, so a
	// disarmed header is the header ALONE. That is the honest shape, and it is why
	// row 5's sibling count is asserted in the ARMED state only.
	assert.equal(view.host.children.length, 1, 'and the header is the only thing the component renders when nothing paints');
});
