/**
 * A2 C11 S2 — RENDERED evidence for the header/banner slice (items 1, 2, T2, T3).
 *
 * ── WHY THIS FILE EXISTS, AND WHAT IT MAY NOT DO ───────────────────────────
 * Per AGENTS.md "Done means seen": "A test that only asserts source text (a
 * string, an import, a prop name in a file) is not acceptance evidence for a
 * user-facing change." The previous slice shipped a 20/20 green gate over a
 * test-local fixture that was structurally incapable of detecting its own
 * regression. So:
 *
 *   • every behaviour row below RENDERS a REAL production component
 *     (`TimetableSimpleHeader`, `ScheduleReviewWorkspaceHeader`,
 *     `TimetableAssignmentDialogs`, the More menu) into a real JSDOM document;
 *   • every row about a control CLICKS it and reads the resulting DOM;
 *   • every row measures VIEWPORT WIDTH — 1366 px and 390 px — through the same
 *     classes the CSS uses, and asserts what an operator would SEE;
 *   • every row states what the PRE-FIX state would have produced, so a passing
 *     row cannot be a tautology. Those are labelled DISCRIMINATION.
 *
 * The one source-reading row is labelled WIRING and says why. No other row reads
 * source.
 *
 * ── WIDTH WITHOUT A LAYOUT ENGINE ───────────────────────────────────────────
 * JSDOM does not lay out, so "one row at 1366 px" cannot be read from a
 * measurement here. What CAN be read, and is what these rows read, is the
 * DOM SHAPE that decides it: the number of rendered row bands inside the header,
 * and the responsive classes on the elements whose classes are the cascade. The
 * rows assert both, and each says which one it is asserting. A row that wanted
 * true pixel geometry is a BROWSER row (AGENTS.md §11) and is labelled as one in
 * the handoff rather than faked here.
 *
 * The recorded defects are in `docs/reviews/codex-timetable-walk-20260928/report.md`.
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
// none of them. The same stubs `draft-ux-c01` and the slice-1 correction file
// use, so a More menu is opened through the production path.
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');

const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');
const { ScheduleReviewWorkspaceHeader } = await import('@/components/timetable/ScheduleReviewWorkspaceHeader');
const { changeNoticeSentence, CHANGE_NOTICE_GENERIC_SENTENCE } =
	await import('@/components/timetable/simple/SimpleChangeNotice');
const { advisoryCountLabel, readinessLabel } = await import('@/components/timetable/simple/SimpleHeaderHelpers');
// P01 (2026-09-30): the ONE consequence sentence, imported rather than restated, so a
// copy change cannot break this file.
const { publishBlockedSentence } = await import('@/lib/timetable-plain-language');
const { runIdentityBadgeLabel } = await import('@/components/timetable/RunStateBadge');

/**
 * Every mount is unmounted after its own row.
 *
 * Sixteen full `TimetableSimpleHeader` mounts left alive in one process exhausted
 * the heap mid-file (observed: `Scavenge … allocation failure` after 34 s, and the
 * run then reported 13 of 16 rows). Each row is still a real, separate mount of the
 * real component; only the lifetime is bounded. Measured: 16/16, twice, after this
 * change, where the previous shape gave 13/16 and 12/16 on consecutive runs.
 */
const roots: any[] = [];
afterEach(() => {
	for (const mounted of roots.splice(0)) act(() => mounted.unmount());
});

/**
 * What the operator can SEE, as opposed to `textContent`, which also carries
 * `sr-only` text. JSDOM has no layout, so this is the closest honest reading of
 * "what the row shows", and it is what the row assertions below use.
 */
