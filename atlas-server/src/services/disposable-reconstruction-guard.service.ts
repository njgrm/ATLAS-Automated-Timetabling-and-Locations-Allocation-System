/**
 * Disposable reconstruction target guard (05AR correction, DBR-05AR.1/2).
 *
 * Single authority for which PostgreSQL database the narrow disposable
 * reconstruction entry point may touch. Extracted from
 * `scripts/reconstruct-disposable-baseline.ts` so the guard logic is
 * unit-testable without executing reconstruction (that script runs `main()`
 * on import and must never be imported by tests).
 *
 * The guard accepts EXACTLY one database:
 * `atlas_recovery_clean_rebuild_20260905` (the 05AR primary target).
 * Everything else — `atlas_db`, the quarantined cutover candidate, the
 * `_b` secondary target, shadow databases, and unknown names — is refused
 * with a `TARGET_GUARD` error before any write.
 */

export const GUARDED_PRIMARY_TARGET = 'atlas_recovery_clean_rebuild_20260905';

const PROTECTED_TARGET_NAMES = new Set([
	'atlas_db',
	'atlas_recovery_cutover_candidate',
	'atlas_recovery_clean_rebuild_20260905_b',
]);

export function targetDbNameFromUrl(databaseUrl: string): string {
	const match = (databaseUrl ?? '').match(/\/([^/?]+)(\?|$)/);
	if (!match) throw new Error('TARGET_GUARD: cannot parse database name from DATABASE_URL');
	return match[1]!;
}

export function assertGuardedPrimaryTarget(target: string): void {
	if (target !== GUARDED_PRIMARY_TARGET) {
		const reason = PROTECTED_TARGET_NAMES.has(target) ? 'protected target' : 'unknown target';
		throw new Error(
			`TARGET_GUARD: refusing ${reason} "${target}"; this entry point only reconstructs "${GUARDED_PRIMARY_TARGET}"`,
		);
	}
}
