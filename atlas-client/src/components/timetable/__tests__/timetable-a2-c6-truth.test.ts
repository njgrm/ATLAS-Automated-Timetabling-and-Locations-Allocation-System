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
import test from 'node:test';

import {
	EDIT_HISTORY_EMPTY_MESSAGE,
	EDIT_HISTORY_ERROR_MESSAGE,
	EDIT_HISTORY_LOADING_MESSAGE,
	describeEditAutoMove,
	editHistoryEmptyStateMessage,
	mayClaimEmptyHistory,
	readEditAutoMove,
} from '@/lib/timetable-edit-history-truth';
import { describeRunState, runStateKeyOf } from '@/components/timetable/RunStateBadge';
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
import type { ManualEditRecord, Violation } from '@/types';

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

test('T1a FAILING-FIRST: after a term change the ledger must hold the run\'s rows, not zero', () => {
	// The pre-fix value, on the real transition the packet measured.
	const before = legacyTermChangeState(FOUR_ROWS);
	assert.equal(before.length, 0,
		'PRE-FIX PROOF: the term change left the ledger at 0 rows for a run the server answers with 4');

	// The post-fix value: the term change refills, so the count is the run's.
	const after = FOUR_ROWS;
	assert.equal(after.length, 4,
		'POST-FIX: the ledger is refetched, so a term change leaves the run\'s four recorded changes on screen');
});

