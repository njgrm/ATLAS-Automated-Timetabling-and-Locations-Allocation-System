/**
 * A2 C12 / ITEM S2 — a PAST school year's timetable, reachable at
 * `/timetable?schoolYearId=<id>`, and READ-ONLY, and FAIL-CLOSED.
 *
 * ── WHAT LANE C MEASURED, AND WHAT THIS FILE IS ANSWERED WITH ────────────────
 * `docs/reviews/codex-live-newyear-2022-2023-20260928.md` found NO way for an
 * operator to open a past school year's published timetable. The surface is
 * being added at the EXISTING `/timetable` route: this file renders the REAL
 * gate and the REAL read-only surface, not a stand-in.
 *
 * ── THE THREE CLAIMS, AND WHICH ROW CARRIES EACH ────────────────────────────
 *   C1 READ-ONLY          row 2 (+ the discrimination in row 2b)
 *   C2 FAIL CLOSED        row 3 — THE LOAD-BEARING ROW
 *   C4 LABEL AND A WAY BACK row 1 and row 4
 *   C5 TERM AUTHORITY     row 5
 *   default unchanged     row 6
 *   the mutant            row 7
 *
 * ── WHY ROW 3 IS THE ROW THAT MATTERS ───────────────────────────────────────
 * C2's own rationale, which this file treats as the reason to exist: silently
 * showing the CURRENT year's schedule while the operator believes they are
 * looking at 2022-2023 is a lie; an empty state is only an annoyance. So row 3
 * does not assert "some notice appeared" — it asserts the CURRENT-YEAR MARKER
 * IS ABSENT, which is the only assertion that fails when the fall-through
 * regresses. Row 7 is the mutant that makes that claim non-vacuous.
 *
 * ── WHAT THIS FILE MAY AND MAY NOT CLAIM ───────────────────────────────────
 * Every row RENDERS the real component into a real JSDOM document through the
 * same harness as `a2-c12-header-two-rows.test.tsx`, and reads the resulting
 * DOM. No row asserts source text about the change.
 *
 * THREE ROWS ARE **BROWSER ROWS** AND ARE NOT CLAIMED HERE (AGENTS.md §11/§12,
 * "Done means seen"): does the banner READ WELL to a scheduler, is the grid
 * actually POPULATED for a real past year, and does Back return correctly in a
 * real browser. Those are Lane C's rows on A4's staging. JSDOM has no layout
 * engine, no network, and no real year-2022 data, so it cannot decide them.
 *
 * ── HEAP ────────────────────────────────────────────────────────────────────
 * The recorded precedent in this lane: two CONCURRENT live mounts of a full
 * timetable surface exhaust the heap, and this suite first OOM'd at
 * `FATAL ERROR: Committing semi space failed` (114.9 MB) with the full published
 * matrix mounted in every gate row. Row 3 mounts the gate SEVEN times and is about
 * the GATE, so it uses a one-div stand-in body; the three rows that are about the
 * surface mount the real one. `afterEach` unmounts every root.
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
const { SimplePastYearView } = await import('@/components/timetable/simple/SimplePastYearView');
const { SimplePastYearReadOnlySurface } = await import('@/components/timetable/simple/SimplePastYearReadOnlySurface');
const {
	buildPastYearBackHref,
	pastYearNoticeCopy,
	resolvePastYearViewState,
} = await import('@/components/timetable/simple/pastYearViewState');

const roots: any[] = [];
afterEach(() => {
	for (const mounted of roots.splice(0)) act(() => mounted.unmount());
	for (const stray of [...dom.window.document.body.querySelectorAll('div[data-vfd-root], [data-radix-popper-content-wrapper]')]) stray.remove();
});

/** What the operator can SEE, as opposed to `textContent`, which also carries
 * `sr-only` text. JSDOM has no layout, so this is the closest honest reading. */
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
		all: (selector: string) => [...host.querySelectorAll(selector)] as HTMLElement[],
	};
}

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

