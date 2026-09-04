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
	| 'start-draft'
	| 'generate'
	| 'generating'
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
};

export type SimpleLifecycleAction = {
	kind: SimpleLifecycleKind;
	label: string;
	disabled: boolean;
	interactive: boolean;
};

export function deriveSimpleLifecycleAction(input: SimpleLifecycleInput): SimpleLifecycleAction {
	if (input.generating) {
		return { kind: 'generating', label: 'Generating…', disabled: true, interactive: false };
	}
	if (input.isPreGeneration) {
		return { kind: 'generate', label: 'Generate when ready', disabled: false, interactive: true };
	}
	if (!input.hasGeneratedRun) {
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
	| { kind: 'auto-commit' }
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
	if (input.preview.softViolations.length > 0) return { kind: 'review-soft', softCount: input.preview.softViolations.length };
	return { kind: 'auto-commit' };
}
