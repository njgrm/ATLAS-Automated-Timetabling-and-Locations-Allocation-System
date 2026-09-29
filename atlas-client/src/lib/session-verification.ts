/**
 * A7-C5 — the ONE sign-in check, with a deadline.
 *
 * THE DEFECT THIS EXISTS TO END. Codex's staging walk on 2026-09-29 recorded
 * `BLOCKER - /admin/year-setup - open local page, wait 10 s, reload once.
 * Observed "Verifying session. Checking your sign-in" indefinitely, with no
 * setup content.` The cause was structural: `verifySessionToken()` has no time
 * bound, and two call sites turned that into a permanent `verifying` state —
 * `AppShell.verifyActorSession()` (which guards EVERY route) and
 * `AdminYearSetup`'s own content gate. A request that never answers is a
 * request that never finishes, and the operator was left reading a promise the
 * app could not keep.
 *
 * ONE PLACE OWNS THE WAIT. The deadline is a single named constant here, both
 * call sites import this resolver, and neither re-implements a timer. A second
 * copy of the number — or a second `setTimeout` around the same call — is how
 * two surfaces drift into two different answers, which is the bug being fixed.
 *
 * THE RULE THAT MATTERS MOST IS THE ONE THAT IS EASY TO BREAK. Three outcomes,
 * not two:
 *
 *   `authenticated`   — a real answer: a user, keep it.
 *   `unauthenticated` — a real answer too: no token, a `null` user, or a
 *                       rejection. The caller's existing clear-and-redirect
 *                       authority is UNCHANGED. A dead session is still dead.
 *   `unconfirmed`     — NOT an answer at all: we ran out of patience. A slow
 *                       server is not proof of a bad sign-in, so this outcome
 *                       must never clear the token, never log the operator out
 *                       and never redirect to `/login`. It is the one branch
 *                       that could quietly destroy a working sign-in, which is
 *                       why it is a distinct kind and not a special case of
 *                       `unauthenticated`.
 *
 * The timer is ALWAYS cleared, however the race ends, so a fast sign-in never
 * leaves an 8-second timer armed per attempt. The function never throws: a
 * network error is a rejection (an answer), and a throw landing in a caller's
 * `.catch` would read as "signed out" — the exact confusion the deadline
 * exists to prevent.
 */
import { hasAnyAuthToken } from '@/lib/auth';
import { verifySessionToken } from '@/lib/settings';
import type { BridgeUser } from '@/types';

/** The requester's own number: "give it a time limit of about 8 s". */
export const SESSION_VERIFICATION_TIMEOUT_MS = 8000;

export type SessionVerificationOutcome =
	| { kind: 'authenticated'; user: BridgeUser }
	| { kind: 'unauthenticated'; reason: 'no-token' | 'rejected' }
	| { kind: 'unconfirmed'; reason: 'deadline-exceeded' };

export type SessionVerificationOptions = {
	/** Test seam and caller override. Defaults to the one named deadline. */
	timeoutMs?: number;
	/** Test seam: the sign-in read to race. Defaults to the real one. */
	verify?: () => Promise<BridgeUser | null>;
};

/**
 * Resolve the sign-in, or say plainly that we could not confirm it in time.
 *
 * Never throws. The two authority branches are decided by the ANSWER, never by
 * the clock, so a caller can keep its clear-and-redirect path for
 * `unauthenticated` and must treat `unconfirmed` as "show a way forward".
 */
export async function verifySessionWithinDeadline(
	options: SessionVerificationOptions = {},
): Promise<SessionVerificationOutcome> {
	if (!hasAnyAuthToken()) {
		return { kind: 'unauthenticated', reason: 'no-token' };
	}

	const verify = options.verify ?? verifySessionToken;
	const timeoutMs = options.timeoutMs ?? SESSION_VERIFICATION_TIMEOUT_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;

	try {
		// The attempt is always given a rejection handler, so a request that
		// settles AFTER the deadline cannot surface as an unhandled rejection.
		// `Promise.resolve().then(verify)` rather than a bare `verify()` call:
		// a SYNCHRONOUS throw from a non-async `verify` would otherwise escape
		// before these handlers are attached, and the promise it produced would
		// reject into callers that fire-and-forget. The function's contract is
		// "never throws", and this is the one line that makes that structural
		// instead of incidental to the production caller happening to be async.
		const attempt = Promise.resolve()
			.then(verify)
			.then<SessionVerificationOutcome>((user) => (
				user
					? { kind: 'authenticated', user }
					: { kind: 'unauthenticated', reason: 'rejected' }
			))
			.catch<SessionVerificationOutcome>(() => ({ kind: 'unauthenticated', reason: 'rejected' }));

		const deadline = new Promise<SessionVerificationOutcome>((resolve) => {
			timer = setTimeout(
				() => resolve({ kind: 'unconfirmed', reason: 'deadline-exceeded' }),
				timeoutMs,
			);
		});

		return await Promise.race([attempt, deadline]);
	} finally {
		// Every exit clears the timer: the deadline fired, or the answer won.
		if (timer !== undefined) clearTimeout(timer);
	}
}
