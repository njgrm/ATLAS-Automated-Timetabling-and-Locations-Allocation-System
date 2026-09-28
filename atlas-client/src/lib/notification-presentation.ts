/**
 * A5-C2B / demo-walk item 5 — what a notification SAYS to a scheduler.
 *
 * THE DEFECT, AS OBSERVED. The bell's popover rendered `item.title` and
 * `item.body` verbatim. The operator saw `MOVE_ENT...` and `entry-321::t2` and
 * could not tell what had changed. Two separate causes, and this module closes
 * both:
 *
 *  1. STORED LEGACY ROWS. The durable inbox is a record. `toNotificationRow`
 *     writes `title: event.message.slice(0, 200)`, so every row written before
 *     the A2-TIMETABLE-CUSTODY message builder landed is PERSISTED with the
 *     internal text it was given. No amount of server-side fixing rewrites
 *     those rows, and the live release the walk was taken on still shows them.
 *     The presentation layer is therefore the only place that can fix what the
 *     operator is looking at today.
 *  2. NO STATEMENT OF CHANGE. Even a clean stored message named the event, not
 *     the effect. A scheduler reads the bell to answer "what moved?", and a
 *     title alone does not answer it.
 *
 * WHERE THE NEW WORDS COME FROM. `GET /notification-inbox/` returns Prisma
 * `Notification` rows unmodified, and `Notification.data` is a `Json?` column
 * holding the original event `metadata` (`notification-inbox.service.ts`,
 * `toNotificationRow`: `data: event.metadata`; the route's `findMany` carries no
 * `select`). That column is already on the wire and was simply never typed in
 * the client, so no endpoint, server edit or migration is needed to read it.
 *
 * WHAT THAT METADATA ACTUALLY CONTAINS — corrected, because the first version
 * of this module got it wrong and the wrongness shipped. An earlier revision
 * read `subjectCode`/`sectionName`/`facultyName`/`requestedRoomName`/`day`/
 * `startTime`/`endTime` and cited `timetable-concurrent-commit.ts` as a
 * producing service. BOTH claims were false, and every control that "proved"
 * the summary was built from a fixture invented to carry those keys. The real
 * producers write IDS and SCHEDULING FACTS, not names:
 *
 *   - `room-preference.service.ts:737-745` — `{ requestedRoomId, actionType,
 *     targetDay, targetStartTime, targetEndTime, targetEntryId, status }`;
 *     `:805-807` `{ requestedRoomId }`; `:1496-1500` `{ decisionStatus,
 *     reviewerId, manualEditId }`; `:1602-1605` `{ totalActions, failedActions }`.
 *   - `manual-edit.service.ts:1433-1438` — `{ editId, editType, entryId,
 *     termIndex }`.
 *
 * (`timetable-concurrent-commit.ts` is a CLIENT `window.dispatchEvent` at
 * `:267`, not a notification producer, and is not a source for this column.)
 * The names that service builds — `subjectCode`, `sectionName`, `requestedRoomName`
 * — live in the HTTP response DTO (`room-preference.service.ts:922-932`), not in
 * the event metadata, so a notification row has never carried them.
 *
 * THE CHOICE: HONEST DEGRADATION, not a lookup, and not a server change. A room
 * name would have to be resolved from a room list the app shell does not fetch
 * (no `app-shell` component reads rooms), and the alternative — widening
 * `publishRoomPreferenceEvent`'s metadata to carry names — is a change to what
 * the server publishes, on a shared runtime path, for a label. So the summary
 * names the ACTION in the operator's words (translating `actionType`/`editType`
 * from the enumerations those services already declare), the DAY and TIME WINDOW
 * from `targetDay`/`targetStartTime`/`targetEndTime`, and the TERM from
 * `termIndex`. No identifier is ever printed, so a name that would be a bare
 * number (`requestedRoomId: 12`) is omitted rather than shown as `12`.
 *
 * THE HONESTY RULE. A summary is only assembled from facts the row actually
 * holds. When a row carries no usable metadata — the legacy rows, which have
 * `data: null` — the summary says what KIND of change it is and points at the
 * detail rather than inventing a subject, a room or a direction. The full stored
 * text is never destroyed: it is the expanded detail, so an officer debugging a
 * legacy row can still read exactly what ATLAS recorded.
 */

/**
 * The stored shapes that are implementation language, not a sentence.
 *
 * `entry-321::t2` is a timetable entry id with a term suffix. `MOVE_ENT...` is
 * `MOVE_ENTRY` — an ALL-CAPS enum. Two patterns cover both the complete and the
 * CSS-truncated form (the report's `MOVE_ENT...` still contains the underscore),
 * and the second is deliberately narrow: ALL-CAPS containing an underscore never
 * occurs in an ordinary English sentence, so it cannot fire on prose, while
 * legitimate acronyms without an underscore (`GR7`, `SCI10`, `AP`) are
 * untouched.
 */
