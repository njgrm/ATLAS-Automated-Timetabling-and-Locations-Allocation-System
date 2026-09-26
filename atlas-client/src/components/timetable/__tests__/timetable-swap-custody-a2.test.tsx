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
 *
 * P-rows — the PRESENTATION layer over the same accepted move (LANE-C D-row).
 * The D2 correctness above is settled and deployed; these rows change only how
 * that already-correct move is presented, and add no new truthfulness contract.
 * The payload carries no reason string, so nothing here invents one: the auto-move
 * row is marked with an icon and the commit button names the relocation count.
 *   P1 the commit label claims a move in exactly one state: the state that
 *      relocates a class. Direct exchange, unnameable move, and no strategy all
 *      keep the plain swap label, so the button never promises a move the panel
 *      cannot name.
 *   P2 the auto-move row carries a real amber icon in BOTH relocating strategies.
 *   P3 no icon when nothing relocates — the marker never appears for a plain
 *      exchange, and never appears in the fail-closed unknown state.
 *   P4 the review dialog renders the move-aware label and no longer hard-codes it.
 *   P5 MUTANT: the pre-fix constant label and the pre-fix button body both fail
 *      P1/P4, so those rows discriminate and are not tautological.
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
const swapDisclosureModule = await import('../modals/GeneratedSwapMoveDisclosure');
const {
	default: GeneratedSwapMoveDisclosure,
	getCommittedMoves,
	getSwapCommitLabel,
	getRelocatedClassCount,
	formatRelocatedClassLabel,
} = swapDisclosureModule;

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

