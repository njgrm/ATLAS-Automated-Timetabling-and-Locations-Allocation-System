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
 * ── P01 CALIBRATION, 2026-09-30 ──────────────────────────────────────────────
 * This file is calibrated to the header as it is after `c82b8636` (the 30 Sep demo
 * hotfix: calm rows, tabs that never wrap, the readiness chip's short face with the
 * whole sentence in its title) and after A2 HEADER-BUDGET, which replaced the
 * "status region + control row" band this file originally described with ROW 1 /
 * ROW 2 / the change notice's own line.
 *
 * WHAT THE CALIBRATION DID NOT DO, deliberately: it did not relax a row to make it
 * pass. Every superseded assertion is RETAINED VERBATIM in a comment beside its
 * replacement (AGENTS.md §16), the replacement asserts the property the original
 * protected in the form that is true now, and user-facing wording is IMPORTED from
 * the module that owns it (`resolveSimpleReadiness`, `publishBlockedSentence`,
 * `DRAFT_EDIT_NEEDS_SELECTION`) instead of being restated here — so a copy change
 * cannot break this file, and this file cannot pass by matching a copy of itself.
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
	// P01: `DRAFT_DISCARD_UNAVAILABLE` is no longer asserted (a discard action with
	// nothing to act on is HIDDEN, not disabled-with-a-printed-reason — see ROW 4),
	// so it is not imported. Its original assertion is retained verbatim in that row.
	DRAFT_EDIT_NEEDS_SELECTION,
} = await import('@/components/timetable/TimetableDraftStateStrip');
const { resolveSimpleReadiness, SimpleReadinessChip } = await import('@/components/timetable/simple/SimpleSetupSharedControls');
// P01 (2026-09-30): the ONE consequence sentence, imported. The visible chip face
// is asserted structurally (see ROW 2); the wording is asserted against this, so a
// copy change cannot break this file and this file cannot pass on a copy of itself.
const { publishBlockedSentence } = await import('@/lib/timetable-plain-language');

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

