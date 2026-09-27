/**
 * A2-TIMETABLE-CUSTODY (#61 correction) — the operator-facing message for a
 * committed manual swap.
 *
 * WHY THIS EXISTS. The correction found that the client-side fix suppressed the
 * toast but did not remove the defect, because the STRING is authored here and
 * then travels a path the client does not own:
 *
 *   swapManualEntries -> publishTimetableEvent(message)
 *     -> notification-events.service.ts (bridge, `message: event.message`)
 *        -> notifyDurableListeners(resolved)   [unconditional, no self-exclusion]
 *           -> persistNotificationEvent(event)
 *              -> toNotificationRow: `title: event.message.slice(0, 200)`
 *                 -> NotificationBell renders `item.title`
 *
 * So the raw ids were not merely displayed, they were PERSISTED into the durable
 * per-actor inbox, and the bell is only one reader of a stored record. A client
 * redaction would leave the stored row wrong. The message has to be right here.
 *
 * WHAT THIS MODULE GUARANTEES.
 *   1. The returned string NEVER contains an entry id, on any input.
 *   2. When the classes cannot be named, the message says a change was committed
 *      and claims nothing further. A vague sentence that implied more knowledge
 *      than the server has would be its own falsehood, so the unnamed case is
 *      deliberately contentless rather than vague.
 *   3. The message never claims more than the server proved. It describes the
 *      exchange between the two slots the swap acted on, which is the whole of
 *      what this function is given.
 *
 * DELIBERATELY NOT HERE. The entry ids stay in the event `metadata`: the client's
 * `describeConcurrentCommit` resolves operator-meaningful labels from
 * `metadata.entryIdA` / `entryIdB`, and the inbox `data` column is the structured
 * routing record. Stripping them there would break the accepted client fix and
 * destroy the routing pointer. Only the human-readable MESSAGE is id-free.
 *
 * Pure module, no Prisma and no imports, so the durable-path control can drive
 * the real builder and then assert on what the real inbox projection would store.
 */

export type SwapCommitSlot = {
	day: string;
	startTime: string;
	endTime: string;
} | null | undefined;

export type SwapCommitMessageInput = {
	/** `DIRECT_SWAP`, or an auto-fix strategy that also relocates one class. */
	strategy: string;
	/** Resolved subject codes, or null when the subject is not in the mirror. */
	subjectA: string | null;
	subjectB: string | null;
	slotA: SwapCommitSlot;
	slotB: SwapCommitSlot;
};

/**
 * The single message used when neither class can be named. It states the fact the
 * server does know — a change was committed — and stops there.
 */
export const UNNAMED_SWAP_COMMIT_MESSAGE =
	'A manual change was committed to this schedule.';

function readText(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readSlot(slot: SwapCommitSlot): string | null {
	if (!slot) return null;
	const day = readText(slot.day);
	const start = readText(slot.startTime);
	const end = readText(slot.endTime);
	// A slot missing any part cannot be stated as a time; refuse rather than
	// assemble a half-sentence that reads as a complete claim.
	if (!day || !start || !end) return null;
	return `${day} ${start}-${end}`;
}

/**
 * The plain-language message for a committed swap, or `null` only if the input
 * cannot yield even the unnamed sentence (which cannot happen for a committed
 * swap — the service has already proven both entries exist).
 *
 * The named sentence is direction-free on purpose. A swap exchanges two slots,
 * and this function is given the PRE-swap positions, so "X took Y's slot" would
 * be a claim about a direction the server has not been asked to assert here.
 * "exchanged their times between A and B" is true regardless of direction.
 */
export function describeSwapCommitMessage(input: SwapCommitMessageInput): string {
	const subjectA = readText(input.subjectA);
	const subjectB = readText(input.subjectB);
	const slotA = readSlot(input.slotA);
	const slotB = readSlot(input.slotB);

	// Honest degradation: without both subjects AND both slots there is nothing
	// specific to say, so say only what is true.
	if (!subjectA || !subjectB || !slotA || !slotB) {
		return UNNAMED_SWAP_COMMIT_MESSAGE;
	}

	// An auto-fix relocates exactly one class beyond the exchange
	// (`getRelocatedClassCount` in the accepted client layer agrees). Both
	// strategies relocate one, so the clause is the same either way.
	const relocation = input.strategy && input.strategy !== 'DIRECT_SWAP'
		? ' One of them was also relocated to a different time.'
		: '';

	return `Manual swap committed: ${subjectA} and ${subjectB} exchanged their times between ${slotA} and ${slotB}.${relocation}`;
}
