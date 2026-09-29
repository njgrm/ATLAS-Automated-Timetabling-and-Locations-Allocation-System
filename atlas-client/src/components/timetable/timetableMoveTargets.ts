/**
 * C11 M3 — which slots in the CURRENT view are legal targets for a move, what to
 * say when there are none, and (A2 mc S3) what the operator can do instead.
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
 *    renderers — the same rule this codebase already applies to run state
 *    (`RunStateBadge`), publication gating, and the undo decision.
 *  - "no legal target in this view" is a fact about the slots on screen, not
 *    about the whole week. It is computed from the same `timeSlots` and
 *    `draftEntries` the grid is already rendering, so it can never claim there
 *    are none when the view is simply scrolled to the wrong day.
 *
 * ── A2 mc, S3: A MOVE MUST ALWAYS HAVE A TARGET ──────────────────────────────
 *
 * `legalMoveTargets` excludes any slot occupied by another entry, so a section
 * with a class in every period produced an EMPTY list and one dead-end sentence.
 * But a swap is already a first-class workflow, and `findRegularSwapCandidate`
 * (`lib/timetable-swap-routing.ts:96-119`) already encodes which occupant is a
 * legal swap partner: same section, same teacher or same room, same term.
 *
 * So this module now also derives the SWAP OFFERS for occupied slots in view,
 * and it does so by CALLING that helper — never by re-implementing its scoring.
 * `timetableMoveTargets.ts` remains the single owner of "which slots are legal
 * targets in this view"; `timetable-swap-routing.ts` remains the single owner of
 * "which occupant is a legal partner".
 *
 * HONESTY CONTRACT: an offer is produced ONLY when the caller supplied the
 * occupant identity (`sectionId`/`facultyId`/`roomId`/`termIndex`) AND the label
 * resolvers. An occupant without identity yields NO offer — never a guessed one,
 * and never an offer whose label would have to print a raw id. A caller that
 * cannot answer "swap with whom?" therefore gets the plain no-target reason,
 * which is a true statement, rather than a fabricated partner.
 */

import { findRegularSwapCandidate } from '@/lib/timetable-swap-routing';

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
	/* A2 mc S3 — identity needed to decide whether a swap partner is legal.
	 * OPTIONAL so every existing caller keeps compiling; an occupant without it
	 * produces no swap offer rather than a guessed one. */
	sectionId?: number | null;
	subjectId?: number | null;
	facultyId?: number | null;
	roomId?: number | null;
	termIndex?: number | null;
};

export type MoveSourceEntry = {
	entryId: string;
	day: string;
	startTime: string;
	/* A2 mc S3 — same optional identity contract as `MoveOccupant`. */
	sectionId?: number | null;
	subjectId?: number | null;
	facultyId?: number | null;
	roomId?: number | null;
	termIndex?: number | null;
};

/** The exact sentence M3 requires when nothing in view is legal. One sentence. */
export const NO_LEGAL_TARGET_IN_VIEW = 'No free time slot for this class in this view.';

/**
 * A2 mc S3 — why there is no free slot, in one line, NAMING the reason.
 *
 * The old sentence said the same flat thing whatever the truth was. These three
 * are the only reasons this derivation can have, and each is a fact about the
 * slots on screen rather than about the whole week.
 */
export const SPECIAL_EVENT_ONLY_REASON = 'Every period in this view is a lunch or break row, and those are never move targets.';
export const ALL_PERIODS_OCCUPIED_REASON = 'Every period in this view already has a class in it.';
export const NO_TARGETS_IN_VIEW_REASON = 'This view has no time periods to move into.';

/** A2 mc S3 — the one plain sentence naming why an occupied slot cannot be used. */
export const NO_SWAP_PARTNER_REASON = 'The class in that slot shares no section, teacher or room, so the two cannot trade places.';

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
 *  - a special-event row (lunch, health break) — the walk found the operator
 *    clicking one and being told nothing useful;
 *  - the class's OWN current slot — clicking it is the recorded
 *    `Already in this slot.` case, and offering it as a target would be offering
 *    a no-op. The guard that says so is NOT removed; it simply stops being the
 *    only thing the operator can hit.
 *  - a slot occupied by ANY other entry — occupancy alone disqualifies it, since
 *    moving into an occupied slot is a swap, and the swap workflow is a different
 *    control with its own review. (A2 mc S3: such a slot is now surfaced as a
 *    SWAP OFFER by `describeMoveSwapOffers`, so it is still reachable.)
 */