const RAW_ENTRY_ID = /\bentry-\d+(?:::[a-z0-9]+)?\b/i;
const RAW_TERM_PAIR = /::[a-z]{1,4}\d+\b/i;
const RAW_ENUM_SNAKE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;

export function containsRawIdentifier(value: string | null | undefined): boolean {
	if (!value) return false;
	return RAW_ENTRY_ID.test(value) || RAW_TERM_PAIR.test(value) || RAW_ENUM_SNAKE.test(value);
}

/** The event `metadata` JSON column, narrowed to the fields this module reads. */
export type InboxNotificationData = Record<string, unknown>;

function readText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function firstText(source: InboxNotificationData, keys: readonly string[]): string | null {
	for (const key of keys) {
		const value = readText(source[key]);
		if (value) return value;
	}
	return null;
}

/**
 * What KIND of change a notification reports, in the operator's words.
 *
 * Keyed on the event `type` the server already stores. An unrecognised type
 * falls back to the event `domain` with underscores read as words — a
 * mechanical, non-fabricating degradation — so an event type added by another
 * lane is still described rather than silently blank.
 */
const KIND_BY_TYPE: Readonly<Record<string, string>> = {
	TIMETABLE_EDIT_COMMITTED: 'Timetable change',
	TIMETABLE_SWAP_COMMITTED: 'Timetable swap',
	ROOM_REQUEST_SUBMITTED: 'Room request',
	ROOM_REQUEST_DRAFT_SAVED: 'Room request draft',
	ROOM_REQUEST_DELETED: 'Room request',
	ROOM_REQUEST_APPROVED: 'Room request',
	ROOM_REQUEST_REJECTED: 'Room request',
	PUBLISHED_SCHEDULE_UPDATED: 'Published schedule',
	GENERATION_COMPLETED: 'Schedule generated',
};

function describeKind(type: string | null | undefined, domain: string | null | undefined): string {
	const key = (type ?? '').trim();
	if (key && KIND_BY_TYPE[key]) return KIND_BY_TYPE[key];
	if (key) return key.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
	const fallback = (domain ?? '').trim();
	if (fallback) return fallback.replace(/_/g, ' ');
	return 'Schedule change';
}

/**
 * The two scheduling enumerations a real producer writes into event metadata,
 * in the operator's words. Both are read off the SERVER's own unions, so a new
 * member fails to a generic summary rather than being guessed at:
 *
 *   - `RoomPreferenceActionType` — `room-preference.service.ts:49`.
 *   - `ManualEditType` — `manual-edit.service.ts:58-65`.
 *
 * A key the vocabulary does not know is simply not an action: `actionType` is
 * also written by `pre-generation-draft.service.ts` with a DIFFERENT vocabulary
 * (`UPDATE`/`CREATE`/`SWAP`/`REPLACE`/`CLEAR_DRAFT`/`UNDO`/`REMOVE`), and
 * translating that as a room request would be worse than saying nothing.
 */
const ROOM_ACTION_BY_TYPE: Readonly<Record<string, string>> = {
	ROOM_CHANGE: 'a different room was requested',
	MOVE_TO_EMPTY_SLOT: 'a move to a free slot was requested',
	SWAP_WITH_OCCUPIED: 'a swap with a booked slot was requested',
	TIME_AND_ROOM_CHANGE: 'a different time and room were requested',
};

const EDIT_ACTION_BY_TYPE: Readonly<Record<string, string>> = {
	PLACE_UNASSIGNED: 'an unassigned class was placed',
	MOVE_ENTRY: 'a scheduled class was moved',
	CHANGE_ROOM: 'a class was moved to a different room',
	CHANGE_FACULTY: 'a class was reassigned to another teacher',
	CHANGE_TIMESLOT: 'a class was moved to a different time',
	SWAP_ENTRIES: 'two scheduled classes were swapped',
	REVERT: 'a timetable change was undone',
};

/** `status` (request state) and `decisionStatus` (review outcome), as read. */
const ROOM_STATE_BY_VALUE: Readonly<Record<string, string>> = {
	SUBMITTED: 'sent for review',
	DRAFT: 'saved as a draft',
	APPROVED: 'approved by a scheduler',
	REJECTED: 'returned by a scheduler',
};

/**
 * Weekday display, mirroring the server's own `DAY_LABELS`
 * (`manual-edit.service.ts:899-901`) rather than inventing a convention. The
 * stored vocabulary is `MONDAY`…`FRIDAY` (`preference.router.ts:52`,
 * `AVAILABILITY_DAYS`). A value outside it is passed through as stored rather
 * than guessed at, so an unexpected day is visible instead of mistranslated.
 */
const DAY_LABELS: Readonly<Record<string, string>> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