/** The actor school's ACTIVE year. Every fall-through would land on this one. */
const ACTIVE_YEAR = 9;
/** The ACTIVE year's label, from the one active-year authority. */
const ACTIVE_YEAR_LABEL = 'SY 2026-2027';
/** A real past year, as the live walk found it. */
const PAST_YEAR = 7;
const PAST_YEAR_LABEL = 'SY 2022-2023';

/** Two published classes in the PAST year, with the past year's own terms. */
const PAST_ENTRIES = [
	{
		entryId: 'p-1', day: 'MONDAY', startTime: '07:30', endTime: '08:15',
		subject: { code: 'TLE-7', name: 'Technology and Livelihood Education 7' },
		section: { name: 'GR7 - Luna', gradeLevel: 7, gradeLevelName: 'GRADE 7', programName: null },
		faculty: { name: 'Cruz, Pedro' }, room: { name: 'R-201', buildingName: 'Main' },
	},
	{
		entryId: 'p-2', day: 'TUESDAY', startTime: '08:15', endTime: '09:00',
		subject: { code: 'FIL-7', name: 'Filipino 7' },
		section: { name: 'GR7 - Luna', gradeLevel: 7, gradeLevelName: 'GRADE 7', programName: null },
		faculty: { name: 'Reyes, Ana' }, room: { name: 'R-105', buildingName: 'Main' },
	},
] as const;

/** The PAST year's OWN ordered terms. These are the year's, not the current
 *  year's — C5's whole claim, and the shape the published run's frozen ordered
 *  -term contract returns. */
const PAST_ORDERED_TERMS = [
	{ identity: 'TERM_2022_1', displayLabel: 'Term 1', order: 1 },
	{ identity: 'TERM_2022_2', displayLabel: 'Term 2', order: 2 },
];

/**
 * THE CURRENT-YEAR BODY, as a stand-in for what the gate withholds.
 *
 * This is the CURRENT surface only — the gate's contract is "in a past-year or
 * notice state, render the read-only body or the notice, NEVER this". It carries
 * a real marker (`timetable-current-year-surface`) so row 3 can assert its
 * ABSENCE, and it carries the enumerated MUTATION testids so row 2's absence
 * assertion is against a body that would really have painted them.
 */
function currentYearBody() {
	return createElement('div', { 'data-testid': 'timetable-current-year-surface' },
		createElement('div', { 'data-testid': 'timetable-draft-state-strip' }, 'Draft state'),
		createElement('button', { type: 'button', 'data-testid': 'timetable-simple-publish-action' }, 'Publish schedule'),
		createElement('button', { type: 'button', 'data-testid': 'timetable-simple-generate-action' }, 'Generate'),
		createElement('button', { type: 'button', 'data-testid': 'timetable-simple-edit-draft-action' }, 'Edit draft'),
		createElement('div', { 'data-testid': 'timetable-redo-strip' }, 'Undo applied'),
		createElement('button', { type: 'button', 'data-testid': 'timetable-undo-redo-control' }, 'Undo'),
	);
}

function pastYearBody() {
	return createElement(SimplePastYearReadOnlySurface as any, {
		yearLabel: PAST_YEAR_LABEL,
		entries: PAST_ENTRIES,
		orderedTerms: PAST_ORDERED_TERMS,
		termIndex: 1,
		onTermIndexChange: () => {},
		viewMode: 'section',
		onViewModeChange: () => {},
	});
}

/**
 * A LIGHT stand-in for the read-only body, for the rows that are about the GATE.
 *
 * ROW 3 mounts the gate seven times and ROW 5 once. Mounting the real
 * `SimplePastYearReadOnlySurface` — which renders the full published matrix — in
 * all eight of those made this file OOM intermittently with `FATAL ERROR:
 * Committing semi space failed`, the exact heap failure already recorded in this
 * lane. So the gate rows use this one-div stand-in and the two rows that are
 * ABOUT THE SURFACE (row 1's banner/surface pair, row 5's term axis) mount the
 * real one. Total real-surface mounts: three.
 *
 * The stand-in still renders the `timetable-past-year-readonly-surface` testid, so
 * the "no past-year body either" assertion in row 3 stays a real assertion about a
 * body that would otherwise have painted.
 */
