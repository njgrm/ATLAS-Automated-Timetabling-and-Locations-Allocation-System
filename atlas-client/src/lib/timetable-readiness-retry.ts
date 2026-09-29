/**
 * A8-C5 S2.3 CORRECTION (2026-09-30) — the check that could not run retries ONCE
 * by itself, then stops and says so.
 *
 * WHY THIS FILE EXISTS. The operator's own words (addendum 20:05, item 4):
 * "A check that could not run (`unavailable/failed`) retries by itself once, then
 * says so plainly with a Retry button." Until this correction the client half of
 * that sentence did not exist: the capability model produced a `checkFailed`
 * flag and a `retryLabel`, the tests asserted them, and NOTHING retried — so the
 * source and the test messages claimed a behaviour the product did not have. That
 * is the exact defect class this packet exists to remove, and the honest fix is to
 * make the claim true rather than to reword it away.
 *
 * WHY IT IS A MODULE AND NOT A BLOCK INSIDE THE HOOK. The rule is behavioural —
 * "twice on a failing read, once on a succeeding read, and never over a newer
 * read" — and `useTimetableData` is a 2,000-line provider hook that cannot be
 * mounted in a bounded test. The behaviour therefore lives here, in a pure,
 * dependency-injected unit that the hook calls directly, so the assertion is
 * about the code that runs and not about a source string.
 *
 * THE FOUR RULES, and why each is load-bearing:
 *
 *   1. AT MOST TWO ATTEMPTS. Not a loop, not a backoff ladder, not "retry until
 *      it works". A readiness check that never gives up is a spinner with no
 *      exit, and an operator cannot tell it from a hang.
 *   2. A RETRY NEVER RESURRECTS A SUPERSEDED REQUEST. `isSuperseded` is checked
 *      BEFORE every attempt, after every response, and again after the backoff
 *      wait. A retry that overwrites a newer read is a worse bug than no retry:
 *      the page would contradict the year it is now showing.
 *   3. THE BACKOFF IS BOUNDED AND SAYS SO. 1.2 s — long enough not to hammer a
 *      failing upstream, short enough that nobody reads it as a stall. The
 *      in-between state is emitted with words that name the retry, so the wait is
 *      never a silent spinner.
 *   4. THE FAILING STATE IS NEVER SHOWN BEFORE THE RETRY. A flash of "failed"
 *      and then "loading" would be a lie in the other direction — it would claim
 *      the check gave up before it had.
 */

import type { TimetableCurriculumReadinessState } from './timetable-generation-readiness';

/** The honest in-progress message, the same one the hook showed before this. */
export const GENERATION_READINESS_LOADING_MESSAGE =
	'Checking generation readiness (Teaching Load, shape, policy, validators)…';

/**
 * What the operator reads while the single retry is in flight. It names the
 * retry, so the wait is explained rather than merely endured.
 */
export const GENERATION_READINESS_RETRYING_MESSAGE =
	'The first check did not come back. Trying once more…';

/**
 * A8-C5 S2.3 correction — the bound. 1.2 s: not long enough to read as a stall,
 * long enough not to hit a failing upstream twice in the same tick.
 */
export const GENERATION_READINESS_RETRY_DELAY_MS = 1200;

/** Exactly two attempts: the first, and exactly one retry. Never a third. */
export const GENERATION_READINESS_MAX_ATTEMPTS = 2;

/** The only two states the operator's rule names as "a check that could not run". */
export function isUnrunCheck(state: TimetableCurriculumReadinessState): boolean {
	return state.state === 'unavailable' || state.state === 'failed';
}

export type GenerationReadinessRetryInput = {
	/** One readiness read. The hook passes the real forced `ensureTimetableReadiness`. */
	read: () => Promise<unknown>;
	/** The real adapter, so a payload that cannot be trusted is a `failed` here too. */
	interpret: (raw: unknown) => TimetableCurriculumReadinessState;
	/** The plain message for a thrown read, from the hook's own error builder. */
	messageForError: (error: unknown) => string;
	/** The hook's own request-sequence guard, read (never written) from here. */
	isSuperseded: () => boolean;
	/** Every state the hook publishes, in the order it publishes them. */
	onState: (state: TimetableCurriculumReadinessState) => void;
	/** Fired once, when the single retry has been decided on. */
	onRetryScheduled?: (delayMs: number) => void;
	/** Injected so a test does not spend real seconds. Defaults to `setTimeout`. */
	wait?: (ms: number) => Promise<void>;
	/** Injected for the same reason. Defaults to the exported bound. */
	retryDelayMs?: number;
};

/**
 * Reads the generation readiness, retrying BY ITSELF EXACTLY ONCE when the first
 * attempt ends in `unavailable` or `failed`.
 *
 * Returns the state it settled on, or `null` when the request was superseded —
 * in which case nothing was published and the caller must publish nothing.
 */
export async function readGenerationReadinessWithRetry(
	input: GenerationReadinessRetryInput,
): Promise<TimetableCurriculumReadinessState | null> {
	const delayMs = input.retryDelayMs ?? GENERATION_READINESS_RETRY_DELAY_MS;
	const wait = input.wait ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));

	let attempt = 0;
	while (attempt < GENERATION_READINESS_MAX_ATTEMPTS) {
		attempt += 1;
		if (input.isSuperseded()) return null;
		try {
			const raw = await input.read();
			// Rule 2, immediately: a response for a superseded request is abandoned
			// even if it is perfectly good, and it is abandoned BEFORE it is
			// interpreted so a stale payload can never be published.
			if (input.isSuperseded()) return null;
			const settled = input.interpret(raw);
			if (attempt < GENERATION_READINESS_MAX_ATTEMPTS && isUnrunCheck(settled)) {
				input.onRetryScheduled?.(delayMs);
				input.onState({ state: 'loading', message: GENERATION_READINESS_RETRYING_MESSAGE });
				await wait(delayMs);
				// Rule 2 again, across the await: the operator may have changed year,
				// signed out, or started a newer check during the backoff.
				if (input.isSuperseded()) return null;
				continue;
			}
			input.onState(settled);
			return settled;
		} catch (error) {
			if (input.isSuperseded()) return null;
			const failed: TimetableCurriculumReadinessState = {
				state: 'failed',
				message: input.messageForError(error),
			};
			if (attempt < GENERATION_READINESS_MAX_ATTEMPTS) {
				input.onRetryScheduled?.(delayMs);
				input.onState({ state: 'loading', message: GENERATION_READINESS_RETRYING_MESSAGE });
				await wait(delayMs);
				if (input.isSuperseded()) return null;
				continue;
			}
			// Both attempts are done. The plain message and the Retry button are the
			// answer, and there is no third attempt behind them.
			input.onState(failed);
			return failed;
		}
	}
	// Unreachable by construction (every branch above either returns or continues
	// into the second and final attempt). It fails CLOSED rather than throwing, so a
	// future edit to the bound can never leave the hook with no state at all.
	const gaveUp: TimetableCurriculumReadinessState = {
		state: 'failed',
		message: 'Generation readiness could not be checked. Retry before generating.',
	};
	input.onState(gaveUp);
	return gaveUp;
}
