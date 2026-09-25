/**
 * B1 — the universal inline preview-before-save contract for ordinary placement.
 *
 * Baseline: a clean slot committed immediately (`decideAutoSavePlacement` →
 * `auto-commit`), so the operator only saw the consequence after it happened.
 * Every ordinary placement now produces this preview first, inline, with one
 * Confirm; the commit happens only on that Confirm and Undo still follows.
 *
 * This module owns only the plain-language consequence and the confirmable
 * boundary, so the copy is unit-testable without a DOM.
 */

/**
 * C1-c R1 — what ATLAS is entitled to claim about the teaching spaces behind an
 * unresolved room.
 *
 * A bare count cannot be honest. On the deliberately supported degraded
 * reference read (`timetableLoadOrchestration` swallows a reference-data
 * failure so the grid stays usable) the room map is EMPTY, which is
 * indistinguishable from "this school configured no teaching spaces". Only the
 * reference-read status separates them, so the count must carry its own
 * provenance instead of travelling alone.
 *
 * - `ready` — reference data is known good, so `count` is authoritative and a
 *   count of 0 really does mean "none are configured".
 * - `unread` — the reference read is not known good: still loading, swallowed
 *   on the degraded path, or only partial. No count is carried, and the copy
 *   must not claim that no space exists, nor send the scheduler to a
 *   configuration page to repair a problem that may not exist.
 * - `unknown` — the caller has no discriminator at all. Keeps the pre-C1-c
 *   wording rather than guessing.
 */
export type InlinePlacementTeachingSpaces =
	| { state: 'ready'; count: number }
	| { state: 'unread' }
	| { state: 'unknown' };

export type InlinePlacementInput = {
	/** The session being placed. */
	subjectLabel: string;
	sectionLabel: string;
	session: number;
	/** The destination slot. */
	day: string;
	startTime: string;
	endTime: string;
	/** The resolved destination room, or null when ATLAS could not choose one. */
	roomLabel: string | null;
	/**
	 * C1-c R1 — the provenance of the teaching-space list, not a bare count.
	 * See `InlinePlacementTeachingSpaces`.
	 */
	availableTeachingSpaces: InlinePlacementTeachingSpaces;
	/** Soft warnings the confirm will acknowledge. */
	softCount: number;
	/** The first hard conflict's plain-language title, when the slot is blocked. */
	hardTitle: string | null;
};

export type InlinePlacementConsequence = {
	/** The consequence stated before saving. */
	consequence: string;
	/** The single Confirm enables only when the destination is not hard-blocked. */
	confirmable: boolean;
};

/** The presentation shape the inline (non-modal) preview panel renders. */
export type InlinePlacementPreviewData = {
	consequence: string;
	confirmable: boolean;
	softCount: number;
	subjectLabel: string;
	sectionLabel: string;
	session: number;
	day: string;
	startTime: string;
	endTime: string;
	roomLabel: string | null;
};

function sessionLabel(input: InlinePlacementInput): string {
	return `${input.subjectLabel} · ${input.sectionLabel} · session ${input.session}`;
}

export function buildInlinePlacementPreviewData(input: InlinePlacementInput): InlinePlacementPreviewData {
	const { consequence, confirmable } = describeInlinePlacement(input);
	return {
		consequence,
		confirmable,
		softCount: input.softCount,
		subjectLabel: input.subjectLabel,
		sectionLabel: input.sectionLabel,
		session: input.session,
		day: input.day,
		startTime: input.startTime,
		endTime: input.endTime,
		roomLabel: input.roomLabel,
	};
}

export function describeInlinePlacement(input: InlinePlacementInput): InlinePlacementConsequence {
	if (input.hardTitle) {
		return {
			consequence: `This slot is blocked: ${input.hardTitle}. Choose another slot.`,
			confirmable: false,
		};
	}
	if (!input.roomLabel) {
		// C1-c/R1 — the instruction must match what the screen can actually do,
		// AND the claim must match what ATLAS can actually prove. With 0 or 1
		// available teaching spaces the chooser does not render, so "Choose a
		// room first" names an action the scheduler cannot take and Confirm stays
		// disabled. Each branch below states the real situation instead, and a
		// count is believed only when the reference read is known good.
		const spaces = input.availableTeachingSpaces;
		if (spaces.state === 'ready' && spaces.count === 0) {
			// The only state in which "no teaching space exists" is a fact.
			return {
				consequence: 'No teaching space is available for this session, so it cannot be placed yet. Teaching spaces are set up in Room Map (/map).',
				confirmable: false,
			};
		}
		if (spaces.state === 'ready' && spaces.count === 1) {
			// R2 — state the situation, not a diagnosis. This branch is not
			// reachable from the drag path (a lone teaching space resolves to
			// that space in `resolveGeneratedPlacementRoomId`), and if it ever
			// were reachable nothing here knows WHY the one space was not used,
			// so no cause is asserted.
			return {
				consequence: '1 teaching space is available and this session is not in it, so it cannot be placed here. Choose another slot.',
				confirmable: false,
			};
		}
		if (spaces.state === 'unread') {
			// R1 — an empty list here is ATLAS's missing read, not a fact about
			// the school. Do not claim none are configured, and do not route the
			// scheduler to Room Map to repair a configuration problem that may
			// not exist; the one remedy the screen really offers is a name
			// refresh (`RefreshSetupNamesButton`).
			return {
				consequence: 'ATLAS could not read the teaching spaces for this session, so it cannot place it yet. Refresh the school names, then place it again.',
				confirmable: false,
			};
		}
		// `ready` above one space is the only case where "Choose a room first"
		// names an action the screen actually offers (the chooser renders above
		// one option), so that wording is preserved byte-identically. `unknown`
		// — a caller with no discriminator — keeps the pre-C1-c wording rather
		// than guessing.
		return {
			consequence: 'ATLAS could not choose a room for this session yet. Choose a room first.',
			confirmable: false,
		};
	}
	const destination = `${input.day} ${input.startTime}–${input.endTime} · ${input.roomLabel}`;
	if (input.softCount > 0) {
		return {
			consequence: `Confirm to place ${sessionLabel(input)} in ${destination}. ${input.softCount} soft warning${input.softCount === 1 ? '' : 's'} will be acknowledged.`,
			confirmable: true,
		};
	}
	return {
		consequence: `Confirm to place ${sessionLabel(input)} in ${destination}. No conflicts were found, so nothing changes until you confirm.`,
		confirmable: true,
	};
}
