import type { TeachingLoadSplitBrainReconcileResult } from '@/types';

/**
 * Determine whether the Teaching Load workspace requires a lock-recovery
 * reconcile action. Returns true when any condition that blocks editing
 * or requires cleanup is present.
 *
 * This replaces the narrow `splitBrainNeedsReconcile` check that only
 * looked at truthRowsToUpdate and integrityOutOfSubjectScopePairs.
 */
export function hasTeachingLoadLockRecoveryAction(
	incident: TeachingLoadSplitBrainReconcileResult | null | undefined,
): boolean {
	if (!incident) return false;

	const q = incident.quarantine;
	const c = incident.counters;
	const rp = incident.repairPreview;

	// Blocking quarantine always requires recovery.
	if (q.required) return true;
	if (q.severity === 'BLOCKING') return true;

	// Specific reason codes that indicate lock-recovery need.
	const codes = q.reasonCodes ?? [];
	if (codes.includes('STALE_OWNERSHIP_PRESENT')) return true;
	if (codes.includes('TRUTH_RECONCILE_PENDING')) return true;
	if (codes.includes('INTEGRITY_MISSING_OWNERSHIP')) return true;
	if (codes.includes('INTEGRITY_OWNERSHIP_WITHOUT_SCOPE')) return true;
	if (codes.includes('INTEGRITY_OUT_OF_SUBJECT_SCOPE')) return true;

	// Counter-based checks.
	if ((c.truthRowsToUpdate ?? 0) > 0) return true;
	if ((c.integrityMissingOwnershipPairs ?? 0) > 0) return true;
	if ((c.integrityOwnershipWithoutScopePairs ?? 0) > 0) return true;
	if ((c.integrityOutOfSubjectScopePairs ?? 0) > 0) return true;
	if ((c.staleOwnedCurrentYearPairs ?? 0) > 0) return true;
	if ((c.loadReviewRows ?? 0) > 0) return true;

	// Repair preview checks.
	if ((rp.staleReconcile.staleOwnedCurrentYearPairCount ?? 0) > 0) return true;
	if ((rp.realFacultyRecovery.placeholderMovesPlanned ?? 0) > 0) return true;

	return false;
}

/**
 * Build a human-readable summary of what the reconcile action will fix.
 */
export function buildLockRecoverySummary(
	incident: TeachingLoadSplitBrainReconcileResult | null | undefined,
): {
	staleOwnershipCount: number;
	loadReviewRows: number;
	missingOwnershipPairs: number;
	ownershipWithoutScopePairs: number;
	outOfSubjectScopePairs: number;
	rowsReconcilable: number;
	rowsNotAutomatic: number;
} {
	if (!incident) {
		return { staleOwnershipCount: 0, loadReviewRows: 0, missingOwnershipPairs: 0, ownershipWithoutScopePairs: 0, outOfSubjectScopePairs: 0, rowsReconcilable: 0, rowsNotAutomatic: 0 };
	}

	const c = incident.counters;
	const rp = incident.repairPreview;

	const staleOwnershipCount = rp.staleReconcile.staleOwnedCurrentYearPairCount ?? c.staleOwnedCurrentYearPairs ?? 0;
	const loadReviewRows = c.loadReviewRows ?? 0;
	const missingOwnershipPairs = c.integrityMissingOwnershipPairs ?? 0;
	const ownershipWithoutScopePairs = c.integrityOwnershipWithoutScopePairs ?? 0;
	const outOfSubjectScopePairs = c.integrityOutOfSubjectScopePairs ?? 0;

	const rowsReconcilable = (rp.truthReconcile.rowsToUpdate ?? 0)
		+ (rp.staleReconcile.staleOwnedCurrentYearPairCount ?? 0)
		+ (rp.realFacultyRecovery.placeholderMovesPlanned ?? 0);

	const rowsNotAutomatic = (rp.realFacultyRecovery.blockerCount ?? 0)
		+ (rp.truthReconcile.rowsWithOutOfSubjectScope ?? 0);

	return {
		staleOwnershipCount,
		loadReviewRows,
		missingOwnershipPairs,
		ownershipWithoutScopePairs,
		outOfSubjectScopePairs,
		rowsReconcilable,
		rowsNotAutomatic,
	};
}
