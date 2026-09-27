/**
 * A2-TIMETABLE-CUSTODY-R2 (D1) — the history row the ledger already undid must
 * stop offering a "Revert this edit" that can only be refused.
 *
 * Lane C finding #64 on live draft run 321 (`docs/reviews/a2-browser-acceptance-c5a9e832/`
 * `revert-row-and-warning-state.md`, recorded 2026-09-27 05:53–05:56 +08): a swap was
 * committed and then reverted, and BOTH rows stayed on screen —
 *
 *     Undone change        5:55:23 AM   Undid: Swapped two sessions · 9/27/2026, 5:54:10 AM   This undo cannot be undone.   (no control)
 *     Swapped two sessions 5:54:10 AM   Changed by a signed-in account…                           Revert this edit             <- dead
 *
 * The swap row is DEAD, and the reason is the server's own contract, already traced:
 * `revertLastEdit` selects its target with `editType: { not: 'REVERT' }`
 * (`manual-edit.service.ts:1675`), `assertUndoHead` requires the requested operation to
 * BE the head (`timetable-undo-contract.ts:22`), and the `headEdit` query at `:1676`
 * carries NO `editType` filter — so after a revert the head IS the undo row and the
 * swap's id can never match again. `priorRevert` (`:1677-1679`) is a second,
 * independent trigger. Every press is a 409 `UNDO_CONFLICT` that writes nothing.
 *
 * The R1 fix already removed this control from a `REVERT` row, but not from the row the
 * REVERT row NAMES — so the pair rendered one honest row and one lying one. This file
 * closes that half, and reuses R1's own pattern: a control whose absence is STATED.
 *
 * NO SERVER CHANGE IS NEEDED, and that is a traced fact, not an assumption:
 *   - `listManualEdits` returns `validationSummary` VERBATIM (`manual-edit.service.ts:1941-1950`)
 *     from a `findMany` with NO `take`/limit, so the list is complete;
 *   - the route passes it through untouched (`manual-edit.router.ts:206-209`) and
 *     `fetchEditHistory` stores `data.edits` unfiltered (`useTimetableMutations.ts:963-973`);
 *   - EVERY row the server writes as an undo records the id it undid — the real path at
 *     `manual-edit.service.ts:1866-1869` and the performance-fixture path at `:1711`.
 * So "this row has been undone" is decidable from the very list the dialog renders.
 *
 * Every content assertion reads `document.body.textContent` after a real mount through
 * the real Radix portal, per this suite family's recorded failure mode (a control that
 * reads source strings cannot see a token a fixture contradicts).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { ManualEditRecord } from '../../../types';

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
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameAnimationFrameCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;

type FrameAnimationFrameCallback = (time: number) => void;

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const { Dialog } = await import('../../../ui/dialog');
const { TimetableAssignmentDialogs } = await import('../modals/TimetableAssignmentDialogs');
const {
	ALREADY_UNDONE_EDIT_MESSAGE,
	UNDO_CANNOT_BE_REDONE,
	isEditUndoneInHistory,
	readRevertedEditId,
} = await import('../timetableUndoRedoState');

let root: Root | null = null;
const revertCalls: Array<{ operationId: number; expectedVersion: number }> = [];

async function mountDialog(
	editHistory: unknown[],
	options: { revertLoading?: boolean; currentRunVersion?: number | null } = {},
) {
	if (root) await act(async () => { root?.unmount(); });
	revertCalls.length = 0;
	const container = document.getElementById('root')!;
	root = createRoot(container);
	await act(async () => {
		root!.render(createElement(
			Dialog,
			{ open: true },
			createElement(TimetableAssignmentDialogs, {
				context: {
					showEditHistory: true,
					setShowEditHistory: () => {},
					editHistory,
					revertEditById: async (operationId: number, expectedVersion: number) => {
						revertCalls.push({ operationId, expectedVersion });
						return true;
					},
					revertLoading: options.revertLoading ?? false,
					currentRunVersion: options.currentRunVersion === undefined ? 44 : options.currentRunVersion,
				} as never,
			}),
		));
	});
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((settle) => setTimeout(settle, 0)); });
	}
	return document.body.textContent ?? '';
}

after(async () => { await act(async () => { root?.unmount(); }); });

/** Each row's own rendered text, so an assertion can name WHICH row it read. */
function rowText(index: number): string {
	const rows = document.querySelectorAll('[data-testid="timetable-edit-history-row"]');
	const row = rows[index] as HTMLElement | undefined;
	return row?.textContent ?? '';
}

