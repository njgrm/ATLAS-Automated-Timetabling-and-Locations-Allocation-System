import type {
	TeachingLoadDistribution,
	TeachingLoadReconciliationActionType,
	TeachingLoadReconciliationPreview,
	TeachingLoadReconciliationReadiness,
} from '@/types';

/**
 * Pure helpers for the Teaching Load reconciliation panel (TL-C02).
 * Every derived value is data-driven; the UI never recomputes workload policy
 * or department identity from local constants.
 */

export const RECONCILIATION_ACTION_LABELS: Record<TeachingLoadReconciliationActionType, string> = {
	RETAIN: 'Stays',
	INSERT: 'Added',
	MOVE: 'Moved',
	RETIRE: 'Removed',
	UNRESOLVED: 'Needs review',
};

export function reconciliationActionLabel(action: TeachingLoadReconciliationActionType): string {
	return RECONCILIATION_ACTION_LABELS[action] ?? action;
}

export function formatTeachingMinutes(minutes: number): string {
	const hours = minutes / 60;
	return `${hours.toFixed(1)}h`;
}

export function formatStatusLabel(status: string, policyConfigured: boolean): string {
	switch (status) {
		case 'zero-load':
			return 'No teaching load';
		case 'adviser-only':
			return 'Adviser only';
		case 'below-standard':
			return 'Below standard';
		case 'at-standard':
			return 'At standard';
		case 'excess':
			return 'Excess teaching';
		case 'over-cap':
			return 'Over hard cap';
		default:
			return policyConfigured ? status : 'Below standard';
	}
}

export function deriveReconciliationSummaries(preview: TeachingLoadReconciliationPreview): {
	actionCounts: Record<TeachingLoadReconciliationActionType, number>;
	before: TeachingLoadDistribution;
	after: TeachingLoadDistribution;
	adviserSatisfied: number;
	adviserUnsatisfied: number;
	unresolvedReasons: Array<{ reason: string; count: number }>;
	departmentState: { status: string; aliasRows: number; labelRows: number };
} {
	const actionCounts: Record<TeachingLoadReconciliationActionType, number> = { RETAIN: 0, INSERT: 0, MOVE: 0, RETIRE: 0, UNRESOLVED: 0 };
	for (const entry of preview.actions) {
		actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1;
	}

	const unresolvedReasons = new Map<string, number>();
	for (const entry of preview.actions) {
		if (entry.action !== 'UNRESOLVED' || !entry.unresolvedReason) continue;
		unresolvedReasons.set(entry.unresolvedReason, (unresolvedReasons.get(entry.unresolvedReason) ?? 0) + 1);
	}

	const adviserSatisfied = preview.adviserPreference.filter((outcome) => outcome.satisfied).length;
	const adviserUnsatisfied = preview.adviserPreference.length - adviserSatisfied;

	return {
		actionCounts,
		before: preview.before.distribution,
		after: preview.after.distribution,
		adviserSatisfied,
		adviserUnsatisfied,
		unresolvedReasons: Array.from(unresolvedReasons.entries())
			.map(([reason, count]) => ({ reason, count }))
			.sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
		departmentState: {
			status: preview.departmentAuthority.status,
			aliasRows: preview.departmentAuthority.aliasRows,
			labelRows: preview.departmentAuthority.labelRows,
		},
	};
}

export function reconciliationApplyDisabledReason(args: {
	preview: TeachingLoadReconciliationPreview | null;
	applyDisabled: boolean;
	applyLoading: boolean;
	confirmation: string;
	online: boolean;
	writable: boolean;
}): string | null {
	if (!args.preview) return 'Preview the reconciliation before applying it.';
	if (args.applyLoading) return 'ATLAS is applying the reconciliation now.';
	if (!args.online) return 'Applying is disabled while ATLAS is offline.';
	if (!args.writable) return 'ATLAS must verify writable Teaching Load data before applying.';
	if (args.preview.authorizesMutation) return 'This preview authorizes a mutation and cannot be applied directly.';
	if (args.applyDisabled) return 'The preview did not change; there is nothing to apply.';
	if (args.confirmation.trim() !== args.preview.confirmationText) return `Type the exact confirmation to enable Apply.`;
	return null;
}

export function readinessChipState(readiness: TeachingLoadReconciliationReadiness | null, loading: boolean): { label: string; tone: 'ok' | 'warn' | 'muted' } {
	if (loading) return { label: 'Checking coverage…', tone: 'muted' };
	if (!readiness) return { label: 'Coverage unavailable', tone: 'muted' };
	if (readiness.ready) return { label: `Coverage ready (${readiness.ownedDemandCount}/${readiness.demandCount})`, tone: 'ok' };
	if (readiness.blockers.length > 0) {
		return { label: readiness.blockers[0].message, tone: 'warn' };
	}
	return { label: `Coverage needs work (${readiness.ownedDemandCount}/${readiness.demandCount})`, tone: 'warn' };
}