export function legalMoveTargets(input: {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: MoveSourceEntry | null;
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

export type MoveSwapOffer = {
	slotKey: string;
	day: string;
	startTime: string;
	endTime: string;
	/** The occupant's entry id, so a consumer can arm the real swap. */
	occupantEntryId: string;
	/** `Swap with <subject> (<teacher>)`, minus the parenthetical when unassigned. */
	label: string;
	/** Whether the swap partner rule accepts this occupant. */
	allowed: boolean;
	/** Present only when `allowed` is false. One plain sentence. */
	blockedReason?: string;
};

export type MoveSwapOfferInput = {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: MoveSourceEntry | null;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
};

function hasSwapIdentity(entry: MoveOccupant | MoveSourceEntry | null): boolean {
	return entry != null
		&& entry.sectionId != null
		&& entry.roomId != null;
}

/**
 * `Swap with <subject> (<teacher>)` — S3d's exact shape.
 *
 * Where the teacher is unassigned the parenthetical is DROPPED rather than
 * printing `Unassigned` twice, and nothing is ever truncated with an ellipsis
 * (§8): the caller supplies the whole label or the row is not offered.
 */
export function swapOfferLabel(subject: string, teacher: string | null | undefined): string {
	const subjectPart = subject.trim();
	const teacherPart = (teacher ?? '').trim();
	if (!teacherPart) return `Swap with ${subjectPart}`;
	return `Swap with ${subjectPart} (${teacherPart})`;
}

/**
 * The identity `findRegularSwapCandidate` needs, narrowed from the OPTIONAL
 * identity a caller may supply.
 *
 * `hasSwapIdentity` has already proven `sectionId` and `roomId` are present, so
 * this narrowing removes the `undefined | null` that the shared rule's own type
 * does not accept — without inventing a value for anything it did not prove.
 */
function swapSourceFields(entry: MoveSourceEntry): {
	entryId: string;
	sectionId: number;
	facultyId: number | null;
	roomId: number;
	termIndex?: number | null;
} {
	return {
		entryId: entry.entryId,
		sectionId: entry.sectionId as number,
		facultyId: entry.facultyId ?? null,
		roomId: entry.roomId as number,
		termIndex: entry.termIndex ?? null,
	};
}

function swapCandidateFields(entry: MoveOccupant): {
	entryId: string;
	sectionId: number;
	facultyId: number | null;
	roomId: number;
	termIndex?: number | null;
} {
	return {
		entryId: entry.entryId,
		sectionId: entry.sectionId as number,
		facultyId: entry.facultyId ?? null,
		roomId: entry.roomId as number,
		termIndex: entry.termIndex ?? null,
	};
}

/**
 * A2 mc S3 — the swap offers for every occupied slot in view, in slot order.
 *
 * Partner selection is DELEGATED to `findRegularSwapCandidate`, so the
 * same-section / same-teacher / same-room / same-term rule has exactly one
 * implementation. This function only decides WHICH slots to ask about and how to
 * name the answer.
 */
export function describeMoveSwapOffers(input: MoveSwapOfferInput): MoveSwapOffer[] {
	const moving = input.movingEntry;
	if (moving == null || !hasSwapIdentity(moving)) return [];

	const offers: MoveSwapOffer[] = [];
	for (const slot of input.slots) {
		if (slot.isSpecialEvent) continue;
		if (slot.day === moving.day && slot.startTime === moving.startTime) continue;
		const slotEntries = input.occupants.filter((occupant) => (
			occupant.entryId !== moving.entryId
			&& occupant.day === slot.day
			&& slotsOverlap(slot, occupant)
		));
		if (slotEntries.length === 0) continue;
		if (!slotEntries.every((occupant) => hasSwapIdentity(occupant))) continue;

		const partner = findRegularSwapCandidate(swapSourceFields(moving), slotEntries.map(swapCandidateFields));
		if (partner == null) {
			for (const occupant of slotEntries) {
				offers.push({
					slotKey: slotKey(slot.day, slot.startTime),
					day: slot.day,
					startTime: slot.startTime,
					endTime: slot.endTime,
					occupantEntryId: occupant.entryId,
					label: swapOfferLabel(
						occupant.subjectId != null ? input.subjectLabel(occupant.subjectId) : '',
						occupant.facultyId != null ? input.facultyLabel(occupant.facultyId) : null,
					),
					allowed: false,
					blockedReason: NO_SWAP_PARTNER_REASON,
				});
			}
			continue;
		}
		/* The label is read from the OCCUPANT RECORD, not from the narrowed value the
		 * shared rule scored. `findRegularSwapCandidate` returns only the fields it
		 * compares, so reading `partner.subjectId` would name nothing — and a label
		 * is a property of the class in the slot, not of the scoring projection. */
		const partnerRecord = slotEntries.find((occupant) => occupant.entryId === partner.entryId) ?? slotEntries[0];
		offers.push({
			slotKey: slotKey(slot.day, slot.startTime),
			day: slot.day,
			startTime: slot.startTime,
			endTime: slot.endTime,
			occupantEntryId: partner.entryId,
			label: swapOfferLabel(
				partnerRecord.subjectId != null ? input.subjectLabel(partnerRecord.subjectId) : '',
				partnerRecord.facultyId != null ? input.facultyLabel(partnerRecord.facultyId) : null,
			),
			allowed: true,
		});
	}
	return offers;
}

export type MoveNoTargetReason =
	| 'special-event-only'
	| 'all-periods-occupied'
	| 'no-free-slot'
	| 'no-periods-in-view';

export type MoveTargetNotice =
	| { readonly kind: 'targets'; readonly slotKeys: readonly string[] }
	| {
		readonly kind: 'none';
		readonly sentence: string;
		/** A2 mc S3 — WHICH reason, so the line can name it instead of repeating. */
		readonly reason?: MoveNoTargetReason;
		/** A2 mc S3 — the swap offers, when the caller supplied identity + labels. */
		readonly swapOffers?: readonly MoveSwapOffer[];
	};

/**
 * A2 mc S3 — WHICH reason there is no target, and the sentence that names it.
 *
 * The view's own facts decide, so the line cannot claim a reason the slots on
 * screen do not support:
 *   - the view has no period rows at all;
 *   - every row is a lunch/break row (never a move target);
 *   - every ordinary row is already taken by ANOTHER class (this is the case the
 *     packet names, and it is where the swap offers appear);
 *   - otherwise there is simply no free slot for this class, which is the
 *     accepted `NO_LEGAL_TARGET_IN_VIEW` sentence and stays it.
 *
 * The class's OWN slot does not count as "taken by another class": a view that
 * shows only this class's own period really does have no free slot for it, and
 * that is exactly what the accepted sentence already says truthfully.
 */
function noTargetReason(input: {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: MoveSourceEntry;
}): MoveNoTargetReason {
	if (input.slots.length === 0) return 'no-periods-in-view';
	const ordinary = input.slots.filter((slot) => !slot.isSpecialEvent);
	if (ordinary.length === 0) return 'special-event-only';
	const takenByAnother = ordinary.filter((slot) => input.occupants.some((occupant) => (
		occupant.entryId !== input.movingEntry.entryId
		&& occupant.day === slot.day
		&& slotsOverlap(slot, occupant)
	)));
	return takenByAnother.length === ordinary.length ? 'all-periods-occupied' : 'no-free-slot';
}

const REASON_SENTENCES: Record<MoveNoTargetReason, string> = {
	'special-event-only': SPECIAL_EVENT_ONLY_REASON,
	'all-periods-occupied': ALL_PERIODS_OCCUPIED_REASON,
	'no-free-slot': NO_LEGAL_TARGET_IN_VIEW,
	'no-periods-in-view': NO_TARGETS_IN_VIEW_REASON,
};

/**
 * What the move banner says. `none` carries the ONE sentence, the reason behind
 * it, the swap offers, and a Cancel, so the operator is never left with an armed
 * move and no exit.
 */
export function describeMoveTargets(input: {
	slots: readonly MoveSlot[];
	occupants: readonly MoveOccupant[];
	movingEntry: MoveSourceEntry | null;
	/** A2 mc S3 — optional; without them no swap offer is produced. */
	subjectLabel?: (id: number) => string;
	facultyLabel?: (id: number) => string;
}): MoveTargetNotice {
	const slotKeys = legalMoveTargets(input);
	if (slotKeys.length > 0) return { kind: 'targets', slotKeys };

	const moving = input.movingEntry;
	if (moving == null) return { kind: 'none', sentence: NO_LEGAL_TARGET_IN_VIEW };

	const reason = noTargetReason({ slots: input.slots, occupants: input.occupants, movingEntry: moving });
	const swapOffers = input.subjectLabel && input.facultyLabel
		? describeMoveSwapOffers({
			slots: input.slots,
			occupants: input.occupants,
			movingEntry: moving,
			subjectLabel: input.subjectLabel,
			facultyLabel: input.facultyLabel,
		})
		: [];

	return {
		kind: 'none',
		sentence: REASON_SENTENCES[reason],
		reason,
		swapOffers,
	};
}
