/**
 * A2-TIMETABLE-CUSTODY (Lane C finding #61) — a concurrent commit must name what
 * changed, and must not leave a stale action armed.
 *
 * THE PAYLOAD, TRACED RATHER THAN ASSUMED. `swapManualEntries` publishes
 * `TIMETABLE_EDIT_COMMITTED` (`manual-edit.service.ts:2475`) whose `message` is
 * server-rendered from the two raw entry ids. `notification-events.service.ts:260`
 * bridges that event into the SSE notification stream and copies `runId` and
 * `actorId` beside the event metadata, so what the client actually receives is
 *
 *   { type, domain: 'timetable', severity, message, schoolId, schoolYearId,
 *     metadata: { runId, actorId, editId, strategy,
 *                 entryIdA, entryIdB, affectedTermIndices } }
 *
 * and `useNotificationStream.notify` rendered `event.message` verbatim. On live
 * `c5a9e832` that produced, word for word:
 *
 *   "Manual swap committed between entries entry-321::t2 and entry-421::t2."
 *
 * Two facts in that payload are what make this a CLIENT fix rather than a
 * server-contract gap:
 *
 *   1. `entryIdA` / `entryIdB` are the join key into the grid the client already
 *      holds, and every grid entry carries subject, section, day and start/end —
 *      enough to name the change in words.
 *   2. `actorId` is `req.user?.userId` (`manual-edit.router.ts:247`), which is the
 *      very claim the client reads off its own token. Ownership is therefore an
 *      exact comparison in one id space, not a heuristic — so "someone else
 *      changed this" can be attributed without guessing.
 *
 * The contract this module owns:
 *   - an id never reaches an operator-facing string, on ANY path;
 *   - an id that cannot be resolved produces an explicit "we could not name it"
 *     notice, never a confident wrong sentence;
 *   - the operator's own commit produces nothing at all;
 *   - an action armed on a class that moved is released, and the operator is told.
 */

/** The narrow projection of the delivered notification event this module reads. */
export type TimetableCommitEvent = {
	id?: number;
	type: string;
	domain: string;
	severity?: string;
	message: string;
	schoolId?: number;
	schoolYearId?: number;
	metadata?: Record<string, unknown>;
};

export type ConcurrentCommitAttribution = 'other' | 'unknown';

export type ConcurrentCommitNotice = {
	/** What happened, in one line, with no internal identity in it. */
	headline: string;
	/** What changed, in words — or an explicit statement that it could not be named. */
	detail: string;
	/** Whether the change is attributable to another scheduler, or to nobody we can name. */
	attribution: ConcurrentCommitAttribution;
	/** Extra operator-facing lines, e.g. what happened to an armed selection. */
	notes: string[];
	/** True when the change could not be named from the payload. */
	unresolved: boolean;
};

export const CONCURRENT_COMMIT_HEADLINE = 'Another scheduler changed this schedule.';

/**
 * The honest unresolvable notice. It says the change could not be named, so the
 * operator knows the grid they are looking at is out of date without being told a
 * confident falsehood — and without being shown an internal id.
 */
export const UNNAMED_COMMIT_DETAIL =
	'A timetable change was committed in this run that we could not name. Refresh the schedule and check your classes before you save.';

/** Used when the event carries no `actorId`, so no scheduler can be named. */
export const UNATTRIBUTED_COMMIT_DETAIL =
	'A timetable change was committed in this run by a scheduler we cannot identify. Refresh the schedule and check your classes before you save.';

/** One class, named the way the grid names it. */
type ResolvedClass = {
	entryId: string;
	/** e.g. `MAPEH · GR7 - A` */
	label: string;
	day: string;
	startTime: string;
	endTime: string;
};

export type ConcurrentCommitContext = {
	entries: ReadonlyArray<{
		entryId: string;
		subjectId: number;
		sectionId: number;
		day: string;
		startTime: string;
		endTime: string;
	}>;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	formatTime: (hhmm: string) => string;
	/** The operator's own `userId` claim, or null when there is no session. */
	actorId: number | null;
};

function readString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Only the swap payload is taken over.
 *
 * The swap is the one `TIMETABLE_EDIT_COMMITTED` publisher that carries both
 * `entryIdA` and `entryIdB` (`manual-edit.service.ts:2482`); the single-entry and
 * batch edit publishers (`:1413`, `:1608`) carry `entryId` / `editIds`, and the
 * revert publisher (`:1885`) is a different type. Scoping on the pair keeps every
 * other notification's existing toast exactly as it was.
 *
 * Detection is on the PRESENCE of both keys, not on their values: a swap whose ids
 * are empty or malformed is still a swap, and it must reach the notice so the
 * operator is told the schedule changed — it just cannot be named. Requiring
 * non-empty values here would let a malformed payload fall through to the
 * verbatim `message` toast, which is the defect all over again.
 */
