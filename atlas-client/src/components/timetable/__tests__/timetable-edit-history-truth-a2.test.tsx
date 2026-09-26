/**
 * A2-TIMETABLE-CUSTODY-R1 — the manual edit history must not claim more than
 * the ledger records.
 *
 * Three defects from committed browser QA on the live run
 * (`docs/reviews/timetable-manual-controls-20260926/findings.md` #39/#40 and
 * `docs/handoffs/lane-c-to-a2.md` entry "2026-09-27 00:25"):
 *
 *   1. A `REVERT` row read "Undid an earlier change" and offered its own
 *      "Revert this edit", so an undo could be "undone" under the same name and
 *      the row never said WHICH edit it undid.
 *   2. The same row read `warnings: 0` while the run header read 69 — the row
 *      renders `validationSummary`, a snapshot stored at commit time, and nothing
 *      said so. QA: "Snapshot counts are fiction … A scheduler reading history
 *      would believe the revert cleared every warning."
 *   3. `REVERT`'s plain-language label was the ambiguous string behind (1).
 *
 * The ledger ALREADY identifies the undone edit and the client already holds it:
 * `revertLastEdit` writes `validationSummary.revertedEditId` and
 * `revertedEditType` (`manual-edit.service.ts:1866`), and `listManualEdits`
 * returns `validationSummary` verbatim with no limit (`:1941-1950`), so the
 * target row is always in the list the dialog renders. Defect 1 is therefore
 * decidable client-side and needs no server change.
 *
 * The same ledger also settles WHY the affordance is absent rather than renamed
 * "Redo": `revertLastEdit` selects its target with `editType: { not: 'REVERT' }`
 * (`:1675`), so a `REVERT` row is `null` there, and `assertUndoHead` then
 * compares a real `requestingActorId` against `operationActorId: null` and throws
 * `UNDO_CONFLICT` (`timetable-undo-contract.ts:24`). The button is a guaranteed
 * 409. A real "Redo" would be a NEW server operation restoring the reverted
 * edit's `afterPayload` — new server state, out of this lane's scope — so the
 * honest subset is: name the undone edit, and remove the affordance.
 *
 * Every content assertion reads `document.body.textContent` after a real mount
 * through the real Radix portal, per this suite's recorded failure mode (a
 * control that reads source strings cannot see a token a fixture contradicts).
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
const { manualEditActionLabel } = await import('../../../lib/timetable-plain-language');

let root: Root | null = null;

async function mountDialog(editHistory: unknown[]) {
	if (root) await act(async () => { root?.unmount(); });
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
					revertEditById: async () => true,
					revertLoading: false,
					currentRunVersion: 9,
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

function revertButtonsIn(index: number): number {
	const rows = document.querySelectorAll('[data-testid="timetable-edit-history-row"]');
	return (rows[index] as HTMLElement | undefined)
		?.querySelectorAll('[data-testid="timetable-edit-history-revert"]').length ?? 0;
}

/**
 * The live run's shape, read from the committed QA evidence rather than invented:
 * two swaps (both snapshotting the same whole-year total) and a revert of the
 * newest one. The server writes NO `hardCount`/`softCount` on a `REVERT` row
 * (`manual-edit.service.ts:1866`), which is precisely how the row came to render
 * a fabricated `0`.
 */
const SWAP_ROW: ManualEditRecord = {
	id: 46,
	runId: 320,
	actorId: 46,
	editType: 'SWAP_ENTRIES',
	beforePayload: null,
	afterPayload: null,
	validationSummary: { hardCount: 241, softCount: 241, revertedEditId: undefined },
	createdAt: '2026-09-26T15:34:08.000Z',
} as unknown as ManualEditRecord;

const REVERT_ROW: ManualEditRecord = {
	id: 47,
	runId: 320,
	actorId: 46,
	editType: 'REVERT',
	beforePayload: null,
	afterPayload: null,
	validationSummary: { revertedEditId: 46, revertedEditType: 'SWAP_ENTRIES' },
	createdAt: '2026-09-26T16:22:07.000Z',
} as unknown as ManualEditRecord;

