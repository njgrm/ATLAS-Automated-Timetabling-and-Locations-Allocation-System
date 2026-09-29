/**
 * A2-C14 — the ONE shared active-ordered-term resolver.
 *
 * THE DEFECT THIS EXISTS TO END
 * =============================
 * `resolveActiveSchoolYearContext` defaults `verifyUpstream` to **false**
 * (`enrollpro-public-settings.ts:252`). The server therefore skips its whole
 * term-resolution block and answers the literal default
 * `'Active term verification not requested.'` with `verified:false`, and
 * `isVerifiedOrderedActiveTerm` correctly fails closed on it.
 *
 * So the verified read was never failing — most callers simply never ASKED for
 * it. `/faculty/concerns` and `/admin/year-setup` called with `forceRefresh`
 * and no `verifyUpstream`, which makes them a guaranteed network call that
 * deterministically receives the unverified literal. See
 * `docs/reviews/a2-c14-root-cause/root-cause.md` §Term 1–2.
 *
 * THE CORRECT PATTERN, now shared
 * ===============================
 * `useTimetableData` already had the right two-step sequence: a fast read so
 * navigation never blocks on upstream verification, and then — only if that
 * left authority unresolved — exactly ONE `forceRefresh + verifyUpstream: true`
 * call. That sequence lived inline in the hook, so three pages that need the
 * same answer either reimplemented it wrongly or skipped it. This module is
 * that sequence, extracted once, and the hook now delegates to it.
 *
 * WHAT THIS DOES NOT DO
 * =====================
 * It does not decide *what* the answer may be. `isVerifiedOrderedActiveTerm`
 * (`@/lib/academic-term`) remains the single fail-closed gate, and a missing
 * term identity still never becomes Term 1 (AGENTS.md §7). This fixes *who
 * asks*, not the answer's admissibility.
 */

import { isVerifiedOrderedActiveTerm } from './academic-term';
import {
	type ActiveSchoolYearContext,
	resolveActiveSchoolYearContext,
} from './enrollpro-public-settings';

export type ActiveTermAuthorityResolution = {
	/** The context to render. Its `activeTerm` is the newest answer obtained. */
	context: ActiveSchoolYearContext;
	/** True only when `context.activeTerm` satisfies the canonical gate. */
	authorityReady: boolean;
	/**
	 * True when this resolution actually issued the `verifyUpstream: true`
	 * read. A page that needs a verified term (because a WRITE re-resolves the
	 * term server-side) uses this to tell "we asked and EnrollPro said no"
	 * apart from "we never asked".
	 */
	verifyUpstreamRequested: boolean;
};

export type ResolveActiveTermAuthorityOptions = {
	/**
	 * Force the fresh, upstream-verified read even when the fast read already
	 * carried a VERIFIED term.
	 *
	 * WHY THIS EXISTS. The fast step may be answered from a cache that is up to
	 * ten minutes old, and a verified-but-stale term still satisfies the gate —
	 * so by default a warm cache legitimately short-circuits the second read.
	 * That is right for a read-only surface. It is WRONG for Teacher Preferences,
	 * whose concern WRITE re-resolves the term live on the server and rejects a
	 * mismatched `termIndex` with `TERM_SCOPE_MISMATCH`: showing a term the
	 * server no longer holds would make the read and the write disagree. A
	 * caller that writes on this term sets this, and the fresh read is then
	 * always issued.
	 */
	requireFreshVerifiedRead?: boolean;
};

/**
 * Resolve the active ordered term for an actor school, asking for upstream
 * verification exactly once when the fast read does not already carry it.
 *
 * Contract:
 * - The fast read is `preferCache` + `backgroundRefresh` and does NOT ask for
 *   verification, so a warm school-year cache paints immediately.
 * - When that leaves authority unresolved, exactly one `forceRefresh` +
 *   `verifyUpstream: true` call follows. `forceRefresh` is load-bearing: the
 *   fresh-cache short-circuit would otherwise satisfy the call from a fresh but
 *   unverified entry and the gate would stay unsatisfiable forever. The two
 *   requests carry different request profiles, so they never dedupe into one.
 * - A failed verification keeps the fast-read state and still returns, so the
 *   caller can fall back to an explicit scope instead of dead-ending.
 * - Returns `null` when the actor school moved on while a read was in flight
 *   (late-response discard).
 */
export async function resolveActiveTermAuthority(
	actorSchoolId: number,
	isObsolete: () => boolean,
	options: ResolveActiveTermAuthorityOptions = {},
): Promise<ActiveTermAuthorityResolution | null> {
	const requireFreshVerifiedRead = options.requireFreshVerifiedRead === true;
	const context = await resolveActiveSchoolYearContext({
		schoolId: actorSchoolId,
		// Prefer cached school-year immediately so the surface doesn't block
		// waiting on a forced upstream verification on every navigation.
		preferCache: true,
		backgroundRefresh: true,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
	});
	// Discard a late response whose actor school changed while it was in flight.
	if (isObsolete()) return null;

	let current = context;
	let authorityReady = isVerifiedOrderedActiveTerm(current.activeTerm);
	let verifyUpstreamRequested = false;
	// A caller that WRITES on this term must never accept a cached term, so
	// `requireFreshVerifiedRead` makes the fast read unable to satisfy the gate
	// and the fresh verified read always follows.
	if (!authorityReady || requireFreshVerifiedRead) {
		try {
			verifyUpstreamRequested = true;
			const verified = await resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				// Bypasses the fresh-cache short-circuit: a fresh but UNVERIFIED
				// cache entry would otherwise satisfy this call without ever
				// dispatching, and the gate would stay unsatisfiable.
				forceRefresh: true,
				verifyUpstream: true,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			if (isObsolete()) return null;
			current = verified;
			authorityReady = isVerifiedOrderedActiveTerm(current.activeTerm);
		} catch {
			// Keep the fast-read state. The caller falls back to an explicit
			// scope rather than dead-ending.
		}
	}
	return { context: current, authorityReady, verifyUpstreamRequested };
}