function rowCount(): number {
	return document.querySelectorAll('[data-testid="timetable-edit-history-row"]').length;
}

function revertButtonsIn(index: number): HTMLElement[] {
	const rows = document.querySelectorAll('[data-testid="timetable-edit-history-row"]');
	return Array.from(
		(rows[index] as HTMLElement | undefined)?.querySelectorAll('[data-testid="timetable-edit-history-revert"]') ?? [],
	) as HTMLElement[];
}

/**
 * The live run 321 shape, read from the committed acceptance record rather than
 * invented. The server writes NO `hardCount`/`softCount` on an undo row
 * (`manual-edit.service.ts:1866-1869`), and the swap row's own stored counts are the
 * commit-time snapshot R1 removed from the surface.
 */
const UNDONE_SWAP: ManualEditRecord = {
	id: 46,
	runId: 321,
	actorId: 46,
	editType: 'SWAP_ENTRIES',
	beforePayload: null,
	afterPayload: null,
	validationSummary: { hardCount: 68, softCount: 68 },
	// renders as 9/27/2026, 5:54:10 AM in the acceptance run's zone
	createdAt: '2026-09-26T21:54:10.000Z',
} as unknown as ManualEditRecord;

const UNDO_ROW: ManualEditRecord = {
	id: 47,
	runId: 321,
	actorId: 46,
	editType: 'REVERT',
	beforePayload: null,
	afterPayload: null,
	validationSummary: { revertedEditId: 46, revertedEditType: 'SWAP_ENTRIES' },
	// renders as 9/27/2026, 5:55:23 AM in the acceptance run's zone
	createdAt: '2026-09-26T21:55:23.000Z',
} as unknown as ManualEditRecord;

/** A second swap that no undo names — the row whose Revert affordance must still work. */
const LIVE_SWAP: ManualEditRecord = {
	...UNDONE_SWAP,
	id: 48,
	validationSummary: { hardCount: 12, softCount: 12 },
	createdAt: '2026-09-26T21:56:40.000Z',
} as unknown as ManualEditRecord;

/** Newest first, exactly as `listManualEdits` orders them (`createdAt: 'desc'`). */
const LIVE_RUN_321 = [LIVE_SWAP, UNDO_ROW, UNDONE_SWAP];

/* ── the three row kinds, in one mount ──────────────────────────────────────── */

test('R2 D1: the three row kinds — a live edit keeps its control, an undone edit and an undo do not', async () => {
	await mountDialog(LIVE_RUN_321);
	assert.equal(rowCount(), 3, 'all three rows render');

	// 1. A swap no undo names: the affordance is still there AND still working.
	assert.equal(revertButtonsIn(0).length, 1, 'the live swap row keeps "Revert this edit"');
	assert.equal(
		(revertButtonsIn(0)[0] as HTMLButtonElement).disabled,
		false,
		'and it is enabled — the removal is scoped to rows the ledger records as undone',
	);

	// 2. The undo row: R1's accepted contract, restated so a change here cannot pass
	//    by deleting the R1 evidence.
	assert.equal(revertButtonsIn(1).length, 0, 'an undo row offers no "Revert this edit"');
	assert.match(rowText(1), new RegExp(UNDO_CANNOT_BE_REDONE.replace('.', '\\.')), 'and still says why');

	// 3. The swap the undo names: THIS is the defect. The control must be gone and the
	//    absence stated.
	assert.equal(
		revertButtonsIn(2).length,
		0,
		'a row the ledger already undid must not offer "Revert this edit" — the server refuses it with UNDO_CONFLICT on every press (headEdit has no editType filter, so the head IS the undo row)',
	);
	assert.match(
		rowText(2),
		/already been undone/,
		'and the absence is stated, because a control that silently disappears on one row type reads as a broken dialog',
	);
	assert.doesNotMatch(rowText(2), /Revert this edit/, 'no "Revert this edit" text survives anywhere on the row');
});

