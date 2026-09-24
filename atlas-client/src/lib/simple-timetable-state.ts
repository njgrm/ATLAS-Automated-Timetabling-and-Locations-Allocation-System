export type SimplePlacementState = {
	displayedKey: string | null;
	armed: { key: string; sectionId: number } | null;
};

export type SimplePlacementEvent =
	| { type: 'display'; key: string | null }
	| { type: 'arm'; key: string; sectionId: number }
	| { type: 'skip'; nextKey: string | null }
	| { type: 'invalidate'; validKeys: Set<string> }
	| { type: 'same-slot' | 'failure' }
	| { type: 'success' | 'reset' };

export const initialSimplePlacementState: SimplePlacementState = {
	displayedKey: null,
	armed: null,
};

export function reduceSimplePlacementState(
	state: SimplePlacementState,
	event: SimplePlacementEvent,
): SimplePlacementState {
	switch (event.type) {
		case 'display':
			return { displayedKey: event.key, armed: null };
		case 'arm':
			return { displayedKey: event.key, armed: { key: event.key, sectionId: event.sectionId } };
		case 'skip':
			return { displayedKey: event.nextKey, armed: null };
		case 'invalidate': {
			const displayedKey = state.displayedKey && event.validKeys.has(state.displayedKey)
				? state.displayedKey
				: event.validKeys.values().next().value ?? null;
			const armed = state.armed && event.validKeys.has(state.armed.key) ? state.armed : null;
			return { displayedKey, armed };
		}
		case 'same-slot':
		case 'failure':
			return state;
		case 'success':
		case 'reset':
			return initialSimplePlacementState;
	}
}

export type SimpleLifecycleKind =
	| 'resolve-scope'
	| 'fix-setup'
	| 'start-draft'
	| 'generate'
	| 'generating'
	| 'retry-generate'
	| 'retry-readiness'
	| 'fix-blockers'
	| 'review-warnings'
	| 'publish'
	| 'review-follow-ups'
	| 'published';

export type SimpleLifecycleInput = {
	hasGeneratedRun: boolean;
	isPreGeneration?: boolean;
	generating?: boolean;
	hardCount?: number;
	unassignedCount?: number;
	softCount?: number;
	isPublished?: boolean;
	/** False while the actor school/year scope is still unresolved. No
	 * timetable request may be treated as actionable in that state. */
	scopeResolved?: boolean;
	/** Setup/term authority gate: 'blocked' means setup inputs are not
	 * ready and generation must not be offered as the next action. The repair
	 * destination is the Year Setup surface, never the superseded curriculum
	 * requirements page. */
	curriculumState?: 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed';
	/** True when the newest run failed and no generated run is reviewable. */
	latestRunFailed?: boolean;
};

export type SimpleLifecycleAction = {
	kind: SimpleLifecycleKind;
	label: string;
	disabled: boolean;
	interactive: boolean;
};

export function deriveSimpleLifecycleAction(input: SimpleLifecycleInput): SimpleLifecycleAction {
	// Unresolved actor/school/year scope: nothing below is actionable and no
	// timetable request should be treated as in flight.
	if (input.scopeResolved === false) {
		return { kind: 'resolve-scope', label: 'Check school scope', disabled: true, interactive: false };
	}
	if (input.generating) {
		return { kind: 'generating', label: 'Generating…', disabled: true, interactive: false };
	}
	if (input.curriculumState === 'loading') {
		return { kind: 'retry-readiness', label: 'Checking schedule information…', disabled: true, interactive: false };
	}
	if (input.curriculumState === 'unavailable' || input.curriculumState === 'failed') {
		return { kind: 'retry-readiness', label: 'Retry schedule check', disabled: false, interactive: true };
	}
	// Setup inputs blocked: the single next action is repairing setup on the
	// Year Setup surface, never generation or publish.
	if (input.curriculumState === 'blocked') {
		return { kind: 'fix-setup', label: 'Open Year Setup', disabled: false, interactive: true };
	}
	if (input.isPreGeneration) {
		return { kind: 'generate', label: 'Generate when ready', disabled: false, interactive: true };
	}
	if (!input.hasGeneratedRun) {
		// A failed newest run is history, not a reviewable timetable: the next
		// action is an explicit retry, never publish or review.
		if (input.latestRunFailed) {
			return { kind: 'retry-generate', label: 'Try generating again', disabled: false, interactive: true };
		}
		return { kind: 'start-draft', label: 'Start draft', disabled: false, interactive: true };
	}
	if (input.isPublished) {
		if ((input.unassignedCount ?? 0) > 0) {
			return { kind: 'review-follow-ups', label: 'Review follow-ups', disabled: false, interactive: true };
		}
		return { kind: 'published', label: 'Published', disabled: true, interactive: false };
	}
	if ((input.hardCount ?? 0) > 0 || (input.unassignedCount ?? 0) > 0) {
		return { kind: 'fix-blockers', label: 'Fix blockers', disabled: false, interactive: true };
	}
	if ((input.softCount ?? 0) > 0) {
		return { kind: 'review-warnings', label: 'Review warnings', disabled: false, interactive: true };
	}
	return { kind: 'publish', label: 'Publish schedule', disabled: false, interactive: true };
}

