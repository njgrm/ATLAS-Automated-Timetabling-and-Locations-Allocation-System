/**
 * A8 C3 — one line per ROOT CAUSE, and one "Check again" for the whole panel.
 *
 * The operator on live S.Y. 2023-2024 saw 651 identical rows, each carrying its
 * own "Recheck generation readiness" button. Two defects, one cause: the panel
 * rendered one row per BLOCKER ROW, and the session-level rows (570 of the 651)
 * are the same fact as the 50 class-level rows.
 *
 * This file is the failing-first control for both halves:
 *
 *  - the pure adapter must carry the server's `groups` / `gapCount` /
 *    `blockerCount` / `gapClassCount` and must treat a teacher gap as READY;
 *  - the rendered panel must show at most one line per group plus exactly ONE
 *    "Check again" control, with the full row list still reachable behind the
 *    existing disclosure (nothing is deleted to make the header look calm).
 *
 * Run: `npm run test:a8-c3-generate-gaps` (also named in `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable/setup' });
function matchMediaStub(query: string) {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = min ? 1366 >= Number(min[1]) : max ? 1366 <= Number(max[1]) : false;
	return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const {
	deriveGenerationReadinessState,
	presentGenerationBlockerGroups,
	representativeBlockerCode,
} = await import('../../../lib/timetable-generation-readiness');
const { BLOCKER_CODE_COPY } = await import('../../../lib/timetable-blocker-code-copy');
const { deriveTimetableCapabilities } = await import('../../../lib/timetable-capabilities');

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReactElement) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

/* ------------------------------------------------------------------ *
 * The live 2023-2024 payload: 620 coverage rows folded by the SERVER,
 * one group; 31 real rows in three further groups.
 * ------------------------------------------------------------------ */
function liveDiagnostic() {
	const blockers = [
		{ code: 'TL_DEMAND_UNCOVERED', category: 'DATA_GAP', termIdentity: 'T1', sectionId: 700, subjectId: 31, subjectCode: 'MAPEH', entity: 'Section 700 · Subject MAPEH', reason: 'r', owningSurface: 'Teaching Load', nextAction: 'n' },
		{ code: 'WORKLOAD_POLICY_BLOCK', category: 'POLICY_BLOCKER', termIdentity: 'T1', sectionId: 901, subjectId: 41, subjectCode: 'ENG', entity: 'Section 901 · Subject ENG', reason: 'r', owningSurface: 'Teaching Load', nextAction: 'n' },
		{ code: 'FACULTY_SUBJECT_NOT_QUALIFIED', category: 'ALGORITHM_LIMIT', termIdentity: null, sectionId: 902, subjectId: 42, subjectCode: 'SCI', entity: 'Section 902 · Subject SCI', reason: 'r', owningSurface: 'Teaching Load', nextAction: 'n' },
		{ code: 'FACULTY_OVERLOAD', category: 'ALGORITHM_LIMIT', termIdentity: null, sectionId: null, subjectId: null, subjectCode: null, entity: 'Run validation · FACULTY_OVERLOAD', reason: 'r', owningSurface: 'Generation assembly', nextAction: 'n' },
	];
	return {
		scope: { schoolId: 1, schoolYearId: 2 },
		status: 'BLOCKED',
		generateAllowed: false,
		schedulerExecuted: true,
		derivedDemandRevision: 'REV',
		termStructure: { format: 'TRIMESTER', terms: [{ identity: 'T1', order: 1 }, { identity: 'T2', order: 2 }] },
		totals: { lines: 40, pairs: 12, sessionsByTerm: { T1: 20, T2: 20 } },
		teachingLoadCoverage: { requiredPairs: 264, ownedPairs: 214, missingPairs: 50, inactiveOrStalePairs: 0, outsideScopePairs: 0 },
		blockerCount: 3,
		gapCount: 620,
		gapClassCount: 50,
		groups: [
			{ cause: 'TEACHER_COVERAGE_GAP', code: 'TL_DEMAND_UNCOVERED', codes: ['TL_DEMAND_UNCOVERED', 'TL_NO_QUALIFIED_OWNER'], count: 50, sessionCount: 620, unit: 'classes', examples: ['MAPEH 7-A', 'ENG 7-B'], action: { label: 'Assign teachers', target: '/teaching-load' } },
			{ cause: 'WORKLOAD_POLICY_BLOCK', code: 'WORKLOAD_POLICY_BLOCK', codes: ['WORKLOAD_POLICY_BLOCK'], count: 15, sessionCount: 15, unit: 'classes', examples: ['ENG 7-C'], action: { label: 'Review their load', target: '/teaching-load' } },
			{ cause: 'FACULTY_SUBJECT_NOT_QUALIFIED', code: 'FACULTY_SUBJECT_NOT_QUALIFIED', codes: ['FACULTY_SUBJECT_NOT_QUALIFIED'], count: 12, sessionCount: 12, unit: 'classes', examples: ['SCI 7-D'], action: { label: 'Review their load', target: '/teaching-load' } },
			{ cause: 'FACULTY_OVERLOAD', code: 'FACULTY_OVERLOAD', codes: ['FACULTY_OVERLOAD'], count: 4, sessionCount: 4, unit: 'items', examples: ['Teacher above weekly load'], action: { label: 'Review their load', target: '/teaching-load' } },
		],
		blockers,
		zeroWrite: true,
	};
}