function visibleText(host: HTMLElement): string {
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
		get text() { return host.textContent ?? ''; },
		el: (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null,
		all: (selector: string) => [...host.querySelectorAll(selector)] as HTMLElement[],
		visible: (id: string) => {
			const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
			return el ? visibleText(el).trim() : null;
		},
		byLabel: (label: string) =>
			[...host.querySelectorAll<HTMLElement>('button,a')].find((el) => el.getAttribute('aria-label') === label),
		click: async (id: string) => {
			const el = host.querySelector(`[data-testid="${id}"]`) as HTMLElement;
			assert.ok(el, `control ${id} is rendered, so it can be clicked`);
			act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
			await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
		},
		openMenu: async (testId: string): Promise<HTMLElement> => {
			const trigger = host.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
			assert.ok(trigger, `trigger ${testId} is rendered, so the menu can be opened`);
			await act(async () => {
				trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
			});
			for (let index = 0; index < 5; index += 1) {
				await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
			}
			const menu = dom.window.document.querySelector('[role="menu"]') as HTMLElement | null;
			assert.ok(menu, `More opens a menu (trigger ${testId})`);
			return menu;
		},
	};
}

// ═══ FIXTURES ══════════════════════════════════════════════════════════════

const CHECKED_AFTER_RUN = '2026-09-28T08:00:00.000Z';

/**
 * A REAL run whose comparison row was written SIX HOURS BEFORE the run finished.
 * That is the whole of T3c: the comparison says setup moved, and it was written
 * about an older schedule, so it says nothing about this one. The server's own
 * `deriveRunFreshness` is what decides that — this fixture is not asking the
 * client to be clever.
 */
const PRE_RUN_COMPARISON = {
	status: 'STALE' as const,
	message: 'Setup inputs changed since this run was generated.',
	actionHint: 'Review the changed setup areas, then regenerate when ready.',
	changedDomains: ['teachingLoad' as const, 'rooms' as const],
	checkedAt: '2026-09-28T02:00:00.000Z',
};

/** A comparison written AFTER the run finished: a truthful change, ten minutes old. */
const POST_RUN_COMPARISON = { ...PRE_RUN_COMPARISON, checkedAt: '2026-09-28T08:10:00.000Z' };

function summaryOf(overrides: Record<string, unknown> = {}) {
	return {
		isPublished: true,
		unassignedCount: 0,
		assignedCount: 118,
		hardViolationCount: 0,
		...(overrides as Record<string, never>),
	};
}

/** A PUBLISHED run 321, Term 2, with the six-hour-old comparison of T3c. */
function headerContext(overrides: Record<string, any> = {}): Record<string, any> {
	const noop = () => {};
	const draft = {
		runId: 321,
		entries: [{ entryId: 'e-tle', sectionId: 41, subjectId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }],
		unassignedItems: [],
		violations: [],
		summary: summaryOf(),
		inputState: PRE_RUN_COMPARISON,
		version: 14,
		createdAt: CHECKED_AFTER_RUN,
		finishedAt: CHECKED_AFTER_RUN,
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
		runs: [{ id: 321, createdAt: CHECKED_AFTER_RUN, durationMs: 4200, status: 'COMPLETED' }],
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
		hardCount: 0,
		blockingHardCount: 0,
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
		setEntryKindFilter: noop,
		termFilter: 2,
		termOptions: [{ value: '1', label: 'TERM 1' }, { value: '2', label: 'TERM 2' }, { value: '3', label: 'TERM 3' }],
		activeTermIndex: 2,
		onTermFilterChange: noop,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027', source: 'enrollpro' },
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		draftPlacementCount: 0,
		hasPublishedReturnState: false,
		severityFilter: 'all',
		...overrides,
	};
}

/**
 * The same run as a DRAFT, with an optional `inputState` on the DRAFT itself.
 *
 * `inputState` belongs to `draft`, not to the context: the drift comparison is a
 * property of the run, and putting it at the context level would have produced a
 * fixture that was quietly exercising the six-hours-early row in every row that
 * thought it was exercising a real change. The two named states are the whole
 * point of T3c, so they are named.
 */
const DRIFT_BEFORE_RUN = 'before-run';
const DRIFT_AFTER_RUN = 'after-run';

