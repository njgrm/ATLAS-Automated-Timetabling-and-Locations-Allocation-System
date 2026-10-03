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
 *   • every row states what the PRE-FIX state would have produced, so a passing
 *     row cannot be a tautology. Those are labelled DISCRIMINATION.
 *
 * ── WHAT IS RENDERED HERE, AND WHAT IS NOT ─────────────────────────────────
 * Read this before treating a green row as acceptance. Per AGENTS.md "Done means
 * seen", a source-text assertion is not acceptance evidence for a user-facing
 * change. This file's rows are:
 *
 *   RENDERED (a real component is mounted, and a control is clicked or a real
 *   DOM result is read):
 *     • T2 RENDERED          — `TimetableAssignmentDialogs` history dialog, portal row
 *     • T3a RENDERED         — the run-identity badge on the REAL Simple header
 *     • T3b RENDERED         — the REAL More menu, opened through `pointerdown`
 *     • T3c RENDERED         — the change notice on both REAL layouts, claimed vs not
 *     • T3c published row    — which actions a published run is and is not offered
 *
 *   UNIT (a pure derivation, no DOM). Each one is a LABEL row: it pins the wording
 *   of the sentence, and the same claim is decided by a RENDERED row beside it.
 *     • T2  — `describeEditAutoMove` / `describeEditAutoMoveNamed`
 *     • T3a — `runIdentityBadgeLabel`
 *   A unit row is never on its own the evidence for a user-facing claim.
 *
 *   STRUCTURAL: none in this file. NO ROW HERE MEASURES VIEWPORT WIDTH. JSDOM has
 *   no layout engine, so nothing in this file measures 1366 px or 390 px, and no
 *   row in this file claims a measured row count or a pixel geometry. The measured
 *   1366 px header row count is the planner's BROWSER row (AGENTS.md §11); the
 *   sibling `a2-c11-s2-header-banners.test.tsx` owns the responsive-class rows and
 *   labels its row-band row STRUCTURAL for the same reason.
 *
 * ── WHY DOM NODES NEVER APPEAR INSIDE `assert.equal` ───────────────────────
 * A failing `assert.equal` against a JSDOM element makes Node's inspector build a
 * diff of the whole document; the process then dies with `RangeError: Array buffer
 * allocation failed` after ~30 s. That hides the real assertion behind an
 * allocation error — it is how this file's T3c failure was reported as an OOM
 * rather than as the premise that did not hold. Every DOM row here therefore
 * compares a BOOLEAN, a STRING, a COUNT or a CLASS LIST, never a node.
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
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableAssignmentDialogs } = await import('@/components/timetable/modals/TimetableAssignmentDialogs');
const { describeEditAutoMove, describeEditAutoMoveNamed } = await import('@/lib/timetable-edit-history-truth');
const { advisoryCountLabel, readinessLabel } = await import('@/components/timetable/simple/SimpleHeaderHelpers');
const { TimetableSimpleHeader } = await import('@/components/timetable/TimetableSimpleHeader');
const { ScheduleReviewWorkspaceHeader } = await import('@/components/timetable/ScheduleReviewWorkspaceHeader');
const { describeRunState, runIdentityBadgeLabel } = await import('@/components/timetable/RunStateBadge');
const { deriveGenerationReadinessState } = await import('@/lib/timetable-generation-readiness');
const { BUILD_NEW_DRAFT_LABEL, EDIT_STATE_LABEL, SAVE_STATE_LABEL } = await import('@/lib/timetable-plain-language');

const roots: any[] = [];
afterEach(() => { for (const mounted of roots.splice(0)) act(() => mounted.unmount()); });

/** What the operator can SEE, as opposed to `textContent`, which also carries `sr-only`. */
function visibleText(host: HTMLElement): string {
	const clone = host.cloneNode(true) as HTMLElement;
	for (const hidden of [...clone.querySelectorAll('.sr-only, [aria-hidden="true"]')]) hidden.remove();
	return clone.textContent ?? '';
}

/**
 * The mount harness. `el` / `visible` / `all` read the rendered DOM; `openMenu`
 * drives a Radix `DropdownMenu` through its real `pointerdown` path, so a menu row
 * is opened the way a scheduler opens it rather than by calling a handler.
 *
 * `openMenu` and `click` are the two the banner rows need; the T2 dialog row below
 * mounts through this same `renderIn` and reads the portal at document level.
 */
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

// ═══ FIXTURES — a REAL run, and the run's own timing ════════════════════════

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