/** The candidate's blocking-free case: ONLY the teacher gap. */
function gapOnlyDiagnostic() {
	const base = liveDiagnostic();
	return {
		...base,
		status: 'READY',
		generateAllowed: true,
		blockerCount: 0,
		groups: [base.groups[0]],
		blockers: [base.blockers[0]],
	};
}

/**
 * A8-C5 A9 — the FOUR causes the packet pins for browser row B4, as the server
 * would group them. Chosen to span FOUR different fix routes, so a button-href
 * assertion over this fixture discriminates: if the panel ever sent every cause
 * to one page, or reused the server's own action instead of the table's, this
 * fixture is what notices.
 */
function fourCauseDiagnostic() {
	const base = liveDiagnostic();
	return {
		...base,
		blockerCount: 4,
		groups: [
			{ cause: 'TEACHER_COVERAGE_GAP', code: 'TL_DEMAND_UNCOVERED', codes: ['TL_DEMAND_UNCOVERED', 'TL_NO_QUALIFIED_OWNER'], count: 50, sessionCount: 620, unit: 'classes', examples: ['MAPEH 7-A'], action: { label: 'Assign teachers', target: '/teaching-load' } },
			{ cause: 'ROOMS_MISSING', code: 'ROOMS_MISSING', codes: ['ROOMS_MISSING'], count: 7, sessionCount: 7, unit: 'classes', examples: ['ENG 7-B'], action: { label: 'Open Year Setup', target: '/admin/year-setup' } },
			{ cause: 'GRADE_WINDOW_MISSING', code: 'GRADE_WINDOW_MISSING', codes: ['GRADE_WINDOW_MISSING'], count: 3, sessionCount: 3, unit: 'classes', examples: ['SCI 7-D'], action: { label: 'Open Year Setup', target: '/admin/year-setup' } },
			{ cause: 'SECTION_SETUP_REQUIRED', code: 'SECTION_SETUP_REQUIRED', codes: ['SECTION_SETUP_REQUIRED'], count: 2, sessionCount: 2, unit: 'classes', examples: [], action: { label: 'Open Year Setup', target: '/admin/year-setup' } },
		],
	};
}

/**
 * A8-C5 S1.2 / A9 — the THIRD ownership state, as the panel receives it: its own
 * group, its own line, `blockerCount: 0` beside it.
 *
 * The server has already decided that a placeholder-owned class blocks neither
 * generation nor publication, so what the client can honestly prove is narrower
 * and is what this fixture proves: the state is NAMED on its own line, in the
 * same sentence shape as every other line, it is not folded into the "no
 * teacher" line it is most easily confused with, and it does not turn a
 * zero-blocker diagnostic into a blocked one.
 */
function placeholderOwnedDiagnostic() {
	const base = liveDiagnostic();
	return {
		...base,
		status: 'READY',
		generateAllowed: true,
		blockerCount: 0,
		groups: [
			{ cause: 'PLACEHOLDER_OWNER', code: 'SYNTHETIC_PLACEHOLDER_OWNED', codes: ['SYNTHETIC_PLACEHOLDER_OWNED'], count: 12, sessionCount: 12, unit: 'classes', examples: ['FIL 7-E'], action: { label: 'Assign teachers', target: '/teaching-load' } },
			base.groups[0],
		],
		blockers: [base.blockers[0]],
	};
}

/** The shape every panel line must have: a count, a unit, a verb, plain words. */
const LINE_SHAPE = /^\d+ [a-z][a-z ]* (is|are|needs|need|not|with|outside|over|waiting|on|beyond|without|sharing|ordered) /;

