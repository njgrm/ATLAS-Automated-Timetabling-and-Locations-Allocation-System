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
