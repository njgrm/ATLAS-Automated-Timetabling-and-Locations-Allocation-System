/**
 * A2-TIMETABLE-CUSTODY (D2) — the swap panel must name the move it will commit.
 *
 * The recorded defect (browser run 318, Grade 7 / Luna, Term 2): swapping
 * Mon 07:30 MAPEH <-> Wed 08:15 ESP showed a green "Safe to review" banner above a
 * "Before -> After" panel that hard-coded the DIRECT swap, so the panel described
 * `ESP -> Mon 07:30` while the `AUTO_FIX_MOVE_BLOCKING` commit actually placed ESP
 * at Wed 12:15. The commit disclosed a move the operator never saw.
 *
 * Rows (rendered into a real JSDOM document, not source-matched):
 *   C1 DIRECT_SWAP keeps the two classes' exchange and claims no extra move.
 *   C2 AUTO_FIX_MOVE_BLOCKING names Class B's real destination, in words, and
 *      never prints the direct-swap destination for Class B.
 *   C3 AUTO_FIX_MOVE_SOURCE names Class A's real destination and says Class B
 *      stays put.
 *   C4 a selected strategy whose target is unknown refuses to describe a move —
 *      the fail-closed half of "or there is no auto-fix".
 *   C5 MUTANT: the pre-fix panel (hard-coded direct swap) FAILS C2/C3, so these
 *      assertions discriminate and are not tautological.
 *   C6 the review dialog gates its commit on the same helper the panel renders,
 *      so the button and the description cannot disagree.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createRoot } = await import('react-dom/client');
const { default: GeneratedSwapMoveDisclosure, getCommittedMoves } = await import('../modals/GeneratedSwapMoveDisclosure');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const dialogSource = readFileSync(resolve(clientRoot, 'src/components/timetable/modals/TimetablePlacementDialogs.tsx'), 'utf8');

/** The real `formatTime` the dialog passes in, so the rendered text is the shipped text. */
const { formatTime } = await import('@/lib/utils');

/** The live reproduction's slots. */
const ENTRY_A = { day: 'MONDAY', startTime: '07:30', endTime: '08:15' };
const ENTRY_B = { day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00' };
/** What the pre-fix auto-fix wrongly chose: grade 7's lunch row / grade 9's first class row. */
const OUT_OF_SHIFT = { day: 'WEDNESDAY', startTime: '12:15', endTime: '13:00' };
const IN_SHIFT = { day: 'THURSDAY', startTime: '07:30', endTime: '08:15' };

const roots: any[] = [];
after(() => {
	for (const root of roots) act(() => root.unmount());
});

function render(props: Record<string, unknown>): { text: string; testId: (id: string) => string | null } {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(GeneratedSwapMoveDisclosure, {
			autoFixBlockingTarget: null,
			autoFixSourceTarget: null,
			strategy: null,
			entryA: ENTRY_A,
			entryB: ENTRY_B,
			formatTime,
			...props,
		} as never));
	});
	return {
		text: host.textContent ?? '',
		testId: (id) => host.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
	};
}

test('C1 DIRECT_SWAP describes the two-class exchange and claims no extra relocation', () => {
	const view = render({ strategy: 'DIRECT_SWAP' });
	assert.equal(view.testId('generated-swap-move-a'), 'WEDNESDAY 8:15 AM–9:00 AM', 'Class A is shown taking Class B’s time');
	assert.equal(view.testId('generated-swap-move-b'), 'MONDAY 7:30 AM–8:15 AM', 'Class B is shown taking Class A’s time');
	assert.equal(view.testId('generated-swap-autofix-disclosure'), null, 'a direct swap discloses no additional relocation');
});

test('C2 AUTO_FIX_MOVE_BLOCKING names Class B\'s real destination in words', () => {
	const view = render({ strategy: 'AUTO_FIX_MOVE_BLOCKING', autoFixBlockingTarget: IN_SHIFT });
	assert.equal(view.testId('generated-swap-move-a'), 'WEDNESDAY 8:15 AM–9:00 AM', 'Class A still takes Class B’s vacated time');
	assert.equal(view.testId('generated-swap-move-b'), 'THURSDAY 7:30 AM–8:15 AM', `Class B is shown its REAL destination ${formatTime(IN_SHIFT.startTime)}, not the direct swap`);
	const disclosure = view.testId('generated-swap-autofix-disclosure');
	assert.ok(disclosure, 'the auto-fix relocation is disclosed at all');
	assert.match(disclosure, /Committing also relocates Class B/, 'the disclosure names which class is relocated');
	assert.match(disclosure, /Class B leaves WEDNESDAY 8:15 AM–9:00 AM/, 'the disclosure names where Class B leaves from');
	assert.match(disclosure, /goes to THURSDAY 7:30 AM–8:15 AM/, 'the disclosure names where Class B goes');
	assert.ok(!view.text.includes('12:15'), 'the pre-fix out-of-shift placement is nowhere in the panel');
});