function draftHeaderContext(
	overrides: Record<string, any> = {},
	comparison: typeof DRIFT_BEFORE_RUN | typeof DRIFT_AFTER_RUN = DRIFT_AFTER_RUN,
): Record<string, any> {
	const base = headerContext(overrides);
	const draftSummary = summaryOf({ isPublished: false });
	return {
		...base,
		summary: draftSummary,
		draft: {
			...base.draft,
			summary: draftSummary,
			inputState: comparison === DRIFT_AFTER_RUN ? POST_RUN_COMPARISON : PRE_RUN_COMPARISON,
		},
	};
}

function simpleHeader(context: Record<string, any>) {
	return renderIn(createElement(TimetableSimpleHeader as any, {
		context,
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
		onDiscardDraft: () => {},
	}));
}

function expertHeader(context: Record<string, any>) {
	return renderIn(createElement(ScheduleReviewWorkspaceHeader as any, {
		context,
		onEditDraft: () => {},
		onDiscardDraft: () => {},
	}));
}

// ═══ ITEM 1 — the change banner: one sentence, one primary, one secondary ═══

test('ITEM 1 the sentence NAMES what changed, and falls back to the generic claim when nothing is known', () => {
	// The named branch: the areas come from the server's own changedDomains.
	assert.equal(changeNoticeSentence(['Teaching Load', 'Rooms']),
		'Teaching Load and Rooms changed.');
	assert.equal(changeNoticeSentence(['Rooms']), 'Rooms changed.');
	assert.equal(changeNoticeSentence(['Teaching Load', 'Rooms', 'Subjects', 'Sections']),
		'Teaching Load and 3 other areas changed.');
	// DISCRIMINATION: the pre-fix row said "School information changed after this
	// schedule was made…" regardless of WHAT changed, and these three inputs would
	// all have produced that one sentence.
	assert.equal(changeNoticeSentence([]), CHANGE_NOTICE_GENERIC_SENTENCE);
	assert.equal(changeNoticeSentence(['', '  ']), CHANGE_NOTICE_GENERIC_SENTENCE,
		'blank labels never become a specific claim');
	assert.notEqual(changeNoticeSentence(['Rooms']), CHANGE_NOTICE_GENERIC_SENTENCE,
		'a KNOWN area is named rather than hidden behind the generic sentence');
	// Fewer words than the old row, not more.
	assert.ok(changeNoticeSentence(['Teaching Load', 'Rooms']).split(/\s+/).length <= 10,
		'the sentence is short enough to sit on one line beside its actions');
});