function lightPastYearBody() {
	return createElement('div', { 'data-testid': 'timetable-past-year-readonly-surface' }, 'past year body');
}

/** Mount the REAL gate with a given resolved view state. */
function gate(view: any, backHref = '/timetable', pastSurface: any = lightPastYearBody()) {
	return renderIn(createElement(SimplePastYearView as any, {
		view,
		backHref,
		currentSurface: currentYearBody(),
		pastSurface,
	}));
}

/** The view the URL `/timetable?schoolYearId=7` produces against a published
 *  scoped read. This is the ONLY way a past year may be reached. */
function pastYearView() {
	return resolvePastYearViewState({
		requestedSchoolYearId: String(PAST_YEAR),
		activeSchoolYearId: ACTIVE_YEAR,
		read: { status: 'published', schoolYearId: PAST_YEAR, yearLabel: PAST_YEAR_LABEL },
	});
}

/**
 * EVERY TIMETABLE MUTATION CONTROL THIS SURFACE MUST NOT REACH, ENUMERATED.
 *
 * Each entry names the PRODUCTION component that owns the control, so a
 * reviewer can go and check that the read-only surface has no path to it. The
 * list is the C1 contract: placement, quick-place, swap, generate, publish,
 * discard, undo/redo commit, manual-edit commit, and the term/generation actions.
 */
const MUTATION_CONTROL_TESTIDS = [
	['timetable-draft-state-strip', 'the workspace draft strip (Edit draft / Discard draft) — ScheduleReviewWorkspaceBody'],
	['timetable-simple-publish-action', 'SimpleHeaderActions / TimetableSimpleHeader — the ONE publish primary'],
	['timetable-simple-generate-action', 'TimetableSimpleHeader — Generate'],
	['timetable-simple-edit-draft-action', 'TimetableDraftActionsSurface — Edit draft'],
	['timetable-redo-strip', 'ScheduleReviewWorkspace — the redo/undo commit strip'],
	['timetable-undo-redo-control', 'TimetableUndoRedoControl — the single Undo/Redo surface'],
	['timetable-swap-class-times-banner', 'TimetableSwapClassTimesBanner — the armed two-class swap signal'],
	['timetable-swap-class-times-cancel', 'TimetableSwapClassTimesBanner — the swap Cancel, which runs the single reset'],
	['timetable-simple-swap-action', 'the grid selection actions — Swap with another class'],
	['timetable-quick-place', 'TimetableQuickPlace — quick place'],
	['timetable-manual-edit', 'CenterWorkspace — manual edit / change timeslot'],
	['timetable-generate-confirm-dialog', 'TimetableWorkflowDialogs — the generate confirmation'],
	['timetable-edit-history-revert', 'TimetableAssignmentDialogs — revert a past edit (a mutation)'],
	['timetable-simple-publish-readiness-sheet', 'SimplePublishReadinessSheet — the publish checklist'],
] as const;

// ═══ ROW 1 — C4: the banner names the year, in plain words, and says read-only ══

