/**
 * A8-C5 S2.3 CORRECTION (2026-09-30) — the automatic retry, as BEHAVIOUR.
 *
 * The operator's own words (addendum 20:05, item 4): "A check that could not run
 * (`unavailable/failed`) retries by itself once, then says so plainly with a Retry
 * button." The independent QA review of candidate `18ca45f6` found that neither
 * half existed: no automatic retry was in the range, and while the capability
 * model produced `checkFailed` and a `retryLabel`, a grep across the client found
 * those fields asserted only in tests — no component rendered them. The source and
 * test messages even claimed "so it retries once by itself" for a behaviour the
 * product did not have. This file is the control for the half that is behavioural:
 * the retry itself, in the module `fetchCurriculumReadiness` now calls.
 *
 * WHAT IS REAL HERE. `readGenerationReadinessWithRetry` is production code called
 * by `useTimetableData` on every readiness read. The READ is injected (it is the
 * hook's forced `ensureTimetableReadiness` in production) and the WAIT is injected
 * so a test does not spend 1.2 s of wall clock, but the RETRY POLICY, the
 * supersede guards and the INTERPRETATION are the production ones: every
 * `interpret` below is the real `deriveGenerationReadinessState`, so an untrusted
 * payload and a payload for the wrong school year reach the policy as the
 * `failed`/`unavailable` states the operator's rule names.
 *
 * These are behavioural assertions about call counts and published states. None of
 * them can be satisfied by a string in a source file.
 *
 * Run: `npm run test:a8-c5-readiness-retry`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveGenerationReadinessState } from '@/lib/timetable-generation-readiness';
import {
	GENERATION_READINESS_MAX_ATTEMPTS,
	GENERATION_READINESS_RETRY_DELAY_MS,
	GENERATION_READINESS_RETRYING_MESSAGE,
	isUnrunCheck,
	readGenerationReadinessWithRetry,
} from '@/lib/timetable-readiness-retry';
import type { TimetableCurriculumReadinessState } from '@/lib/timetable-generation-readiness';

/** The server's READY payload, at the exact scope the rows below expect. */
function readyDiagnostic(schoolId = 1, schoolYearId = 9) {
	return {
		scope: { schoolId, schoolYearId },
		status: 'READY',
		generateAllowed: true,
		schedulerExecuted: true,
		derivedDemandRevision: 'REV',
		termStructure: { format: 'TRIMESTER', terms: [{ identity: 'T1', order: 1 }] },
		totals: { lines: 40, pairs: 12, sessionsByTerm: { T1: 40 } },
		teachingLoadCoverage: { requiredPairs: 12, ownedPairs: 12, missingPairs: 0, inactiveOrStalePairs: 0, outsideScopePairs: 0 },
		blockerCount: 0,
		blockers: [],
		gaps: [],
		gapCount: 0,
		gapClassCount: 0,
		groups: [],
		zeroWrite: true,
	};
}

const EXPECTED_SCOPE = { schoolId: 1, schoolYearId: 9 };

/** One run of the policy, with everything counted, so a row can state a number. */
function runPolicy(options: {
	reads: Array<() => Promise<unknown>>;
	isSuperseded?: () => boolean;
	wait?: (ms: number) => Promise<void>;
}) {
	const published: TimetableCurriculumReadinessState[] = [];
	const waits: number[] = [];
	let calls = 0;
	let retries = 0;
	const settled = readGenerationReadinessWithRetry({
		read: () => {
			const read = options.reads[Math.min(calls, options.reads.length - 1)];
			calls += 1;
			return read();
		},
		interpret: (raw) => deriveGenerationReadinessState(raw, EXPECTED_SCOPE),
		messageForError: () => 'Generation readiness could not be checked. Retry before generating.',
		isSuperseded: options.isSuperseded ?? (() => false),
		onState: (state) => { published.push(state); },
		onRetryScheduled: () => { retries += 1; },
		// The wait is injected so a test spends no wall clock, and every default wait
		// is RECORDED — a row that claims "one bounded backoff" has to be able to see
		// it. A row that supersedes mid-wait supplies its own.
		wait: options.wait ?? (async (ms: number) => { waits.push(ms); }),
	});
	return { settled, published, waits, calls: () => calls, retries: () => retries };
}

const rejects = (message: string) => async () => { throw new Error(message); };

test('R1 a check that succeeds is read ONCE — the retry never fires on a good read', async () => {
	const run = runPolicy({ reads: [async () => readyDiagnostic()] });
	const settled = await run.settled;
	assert.equal(run.calls(), 1, 'a succeeding read is read exactly once');
	assert.equal(run.retries(), 0, 'and no retry was scheduled');
	assert.deepEqual(run.waits, [], 'so nothing waited');
	assert.equal(settled?.state, 'ready', 'the year is ready');
	assert.deepEqual(run.published.map((state) => state.state), ['ready'],
		'and exactly one state reached the surface');
});