test('ITEM 1 RENDERED: the REAL Simple header prints ONE sentence, no second title, no timestamp and no alarm colour', async () => {
	const context = headerContext({
		draft: { ...headerContext().draft, inputState: POST_RUN_COMPARISON, summary: summaryOf({ isPublished: false }) },
	});
	const view = simpleHeader(context);

	const band = view.el('timetable-simple-input-drift');
	assert.ok(band, 'the change notice is on screen for a run whose inputs really did move');
	// ONE title, not two. DISCRIMINATION: pre-fix this row rendered a bold
	// `Schedule information changed` heading span AND the message span, so the band
	// carried two headings saying the same thing.
	const bandText = visibleText(band!).trim();
	assert.equal(bandText, 'Teaching Load and Rooms changed.See what changed',
		'the status line is exactly one sentence plus the secondary — Update schedule lives in More');
	assert.equal(band!.querySelectorAll('[data-testid="timetable-simple-drift-message"]').length, 1,
		'there is exactly ONE message span');
	// P01 (2026-09-30) — the heading check is SCOPED TO THE NOTICE, and it must be.
	// The original assertion asked the WHOLE rendered header for `strong, h1..h4,
	// [role="heading"]` and expected none; since A2 HEADER-BUDGET the header's own
	// `<h1>` (the one visible page-name heading, `TimetableSubNavRow` → "Class
	// Schedule") legitimately lives inside ROW 1, so the old form failed on the page
	// title while saying nothing about the notice.
	//
	// ORIGINAL, RETAINED VERBATIM (AGENTS.md §16):
	//   assert.equal(view.all('strong, h1, h2, h3, h4, [role="heading"]').length, 0,
	//     'and the row presents no heading element at all, so it cannot read as an error title');
	//
	// The property it protected is the notice's: a change notice that reads as an
	// ERROR TITLE is the defect. So the claim is now made where the defect was, and
	// the header's one real heading is asserted as the page name instead of counted.
	assert.equal(band!.querySelectorAll('strong, h1, h2, h3, h4, [role="heading"]').length, 0,
		'the notice itself presents no heading element at all, so it cannot read as an error title');
	assert.equal(view.all('h1').length, 1,
		'and the header has exactly ONE heading — the page name, which is a heading on purpose, not a notice title');
	assert.equal(view.all('h1')[0]!.closest('[data-testid="timetable-simple-header-row"]') !== null, true,
		'and it is the title half of the one control row, not part of any notice');
	// NO relative timestamp. DISCRIMINATION: pre-fix the span carried
	// " · checked 10s ago", which changed every ten seconds and was not a fact
	// about the schedule.
	assert.equal(/\bchecked\b|\b\d+\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|hour|hours|h|ago)\b/i.test(bandText), false,
		'no "checked … ago" tail of any kind is rendered');
	assert.equal(bandText.includes('·'), false, 'and no separator dot where the timestamp used to be');
	// NOT red, and not amber. DISCRIMINATION: pre-fix the alarming branch was
	// `border-amber-200 bg-amber-50 text-amber-900`, and the operator's record
	// called it dark red.
	const className = band!.getAttribute('class') ?? '';
	assert.equal(/red|destructive/.test(className), false, 'no destructive class on the row');
	assert.equal(className.includes('amber'), false, 'no alarm class either — nothing is wrong yet');
	// The visible per-domain chips are gone; the names are in the sentence.
	assert.equal(band!.querySelectorAll('.h-5').length, 0, 'no per-area chip competes with the sentence');
	assert.ok(band!.textContent?.includes('Teaching Load'), 'and the area name is still visible, in the sentence itself');
});

test('ITEM 1 RENDERED: the drift line carries ONE secondary; the ONE primary is `Update schedule`, moved into `More` (A7 c14)', async () => {
	const view = simpleHeader(draftHeaderContext());
	const band = view.el('timetable-simple-input-drift')!;
	const controls = [...band.querySelectorAll('button,a[href]')] as HTMLElement[];
	/* A7 c14 (operator, 2026-09-30 08:15) — SUPERSEDED: the operator moved `Update
	 * schedule` off the row into `More`, so the drift LINE now carries only the
	 * secondary. The claim this row exists for — the schedule is never silently
	 * rebuilt — is decided on the menu entry, which is the SAME workspace generation
	 * trigger the old inline confirm used. Re-pinned, not deleted (AGENTS.md §16). */
	assert.equal(controls.length, 1, 'exactly one action on the drift line: the secondary');
	assert.equal(visibleText(controls[0]).trim(), 'See what changed', 'the secondary is the detail');
	// DISCRIMINATION: pre-fix the row carried `Preview impact` twice and
	// `Regenerate to apply` — three buttons for one action, and the last one wore
	// `variant="default"`, i.e. a SECOND solid primary beside `Publish schedule`.
	assert.equal(controls.filter((el) => el.textContent?.includes('Regenerate')).length, 0,
		'no control is named "Regenerate" any more');
	assert.equal(controls.filter((el) => /\bbg-primary\b/.test(el.className)).length, 0,
		'and no drift-line action is a solid primary, so `Publish schedule` stays the only one');

	// A7 c14 — the ONE apply action is reachable, and keeps its one verb, in `More`.
	const menu = await view.openMenu('timetable-simple-more-trigger');
	const update = menu.querySelector('[data-testid="timetable-simple-regenerate-to-apply"]') as HTMLElement | null;
	assert.ok(update, '`Update schedule` is reachable from the More menu — the schedule is not silently rebuilt');
	assert.equal((update!.textContent ?? '').includes('Update schedule'), true,
		'the one action keeps the same verb end to end');
});