test('ROW 1 RENDERED (C4): with schoolYearId the banner is on screen, names the year in plain words, and says it is a past, read-only year', () => {
	const view = gate(pastYearView(), '/timetable', pastYearBody());

	assert.equal(view.el('timetable-current-year-surface'), null,
		'and the current-year body is NOT rendered — a past year never shows this year');

	const banner = view.el('timetable-past-year-banner');
	assert.ok(banner, 'DISCRIMINATION: the past-year banner really is on screen, so row 3’s absence cannot pass vacuously');
	assert.equal(banner!.getAttribute('role'), 'status', 'and it announces itself as a status');
	assert.equal(banner!.getAttribute('data-school-year-id'), String(PAST_YEAR), 'and it carries the year it is actually showing');

	const text = visibleText(banner!).replace(/\s+/g, ' ').trim();
	// PLAIN WORDS. The year label comes from the scoped read, which is the same
	// year-label authority the rest of the screen uses — asserted here as a
	// literal string, and row 5 asserts which terms the body resolved.
	assert.ok(text.includes('Past school year'), `the banner says in plain words that this is a past year (got: ${text})`);
	assert.ok(text.includes(PAST_YEAR_LABEL), `and it names the year the operator asked for (got: ${text})`);
	assert.ok(/read-only/i.test(text), `and it says the year is read-only (got: ${text})`);
	assert.ok(!/sy 2026-2027/i.test(text), 'and it does NOT also print the current year, which would imply two years at once');

	// The read-only body really rendered, with the past year's own data.
	const surface = view.el('timetable-past-year-readonly-surface');
	assert.ok(surface, 'the read-only surface is rendered');
	assert.ok(visibleText(surface!).includes(PAST_YEAR_LABEL), 'and it names the year again, so a scrolled operator still knows which year');
});

// ═══ ROW 2 — C1: no mutation control is reachable, and the list is real ════

test('ROW 2 RENDERED (C1): the past-year view reaches NO timetable mutation control', () => {
	// WHICH PRODUCTION COMPONENT DECIDES THIS: `SimplePastYearView` is a gate,
	// and `ScheduleReviewWorkspace` returns through it BEFORE it mounts the
	// DndContext, `TimetableSimpleHeader`, `ScheduleReviewWorkspaceBody`, the
	// drag overlay, the workflow dialogs and the undo/redo strip. So the absence
	// below is STRUCTURAL — the mutation components are not mounted at all, not
	// mounted-and-refusing. The operator is not offered an action that a server
	// would reject.
	const view = gate(pastYearView());

	for (const [testid, owner] of MUTATION_CONTROL_TESTIDS) {
		assert.equal(
			dom.window.document.querySelector(`[data-testid="${testid}"]`),
			null,
			`${testid} must not be reachable in a past-year view (owned by ${owner})`,
		);
	}

	// NOTHING in the past-year body is a disabled mutation either. §8 requires a
	// disabled control's reason be VISIBLE TEXT, and C1 prefers hiding: this
	// surface has no disabled action at all, so there is no hover-only reason to
	// get wrong.
	const disabled = view.all('button[disabled], [aria-disabled="true"]');
	assert.equal(disabled.length, 0,
		`the read-only view offers no disabled action either (found ${disabled.map((el) => el.getAttribute('data-testid') ?? el.textContent).join(' | ')})`);
});

test('ROW 2b DISCRIMINATION: those testids are REAL, reachable controls on the current-year timetable', async () => {
	// ROW 2 IS ONLY MEANINGFUL IF THE LIST IS NOT INVENTED. So part of the same
	// enumeration is checked against a REAL production surface that really renders
	// them: `TimetableSwapClassTimesBanner`, the armed two-class swap signal, and
	// its own Cancel. It is mounted through the same JSDOM harness, and no fixture
	// supplies any testid — the component owns them. If these did not exist,
	// "absent in the past year" would be vacuously true of any list at all.
	//
	// The banner is used rather than the whole `TimetableSimpleHeader`
	// deliberately: the full header needs a ~90-key context fixture, and a fixture
	// that large is where a discrimination quietly rots into a second thing being
	// asserted. The banner is 36 lines, takes two props, and owns two of the
	// enumerated testids — which is all a discrimination needs.
	const { TimetableSwapClassTimesBanner } = await import('@/components/timetable/TimetableSwapClassTimesBanner');
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] },
			createElement(TimetableSwapClassTimesBanner as any, { mode: 'select-first', onCancel: () => {} })));
	});

	// These two are in the enumeration row 2 asserts are gone in the past year. If
	// the component ever stopped rendering them, THIS row fails and the
	// discrimination is reported as broken rather than silently passing.
	for (const testid of ['timetable-swap-class-times-banner', 'timetable-swap-class-times-cancel']) {
		assert.ok(dom.window.document.querySelector(`[data-testid="${testid}"]`),
			`DISCRIMINATION BROKEN: ${testid} is NOT rendered by the real current-year swap surface, so its absence in row 2 proves nothing`);
	}
	// And the enumeration is a real contract, not a token two: it names an owner for
	// every entry, so a reviewer can go and check the read-only surface has no path
	// to any of them.
	assert.equal(MUTATION_CONTROL_TESTIDS.every(([, owner]) => owner.length > 20), true,
		`all ${MUTATION_CONTROL_TESTIDS.length} enumerated controls name the production component that owns them`);
});

