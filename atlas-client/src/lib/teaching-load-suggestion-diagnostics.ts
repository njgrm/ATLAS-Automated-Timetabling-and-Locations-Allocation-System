/**
 * TL-SUGGESTION-C03R client helpers for Teaching Load candidate diagnostics.
 *
 * Turns the bounded, stable `candidateRejections` returned by the suggestion
 * preview into a compact, human-readable summary. The modal renders this as a
 * small shadcn/Radix panel instead of a raw log so a scheduler can see why a
 * visible (often zero-load) teacher was or was not selected.
 *
 * Pure functions only — no React, no network.
 */

import type { TeachingLoadCandidateRejection, TeachingLoadCandidateRejectionReason } from '@/types';

export const CANDIDATE_REJECTION_LABELS: Record<TeachingLoadCandidateRejectionReason, string> = {
	PROGRAM_SCOPE_INCOMPATIBLE: 'Program scope mismatch',
	NOT_QUALIFIED: 'No persisted qualification',
	HARD_CAP_EXCEEDED: 'At teaching cap',
	CURRENT_OWNER: 'Current owner cannot receive',
	PLACEHOLDER_FACULTY: 'Placeholder faculty',
};

export type CandidateRejectionGroup = {
	reason: TeachingLoadCandidateRejectionReason;
	label: string;
	count: number;
	/** Distinct teacher names, bounded and stable, for a short tooltip/summary. */
	facultyNames: string[];
};

const MAX_GROUP_NAMES = 4;

function asRejectionList(rejections: TeachingLoadCandidateRejection[] | undefined | null): TeachingLoadCandidateRejection[] {
	return Array.isArray(rejections) ? rejections.filter((row): row is TeachingLoadCandidateRejection => Boolean(row)) : [];
}

/**
 * Group rejections by reason in the canonical reason order so the rendered
 * summary is deterministic for identical previews.
 */
export function summarizeCandidateRejections(
	rejections: TeachingLoadCandidateRejection[] | undefined | null,
): CandidateRejectionGroup[] {
	const reasonOrder: TeachingLoadCandidateRejectionReason[] = [
		'PROGRAM_SCOPE_INCOMPATIBLE',
		'NOT_QUALIFIED',
		'HARD_CAP_EXCEEDED',
		'CURRENT_OWNER',
		'PLACEHOLDER_FACULTY',
	];
	const list = asRejectionList(rejections);
	const groups: CandidateRejectionGroup[] = [];
	for (const reason of reasonOrder) {
		const rows = list.filter((row) => row.reason === reason);
		if (rows.length === 0) continue;
		const names: string[] = [];
		for (const row of rows) {
			const name = row.facultyName?.trim();
			if (!name || names.includes(name)) continue;
			names.push(name);
			if (names.length >= MAX_GROUP_NAMES) break;
		}
		groups.push({ reason, label: CANDIDATE_REJECTION_LABELS[reason], count: rows.length, facultyNames: names });
	}
	return groups;
}

/** The distribution plan carries the diagnostics for the plan preview. */
export function candidateRejectionsForResult(result: {
	candidateRejections?: TeachingLoadCandidateRejection[];
	distribution?: { candidateRejections?: TeachingLoadCandidateRejection[] };
} | null | undefined): TeachingLoadCandidateRejection[] {
	if (!result) return [];
	return asRejectionList(result.candidateRejections).length > 0
		? asRejectionList(result.candidateRejections)
		: asRejectionList(result.distribution?.candidateRejections);
}

export function totalCandidateRejections(rejections: TeachingLoadCandidateRejection[] | undefined | null): number {
	return asRejectionList(rejections).length;
}