test('C3.1 the adapter carries the server groups, the gap counts, and the blocking count', () => {
	const state = deriveGenerationReadinessState(liveDiagnostic(), { schoolId: 1, schoolYearId: 2 });
	assert.equal(state.state, 'blocked');
	if (state.state !== 'blocked') return;
	assert.equal(state.diagnostic.groups.length, 4, 'one entry per root cause, not per row');
	assert.equal(state.diagnostic.gapCount, 620);
	assert.equal(state.diagnostic.gapClassCount, 50);
	assert.equal(state.diagnostic.blockerCount, 3, 'the blocking count is not the raw row count');
	assert.equal(state.diagnostic.blockers.length, 4, 'the raw row list is still carried for the disclosure');
});

test('C3.2 a year whose ONLY gap is teacher coverage reads READY, and the Generate gate follows the server', () => {
	const state = deriveGenerationReadinessState(gapOnlyDiagnostic(), { schoolId: 1, schoolYearId: 2 });
	assert.equal(state.state, 'ready', 'a teacher gap must not read as "setup needs attention"');
	const summary = state.state === 'ready'
		? { generateAllowed: state.diagnostic.generateAllowed, zeroWrite: state.diagnostic.zeroWrite, blockerCount: state.diagnostic.blockerCount, gapCount: state.diagnostic.gapCount, gapClassCount: state.diagnostic.gapClassCount }
		: null;
	assert.deepEqual(summary, { generateAllowed: true, zeroWrite: true, blockerCount: 0, gapCount: 620, gapClassCount: 50 });

	const capabilities = deriveTimetableCapabilities({
		scopeResolved: true,
		curriculumState: 'ready',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: false,
		isPublished: false,
		latestRunFailed: false,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
		hasSelectedEntry: false,
		requestPendingCount: 0,
		generationDiagnostic: summary,
	});
	assert.equal(capabilities.gates.generation.enabled, true, 'the server decision is the gate');
});

test('C3.3 the gate still refuses when the diagnostic did not prove zero-write or did not allow', () => {
	for (const summary of [
		{ generateAllowed: true, zeroWrite: false, blockerCount: 0, gapCount: 620, gapClassCount: 50 },
		{ generateAllowed: false, zeroWrite: true, blockerCount: 0, gapCount: 620, gapClassCount: 50 },
	]) {
		const capabilities = deriveTimetableCapabilities({
			scopeResolved: true,
			curriculumState: 'ready',
			generating: false,
			isPreGeneration: false,
			hasGeneratedRun: false,
			isPublished: false,
			latestRunFailed: false,
			hardCount: 0,
			unassignedCount: 0,
			softCount: 0,
			hasSelectedEntry: false,
			requestPendingCount: 0,
			generationDiagnostic: summary,
		});
		assert.equal(capabilities.gates.generation.enabled, false, 'a gap never substitutes for allow + zero-write');
	}
});

test('C3.4 a group line reads in plain words: cause, class count, examples — and no engine token', () => {
	const state = deriveGenerationReadinessState(liveDiagnostic(), { schoolId: 1, schoolYearId: 2 });
	if (state.state !== 'blocked') throw new Error('fixture must be blocked');
	const groups = presentGenerationBlockerGroups({
		diagnostic: state.diagnostic,
		labelForSection: (id) => `GR7 - Section ${id}`,
	});
	assert.equal(groups.length, 4);
	assert.equal(groups[0].headline, '50 classes need a teacher', 'the headline counts classes, never sessions');
	assert.match(groups[0].detail ?? '', /MAPEH 7-A/, 'the examples name real classes');
	assert.equal(groups[0].action.kind, 'navigate');
	assert.equal(groups[0].action.kind === 'navigate' ? groups[0].action.href : null, '/teaching-load');
	// The packet's own target line for the teacher-cap cause.
	assert.equal(groups[3].headline, '4 teachers are over their weekly limit');
	assert.equal(groups[3].action.kind === 'navigate' ? groups[3].action.href : null, '/teaching-load');
	for (const group of groups) {
		assert.doesNotMatch(group.headline, /_/, 'no engine code in the headline');
		assert.doesNotMatch(group.headline, /…|\.\.\./, 'no truncation');
	}
});