/* ── Defect 1 ── the REVERT row must name the edit it undid ─────────────────── */

test('R1 D1: a REVERT row names the edit it undid', async () => {
	await mountDialog([REVERT_ROW, SWAP_ROW]);
	assert.equal(rowCount(), 2, 'both rows rendered');
	assert.match(
		rowText(0),
		/Undid:/,
		'the REVERT row names what it undid instead of reading "Undid an earlier change"',
	);
	assert.match(
		rowText(0),
		/Swapped two sessions/,
		'it names the undone edit by what that edit DID, read through the one plain-language map',
	);
	// The target row is itself on screen, so the name must be resolvable to it
	// unambiguously. The target's own timestamp is the disambiguator when a run
	// holds two edits of the same kind.
	assert.ok(
		rowText(0).includes(new Date(SWAP_ROW.createdAt).toLocaleString()),
		'the REVERT row carries the undone edit\'s own timestamp, which disambiguates two edits of the same kind',
	);
});

test('R1 D1: a REVERT row does not offer a "Revert this edit" that can only 409', async () => {
	await mountDialog([REVERT_ROW, SWAP_ROW]);
	assert.equal(
		revertButtonsIn(0),
		0,
		'the REVERT row must not offer "Revert this edit" (the server selects its target with editType { not: \'REVERT\' }, so the call can only UNDO_CONFLICT)',
	);
	assert.equal(
		revertButtonsIn(1),
		1,
		'an ordinary row keeps its affordance — the removal is scoped to the REVERT row, not to the dialog',
	);
	assert.doesNotMatch(rowText(0), /Revert this edit/, 'no misleading "Revert this edit" text on a REVERT row');
	// The absence must be explained, or a button that silently vanishes on one row
	// type reads as a broken dialog.
	assert.match(
		rowText(0),
		/cannot be undone/,
		'the REVERT row says why there is nothing to press, rather than going silent',
	);
});

test('R1 D1 negative control: an unidentifiable REVERT row claims no edit', async () => {
	// A REVERT row whose summary names no target at all (no `revertedEditId`, no
	// `revertedEditType`) — an older row, or a summary that did not record it.
	// This is the lane's standing bar: never claim to name an edit it cannot
	// identify. The honest rendering says the record does not identify one.
	const unidentifiable = { ...REVERT_ROW, id: 48, validationSummary: {} } as unknown as ManualEditRecord;
	await mountDialog([unidentifiable, SWAP_ROW]);
	assert.match(
		rowText(0),
		/does not identify/,
		'a REVERT row with no recorded target says the record does not identify the edit',
	);
	assert.doesNotMatch(
		rowText(0),
		/Swapped two sessions/,
		'it must NOT borrow the neighbouring row\'s action — that would be a false claim',
	);
	assert.doesNotMatch(
		rowText(0),
		/Undid: [A-Z]/,
		'it must not name any specific edit it cannot resolve',
	);
	assert.equal(revertButtonsIn(0), 0, 'and it still offers no affordance');
});

test('R1 D1 negative control: a target id outside the list falls back to the recorded type, naming no row', async () => {
	// `revertedEditId` 999 is not among the rendered rows. The ledger still
	// recorded WHAT was undone, so that is the truthful claim; the row must not
	// invent a timestamp for an edit it cannot see.
	const orphan = { ...REVERT_ROW, validationSummary: { revertedEditId: 999, revertedEditType: 'CHANGE_ROOM' } } as unknown as ManualEditRecord;
	await mountDialog([orphan, SWAP_ROW]);
	assert.match(rowText(0), /Undid: Changed the room/, 'it names the kind the ledger recorded');
	assert.doesNotMatch(
		rowText(0),
		/Undid: Changed the room · /,
		'it must not attach a timestamp to a row it cannot resolve',
	);
	assert.doesNotMatch(rowText(0), /Swapped two sessions/, 'and it must not name the neighbouring row instead');
});