test('ROW 1 STRUCTURAL (JSDOM HAS NO LAYOUT ENGINE — the 1366x768 pixel count is Lane C\'s BROWSER row): the band stacks ROW 1, ROW 2 and — only when setup really moved — the change notice\'s own line, and every row that must stay one line DECLARES it', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// THIS IS A STRUCTURAL ROW, NOT A PIXEL ROW. JSDOM HAS NO LAYOUT ENGINE: it
	// cannot set a 1366×768 viewport, cannot lay out a flex row, and therefore
	// CANNOT count the visual lines a scheduler SEES. The true 1366×768 count is
	// a **BROWSER row** (AGENTS.md §11/§12) and is owned by **LANE C on A4's
	// staging** — it is not faked here and it is not claimed here.
	//
	// What IS decided here, and is decided honestly: the class TOKENS that decide
	// it. `lg:flex-nowrap` on a row is the declaration "this row does not wrap from
	// the `lg` breakpoint up", and a row that lacks it can spill. Every assertion
	// below names a token, so a regression that removes it fails here.
	//
	// ── P01 CALIBRATION, 2026-09-30 (what moved, and which rows moved with it) ──
	// The header is no longer "a status region + one control row". A2
	// HEADER-BUDGET (`6e272900`, `bd2bab32`) replaced the band with ROW 1 (title,
	// tabs, ONE chip, primary, Undo, More) + ROW 2 (the pickers + the draft
	// actions), moved the persistent state facts out of the header entirely
	// (`SimpleHeaderTrailingSurfaces`), and `a2b67f4c` gave the change notice its
	// own slim line. `c82b8636` (the demo hotfix this file is calibrated to) then
	// made the TABS never wrap, took the readiness chip's long consequence off the
	// visible face, and returned the undo/redo reasons to their button tooltips.
	//
	// The ORIGINAL ROW 1 assertions, RETAINED VERBATIM (AGENTS.md §16 — a
	// correction marks a row superseded and adds the replacement beside it; it
	// never deletes evidence):
	//
	//   const rows = [...band.children] as HTMLElement[];
	//   assert.equal(rows.length, 2, 'and it really stacks two rows: the status region and the control row');
	//   assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-status-region', 'row 1 is the status region');
	//   const controlRow = rows[1];
	//   assert.ok(controlRow, 'row 2 is the control row');
	//   const statusInner = view.el('timetable-simple-status-region')!.firstElementChild as HTMLElement;
	//   assert.equal(tokensOf(statusInner).has('lg:flex-nowrap'), true,
	//     `the status region declares "no wrap from lg up" (tokens: ${[...statusTokens].join(' ')})`);
	//   const termLine = view.el('timetable-term-scope-line')!;
	//   assert.equal(tokensOf(termLine).has('lg:flex-nowrap'), true, 'the term line does not wrap at `lg` …');
	//   assert.equal(tokensOf(view.el('timetable-term-authority-unverified')!).has('lg:truncate'), true, …);
	//   assert.equal(tokensOf(view.el('timetable-draft-visibility')!).has('lg:truncate'), true, …);
	//   assert.equal(tokensOf(noticeRow).has('lg:truncate'), true,
	//     'each capped notice truncates at `lg` rather than taking a line of its own');
	//
	// WHY EACH IS SUPERSEDED, and by what: the status region, the term line and the
	// capped notice list are NO LONGER INSIDE THE HEADER (A2 HEADER-BUDGET: the
	// header is two calm rows and the run facts live in the trailing surfaces), so
	// asserting a token on them asserted on an element the header does not render.
	// Their behaviour is not lost — `draft-ux-c01` and `a2-header-budget-2026-09-29`
	// own it where those facts now live. What replaces them below are the DECLARATIONS
	// that decide the row count on the surface that is really there.
	// ─────────────────────────────────────────────────────────────────────────
	const view = simpleHeader(operatorStateContext());
	const band = view.el('timetable-simple-header-row')!;
	assert.ok(band, 'the header renders its one row band');

	// DISCRIMINATION: the elements row 1 is about are all really on screen. A row
	// that asserted a token on an absent element would be vacuous.
	assert.ok(tokensOf(band).has('flex-col'), 'the band really is a column, so the line count is its child count');

	// (0) THE SHAPE, ADDRESSED BY TEST ID and not by position. A count alone would
	// pass on any three children; the ids are what say WHICH lines these are.
	const lineIds = [...band.children].map((child) => child.getAttribute('data-testid'));
	assert.deepEqual(lineIds, ['timetable-simple-header-row-1', 'timetable-simple-header-row-2', 'timetable-simple-header-change-row'],
		'the band stacks exactly three lines — ROW 1, ROW 2, and the change notice\'s own line');
	const row1 = view.el('timetable-simple-header-row-1')!;
	const row2 = view.el('timetable-simple-header-row-2')!;
	const changeLine = view.el('timetable-simple-header-change-row')!;
	assert.ok(row1 && row2 && changeLine, 'and all three really render in this fixture');

	// (a) ROW 1 — one line at `lg`, and STILL WRAPPING below it.
	const row1Tokens = tokensOf(row1);
	assert.equal(row1Tokens.has('lg:flex-nowrap'), true,
		`ROW 1 declares "no wrap from lg up" (tokens: ${[...row1Tokens].join(' ')})`);
	assert.equal(row1Tokens.has('flex-wrap'), true,
		'and it KEEPS `flex-wrap` at the base, so the narrow/mobile layout is not broken by this fix');

	// (a2) THE TABS — `c82b8636`. The operator saw `Schedule / Draft / Setup /
	// Policies / Runs` wrap onto a second line at the demo. The fix is a DECLARATION,
	// and this is the assertion that kills a regression of it: `flex-nowrap`, plus
	// `whitespace-nowrap` so a tab label cannot break inside itself, plus `shrink-0`
	// so the tab cluster is never the thing that gives up width.
	const subNav = view.el('timetable-sub-nav')!;
	assert.ok(subNav, 'the title and tabs really are inside ROW 1 (otherwise (a2) would be vacuous)');
	const subNavTokens = tokensOf(subNav);
	assert.equal(subNavTokens.has('flex-nowrap'), true,
		`the tab cluster declares "never wrap" (tokens: ${[...subNavTokens].join(' ')})`);
	assert.equal(subNavTokens.has('flex-wrap'), false,
		'and it no longer carries `flex-wrap`, which is the token that let the tabs wrap');
	assert.equal(subNavTokens.has('whitespace-nowrap'), true, 'a tab label cannot break across two lines');
	assert.equal(subNavTokens.has('shrink-0'), true, 'and the tab cluster keeps its intrinsic width');
	assert.equal(subNav.closest('[data-testid="timetable-simple-header-row-1"]') !== null, true,
		'the tabs live in ROW 1, the line the operator saw them wrap out of');

	// (b) THE RIGHT-HAND CLUSTER: the second `flex-wrap` on ROW 1, and the one that
	// put the chip / primary / Undo / More on a second line.
	const cluster = view.el('timetable-simple-publish-action')!.closest('div')!;
	const clusterTokens = tokensOf(cluster);
	assert.equal(clusterTokens.has('lg:flex-nowrap'), true,
		`the chip/primary/Undo/More cluster declares "no wrap from lg up" (tokens: ${[...clusterTokens].join(' ')})`);

	// (c) ROW 2 — the pickers, same one-line-at-1366 shape, same retained base wrap.
	const row2Tokens = tokensOf(row2);
	assert.equal(row2Tokens.has('lg:flex-nowrap'), true,
		`ROW 2 declares "no wrap from lg up" (tokens: ${[...row2Tokens].join(' ')})`);
	assert.equal(row2Tokens.has('flex-wrap'), true, 'and it KEEPS `flex-wrap` at the base');

	// (d) THE CHANGE NOTICE GETS ITS OWN LINE (`a2b67f4c`). The operator's complaint
	// was that the notice pushed the pickers right; giving it its own line is the fix,
	// so the load-bearing claim is that it is on NEITHER of the two rows.
	const notice = view.el('timetable-simple-input-drift')!;
	assert.ok(notice, 'the change notice is on screen in this fixture (otherwise (d) would be vacuous)');
	assert.equal(changeLine.contains(notice), true, 'the notice sits on its own slim line');
	assert.equal(row1.contains(notice), false, 'and NOT inside ROW 1, so it cannot push the chip or `More` down');
	assert.equal(row2.contains(notice), false, 'and NOT inside ROW 2, so it cannot push the pickers right');
	// A7 c13 SUPERSEDED the C12 ellipsis on this span: the operator saw
	// `Teaching Load and Te…` and ruled that a sentence the scheduler must read
	// WRAPS. Every other elastic child keeps its truncation; this one takes a second
	// line inside its own box (its `shrink-0` siblings hold the line to its budget).
	assert.equal(tokensOf(view.el('timetable-simple-drift-message')!).has('lg:truncate'), false,
		'its SENTENCE wraps instead of truncating — no text on the Class Schedule is cut with an ellipsis');
	assert.equal(tokensOf(notice).has('lg:flex-nowrap'), true,
		'while the notice\'s own children still hold one line from `lg` up');

	// (e) THE READINESS CHIP IS ONE LINE, NEVER AN ELLIPSIS (`c82b8636`). The demo
	// screenshot was the chip squeezed and clipped on BOTH sides. `truncate` is
	// banned by §8 outright, so its absence is the assertion; the visible face is
	// pinned as wording in ROW 2, which is where it belongs.
	const chip = view.el('timetable-simple-readiness-chip')!;
	assert.ok(chip, 'the chip is on screen (otherwise (e) would be vacuous)');
	assert.equal(tokensOf(chip).has('truncate'), false, 'the chip carries no `truncate`, so it cannot ellipsize its face');
	assert.equal(tokensOf(chip).has('whitespace-nowrap'), true, 'and it declares one line for its face');
	assert.equal(view.el('timetable-simple-readiness-consequence')!.hasAttribute('title'), true,
		'the FULL consequence sentence rides the consequence span\'s `title` instead of the visible face');

	// (f) §8's RAW-`title` BAN, NARROWED TO WHAT IT MEANS, and it is `c82b8636` that
	// made the narrowing necessary. The operator's rule is about a CONTROL wearing a
	// `title` (nothing depends on a hover, nothing hides in a tooltip balloon). The
	// hotfix put the chip's full sentence on a plain SPAN, which is not a control and
	// is not a hover affordance for a control's state. So: exactly one `title` in the
	// header, it is that span, and NO control anywhere in the header has one. Both
	// halves are load-bearing — dropping the title and dropping the control ban each
	// fail a different assertion.
	const titled = [...view.header().querySelectorAll('[title]')];
	assert.equal(titled.length, 1,
		`the header has exactly ONE raw \`title\`, the chip consequence's full sentence (found ${titled.length})`);
	assert.equal(titled[0].getAttribute('data-testid'), 'timetable-simple-readiness-consequence',
		'and it is that span, not a control');
	const controlsWithTitle = [...view.header().querySelectorAll<HTMLElement>('button, a[href], input, select, [role="combobox"]')]
		.filter((element) => element.hasAttribute('title'));
	assert.equal(controlsWithTitle.length, 0,
		`and no CONTROL in the header carries a \`title\` (§8) — found ${controlsWithTitle.map((element) => element.getAttribute('data-testid')).join(', ')}`);

	// (g) THE CAPPED NOTICE LIST IS NOT IN THE HEADER, and it is still rendered. A2
	// HEADER-BUDGET moved the run facts out of the header box; what must NOT happen
	// is the fact being dropped to shorten a row. So this asserts both halves: absent
	// from the header, present in the surfaces the header hands it to.
	const noticeRow = view.el('timetable-non-blocking-hard-notice');
	assert.equal(view.header().contains(noticeRow!), false,
		'the capped notice list is not inside the header box — the header is two calm rows');
	assert.ok(noticeRow && (noticeRow.textContent ?? '').trim().length > 0,
		'and the operator\'s rule-break fact is still rendered, just not in the header');
	assert.equal(view.el('timetable-status-messages-more'), null,
		'and with one notice there is nothing to cap, so no "and N more" is invented');
});

