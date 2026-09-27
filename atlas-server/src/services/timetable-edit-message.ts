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
 * Pure module, no Prisma and no RUNTIME imports, so the durable-path control can
 * drive the real builder and then assert on what the real inbox projection would
 * store. (A2-TIMETABLE-CUSTODY (F2): the file does carry one `import type` for
 * `SwapStrategy`, which TypeScript erases at emit, so the emitted JavaScript still
 * imports nothing and the module stays pure at runtime. It is `import type`
 * precisely because `manual-edit.service.ts` imports this module — a value import
 * back would close a runtime cycle.)
 */

import type { SwapStrategy } from './manual-edit.service.js';

export type SwapCommitSlot = {
	day: string;
	startTime: string;
	endTime: string;
} | null | undefined;

export type SwapCommitMessageInput = {
	/**
	 * Deliberately `string`, NOT `SwapStrategy`. This formatter is deliberately
	 * total over strategy strings: an unrecognised value must still yield an
	 * honest message (it claims no relocation) rather than a compile error or a
	 * throw, because the wire boundary is what refuses such a value, not the
	 * formatter. Negative tests depend on this by passing `'SOMETHING_NEW'`
	 * and `''`. The *allowlist below* is where the union is enforced.
	 */
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
 * The only `SwapStrategy` values under which the service actually relocates a
 * session. A relocation claim is made iff the strategy is in this set — see the
 * `describeSwapCommitMessage` comment for why the guard is an allowlist and not an
 * exclusion. `DIRECT_SWAP` is deliberately absent because it relocates nothing.
 *
 * A2-TIMETABLE-CUSTODY (F2) — the set is now TYPED by `SwapStrategy`, so a member
 * that is not in the union is a COMPILE error here, exactly as in the route's
 * `VALID_SWAP_STRATEGIES`. Two things make that possible without a runtime import
 * cycle, which is the whole difficulty of this file: `manual-edit.service.ts`
 * imports `describeSwapCommitMessage` from here, so a value import back would
 * close a loop at runtime.
 *
 *   1. `SwapStrategy` is a pure type, so `import type` is erased entirely at emit
 *      and contributes no runtime edge. `manual-edit.service.ts` does not appear in
 *      this file's emitted JavaScript.
 *   2. The lookup is narrowed by the guard below, so the `string` coming from
 *      `SwapCommitMessageInput` never needs an unchecked cast at the call site.
 *
 * SCOPE, stated exactly rather than optimistically. The type catches an EXTRA
 * member. It cannot catch a MISSING one: adding a fourth member to the union
 * leaves this set compiling cleanly, because every listed member is still a valid
 * `SwapStrategy`. That direction is covered by `S6` in
 * `timetable-swap-custody-a2.test.ts`, which reads the union and this set from
 * their real declarations and asserts they agree on the union minus `DIRECT_SWAP`.
 * Neither check alone is sufficient; together they are.
 */
const RELOCATING_SWAP_STRATEGIES: ReadonlySet<SwapStrategy> = new Set<SwapStrategy>([
	'AUTO_FIX_MOVE_BLOCKING',
	'AUTO_FIX_MOVE_SOURCE',
]);

/**
 * Narrow an arbitrary strategy string to a union member by allowlist membership.
 * An unrecognised value is not a member, so it claims no relocation — which is
 * the honest answer, since only the service knows whether anything moved.
 */
function isRelocatingStrategy(value: string): value is SwapStrategy {
	return RELOCATING_SWAP_STRATEGIES.has(value as SwapStrategy);
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
	// auto-fix strategies relocate one, so the clause is the same either way.
	//
	// A2-TIMETABLE-CUSTODY (Part 2): this guard used to be EXCLUSION-based — it
	// tested only that the value was NOT the direct-swap member, so ANY value that
	// was merely something else, including an unrecognised one, earned the
	// relocation claim. Paired with a route that passed `strategy` through
	// unvalidated, an unknown value committed as a plain swap (nothing was
	// relocated) and then published a message asserting that one of the sessions
	// had been. The claim is now made on a POSITIVE allowlist of the two
	// strategies that actually relocate, so the branch cannot be entered by
	// omission, and an unrecognised value now claims nothing — which is the honest
	// answer, since the service is the only thing that knows whether anything
	// moved. The route refuses an unknown value outright (`manual-edit.router.ts`,
	// `INVALID_STRATEGY`); this narrowing means even a caller that reaches the
	// message with an unvalidated value cannot publish a false claim.
	const relocation = input.strategy && isRelocatingStrategy(input.strategy)
		? ' One of them was also relocated to a different time.'
		: '';

	return `Manual swap committed: ${subjectA} and ${subjectB} exchanged their times between ${slotA} and ${slotB}.${relocation}`;
}