test('R2 a check that FAILS is retried BY ITSELF, EXACTLY ONCE, and then stops', async () => {
	const run = runPolicy({ reads: [rejects('502 from the readiness route')] });
	const settled = await run.settled;
	assert.equal(run.calls(), 2,
		'a failing read is read twice — the first attempt and exactly ONE retry, never a third');
	assert.equal(run.calls(), GENERATION_READINESS_MAX_ATTEMPTS, 'and the bound is the two the packet asks for');
	assert.equal(run.retries(), 1, 'exactly one retry was scheduled');
	assert.deepEqual(run.waits, [GENERATION_READINESS_RETRY_DELAY_MS],
		'and there was ONE bounded backoff between the two attempts, not a ladder');
	// ORDER MATTERS. The failing state must not be published before the retry, or the
	// surface would claim the check gave up when it had not tried again yet; and the
	// in-between state must NAME the retry, or the operator is left at a spinner.
	assert.deepEqual(run.published.map((state) => state.state), ['loading', 'failed'],
		'the retry is announced as still-running, and only the second failure is published as failed');
	assert.equal(run.published[0].message, GENERATION_READINESS_RETRYING_MESSAGE,
		'the in-between state says, in words, that ATLAS is trying once more');
	assert.ok(!run.published[0].message.includes('could not be checked'),
		'and it does not claim the check failed while it is still trying');
	assert.equal(settled?.state, 'failed', 'the state the hook ends on is failed');
	assert.match(settled!.message, /Retry before generating/,
		'carrying the plain message and the Retry the operator has to act on');
});

test('R3 a read that SUCCEEDS but cannot be trusted is retried too — that is what "unavailable/failed" means', async () => {
	// The two states the operator named are the ADAPTER's, not only a thrown error:
	// a payload for another school year, or one that cannot be parsed, is a check
	// that could not be read. The policy must see both.
	const run = runPolicy({ reads: [async () => readyDiagnostic(1, 77)] });
	const settled = await run.settled;
	assert.equal(run.calls(), 2, 'a payload for a different school year is retried once');
	assert.equal(settled?.state, 'unavailable', 'and settles as unavailable when it stays wrong');
	assert.equal(run.retries(), 1);

	const untrusted = runPolicy({ reads: [async () => 'not a diagnostic'] });
	const settledUntrusted = await untrusted.settled;
	assert.equal(untrusted.calls(), 2, 'an unreadable payload is retried once as well');
	assert.equal(settledUntrusted?.state, 'failed');
	assert.equal(isUnrunCheck({ state: 'unavailable', message: '' }), true, 'unavailable is one of the two');
	assert.equal(isUnrunCheck({ state: 'failed', message: '' }), true, 'and so is failed');
	assert.equal(isUnrunCheck({ state: 'ready', message: '' } as TimetableCurriculumReadinessState), false,
		'a real answer is never retried');
	assert.equal(isUnrunCheck({ state: 'blocked', message: '' } as TimetableCurriculumReadinessState), false,
		'nor is a real BLOCKED answer — a blocked year is a fact, not a failed check');
});

test('R4 a transient failure that clears on the retry ends READY, and the retry is not mentioned as a failure', async () => {
	const run = runPolicy({ reads: [rejects('503 once'), async () => readyDiagnostic()] });
	const settled = await run.settled;
	assert.equal(run.calls(), 2, 'it took two attempts');
	assert.equal(settled?.state, 'ready',
		'and a check that comes back on the retry is a ready year, not a failed one');
	assert.deepEqual(run.published.map((state) => state.state), ['loading', 'ready'],
		'no failed state is ever published for a read that recovered');
});

test('R5 a SUPERSEDED request publishes nothing — and never resurrects itself over a newer read', async () => {
	// The rule that makes a retry safe. A read that finishes after a newer read has
	// started is stale, and the retry must not turn a stale failure into a state the
	// page then shows: the operator would be looking at last year's answer.
	let superseded = false;
	const run = runPolicy({
		reads: [async () => { superseded = true; return readyDiagnostic(); }],
		isSuperseded: () => superseded,
	});
	const settled = await run.settled;
	assert.equal(settled, null, 'a superseded read reports nothing to publish');
	assert.deepEqual(run.published, [], 'and published NOTHING — not even the good payload it fetched');
	assert.equal(run.calls(), 1, 'and it did not read again');
});

test('R6 superseding DURING the backoff stops the retry, and still publishes nothing', async () => {
	// The dangerous window: the first attempt has already failed, the retry is
	// decided on, and the wait is in progress. A newer request starts in that
	// window. The retry must not fire afterwards, because its response would be
	// older than the one the newer request is about to publish.
	let superseded = false;
	const run = runPolicy({
		reads: [rejects('502'), async () => readyDiagnostic()],
		isSuperseded: () => superseded,
		wait: async () => { superseded = true; },
	});
	const settled = await run.settled;
	assert.equal(run.calls(), 1, 'the retry never fired: the request was already superseded');
	assert.equal(settled, null);
	assert.deepEqual(run.published.map((state) => state.state), ['loading'],
		'only the in-progress state was ever published, and no result followed it');
});

test('R7 the policy cannot be made into a loop by a read that always fails', async () => {
	const run = runPolicy({ reads: [rejects('down')] });
	await run.settled;
	assert.equal(run.calls(), 2, 'a permanently failing check stops at two attempts');
	assert.equal(run.retries(), 1);
	assert.equal(run.waits.length, 1, 'with one wait, so there is no backoff ladder either');
});