/**
 * The ordered term, from `termIndex` (`manual-edit.service.ts:1437`). Only a
 * positive integer renders: `null` means the edit was not term-scoped, and
 * inventing "Term 1" there is exactly the failure this module exists to stop
 * (AGENTS.md §7: missing term identity never becomes Term 1).
 */
function readTermLabel(data: InboxNotificationData): string | null {
	const raw = data.termIndex;
	const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
	return `Term ${value}`;
}

/**
 * The day and the time window the row concerns, from the room-preference
 * target fields. `requestedRoomId`, `targetEntryId` and `entryId` are DELIBERATELY
 * NOT READ: they are identifiers, and the row already links to the target.
 */
function readRoomSlot(data: InboxNotificationData): string | null {
	const storedDay = firstText(data, ['targetDay']);
	const day = storedDay ? DAY_LABELS[storedDay.toUpperCase()] ?? storedDay : null;
	const start = firstText(data, ['targetStartTime']);
	const end = firstText(data, ['targetEndTime']);
	const window = start && end ? `${start}-${end}` : start ?? end;
	return [day, window].filter(Boolean).join(' ') || null;
}

export type NotificationRead = {
	/** What kind of change this is, e.g. `Room request`. */
	kind: string;
	/**
	 * ONE plain sentence stating what changed, built only from fields the row
	 * holds. Guaranteed free of raw entry ids and ALL-CAPS enums.
	 */
	summary: string;
	/**
	 * The full stored text, shown only when the officer expands it. Null when
	 * the summary already says everything the row holds.
	 */
	detail: string | null;
};

/**
 * Build the scheduler-readable read of one inbox row.
 *
 * `item.data` is the event `metadata` column. The keys read here are the ones
 * the producing services already write — `actionType`/`targetDay`/
 * `targetStartTime`/`targetEndTime`/`status`/`decisionStatus`
 * (`room-preference.service.ts`) and `editType`/`termIndex`
 * (`manual-edit.service.ts`) — and nothing else. A row missing every one of them
 * degrades to the unnamed form rather than asserting something.
 */
export function notificationRead(item: {
	type: string | null | undefined;
	domain: string | null | undefined;
	title: string | null | undefined;
	body?: string | null;
	data?: unknown;
}): NotificationRead {
	const kind = describeKind(item.type, item.domain);
	const storedTitle = readText(item.title);
	const storedBody = readText(item.body);

	const data: InboxNotificationData =
		item.data && typeof item.data === 'object' && !Array.isArray(item.data)
			? (item.data as InboxNotificationData)
			: {};

	// Which vocabulary applies is decided by WHICH KEY IS PRESENT, not by the
	// event type string: the two `actionType` producers use different
	// enumerations, and an unknown member yields no action rather than a wrong
	// one. See the note on `ROOM_ACTION_BY_TYPE`.
	const roomAction = ROOM_ACTION_BY_TYPE[firstText(data, ['actionType']) ?? ''] ?? null;
	const editAction = EDIT_ACTION_BY_TYPE[firstText(data, ['editType']) ?? ''] ?? null;
	const action = roomAction ?? editAction;

	const roomSlot = roomAction ? readRoomSlot(data) : null;
	const term = editAction ? readTermLabel(data) : null;
	const state = roomAction
		? ROOM_STATE_BY_VALUE[firstText(data, ['status', 'decisionStatus']) ?? ''] ?? null
		: null;

	// A room request concerns a SLOT ("for Mon 07:30-08:30"); a timetable edit
	// concerns a TERM ("in Term 2"). The preposition states which, so the
	// sentence is not ambiguous about what is being scheduled.
	const where = roomSlot ? ` for ${roomSlot}` : term ? ` in ${term}` : '';

	// The stored title is reusable as the summary ONLY when it is a sentence the
	// operator can read. A legacy row's title is the internal token itself, so
	// the gate is on readability, not on emptiness.
	const titleIsReadable = Boolean(storedTitle) && !containsRawIdentifier(storedTitle);

	let summary: string;
	if (action) {
		const statePart = state ? `, ${state}` : '';
		summary = `${kind}: ${action}${where}${statePart}.`;
	} else if (titleIsReadable && where === '' && state === null) {
		// Nothing structural to add, and the stored message is already readable:
		// use it rather than restating the kind in place of real information.
		summary = storedTitle as string;
	} else {
		const detailParts = [roomSlot, term, state].filter(Boolean);
		summary = detailParts.length > 0
			? `${kind}: ${detailParts.join(' · ')}`
			: `${kind}. Open this notice for the recorded detail.`;
	}

	// The expanded detail is ALWAYS the full stored text, verbatim. That is the
	// point: a legacy row's summary no longer leaks `MOVE_ENTRY`, and an officer
	// who needs to know exactly what ATLAS recorded still reads it — in one
	// deliberate step, rather than as the first thing on screen.
	const detail = [storedTitle, storedBody].filter(Boolean).join('\n');

	return { kind, summary, detail: detail || null };
}