export function isSwapCommitEvent(event: Pick<TimetableCommitEvent, 'type' | 'domain' | 'metadata'>): boolean {
	if (event.type !== 'TIMETABLE_EDIT_COMMITTED') return false;
	if (event.domain !== 'timetable') return false;
	const metadata = event.metadata;
	if (!metadata || typeof metadata !== 'object') return false;
	return 'entryIdA' in metadata && 'entryIdB' in metadata;
}

/** The entry ids a concurrent commit moved, as the client knows them. */
export function readConflictingEntryIds(event: Pick<TimetableCommitEvent, 'metadata'>): string[] {
	const metadata = event.metadata ?? {};
	const ids = [readString(metadata.entryIdA), readString(metadata.entryIdB)];
	return ids.filter((id): id is string => id != null);
}

/**
 * Ownership, as an exact claim comparison.
 *
 * The event's `actorId` is `req.user.userId` and the client's is the same token
 * claim, so equality decides it. A missing `actorId` is NOT the operator: an
 * unattributable change is still a change, and treating it as "mine" would hide a
 * real conflict. It is reported as `unknown` instead, so no scheduler is named.
 */
export function isOwnTimetableCommit(
	event: Pick<TimetableCommitEvent, 'metadata'>,
	actorId: number | null,
): boolean {
	if (actorId == null) return false;
	const eventActorId = readNumber(event.metadata?.actorId);
	if (eventActorId == null) return false;
	return eventActorId === actorId;
}

function resolveClass(
	entryId: string,
	ctx: ConcurrentCommitContext,
): ResolvedClass | null {
	const entry = ctx.entries.find((candidate) => candidate.entryId === entryId);
	if (!entry) return null;
	const day = readString(entry.day);
	const startTime = readString(entry.startTime);
	const endTime = readString(entry.endTime);
	// A class with no usable slot cannot be named in words; refuse rather than
	// print a half-sentence that reads as a complete claim.
	if (!day || !startTime || !endTime) return null;
	const subject = ctx.subjectLabel(entry.subjectId);
	const section = ctx.sectionLabel(entry.sectionId);
	return {
		entryId,
		label: subject && section ? `${subject} · ${section}` : (subject || section),
		day,
		startTime,
		endTime,
	};
}

/**
 * The notice, or `null` for the operator's own commit.
 *
 * The sentence names the two classes and the pair of slots between which their
 * times were exchanged. It deliberately does NOT assert which class now sits in
 * which slot: the client's grid may be either side of the refresh, so a
 * directional claim would be a confident wrong sentence. "swapped X and Y
 * between A and B" is true in both readings.
 */
export function describeConcurrentCommit(
	event: TimetableCommitEvent,
	ctx: ConcurrentCommitContext,
): ConcurrentCommitNotice | null {
	if (!isSwapCommitEvent(event)) return null;
	if (isOwnTimetableCommit(event, ctx.actorId)) return null;

	const attribution: ConcurrentCommitAttribution = readNumber(event.metadata?.actorId) != null
		? 'other'
		: 'unknown';
	const headline = attribution === 'other' ? CONCURRENT_COMMIT_HEADLINE : 'This schedule changed while you were working.';

	const [idA, idB] = [readString(event.metadata?.entryIdA), readString(event.metadata?.entryIdB)];
	const classA = idA ? resolveClass(idA, ctx) : null;
	const classB = idB ? resolveClass(idB, ctx) : null;

	if (!classA || !classB) {
		// Fail closed, in words. The unresolvable path must never fall back to the
		// ids, and must never assemble a sentence from a half-resolved pair.
		return {
			headline,
			detail: attribution === 'other' ? UNNAMED_COMMIT_DETAIL : UNATTRIBUTED_COMMIT_DETAIL,
			attribution,
			notes: [],
			unresolved: true,
		};
	}

	const slotA = `${classA.day} ${ctx.formatTime(classA.startTime)}`;
	const slotB = `${classB.day} ${ctx.formatTime(classB.startTime)}`;
	return {
		headline,
		detail:
			`They swapped ${classA.label} and ${classB.label} between ${slotA} and ${slotB}. ` +
			'The schedule is refreshing — check your classes before you save.',
		attribution,
		notes: [],
		unresolved: false,
	};
}

// ── the handover between the stream and the timetable workspace ─────────────

/**
 * The stream is mounted once, in the app shell; the armed swap selection and the
 * grid live in the timetable workspace. Rather than open a second SSE connection
 * or lift the whole grid into the shell, the event is handed over on a window
 * `CustomEvent` — the same mechanism the notification inbox already uses for
 * `atlas:notification-inbox-invalidated` (`useNotificationInbox.ts:23-27`).
 *
 * Only the swap payload travels, and only after `isSwapCommitEvent`, so this
 * channel cannot become a second path for any other notification.
 */
export const CONCURRENT_COMMIT_EVENT = 'atlas:timetable-concurrent-commit';