export type SimpleInteractionMode =
	| 'browsing'
	| 'placing'
	| 'moving'
	| 'swapping-select-first'
	| 'swapping-select-second'
	| 'changing-teacher'
	| 'reconciling'
	| 'reviewing-exception';

export type SimpleOperationResult = 'idle' | 'checking' | 'clean' | 'warning' | 'blocked' | 'saving' | 'saved' | 'failed';

export type SimpleInteractionState = {
	mode: SimpleInteractionMode;
	result: SimpleOperationResult;
	sourceKey: string | null;
	focusReturn: string | null;
};

export const initialSimpleInteractionState: SimpleInteractionState = {
	mode: 'browsing',
	result: 'idle',
	sourceKey: null,
	focusReturn: null,
};

export type SimpleInteractionEvent =
	| { type: 'select'; mode: Exclude<SimpleInteractionMode, 'browsing'>; sourceKey: string; focusReturn: string | null }
	| { type: 'change-mode'; mode: SimpleInteractionMode }
	| { type: 'result'; result: SimpleOperationResult }
	| { type: 'cancel' | 'context-invalidated' };

export function reduceSimpleInteractionState(
	state: SimpleInteractionState,
	event: SimpleInteractionEvent,
): SimpleInteractionState {
	switch (event.type) {
		case 'select':
			return { mode: event.mode, result: 'idle', sourceKey: event.sourceKey, focusReturn: event.focusReturn };
		case 'change-mode':
			return { ...initialSimpleInteractionState, mode: event.mode };
		case 'result':
			return event.result === 'saved'
				? initialSimpleInteractionState
				: { ...state, result: event.result };
		case 'cancel':
		case 'context-invalidated':
			return initialSimpleInteractionState;
	}
}

export type OperationViolation = {
	identity: string;
	severity: 'HARD' | 'SOFT';
};

export type SimpleOperationDecision = 'clean' | 'warning' | 'blocked' | 'swap';

function violationMultiset(violations: OperationViolation[]): Map<string, { hard: number; soft: number }> {
	const counts = new Map<string, { hard: number; soft: number }>();
	for (const violation of violations) {
		const count = counts.get(violation.identity) ?? { hard: 0, soft: 0 };
		if (violation.severity === 'HARD') count.hard += 1;
		else count.soft += 1;
		counts.set(violation.identity, count);
	}
	return counts;
}

export function classifySimpleOperation(input: {
	before: OperationViolation[];
	after: OperationViolation[];
	occupiedTarget?: boolean;
}): SimpleOperationDecision {
	if (input.occupiedTarget) return 'swap';
	const before = violationMultiset(input.before);
	const after = violationMultiset(input.after);
	let introducedHardCount = 0;
	let introducedSoft = false;
	for (const [identity, next] of after) {
		const prior = before.get(identity) ?? { hard: 0, soft: 0 };
		if (next.hard > prior.hard) introducedHardCount += next.hard - prior.hard;
		const downgradedHardCount = Math.max(0, prior.hard - next.hard);
		if (next.soft > prior.soft + downgradedHardCount) introducedSoft = true;
	}
	const removedHardCount = Array.from(before.entries()).reduce((sum, [identity, prior]) => {
		if (after.has(identity)) return sum;
		return sum + prior.hard;
	}, 0);
	const netIntroducedHard = introducedHardCount - Math.min(introducedHardCount, removedHardCount);
	if (netIntroducedHard > 0) return 'blocked';
	return introducedSoft ? 'warning' : 'clean';
}

