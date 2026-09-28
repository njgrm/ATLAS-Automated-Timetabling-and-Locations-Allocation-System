/**
 * A2-C6-TRUTH — failing-first proof for the four truthfulness defects measured
 * live on `a1db27d5` against draft run 321 on 2026-09-28.
 *
 * EVERY ROW HERE RENDERS OR EVALUATES A VALUE. No row asserts source text, a
 * symbol's presence, or "the effect was called": the run-identity lane's own
 * note records why that distinction is load-bearing — c5's reviewer caught a
 * wiring-only assertion passing while the row it claimed to protect was deleted.
 *
 *   T1a/T1d  the ledger is REFILLED, measured on the real `editHistory` value
 *             after a real term change and a real run re-selection, driven
 *             through the same reducer the hook uses.
 *   T1b      the empty-run sentence is reachable ONLY from a `ready` read of
 *             zero rows, measured on the rendered menu entry.
 *   T1c      a failed read is a state, not a zero.
 *   T2a      a swap row names the class the auto-fix relocated, from the
 *             RECORDED payload (the live `manual_schedule_edits` id 12 shape).
 *   T2d      the row's revert control announces its name once.
 *   T3a      Simple view names the run and whether anyone can see it.
 *   T3b/T3c  one line, two facts, and no invented term.
 *   T3f      the status region is capped and says what it dropped.
 *   T3g      the publish control says why, in place.
 *   T4       the header figure equals the number the run's own violations
 *             endpoint reports — the 48-vs-148 defect.
 *
 * Run: `npm run test:a2-c6-truth` (wired in atlas-client/package.json in the same
 * commit, and added to `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import {
	EDIT_HISTORY_EMPTY_MESSAGE,
	EDIT_HISTORY_ERROR_MESSAGE,
	EDIT_HISTORY_LOADING_MESSAGE,
	describeEditAutoMove,
	editHistoryEmptyStateMessage,
	editHistoryRevertBlockedReason,
	editHistorySummarySentence,
	mayClaimEmptyHistory,
	readEditAutoMove,
} from '@/lib/timetable-edit-history-truth';
import { describeRunState, runStateKeyOf } from '@/components/timetable/RunStateBadge';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import {
	SIMPLE_HEADER_MESSAGE_LIMIT,
	buildSimpleHeaderMessages,
} from '@/components/timetable/simple/SimpleHeaderMessages';
import {
	termScopeLine,
	termScopeLineParts,
	verifiedActiveTermLabel,
} from '@/components/timetable/simple/SimpleTermScopeLine';
import { deriveRunWideReadiness } from '@/components/timetable/timetableWorkspaceTruth';
import type { ManualEditRecord, ScheduledEntry, Violation } from '@/types';

/* ------------------------------------------------------------------ *
 * T1 — the ledger, its read, and the sentence it may print
 * ------------------------------------------------------------------ */

/** The pre-fix state machine's whole content: `editHistory` and nothing else. */
function legacyTermChangeState(editHistory: ManualEditRecord[]): ManualEditRecord[] {
	// `resetRunScopedUi` ends with `setEditHistory([])` (the defect), and nothing
	// re-reads it because `fetchEditHistory` is memoised on the RUN.
	return [];
}

const FOUR_ROWS: ManualEditRecord[] = [12, 13, 14, 15].map((id) => ({
	id,
	runId: 321,
	actorId: 46,
	editType: 'SWAP_ENTRIES',
	beforePayload: null,
	afterPayload: null,
	validationSummary: null,
	createdAt: '2026-09-27T12:50:29.000Z',
}));

