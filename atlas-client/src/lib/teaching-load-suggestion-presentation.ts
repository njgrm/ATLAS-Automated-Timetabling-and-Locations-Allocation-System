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
};

export function resolveSuggestionPreviewState(input: SuggestionPreviewStateInput): SuggestionPreviewState {
	if (input.reviewOnly) return 'review-only';
	if (!input.hasResult) return 'loading';
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
	'shortage',
	'imbalance',
	'unevaluated',
];