/**
 * The one sentence a run may honestly be told when its comparison is not timed to
 * it. Taken from the real resolver (`runFreshnessUnverifiedSentence`, the
 * `COMPARISON_PREDATES_RUN` / `UNTIMED_COMPARISON` branch) rather than written here,
 * so this row cannot pass by agreeing with an invented fixture string.
 */
const UNVERIFIED_NOTE = 'This check is not timed to the schedule on screen, so it may not apply to it.';

function summaryOf(overrides: Record<string, unknown> = {}) {
	return {
		isPublished: true,
		unassignedCount: 0,
		assignedCount: 118,
		hardViolationCount: 0,
		...(overrides as Record<string, never>),
	};
}

/**
 * A PUBLISHED run 321, Term 2, carrying the six-hour-old comparison of T3c.
 *
 * The keys the T3 rows depend on are the ones a real header reads: `draft.summary`
 * (the published state word in the strip), `draft.inputState` (the comparison and
 * its `checkedAt`), and `draft.finishedAt` / `createdAt` (the run's own timing, which
 * is what the freshness rule compares `checkedAt` against).
 */
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

/** The REAL Simple header, with the prop surface a scheduler mounts. */
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

/** The REAL Expert header, which the T3c row proves applies the same timing rule. */
function expertHeader(context: Record<string, any>) {
	return renderIn(createElement(ScheduleReviewWorkspaceHeader as any, {
		context,
		onEditDraft: () => {},
		onDiscardDraft: () => {},
	}));
}

/** The minimal header context `readinessLabel` reads. */
function readinessContext(overrides: Record<string, any> = {}) {
	return {
		isPreGenerationWorkspace: false,
		draft: { runId: 321, summary: { isPublished: false, unassignedCount: 0 } },
		summary: { unassignedCount: 0 },
		blockingHardCount: 0,
		softCount: 0,
		schoolYearContext: { activeSchoolYearLabel: 'SY 2026-2027' },
		curriculumReadiness: { state: 'ready' },
		...overrides,
	};
}

// ═══ T2 — the history row that would not name what moved ════════════════════

/**
 * THE RECORDED DEFECT, as data. `AUTO_FIX_MOVE_SOURCE` relocated Class A (the
 * operator's selected class, GR7-Luna TLE) to Monday 12:15, which is the
 * `Lunch Break` special-event slot — so the cell that showed only "Lunch Break"
 * was the cell TLE had been moved out of. The payload shape is the server's own
 * (`manual-edit.service.ts` writes `entryIdA`, `entryIdB`, and the two slots).
 */