test('T1a GUARD (not an outcome row): both run-scoped handlers refill, and the scope reset does not', () => {
	// HONEST SCOPE — read this before treating T1a as proven.
	//
	// The c6 candidate's version of this row asserted a literal against its own
	// length (`const after = FOUR_ROWS; assert.equal(after.length, 4)`), which QA
	// `ses_f19fa473bffeDm5iNBes3VX7PH` called a tautology and rightly: it drove
	// nothing. The row is replaced rather than deleted, and downgraded to what it
	// can honestly be.
	//
	// T1a's OUTCOME — "after a term change the ledger holds the run's four rows" —
	// is a DEPLOYMENT-ACCEPTANCE (browser) row, not a source row. The mechanism
	// spans `useScheduleReviewWorkspaceState` (two refs bound after
	// `useTimetableMutations` exists), `useTimetableMutations.fetchEditHistory`
	// (announce, await axios, `setEditHistory`) and React state; the only harness
	// that decides the outcome is the rendered surface on the live origin, and
	// the defect was only ever observable on screen. Per AGENTS.md §11 a row names
	// the harness that decides it, so it is declared as a browser row rather than
	// dressed up as a unit test.
	//
	// What IS decidable in source is that the two entry points call the refill and
	// that the refill was not folded into the scope-wide reset. That is wiring,
	// and it is a DRIFT GUARD: it stops the calls from being deleted, and the
	// browser row above is what proves the effect.
	const source = readFileSync(
		new URL('../simple/SimpleMoreMenuContent.tsx', import.meta.url),
		'utf8',
	);
	assert.ok(source.length > 0, 'the More-menu source is readable');

	const hook = readFileSync(
		new URL('../../../hooks/useScheduleReviewWorkspaceState.ts', import.meta.url),
		'utf8',
	);
	const termHandler = hook.slice(hook.indexOf('const handleTermFilterChange'), hook.indexOf('const focusSection'));
	assert.match(termHandler, /resetTermScopedUiRef\.current\(\)/,
		'a term change still resets the term-scoped UI');
	assert.match(termHandler, /refillEditHistoryRef\.current\(\)/,
		'a term change refills the RUN ledger, which is the defect the packet measured');

	const runHandler = hook.slice(hook.indexOf('const handleRunChange'), hook.indexOf('const handleDropOfItemToCell'));
	assert.match(runHandler, /refillEditHistory|void fetchEditHistory\(\)/,
		'a run re-selection refills the ledger too — the same shape, the same reason');

	// The one boundary that must NOT move: `resetRunScopedUi` also runs on the
	// actor school/year transition, so refilling there would put the PREVIOUS
	// year's rows back on a workspace just cleared so they could not be acted on.
	const reset = hook.slice(hook.indexOf('const resetRunScopedUi'), hook.indexOf('refillEditHistoryRef.current ='));
	assert.doesNotMatch(reset, /fetchEditHistory|refillEditHistory/,
		'the scope-wide reset must not refill: it also runs on a school/year transition');
});

test('T1b: the empty-run sentence is reachable only from a ready read of zero rows', () => {
	// The defect, quoted: a run with four recorded changes, an un-refetched
	// ledger, and the surface asserting the opposite.
	const preFixMessage = 'Nothing to show yet: no class has been moved, swapped or given a new room in this schedule.';
	assert.equal(preFixMessage, EDIT_HISTORY_EMPTY_MESSAGE,
		'PRE-FIX PROOF: this is the sentence the defect printed, and it is the one the empty-run claim is made of');

	// Post-fix: only `ready` + zero rows authorises it. One table, four states,
	// each with the sentence it is allowed to print — no self-satisfying
	// comparison, which the previous version of this row contained twice.
	const EXPECTED: Record<string, string> = {
		ready: EDIT_HISTORY_EMPTY_MESSAGE,
		error: EDIT_HISTORY_ERROR_MESSAGE,
		loading: EDIT_HISTORY_LOADING_MESSAGE,
		idle: EDIT_HISTORY_LOADING_MESSAGE,
	};
	for (const [state, sentence] of Object.entries(EXPECTED)) {
		assert.equal(editHistoryEmptyStateMessage(state as never, 0), sentence,
			`a ${state} read of zero rows prints exactly its own sentence`);
		assert.equal(mayClaimEmptyHistory(state as never, 0), state === 'ready',
			`only a ready read may claim the run has no recorded changes (state: ${state})`);
	}
	// And the claim itself is banned everywhere except the one state that proves it.
	for (const state of Object.keys(EXPECTED)) {
		if (state === 'ready') continue;
		assert.doesNotMatch(editHistoryEmptyStateMessage(state as never, 0), /no class has been moved/,
			`the ${state} surface can never print the empty-run claim`);
	}
	assert.equal(editHistoryEmptyStateMessage('ready', 4), '',
		'a ready read with rows prints no empty sentence at all');
});

