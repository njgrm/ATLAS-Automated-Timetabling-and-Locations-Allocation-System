/**
 * A2 mc, S5 — a receipt after every committed change. DERIVED + RENDERED
 * evidence, over ONE module.
 *
 * THE DEFECT (packet item 5): after a committed move the inline status read
 *
 *   Moved to MONDAY 07:00–08:00. Undo below.
 *
 * It named neither WHICH class, nor where it came FROM, nor whether the change
 * made anything worse. The soft branch read `Move applied with 3 soft
 * warning(s).` — a count, not a sentence. The Schedule history dialog used
 * different words again and named no class at all, so one committed change read
 * as three different things on one screen.
 *
 * Rows:
 *   S5a the packet's exact target shape, with the day short and no seconds;
 *   S5b the problem clause is ALWAYS present and states the DELTA honestly;
 *   S5c the derived-from-the-COMMITTED-record contract, and the wiring in all
 *        four call sites the packet names (drag move, keyboard move, place,
 *        swap) plus the Schedule history row;
 *   S5d one sentence per change: the swap toast that used to double-speak is
 *        gone, and the MOVE/PLACE suppression is preserved;
 *   S5e the history row is ADDITIVE beside its badge, keeps the owed
 *        actor-name sentence, and prints no problem clause (A2-C6 D2).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
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
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	// Radix's focus scope probes the input element types when a dialog opens.
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const CLIENT_ROOT = resolve(process.cwd());
const { createRoot } = await import('react-dom/client');
const {
	buildEditReceipt,
	buildEditReceiptShort,
	receiptActionWord,
	receiptClassLabel,
	receiptProblemClause,
	receiptProblemSentence,
	receiptSlotLabel,
	shortClockTime,
} = await import('@/lib/timetable-edit-receipt');
const { historyEditReceiptSentence, readEditReceiptEntryId } = await import('@/lib/timetable-edit-receipt-record');
const { Dialog } = await import('@/ui/dialog');
const { TimetableAssignmentDialogs } = await import('@/components/timetable/modals/TimetableAssignmentDialogs');

async function mount(element: unknown): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => { root.render(element as never); });
	return host;
}

test('S5a the receipt has the packet target shape: class, from slot, to slot, plain day, no seconds', () => {
	const receipt = buildEditReceipt({
		editType: 'MOVE_ENTRY',
		classLabel: 'TLE for 7-Rizal',
		from: { day: 'MONDAY', startTime: '06:00' },
		to: { day: 'TUESDAY', startTime: '07:30' },
		problems: { now: 0, before: 0 },
	});
	assert.equal(receipt.short, 'Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30.');
	assert.equal(receipt.sentence, 'Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30. No new problems.');
	assert.equal(receipt.tone, 'success');

	// The three rules that make the shape usable.
	assert.equal(receiptSlotLabel({ day: 'MONDAY', startTime: '06:00' }), 'Mon 6:00', 'short day, leading zero dropped');
	assert.doesNotMatch(receipt.sentence, /MONDAY|TUESDAY/, 'the raw day enum never reaches the operator');
	assert.doesNotMatch(receipt.sentence, /\d{2}:\d{2}/, 'no zero-padded clock time');
	assert.doesNotMatch(receipt.sentence, /…|\.\.\./, 'no ellipsis (§8)');
	assert.equal(shortClockTime('13:30'), '1:30 PM', 'an afternoon hour is never rendered as a morning hour');
	assert.equal(receiptClassLabel({ subjectLabel: 'TLE', sectionLabel: '7-Rizal' }), 'TLE for 7-Rizal');
	assert.equal(receiptClassLabel({ subjectLabel: 'TLE', sectionLabel: null }), 'TLE', 'one label alone is used alone');
	assert.equal(receiptClassLabel({ subjectLabel: null, sectionLabel: null }), '', 'and neither resolves to an empty name, never a guess');
	assert.equal(receiptActionWord('PLACE_UNASSIGNED'), 'Placed');
	assert.equal(receiptActionWord('SOMETHING_NEW'), 'Changed', 'an unknown edit type still reads as a plain verb');
});

test('S5b the problem clause is always present and states the DELTA honestly', () => {
	assert.equal(receiptProblemClause({ now: 0 }), 'No new problems.');
	assert.equal(
		receiptProblemClause({ now: 1, firstNewSentence: 'Mr Cruz already teaches 8-Luna at that time' }),
		'1 new problem: Mr Cruz already teaches 8-Luna at that time.',
		'the first problem is NAMED, because a bare count is the defect',
	);
	assert.equal(
		receiptProblemClause({ now: 2, before: 3 }),
		'2 problems now; 1 was already there.',
		'a run that was not clean before says the total AND the delta',
	);
	assert.equal(receiptProblemClause({ now: 2 }), '2 new problems.', 'with no measurement it still says something true');
	assert.equal(receiptProblemClause(null), 'No new problems.', 'an absent measurement defaults to the clean reading');

	// A2 mc R2 (B1) — `before < now`, the case the pre-fix gate never covered. QA
	// ran the operator's own drill data through the pre-fix module and got
	// "531 new problems." for a move that added FIVE to a run that already held
	// 525 soft warnings and 6 must-fix problems. `now` is the RUN TOTAL; the count
	// this edit CREATED is `now - before`, and conflating them is the defect.
	assert.equal(
		receiptProblemClause({ now: 531, before: 526 }),
		'5 new problems.',
		'the pre-fix module printed the whole run total as the number of NEW problems',
	);
	assert.equal(
		receiptProblemClause({ now: 531, before: 526, firstNewSentence: 'Mr Cruz already teaches 8-Luna at that time' }),
		'5 new problems: Mr Cruz already teaches 8-Luna at that time.',
		'and the same is true when the first problem IS named',
	);
	assert.equal(
		buildEditReceipt({
			editType: 'MOVE_ENTRY',
			classLabel: 'TLE for 7-Rizal',
			from: { day: 'MONDAY', startTime: '06:00' },
			to: { day: 'TUESDAY', startTime: '07:30' },
			problems: { now: 531, before: 526, firstNewSentence: 'Mr Cruz already teaches 8-Luna at that time' },
		}).sentence,
		'Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30. 5 new problems: Mr Cruz already teaches 8-Luna at that time.',
		'the whole receipt on the operator own drill numbers',
	);
	// A receipt that inflates its own count is worse than no receipt, so the
	// count must never exceed the problems the edit actually created.
	assert.doesNotMatch(receiptProblemClause({ now: 531, before: 526 }), /531/, '531 can never be called new');

	// The tone follows the CLAUSE, not the run total: a move that added five to a
	// dirty run is a warning, and a move onto a clean run is a success.
	assert.equal(buildEditReceipt({ editType: 'MOVE_ENTRY', problems: { now: 531, before: 526 } }).tone, 'warning');
	assert.equal(buildEditReceipt({ editType: 'MOVE_ENTRY', problems: { now: 0, before: 0 } }).tone, 'success');
});

test('S5b2 B2 the receipt names the PROBLEM, not the category', () => {
	// A2 mc R2 (B2): the two move call sites passed `humanTitle`, which for a
	// teacher conflict is the category `Teacher double-booked`. The packet's own
	// example sentence is the DETAIL `buildHumanConflicts` already produces.
	const conflicts = [
		{
			code: 'FACULTY_TIME_CONFLICT',
			severity: 'HARD',
			// The server's own wording for this code (manual-edit.service.ts).
			humanTitle: 'Teacher double-booked',
			humanDetail: 'Mr Cruz is already teaching ESP on Mon 7:00 AM–7:45 AM',
		},
	];
	const sentence = receiptProblemSentence(conflicts);
	assert.ok(sentence, 'a receipt names the problem when the preview carried one');
	assert.match(sentence!, /Mr Cruz is already teaching ESP/, 'it carries the teacher and the class, not the category');
	assert.doesNotMatch(sentence!, /Teacher double-booked/, 'the category string is gone');

	// The scrub is the ONE the preview path uses, so an engine token cannot reach
	// a receipt by a second route.
	assert.equal(
		receiptProblemSentence([{ code: 'X', severity: 'HARD', humanTitle: 't', humanDetail: 'Manual candidate e-1::t1 rejected by shared invariant: SECTION_TIME_CONFLICT.' }]),
		'ATLAS refused this change because it breaks a rule every class must follow: Section double-booked.',
		'the invariant sentence and its raw code are composed away by the same scrubber',
	);
	// HARD outranks SOFT, and nothing at all is `null` rather than an empty clause.
	assert.match(receiptProblemSentence([
		{ code: 'FACULTY_EXCESSIVE_IDLE_GAP', severity: 'SOFT', humanTitle: 't', humanDetail: 'soft detail' },
		{ code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', humanTitle: 't', humanDetail: 'hard detail' },
	])!, /^hard detail$/, 'a blocker outranks a warning');
	assert.equal(receiptProblemSentence([]), null);
	assert.equal(receiptProblemSentence(null), null);
});

test('S5b3 B3 one change, one destination on a history row', async () => {
	// A2 mc R2 (B3): the pre-fix row composed a SWAP's destination from
	// `before.entryB`, while `describeEditAutoMoveNamed` rendered `after.entryA`
	// on the same row — two destinations for one class.
	const autoFixSwap = {
		id: 9100, runId: 318, actorId: 46, editType: 'SWAP_ENTRIES',
		beforePayload: {
			strategy: 'AUTO_FIX_MOVE_SOURCE',
			entryA: { entryId: 'e-a', sectionId: 71, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
			entryB: { entryId: 'e-b', sectionId: 71, day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		},
		afterPayload: {
			strategy: 'AUTO_FIX_MOVE_SOURCE',
			// The auto-fix relocated A to 10:15 — which is NOT B's old slot.
			entryA: { entryId: 'e-a', sectionId: 71, day: 'MONDAY', startTime: '10:15', endTime: '11:00' },
			entryB: { entryId: 'e-b', sectionId: 71, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
		},
		validationSummary: {}, createdAt: '2026-09-30T08:00:00.000Z',
	};
	assert.equal(
		historyEditReceiptSentence(autoFixSwap as never, (entryId) => (entryId === 'e-a' ? 'TLE' : 'SCIENCE')),
		'Swapped TLE from Mon 6:00 to Mon 10:15.',
		'the destination is read from the AFTER payload, so it is the one the auto-move sentence names',
	);
	// And the clause is suppressed on exactly the rows that already render a
	// destination, so the row cannot state two (AGENTS.md §16: additive — the
	// auto-move sentence itself is not touched).
	assert.equal(
		historyEditReceiptSentence(autoFixSwap as never, () => 'TLE', { suppressWhenAutoMoveNamed: 'Also moved TLE to Mon 10:15–11:00 AM.' }),
		null,
		'no second destination beside the auto-move sentence',
	);
	// A CLEAN exchange still gets its receipt: nothing else on the row says where
	// the class went.
	const cleanSwap = {
		...autoFixSwap,
		afterPayload: {
			strategy: 'DIRECT_SWAP',
			entryA: autoFixSwap.beforePayload.entryA,
			entryB: autoFixSwap.beforePayload.entryB,
		},
	};
	assert.ok(historyEditReceiptSentence(cleanSwap as never, () => 'TLE'), 'a clean exchange keeps its receipt');
});

test('S5c EVERY committed move, swap and place derives its status from the ONE module', () => {
	// Labelled WIRING: "which sentence does a hook print" is not a runtime property
	// this harness can reach without mounting the whole workspace, and the
	// derivation itself is exercised by S5a/S5b and by S5e's rendered row.
	const workspace = readFileSync(resolve(CLIENT_ROOT, 'src/hooks/useScheduleReviewWorkspaceState.ts'), 'utf8');
	const mutations = readFileSync(resolve(CLIENT_ROOT, 'src/hooks/useTimetableMutations.ts'), 'utf8');

	for (const [name, source] of [['workspace state', workspace], ['mutations', mutations]] as const) {
		assert.match(source, /buildEditReceipt\(/, `${name} composes receipts through the shared derivation`);
		assert.doesNotMatch(source, /Moved to \$\{proposal\.targetDay/, `${name} no longer prints the old nameless sentence`);
	}
	// The drag move, the keyboard move, the place and the swap: four call sites.
	assert.equal((workspace.match(/buildEditReceipt\(/g) ?? []).length, 3,
		'the two move entry points and the place path all use it');
	assert.equal((mutations.match(/buildEditReceipt\(/g) ?? []).length, 1, 'and so does the swap path');

	// DERIVED FROM THE COMMITTED RECORD, never the optimistic proposal: every call
	// site reads `commitResult.violationDelta`, which the server measured after
	// the write, and not `scopedPreview`'s counts.
	assert.match(workspace, /now: commitResult\.violationDelta\.hardAfter \+ commitResult\.violationDelta\.softAfter/,
		'the move and place receipts read the COMMITTED delta');
	assert.match(mutations, /now: data\.violationDelta\.hardAfter \+ data\.violationDelta\.softAfter/,
		'and so does the swap receipt, from the committed CommitResult');
});

test('S5d one sentence per change — the swap toast that used to double-speak is gone', () => {
	const mutations = readFileSync(resolve(CLIENT_ROOT, 'src/hooks/useTimetableMutations.ts'), 'utf8');
	assert.doesNotMatch(mutations, /toast\.success\('Sessions swapped\.'\)/,
		'the swap toast is REMOVED, not reworded: the receipt beside it says the same thing');
	assert.doesNotMatch(mutations, /Swap applied with blocking-session auto-fix relocation/,
		'and so is the strategy toast; the strategy clause now travels INSIDE the receipt');
	// The MOVE/PLACE suppression is preserved — the receipt covers those paths too.
	assert.match(mutations, /suppressVerboseToasts = proposal\.editType === 'MOVE_ENTRY' \|\| proposal\.editType === 'PLACE_UNASSIGNED'/,
		'the pre-existing suppression for the paths the receipt now covers is kept, so nothing speaks twice');
});

test('S5e RENDERED: the history row carries the receipt, additively, beside its badge', async () => {
	const edit = {
		id: 9001,
		runId: 318,
		actorId: 46,
		editType: 'MOVE_ENTRY',
		// What the server records for a MOVE_ENTRY: the whole entry on both sides.
		beforePayload: { entryId: 'entry-7::t1', sectionId: 71, subjectId: 11, day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
		afterPayload: { entryId: 'entry-7::t1', sectionId: 71, subjectId: 11, day: 'TUESDAY', startTime: '07:30', endTime: '08:15' },
		validationSummary: { hardCount: 241 },
		createdAt: '2026-09-29T09:15:00.000Z',
	};

	assert.equal(readEditReceiptEntryId(edit as never), 'entry-7::t1', 'the recorded entry is the one the receipt names');
	const sentence = historyEditReceiptSentence(edit as never, (entryId) => (entryId === 'entry-7::t1' ? 'TLE for 7-Rizal' : null));
	assert.equal(sentence, 'Moved TLE for 7-Rizal from Mon 6:00 to Tue 7:30.', 'the SAME words the inline status uses');
	assert.equal(sentence, buildEditReceiptShort({
		editType: 'MOVE_ENTRY',
		classLabel: 'TLE for 7-Rizal',
		from: { day: 'MONDAY', startTime: '06:00' },
		to: { day: 'TUESDAY', startTime: '07:30' },
	}), 'the short form is literally the same derivation, so the two cannot drift');

	const host = await mount(createElement(Dialog, { open: true }, createElement(TimetableAssignmentDialogs, {
		context: {
			showEditHistory: true,
			setShowEditHistory: () => {},
			editHistory: [edit],
			revertEditById: async () => {},
			revertLoading: false,
			currentRunVersion: 4,
			editHistoryReadState: 'ready',
			editHistoryEntryClassName: (entryId: string) => (entryId === 'entry-7::t1' ? 'TLE for 7-Rizal' : null),
		},
	} as never)));

	// The Radix `Dialog` renders into a PORTAL, so the row lives on the document,
	// not inside the mount host. Querying `document` is what a browser would show.
	const row = document.querySelector('[data-testid="timetable-edit-history-row"]');
	assert.ok(row, 'the history row renders');
	const text = row.textContent ?? '';
	assert.equal(row.querySelector('[data-testid="timetable-edit-history-receipt"]')?.textContent, sentence,
		'the receipt is on the row, in the shared words');
	// ADDITIVE: the badge, the timestamp and the owed actor sentence all remain.
	assert.match(text, /Moved/, 'the type badge is untouched — the receipt is beside it, never in place of it');
	assert.match(text, /Changed by a signed-in account\. This record does not show which person\./,
		'the owed actor-name sentence is NOT removed by this slice');
	// A2-C6 (D2): no problem clause on a row that holds no measurement.
	assert.doesNotMatch(text, /problems now|new problem|No new problems/,
		'no invented problem clause — the ledger counts were removed for being misleading, and they are not re-added');
});

test('S5f NEGATIVE: a row the ledger says nothing about renders NO receipt at all', () => {
	const opaque = {
		id: 9002,
		runId: 318,
		actorId: 46,
		editType: 'REVERT',
		beforePayload: null,
		afterPayload: null,
		validationSummary: {},
		createdAt: '2026-09-29T09:20:00.000Z',
	};
	assert.equal(historyEditReceiptSentence(opaque as never, () => 'TLE'), null,
		'a bare `Moved.` would read as a claim the record does not carry, so nothing renders');
});