function render(props: Record<string, unknown>): { text: string; testId: (id: string) => string | null; host: HTMLElement } {
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
		host,
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

// ---------------------------------------------------------------------------
// P-rows — the presentation layer. See the header note: no reason string is
// invented, and the D2 correctness above is untouched.
// ---------------------------------------------------------------------------

/** The three real payload states, derived through the accepted D2 helper. */
const DIRECT_MOVES = getCommittedMoves(null, null, 'DIRECT_SWAP', ENTRY_A, ENTRY_B);
const BLOCKING_MOVES = getCommittedMoves(IN_SHIFT, null, 'AUTO_FIX_MOVE_BLOCKING', ENTRY_A, ENTRY_B);
const SOURCE_MOVES = getCommittedMoves(null, IN_SHIFT, 'AUTO_FIX_MOVE_SOURCE', ENTRY_A, ENTRY_B);
/** An auto-fix strategy whose target the panel cannot name — the fail-closed state. */
const UNNAMEABLE_MOVES = getCommittedMoves(null, null, 'AUTO_FIX_MOVE_BLOCKING', ENTRY_A, ENTRY_B);

/** The pre-fix commit button body, verbatim, so P4 can be shown to reject it. */
const PRE_FIX_COMMIT_BUTTON = [
	'\t\t\t\t\t\t\t<Button',
	'\t\t\t\t\t\t\t\tclassName="min-h-[40px] sm:min-h-[44px]"',
	'\t\t\t\t\t\t\t\tdisabled={regularSwapSaving || !regularSwapStrategy || committedSwapMove === null}',
	'\t\t\t\t\t\t\t\tonClick={() => void executeRegularSwap()}',
	'\t\t\t\t\t\t\t>',
	'\t\t\t\t\t\t\t\t{regularSwapSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}',
	'\t\t\t\t\t\t\t\tSwap sessions',
	'\t\t\t\t\t\t\t</Button>',
].join('\n');

/** The rule P4 uses to reject a hard-coded button label. */
const HARDCODED_LABEL_RULE = /^[^\S\n]*Swap sessions[^\S\n]*$/m;

test('P1 the commit label claims a move in exactly one state: the state that relocates a class', () => {
	assert.equal(typeof getSwapCommitLabel, 'function', 'the move-aware commit label helper is exported');
	assert.equal(typeof getRelocatedClassCount, 'function', 'the relocated-class count helper is exported');
	assert.equal(typeof formatRelocatedClassLabel, 'function', 'the relocated-class phrase helper is exported');

	// State 1 — direct two-class exchange. Nothing relocates, so no "move" claim.
	assert.equal(getRelocatedClassCount(DIRECT_MOVES), 0, 'a direct swap relocates no class beyond the exchange');
	assert.equal(getSwapCommitLabel(DIRECT_MOVES), 'Swap sessions', 'a direct swap keeps the plain swap label');

	// State 2 — exactly one class relocated. The label says so, in the singular.
	assert.equal(getRelocatedClassCount(BLOCKING_MOVES), 1, 'AUTO_FIX_MOVE_BLOCKING relocates exactly one class');
	assert.equal(getSwapCommitLabel(BLOCKING_MOVES), 'Swap + move 1 class', 'the label names the one relocated class, in the singular');
	assert.equal(getRelocatedClassCount(SOURCE_MOVES), 1, 'AUTO_FIX_MOVE_SOURCE relocates exactly one class');
	assert.equal(getSwapCommitLabel(SOURCE_MOVES), 'Swap + move 1 class', 'both relocating strategies label identically');

	// State 3 — the unnameable move. The button is disabled (C6) and claims nothing.
	assert.equal(UNNAMEABLE_MOVES, null, 'precondition: an auto-fix with no target cannot be named');
	assert.equal(getRelocatedClassCount(UNNAMEABLE_MOVES), 0, 'an unnameable move relocates nothing that can be claimed');
	assert.equal(getSwapCommitLabel(UNNAMEABLE_MOVES), 'Swap sessions', 'an unnameable move makes no "move" claim');
	assert.ok(!/move/i.test(getSwapCommitLabel(UNNAMEABLE_MOVES)), 'the unnameable label never claims a move');
	assert.equal(getSwapCommitLabel(null), 'Swap sessions', 'a null move makes no "move" claim');

	// The count phrase is a function of the count, so it can never understate a
	// move. `SwapMove.relocated` is `'A' | 'B' | null`, so today's payload can
	// only reach 0 or 1; the plural form is asserted directly on the shipped
	// helper rather than through an invented payload.
	assert.equal(formatRelocatedClassLabel(1), '+ move 1 class', 'one relocates as the singular');
	assert.equal(formatRelocatedClassLabel(3), '+ move 3 classes', 'more than one relocates as the plural, per the requested wording');
	// The zero case is routed around the phrase, so the ungrammatical
	// "+ move 0 classes" is unreachable from the shipped entry point.
	assert.ok(!getSwapCommitLabel(DIRECT_MOVES).includes(formatRelocatedClassLabel(0)), 'the zero-count phrase never reaches a rendered label');
	assert.ok(!/move/i.test(getSwapCommitLabel(DIRECT_MOVES)), 'a direct exchange label mentions no move at all');
});

test('P2 the auto-move row carries a real amber icon in both relocating strategies', () => {
	for (const props of [
		{ strategy: 'AUTO_FIX_MOVE_BLOCKING', autoFixBlockingTarget: IN_SHIFT },
		{ strategy: 'AUTO_FIX_MOVE_SOURCE', autoFixSourceTarget: IN_SHIFT },
	] as const) {
		const label = props.strategy;
		const view = render({ ...props });
		const row = view.host.querySelector('[data-testid="generated-swap-autofix-disclosure"]');
		assert.ok(row, `${label} renders the auto-move row`);
		const icon = row!.querySelector('[data-testid="generated-swap-autofix-icon"]');
		assert.ok(icon, `${label} marks the auto-move row with an icon (pre-fix the row is plain text with no icon element)`);
		// A real rendered icon element, not a placeholder glyph or a comment.
		assert.equal(icon!.tagName.toLowerCase(), 'svg', `${label} uses a real SVG icon element`);
		assert.match(icon!.getAttribute('class') ?? '', /text-amber-\d+/, `${label} the icon is amber`);
		// The icon is decorative only, and the row text still carries the meaning,
		// so the marker never relies on colour alone (AGENTS.md §8; the repo's own
		// "warnings never rely on color alone" rule in conflictGuidance).
		assert.equal(icon!.getAttribute('aria-hidden'), 'true', `${label} the icon is decorative and adds no accessible name`);
		assert.match(row!.textContent ?? '', /Committing also relocates Class [AB]/, `${label} the row text still names the relocation in words`);
	}
});

test('P3 no icon when nothing relocates, and none in the unnameable state', () => {
	const direct = render({ strategy: 'DIRECT_SWAP' });
	assert.equal(direct.host.querySelector('[data-testid="generated-swap-autofix-disclosure"]'), null, 'a direct exchange has no auto-move row to mark');
	assert.equal(direct.host.querySelector('[data-testid="generated-swap-autofix-icon"]'), null, 'a direct exchange shows no move icon');
	assert.equal(direct.host.querySelector('svg'), null, 'a direct exchange marks nothing as a relocation');

	for (const strategy of ['AUTO_FIX_MOVE_BLOCKING', 'AUTO_FIX_MOVE_SOURCE'] as const) {
		const unknown = render({ strategy });
		assert.equal(unknown.host.querySelector('[data-testid="generated-swap-autofix-icon"]'), null, `${strategy} with no target shows no move icon`);
		assert.equal(unknown.host.querySelector('svg'), null, `${strategy} with no target marks nothing as a relocation`);
		assert.equal(
			unknown.testId('generated-swap-move-unknown'),
			"This option's exact move is not known yet. Do not save until it is shown here.",
			`${strategy} with no target still refuses to describe a move`,
		);
	}
});

test('P4 the review dialog renders the move-aware label instead of a hard-coded one', () => {
	assert.match(
		dialogSource,
		/\{getSwapCommitLabel\(committedSwapMove\)\}/,
		'the commit button label is derived from the same committed move the panel renders',
	);
	assert.ok(
		!HARDCODED_LABEL_RULE.test(dialogSource),
		'the commit button no longer hard-codes "Swap sessions" as its label',
	);
	assert.match(
		dialogSource,
		/import GeneratedSwapMoveDisclosure, \{[^}]*getSwapCommitLabel[^}]*\} from '\.\/GeneratedSwapMoveDisclosure'/,
		'the dialog imports the label helper beside the disclosure it already renders',
	);
	// C6's gate is untouched by the presentation change: still disabled exactly
	// when the panel cannot name the move, so a "move" label is never actionable
	// on a move the panel did not describe.
	assert.match(
		dialogSource,
		/disabled=\{regularSwapSaving \|\| !regularSwapStrategy \|\| committedSwapMove === null\}/,
		'the commit button is still disabled exactly when the panel cannot name the move',
	);
});