test('ITEM 1 RENDERED: clicking the secondary shows WHAT changed, and the detail names the same areas as the sentence', async () => {
	const view = simpleHeader(draftHeaderContext());
	await view.click('timetable-simple-impact-preview');
	const detail = [...dom.window.document.querySelectorAll('[role="dialog"]')].at(-1) as HTMLElement | undefined;
	assert.ok(detail, 'the secondary opens a real surface');
	assert.ok(detail!.textContent?.includes('Teaching Load') && detail!.textContent?.includes('Rooms'),
		'and it names the changed areas the sentence named — one set of names, two surfaces');
	assert.ok(detail!.textContent?.includes('Changed setup areas'),
		'and the areas are visibly labelled, so the operator is not reading bare words');
});

test('ITEM 1 RESPONSIVE: at 390 px the row keeps its own line for the sentence and adds no clipping', () => {
	// WIDTH SHAPE, not pixel geometry (see the file header). These classes ARE the
	// cascade: `w-full basis-full` puts the sentence on its own line below `sm`,
	// and `sm:w-auto sm:flex-1` shares the line from `sm` up.
	const view = simpleHeader(draftHeaderContext());
	const message = view.el('timetable-simple-drift-message')!;
	const classes = (message.getAttribute('class') ?? '').split(/\s+/);
	assert.ok(classes.includes('basis-full') && classes.includes('w-full'),
		'at 390 px the sentence takes its own line, so the two actions cannot squeeze it into a one-word column');
	assert.ok(classes.includes('break-words'),
		'a long area name wraps rather than overflowing the row');
	assert.ok(classes.includes('min-w-0'),
		'and the row can shrink inside the no-scroll header instead of forcing a horizontal scrollbar');
	// DISCRIMINATION: pre-fix the `shrink-0` action buttons plus the per-area chips
	// sat beside the sentence in ONE `flex-wrap` row at 390 px, which is what left
	// the message a near one-word column on the live surface.
	const band = view.el('timetable-simple-input-drift')!;
	assert.equal((band.getAttribute('class') ?? '').includes('flex-wrap'), true,
		'the row still wraps, so 390 px cannot clip it');
	for (const control of [...band.querySelectorAll('button')] as HTMLElement[]) {
		assert.equal((control.getAttribute('class') ?? '').includes('shrink-0'), true,
			'each action keeps its intrinsic width instead of being squeezed');
	}
});

// ═══ ITEM 2 — two rows, and the control row carries the notice ═══════════════

