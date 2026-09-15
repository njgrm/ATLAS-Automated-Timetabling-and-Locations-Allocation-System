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

/**
 * Concise, scheduler-facing reason copy. One terse line per candidate class —
 * never a raw enum/code wall. `detail` is shown on demand (tooltip), while
 * `label` is the always-visible primary explanation.
 *
 * Producer parity: every reason emitted by
 * `atlas-server/src/services/teaching-load-automation.service.ts`
 * (`TeachingLoadCandidateRejectionReason`) MUST have an entry here. The
 * `INACTIVE_FACULTY` / `WRONG_SCHOOL` / `DEPARTMENT_RESTRICTED` / `UNAVAILABLE` /
 * `STALE_AUTHORITY` rows are operator-mandated R5 vocabulary kept as reserved,
 * defensive copy — they are NOT currently emitted by the producer, so this map
 * is intentionally larger than the producer union.
 */
export const CANDIDATE_REJECTION_LABELS: Record<TeachingLoadCandidateRejectionReason, string> = {
	PROGRAM_SCOPE_INCOMPATIBLE: 'Not in this program',
	NOT_QUALIFIED: 'Not qualified for this subject',
	HARD_CAP_EXCEEDED: 'Already at the weekly maximum',
	CURRENT_OWNER: 'Already owns this class',
	PLACEHOLDER_FACULTY: 'Temporary substitute, not a real teacher',
	OUTSIDE_CANONICAL_DEMAND: 'Not part of current-year demand',
	// Reserved R5 vocabulary (not currently emitted by the producer).
	INACTIVE_FACULTY: 'Not active for scheduling',
	WRONG_SCHOOL: 'Assigned to another school',
	DEPARTMENT_RESTRICTED: 'Outside this subject department',
	UNAVAILABLE: 'Marked unavailable',
	STALE_AUTHORITY: 'Teacher data is out of date',
};

/** One-sentence explanation shown on demand for a grouped reason. */
export const CANDIDATE_REJECTION_DETAILS: Record<TeachingLoadCandidateRejectionReason, string> = {
	PROGRAM_SCOPE_INCOMPATIBLE: 'The subject is offered only in a program this teacher is not part of.',
	NOT_QUALIFIED: 'The teacher has no persisted qualification or specialization for this subject.',
	HARD_CAP_EXCEEDED: 'Adding this class would push the teacher above the weekly maximum.',
	CURRENT_OWNER: 'This teacher already holds the class, so no new assignment is needed.',
	PLACEHOLDER_FACULTY: 'Temporary substitute rows are not offered as real Teaching Load owners.',
	OUTSIDE_CANONICAL_DEMAND: 'This class is outside the canonical current-year derived demand, so no load was moved to it.',
	// Reserved R5 vocabulary (not currently emitted by the producer).
	INACTIVE_FACULTY: 'The teacher is not active for scheduling in the current school year.',
	WRONG_SCHOOL: 'The teacher belongs to a different school than the active scope.',
	DEPARTMENT_RESTRICTED: 'The subject is restricted to a department this teacher is not part of.',
	UNAVAILABLE: 'The teacher is marked unavailable for the affected load.',
	STALE_AUTHORITY: 'The teacher record changed since this preview was prepared; refresh before applying.',
};

/**
 * Canonical, deterministic display order for grouped reasons. Must contain every
 * producer reason; the producer-parity control fails if a new emitted reason is
 * added without an entry here.
 */
export const CANDIDATE_REJECTION_ORDER: TeachingLoadCandidateRejectionReason[] = [
	'PROGRAM_SCOPE_INCOMPATIBLE',
	'NOT_QUALIFIED',
	'DEPARTMENT_RESTRICTED',
	'OUTSIDE_CANONICAL_DEMAND',
	'HARD_CAP_EXCEEDED',
	'CURRENT_OWNER',
	'INACTIVE_FACULTY',
	'WRONG_SCHOOL',
	'UNAVAILABLE',
	'STALE_AUTHORITY',
	'PLACEHOLDER_FACULTY',
];

/**
 * Sentinel for a rejection reason this client build does not describe. It exists
 * so `summarizeCandidateRejections` can never silently drop a row: unmatched
 * reasons are grouped here with safe copy instead of a raw enum code.
 */
export const UNKNOWN_REJECTION_REASON = 'UNKNOWN_REASON' as const;

const FALLBACK_REJECTION_LABEL = 'Not eligible for this class';
const FALLBACK_REJECTION_DETAIL =
	'ATLAS skipped this teacher for a reason this version does not describe. Refresh the source before applying.';

/** Fallback copy for an unmatched/unknown reason group. */
export function describeUnknownRejection(): { label: string; detail: string } {
	return { label: FALLBACK_REJECTION_LABEL, detail: FALLBACK_REJECTION_DETAIL };
}

export type CandidateRejectionGroupReason =
	| TeachingLoadCandidateRejectionReason
	| typeof UNKNOWN_REJECTION_REASON;

export type CandidateRejectionGroup = {
	reason: CandidateRejectionGroupReason;
	label: string;
	/** On-demand one-sentence explanation (tooltip), never the primary copy. */
	detail: string;
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
 *
 * Invariant: a row is NEVER dropped. Unmatched/unknown reasons are grouped under
 * `UNKNOWN_REJECTION_REASON` with safe copy, so
 * `sum(group.count) === totalCandidateRejections(rejections)` always holds. That
 * prevents an operator from seeing "N skipped" with fewer than N explanations.
 */
export function summarizeCandidateRejections(
	rejections: TeachingLoadCandidateRejection[] | undefined | null,
): CandidateRejectionGroup[] {
	const list = asRejectionList(rejections);
	const groups: CandidateRejectionGroup[] = [];
	const knownReasons = new Set<string>(CANDIDATE_REJECTION_ORDER);
	const collectNames = (rows: TeachingLoadCandidateRejection[]): string[] => {
		const names: string[] = [];
		for (const row of rows) {
			const name = row.facultyName?.trim();
			if (!name || names.includes(name)) continue;
			names.push(name);
			if (names.length >= MAX_GROUP_NAMES) break;
		}
		return names;
	};
	for (const reason of CANDIDATE_REJECTION_ORDER) {
		const rows = list.filter((row) => row.reason === reason);
		if (rows.length === 0) continue;
		groups.push({
			reason,
			label: CANDIDATE_REJECTION_LABELS[reason],
			detail: CANDIDATE_REJECTION_DETAILS[reason],
			count: rows.length,
			facultyNames: collectNames(rows),
		});
	}
	const unmatched = list.filter((row) => !knownReasons.has(row.reason as unknown as string));
	if (unmatched.length > 0) {
		const fallback = describeUnknownRejection();
		groups.push({
			reason: UNKNOWN_REJECTION_REASON,
			label: fallback.label,
			detail: fallback.detail,
			count: unmatched.length,
			facultyNames: collectNames(unmatched),
		});
	}
	return groups;
}

/** Safe lookup so an unknown/legacy reason never renders a raw code. */
export function describeCandidateRejection(reason: TeachingLoadCandidateRejectionReason): { label: string; detail: string } {
	return {
		label: CANDIDATE_REJECTION_LABELS[reason] ?? FALLBACK_REJECTION_LABEL,
		detail: CANDIDATE_REJECTION_DETAILS[reason] ?? FALLBACK_REJECTION_DETAIL,
	};
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