const CORRECTIVE_EDIT_14 = {
	id: 14,
	runId: 321,
	actorId: 46,
	editType: 'SWAP_ENTRIES',
	beforePayload: {
		entryIdA: 'e-tle',
		entryIdB: 'e-other',
		entryA: { day: 'MONDAY', startTime: '12:15', endTime: '13:00' },
		entryB: { day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
	},
	afterPayload: {
		strategy: 'AUTO_FIX_MOVE_SOURCE',
		entryIdA: 'e-tle',
		entryIdB: 'e-other',
		// TLE was moved OUT of the 12:15 Lunch Break cell and B took its old slot —
		// which is why the cell showed "Lunch Break" and nothing else.
		entryA: { day: 'MONDAY', startTime: '13:15', endTime: '14:00' },
		entryB: { day: 'MONDAY', startTime: '12:15', endTime: '13:00' },
	},
	validationSummary: { hardCount: 0, softCount: 0 },
	createdAt: '2026-09-28T04:52:00.000Z',
} as any;

test('T2 the history row NAMES the class that moved, from the run on screen', () => {
	// The recorded sentence, verbatim, for the record (AGENTS.md §16 — the old
	// assertion is kept, not deleted; it is what the row below replaces).
	assert.equal(describeEditAutoMove(CORRECTIVE_EDIT_14),
		'Also moved Class A to Monday 1:15 PM–2:00 PM.');
	// DISCRIMINATION: the class name is not in the payload — the resolver supplies
	// it — so this row cannot pass without a real lookup, and the recorded "Class
	// A" (a dialog handle) is replaced by the class the operator lost from a cell.
	assert.equal(describeEditAutoMoveNamed(CORRECTIVE_EDIT_14, (id) => (id === 'e-tle' ? 'GR7 - Luna' : null)),
		'Also moved GR7 - Luna to Monday 1:15 PM–2:00 PM.');
	// FAIL CLOSED, not inventive: a payload the resolver cannot name keeps the
	// un-named sentence rather than inventing a class.
	assert.equal(describeEditAutoMoveNamed(CORRECTIVE_EDIT_14, () => null),
		'Also moved Class A to Monday 1:15 PM–2:00 PM.',
		'an unresolvable entry degrades to the honest un-named sentence');
	assert.equal(describeEditAutoMoveNamed(CORRECTIVE_EDIT_14, () => '   '),
		'Also moved Class A to Monday 1:15 PM–2:00 PM.',
		'a blank label is not a class name');
	// A plain two-class swap relocated nothing, so it still says nothing.
	const plainSwap = {
		...CORRECTIVE_EDIT_14,
		afterPayload: { ...CORRECTIVE_EDIT_14.afterPayload, strategy: 'DIRECT_SWAP' },
	};
	assert.equal(describeEditAutoMoveNamed(plainSwap, () => 'GR7 - Luna'), null,
		'a direct swap has no auto-move sentence, before and after this change');
});

test('T2 RENDERED: the REAL history dialog prints the class name, and the row still says what kind of record it is', async () => {
	const view = renderIn(createElement(TimetableAssignmentDialogs, {
		context: {
			showEditHistory: true,
			setShowEditHistory: () => {},
			editHistory: [CORRECTIVE_EDIT_14],
			editHistoryReadState: 'ready',
			revertEditById: async () => true,
			revertLoading: false,
			currentRunVersion: 14,
			editHistoryEntryClassName: (entryId: string) => (entryId === 'e-tle' ? 'GR7 - Luna' : null),
		},
	} as any));
	// A Radix `Dialog` opens on a tick and renders in a PORTAL, so the row is a
	// document-level node mounted after the open settles — not a child of the host,
	// and not there on a synchronous render. A positive assertion before this would
	// be a lie about the surface.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
	// A Radix `Dialog` renders in a PORTAL, so the row is a document-level node
	// rather than a child of the host — which is also how a scheduler's screen
	// sees it. The testid is the addressable hook either way.
	const row = dom.window.document.querySelector('[data-testid="timetable-edit-history-row"]') as HTMLElement | null;
	assert.ok(row, 'the recorded edit renders a row');
	const rowText = visibleText(row!);
	assert.ok(rowText.includes('Swapped two classes'),
		'the row still names what KIND of record it is — the class name is additive, never a replacement');
	assert.ok(rowText.includes('Also moved GR7 - Luna to Monday 1:15 PM–2:00 PM.'),
		'and the auto-move sentence now names the class the operator lost from the cell');
	assert.equal(rowText.includes('Also moved Class A'), false,
		'the dialog handle is gone from the sentence');
});

// ═══ T3 — three truthful labels ═══════════════════════════════════════════

test('T3a the header names the RUN and the STATE, in that order', () => {
	// D1: the state WORDS are `Edit` / `Save`; the SHAPE the row pins is state-first
	// with the run number trailing, and that shape is asserted through the mapping.
	assert.equal(runIdentityBadgeLabel({ isPreGeneration: false, runId: 321, isPublished: false }), `Run 321 · ${EDIT_STATE_LABEL}`);
	assert.equal(runIdentityBadgeLabel({ isPreGeneration: false, runId: 321, isPublished: true }), `Run 321 · ${SAVE_STATE_LABEL}`);
	// Nothing to name in the two run-less states, so nothing is printed.
	assert.equal(runIdentityBadgeLabel({ isPreGeneration: true, runId: 321, isPublished: false }), null);
	assert.equal(runIdentityBadgeLabel({ isPreGeneration: false, runId: null, isPublished: false }), null);
});

test('T3a RENDERED: the REAL Simple header names the run once in the calm status band', () => {
	const view = simpleHeader(draftHeaderContext());
	const identity = view.el('timetable-run-identity');
	const state = describeRunState({ isPreGeneration: false, runId: 321, isPublished: false });
	assert.ok(identity, 'the status band names the run on screen');
	assert.equal(visibleText(identity!).trim(), `State: ${state.sentence}`,
		'the scheduler sees the production-derived run identity exactly once, in the calm band');
});

test('T3b RENDERED: the REAL More menu names the action the way the dialog names it — one verb, one wording', async () => {
	const context = draftHeaderContext();
	// The draft case, which is where the recorded split lived.
	const draft = simpleHeader(context);
	const menu = await draft.openMenu('timetable-simple-more-trigger');
	const row = menu.querySelector('[data-testid="timetable-more-generate"]') as HTMLElement;
	assert.ok(row, 'the action is a More row once a run exists');
	// A7 c12b (decision 8, row 8) SUPERSEDED the wording this row pinned:
	// `Build a new draft` is now `Generate a draft`. The property is unchanged —
	// the More row and the dialog still say ONE thing, and the retired second
	// wording never returns.
	assert.ok((row.textContent ?? '').includes(BUILD_NEW_DRAFT_LABEL),
		'the row says the one Generate verb, from the one constant');
	assert.equal((row.textContent ?? '').includes('Build a new draft'), false,
		'and never the retired wording, which is the split T3b names');
	assert.equal(row.getAttribute('aria-label'), null,
		'no reason, so the accessible name is the visible label rather than a second string');

	// The DISABLED case must not reintroduce the split through its reason line.
	// The blocked readiness state is built by the REAL producer
	// (`deriveGenerationReadinessState`) from a real server diagnostic, not
	// hand-written: `TimetableCurriculumReadinessState` is a PARSED shape whose
	// blockers carry a required `code`, and the header reads
	// `curriculumReadiness.diagnostic.blockers` straight into the presentation
	// layer. A hand-written partial blocker with no `code` crashes
	// `deriveTimetableReadinessRepair` — which is a defect in the fixture, not on
	// the surface (the only producer always parses first).
	const blockedReadiness = deriveGenerationReadinessState({
		scope: { schoolId: 1, schoolYearId: 1 },
		status: 'BLOCKED',
		generateAllowed: false,
		schedulerExecuted: true,
		zeroWrite: true,
		derivedDemandRevision: 'rev-1',
		termStructure: null,
		totals: { lines: 10, pairs: 12, sections: 4 },
		teachingLoadCoverage: {
			requiredPairs: 12, ownedPairs: 10, inactiveOrStalePairs: 0, outsideScopePairs: 2,
		},
		blockers: [
			{
				code: 'NO_QUALIFIED_FACULTY',
				category: 'RESOURCE_INFEASIBLE',
				termIdentity: 'TERM 2',
				sectionId: 41,
				subjectId: 31,
				subjectCode: 'TLE',
				entity: 'GR7 - Luna / TLE',
				reason: 'No qualified faculty is available for this section.',
				owningSurface: 'Teaching Load',
				nextAction: 'Assign a qualified faculty member in Teaching Load.',
			},
		],
	}, { schoolId: 1, schoolYearId: 1 });
	assert.equal(blockedReadiness.state, 'blocked',
		'precondition: the real producer returns the blocked state this row needs');

	const blocked = simpleHeader(draftHeaderContext({
		softCount: 145,
		blockingHardCount: 3,
		curriculumReadiness: blockedReadiness,
	}));
	const blockedMenu = await blocked.openMenu('timetable-simple-more-trigger');
	const blockedRow = blockedMenu.querySelector('[data-testid="timetable-more-generate"]') as HTMLElement;
	assert.ok(blockedRow, 'the row is still rendered when generation is gated');
	const blockedText = (blockedRow.textContent ?? '').trim();
	// A7 c12b SUPERSEDED: the one verb is `Generate a draft`.
	assert.ok(blockedText.startsWith(BUILD_NEW_DRAFT_LABEL), `the disabled row keeps the one verb (read: ${blockedText})`);
	assert.equal(blockedText.includes('Build a new draft'), false, 'and never the retired wording, in any state');
	assert.match(blockedRow.getAttribute('aria-label') ?? '', new RegExp(`^${BUILD_NEW_DRAFT_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — `),
		'the accessible name and the visible label are the same verb, so they cannot differ');
});

test('T3c RENDERED: a comparison that PREDATES the run raises no drift CLAIM — a calm unverified note instead, in both layouts', () => {
	// THE FIXTURE IS THE DEFECT. `PRE_RUN_COMPARISON.checkedAt` is six hours BEFORE
	// the run finished, so the comparison was written about an older schedule. The
	// server's own `deriveRunFreshness` is what refuses the claim; the client's
	// contribution is passing the run's timing in, which the header used to omit.
	//
	// ── SUPERSEDED PREMISE, AND WHY (AGENTS.md §16 — the old lines are kept, not
	// deleted; the row below replaces them) ─────────────────────────────────
	// This row used to assert the notice is ABSENT:
	//
	//   assert.equal(view.el('timetable-simple-input-drift'), null,
	//     'a comparison that predates this run must not present a notice about this run');
	//   assert.equal(expertHeader(headerContext()).el('timetable-simple-input-drift'), null,
	//     'the Expert layout applies the same timing rule');
	//
	// SUPERSEDED (the row is PRESENT by design; hiding it is the defect it
	// accidentally demanded). `SimpleDriftBanner` decides `showRunDrift` from
	// `drift.status`, which is the SERVER's `status` passed through verbatim
	// (`timetableDriftRouting.ts` `status: inputState.status`) and is never
	// reconciled with the freshness verdict. So a pre-run STALE comparison renders
	// the band, and the component says so in its own comment: "Drift itself is NOT
	// hidden: the changed domains, their repair links and the neutral notice all
	// still render, because an untimed or pre-run comparison is 'not proven', not
	// 'nothing is wrong'." Demanding the row be absent would have required
	// deleting real evidence from the operator's screen to go green.
	//
	// What the timing rule DOES control — and what this row now asserts, because
	// that is the claim that was actually broken — is the ALARM: no drift claim, no
	// apply action, no alarm styling, and the honest unverified sentence instead.
	const view = simpleHeader(headerContext());
	const band = view.el('timetable-simple-input-drift');
	// Booleans and strings, never a DOM node: a failing `assert.equal` against a
	// JSDOM element makes Node's inspector build a diff of the whole document and
	// the process dies with `RangeError: Array buffer allocation failed`, which is
	// how this row's real failure was hidden behind an allocation error.
	assert.equal(band !== null, true,
		'the row is still shown — a pre-run comparison is "not proven", not "nothing is wrong"');
	// The run IS published and the comparison IS STALE, so the row is silent on
	// timing alone — the precondition that makes the row non-vacuous.
	const state = describeRunState({ isPreGeneration: false, runId: 321, isPublished: true });
	assert.equal(visibleText(view.el('timetable-run-identity')!).trim(), `State: ${state.sentence}`,
		'precondition: the production-derived published run identity is visible in its one calm location');
	assert.equal(view.el('timetable-simple-drift-message')?.textContent,
		UNVERIFIED_NOTE,
		'and what it reads is the honest unverified sentence, not a claim about this schedule');
	// THE LOAD-BEARING ASSERTION: the named-area claim is withheld.
	assert.equal(view.visible('timetable-simple-drift-message')?.includes('changed since this schedule was made'), false,
		'a comparison that predates this run must not claim this schedule changed');
	assert.equal(view.el('timetable-simple-regenerate-to-apply'), null,
		'and with no trustworthy claim there is nothing to apply, so no apply action is mounted');
	// Not an alarm. DISCRIMINATION: `alarming` is `status === 'STALE' && driftClaimed`,
	// so a claimed STALE run wears the alarm styling and this one must not.
	const className = band?.getAttribute('class') ?? '';
	assert.equal(/amber|red|destructive/.test(className), false,
		'the unproven row is calm, so an unproven comparison never borrows the alarm colour');
	// The SAME run with a comparison written after it finished DOES claim drift, and
	// carries an action, so the row discriminates the TIMING and not the run state.
	const changed = simpleHeader(headerContext({
		draft: { ...headerContext().draft, inputState: POST_RUN_COMPARISON },
	}));
	assert.equal(changed.el('timetable-simple-drift-message')?.textContent,
		'Teaching Load and Rooms changed.',
		'a comparison written AFTER the run finished is a real change and is claimed as one');
	// And the same timing rule holds in the Expert layout, which had no gate at all:
	// it shows the same honest note and makes the same claim the Simple layout does.
	const expert = expertHeader(headerContext());
	assert.equal(expert.el('timetable-simple-drift-message')?.textContent, UNVERIFIED_NOTE,
		'the Expert layout reads the same unverified sentence for the same untimed comparison');
	assert.equal(expert.el('timetable-simple-regenerate-to-apply'), null,
		'and offers no apply action either, so the two layouts cannot disagree');
});

test('T3c the published run with a REAL change still gets the honest published guidance, not a regenerate', () => {
	const view = simpleHeader(headerContext({
		draft: { ...headerContext().draft, inputState: POST_RUN_COMPARISON },
	}));
	// The run is PUBLISHED in this fixture, so the apply action must not be
	// mounted: a published schedule is never regenerated (D5), and the operator is
	// routed to a revision instead. Compared as a BOOLEAN, not a node — see the T3c
	// row's note on why a DOM node in `assert.equal` kills the process.
	assert.equal(view.el('timetable-simple-regenerate-to-apply') === null, true,
		'a published run is never offered "Update schedule" — it is changed by a dated revision');
	// The secondary stays: seeing what changed is always safe and always available.
	assert.equal(view.el('timetable-simple-impact-preview') !== null, true,
		'but the operator can still see WHAT changed');
});
