/**
 * Presentation authority for the Teaching Load suggestion preview.
 *
 * This is the single source of truth for which state the review dialog is in.
 * It is deliberately pure so the state machine can be proven without a DOM:
 * a proposal that has not been evaluated must NEVER resolve to `balanced`.
 *
 * `balanced` is only reachable when a distribution plan exists AND it was
 * evaluated AND it reports balanced. `distribution` absent, or
 * `distributionEvaluated === false`, is `unevaluated` — never a success state.
 */

export type SuggestionPreviewState =
	| 'review-only'
	| 'loading'
	| 'no-demand'
	| 'shortage'
	| 'imbalance'
	| 'unevaluated'
	| 'balanced';

export type SuggestionPreviewStateInput = {
	reviewOnly?: boolean;
	hasResult: boolean;
	hasShortage: boolean;
	/** True only when a distribution plan exists and was actually evaluated. */
	distributionEvaluated: boolean;
	/** The evaluated plan's own balanced verdict. Ignored when unevaluated. */
	balanced: boolean;
	/**
	 * Subject-section rows ATLAS had to fill for this year. Zero means nothing
	 * was found to fill, which must never read as "covers all rows and is
	 * balanced" (hotfix 2026-09-28). Omitted/null = unknown.
	 */
	demandRowCount?: number | null;
};

export const NO_DEMAND_DESCRIPTION = 'ATLAS found no classes to fill for this school year. Check that subjects are set up for its grades.';

/**
 * Rows ATLAS had to fill. Null when there is no result.
 *
 * Hotfix 2026-09-29: the plan's `coveredRows`/`uncoveredRows` count only rows
 * that were ALREADY saved (kept) or left unresolved. In a brand-new year both
 * are 0 while the plan inserts 239 rows and proposes 25 substitutes, so that
 * sum alone read as "no classes to fill". Demand is the largest of: the plan's
 * kept + uncovered + inserts, the kept + created + unresolved counts, and the
 * proposed rows. It is 0 only when every one of them is 0.
 */
export function suggestionDemandRowCount(result: {
	preserved?: number;
	created?: number;
	unresolved?: number;
	suggestedRows?: unknown[] | null;
	distribution?: { inserts?: unknown[] | null; summary: { coveredRows: number; uncoveredRows: number } } | null;
} | null | undefined): number | null {
	if (!result) return null;
	const fromPlan = result.distribution
		? result.distribution.summary.coveredRows + result.distribution.summary.uncoveredRows + (result.distribution.inserts?.length ?? 0)
		: 0;
	const fromCounts = (result.preserved ?? 0) + (result.created ?? 0) + (result.unresolved ?? 0);
	const fromRows = result.suggestedRows?.length ?? 0;
	return Math.max(fromPlan, fromCounts, fromRows);
}

function classesWord(count: number): string {
	return `${count} class${count === 1 ? '' : 'es'}`;
}

/**
 * Plain note for classes that will not get a saved real teacher. Temporary
 * substitute rows are shown in the preview but never saved, so after apply
 * they are exactly the classes "still without a teacher".
 */
export function stillNeedRealTeacherNote(substituteRows: number, unresolvedRows: number): string {
	const count = Math.max(0, substituteRows) + Math.max(0, unresolvedRows);
	if (count === 0) return ' 0 rows remain unresolved.';
	return ` ${classesWord(count)} still need${count === 1 ? 's' : ''} a real teacher.`;
}

/** Toast/status line after a suggestion is applied. */
export function appliedSuggestionMessage(stillNeedTeacherCount: number): string {
	if (stillNeedTeacherCount > 0) {
		return `Teaching Load saved. ${classesWord(stillNeedTeacherCount)} still need${stillNeedTeacherCount === 1 ? 's' : ''} a real teacher.`;
	}
	return 'Suggested Teaching Load applied. Review the saved load before creating the timetable.';
}

export function resolveSuggestionPreviewState(input: SuggestionPreviewStateInput): SuggestionPreviewState {
	if (input.reviewOnly) return 'review-only';
	if (!input.hasResult) return 'loading';
	if (input.demandRowCount === 0 && !input.hasShortage) return 'no-demand';
	if (input.hasShortage) return 'shortage';
	// Order matters: an unevaluated plan is never allowed to report imbalance OR
	// balance. Only an evaluated plan may carry a balance verdict at all.
	if (!input.distributionEvaluated) return 'unevaluated';
	return input.balanced ? 'balanced' : 'imbalance';
}

/** States that represent a successful, actionable balance outcome. */
export const SAFE_SUGGESTION_STATES: SuggestionPreviewState[] = ['balanced'];

/** States that must never be presented as complete/safe. */
export const UNSAFE_SUGGESTION_STATES: SuggestionPreviewState[] = [
	'loading',
	'no-demand',
	'shortage',
	'imbalance',
	'unevaluated',
];