test('R1 D1/D3: the undone edit is named in plain words, never as an engine token', async () => {
	await mountDialog([REVERT_ROW, SWAP_ROW]);
	const rendered = document.body.textContent ?? '';
	assert.doesNotMatch(
		rendered,
		/SWAP_ENTRIES|REVERT/,
		'neither the raw `revertedEditType` token nor the raw editType may reach the operator',
	);
	assert.doesNotMatch(rendered, /\b[A-Z][A-Z0-9_]{3,}\b/, 'no SHOUTED engine token may render');
	assert.equal(
		manualEditActionLabel('REVERT'),
		'Undone change',
		'the REVERT category label stops claiming a vague referent; the row names the specific edit separately',
	);
	// The map is the single owner of the wording, so the badge and the naming line
	// cannot drift apart.
	assert.equal(
		rowText(0).includes(manualEditActionLabel('REVERT')),
		true,
		'the badge uses the one plain-language label for the edit kind',
	);
});

/* ── Defect 2 ── the row must not render a stale snapshot count ──────────────── */

test('R1 D2: no history row renders the stored warning snapshot', async () => {
	await mountDialog([REVERT_ROW, SWAP_ROW]);
	const rendered = document.body.textContent ?? '';
	// The two counts QA read: the SWAP row's stored `softCount`, and the
	// fabricated `0` the REVERT row rendered because the server sends it no
	// `hardCount`/`softCount` at all and the row defaulted them with `?? 0`.
	assert.doesNotMatch(
		rendered,
		/warnings: 241/,
		'the swap row must not render its stored snapshot against a header that reads 69',
	);
	assert.doesNotMatch(
		rendered,
		/warnings: 0/,
		'a REVERT row must not render a fabricated "warnings: 0" — the ledger records no count for it',
	);
	assert.doesNotMatch(
		rendered,
		/All serious problems/,
		'nor the stored serious-problem total, which is a commit-time snapshot of a different measurement',
	);
	// "No false claim" runs both ways: a stale number is removed, not replaced by
	// the header's current number, which would imply each edit caused it.
	assert.doesNotMatch(rendered, /warnings: 69/, 'the row does not adopt the header number either');
});

test('R1 D2: removing the snapshot leaves no dangling reference', async () => {
	await mountDialog([REVERT_ROW, SWAP_ROW]);
	const rendered = document.body.textContent ?? '';
	// The dialog still counts what it can count truthfully — the rows themselves.
	assert.match(rendered, /2 edits recorded/, 'the row count, which is a true fact about the list, survives');
	assert.doesNotMatch(
		rendered,
		/serious problems: *\d|warnings: *\d/,
		'no residual count line survives anywhere in the dialog',
	);
});

/* ── load-bearing controls: each assertion must fail if its fix is undone ────── */

test('R1 D1 mutant: the pre-fix REVERT row fails the naming and affordance controls', () => {
	// The exact pre-fix rendered state: the ambiguous badge, no naming line, and
	// the row's own "Revert this edit".
	const preFixRowText = 'Undid an earlier change 9/27/2026, 12:22:07 AM Revert this edit';
	assert.doesNotMatch(preFixRowText, /Undid:/, 'the pre-fix row really names no edit');
	assert.throws(() => assert.match(preFixRowText, /Undid:/), /input did not match/);
	assert.doesNotMatch(preFixRowText, /does not identify/, 'and carries no honest degradation either');
	assert.match(preFixRowText, /Revert this edit/, 'the pre-fix row really offered the doomed affordance');
});

test('R1 D2 mutant: the pre-fix snapshot line fails the D2 control', () => {
	// The literal before value QA read off the live run: a stale total, and a
	// fabricated zero on the undo row.
	const preFixSwap = 'All serious problems: 241, warnings: 241';
	const preFixRevert = 'All serious problems: 0, warnings: 0';
	assert.match(preFixSwap, /warnings: 241/, 'the pre-fix swap row really rendered its stored snapshot');
	assert.throws(() => assert.doesNotMatch(preFixSwap, /warnings: 241/), /expected to not match/);
	assert.match(preFixRevert, /warnings: 0/, 'the pre-fix REVERT row really fabricated a zero');
	assert.throws(() => assert.doesNotMatch(preFixRevert, /warnings: 0/), /expected to not match/);
});