/* ── no-regression: the working affordance still WORKS, proven by a real click ── */

test('R2 D1 no-regression: a live swap row still dispatches its real revert', async () => {
	await mountDialog(LIVE_RUN_321);
	const button = revertButtonsIn(0)[0] as HTMLButtonElement;
	assert.equal(button.disabled, false, 'the live row’s control is enabled');

	await act(async () => { button.click(); });
	for (let index = 0; index < 3; index += 1) {
		await act(async () => { await new Promise((settle) => setTimeout(settle, 0)); });
	}

	assert.deepEqual(
		revertCalls,
		[{ operationId: LIVE_SWAP.id, expectedVersion: 44 }],
		'pressing it still dispatches the operation-bound CAS for THAT row and the current run version',
	);
});

test('R2 D1: an undone row leaves no dangling control — no handler, no orphan hook, no empty label', async () => {
	await mountDialog(LIVE_RUN_321);
	// Every control in the dialog is accounted for, so removing one cannot leave a
	// clickable node with no handler, and no testid/aria reference pointing at nothing.
	const controls = Array.from(
		document.querySelectorAll('[data-testid="timetable-edit-history-revert"]'),
	) as HTMLButtonElement[];
	assert.equal(controls.length, 1, 'exactly one revert control exists, and it is the live row’s');
	for (const control of controls) {
		assert.ok(control.textContent?.includes('Revert this edit'), 'the surviving control is the labelled one');
		assert.doesNotMatch(control.outerHTML, /aria-label|aria-describedby/, 'no accessibility reference dangles');
	}
	const undone = document.querySelectorAll('[data-testid="timetable-edit-history-row"]')[2] as HTMLElement;
	assert.equal(
		undone.querySelectorAll('button, a[href], input, [role="button"]').length,
		0,
		'the undone row offers no interactive element at all, so nothing can be pressed and fail',
	);
});

/* ── the id comparison must be TYPE-SAFE and must never hide a working control ── */

test('R2 D1: only a real numeric id can mark a row undone', () => {
	assert.equal(readRevertedEditId({ revertedEditId: 46 }), 46, 'a Prisma Int arrives as a JSON number');
	// Every shape below is a value this client refuses to compare as an identity. A
	// loose `==` would let the string through and mark the WRONG row undone.
	for (const malformed of ['46', ' 46', 46.5, Number.NaN, Number.POSITIVE_INFINITY, true, null, undefined, {}, [], [46]]) {
		assert.equal(
			readRevertedEditId({ revertedEditId: malformed }),
			null,
			`revertedEditId ${JSON.stringify(malformed) ?? 'undefined'} is not an identity and must read as absent`,
		);
	}
	// A summary that is not an object at all must not throw and must not read as a target.
	for (const summary of [null, undefined, 'revertedEditId=46', 46, true]) {
		assert.equal(readRevertedEditId(summary), null, `a ${typeof summary} summary names nothing`);
	}
	assert.equal(readRevertedEditId({ revertedEditType: 'SWAP_ENTRIES' }), null, 'the type alone names no row');
});