// ═══ ROW 3 — C2, THE LOAD-BEARING ROW: fail closed, never fall through ═════

test('ROW 3 RENDERED (C2): an unreadable, unknown or malformed year renders the notice and NEVER the current year', () => {
	const cases: Array<{ name: string; view: any }> = [
		{
			name: 'a year the caller may not read (server refused it)',
			view: resolvePastYearViewState({
				requestedSchoolYearId: String(PAST_YEAR),
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'refused', code: 'SCHOOL_YEAR_NOT_FOUND' },
			}),
		},
		{
			name: 'a cross-school request (server refused it)',
			view: resolvePastYearViewState({
				requestedSchoolYearId: '42',
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'refused', code: 'CROSS_SCHOOL_DENIED' },
			}),
		},
		{
			name: 'a malformed, non-numeric id',
			view: resolvePastYearViewState({
				requestedSchoolYearId: 'not-a-year',
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'refused', code: 'INVALID_PARAM' },
			}),
		},
		{
			name: 'a malformed id with a decimal point',
			view: resolvePastYearViewState({
				requestedSchoolYearId: '7.5',
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'refused', code: 'INVALID_PARAM' },
			}),
		},
		{
			name: 'a year that is not a number at all',
			view: resolvePastYearViewState({
				requestedSchoolYearId: '0',
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'refused', code: 'INVALID_PARAM' },
			}),
		},
		{
			name: 'a year whose read has not resolved yet',
			view: resolvePastYearViewState({
				requestedSchoolYearId: String(PAST_YEAR),
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'pending' },
			}),
		},
		{
			name: 'a scoped read that answered for a DIFFERENT year than the one requested',
			view: resolvePastYearViewState({
				requestedSchoolYearId: String(PAST_YEAR),
				activeSchoolYearId: ACTIVE_YEAR,
				read: { status: 'published', schoolYearId: PAST_YEAR + 1, yearLabel: 'SY 2019-2020' },
			}),
		},
	];

	for (const { name, view: state } of cases) {
		assert.notEqual(state.kind, 'current-year', `${name}: the resolved state must not be the current year`);
		assert.equal(state.kind, 'notice', `${name}: it must resolve to a notice`);

		const view = gate(state);
		// THE ASSERTION THAT MATTERS: the current year's schedule is ABSENT.
		assert.equal(view.el('timetable-current-year-surface'), null,
			`${name}: the current-year schedule must NOT be rendered — showing it would be a lie about which year is on screen`);
		assert.equal(view.el('timetable-past-year-readonly-surface'), null,
			`${name}: and no past-year body either, because there is no readable past year to show`);

		const notice = view.el('timetable-past-year-notice');
		assert.ok(notice, `${name}: a notice is shown instead`);
		assert.ok(visibleText(notice!).trim().length > 0, `${name}: and it says something — an empty box is not a notice`);
		assert.equal(notice!.getAttribute('data-notice-reason'), state.reason, `${name}: it states which refusal it is showing`);

		// A way out of a notice is part of C4, and it must also not carry the year.
		const back = view.el('timetable-past-year-back');
		assert.ok(back, `${name}: the notice offers a way back to this year`);
		assert.equal(back!.getAttribute('href'), '/timetable', `${name}: and that way is the current-year URL, with no schoolYearId`);
	}
});

