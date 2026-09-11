/**
 * RR-TERM-CACHE-C01R — pure actor-scope/lifecycle logic for the narrow
 * term-authority repair dialog.
 *
 * The dialog is a privileged, actor-school-scoped operator action. This module
 * keeps the two hard rules testable without a DOM:
 *
 *  1. While the actor school is unresolved (or not a strict positive integer),
 *     the repair workflow dispatches no request and cannot be submitted.
 *  2. An actor-school change is authoritative: a preview, confirmation, error,
 *     or pending apply from the previous school is discarded. A preview that
 *     resolves late for the previous school must never become submittable.
 */

import type { TermCachePreviewResult } from '@/lib/settings';

export type TermRepairScopeState = {
	/** The actor school the current preview/confirmation belongs to. */
	scopeSchoolId: number | null;
	dialogOpen: boolean;
	preview: TermCachePreviewResult | null;
	confirmationText: string;
	error: string | null;
	applying: boolean;
};

export function initialTermRepairScopeState(): TermRepairScopeState {
	return {
		scopeSchoolId: null,
		dialogOpen: false,
		preview: null,
		confirmationText: '',
		error: null,
		applying: false,
	};
}

/** Strict positive-integer actor-school guard shared by every dispatch site. */
export function isResolvedActorSchoolId(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Actor-school change (or scope loss) clears the entire repair lifecycle. The
 * returned state is identical regardless of the previous school, so no preview,
 * confirmation, error, or pending apply can survive into the new scope.
 */
export function resetTermRepairForScope(_state: TermRepairScopeState, _nextSchoolId: number | null): TermRepairScopeState {
	return initialTermRepairScopeState();
}

/** Bind a preview to the school that produced it and open the dialog. */
export function bindTermRepairPreview(
	_state: TermRepairScopeState,
	schoolId: number,
	preview: TermCachePreviewResult,
): TermRepairScopeState {
	return {
		scopeSchoolId: isResolvedActorSchoolId(schoolId) ? schoolId : null,
		dialogOpen: true,
		preview,
		confirmationText: '',
		error: null,
		applying: false,
	};
}

/**
 * A late-arriving preview response is only accepted when the actor school is
 * still the one that requested it; otherwise it is dropped.
 */
export function acceptTermRepairPreview(
	currentSchoolId: unknown,
	requestSchoolId: number,
): boolean {
	return isResolvedActorSchoolId(currentSchoolId) && currentSchoolId === requestSchoolId;
}

/** A stale preview belongs to a different school than the current actor scope. */
export function isTermRepairPreviewStale(state: TermRepairScopeState, currentSchoolId: number): boolean {
	if (!state.preview) return false;
	if (!isResolvedActorSchoolId(currentSchoolId)) return true;
	return state.preview.schoolId !== currentSchoolId || state.scopeSchoolId !== currentSchoolId;
}

/**
 * Submit gate for the repair dialog's Save action. Requires a strict positive
 * current school, a preview bound to that same school, and an exact confirmation
 * match. A stale school-1 preview can never pass after switching to school 2.
 */
export function isTermRepairPreviewApplicable(
	state: TermRepairScopeState,
	currentSchoolId: number,
	confirmationText: string,
): boolean {
	if (state.applying) return false;
	if (!isResolvedActorSchoolId(currentSchoolId)) return false;
	if (!state.preview) return false;
	if (state.preview.schoolId !== currentSchoolId) return false;
	if (state.scopeSchoolId !== currentSchoolId) return false;
	return confirmationText === state.preview.confirmationText;
}