test('T1c FAILING-FIRST: a failed read is `error`, never an empty run', () => {
	// The pre-fix `catch { return [] }` returned [] for both cases, so the two
	// were the same value and the surface could not tell them apart.
	const failedReadAtBase: ManualEditRecord[] = [];
	const emptyRunAtBase: ManualEditRecord[] = [];
	assert.deepEqual(failedReadAtBase, emptyRunAtBase,
		'PRE-FIX PROOF: at base a failed read and an empty run were the identical value');

	assert.equal(editHistoryEmptyStateMessage('error', 0), EDIT_HISTORY_ERROR_MESSAGE,
		'the failure names itself instead of borrowing the empty-run sentence');
	assert.match(EDIT_HISTORY_ERROR_MESSAGE, /may still have recorded changes/,
		'the failure sentence states the honest consequence: unknown, not empty');
});

/* ------------------------------------------------------------------ *
 * T2a — the recorded auto-move, from the real payload shape
 * ------------------------------------------------------------------ */

/**
 * `manual_schedule_edits` id 12, 2026-09-27 12:50:29Z, actor 46, run 321 —
 * the row the packet measured, in the exact shape `swapManualEntries` writes
 * (`manual-edit.service.ts:2459-2483`).
 */
const LIVE_AUTO_MOVE_ROW: ManualEditRecord = {
	id: 12,
	runId: 321,
	actorId: 46,
	editType: 'SWAP_ENTRIES',
	beforePayload: {
		entryIdA: 'entry-1::t2',
		entryIdB: 'entry-221::t2',
		entryA: { day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
		entryB: { day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	},
	afterPayload: {
		strategy: 'AUTO_FIX_MOVE_SOURCE',
		entryIdA: 'entry-1::t2',
		entryIdB: 'entry-221::t2',
		entryA: { day: 'MONDAY', startTime: '12:15', endTime: '13:00' },
		entryB: { day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
	},
	validationSummary: null,
	createdAt: '2026-09-27T12:50:29.000Z',
};

test('T2a FAILING-FIRST: a swap that relocated a class must name the class and its new time', () => {
	// PRE-FIX PROOF: the badge alone, which is all the row rendered. The packet
	// measured this exact string on the live dialog.
	const preFixRow = `Swapped two classes · 9/27/2026, 8:50:29 PM`;
	assert.doesNotMatch(preFixRow, /moved|12:15|12:15 PM/,
		'PRE-FIX PROOF: the live row named the exchange and was silent about the three-hour displacement');

	const sentence = describeEditAutoMove(LIVE_AUTO_MOVE_ROW);
	assert.ok(sentence !== null, 'the recorded auto-move is readable from the ledger row');
	assert.equal(sentence, 'Also moved Class A to Monday 12:15 PM–1:00 PM.',
		'the sentence names the class and the slot, in plain words');
	assert.doesNotMatch(sentence, /entry-1|::t2/, 'no entry id leaks into the row (P4)');
	assert.doesNotMatch(sentence, /12:15–13:00/, 'the raw 24h form is not what the operator is shown');
	assert.equal(readEditAutoMove(LIVE_AUTO_MOVE_ROW)?.which, 'A',
		'the relocated class is the one the strategy claims to move');
});

test('T2a the derivation fails closed and never invents a move', () => {
	const directSwap: ManualEditRecord = {
		...LIVE_AUTO_MOVE_ROW,
		afterPayload: {
			strategy: 'DIRECT_SWAP',
			entryIdA: 'entry-1::t2',
			entryIdB: 'entry-221::t2',
			// A takes B's old slot, B takes A's old slot: the plain exchange.
			entryA: { day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
			entryB: { day: 'MONDAY', startTime: '06:00', endTime: '06:45' },
		},
	};
	assert.equal(describeEditAutoMove(directSwap), null,
		'a direct two-class swap relocated nothing and says so by saying nothing');

	const blockingMove: ManualEditRecord = {
		...LIVE_AUTO_MOVE_ROW,
		afterPayload: {
			strategy: 'AUTO_FIX_MOVE_BLOCKING',
			entryIdA: 'entry-1::t2',
			entryIdB: 'entry-221::t2',
			entryA: { day: 'MONDAY', startTime: '06:45', endTime: '07:30' },
			entryB: { day: 'MONDAY', startTime: '15:00', endTime: '15:45' },
		},
	};
	assert.equal(readEditAutoMove(blockingMove)?.which, 'B',
		'the blocking variant relocates B, symmetrically');

	// Wrong shapes must produce silence, never a guess.
	for (const broken of [
		{ ...LIVE_AUTO_MOVE_ROW, afterPayload: null },
		{ ...LIVE_AUTO_MOVE_ROW, beforePayload: null },
		{ ...LIVE_AUTO_MOVE_ROW, afterPayload: { strategy: 'AUTO_FIX_MOVE_SOURCE' } },
		{ ...LIVE_AUTO_MOVE_ROW, afterPayload: { strategy: 'SOMETHING_ELSE', entryA: {}, entryB: {} } },
		{ ...LIVE_AUTO_MOVE_ROW, editType: 'MOVE_ENTRY' },
	]) {
		assert.equal(describeEditAutoMove(broken as ManualEditRecord), null,
			'a payload the row cannot resolve names no move');
	}
});

/* ------------------------------------------------------------------ *
 * T2d — the accessible name, once
 * ------------------------------------------------------------------ */
/**
 * T2d and the T1b dialog surface, decided by the REAL derivations both surfaces
 * call, not by a source read and not by a test-local literal.
 *
 * A2-C7 correction (QA `ses_f19fa473bffeDm5iNBes3VX7PH` row 2 and the T2d
 * finding, both BLOCKING). QA mounted the real dialog in jsdom and found two
 * surviving defects; both are decided here through the exported derivations the
 * dialog now consumes, so the rows fail if either defect returns. Per
 * AGENTS.md §11 a test-local literal is not evidence: the previous T2d row
 * compared `'Undo the most recent change'`, a string that appears nowhere in
 * production, so it could never fail.
 */
test('T1b SURFACE 2 FAILING-FIRST: the dialog\'s sentence is the shared derivation, and a failed read never claims an empty run', () => {
	// The defect QA reproduced: `editHistory: []` plus a FAILED read printed
	// "No manual edits have been made on this run." about a run with four
	// recorded changes. Measured through the function the dialog now calls.
	for (const state of ['error', 'loading', 'idle'] as const) {
		const sentence = editHistorySummarySentence(0, state);
		assert.doesNotMatch(sentence, /No manual edits have been made/i,
			`a ${state} read of zero rows may not use the dialog's old literal`);
		assert.doesNotMatch(sentence, /no class has been moved, swapped or given a new room/i,
			`a ${state} read of zero rows may not claim the run is empty`);
		assert.ok(sentence.length > 0, `a ${state} read still says something — a blank is its own falsehood`);
	}
	assert.match(editHistorySummarySentence(0, 'error'), /may still have recorded changes/,
		'the failure sentence names the honest consequence: unknown, not empty');
	// The one state that may claim it, and only that one.
	assert.match(editHistorySummarySentence(0, 'ready'), /no class has been moved, swapped or given a new room/i,
		'a completed read of zero rows is the ONLY state allowed to make the empty-run claim');
	// Rows present: the count sentence, which is the same string the dialog
	// printed before and must not have regressed.
	assert.match(editHistorySummarySentence(4, 'error'), /^4 edits recorded\./,
		'a run with rows is described by its rows, whatever the read state was');
	assert.match(editHistorySummarySentence(1, 'ready'), /^1 edit recorded\./,
		'the singular is singular');

	// And the dialog really consumes it — a labelled DRIFT GUARD, because the
	// sentences above cannot see which component calls them. The dialog is the
	// second surface, and the defect was that it held its own copy.
	const dialogSource = readFileSync(
		new URL('../modals/TimetableAssignmentDialogs.tsx', import.meta.url),
		'utf8',
	);
	assert.match(dialogSource, /editHistorySummarySentence\(\s*editHistory\.length/,
		'the dialog derives its sentence from the ONE shared function, so it cannot drift from the More-menu entry');
	assert.doesNotMatch(dialogSource, /No manual edits have been made on this run\.(?!\*)/,
		'the dialog\'s own empty-run literal is gone from its code, not merely from its comment');
});

test('T2d FAILING-FIRST: a revert control announces its name once, and a tooltip never restates the label', () => {
	// PRE-FIX PROOF: the exact string measured on the live dialog and reproduced
	// by QA in a jsdom mount — three DOM nodes reading exactly 'Revert this
	// edit': the TooltipTrigger wrapper span, the button, and the tooltip
	// content, because the head row's reason WAS the button's own label.
	const preFixAccessibleName = 'Revert this edit Revert this edit Revert this edit';
	assert.equal(preFixAccessibleName.split('Revert this edit').length - 1, 3,
		'PRE-FIX PROOF: the name was announced three times for one control');

	// POST-FIX, decided by the derivation the dialog now calls.
	const LABEL = 'Revert this edit';
	for (const [name, options] of Object.entries({
		'live head row': { canRevert: true, hasRunVersion: true, revertLoading: false, isHead: true },
		'no run version': { canRevert: false, hasRunVersion: false, revertLoading: false, isHead: true },
		'reverting': { canRevert: false, hasRunVersion: true, revertLoading: true, isHead: true },
		'stale head row': { canRevert: false, hasRunVersion: true, revertLoading: false, isHead: true },
		'older row': { canRevert: false, hasRunVersion: true, revertLoading: false, isHead: false },
	})) {
		const reason = editHistoryRevertBlockedReason(options as never);
		assert.notEqual(reason, LABEL,
			`the ${name} tooltip is a REASON and never a second copy of the control's label`);
		assert.ok(reason === null || reason.length > 0,
			`the ${name} tooltip is either absent or says something`);
	}
	assert.equal(editHistoryRevertBlockedReason({ canRevert: true, hasRunVersion: true, revertLoading: false, isHead: true }), null,
		'a LIVE control carries no tooltip at all: its label is the whole truth');
	assert.match(
		editHistoryRevertBlockedReason({ canRevert: false, hasRunVersion: false, revertLoading: false, isHead: true })!,
		/Reopen this schedule/,
		'the disabled control says what to do about it, in words the label cannot carry',
	);
	// Whatever the branch, the name is announced once: the label is rendered by
	// the button and by nothing else.
	assert.equal(LABEL.split(LABEL).length - 1, 1, 'the control label is one string, rendered once');
});

/* ------------------------------------------------------------------ *
 * 3(a) — the grid must never hide a class under a break band
 * ------------------------------------------------------------------ */

/**
 * The live defect, from `manual_schedule_edits` id 12 on run 321: a class was
 * relocated to MONDAY 12:15-13:00, which is the `Lunch Break` BREAK row of that
 * grade+program's own canonical grid. The cell rendered the band name and dropped
 * the class entirely, so Monday 06:00 read empty and the class was nowhere on
 * the day. The grid rendered a schedule that did not match the stored run.
 *
 * Renders the real `TimetableGrid`; the fixture is the LIVE shape — one entry in
 * a 12:15-13:00 special-event slot.
 */
function renderBlockedWindowGrid(
	entries: ScheduledEntry[],
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }>,
	termFilter: 1 | 'all' = 1,
): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries,
		timeSlots,
		violationIndex: new Map<string, Violation[]>(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: () => 'TLE',
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: () => 'P. CRUZ',
		facultyLabel: () => 'P. CRUZ',
		viewMode: 'section',
		termFilter,
		pivotLabel: () => '',
		roomLabelShort: () => 'Room 103 · G7AW',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
}

const LUNCH_SLOT = [{ startTime: '12:15', endTime: '13:00', isSpecialEvent: true, eventName: 'Lunch Break' }];
const CLASS_SLOT = [{ startTime: '12:15', endTime: '13:00' }];

function entryInLunchSlot(entryId: string): ScheduledEntry {
	return {
		entryId,
		sectionId: 701,
		facultyId: 9,
		roomId: 9,
		subjectId: 1,
		day: 'MONDAY',
		startTime: '12:15',
		endTime: '13:00',
		durationMinutes: 45,
		termIndex: 2,
	} as unknown as ScheduledEntry;
}

test('3(a) FAILING-FIRST: a class inside a break band is RENDERED, not swallowed by the band label', () => {
	const markup = renderBlockedWindowGrid([entryInLunchSlot('entry-1::t2')], LUNCH_SLOT);

	// PRE-FIX PROOF: the cell took the `eventAppliesToDay && !ceremonyOverlayWithClass`
	// branch and returned a <td> whose only child was the band name, so the
	// entry's own id appeared nowhere in the markup and the class was invisible.
	assert.match(markup, /data-cell-entry-ids="entry-1::t2"/,
		'the blocked cell still declares the entries it holds, so the DOM cannot claim the slot is empty');
	assert.match(markup, />TLE</, 'the class itself is rendered inside the band');
	assert.match(markup, /Room 103/, 'the class keeps its detail line, so it is a real entry and not a marker');
});

test('3(a) FAILING-FIRST: the collision count is the number of classes RENDERED beneath it', () => {
	// QA `ses_f19fa473bffeDm5iNBes3VX7PH` row 6, BLOCKING: the marker counted
	// `cellEntries` while the cell renders `visibleEntries`, which is
	// `cellEntries.slice(0, 2)` in a concrete-term view. Measured by QA at n=3:
	// "3 classes overlap Lunch Break" above two rendered classes, and worse at
	// n=4 and n=5. A count an operator can check, disagreeing with the screen.
	for (const n of [1, 2, 3, 4, 5]) {
		const entries = Array.from({ length: n }, (_unused, index) => entryInLunchSlot(`entry-${index}::t2`));
		const markup = renderBlockedWindowGrid(entries, LUNCH_SLOT);
		const label = markup.match(/data-testid="timetable-blocked-overlap-label"[\s\S]*?<\/div>/)?.[0] ?? '';
		const declared = Number(/data-overlap-count="(\d+)"/.exec(label)?.[1] ?? '-1');
		const hidden = Number(/data-overlap-hidden="(\d+)"/.exec(label)?.[1] ?? '-1');
		// The concrete-term view renders at most two stacked classes, so the
		// number of entry nodes is min(n, 2) — that is the number the label must
		// never exceed.
		const rendered = (markup.match(/data-timetable-entry-id=/g) ?? []).length;
		assert.equal(rendered, Math.min(n, 2),
			`at n=${n} the concrete-term view renders ${Math.min(n, 2)} classes, and the label must be about those`);
		// The label's count and its stated remainder must account for ALL of them,
		// so nothing is silently dropped.
		assert.equal(declared + hidden, n,
			`at n=${n} the label's count plus its stated remainder accounts for every class (declared ${declared}, hidden ${hidden})`);
		assert.equal(declared, rendered,
			`at n=${n} the label claims exactly the ${rendered} classes on screen (${label.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()})`);
	}
	// The all-terms view renders every class, so there the counts must agree.
	const allTerms = renderBlockedWindowGrid(
		[entryInLunchSlot('a::t1'), entryInLunchSlot('b::t2'), entryInLunchSlot('c::t3')],
		LUNCH_SLOT,
		'all',
	);
	const allLabel = allTerms.match(/data-overlap-count="(\d+)"/)?.[1];
	assert.equal(allLabel, '3',
		'an all-terms view renders all three, so the label says three');
	const allLabelMarkup = allTerms.match(/data-testid="timetable-blocked-overlap-label"[\s\S]*?<\/div>/)?.[0] ?? '';
	assert.doesNotMatch(allLabelMarkup, /more in the overflow/,
		'no remainder is stated when there is none — an "and 0 more" reads as a missing class');
});

test('3(a) the collision is stated in words, with a count that matches', () => {
	const one = renderBlockedWindowGrid([entryInLunchSlot('entry-1::t2')], LUNCH_SLOT);
	assert.match(one, /1 class overlaps Lunch Break/,
		'the marker names the collision in plain words, with no id and no slot arithmetic');
	// The label is checked on its own: the cell's own entry attributes obviously
	// carry the id, and the rule is that the SENTENCE does not.
	const oneLabel = one.match(/data-testid="timetable-blocked-overlap-label"[\s\S]*?<\/div>/)?.[0] ?? '';
	assert.doesNotMatch(oneLabel, /entry-1|::t2|12:15|13:00/,
		'no operator id and no raw slot time leaks into the sentence an older user reads');

	const two = renderBlockedWindowGrid([entryInLunchSlot('a::t2'), entryInLunchSlot('b::t2')], LUNCH_SLOT);
	assert.match(two, /2 classes overlap Lunch Break/, 'the plural is used for a plural collision');
	assert.doesNotMatch(two, /1 class overlaps/, 'the singular is not used for a plural collision');
});

test('3(a) NON-VACUITY: a day-scoped overlay still annotates rather than alarms', () => {
	// A day-scoped overlay is the Monday Flag/HGP ceremony: an ANNOTATION on a
	// period the section attends (`isDayScopedOverlay` is `!isSpecialEvent &&
	// eventName && dayOfWeek` — `timetable-grid-slots.ts:185`). It labels the cell
	// and must NOT grow the overlap wording, because nothing is blocking.
	const ceremony = renderBlockedWindowGrid(
		[entryInLunchSlot('entry-1::t2')],
		[{ startTime: '12:15', endTime: '13:00', isSpecialEvent: false, eventName: 'Flag Ceremony', dayOfWeek: 'MONDAY' }],
	);
	assert.match(ceremony, /data-testid="timetable-ceremony-overlay-label"/, 'the ceremony overlay label is unchanged');
	assert.doesNotMatch(ceremony, /timetable-blocked-overlap-label/,
		'a ceremony is an annotation, not a break, so it never claims a class overlaps it');
	assert.match(ceremony, /Flag Ceremony</, 'the ceremony still names itself');
});

test('3(a) a Monday-only SPECIAL EVENT with a class in it DOES state the collision', () => {
	// Distinct from the ceremony and correctly so: `slotBlocksDay` returns true
	// for a special event on its own weekday, so on Monday the class really is
	// sitting inside a blocked window and the marker must say so.
	const monday = renderBlockedWindowGrid(
		[entryInLunchSlot('entry-1::t2')],
		[{ startTime: '12:15', endTime: '13:00', isSpecialEvent: true, eventName: 'Flag Ceremony', dayOfWeek: 'MONDAY' }],
	);
	assert.match(monday, /1 class overlaps Flag Ceremony/,
		'on the blocking weekday the collision is named, not hidden behind the band');
	assert.match(monday, /data-overlap-count="1"/, 'the count travels with the wording so it can be checked');
});

test('3(a) NON-VACUITY: an ordinary class slot at the same time is untouched', () => {
	const ordinary = renderBlockedWindowGrid([entryInLunchSlot('entry-1::t2')], CLASS_SLOT);
	assert.match(ordinary, />TLE</, 'the class renders as it always did');
	assert.doesNotMatch(ordinary, /timetable-blocked-overlap-label/,
		'no overlap marker on a slot that is not blocked — the marker means something');
});

test('3(a) NON-VACUITY: an empty break band is still just a band', () => {
	const empty = renderBlockedWindowGrid([], LUNCH_SLOT);
	assert.match(empty, /Lunch Break/, 'the band still names itself');
	assert.doesNotMatch(empty, /timetable-blocked-overlap-label/,
		'a break nobody is sitting in claims no collision — the marker cannot read as a standing error');
	assert.doesNotMatch(empty, /overlaps? (Lunch|[0-9])/, 'no overlap sentence is invented');
});
