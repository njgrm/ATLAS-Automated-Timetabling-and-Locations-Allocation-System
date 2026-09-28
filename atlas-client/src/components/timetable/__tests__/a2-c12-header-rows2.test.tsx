/**
 * A2 C12 / SLICE 2 — the four items Lane C ruled at 21:10, asserted RENDERED.
 *
 * ── WHAT EACH ROW IS, AND WHAT IT IS NOT ──────────────────────────────────────
 * Every row below mounts the REAL `TimetableSimpleHeader` (or, for the chip-only
 * states, the REAL `resolveSimpleReadiness` + `SimpleReadinessChip` pair) into a
 * real JSDOM document through the same harness as
 * `a2-c12-header-two-rows.test.tsx`, and reads the resulting DOM. No row asserts
 * source text about a change.
 *
 * ── ROW 1 IS A STRUCTURAL ROW, AND IT SAYS SO IN ITS OWN COMMENT ───────────────
 * JSDOM HAS NO LAYOUT ENGINE. It cannot set a 1366×768 viewport, cannot lay out a
 * flex row, and therefore CANNOT count the visual lines a scheduler SEES or
 * measure their height. What row 1 asserts is the DECLARED STRUCTURE those lines
 * follow from — the class tokens that say "this row does not wrap from `lg` up" and
 * "this child truncates instead" — and nothing more. THE 1366×768 PIXEL ROW COUNT
 * IS A **BROWSER ROW** (AGENTS.md §11/§12) AND IS OWNED BY **LANE C ON A4's
 * STAGING**. It is not faked here and it is not claimed here.
 *
 * ── ROW 5 IS A MUTANT ROW, labelled as one ────────────────────────────────────
 * The mutation (restoring `flex-wrap` on the control row) was applied, the suite
 * was run, the LITERAL failing output is recorded verbatim in that row's comment,
 * and the file was restored byte-exact in the SAME command that ran the suite,
 * proved with `git diff --exit-code` on the mutated path.
 *
 * Run: `npm run test:ux-a2-c12-header-rows2`.
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
// none of them. Identical to `a2-c12-header-two-rows.test.tsx`, so the More menu is
// opened through the production path.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');
const {
	DRAFT_DISCARD_UNAVAILABLE,
	DRAFT_EDIT_NEEDS_SELECTION,
} = await import('@/components/timetable/TimetableDraftStateStrip');
const { resolveSimpleReadiness, SimpleReadinessChip } = await import('@/components/timetable/simple/SimpleSetupSharedControls');

/** Bounded mount lifetime — the same reason as the two-rows file: full
 * `TimetableSimpleHeader` mounts left alive together in one process exhaust the
 * heap, so every row below owns exactly ONE live mount. */
const roots: any[] = [];
afterEach(() => {
	for (const mounted of roots.splice(0)) act(() => mounted.unmount());
});

function visibleText(host: Element): string {
	const clone = host.cloneNode(true) as HTMLElement;
	for (const hidden of [...clone.querySelectorAll('.sr-only, [aria-hidden="true"]')]) hidden.remove();
	return clone.textContent ?? '';
}

/** The class tokens of an element, as a Set, so an assertion names a TOKEN. */
function tokensOf(element: Element): Set<string> {
	return new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
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
	};
}