test('R2 D1: the derivation matches the server’s own refusal, and is order-independent', () => {
	assert.equal(
		isEditUndoneInHistory(46, LIVE_RUN_321),
		true,
		'an undo row naming this id is exactly the server’s `priorRevert` (`manual-edit.service.ts:1677-1679`), so the client hides the control precisely when the server refuses',
	);
	assert.equal(
		isEditUndoneInHistory(48, LIVE_RUN_321),
		false,
		'a swap no undo names is still revertable, and the predicate is order-independent — the ledger fact, not the row position',
	);
	assert.equal(isEditUndoneInHistory(46, [UNDO_ROW, UNDONE_SWAP]), true, 'reordering the list changes nothing');
	assert.equal(isEditUndoneInHistory(46, [UNDONE_SWAP, UNDO_ROW]), true, 'and it does not depend on the undo sorting first');
	assert.equal(isEditUndoneInHistory(46, [UNDONE_SWAP]), false, 'an undo row outside the fetched list proves nothing');
	assert.equal(
		isEditUndoneInHistory(46, [{ ...UNDO_ROW, editType: 'SWAP_ENTRIES' }]),
		false,
		'only an undo row counts — a `revertedEditId` left on an ordinary row is not a claim that it was undone',
	);
	assert.equal(isEditUndoneInHistory(46, []), false, 'an empty list claims nothing');
});

test('R2 D1 negative control: a malformed recorded id never hides a working control', async () => {
	// The fail-open that would matter: inferring "undone" from a string, a float, or a
	// null would REMOVE a control an operator can still use — strictly worse than the
	// defect being fixed, because the action is real and reachable.
	const stringId = { ...UNDO_ROW, id: 60, validationSummary: { revertedEditId: '48', revertedEditType: 'SWAP_ENTRIES' } } as unknown as ManualEditRecord;
	await mountDialog([LIVE_SWAP, stringId, UNDONE_SWAP]);
	assert.equal(
		revertButtonsIn(0).length,
		1,
		'a string "48" must not be read as the id 48 — the live row keeps its working control',
	);
	assert.equal((revertButtonsIn(0)[0] as HTMLButtonElement).disabled, false, 'and it is still enabled');

	for (const malformed of [null, undefined, 48.5, 'forty-eight', {}]) {
		const odd = { ...UNDO_ROW, id: 61, validationSummary: { revertedEditId: malformed } } as unknown as ManualEditRecord;
		await mountDialog([LIVE_SWAP, odd, UNDONE_SWAP]);
		assert.equal(
			revertButtonsIn(0).length,
			1,
			`revertedEditId ${JSON.stringify(malformed) ?? 'undefined'} proves nothing, so the control stays`,
		);
	}

	// A summary that is not an object must not throw the dialog away either.
	await mountDialog([LIVE_SWAP, { ...UNDO_ROW, id: 62, validationSummary: 'revertedEditId=48' } as unknown as ManualEditRecord, UNDONE_SWAP]);
	assert.equal(rowCount(), 3, 'a non-object summary still renders every row');
	assert.equal(revertButtonsIn(0).length, 1, 'and still leaves the live row’s control alone');
});

/* ── one wording owner, so the two surfaces cannot drift ─────────────────────── */

test('R2 D1: the stated reason is the one owned by the shared wording module', async () => {
	await mountDialog(LIVE_RUN_321);
	assert.match(
		rowText(2),
		new RegExp(ALREADY_UNDONE_EDIT_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
		'the row states the shared message verbatim, so the history row and the undo/redo surfaces cannot drift',
	);
	assert.notEqual(
		ALREADY_UNDONE_EDIT_MESSAGE,
		UNDO_CANNOT_BE_REDONE,
		'the undone-edit row and the undo row are DIFFERENT facts and must not share one sentence',
	);
	const rendered = document.body.textContent ?? '';
	assert.doesNotMatch(rendered, /warnings: *\d|serious problems/i, 'no count line is reintroduced by the new statement');
	assert.doesNotMatch(rendered, /\b[A-Z][A-Z0-9_]{3,}\b/, 'no engine token reaches the operator in the new statement');
});