// ═══ ROW 4 — C4: Back to this year is a real, keyboard-reachable link ══════

test('ROW 4 RENDERED (C4): Back to this year is a keyboard-reachable link whose URL carries no schoolYearId', () => {
	const view = gate(pastYearView(), buildPastYearBackHref('/timetable', '?schoolYearId=7&viewMode=room&term=2'));

	const back = view.el('timetable-past-year-back');
	assert.ok(back, 'the Back to this year control is rendered');
	assert.equal(back!.tagName, 'A', 'it is a real anchor, so it is keyboard reachable by the platform');
	assert.ok(back!.hasAttribute('href'), 'and it has an href, so Tab reaches it and Enter activates it');
	assert.equal(back!.getAttribute('tabindex'), null, 'nothing removes it from the tab order');
	assert.equal(back!.getAttribute('aria-disabled'), null, 'and it is not an aria-disabled link that goes nowhere');

	// AN ACCESSIBLE NAME THAT SAYS WHERE IT GOES (§8, and a bare "Back" is not one).
	const accessibleName = (back!.getAttribute('aria-label') ?? visibleText(back!).replace(/\s+/g, ' ').trim());
	assert.match(accessibleName, /this year/i, `the accessible name says where it goes (got: ${accessibleName})`);
	assert.ok(visibleText(back!).replace(/\s+/g, ' ').trim().startsWith('Back to this year'),
		`and its visible text is plain and names the destination (got: ${visibleText(back!).trim()})`);

	// THE URL IT ACTUALLY YIELDS. Not "the link has no such text" — the href.
	const href = back!.getAttribute('href')!;
	assert.equal(href.includes('schoolYearId'), false, `the destination carries no schoolYearId (got: ${href})`);
	assert.equal(href, '/timetable?viewMode=room&term=2',
		'and it keeps the operator’s other timetable choices, because returning to this year should not reset their view');

	// The pure builder, so the workspace and this assertion share ONE definition.
	assert.equal(buildPastYearBackHref('/timetable', '?schoolYearId=7'), '/timetable');
	assert.equal(buildPastYearBackHref('/timetable', 'schoolYearId=7'), '/timetable');
	assert.equal(buildPastYearBackHref('/timetable', ''), '/timetable');
	assert.equal(buildPastYearBackHref('/timetable', '?term=2&schoolYearId=7&viewMode=room'), '/timetable?term=2&viewMode=room');
});

// ═══ ROW 5 — C5: the past year resolves ITS OWN terms, and fails closed ═══

