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
 * Rows ATLAS had to fill: the evaluated plan's covered + uncovered rows, else
 * the kept + created + unresolved counts. Null when there is no result.
 */
export function suggestionDemandRowCount(result: {
	preserved?: number;
	created?: number;
	unresolved?: number;
	distribution?: { summary: { coveredRows: number; uncoveredRows: number } } | null;
} | null | undefined): number | null {
	if (!result) return null;
	if (result.distribution) return result.distribution.summary.coveredRows + result.distribution.summary.uncoveredRows;
	return (result.preserved ?? 0) + (result.created ?? 0) + (result.unresolved ?? 0);
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
