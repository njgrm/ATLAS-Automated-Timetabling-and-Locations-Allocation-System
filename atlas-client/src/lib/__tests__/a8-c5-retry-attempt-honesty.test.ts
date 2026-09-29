/**
 * A8 C5 CORRECTION 2 (F4) — the dialog must not claim work ATLAS never did.
 *
 * THE DEFECT. The Generate dialog's "the check could not run" cause carried a
 * fixed account — "ATLAS already tried this check twice on its own, and it did
 * not come back either time" — chosen from the STATE NAME alone. But
 * `unavailable` is reached by two genuinely different roads:
 *
 *   - the hook's scope guard refuses before any read  -> ZERO attempts;
 *   - a read, and its single automatic retry, did not come back -> TWO attempts.
 *
 * So on the cold-load path the operator was told ATLAS had tried twice when it
 * had not tried once. That is the same defect class F1 was raised for — a claim
 * the product does not honour — moved out of a comment and into rendered copy.
 *
 * THE FIX, and why it is a fact rather than an inference. The retry module
 * counts the reads it actually made and attaches the count to the state it
 * publishes (`timetable-readiness-retry.ts` -> `withAttempts`). The sentence is
 * then selected on that count. Nothing downstream infers an attempt count from
 * a state name again.
 *
 * The rows below are table-driven over the attempt count, so removing the gate
 * and restoring the single hardcoded sentence turns this file red.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveTimetableCapabilities } from '../timetable-capabilities';
import type { TimetableCapabilityInput } from '../timetable-capabilities';

const BASE: TimetableCapabilityInput = {
	scopeResolved: true,
	curriculumState: 'failed',
	curriculumReadinessAttempts: 2,
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
};

function checkFailedNote(attempts: number | null | undefined): string {
	const capabilities = deriveTimetableCapabilities({ ...BASE, curriculumReadinessAttempts: attempts });
	const cause = capabilities.generationStoppers.find((stopper) => stopper.key === 'setup-check-failed');
	assert.ok(cause, 'the failed check must still be a named cause');
	assert.equal(typeof cause!.retryNote, 'string', 'the cause must carry an account of what happened');
	return cause!.retryNote as string;
}

test('A8C5-F4-1: two real attempts earn the two-attempt account', () => {
	const note = checkFailedNote(2);
	assert.match(note, /tried this check twice/i, 'two reads did happen, so the operator may be told so');
	assert.match(note, /on its own/i, 'and the retry was ATLAS\'s own doing, not a click');
});

test('A8C5-F4-2: ZERO attempts must never be described as two tries', () => {
	// This is the exact production path QA observed:
	// `useTimetableData` publishes `unavailable` from its scope guard having
	// read nothing, and `TimetableSimpleHeader` defaults a missing readiness the
	// same way. The note must not describe a retry that never happened.
	for (const attempts of [null, undefined, 0] as const) {
		const note = checkFailedNote(attempts as number | null | undefined);
		assert.doesNotMatch(
			note,
			/twice/i,
			`attempts=${String(attempts)} reached the dialog with no read at all, so "twice" is a lie (got: ${note})`,
		);
		assert.match(note, /did not start|did not come back/i, `the honest account is still words (got: ${note})`);
	}
});

test('A8C5-F4-3: ONE attempt is not described as two', () => {
	// A superseded-or-single read that ended `failed` must not borrow the
	// exhausted-retry wording.
	const note = checkFailedNote(1);
	assert.doesNotMatch(note, /twice/i, `one read is not two (got: ${note})`);
});

test('A8C5-F4-4: the gate is on the count, so a state name alone decides nothing', () => {
	// Same state, different fact -> different account. This is the whole point:
	// if `state` alone decided the wording, these two would be identical.
	assert.notEqual(
		checkFailedNote(2),
		checkFailedNote(0),
		'two reads and no reads must produce different accounts',
	);
});

test('A8C5-F4-5: the honest note never adds a control and never gates generation', () => {
	for (const attempts of [null, 0, 1, 2] as const) {
		const capabilities = deriveTimetableCapabilities({
			...BASE,
			curriculumState: 'unavailable',
			curriculumReadinessAttempts: attempts as number | null,
		});
		assert.equal(
			capabilities.generation.enabled,
			true,
			`attempts=${String(attempts)}: a check that could not run must still open the dialog (the operator's rule: never greyed out)`,
		);
		assert.equal(capabilities.generationStoppers.length >= 1, true, 'the cause is still named');
	}
});