test('C3.5 the rendered panel shows ONE line per group and exactly ONE "Check again"', async () => {
	const { SimpleGenerationBlockerSheetBody } = await import('../simple/SimpleGenerationBlockerSheet');
	const state = deriveGenerationReadinessState(liveDiagnostic(), { schoolId: 1, schoolYearId: 2 });
	if (state.state !== 'blocked') throw new Error('fixture must be blocked');
	let retries = 0;
	await mount(createElement(MemoryRouter, null,
		createElement(SimpleGenerationBlockerSheetBody, {
			// `rows` is deliberately NOT passed: the body must derive the complete
			// row list from the diagnostic itself, so the disclosed detail can never
			// be an empty list beside a non-empty blocker array.
			diagnostic: state.diagnostic,
			groups: presentGenerationBlockerGroups({ diagnostic: state.diagnostic }),
			blockingCount: state.diagnostic.blockerCount,
			gapClassCount: state.diagnostic.gapClassCount,
			onRetry: () => { retries += 1; },
			onRequestClose: () => {},
		}),
	));
	const lines = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group"]'));
	assert.equal(lines.length, 4, 'four root causes render as four lines, not 4 rows out of 651');
	const checks = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-check-again"]'));
	assert.equal(checks.length, 1, 'exactly ONE "Check again" control for the whole panel');
	checks[0].click();
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	assert.equal(retries, 1, 'the panel-level control really re-runs the check');
	assert.equal(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-retry"]').length, 0,
		'the per-row "Recheck generation readiness" control is gone');
	// The whole raw list stays reachable behind the disclosure — nothing deleted.
	// The trigger is CLICKED, so this proves reachability rather than mere presence
	// in the tree: a disclosure that could never be opened would be a deletion.
	const trigger = document.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-detail-trigger"]');
	assert.ok(trigger, 'the full row list is behind a disclosure control');
	assert.match(trigger.textContent ?? '', /4 setup items/, 'the disclosure names the real row count it folds');
	const panel = () => document.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-detail"]');
	const contentState = () => panel()?.closest<HTMLElement>('[data-slot="accordion-content"]')?.getAttribute('data-state');
	assert.equal(contentState(), 'closed', 'the detail is not on screen until the operator asks for it — this is the subtraction');
	await act(async () => { trigger.click(); });
	for (let index = 0; index < 3; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
	assert.equal(contentState(), 'open', 'opening the disclosure shows the full row list');
	assert.equal(panel()?.querySelectorAll('[data-testid="timetable-generation-blocker-item"]').length, 4,
		'every blocker row is still rendered, with its real per-row repair');
	assert.match(panel()?.textContent ?? '', /4 setup items in full/, 'the raw list states its own count');
});

/* ------------------------------------------------------------------ *
 * A8-C5 A9 — the RENDERED proof that the panel is correct against the
 * S2.1 table. A7 is the source-level completeness control; these two rows
 * are the control that a scheduler actually sees a fixable line.
 * ------------------------------------------------------------------ */

test('C3.6 A8-C5 A9: every rendered line carries the CLASS count and its own fix route, with exactly ONE "Check again"', async () => {
	const { SimpleGenerationBlockerSheetBody } = await import('../simple/SimpleGenerationBlockerSheet');
	const state = deriveGenerationReadinessState(fourCauseDiagnostic(), { schoolId: 1, schoolYearId: 2 });
	if (state.state !== 'blocked') throw new Error('fixture must be blocked');
	await mount(createElement(MemoryRouter, null,
		createElement(SimpleGenerationBlockerSheetBody, {
			diagnostic: state.diagnostic,
			groups: presentGenerationBlockerGroups({ diagnostic: state.diagnostic }),
			blockingCount: state.diagnostic.blockerCount,
			gapClassCount: state.diagnostic.gapClassCount,
			onRetry: () => {},
			onRequestClose: () => {},
		}),
	));

	const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group"]'));
	assert.equal(rows.length, 4, 'one line per root cause');
	assert.equal(
		document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-check-again"]').length,
		1,
		'exactly ONE "Check again" for the panel, whatever the number of causes',
	);
	assert.equal(
		document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group-action"]').length,
		4,
		'ONE fix button per cause — not one per blocker row, and not one shared button',
	);

	// The RENDERED anchor, not the model: the row a scheduler clicks is the proof.
	const expectedHrefs = state.diagnostic.groups.map((group) => {
		const code = representativeBlockerCode(group);
		assert.ok(code, `${group.cause} must resolve a code the shared table knows — a code with no row is a defect (A7)`);
		return BLOCKER_CODE_COPY[code!].route;
	});
	assert.ok(
		new Set(expectedHrefs).size >= 3,
		`THE CONTROL IS NOT VACUOUS: this fixture must span several fix routes (it spans ${new Set(expectedHrefs).size}), or an href assertion over it proves nothing`,
	);

	rows.forEach((row, index) => {
		const headline = row.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-group-headline"]')?.textContent ?? '';
		const group = state.diagnostic.groups[index];
		assert.match(headline.trim(), LINE_SHAPE, `line ${index} must read as a counted sentence: ${headline}`);
		assert.ok(
			headline.includes(String(group.count)),
			`line ${index} must carry the count the server measured for THIS group (${group.count}), never a session count: ${headline}`,
		);
		assert.doesNotMatch(headline, /[A-Z][A-Z0-9_]{4,}/, `line ${index} must not print an engine code: ${headline}`);
		assert.doesNotMatch(headline, /…|\.\.\./, `line ${index} must not truncate: ${headline}`);
		assert.doesNotMatch(headline, /\b#\d+\b/, `line ${index} must not print an id: ${headline}`);

		const anchor = row.querySelector<HTMLAnchorElement>('[data-testid="timetable-generation-blocker-group-action"]');
		assert.ok(anchor, `line ${index} must render its own fix button`);
		assert.equal(
			anchor!.getAttribute('href'),
			expectedHrefs[index],
			`the button on line ${index} must open the S2.1 route for that cause — the server's own action and the table disagree here, and the table is the authority`,
		);
		assert.ok((anchor!.textContent ?? '').trim().length > 0, `line ${index}'s button must carry a visible label`);
	});
});

test('C3.7 A8-C5 A9: the placeholder-owned THIRD state is named on its own line, in the same shape, and is not a blocker', async () => {
	const { SimpleGenerationBlockerSheetBody } = await import('../simple/SimpleGenerationBlockerSheet');
	const state = deriveGenerationReadinessState(placeholderOwnedDiagnostic(), { schoolId: 1, schoolYearId: 2 });

	// NOT A BLOCKER. The server counted zero blocking rows, and a to-be-hired
	// owner must not turn that into a blocked state — that is the S1.2 contract
	// observed from the client side.
	assert.equal(state.state, 'ready', 'a class on a to-be-hired teacher does not stop generation');
	const capabilities = deriveTimetableCapabilities({
		scopeResolved: true,
		curriculumState: 'ready',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: false,
		isPublished: false,
		latestRunFailed: false,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
		hasSelectedEntry: false,
		requestPendingCount: 0,
		generationDiagnostic: state.state === 'ready'
			? {
				generateAllowed: state.diagnostic.generateAllowed,
				zeroWrite: state.diagnostic.zeroWrite,
				blockerCount: state.diagnostic.blockerCount,
				gapCount: state.diagnostic.gapCount,
				gapClassCount: state.diagnostic.gapClassCount,
			}
			: null,
	});
	assert.equal(capabilities.gates.generation.enabled, true, 'the third state leaves the generation gate enabled');

	// NAMED, in the same sentence shape as every other line.
	await mount(createElement(MemoryRouter, null,
		createElement(SimpleGenerationBlockerSheetBody, {
			diagnostic: state.diagnostic,
			groups: presentGenerationBlockerGroups({ diagnostic: state.diagnostic }),
			blockingCount: state.diagnostic.blockerCount,
			gapClassCount: state.diagnostic.gapClassCount,
			onRetry: () => {},
			onRequestClose: () => {},
		}),
	));
	const headlines = Array.from(
		document.querySelectorAll<HTMLElement>('[data-testid="timetable-generation-blocker-group-headline"]'),
	).map((node) => node.textContent?.trim() ?? '');
	assert.equal(headlines.length, 2, 'the third state is its OWN line, not folded into the no-teacher line');
	assert.equal(
		headlines[0],
		'12 classes are on a to-be-hired teacher',
		'the third state is named in the same sentence shape: count, unit, plain predicate',
	);
	assert.match(headlines[0], LINE_SHAPE);
	for (const headline of headlines) {
		assert.doesNotMatch(headline, /[A-Z][A-Z0-9_]{4,}/, `no engine code on screen: ${headline}`);
		assert.doesNotMatch(headline, /…|\.\.\./, `no truncation on screen: ${headline}`);
	}
	// DISCRIMINATION: the two lines must be genuinely different sentences, or
	// "it is named" would also be true of a copy of the coverage line.
	assert.notEqual(headlines[0], headlines[1], 'the to-be-hired line must not reuse the no-teacher wording');
	assert.equal(headlines[1], '50 classes need a teacher', 'and the no-teacher line is unchanged beside it');

	const row = document.querySelector<HTMLElement>('[data-testid="timetable-generation-blocker-group"]');
	const anchor = row?.querySelector<HTMLAnchorElement>('[data-testid="timetable-generation-blocker-group-action"]');
	assert.equal(
		anchor?.getAttribute('href'),
		BLOCKER_CODE_COPY.SYNTHETIC_PLACEHOLDER_OWNED.route,
		'its button opens the S2.1 route for the third state',
	);
});