export type ReconciliationReason =
	| 'TEACHING_LOAD_CHANGED'
	| 'SUBJECT_CHANGED'
	| 'SECTION_CHANGED'
	| 'ROOM_CHANGED'
	| 'TIME_WINDOW_CHANGED'
	| 'POLICY_CHANGED';

export type ReconciliationOutcome = 'unchanged' | 'updated-in-place' | 'returned-to-unassigned';

export function classifyReconciliationChange(input: {
	reason: ReconciliationReason;
	valid: boolean;
	affected: boolean;
}): { reason: ReconciliationReason; outcome: ReconciliationOutcome } {
	return {
		reason: input.reason,
		outcome: !input.affected ? 'unchanged' : input.valid ? 'updated-in-place' : 'returned-to-unassigned',
	};
}

export type AutoSaveEligibilityInput = {
	hasFacultyOwner: boolean;
	resolvedRoomId: number | null;
	targetSlotOccupied: boolean;
	preview: { allowed: boolean; hardViolations: { length: number }; softViolations: { length: number } } | null;
	forceReview?: boolean;
};

export type AutoSaveDecision =
	| { kind: 'preview-confirm'; softCount: number }
	| { kind: 'review-soft'; softCount: number }
	| { kind: 'review-blocked'; hardTitle: string | null }
	| { kind: 'review-no-room' }
	| { kind: 'review-occupied' }
	| { kind: 'review-no-owner' }
	| { kind: 'review-no-preview' };

export function decideAutoSavePlacement(input: AutoSaveEligibilityInput): AutoSaveDecision {
	if (!input.hasFacultyOwner) return { kind: 'review-no-owner' };
	if (input.targetSlotOccupied) return { kind: 'review-occupied' };
	if (input.resolvedRoomId == null) return { kind: 'review-no-room' };
	if (input.forceReview) return { kind: 'review-no-room' };
	if (!input.preview) return { kind: 'review-no-preview' };
	if (!input.preview.allowed) return { kind: 'review-blocked', hardTitle: null };
	// B1 — a clean slot no longer commits immediately. It becomes an inline
	// preview with one Confirm, so the consequence is stated before saving.
	if (input.preview.softViolations.length > 0) return { kind: 'review-soft', softCount: input.preview.softViolations.length };
	return { kind: 'preview-confirm', softCount: 0 };
}

/**
 * C8/C9 — where a pre-generation draft drop is confirmed.
 *
 * Baseline: `stagePreGenDrop` opened the `draft-placement-review-dialog`
 * unconditionally, *before* the authoritative preview resolved. A clean slot then
 * rendered the dialog's "Save placement" beside the inline pending bar's
 * "Save placement" — two visible Confirms for one placement, and the dialog's
 * commit captured no Undo target.
 *
 * The inline pending bar already states the consequence and the conflict check,
 * so it is the single Confirm for every ordinary (clean or soft-warned) drop. The
 * detailed dialog is reserved for the cases the bar cannot state: a slot with hard
 * conflicts, or a drop with no resolved owner / room / preview. Every such case
 * returns `review-dialog`, so nothing blocked can ever reach an inline Confirm.
 */
export type DraftPlacementReviewInput = {
	hasFacultyOwner: boolean;
	hasRoom: boolean;
	/**
	 * `undefined` — the authoritative preview has not been requested yet.
	 * `null` — the preview was requested and is unavailable (transport or
	 * validation failure). Both fail closed; only a resolved, clean preview
	 * (`allowed` and no hard violations) confirms inline.
	 */
	preview?: { allowed: boolean; hardViolations: { length: number }; softViolations: { length: number } } | null;
};

export type DraftPlacementReviewDecision =
	| { kind: 'pending' }
	| { kind: 'inline-confirm'; softCount: number }
	| { kind: 'review-dialog'; reason: 'no-owner' | 'no-room' | 'no-preview' | 'blocked' };

export function decideDraftPlacementReview(input: DraftPlacementReviewInput): DraftPlacementReviewDecision {
	if (!input.hasFacultyOwner) return { kind: 'review-dialog', reason: 'no-owner' };
	if (!input.hasRoom) return { kind: 'review-dialog', reason: 'no-room' };
	if (input.preview === undefined) return { kind: 'pending' };
	if (input.preview === null) return { kind: 'review-dialog', reason: 'no-preview' };
	if (!input.preview.allowed || input.preview.hardViolations.length > 0) return { kind: 'review-dialog', reason: 'blocked' };
	return { kind: 'inline-confirm', softCount: input.preview.softViolations.length };
}