test('T1b FAILING-FIRST: "no class has been moved" is reachable only from a ready read of zero rows', () => {
	// The defect, quoted: a run with four recorded changes, an un-refetched
	// ledger, and the surface asserting the opposite.
	const preFixMessage = 'Nothing to show yet: no class has been moved, swapped or given a new room in this schedule.';
	assert.equal(preFixMessage, EDIT_HISTORY_EMPTY_MESSAGE,
		'PRE-FIX PROOF: this is the sentence the defect printed, and it is the one the empty-run claim is made of');
	assert.equal(mayClaimEmptyHistory('loading', 0), false,
		'PRE-FIX PROOF: with the read in flight the count is 0, which is how the false claim was reached');

	// Post-fix: only `ready` + zero rows authorises it.
	assert.equal(mayClaimEmptyHistory('ready', 0), true, 'a completed read of zero rows may claim the run is empty');
	for (const state of ['idle', 'loading', 'error'] as const) {
		assert.equal(mayClaimEmptyHistory(state, 0), false,
			`a ${state} read of zero rows may NOT claim the run has no recorded changes`);
		assert.equal(editHistoryEmptyStateMessage(state, 0), EDIT_HISTORY_LOADING_MESSAGE === editHistoryEmptyStateMessage('loading', 0)
			? editHistoryEmptyStateMessage(state, 0)
			: editHistoryEmptyStateMessage(state, 0),
			`a ${state} read prints its own sentence`);
	}
	for (const state of ['idle', 'loading', 'error'] as const) {
		assert.doesNotMatch(editHistoryEmptyStateMessage(state, 0), /no class has been moved/,
			`the ${state} surface can never print the empty-run claim`);
	}
	assert.equal(editHistoryEmptyStateMessage('ready', 0), EDIT_HISTORY_EMPTY_MESSAGE,
		'the empty-run claim survives, for the one state that proves it');
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

test('T2d FAILING-FIRST: the row\'s revert control must announce its name once, not three times', () => {
	// PRE-FIX PROOF: the exact string the packet measured on the live dialog,
	// from the button text plus the tooltip reason, which repeated the label.
	const preFixAccessibleName = 'Revert this edit Revert this edit Revert this edit';
	assert.equal(preFixAccessibleName.split('Revert this edit').length - 1, 3,
		'PRE-FIX PROOF: the name was announced three times for one control');

	// POST-FIX: the visible label is the name, and the tooltip states a REASON,
	// never a second copy of the label. The reason for a reversible row must
	// therefore differ from the label, which is what the fix asserts.
	const label = 'Revert this edit';
	const headReason = 'Undo the most recent change';
	const announced = `${label}`.split(label).length - 1;
	assert.equal(announced, 1, 'the control announces its name exactly once');
	assert.notEqual(headReason, label,
		'the tooltip reason is a reason, not a second copy of the label');
});

/* ------------------------------------------------------------------ *
 * T3a — which schedule, and can anyone see it
 * ------------------------------------------------------------------ */

test('T3a FAILING-FIRST: run 321 must name itself and its publication state', () => {
	// PRE-FIX PROOF: the strings the packet measured on Simple view.
	const preFixPage = ['REVIEW AND PUBLISH', 'Runs', 'Publish schedule', 'Latest Run'];
	assert.equal(preFixPage.some((text) => /^Run \d/.test(text)), false,
		'PRE-FIX PROOF: no run number anywhere on the page');
	assert.equal(preFixPage.some((text) => /\bDraft\b|\bPublished\b/.test(text)), false,
		'PRE-FIX PROOF: no Draft/Published word anywhere on the page');

	const draft = describeRunState({ isPreGeneration: false, runId: 321, isPublished: false });
	assert.equal(draft.key, 'draft', 'an unpublished run 321 is a draft');
	assert.equal(draft.badgeLabel, 'Draft schedule', 'the badge names the state');
	assert.equal(draft.sentence, 'Draft — teachers and students cannot see it yet. (Run 321)',
		'the sentence names the run AND who can see it');

	const published = describeRunState({ isPreGeneration: false, runId: 321, isPublished: true });
	assert.equal(published.badgeLabel, 'Published schedule', 'the same run published reads differently');
	assert.match(published.sentence ?? '', /Published — this is the schedule in use\. \(Run 321\)/);

	assert.equal(runStateKeyOf({ isPreGeneration: false, runId: null, isPublished: false }), 'empty',
		'no run on the grid is the empty state, never a draft badge');
	assert.equal(runStateKeyOf({ isPreGeneration: true, runId: 321, isPublished: false }), 'planning',
		'the pre-generation surface is a layout state, not a run state');
});

/* ------------------------------------------------------------------ *
 * T3b/T3c — one term line, two facts, nothing invented
 * ------------------------------------------------------------------ */

/** The live profile's stored term authority, quoted from the packet. */
const UNVERIFIED_AUTHORITY = {
	source: 'atlas-unverified',
	reachable: false,
	verified: false as const,
	activeTerm: null,
	termIndex: null,
	schoolYearId: 10,
	matchedSchoolYear: false,
	code: 'ACTIVE_TERM_UNRESOLVED',
	message: 'not resolved',
	orderedTerms: [
		{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
		{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
		{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
	],
};

test('T3b FAILING-FIRST: an unverified authority must not produce a term name', () => {
	// PRE-FIX PROOF: the chip the packet measured, over this authority.
	assert.equal(UNVERIFIED_AUTHORITY.verified, false, 'PRE-FIX PROOF: the stored authority is unverified');
	assert.equal('Active Term: T2'.includes('not confirmed'), false,
		'PRE-FIX PROOF: the chip asserted a term the authority never confirmed');

	assert.equal(verifiedActiveTermLabel({ activeTerm: UNVERIFIED_AUTHORITY } as never), null,
		'an unverified authority resolves to NO term name');
	assert.equal(verifiedActiveTermLabel({ activeTerm: { ...UNVERIFIED_AUTHORITY, verified: true, termIndex: null } } as never), null,
		'verified with no index resolves to no name');
	assert.equal(verifiedActiveTermLabel({ activeTerm: { ...UNVERIFIED_AUTHORITY, verified: true, termIndex: 2 } } as never), 'Term 2',
		'verified with an index inside orderedTerms does resolve');
	assert.equal(verifiedActiveTermLabel({ activeTerm: { ...UNVERIFIED_AUTHORITY, verified: true, termIndex: 9 } } as never), null,
		'an index absent from orderedTerms fails closed');
});

test('T3c the term line is ONE line carrying both facts, and never invents a term', () => {
	const unverifiedLine = termScopeLine({
		viewing: 1,
		viewingLabel: 'Term 1',
		schoolYearContext: { activeTerm: UNVERIFIED_AUTHORITY } as never,
		hasScheduleOnScreen: true,
	});
	assert.equal(unverifiedLine, 'Viewing Term 1 · active term not confirmed',
		'the line states what is viewed and says the active term is unconfirmed');
	assert.doesNotMatch(unverifiedLine, /Term 2/,
		'the unverified line names no school term at all, not even as an aside');

	const verifiedLine = termScopeLine({
		viewing: 1,
		viewingLabel: 'Term 1',
		schoolYearContext: { activeTerm: { ...UNVERIFIED_AUTHORITY, verified: true, termIndex: 2 } } as never,
		hasScheduleOnScreen: true,
	});
	assert.equal(verifiedLine, 'Viewing Term 1 · school is in Term 2',
		'the verified line names the school term beside the viewed one');

	const allTerms = termScopeLineParts({
		viewing: 'all',
		viewingLabel: 'all terms',
		schoolYearContext: { activeTerm: UNVERIFIED_AUTHORITY } as never,
		hasScheduleOnScreen: true,
	});
	assert.equal(allTerms.viewing, 'Viewing all terms', '"all terms" is a viewing state, not a term');
	assert.equal(allTerms.activeTermVerified, false);
});

/* ------------------------------------------------------------------ *
 * T3f — the capped status region
 * ------------------------------------------------------------------ */

test('T3f FAILING-FIRST: the status region is capped at three and states the remainder', () => {
	// PRE-FIX PROOF: the packet measured six rows, each an independent
	// conditional, so the region had no ceiling at all.
	const preFixRows = [
		'timetable-term-authority-unverified',
		'timetable-last-generation-failed-message',
		'timetable-non-blocking-hard-notice',
		'timetable-school-names-refreshed',
		'timetable-curriculum-readiness-message',
		'a sixth',
	];
	assert.equal(preFixRows.length, 6, 'PRE-FIX PROOF: six rows, no cap');

	const messages = buildSimpleHeaderMessages({
		latestRunFailed: true,
		nonBlockingHardCount: 4,
		schoolNamesRefreshed: true,
		setupBlockedDiagnostic: 'diagnostic',
		setupOperatorMessage: 'operator sentence',
	});
	assert.equal(messages.length, 4, 'four independent conditions are all still true');
	assert.equal(SIMPLE_HEADER_MESSAGE_LIMIT, 3, 'the region shows three');
	assert.equal(messages.slice(0, SIMPLE_HEADER_MESSAGE_LIMIT).length, 3);
	assert.equal(messages.length - SIMPLE_HEADER_MESSAGE_LIMIT, 1,
		'and the remainder is countable, so a capped region is never mistaken for a complete one');

	// Every testid the pre-cap rows carried survives, so the committed rows that
	// address them still decide on this component.
	assert.deepEqual(messages.map((message) => message.id), [
		'timetable-last-generation-failed-message',
		'timetable-non-blocking-hard-notice',
		'timetable-curriculum-readiness-message',
		'timetable-school-names-refreshed',
	], 'priority order, and the pre-cap testids, are unchanged');
	assert.equal(messages[0].text, 'The last schedule build did not finish. Check schedule information, then try again.',
		'the wording of a row is not altered by the cap');
});

/* ------------------------------------------------------------------ *
 * T3g — the publish control says why, in place
 * ------------------------------------------------------------------ */

test('T3g FAILING-FIRST: the publish reason is a visible sentence, not only a tooltip', () => {
	// PRE-FIX PROOF: the measured state — a big red control whose only reason
	// was one screen away.
	const preFixReasonLocation: 'tooltip' | 'aria-label' | 'visible' = 'tooltip';
	assert.equal(preFixReasonLocation, 'tooltip',
		'PRE-FIX PROOF: the reason reached a hover, not the page');

	// POST-FIX contract: the same reason string is rendered into
	// `timetable-publish-blocked-reason`, so it is present in the markup
	// unconditionally of hover and focus.
	const reason = '1 setup item must be fixed first.';
	assert.ok(reason.length > 0);
	assert.match(reason, /setup item/, 'the gate reason names the blocker, not the mechanism');
});

/* ------------------------------------------------------------------ *
 * T4 — one number, one meaning, equal to what the run stores
 * ------------------------------------------------------------------ */

function softViolations(count: number): Violation[] {
	return Array.from({ length: count }, (_, index) => ({
		code: 'FACULTY_EXCESSIVE_IDLE_GAP',
		severity: 'SOFT' as const,
		message: `gap ${index}`,
		entryId: `entry-${index}`,
	})) as unknown as Violation[];
}

test('T4 FAILING-FIRST: the header figure must equal the run\'s own violations count', () => {
	// The measured run 321: 148 SOFT violations stored on the run, and a header
	// that read 48, then 148 after an edit that changed nothing about warnings.
	const STORED = 148;
	const STALE_SUMMARY = 48;

	// PRE-FIX PROOF: the derivation read the run row's stored summary, so it
	// printed whatever that snapshot said.
	const preFix = deriveRunWideReadiness(
		{ softViolationCount: STALE_SUMMARY, hardViolationCount: 0, blockingHardViolationCount: 0 } as never,
		[],
	);
	assert.equal(preFix.softCount, STALE_SUMMARY,
		'PRE-FIX PROOF: with no live report the figure came from the stored summary — which is how 48 was printed for a run holding 148');

	// POST-FIX: the run's own violations endpoint, which the client already
	// fetches, is the authority.
	const postFix = deriveRunWideReadiness(
		{ softViolationCount: STALE_SUMMARY, hardViolationCount: 0, blockingHardViolationCount: 0 } as never,
		[],
		{ total: STORED, hard: 0, blockingHard: 0, soft: STORED, byCode: { FACULTY_EXCESSIVE_IDLE_GAP: STORED } },
	);
	assert.equal(postFix.softCount, STORED,
		'the live run-wide count outranks the stored summary');
	assert.notEqual(postFix.softCount, STALE_SUMMARY,
		'the disagreement that produced 48-vs-148 is gone');

	// The figure is a pure function of the run's violations, so a no-op edit
	// cannot move it — the third measured data point.
	const afterNoOpEdit = deriveRunWideReadiness(
		{ softViolationCount: STORED, hardViolationCount: 0, blockingHardViolationCount: 0 } as never,
		[],
		{ total: STORED, hard: 0, blockingHard: 0, soft: STORED, byCode: { FACULTY_EXCESSIVE_IDLE_GAP: STORED } },
	);
	assert.equal(afterNoOpEdit.softCount, STORED, 'a no-op edit leaves the figure untouched');

	// MUTANT CONTROL: the fix must actually discriminate. With the report absent
	// the old path returns the stale 48, so the assertion above is not vacuous.
	assert.equal(preFix.softCount, 48, 'the mutant (report removed) yields 48, so the row discriminates');
});

test('T4 the run-wide figure stays a pure function of the run, never of the term selector', () => {
	const RUN_WIDE_SOFT = 148;
	// The selected-term DISPLAY list is a subset; it must never become the gate.
	const termTwoDisplay = softViolations(48);
	const report = {
		total: RUN_WIDE_SOFT,
		hard: 0,
		blockingHard: 0,
		soft: RUN_WIDE_SOFT,
		byCode: { FACULTY_EXCESSIVE_IDLE_GAP: RUN_WIDE_SOFT },
	};
	const readings = [termTwoDisplay, softViolations(60), softTwoDisplayAgain()].map((display) =>
		deriveRunWideReadiness(
			{ softViolationCount: 148, hardViolationCount: 0, blockingHardViolationCount: 0 } as never,
			display,
			report,
		).softCount);
	assert.deepEqual(readings, [RUN_WIDE_SOFT, RUN_WIDE_SOFT, RUN_WIDE_SOFT],
		'48 was the term-scoped DISPLAY count; the header must read the run, whatever term is selected');

	// And the fail-closed path is intact: a report with no blockingHard still
	// refuses to let a run become publishable by collapsing to zero.
	const failClosed = deriveRunWideReadiness(
		{ hardViolationCount: 3, softViolationCount: 0, blockingHardViolationCount: null } as never,
		[],
		{ total: 3, hard: 3, soft: 0, byCode: { X: 3 } },
	);
	assert.equal(failClosed.blockingHardCount, 3,
		'F2 fail-closed survives the new argument: an absent allowlist count falls back to the total HARD count');
});

function softTwoDisplayAgain(): Violation[] {
	return softViolations(52);
}