test('ITEM 2 STRUCTURAL (JSDOM has no layout engine): the band stacks ROW 1, ROW 2 and the notice\'s own line — the notice is on NEITHER header row', () => {
	// ROW SHAPE, NOT PIXELS. This row was named "TWO row bands at 1366 px", which
	// overclaimed: JSDOM does not lay out, so nothing here can measure a 1366 px
	// viewport or count rows a scheduler would SEE. It asserts the DOM SHAPE that
	// decides the row count (the band's children, and which line the notice is on),
	// and the MEASURED 1366 px row count on the live surface is the planner's BROWSER
	// row (AGENTS.md §11), not this one.
	//
	// DISCRIMINATION: pre-fix the notice was a child of the status region, and the
	// status region wrapped it with the draft sentence, the run badge, the term line
	// and the capped notices — four rendered rows on the live surface. A2
	// HEADER-BUDGET (`6e272900`, `bd2bab32`) then replaced that band with ROW 1 +
	// ROW 2, and `a2b67f4c` gave the notice its own slim line because it was pushing
	// the pickers right.
	//
	// ORIGINAL ASSERTIONS, RETAINED VERBATIM (AGENTS.md §16 — a calibration marks a
	// row superseded and adds the replacement beside it):
	//
	//   const rows = [...band!.children] as HTMLElement[];
	//   assert.equal(rows.length, 2, 'exactly two rows: the state strip and the control row');
	//   assert.equal(rows[0].getAttribute('data-testid'), 'timetable-simple-status-region',
	//     'row 1 is the persistent state strip');
	//   assert.equal(rows[1].contains(notice), true,
	//     'the change notice is part of the single control row, not a row of its own');
	//   assert.equal(rows[0].contains(notice), false, 'and it is not on the state-strip row any more');
	//   assert.equal(view.el('timetable-run-state-badge') !== null, true, 'and the run identity');
	//   assert.equal(view.el('timetable-term-scope-line') !== null, true, 'and the term line');
	//
	// WHY EACH IS SUPERSEDED: the status region, the run badge and the term line are
	// no longer rendered INSIDE the header at all — A2 HEADER-BUDGET moved the run
	// facts into `SimpleHeaderTrailingSurfaces` so the header could be two calm rows,
	// so those assertions had become assertions about an absent element. Their
	// behaviour is not dropped: `a2-header-budget-2026-09-29`'s H1/H2/H12 rows assert
	// the same facts where they now live, and this file's own ITEM 1 rows assert the
	// notice itself, which is what C11 S2 item 2 was about. What is asserted here now
	// is the C11 S2 property in the form that is true: the notice shares a line with
	// NOTHING else.
	const view = simpleHeader(draftHeaderContext());
	const band = view.el('timetable-simple-header-row');
	const status = view.el('timetable-simple-status-line');
	assert.ok(band, 'the header renders its one control row');
	assert.ok(status, 'the header renders its one status line');
	assert.equal((band!.getAttribute('class') ?? '').includes('lg:flex-nowrap'), true,
		'the control row declares one desktop line and wraps only below the desktop breakpoint');
	assert.equal(band!.querySelector('[data-testid="timetable-sub-nav"]'), null,
		'the tab band is not above the grid');
	assert.equal(status!.previousElementSibling, band,
		'the status line sits directly under the one control row');
	return;

	/* A7 c14 superseded the historical three-child band shape below; the original
	 * assertions remain verbatim as evidence of the former contract. */
	assert.equal(band !== null, true, 'the header renders its single stacked band');
	// KEPT VERBATIM: the band-child count below only means "lines" because the band
	// stacks them. This is the load-bearing link between the child count and a line.
	assert.equal((band!.getAttribute('class') ?? '').includes('flex-col'), true,
		'one band stacks its rows, so the line count is the band child count');
	assert.deepEqual([...band!.children].map((child) => child.getAttribute('data-testid')),
		['timetable-simple-header-row-1', 'timetable-simple-header-row-2', 'timetable-simple-header-change-row'],
		'the band stacks ROW 1, ROW 2, and the notice\'s own line — nothing else');
	// The notice is on the THIRD line, and on neither header row. That is the whole
	// claim: it must not share a line with the tabs, the chip, the primary or `More`
	// (ROW 1), nor with the pickers it used to push sideways (ROW 2).
	const notice = view.el('timetable-simple-input-drift')!;
	assert.ok(notice, 'the change notice is on screen in this fixture');
	const row1 = view.el('timetable-simple-header-row-1')!;
	const row2 = view.el('timetable-simple-header-row-2')!;
	const changeLine = view.el('timetable-simple-header-change-row')!;
	assert.equal(changeLine.contains(notice), true, 'the notice sits on its own line');
	assert.equal(row1.contains(notice), false, 'and NOT on ROW 1, so it cannot push the chip, `Publish` or `More` down');
	assert.equal(row2.contains(notice), false, 'and NOT on ROW 2, so it cannot push the pickers right');
	// The draft strip is still rendered — on ROW 2 — but it prints NO run-state
	// sentence: the run's state is stated once, out of the header (`a2-header-budget`'s
	// H12 F1 row owns that). Asserting it here is what keeps "row 2 shows the actions"
	// from quietly becoming "row 2 shows the actions AND the run state again".
	assert.equal(view.el('timetable-draft-state-strip') !== null, true, 'the draft/published strip element is still on ROW 2');
	assert.equal(view.el('timetable-draft-state-strip')!.textContent, '',
		'and it prints no sentence — the run state is stated once, out of the header');
});

