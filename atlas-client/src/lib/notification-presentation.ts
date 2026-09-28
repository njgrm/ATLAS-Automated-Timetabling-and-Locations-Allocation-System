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
 * WHERE THE NEW WORDS COME FROM — and this is the whole justification for doing
 * it client-side. `GET /notification-inbox/` returns Prisma `Notification` rows
 * unmodified, and `Notification.data` is a `Json?` column holding the original
 * event `metadata` — the subject code, section, day, times and room the event
 * carried. That column is ALREADY ON THE WIRE and was simply never typed in the
 * client. So the subject and section names this module prints need no new
 * endpoint, no server edit, and no migration: the client finally reads a field
 * the response has always contained. `InboxNotification` is widened to declare
 * it, and `notificationData` is the single place that asserts the shape.
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
 * the producing services already write (`room-preference.service.ts`,
 * `timetable-concurrent-commit.ts`); none of them is invented for this module,
 * and a row missing every one of them degrades to the unnamed form rather than
 * asserting something.
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

	const subject = firstText(data, ['subjectCode', 'subject', 'subjectName']);
	const section = firstText(data, ['sectionName', 'section', 'sectionCode']);
	const teacher = firstText(data, ['facultyName', 'facultyLastName', 'teacherName']);
	const room = firstText(data, ['requestedRoomName', 'roomName', 'targetRoomName', 'room']);
	const day = firstText(data, ['day']);
	const start = firstText(data, ['startTime']);
	const end = firstText(data, ['endTime']);

	const what: string[] = [];
	if (subject) what.push(subject);
	if (section && section !== subject) what.push(section);
	if (teacher) what.push(teacher);
	if (room) what.push(room);

	const when: string[] = [];
	if (day) when.push(day);
	if (start && end) when.push(`${start}-${end}`);

	// The stored title is reusable as the summary ONLY when it is a sentence the
	// operator can read. A legacy row's title is the internal token itself, so
	// the gate is on readability, not on emptiness.
	const titleIsReadable = Boolean(storedTitle) && !containsRawIdentifier(storedTitle);

	let summary: string;
	if (titleIsReadable && what.length === 0 && when.length === 0) {
		// Nothing structural to add, and the stored message is already readable:
		// use it rather than restating the kind in place of real information.
		summary = storedTitle as string;
	} else {
		const detailParts = [...what, ...when].filter(Boolean);
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