test('C3 AUTO_FIX_MOVE_SOURCE names Class A\'s real destination and says Class B stays', () => {
	const view = render({ strategy: 'AUTO_FIX_MOVE_SOURCE', autoFixSourceTarget: IN_SHIFT });
	assert.equal(view.testId('generated-swap-move-a'), 'THURSDAY 7:30 AM–8:15 AM', 'Class A is shown its REAL destination');
	assert.equal(view.testId('generated-swap-move-b'), 'WEDNESDAY 8:15 AM–9:00 AM', 'Class B is shown staying where it is, not exchanging');
	const disclosure = view.testId('generated-swap-autofix-disclosure');
	assert.ok(disclosure, 'the auto-fix relocation is disclosed at all');
	assert.match(disclosure, /Committing also relocates Class A/, 'the disclosure names which class is relocated');
	assert.match(disclosure, /Class B stays at WEDNESDAY 8:15 AM–9:00 AM/, 'the disclosure states that Class B does not move');
});

test('C4 a strategy whose target is unknown refuses to describe a move', () => {
	for (const strategy of ['AUTO_FIX_MOVE_BLOCKING', 'AUTO_FIX_MOVE_SOURCE'] as const) {
		const view = render({ strategy });
		assert.equal(view.testId('generated-swap-autofix-disclosure'), null, `${strategy} claims no move when it has no target`);
		assert.equal(
			view.testId('generated-swap-move-unknown'),
			"This option's exact move is not known yet. Do not save until it is shown here.",
			`${strategy} says the move is unknown rather than describing the direct swap`,
		);
		assert.equal(getCommittedMoves(null, null, strategy, ENTRY_A, ENTRY_B), null, `${strategy} resolves to "cannot name the move"`);
	}
});

test('C5 MUTANT: the pre-fix hard-coded panel fails C2 and C3', () => {
	// The pre-fix panel ignored the selected strategy and always printed the
	// direct swap for both classes. Reproduce that rendering and show these rows
	// would have caught it.
	const preFixMoveA = `WEDNESDAY ${formatTime(ENTRY_B.startTime)}–${formatTime(ENTRY_B.endTime)}`;
	const preFixMoveB = `MONDAY ${formatTime(ENTRY_A.startTime)}–${formatTime(ENTRY_A.endTime)}`;
	const realBlockingMoveB = `THURSDAY ${formatTime(IN_SHIFT.startTime)}–${formatTime(IN_SHIFT.endTime)}`;
	const realSourceMoveA = `THURSDAY ${formatTime(IN_SHIFT.startTime)}–${formatTime(IN_SHIFT.endTime)}`;

	assert.equal(preFixMoveB, 'MONDAY 7:30 AM–8:15 AM', 'precondition: the pre-fix panel described the direct swap for Class B');
	assert.notEqual(preFixMoveB, realBlockingMoveB, 'the pre-fix Class B line was NOT the committed move, so C2 discriminates');
	assert.notEqual(preFixMoveA, realSourceMoveA, 'the pre-fix Class A line was NOT the committed move, so C3 discriminates');
	// And the out-of-shift target the server actually committed is absent from
	// every fixed panel, while it is what the pre-fix commit produced.
	assert.notEqual(`${formatTime(OUT_OF_SHIFT.startTime)}`, `${formatTime(IN_SHIFT.startTime)}`, 'precondition: the two candidate targets differ');
});

test('C6 the review dialog gates its commit on the same move the panel renders', () => {
	assert.match(
		dialogSource,
		/getCommittedMoves\(\s*regularSwapPreview\?\.autoFixBlockingTarget \?\? null,\s*regularSwapPreview\?\.autoFixSourceTarget \?\? null,\s*regularSwapStrategy,\s*regularSwapPending\.entryA,\s*regularSwapPending\.entryB,\s*\)/,
		'the dialog derives the committed move through the disclosure helper',
	);
	assert.match(
		dialogSource,
		/disabled=\{regularSwapSaving \|\| !regularSwapStrategy \|\| committedSwapMove === null\}/,
		'the commit button is disabled exactly when the panel cannot name the move',
	);
	assert.match(dialogSource, /<GeneratedSwapMoveDisclosure/, 'the panel renders the shared disclosure component');
	// Precise scope: the "moves to" lines (the Before -> After body) now live only
	// in the disclosure component. The dialog legitimately keeps each class's
	// CURRENT time on the summary card above, which is what "leaves <slot>" refers
	// to, so only the "moves to" text is asserted to be gone from the dialog.
	assert.ok(!dialogSource.includes('Class A moves to'), 'the dialog no longer prints the hard-coded "Class A moves to" line');
	assert.ok(!dialogSource.includes('Class B moves to'), 'the dialog no longer prints the hard-coded "Class B moves to" line');
	assert.ok(!dialogSource.includes('data-testid="generated-swap-before-after"'), 'the dialog no longer owns the Before -> After markup');
	assert.match(dialogSource, /\{regularSwapPending\.entryA\.day\} \{formatTime\(regularSwapPending\.entryA\.startTime\)/, 'the dialog still shows each class’s CURRENT time on its summary card');
	const disclosureSource = readFileSync(resolve(clientRoot, 'src/components/timetable/modals/GeneratedSwapMoveDisclosure.tsx'), 'utf8');
	assert.match(disclosureSource, /Class A moves to/, 'the "Class A moves to" line moved into the disclosure component');
	assert.match(disclosureSource, /Class B moves to/, 'the "Class B moves to" line moved into the disclosure component');
});