// ═══ ROW 2 — the chip's counts, in the operator's words ══════════════════════

test('ROW 2 RENDERED: on the REAL header in the operator\'s own state the chip states BOTH severities and the publish consequence — short on the face, whole in its title', () => {
	const context = operatorStateContext();
	const view = simpleHeader(context);
	const chip = view.el('timetable-simple-readiness-chip')!;
	assert.ok(chip, 'the chip is on screen');

	// THE READINESS LABEL IS DERIVED, NOT COPIED. `resolveSimpleReadiness` is the
	// production derivation the chip itself is handed, so this row cannot pass by
	// repeating whatever the copy happens to be today.
	const readiness = resolveSimpleReadiness(context as never).readiness;
	const face = visibleText(chip).trim();
	assert.equal(face.startsWith(readiness), true,
		`BOTH severities are on the one control, in the production label's own words (read: "${face}")`);
	// The bare-count shape the requirement names cannot render.
	assert.doesNotMatch(face, /^\d+\s+warnings/, 'no bare "149 warnings" face on the chip');

	// ── `c82b8636`: THE LONG CONSEQUENCE CAME OFF THE VISIBLE FACE ─────────────
	// The demo screenshot was this chip squeezed and clipped on BOTH sides, so the
	// hotfix split it: the face carries the readiness label plus a SHORT consequence
	// marker, and the WHOLE sentence rides the span's `title`.
	//
	// ORIGINAL ASSERTION, RETAINED VERBATIM (AGENTS.md §16):
	//
	//   assert.equal(visibleText(chip).trim(),
	//     '3 Must fix, 145 advisories — this schedule cannot be published yet.',
	//     'BOTH severities are on the one control, in plain words, and the consequence is still stated');
	//
	// It is superseded on the FACE only. The property it protected — this control
	// still states the consequence — is asserted immediately below, on the sentence
	// itself, with the sentence IMPORTED rather than restated.
	const consequence = view.el('timetable-simple-readiness-consequence');
	assert.ok(consequence, 'the chip renders its addressable consequence span');
	const full = consequence!.getAttribute('title') ?? '';
	const sharedClause = publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }).split(' — ')[1]!;
	assert.ok(sharedClause.length > 0, 'DISCRIMINATION: the shared consequence clause is a real clause, not an empty split');
	assert.equal(full.startsWith(readiness), true, 'the whole sentence opens with the same severity split the face does');
	assert.equal(full.endsWith(sharedClause), true,
		'and ends in the ONE shared consequence clause, so the sentence is not a second wording invented for the chip');
	assert.equal(full.length > face.length, true,
		`the visible face is SHORTER than the whole sentence (face ${face.length}, sentence ${full.length}) — the chip cannot be clipped by a sentence it does not print`);
	// The split is structural, not a guess about punctuation: the readiness label,
	// then ONE short clause. A face that printed the whole sentence, or only a bare
	// count, fails one of these two.
	const [head, ...clauses] = face.split('·').map((part) => part.trim());
	assert.equal(head, readiness, 'the face opens with exactly the readiness label');
	assert.equal(clauses.length, 1, 'and adds exactly ONE consequence clause');
	assert.ok((clauses[0] ?? '').split(/\s+/).filter(Boolean).length <= 4,
		`and that clause is short enough to keep the chip on one line (read: "${clauses[0]}")`);
	// Nothing depends on a hover: the accessible name carries both halves.
	const aria = chip.getAttribute('aria-label') ?? '';
	assert.match(aria, /3 Must fix, 145 advisories/, 'the chip\'s accessible name states both numbers');
	assert.equal(aria.includes(full), true, 'and the whole consequence sentence, so the full wording is still reachable');
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
	//   both severities  -> BOTH numbers, must-fix first, plus a SHORT consequence
	//   zero must-fix    -> the advisory number alone; NO "0 Must fix" clause
	//   zero advisories  -> the must-fix number alone; NO "0 advisories" clause
	//   nothing at all   -> the honest ready label, not "0 Must fix, 0 advisories"
	//
	// EVERY EXPECTED STRING BELOW IS IMPORTED OR DERIVED (P01, 2026-09-30): the
	// readiness label comes from `resolveSimpleReadiness`, the whole consequence
	// sentence from `publishBlockedSentence`. The original rows pinned the visible
	// face byte for byte, marker included, so a copy change could break this file;
	// the faces are now asserted STRUCTURALLY (the readiness label, then ONE short
	// clause) and the wording is asserted where it is still whole — the `title`.
	const base = {
		draft: { runId: 321, summary: { isPublished: false, unassignedCount: 0 } },
		summary: { unassignedCount: 0 },
		isPreGenerationWorkspace: false,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro-verified' },
		hasGeneratedRun: true,
		isRunPublished: false,
	};
	/** Mount the REAL chip for one snapshot and read both halves of its face. */
	const chipFace = (input: Record<string, unknown>) => {
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
		const span = host.querySelector<HTMLElement>('[data-testid="timetable-simple-readiness-consequence"]');
		const face = visibleText(host).trim();
		const title = span?.getAttribute('title') ?? null;
		act(() => root.unmount());
		host.remove();
		return { face, title, readiness: resolved.readiness, publishBlocked: resolved.publishBlocked };
	};

	// THE OPERATOR'S MEASURED STATE: both severities, so both numbers, must-fix
	// first, plus the short consequence marker and the WHOLE sentence beside it.
	const both = chipFace({ ...base, blockingHardCount: 3, softCount: 145 });
	assert.ok(both.readiness.includes('3') && both.readiness.includes('145'),
		`DISCRIMINATION: the production label really does carry both severities (read: "${both.readiness}")`);
	const [bothHead, ...bothClauses] = both.face.split('·').map((part) => part.trim());
	assert.equal(bothHead, both.readiness, 'the face opens with the severity split');
	assert.equal(bothClauses.length, 1, 'and states the consequence in exactly one clause');
	assert.equal(both.title?.endsWith(publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }).split(' — ')[1] ?? ''), true,
		'while the whole sentence — imported, not restated — rides the span\'s `title`');

	// ZERO MUST-FIX. The advisory count is stated; a "0 Must fix" clause is NOT,
	// because a zero on the blocking side must not read as a problem.
	const noMustFix = chipFace({ ...base, blockingHardCount: 0, softCount: 194 });
	assert.equal(noMustFix.publishBlocked, false,
		'DISCRIMINATION: this state genuinely is not publish-blocked, so the absent clause is the honest one');
	assert.equal(noMustFix.face, noMustFix.readiness,
		'zero must-fix: the advisory count alone, and no consequence clause printed');
	assert.doesNotMatch(noMustFix.face, /\b0\b/, 'a zero on either side is never printed');

	// ZERO ADVISORIES. The must-fix count is stated; no "0 advisories" clause. This
	// is the one state whose WHOLE consequence IS the shared resolver's own
	// sentence, so it is asserted by exact imported equality — the strongest string
	// claim in this file, with no literal of ours in it.
	const noAdvisories = chipFace({ ...base, blockingHardCount: 3, softCount: 0 });
	assert.equal(noAdvisories.face.split('·')[0]!.trim(), noAdvisories.readiness,
		'zero advisories: the must-fix count alone on the face');
	assert.doesNotMatch(noAdvisories.face, /\b0\b/, 'and no zero clause spoken');
	assert.equal(noAdvisories.title, publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }),
		'and the whole consequence is EXACTLY the shared resolver sentence, imported rather than copied');

	// NEITHER. The honest ready label, not a pair of zeros.
	const clear = chipFace({ ...base, blockingHardCount: 0, softCount: 0 });
	assert.equal(clear.face, clear.readiness,
		'neither severity: the honest ready label, never "0 Must fix, 0 advisories"');
	assert.equal(clear.title, null, 'and no consequence sentence at all, because publishing is not blocked');

	// NO REACHABLE STATE PRINTS A LONE UN-SPLIT NUMBER. Every face above is either
	// both numbers, one number with its plain word, or a sentence — none is a
	// severity-free digit.
	for (const [label, state] of [
		['both', both],
		['zero must-fix', noMustFix],
		['zero advisories', noAdvisories],
		['clear', clear],
	] as const) {
		assert.doesNotMatch(state.face, /^\d+$/, `${label}: never a bare number with no word`);
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
//
// P01 CALIBRATION (2026-09-30). A2 HEADER-BUDGET (`6e272900`, `bd2bab32`,
// `a2b67f4c`) moved the two draft actions from the old status strip onto ROW 2
// (`SimpleHeaderDraftActions`), gave each action's reason a `@/ui` Tooltip
// instead of a sentence printed under the button, and hid a control that has
// nothing to act on. So this row now pins WHERE the two actions live, that they
// are the same controls the `More` menu dispatches, and that neither is a second
// dominant control — which is the property `DRAFT-UX-C01` actually protects. The
// rows it superseded are retained verbatim below.

test('ROW 4 RENDERED: `Edit draft` and `Discard draft` sit on ROW 2, each dispatches exactly what its `More`-menu row dispatches, and neither is a dominant control', async () => {
	const recorded: Recorded = { edits: 0, discards: 0 };
	// A class IS selected and the workspace DOES pass the reset-draft
	// confirmation, so both actions are enabled here — the enabled case. The
	// manual-edit entry point is the context's own recorder, so the Edit count is
	// the workspace's real dispatch and not a test-local stand-in.
	const view = simpleHeader(operatorStateContext({
		hasSelectedEntry: true,
		enterManualEditView: () => { recorded.edits += 1; },
	}), recorded);

	// ── THE CONTROLS EXIST, AND ON ROW 2 ─────────────────────────────────────
	const row2 = view.el('timetable-simple-header-row-2')!;
	const stripEdit = view.el('timetable-draft-strip-edit')!;
	const stripDiscard = view.el('timetable-draft-strip-discard')!;
	assert.ok(stripEdit, '`Edit draft` renders');
	assert.ok(stripDiscard, '`Discard draft` renders');
	assert.equal(row2.contains(stripEdit), true,
		'`Edit draft` is on ROW 2 beside the pickers — the header budget put the draft actions there');
	assert.equal(row2.contains(stripDiscard), true, 'and so is `Discard draft`');
	assert.equal(view.el('timetable-simple-header-row-1')!.contains(stripEdit), false,
		'and neither is back on ROW 1, so the chip / primary / `More` line is untouched by them');
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
	// …and the state SENTENCE IS NOT printed beside them any more.
	//
	// ORIGINAL, RETAINED VERBATIM (AGENTS.md §16):
	//   assert.equal(view.el('timetable-draft-state-strip')!.textContent,
	//     'Draft — not visible to teachers until you publish',
	//     'the state SENTENCE element still reads only the run state — the controls are its siblings');
	//
	// SUPERSEDED by A2 HEADER-BUDGET, which passed `visibility={null}` here because
	// the run's state is stated ONCE, in the trailing status band (`a2-header-budget`'s
	// H12 F1 row owns that). The `draft-ux-c01` `A2-C12-ITEM4` rows keep the element
	// and its contract; what changed is that row 2 does not restate the fact.
	assert.equal(view.el('timetable-draft-state-strip')!.textContent, '',
		'ROW 2 prints NO run-state sentence: the fact is stated once, out of the header, and row 2 does not restate it');

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

	// ── ONE DOMINANT CONTROL, AND AN UNAVAILABLE ONE IS NOT IT ───────────────
	// ORIGINAL, RETAINED VERBATIM (AGENTS.md §16):
	//   assert.equal(solid.length, 1,
	//     `and there is still exactly ONE solid primary in the whole header (DRAFT-UX-C01) — found ${solid.length}: …`);
	//   assert.equal(solid[0].getAttribute('data-testid'), 'timetable-simple-publish-action',
	//     'and it is `Publish schedule`, not either new control');
	//
	// SUPERSEDED by A2 C13 item 3 (`bd2bab32`), and for the operator's own stated
	// reason: the ONE solid primary those rows counted was `Publish schedule` while
	// it was DISABLED — `variant="default"` plus `disabled:opacity-50`, i.e. a solid
	// green at half opacity, the reported "pale-green near-miss" that reads as the
	// next step and is not. A blocked header therefore has ZERO solid primaries, and
	// the rule DRAFT-UX-C01 protects ("one dominant control") is enforced as
	// AT MOST ONE, plus never presenting an unavailable control as dominant. The
	// same supersession is recorded beside the identical row in
	// `a2-c11-s2-header-banners.test.tsx`.
	const header = view.header();
	const solid = [...header.querySelectorAll<HTMLElement>('button, a[href]')].filter((element) => /\bbg-primary\b/.test(element.getAttribute('class') ?? ''));
	assert.ok(solid.length <= 1,
		`never more than ONE solid primary in the whole header (DRAFT-UX-C01) — found ${solid.length}: ${solid.map((element) => element.getAttribute('data-testid')).join(', ')}`);
	const publish = view.el('timetable-simple-publish-action')!;
	assert.ok(publish, 'the publication control is still on screen — a reason must be readable, not removed');
	assert.equal(publish.hasAttribute('disabled'), true,
		'and in this run it is honestly DISABLED (3 must-fix), which is the state the near-miss was reported in');
	assert.equal(/\bbg-primary\b/.test(publish.getAttribute('class') ?? ''), false,
		'a disabled control must not wear the primary background (A2 C13 item 3)');
	assert.equal(/\bbg-muted\b/.test(publish.getAttribute('class') ?? ''), true,
		'and wears the plainly-unavailable treatment instead');
	assert.ok((view.el('timetable-simple-publish-short-reason')?.textContent ?? '').trim().length > 0,
		'with its reason printed beside it in words, not hover-only');
	assert.equal(header.querySelectorAll('[data-testid="timetable-simple-publish-action"]').length, 1,
		'item 4 added no second publication control');

	// ── THE CONTROL COUNT ITEM 4 CHANGES ────────────────────────────────────
	// ORIGINAL, RETAINED VERBATIM (AGENTS.md §16):
	//   const changeNoticeActions = controls.filter((element) => {
	//     const id = element.getAttribute('data-testid') ?? '';
	//     return id === 'timetable-simple-impact-preview' || id === 'timetable-simple-regenerate-to-apply';
	//   }).length;
	//   assert.equal(controls.length, 9 + changeNoticeActions,
	//     `the header's controls are the 7 item H kept plus the strip's 2, plus this fixture's ${changeNoticeActions} change-notice action(s) (got ${controls.length}: …)`);
	//
	// WHY IT IS SUPERSEDED: A2 HEADER-BUDGET gave ROW 1 the title and the five tabs
	// (§8: "row 1 = title, tabs, ONE status chip, the primary action and `More`"),
	// so a single total over the whole header counted five navigation links that the
	// rule deliberately places apart from actions. The TOTAL-count contract is not
	// dropped: `draft-ux-c01`'s `S1R` row owns it ("at most 7 ACTION controls plus
	// the 5 sub-nav tabs §8 places in row 1, in BOTH run states") and passes. What
	// replaces the magic total here is the shape it was standing in for — which
	// control is on WHICH line — asserted BY TEST ID, which is what a future row
	// moving a control will break.
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
	/** Name a control the way a failing row can be read: test id first, then its
	 * accessible name, then its own face. A `null` here would mean an unnamed
	 * control, which the last assertion in this row forbids. */
	const nameOf = (element: Element) => element.getAttribute('data-testid')
		?? element.getAttribute('aria-label')
		?? (element.textContent ?? '').trim();
	const controlIds = (lineId: string) => [...header.querySelectorAll<HTMLElement>(`[data-testid="${lineId}"] button, [data-testid="${lineId}"] a[href]`)]
		.filter((element) => !hiddenAtDesktop(element))
		.map(nameOf);

	const row1Controls = controlIds('timetable-simple-header-row-1');
	assert.deepEqual(row1Controls.filter((id) => id?.startsWith('timetable-sub-nav-')),
		['timetable-sub-nav-schedule', 'timetable-sub-nav-draft', 'timetable-sub-nav-setup', 'timetable-sub-nav-policies', 'timetable-sub-nav-runs'],
		'ROW 1 carries exactly the five navigation links — the title-and-tabs half §8 places there');
	assert.deepEqual(row1Controls.filter((id) => !id?.startsWith('timetable-sub-nav-')),
		['timetable-simple-warnings-control', 'timetable-simple-publish-action', 'timetable-simple-undo-control', 'timetable-simple-more-trigger'],
		'and beside them exactly FOUR controls: the ONE status chip, the primary, Undo and `More` (§8 row 1)');
	// ROW 2 is asserted by its STABLE members and its COUNT, not by a list of visible
	// labels: the entity picker's accessible name is user-facing copy, and pinning it
	// here would let a copy change break a structural row.
	const row2Controls = controlIds('timetable-simple-header-row-2');
	assert.equal(row2Controls.length, 5,
		`ROW 2 carries exactly five controls — the Term picker, the view-type picker, the schedule sheet, and the two draft actions (got ${row2Controls.length}: ${row2Controls.join(' | ')})`);
	assert.ok(row2Controls.includes('timetable-simple-term-filter') && row2Controls.includes('timetable-simple-view-mode-select'),
		'and the pickers are on it');
	assert.deepEqual(row2Controls.filter((id) => id?.startsWith('timetable-draft-strip-')),
		['timetable-draft-strip-edit', 'timetable-draft-strip-discard'],
		'the two draft actions are the last thing on that line, right-aligned');
	assert.equal(row2Controls.includes('timetable-simple-publish-action'), false, 'and ROW 2 carries NO primary');
	assert.equal(row2Controls.some((id) => /^timetable-sub-nav-/.test(id ?? '')), false, 'and no tab link');

	// The change notice's own line, and its AT MOST two sanctioned actions.
	const changeNoticeActions = controls.filter((element) => {
		const id = element.getAttribute('data-testid') ?? '';
		return id === 'timetable-simple-impact-preview' || id === 'timetable-simple-regenerate-to-apply';
	}).length;
	assert.ok(changeNoticeActions <= 2, 'a change notice carries AT MOST its two sanctioned actions, by contract');
	assert.equal(changeNoticeActions, 2,
		'and in this fixture it carries both, on its own line rather than inside a header row');
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

test('ROW 4 RENDERED: a draft action with nothing to act on is DISABLED with its reason in the accessible name and a focusable `@/ui` tooltip — never a sentence printed under it — and one with nothing at all to act on is hidden, not dead', () => {
	// THE GUARDS, AS THE PRODUCTION DERIVATION DECIDES THEM, and the reasons come
	// from the module that owns them (`TimetableDraftStateStrip`), so this row cannot
	// pass by matching a copy of the wording.
	//
	// ── SUPERSEDED IN PART (A2 HEADER-BUDGET, operator 2026-09-29) ──────────────
	// ORIGINAL ASSERTIONS, RETAINED VERBATIM (AGENTS.md §16):
	//
	//   const stripEdit = view.el('timetable-draft-strip-edit')!;
	//   const stripDiscard = view.el('timetable-draft-strip-discard')!;
	//   assert.ok(stripDiscard, '`Discard draft` still RENDERS when it cannot act');
	//   assert.equal(stripDiscard.getAttribute('disabled'), '', '`Discard draft` is disabled with no handler');
	//   assert.equal(view.el('timetable-draft-strip-discard-reason')!.textContent, DRAFT_DISCARD_UNAVAILABLE,
	//     '`Discard draft` states the EXISTING unavailable reason, in visible text');
	//   assert.ok(discardSubtree.includes(DRAFT_DISCARD_UNAVAILABLE), '…inside ITS control\'s own subtree');
	//
	// §8's header-budget rule replaced both halves of that: a disabled action states
	// its reason in a `@/ui` Tooltip, not as a sentence printed beneath it, and an
	// action with nothing to act on is HIDDEN (the `More` menu keeps it). The
	// properties they protected are asserted below in the form that is now true — the
	// reason is reachable WITHOUT a pointer and without a printed sentence — and the
	// hide/show pair is asserted in BOTH directions so hiding can never quietly
	// become deleting.
	const view = simpleHeader(operatorStateContext({ hasSelectedEntry: false }), { edits: 0, discards: 0 }, {
		// `onDiscardDraft` deliberately NOT passed: the surface offers no handler, so
		// there is nothing for that control to do.
		onDiscardDraft: undefined,
	});
	const stripEdit = view.el('timetable-draft-strip-edit')!;
	assert.ok(stripEdit, '`Edit draft` RENDERS — a draft IS on screen, so the verb is real even with nothing selected');
	assert.equal(stripEdit.getAttribute('disabled'), '', 'and it is disabled with no class selected');

	// THE REASON: in the ACCESSIBLE NAME, and in a `@/ui` Tooltip. Never a raw
	// `title` (§8) and never a sentence printed under the button (§8 header budget).
	assert.equal(stripEdit.hasAttribute('title'), false, 'no `title` carries the Edit reason');
	assert.equal(view.el('timetable-draft-strip-edit-reason'), null, 'and no reason is printed beneath the control');
	assert.equal(stripEdit.getAttribute('aria-label'), `Edit draft — ${DRAFT_EDIT_NEEDS_SELECTION}`,
		'the accessible name carries the EXISTING selection reason, imported from the module that owns it');
	// …and the tooltip is REACHABLE. A disabled `<button>` takes no pointer events and
	// cannot take focus, so a tooltip placed on IT never fires. The production wrapper
	// (`GatedAction`) puts the tooltip on a FOCUSABLE span instead — which is the whole
	// difference between a reason a keyboard or touch user can reach and a reason that
	// only a mouse can find.
	const wrapper = stripEdit.parentElement!;
	assert.equal(wrapper.tagName.toLowerCase(), 'span', 'the disabled control is wrapped, not bare');
	assert.equal(wrapper.getAttribute('tabindex'), '0',
		'the wrapper is FOCUSABLE, so the tooltip fires for keyboard and touch users too');

	// `Discard draft` with nothing at all to act on is HIDDEN on row 2 — §8's "only
	// the actions that still have something to act on".
	assert.equal(view.el('timetable-draft-strip-discard'), null,
		'`Discard draft` is hidden when the surface supplies no handler');
	// …and it is hidden, not deleted: give it something to act on and it returns.
	const withHandler = simpleHeader(operatorStateContext({ hasSelectedEntry: false }), { edits: 0, discards: 0 });
	const back = withHandler.el('timetable-draft-strip-discard');
	assert.ok(back, 'with a discard handler it renders again — the hidden state is the rule, not a deletion');
	assert.equal(back!.hasAttribute('disabled'), false, 'and with a handler and a draft it is genuinely enabled');
	assert.equal(withHandler.el('timetable-draft-strip-discard-reason'), null,
		'and an ENABLED action prints no reason under it either');
});


// ═══ ROW 5 — MUTANT ═════════════════════════════════════════════════════════

test('ROW 5 MUTANT (this row is the mutant\'s target, and it is a REAL assertion): ROW 2 declares `lg:flex-nowrap`', () => {
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