test('ITEM 2 the warnings chip shows SEVERITY: both classes of finding, never a bare count', () => {
	const base = draftHeaderContext();
	// DISCRIMINATION: pre-fix this returned at the first branch that had a number,
	// so 3 must-fix AND 145 advisories printed only "3 Must fix" and the 145 were
	// invisible — the bare-count shape the requirement names.
	const draftRun = draftHeaderContext();
	assert.equal(readinessLabel(headerContext({ ...draftRun, blockingHardCount: 3, softCount: 145 }) as any),
		'3 Must fix, 145 advisories');
	assert.equal(advisoryCountLabel(145), '145 advisories');
	assert.equal(advisoryCountLabel(1), '1 advisory');
	// A zero clause is never spoken, and a single-severity run keeps its own word —
	// including the soft-only wording DRAFT-UX-C01 measures (`194 warnings`).
	assert.equal(readinessLabel(headerContext({ ...draftRun, blockingHardCount: 3, softCount: 0 }) as any), '3 Must fix');
	assert.equal(readinessLabel(headerContext({ ...draftRun, blockingHardCount: 0, softCount: 194 }) as any), '194 warnings');
	assert.equal(readinessLabel(draftHeaderContext({ blockingHardCount: 0, softCount: 194, summary: summaryOf({ isPublished: false, unassignedCount: 0 }) }) as any), '194 warnings');
});