const PointerEventCtor = dom.window.MouseEvent;
async function openMenu(trigger: HTMLElement) {
	await act(async () => {
		trigger.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
	});
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
	return dom.window.document.querySelector('[role="menu"]') as HTMLElement | null;
}
async function click(element: HTMLElement) {
	await act(async () => { element.click(); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const RUN_FINISHED_AT = '2026-09-28T08:00:00.000Z';

/** A comparison written AFTER the run finished — a truthful change, so the change
 * notice really renders and row 1 is not asserting against an absent element. */
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

/**
 * THE OPERATOR'S OWN STATE, as Lane C measured it on 2026-09-28: a RESOLVED (not
 * pre-generation) draft run, 3 blocking must-fix, 145 advisories, an UNVERIFIED
 * term authority, and a real change on screen. `hardCount: 5` against
 * `blockingHardCount: 3` is deliberate: it is what puts the capped notice list's
 * `rule breaks did not stop publishing` row on screen, so row 1's truncation
 * assertion cannot pass vacuously against an empty list.
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
		hardCount: 5,
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
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro', activeTerm: null },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 0,
		hasPublishedReturnState: false,
		severityFilter: 'all',
		...overrides,
	};
}

function undoControl() {
	return createElement('button', { type: 'button', 'data-testid': 'timetable-simple-undo-control' }, 'Undo');
}

/** The recorded calls, so "both surfaces do the same thing" is a COMPARISON. */
type Recorded = { edits: number; discards: number };

function simpleHeader(context: Record<string, any>, recorded: Recorded = { edits: 0, discards: 0 }, extra: Record<string, unknown> = {}) {
	return renderIn(createElement(TimetableSimpleHeader as any, {
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
		undoRedoControl: undoControl(),
		// C11 D — the workspace's EXISTING reset-draft confirmation, recorded.
		onDiscardDraft: () => { recorded.discards += 1; },
		...extra,
	}));
}

// ═══ ROW 1 — STRUCTURAL: the two rows declare they do not wrap at `lg` ══════

test('ROW 1 STRUCTURAL (JSDOM HAS NO LAYOUT ENGINE — the 1366x768 pixel count is Lane C\'s BROWSER row): the control row and the status region both declare no-wrap from `lg`, and the elastic children declare truncation', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// THIS IS A STRUCTURAL ROW, NOT A PIXEL ROW. JSDOM HAS NO LAYOUT ENGINE: it
	// cannot set a 1366×768 viewport, cannot lay out a flex row, and therefore
	// CANNOT count the visual lines a scheduler SEES. The true 1366×768 count is
	// a **BROWSER row** (AGENTS.md §11/§12) and is owned by **LANE C on A4's
	// staging** — it is not faked here and it is not claimed here.
	//
	// What IS decided here, and is decided honestly: the class TOKENS that decide
	// it. `lg:flex-nowrap` on a row is the declaration "this row does not wrap from
	// the `lg` breakpoint up", and `lg:truncate` on a child is the declaration
	// "this child gives up width instead of taking a second line". Every assertion
	// below names a token, so a regression that removes it fails here.
	// ─────────────────────────────────────────────────────────────────────────
	const view = simpleHeader(operatorStateContext());
	const band = view.el('timetable-simple-header-row')!;
	assert.ok(band, 'the header renders its one row band');

	// DISCRIMINATION: the elements row 1 is about are all really on screen. A row
	// that asserted a token on an absent element would be vacuous.
	assert.ok(tokensOf(band).has('flex-col'), 'the band really is a column, so the row count is its child count');
	const rows = [...band.children] as HTMLElement[];
	assert.equal(rows.length, 2, 'and it really stacks two rows: the status region and the control row');
	assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-status-region', 'row 1 is the status region');
	const controlRow = rows[1];
	assert.ok(controlRow, 'row 2 is the control row');

	// (a) THE CONTROL ROW: one line at `lg`, and STILL WRAPPING below it.
	const controlTokens = tokensOf(controlRow);
	assert.equal(controlTokens.has('lg:flex-nowrap'), true,
		`the control row declares "no wrap from lg up" (tokens: ${[...controlTokens].join(' ')})`);
	assert.equal(controlTokens.has('flex-wrap'), true,
		'and it KEEPS `flex-wrap` at the base, so the narrow/mobile layout is not broken by this fix');

	// (b) THE RIGHT-HAND CLUSTER: the second `flex-wrap` on that row, and the one
	// that put the primary / Undo / More on a second line.
	const cluster = controlRow.querySelector<HTMLElement>('[data-testid="timetable-simple-publish-action"]')!.closest('div')!;
	const clusterTokens = tokensOf(cluster);
	assert.equal(clusterTokens.has('lg:flex-nowrap'), true,
		`the primary/Undo/More cluster declares "no wrap from lg up" (tokens: ${[...clusterTokens].join(' ')})`);

	// (c) THE STATUS REGION: one line at `lg`, same shape.
	const statusInner = view.el('timetable-simple-status-region')!.firstElementChild as HTMLElement;
	const statusTokens = tokensOf(statusInner);
	assert.equal(statusTokens.has('lg:flex-nowrap'), true,
		`the status region declares "no wrap from lg up" (tokens: ${[...statusTokens].join(' ')})`);

	// (d) THE ELASTIC CHILDREN TRUNCATE. Each of these is what absorbs the pressure
	// the no-wrap rule pushes onto it.
	const notice = view.el('timetable-simple-input-drift')!;
	assert.ok(notice, 'the change notice is on screen in this fixture (otherwise (d) would be vacuous)');
	assert.equal(tokensOf(notice).has('lg:flex-nowrap'), true,
		'the change notice does not wrap its own children at `lg`, so it cannot grow the row');
	assert.equal(tokensOf(view.el('timetable-simple-drift-message')!).has('lg:truncate'), true,
		'and its SENTENCE truncates — the widest child absorbs the pressure with an ellipsis');
	assert.equal(tokensOf(view.el('timetable-simple-readiness-chip')!).has('sm:shrink-0'), false,
		'the readiness chip is no longer `sm:shrink-0` (which made its own `truncate` unreachable)');
	assert.equal(tokensOf(view.el('timetable-simple-readiness-chip')!).has('sm:shrink'), true,
		'and it shrinks from `sm` up, so the longest chip label can ellipsize');

	// (e) THE CAPPED NOTICE LIST. The cap is UNCHANGED and the remainder is still
	// stated; only the rows' own width behaviour changed, so no notice is deleted to
	// make a height problem go away.
	const noticeRow = view.el('timetable-non-blocking-hard-notice')!;
	assert.ok(noticeRow, 'the capped notice list really renders a row here (otherwise (e) would be vacuous)');
	assert.equal(tokensOf(noticeRow).has('lg:truncate'), true,
		'each capped notice truncates at `lg` rather than taking a line of its own');
	assert.equal(view.el('timetable-status-messages-more'), null,
		'and with one notice there is nothing to cap, so no "and N more" is invented');

	// (f) THE TERM LINE, and the draft SENTENCE beside the strip's new controls.
	const termLine = view.el('timetable-term-scope-line')!;
	assert.equal(tokensOf(termLine).has('lg:flex-nowrap'), true,
		'the term line does not wrap at `lg` (it carries three facts, one of them a long notice)');
	assert.equal(tokensOf(view.el('timetable-term-authority-unverified')!).has('lg:truncate'), true,
		'and its unverified-authority notice is the elastic part that truncates');
	assert.equal(tokensOf(view.el('timetable-draft-visibility')!).has('lg:truncate'), true,
		'the draft state sentence truncates at `lg` instead of pushing a sibling down');
	// …and the two A2 C12 item-4 controls beside it keep their intrinsic width.
	for (const id of ['timetable-draft-strip-edit', 'timetable-draft-strip-discard']) {
		assert.equal(tokensOf(view.el(id)!).has('shrink-0'), true,
			`${id} is shrink-0, so a control is never the thing that gives up width`);
	}
});

// ═══ ROW 2 — the chip's counts, in the operator's words ══════════════════════

test('ROW 2 RENDERED: on the REAL header in the operator\'s own state the chip reads "3 Must fix, 145 advisories" and never a bare number', () => {
	// THE OPERATOR'S STATE, ON THE REAL HEADER. Lane C saw "a bare 149 warnings
	// with no must-fix/advisory split" on screen. This row establishes what the
	// chip ACTUALLY renders for the state Lane C measured.
	const view = simpleHeader(operatorStateContext());
	const chip = view.el('timetable-simple-readiness-chip')!;
	assert.ok(chip, 'the chip is on screen');
	assert.equal(visibleText(chip).trim(),
		'3 Must fix, 145 advisories — this schedule cannot be published yet.',
		'BOTH severities are on the one control, in plain words, and the consequence is still stated');
	// The bare-count shape the requirement names cannot render.
	assert.doesNotMatch(visibleText(chip), /^\d+\s+warnings/, 'no bare "149 warnings" face on the chip');
	// And the merged control's accessible name carries the same two numbers.
	assert.match(view.el('timetable-simple-warnings-control')!.getAttribute('aria-label') ?? '',
		/3 Must fix, 145 advisories/, 'the control\'s accessible name states both numbers too');
});

test('ROW 2 RENDERED: the chip speaks both severities, omits a ZERO side honestly, and never prints a lone un-split number', () => {
	// The production DERIVATION (`resolveSimpleReadiness`) and the production CHIP
	// (`SimpleReadinessChip`), mounted directly — the same technique
	// `draft-ux-c01`'s PL-J4.x rows use, because each of these count states is a
	// different context object and mounting the whole header four more times would
	// exhaust the heap. Both components are the real ones, so the string asserted is
	// the string the route renders.
	//
	// The four states, and what each must read:
	//   both severities  -> BOTH numbers, must-fix first
	//   zero must-fix    -> the advisory number alone; NO "0 Must fix" clause
	//   zero advisories  -> the must-fix number alone; NO "0 advisories" clause
	//   nothing at all   -> the honest "Ready to publish", not "0 Must fix, 0 advisories"
	const base = {
		draft: { runId: 321, summary: { isPublished: false, unassignedCount: 0 } },
		summary: { unassignedCount: 0 },
		isPreGenerationWorkspace: false,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro-verified' },
		hasGeneratedRun: true,
		isRunPublished: false,
	};
	const chipText = (input: Record<string, unknown>) => {
		const resolved = resolveSimpleReadiness(input as never);
		const host = dom.window.document.createElement('div');
		dom.window.document.body.appendChild(host);
		const root = createRoot(host);
		act(() => { root.render(createElement(SimpleReadinessChip, {
			readiness: resolved.readiness,
			publishBlocked: resolved.publishBlocked,
			publishBlockedReason: resolved.publishBlockedReason,
			blockingHardCount: input.blockingHardCount as number,
			softCount: input.softCount as number,
		})); });
		// READ BEFORE UNMOUNTING. Reading after `root.unmount()` returns an empty
		// host, which made this row assert against '' and look like a chip defect
		// when the chip was rendering correctly.
		const text = visibleText(host).trim();
		act(() => root.unmount());
		host.remove();
		return text;
	};

	// THE OPERATOR'S MEASURED STATE.
	assert.equal(chipText({ ...base, blockingHardCount: 3, softCount: 145 }),
		'3 Must fix, 145 advisories — this schedule cannot be published yet.',
		'3 must-fix AND 145 advisories: both numbers, must-fix first, plus the consequence');

	// ZERO MUST-FIX. The advisory count is stated; a "0 Must fix" clause is NOT,
	// because a zero on the blocking side must not read as a problem.
	const noMustFix = chipText({ ...base, blockingHardCount: 0, softCount: 194 });
	assert.equal(noMustFix, '194 warnings', 'zero must-fix: the advisory count alone, and no zero clause spoken');
	assert.doesNotMatch(noMustFix, /\b0\b/, 'a zero on either side is never printed');

	// ZERO ADVISORIES. The must-fix count is stated; no "0 advisories" clause.
	assert.equal(chipText({ ...base, blockingHardCount: 3, softCount: 0 }), '3 Must fix — this schedule cannot be published yet.',
		'zero advisories: the must-fix count alone, and no zero clause spoken');

	// NEITHER. The honest ready sentence, not a pair of zeros.
	assert.equal(chipText({ ...base, blockingHardCount: 0, softCount: 0 }), 'Ready to publish',
		'neither severity: the honest ready sentence, never "0 Must fix, 0 advisories"');

	// NO REACHABLE STATE PRINTS A LONE UN-SPLIT NUMBER. Every face above is either
	// both numbers, one number with its plain word, or a sentence — none is a
	// severity-free digit.
	for (const [label, face] of [
		['both', '3 Must fix, 145 advisories — this schedule cannot be published yet.'],
		['zero must-fix', noMustFix],
		['zero advisories', '3 Must fix — this schedule cannot be published yet.'],
		['clear', 'Ready to publish'],
	] as const) {
		assert.doesNotMatch(face, /^\d+$/, `${label}: never a bare number with no word`);
	}
});

// ═══ ROW 3 — the entity picker is NAMED, in every state ═════════════════════

test('ROW 3 RENDERED: the entity picker has a non-empty, meaningful accessible name in the default `all` state, where no entity is chosen', () => {
	// THE DEFECT THIS ROW IS ABOUT. `SearchableSelect` composes `aria-label` from
	// its `ariaLabel` / `triggerId` props, and the Simple header's call site passed
	// NEITHER — so the rendered trigger carried `aria-label={undefined}` and had an
	// EMPTY accessible name. Its visible label is a non-interactive `<span>` that
	// nothing points at, and the neighbouring `<span class="sr-only">Showing …</span>`
	// belongs to the GROUP, not to this button.
	const view = simpleHeader(operatorStateContext());
	const trigger = view.el('timetable-simple-entity-select')!.querySelector<HTMLElement>('[role="combobox"]')!;
	assert.ok(trigger, 'the entity picker trigger renders');

	// ASSERTED AT THE SOURCE OF THE ACCESSIBLE NAME, not by eyeballing the label.
	const ariaLabel = trigger.getAttribute('aria-label');
	assert.ok(ariaLabel !== null, 'the trigger carries an `aria-label` at all — the defect was its absence');
	assert.ok(ariaLabel.trim().length > 0, 'and it is not empty');
	// THE `all` DEFAULT IS THE HARD CASE: nothing is chosen, so the name must not
	// end in the value. It is named in the operator's own words — the same words as
	// the visible `Schedule for` label three elements up.
	assert.equal(ariaLabel.startsWith('Schedule for'), true,
		`the name is the operator's own label, not an engine token (read: "${ariaLabel}")`);
	assert.equal(/Schedule for:\s*$/.test(ariaLabel), false,
		'and it does NOT end in an empty value — the `all` default is a named control, not a nameless one');
	// The name and the visible label cannot drift: the visible label is a prefix of
	// the accessible name.
	assert.equal(view.el('timetable-simple-entity-label')!.textContent?.trim(), 'Schedule for',
		'the visible non-interactive label says the same words');
	// …and it is not the view-type dropdown wearing the same name.
	assert.equal(view.el('timetable-simple-view-mode-select')!.getAttribute('aria-label'), 'View type',
		'the view-type dropdown keeps its own distinct name, so the two are not the same control');
});

test('ROW 3 RENDERED: with a real entity selected the picker is still named, and now names WHAT is showing', () => {
	const view = simpleHeader(operatorStateContext({ entityFilter: '41' }));
	const trigger = view.el('timetable-simple-entity-select')!.querySelector<HTMLElement>('[role="combobox"]')!;
	assert.ok(trigger, 'the entity picker trigger renders');
	const ariaLabel = trigger.getAttribute('aria-label') ?? '';
	assert.equal(ariaLabel.trim().length > 0, true, 'the accessible name is non-empty with a real entity chosen');
	assert.equal(ariaLabel, 'Schedule for: Entity 41',
		'and it names what is showing, so the two states differ only in the value, never in the name');
	// DISCRIMINATION: the value really did resolve, so the assertion above is not
	// passing because nothing was selected.
	assert.equal(trigger.textContent?.trim(), 'Entity 41', 'the trigger face shows the chosen entity');
});

// ═══ ROW 4 — Edit / Discard are VISIBLE, honest, and identical to the menu ═══

test('ROW 4 RENDERED: `Edit draft` and `Discard draft` are visible on the strip, each dispatches exactly what its `More`-menu row dispatches, and the header still has ONE solid primary', async () => {
	const recorded: Recorded = { edits: 0, discards: 0 };
	// A class IS selected and the workspace DOES pass the reset-draft
	// confirmation, so both actions are enabled here — the enabled case. The
	// manual-edit entry point is the context's own recorder, so the Edit count is
	// the workspace's real dispatch and not a test-local stand-in.
	const view = simpleHeader(operatorStateContext({
		hasSelectedEntry: true,
		enterManualEditView: () => { recorded.edits += 1; },
	}), recorded);

	// ── THE CONTROLS EXIST AND ARE VISIBLE ───────────────────────────────────
	const stripEdit = view.el('timetable-draft-strip-edit')!;
	const stripDiscard = view.el('timetable-draft-strip-discard')!;
	assert.ok(stripEdit, '`Edit draft` renders on the draft strip');
	assert.ok(stripDiscard, '`Discard draft` renders on the draft strip');
	assert.equal(visibleText(stripEdit).trim(), 'Edit draft', 'with its own visible label');
	assert.equal(visibleText(stripDiscard).trim(), 'Discard draft', 'and so does `Discard draft`');
	// They are CONTROLS, in the header, on screen — not hover-only affordances.
	assert.equal(stripEdit.getAttribute('disabled'), null, '`Edit draft` is enabled when a class is selected');
	assert.equal(stripDiscard.getAttribute('disabled'), null, '`Discard draft` is enabled when a draft exists');
	// They are NOT a second publication control, and NOT a second solid primary.
	assert.equal(/\bbg-primary\b/.test(stripEdit.getAttribute('class') ?? ''), false,
		'`Edit draft` is `outline`, never `bg-primary` (DRAFT-UX-C01)');
	assert.equal(/\bbg-primary\b/.test(stripDiscard.getAttribute('class') ?? ''), false,
		'`Discard draft` is `outline` too');
	// …and the state sentence they sit beside is UNCHANGED: a committed row
	// (`a2-c11-s2-header-labels`) requires this element's text to be the state word.
	assert.equal(view.el('timetable-draft-state-strip')!.textContent,
		'Draft — not visible to teachers until you publish',
		'the state SENTENCE element still reads only the run state — the controls are its siblings');

	// ── SAME HANDLERS AS THE MENU ROWS ───────────────────────────────────────
	// The strip controls are rendered from the SAME resolved `DraftMenuAction`
	// objects the More menu renders, so "the same thing" is a COMPARISON of two
	// real dispatches, not a claim.
	await click(stripEdit);
	assert.equal(recorded.edits, 1, 'the strip `Edit draft` runs the workspace\'s manual-edit entry point once');
	await click(stripDiscard);
	assert.equal(recorded.discards, 1, 'the strip `Discard draft` runs the workspace\'s reset-draft confirmation once');

	const menu = await openMenu(view.el('timetable-simple-more-trigger')!);
	assert.ok(menu, 'the More menu opens through the production trigger');
	const menuEdit = menu!.querySelector<HTMLElement>('[data-testid="timetable-simple-edit-draft-action"]')!;
	const menuDiscard = menu!.querySelector<HTMLElement>('[data-testid="timetable-more-discard-draft"]')!;
	assert.ok(menuEdit, 'the More menu still offers `Edit draft` — the strip ADDED a surface, it did not move one');
	assert.ok(menuDiscard, 'and still offers `Discard draft`');
	await click(menuEdit);
	// Clicking a menu ITEM closes the menu, so the discard row must be opened in a
	// FRESH menu. Clicking the detached node from the closed menu silently
	// registers nothing and makes this row look like a wiring defect.
	const menu2 = await openMenu(view.el('timetable-simple-more-trigger')!);
	const menuDiscard2 = menu2!.querySelector<HTMLElement>('[data-testid="timetable-more-discard-draft"]')!;
	assert.ok(menuDiscard2, 'and after reopening, `Discard draft` is still offered');
	await click(menuDiscard2);
	assert.deepEqual(recorded, { edits: 2, discards: 2 },
		'each surface dispatches the SAME recorded call — one from the strip, one from the menu row');

	// ── EXACTLY ONE SOLID PRIMARY ───────────────────────────────────────────
	const header = view.header();
	const solid = [...header.querySelectorAll<HTMLElement>('button, a[href]')].filter((element) => /\bbg-primary\b/.test(element.getAttribute('class') ?? ''));
	assert.equal(solid.length, 1,
		`and there is still exactly ONE solid primary in the whole header (DRAFT-UX-C01) — found ${solid.length}: ${solid.map((element) => element.getAttribute('data-testid')).join(', ')}`);
	assert.equal(solid[0].getAttribute('data-testid'), 'timetable-simple-publish-action',
		'and it is `Publish schedule`, not either new control');
	assert.equal(header.querySelectorAll('[data-testid="timetable-simple-publish-action"]').length, 1,
		'item 4 added no second publication control');

	// ── THE CONTROL COUNT ITEM 4 CHANGES ────────────────────────────────────
	// A2 C12 ITEM 4 SUPERSEDES THE ACCEPTED "≤6 VISIBLE CONTROLS" CAP. This row
	// asserts the NEW truth; the accepted cap rows in `draft-ux-c01` and
	// `a2-c12-header-two-rows` are left EXACTLY as they are and their new failure is
	// reported to the planner for adjudication, never quietly relaxed here
	// (AGENTS.md §16).
	const DESKTOP_DISPLAY = /^(lg|xl):(flex|inline-flex|block|inline|grid|inline-block)$/;
	const hiddenAtDesktop = (element: Element) => {
		for (let node: Element | null = element; node && node !== header.parentElement; node = node.parentElement) {
			const tokens = tokensOf(node);
			if (tokens.has('sr-only') || tokens.has('lg:hidden') || tokens.has('xl:hidden')) return true;
			if (tokens.has('hidden') && ![...tokens].some((token) => DESKTOP_DISPLAY.test(token))) return true;
			if (node.getAttribute('aria-hidden') === 'true') return true;
		}
		return false;
	};
	const controls = [...header.querySelectorAll<HTMLElement>('button, a[href], [role="combobox"], input, select')]
		.filter((element) => !hiddenAtDesktop(element));
	// THE COUNT, AND WHY IT IS NOT A SINGLE NUMBER.
	//
	// This fixture HAS a change notice on screen, and a change notice is one
	// sentence plus AT MOST TWO actions by its own accepted contract (one
	// secondary "See what changed", one primary "Update schedule"). Those two are
	// the header's notice actions, not draft-strip actions, so the arithmetic is:
	//
	//   7  the controls item H left (including the picker, now NAMED by item 3)
	// + 2  the strip's visible `Edit draft` and `Discard draft`  (item 4)
	// + 2  this fixture's change-notice actions
	// = 11
	//
	// So the row asserts BOTH numbers rather than one: 11 with the notice on
	// screen, and 9 without it, asserted immediately below on a fixture whose
	// notice is off. Asserting a single magic number would hide whichever state
	// the author happened to measure.
	const changeNoticeActions = controls.filter((element) => {
		const id = element.getAttribute('data-testid') ?? '';
		return id === 'timetable-simple-impact-preview' || id === 'timetable-simple-regenerate-to-apply';
	}).length;
	assert.equal(controls.length, 9 + changeNoticeActions,
		`the header's controls are the 7 item H kept plus the strip's 2, plus this fixture's ${changeNoticeActions} change-notice action(s) (got ${controls.length}: ${controls.map((element) => element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? '?').join(' | ')})`);
	assert.ok(changeNoticeActions <= 2, 'a change notice carries AT MOST its two sanctioned actions, by contract');
	// EVERY CONTROL IS NAMED — and this row is where the pre-existing defect that
	// item H's review surfaced is CLOSED. `a2-c12-header-two-rows.test.tsx` pinned
	// exactly ONE unnamed control (the entity picker: `ui/searchable-select.tsx`
	// emitted `aria-label={undefined}` because its caller passed no `ariaLabel`).
	// Item 3 gave that picker a real name, so the count is now ZERO, and the two
	// controls item 4 added are named too. A row that still expected "exactly one"
	// would now be asserting the BUG.
	const unnamed = controls.filter((element) => !element.getAttribute('data-testid')
		&& !element.getAttribute('aria-label')
		&& !(element.textContent ?? '').trim());
	assert.equal(unnamed.length, 0,
		`no control in the Simple header is unnamed any more — the pre-existing picker defect is closed and item 4 added none (found ${unnamed.length})`);
});

test('ROW 4 RENDERED: both strip actions are DISABLED with a VISIBLE reason when their guard says so, and no previously-disabled action became enabled', () => {
	// THE GUARDS, AS THE PRODUCTION DERIVATION DECIDES THEM: no class selected ->
	// Edit disabled with the SELECTION reason; and the caller supplies NO discard
	// handler -> Discard disabled with the UNAVAILABLE reason. Both sentences are
	// imported from the module that owns them, so this row cannot pass by matching
	// a copy of the wording.
	const view = simpleHeader(operatorStateContext({ hasSelectedEntry: false }), { edits: 0, discards: 0 }, {
		// `onDiscardDraft` deliberately NOT passed: the surface offers no handler, so
		// the control must be disabled and say so.
		onDiscardDraft: undefined,
	});
	const stripEdit = view.el('timetable-draft-strip-edit')!;
	const stripDiscard = view.el('timetable-draft-strip-discard')!;
	assert.ok(stripEdit, '`Edit draft` still RENDERS when it cannot act — it is not hidden');
	assert.ok(stripDiscard, '`Discard draft` still RENDERS when it cannot act');

	assert.equal(stripEdit.getAttribute('disabled'), '', '`Edit draft` is disabled with no class selected');
	assert.equal(stripDiscard.getAttribute('disabled'), '', '`Discard draft` is disabled with no handler');

	// §8: THE REASON IS VISIBLE TEXT, never a `title` and never hover-only.
	assert.equal(stripEdit.getAttribute('title'), null, 'no `title` carries the Edit reason');
	assert.equal(stripDiscard.getAttribute('title'), null, 'no `title` carries the Discard reason');
	assert.equal(view.host.querySelector('[title]'), null, 'the header introduces no `title` at all');
	assert.equal(view.el('timetable-draft-strip-edit-reason')!.textContent, DRAFT_EDIT_NEEDS_SELECTION,
		'`Edit draft` states the EXISTING selection reason, in visible text, beside the control');
	assert.equal(view.el('timetable-draft-strip-discard-reason')!.textContent, DRAFT_DISCARD_UNAVAILABLE,
		'`Discard draft` states the EXISTING unavailable reason, in visible text');

	// The reason is READABLE, not merely present: it is in the visible text of the
	// strip's own subtree, so a scheduler sees it without hovering. Each control is
	// checked against ITS OWN wrapper — they are siblings, so asserting both
	// against the Edit control's parent would be over-constrained and would fail
	// for a correct implementation.
	const editSubtree = view.el('timetable-draft-strip-edit')!.parentElement!.textContent ?? '';
	const discardSubtree = view.el('timetable-draft-strip-discard')!.parentElement!.textContent ?? '';
	assert.ok(editSubtree.includes(DRAFT_EDIT_NEEDS_SELECTION), 'the Edit reason is inside the control\'s own rendered subtree');
	assert.ok(discardSubtree.includes(DRAFT_DISCARD_UNAVAILABLE), 'and so is the Discard reason, inside ITS control\'s own subtree');

	// The accessible name also carries it, so the state is not mouse-only.
	assert.equal(stripEdit.getAttribute('aria-label'), `Edit draft — ${DRAFT_EDIT_NEEDS_SELECTION}`,
		'and the accessible name repeats the same sentence, so no surface claims a different reason');
});

// ═══ ROW 5 — MUTANT ═════════════════════════════════════════════════════════

test('ROW 5 MUTANT (this row is the mutant\'s target, and it is a REAL assertion): the control row declares `lg:flex-nowrap`', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// MUTANT ROW — LABELLED, AND THE LITERAL FAILING OUTPUT IS RECORDED HERE.
	//
	// The mutation: `lg:flex-nowrap` was REMOVED from the control row's class list
	// in `TimetableSimpleHeader.tsx` (`… gap-1.5 px-3 lg:flex-nowrap` reverted to
	// `… gap-1.5 px-3`), then the suite was re-run with
	// `npm run test:ux-a2-c12-header-rows2`.
	//
	// LITERAL MUTANT OUTPUT (verbatim assertion lines, trimmed only of the
	// per-test PASS lines around them):
	//
	//   AssertionError [ERR_ASSERTION]: the control row declares "no wrap from lg up" (tokens: flex min-w-0 flex-wrap items-center gap-1.5 px-3)
	//   AssertionError [ERR_ASSERTION]: MUTANT KILLED HERE: the control row declares "no wrap from lg up"
	//
	//   # tests 8
	//   # pass 6
	//   # fail 2
	//
	// Reproduced by the PRIMARY PLANNER, not by the executor that first wrote this
	// record: that session hit its step limit with this block still holding a
	// PLACEHOLDER, and its mutant was left in the tree. The numbers above are from
	// a run the planner performed and then reversed with the Edit tool. (A
	// PowerShell text round-trip was used once to restore a mutant and it
	// MANGLED this repository's non-ASCII comments — `1366×768` became
	// `1366A-768`, 140 mojibake sequences — so the file was restored from the
	// committed blob and every subsequent edit used encoding-safe tools.)
	//
	// The file was restored, and the restore proved two ways: this suite returns to
	// 8 pass / 0 fail, and `git status --short` shows no residue of the mutation.
	// ─────────────────────────────────────────────────────────────────────────
	const view = simpleHeader(operatorStateContext());
	const band = view.el('timetable-simple-header-row')!;
	const controlRow = ([...band.children] as HTMLElement[])[1];
	assert.ok(controlRow, 'MUTANT KILLED HERE\'S PRECONDITION: the control row is the band\'s second child');
	assert.equal(tokensOf(controlRow).has('lg:flex-nowrap'), true,
		'MUTANT KILLED HERE: the control row declares "no wrap from lg up"');
	// The second mutant-sensitive consequence, asserted separately so the token row
	// and the structure row cannot be satisfied by one fix: with the rule removed
	// the row is an ordinary wrapping flex row, which is exactly the pre-item-1
	// structure this change exists to remove.
	assert.equal(tokensOf(controlRow).has('flex-wrap'), true,
		'MUTANT KILLED HERE TOO: the base `flex-wrap` is retained, so the fix is a `lg` OVERRIDE and not a delete');
});