export function publishConcurrentCommitEvent(event: TimetableCommitEvent): void {
	if (typeof window === 'undefined') return;
	if (!isSwapCommitEvent(event)) return;
	window.dispatchEvent(new CustomEvent(CONCURRENT_COMMIT_EVENT, { detail: event }));
}

export function subscribeConcurrentCommitEvents(
	handler: (event: TimetableCommitEvent) => void,
): () => void {
	if (typeof window === 'undefined') return () => undefined;
	const listener = (event: Event) => {
		const detail = (event as CustomEvent<TimetableCommitEvent>).detail;
		if (detail) handler(detail);
	};
	window.addEventListener(CONCURRENT_COMMIT_EVENT, listener);
	return () => window.removeEventListener(CONCURRENT_COMMIT_EVENT, listener);
}

// ── the armed-selection guard ───────────────────────────────────────────────

export type ArmedSwapSelection = {
	mode: 'select-first' | 'select-second' | null;
	entryIdA: string | null;
	entryIdB: string | null;
};

/** Where Class A sat at the moment it was armed. */
export type SwapAnchor = {
	entryId: string;
	day: string;
	startTime: string;
	endTime: string;
} | null;

export type ArmedSwapContext = {
	/** The LIVE grid, read at decision time — never a captured entry object. */
	entries: ReadonlyArray<{ entryId: string; day: string; startTime: string; endTime: string }>;
	anchor: SwapAnchor;
	/** Entry ids a concurrent commit reported moving. */
	movedEntryIds: ReadonlyArray<string>;
	actorId: number | null;
	/**
	 * Names the armed class the way the grid names it, so the cancellation tells
	 * the operator WHICH class was released instead of an unexplained "your
	 * selection was cleared". Returns null when it cannot be named, and the
	 * message then simply omits the name rather than inventing one.
	 */
	classLabel?: (entryId: string) => string | null;
};

export type ArmedSwapVerdict = {
	disposition: 'keep' | 'cancel';
	armed: ArmedSwapSelection;
	/** Operator-facing lines. Empty whenever the disposition is `keep`. */
	messages: string[];
};

const DISARMED: ArmedSwapSelection = { mode: null, entryIdA: null, entryIdB: null };

/**
 * A stale action must not be completable.
 *
 * CANCEL, rather than "require a re-check", and the reasoning is the point: the
 * reported defect is not that the operator was asked to confirm — it is that the
 * armed banner sat on a class that had already moved, inviting a swap against a
 * selection that no longer meant what it said. A re-check prompt would still leave
 * that armed selection in place, so the same wrong swap stays one click away. The
 * selection is released, and the operator is told both what changed and what
 * happened to their selection, so nothing is discarded silently.
 *
 * Three independent reasons to release, all fail-closed:
 *   1. a concurrent commit reported moving the armed class;
 *   2. the armed class's slot no longer matches the anchor captured when it was
 *      armed — which catches a change that arrived WITHOUT any stream event;
 *   3. the armed class is no longer on the grid at all.
 *
 * The decision is a pure function of live state, so a re-render, a refresh, or a
 * stale closure cannot restore a released selection: the inputs change, so the
 * verdict is recomputed rather than remembered.
 */
export function evaluateArmedSwapSelection(
	armed: ArmedSwapSelection,
	ctx: ArmedSwapContext,
): ArmedSwapVerdict {
	// Nothing armed is nothing to cancel — including the half-armed state where
	// Class A has not been chosen yet.
	if (armed.mode == null || armed.entryIdA == null) {
		return { disposition: 'keep', armed, messages: [] };
	}

	const current = ctx.entries.find((entry) => entry.entryId === armed.entryIdA);
	// Name the class when we can, and omit the name when we cannot — never a
	// placeholder that reads as a real class name.
	const named = ctx.classLabel?.(armed.entryIdA) ?? null;
	const subject = named ? `${named}` : 'that class';
	let reason: string | null = null;

	if (ctx.movedEntryIds.includes(armed.entryIdA)) {
		reason = `Another scheduler just changed ${subject}.`;
	} else if (!current) {
		reason = `${named ?? 'That class'} is no longer on the schedule where you selected it.`;
	} else if (
		ctx.anchor
		&& ctx.anchor.entryId === armed.entryIdA
		&& (ctx.anchor.day !== current.day
			|| ctx.anchor.startTime !== current.startTime
			|| ctx.anchor.endTime !== current.endTime)
	) {
		reason = `${named ?? 'That class'} has moved since you selected it.`;
	}

	if (!reason) {
		return { disposition: 'keep', armed, messages: [] };
	}

	return {
		disposition: 'cancel',
		armed: DISARMED,
		messages: [
			`${reason} Your class selection was cleared so you cannot complete a swap against the old one. Choose the classes again on the refreshed grid.`,
		],
	};
}
