/**
 * Scope-bound request epochs for the Teaching Load workspace.
 *
 * A response from an obsolete scope (school/year change, actor-school change,
 * re-login) must never overwrite current state. Instead of sprinkling ad-hoc
 * booleans, callers open a new epoch whenever the authoritative scope changes
 * and capture the token at dispatch time.
 *
 * Pure and dependency-free so the discard semantics can be proven directly.
 */

export type ScopeEpoch = {
	/** The epoch currently in force. */
	readonly current: number;
	/**
	 * Invalidate every in-flight request and return the new epoch token. Call
	 * this on school/year/actor changes and before any manual refresh that makes
	 * earlier responses obsolete.
	 */
	begin(): number;
	/** True when `token` still belongs to the epoch in force. */
	isCurrent(token: number): boolean;
};

export function createScopeEpoch(initial = 0): ScopeEpoch {
	let epoch = initial;
	return {
		get current() {
			return epoch;
		},
		begin() {
			epoch += 1;
			return epoch;
		},
		isCurrent(token: number) {
			return token === epoch;
		},
	};
}

/**
 * Guard an async operation: returns a function that reports whether the token
 * captured before dispatch is still current when the response arrives.
 */
export function captureEpoch(epoch: ScopeEpoch): () => boolean {
	const token = epoch.current;
	return () => epoch.isCurrent(token);
}