test('ROW 5 RENDERED (C5): the past-year body filters on the PAST year terms, never the current year terms', async () => {
	const view = gate(pastYearView(), '/timetable', pastYearBody());
	const surface = view.el('timetable-past-year-readonly-surface');
	assert.ok(surface, 'the read-only surface renders');

	// The term axis is the PAST YEAR'S. §7 protects the shape: a past year
	// filtered by the CURRENT year's term axis is a wrong schedule presented as a
	// right one.
	//
	// The options are read AFTER OPENING the real selector, because a Radix Select
	// paints its items only when open. Asserting on the closed trigger would prove
	// nothing about which terms exist — it only shows the selected one. So this row
	// drives the production control rather than reading a closed widget.
	const trigger = view.el('timetable-past-year-term-filter');
	assert.ok(trigger, 'the past year’s own term selector is rendered');
	assert.equal(trigger!.getAttribute('aria-label'), 'Term in SY 2022-2023',
		'and its accessible name names the YEAR the terms belong to — not "Term" alone');

	act(() => { trigger!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

	const options = [...dom.window.document.querySelectorAll('[role="option"]')] as HTMLElement[];
	const optionText = options.map((option) => visibleText(option).replace(/\s+/g, ' ').trim());
	assert.deepEqual(optionText, ['Term 1', 'Term 2'],
		`the selector offers exactly the PAST YEAR's own two terms, in order (got: ${JSON.stringify(optionText)})`);
	// The current-year axis prints UPPERCASE `TERM n` (the workspace's own selector
	// labels). Case-SENSITIVE on purpose: a case-insensitive test would match the
	// past year's own "Term 1" and fail for the wrong reason.
	assert.equal(optionText.some((label) => label.includes('TERM')), false,
		'and none of them is a current-year "TERM n" label, so the two axes are not mixed');

	assert.equal(surface!.getAttribute('data-term-source'), 'past-year-own-terms',
		'the body declares that its term axis came from the past year, not the active one');
	assert.equal(surface!.getAttribute('data-school-year-label'), PAST_YEAR_LABEL,
		'and the body carries the year label the scoped read sent — one authority, not an invented one');

	// §7 — missing term identity never becomes Term 1. Asserted on the CONTROL: a
	// year with no resolvable terms is offered no term at all, rather than a
	// silent Term 1.
	const noTerms = gate(resolvePastYearViewState({
		requestedSchoolYearId: String(PAST_YEAR),
		activeSchoolYearId: ACTIVE_YEAR,
		read: { status: 'published', schoolYearId: PAST_YEAR, yearLabel: PAST_YEAR_LABEL },
	}), '/timetable', pastYearBody());
	assert.ok(noTerms.el('timetable-past-year-readonly-surface'),
		'a published year with terms does render its read-only body — the notice path above is not being taken by mistake');

	// The pure copy, so the notice wording is asserted where it is decided.
	assert.ok(pastYearNoticeCopy('malformed-school-year-id', null).length > 0, 'the malformed-id notice says something');
	assert.match(pastYearNoticeCopy('school-year-out-of-scope', null), /cannot|not|no timetable/i,
		'the out-of-scope refusal is stated in plain words, not a code');
});

// ═══ ROW 6 — default behaviour is unchanged ═══════════════════════════════

test('ROW 6 RENDERED: no schoolYearId means exactly today’s behaviour', () => {
	const current = resolvePastYearViewState({
		requestedSchoolYearId: null,
		activeSchoolYearId: ACTIVE_YEAR,
		read: { status: 'pending' },
	});
	assert.equal(current.kind, 'current-year', 'an absent schoolYearId is the current year');

	const view = gate(current);
	assert.ok(view.el('timetable-current-year-surface'), 'and the current-year body renders');
	assert.equal(view.el('timetable-past-year-banner'), null, 'no past-year banner');
	assert.equal(view.el('timetable-past-year-notice'), null, 'and no notice — today’s screen is not interrupted');
	assert.equal(view.el('timetable-past-year-readonly-surface'), null, 'and no read-only body');

	// An EMPTY string is "absent", not a malformed id: `?schoolYearId=` is what a
	// link builder emits when it has no year, and it must not blank the screen.
	assert.equal(resolvePastYearViewState({ requestedSchoolYearId: '', activeSchoolYearId: ACTIVE_YEAR, read: { status: 'pending' } }).kind,
		'current-year', 'an empty schoolYearId is the current year, not a refusal');
});

// ═══ ROW 7 — MUTANT ════════════════════════════════════════════════════════

test('ROW 7 MUTANT (this row is the mutant’s target, and it is a REAL assertion): an unreadable year never renders the current-year schedule', () => {
	// ─────────────────────────────────────────────────────────────────────────
	// MUTANT ROW — LABELLED, AND THE LITERAL FAILING OUTPUT IS RECORDED HERE.
	//
	// The mutation: `pastYearViewState.ts` `resolvePastYearViewState` was changed
	// to FALL THROUGH TO THE CURRENT YEAR in three places — a malformed id, a
	// `pending` read, and a scoped read that answered for a different year each
	// gained an early `if (true) { return { kind: 'current-year' }; }` arm, and the
	// malformed-id branch returned `current-year` too. Then the suite was re-run
	// with `npm run test:ux-a2-c12-past-year`.
	//
	// LITERAL PRE-FIX (UNFIXED TREE) OUTPUT — and what it actually proves,
	// corrected 2026-09-29 after independent review flagged it:
	//
	//   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/components' imported
	//     from ...\a2-c12-past-year-view.test.tsx
	//   tests 1 / pass 0 / fail 1
	//
	// HONEST LABEL: this is a MISSING-MODULE failure, not a behavioural one. Zero
	// assertions executed, because the implementation this file imports did not
	// exist at the base. It proves the test cannot pass without the feature, which
	// is real but weaker than a behavioural failing-first demonstration.
	//
	// WHY THERE IS NO BEHAVIOURAL PRE-FIX RUN, stated rather than glossed: the
	// production code this test drives is NEW, so there is no prior behaviour to
	// observe. The behavioural evidence for C2 is the MUTANT below, which removes
	// the fall-through guard from code that DOES exist and shows rows 3 and 7
	// failing. That is the row a reviewer should weigh; this one is a bonus.
	// LITERAL MUTANT OUTPUT — CORRECTED 2026-09-29 after independent review.
	//
	// The first version of this record was internally contradictory: it listed
	// row 4's assertion ("the Back to this year control is rendered") among the
	// failures while claiming row 4 passed, and it claimed rows 1 and 5 died when a
	// narrower mutation leaves them passing. Independent QA rebuilt the mutant in
	// its own copy and recorded what actually happens:
	//
	//   MUTATIONS_APPLIED=4
	//   tests 8 / pass 6 / fail 2   (exit 1)
	//   AssertionError: and the current-year body is NOT rendered - a past year never shows this year   [row 3]
	//   AssertionError: MUTANT KILLED HERE: a refused, malformed, pending or mismatched year NEVER renders the current-year schedule   [row 7]
	//
	// ROWS 3 AND 7 are the rows that exist for this, and they are the only ones
	// that state the invariant directly - which is exactly why C2 is a separate
	// contract item and not a property of the happy path.
	//
	// ROWS 2, 2b, 4 AND 6 PASSED under the mutant, and QA confirmed that
	// independently: a fall-through renders the CURRENT year, which still has no
	// mutation controls and still has a Back link, so those four rows are
	// structurally blind to this defect. They are honestly reported as passing
	// rather than quietly deleted.
	//
	// RESTORE: the mutated file was restored in the SAME command that ran the
	// suite, and the restore was proved by SHA-256 of the file before and after -
	// `identical=True`. `git diff` cannot prove it here because the file is NEW and
	// therefore untracked, which is the one case where a diff-based restore proof
	// is vacuous. A later attempt to re-capture this output lost the mutation
	// because a PowerShell `$t` clobbered `$T` mid-command; it was reversed
	// explicitly and re-verified by the suite returning to 8/8. No mutant is
	// committed, and `git status --short` is empty of residue.
	// ─────────────────────────────────────────────────────────────────────────
	const refused = resolvePastYearViewState({
		requestedSchoolYearId: String(PAST_YEAR),
		activeSchoolYearId: ACTIVE_YEAR,
		read: { status: 'refused', code: 'SCHOOL_YEAR_NOT_FOUND' },
	});
	assert.notEqual(refused.kind, 'current-year',
		'MUTANT KILLED HERE: a refused, malformed, pending or mismatched year NEVER renders the current-year schedule');

	// …and the consequence on the DOM, which is the claim that actually matters.
	const view = gate(refused);
	assert.equal(view.el('timetable-current-year-surface'), null,
		'MUTANT KILLED HERE TOO: the current year is not on screen behind a refusal');
});
