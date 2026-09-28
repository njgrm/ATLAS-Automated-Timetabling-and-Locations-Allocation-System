/**
 * C11 M3 — which slots in the CURRENT view are legal targets for a move, and what
 * to say when there are none.
 *
 * The recorded defect (`docs/reviews/codex-timetable-walk-20260928/report.md`,
 * defect 4): the operator armed a move and the grid offered no visible target at
 * all. The only feedback was `Already in this slot.` after clicking the class's
 * own cell, which reads as the tool being broken rather than as "there is nowhere
 * legal to put this".
 *
 * The decision is kept here, pure and separate, for two reasons:
 *
 *  - the GRID highlights cells and the STATUS line names the outcome, and they
 *    must never disagree about which slots are legal. One derivation, two
 *    renderers \u2014 the same rule this codebase already applies to run state
 *    (`RunStateBadge`), publication gating, and the undo decision.
 *  - "no legal target in this view" is a fact about the slots on screen, not
 *    about the whole week. It is computed from the same `timeSlots` and
 *    `draftEntries` the grid is already rendering, so it can never claim there
 *    are none when the view is simply scrolled to the wrong day.
 */

export type MoveSlot = {
	day: string;
	startTime: string;
	endTime: string;
	/** A special event row (lunch, health break) is never a move target. */
	isSpecialEvent?: boolean;
	eventName?: string;
};

export type MoveOccupant = {
	entryId: string;
	day: string;
	startTime: string;
	endTime: string;
};

/** The exact sentence M3 requires when nothing in view is legal. One sentence. */
export const NO_LEGAL_TARGET_IN_VIEW = 'No free time slot for this class in this view.';

export function slotKey(day: string, startTime: string): string {
	return `${day}-${startTime}`;
}

/** The same half-open overlap rule the room picker and the grid's conflict lookup use. */
export function slotsOverlap(
	a: { startTime: string; endTime: string },
	b: { startTime: string; endTime: string },
): boolean {
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Every slot in the given view that is a LEGAL target for moving `movingEntryId`.
 *
 * Excluded, each for a stated reason:
 *  - a special-event row (lunch, health break) \u2014 the walk found the operator
 *    clicking one and being told nothing useful;
 *  - the class's OWN current slot \u2014 clicking it is the recorded
 *    `Already in this slot.` case, and offering it as a target would be offering
 *    a no-op. The guard that says so is NOT removed; it simply stops being the
 *    only thing the operator can hit.
 *  - a slot occupied by ANY other entry \u2014 occupancy alone disqualifies it, since
 *    moving into an occupied slot is a swap, and the swap workflow is a different
 *    control with its own review.
 */
export function legalMoveTargets(input: {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: { entryId: string; day: string; startTime: string } | null;
}): string[] {
	if (input.movingEntry === null) return [];
	const moving = input.movingEntry;
	return input.slots
		.filter((slot) => !slot.isSpecialEvent)
		.filter((slot) => !(slot.day === moving.day && slot.startTime === moving.startTime))
		.filter((slot) => !input.occupants.some((occupant) => (
			occupant.entryId !== moving.entryId
			&& occupant.day === slot.day
			&& slotsOverlap(slot, occupant)
		)))
		.map((slot) => slotKey(slot.day, slot.startTime));
}

export type MoveTargetNotice =
	| { readonly kind: 'targets'; readonly slotKeys: readonly string[] }
	| { readonly kind: 'none'; readonly sentence: string };

/**
 * What the move banner says. `none` carries the ONE sentence and a Cancel, so the
 * operator is never left with an armed move and no exit.
 */
export function describeMoveTargets(input: {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: { entryId: string; day: string; startTime: string } | null;
}): MoveTargetNotice {
	const slotKeys = legalMoveTargets(input);
	if (slotKeys.length === 0) return { kind: 'none', sentence: NO_LEGAL_TARGET_IN_VIEW };
	return { kind: 'targets', slotKeys };
}