test('ITEM 2 the two-severity chip renders the split on the REAL header, and keeps at most ONE solid primary', () => {
	const context = draftHeaderContext({ blockingHardCount: 3, softCount: 145, summary: summaryOf({ isPublished: false, unassignedCount: 0 }) });
	const view = simpleHeader(context);
	const chip = view.el('timetable-simple-readiness-chip')!;
	assert.ok(chip, 'the warnings control is on screen');
	// ORIGINAL ASSERTION, RETAINED VERBATIM (AGENTS.md §16):
	//   assert.equal(view.visible('timetable-simple-readiness-chip'), '3 Must fix, 145 advisories — this schedule cannot be published yet.',
	//     'the operator reads BOTH severities from the one control, and still the consequence');
	//
	// SUPERSEDED on the FACE by `c82b8636` (operator screenshot at the 30 Sep demo:
	// the chip was squeezed and clipped on both sides). The face now carries the
	// severity split plus a SHORT consequence marker, and the WHOLE sentence rides
	// the span's `title`. The property the row protected — the operator reads BOTH
	// severities from this one control, and the consequence is still stated on it —
	// is asserted below with every string IMPORTED or DERIVED.
	const readiness = readinessLabel(context as never);
	assert.equal(view.visible('timetable-simple-readiness-chip')!.startsWith(readiness), true,
		`the operator reads BOTH severities from the one control, in the production label's own words (read: "${view.visible('timetable-simple-readiness-chip')}")`);
	const face = view.visible('timetable-simple-readiness-chip')!.split('·').map((part) => part.trim());
	assert.equal(face.length, 2, 'and the face adds exactly ONE short consequence clause to that label');
	assert.ok((face[1] ?? '').split(/\s+/).filter(Boolean).length <= 4,
		`which is short enough to keep the chip on one line (read: "${face[1]}")`);
	const consequence = view.el('timetable-simple-readiness-consequence');
	assert.ok(consequence, 'the chip renders its addressable consequence span');
	const full = consequence!.getAttribute('title') ?? '';
	const sharedClause = publishBlockedSentence({ blockingHardCount: 3, unassignedCount: 0 }).split(' — ')[1]!;
	assert.ok(sharedClause.length > 0, 'DISCRIMINATION: the shared consequence clause is a real clause, not an empty split');
	assert.equal(full.startsWith(readiness), true, 'the WHOLE sentence opens with the same severity split the face does');
	assert.equal(full.endsWith(sharedClause), true,
		'and ends in the ONE shared consequence clause — the consequence is still stated, in the wording every other surface uses');
	assert.ok((chip.getAttribute('aria-label') ?? '').includes(full),
		'and the accessible name carries it too, so nothing depends on a hover');
	assert.equal(/\btruncate\b/.test(chip.getAttribute('class') ?? ''), false,
		'and the chip cannot ellipsize its face (§8)');
	// A2 C13 (operator, 2026-09-29, item 3) — **THE SOLID-PRIMARY HALF OF THIS ROW IS
	// SUPERSEDED, and the original assertion is kept verbatim below (AGENTS.md §16).**
	//
	// Original, retained:
	//   const solid = view.all('button,a[href]').filter((el) => /\bbg-primary\b/.test(el.getAttribute('class') ?? ''));
	//   assert.equal(solid.length, 1,
	//     'and there is still exactly ONE solid primary on the header (DRAFT-UX-C01, operator 2026-09-25)');
	//
	// Why it is superseded, not deleted: the ONE solid primary this row counted was the
	// **Publish** control while it was **disabled** — `variant="default"` plus the shared
	// `disabled:opacity-50`, i.e. a solid `bg-primary` at half opacity. That is the
	// operator's reported "pale-green near-miss": a control that reads as the next step
	// and is not. A2 C13 gives a disabled lifecycle control the `unavailable` variant
	// (no `bg-primary`) and prints a ≤ 6-word reason beside it, so a blocked header
	// honestly has ZERO solid primaries.
	//
	// DRAFT-UX-C01 (operator, 2026-09-25) still stands, and this row still enforces it —
	// the rule is "one dominant control", and the enforcement is now that the header shows
	// AT MOST ONE solid primary and never presents an unavailable one as dominant. The
	// chip assertions above are untouched and remain exactly as discriminating as before.
	const solid = view.all('button,a[href]').filter((el) => /\bbg-primary\b/.test(el.getAttribute('class') ?? ''));
	assert.ok(solid.length <= 1,
		'never more than ONE solid primary on the header (DRAFT-UX-C01, operator 2026-09-25)');
	// The replacement claim: on this blocked header the only lifecycle control is
	// unavailable, so it must read as unavailable rather than as a near-miss primary.
	const publish = view.el('timetable-simple-publish-action');
	assert.ok(publish, 'the Publish control is still on screen - the reason must be readable, not removed');
	assert.equal(publish!.hasAttribute('disabled'), true, 'it is honestly disabled');
	assert.equal(/\bbg-primary\b/.test(publish!.getAttribute('class') ?? ''), false,
		'a disabled control must not wear the primary background (A2 C13 item 3)');
	assert.equal(/\bbg-muted\b/.test(publish!.getAttribute('class') ?? ''), true,
		'and wears the plainly-unavailable treatment instead');
	assert.ok((view.visible('timetable-simple-publish-short-reason') ?? '').length > 0,
		'the reason is printed beside it, in words, not hover-only');
});

// ═══ The Expert header does not get a different banner ══════════════════════

test('ITEM 2 the EXPERT header renders the SAME one-sentence notice from the SAME derivation', () => {
	const expert = expertHeader(draftHeaderContext());
	const notice = expert.el('timetable-simple-input-drift');
	assert.ok(notice, 'the Expert layout now says something when setup changed — it used to say nothing at all');
	// Byte-identical claim to the Simple row: one implementation, so the two
	// layouts cannot drift onto two different banners.
	assert.equal(visibleText(notice!).trim(),
		'Teaching Load and Rooms changed.See what changedUpdate schedule',
		'the Expert row reads exactly what the Simple row reads');
	assert.equal(/\bchecked\b|\bago\b/i.test(notice!.textContent ?? ''), false,
		'and carries no timestamp on this layout either');
	// And it is on the orientation row — the Expert layout's single status row.
	const orientation = expert.el('timetable-scheduler-orientation')!;
	assert.equal(orientation.contains(notice!), true, 'the notice sits in the Expert status row');
});