test('P5 MUTANT: the pre-fix constant label and button body both fail P1 and P4', () => {
	const PRE_FIX_LABEL = 'Swap sessions';
	assert.equal(PRE_FIX_LABEL, 'Swap sessions', 'precondition: the pre-fix button label was a constant');
	assert.notEqual(PRE_FIX_LABEL, getSwapCommitLabel(BLOCKING_MOVES), 'so P1 discriminates: the pre-fix label hid a committed relocation');
	assert.equal(PRE_FIX_LABEL, getSwapCommitLabel(DIRECT_MOVES), 'and P1 deliberately holds for a direct exchange, where the pre-fix label was correct');
	// The pre-fix constant was wrong in exactly ONE state — the relocating one,
	// which is the state Lane C reported. It coincided with the required label in
	// the other two, so the defect was narrow and the fix is bounded to the
	// relocating case. This is also why the label must be derived, not deleted.
	assert.equal(PRE_FIX_LABEL, getSwapCommitLabel(UNNAMEABLE_MOVES), 'the unnameable state keeps the plain label, exactly as the pre-fix constant did');
	assert.ok(HARDCODED_LABEL_RULE.test(PRE_FIX_COMMIT_BUTTON), 'precondition: the rule P4 uses rejects the verbatim pre-fix button body');
	assert.ok(!HARDCODED_LABEL_RULE.test(dialogSource), 'so P4 discriminates: the pre-fix body is no longer the shipped body');
});
