/**
 * LANE-C POST-PUBLISH-C01 — published-change clashes in plain language.
 *
 * The server's revision preview (and a refused revision) returns each blocking
 * clash with operator copy (`title`, `meaning`, `action`) and the entries it
 * involves. This module turns that into sentences that name the teacher,
 * section, subject, room, day and time — the 2026-09-25 audit found the
 * teacher-leaving flow reporting a clash as "merged entries contain hard
 * violations. Check the effective date and reason", which named nothing and
 * blamed the wrong fields.
 */

export type PublishedRevisionClashEntry = {
	entryId: string;
	changed: boolean;
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
	roomId: number | null;
	day: string | null;
	startTime: string | null;
	endTime: string | null;
	termIndex: number | null;
};

export type PublishedRevisionClash = {
	code: string;
	title: string;
	meaning: string;
	action: string;
	facultyId: number | null;
	roomId: number | null;
	sectionId: number | null;
	day: string | null;
	startTime: string | null;
	endTime: string | null;
	entries: PublishedRevisionClashEntry[];
};

export type PublishedRevisionPreview = {
	changeCount: number;
	blockingHardViolationCount: number;
	hardViolationCount: number;
	softViolationCount: number;
	softViolations: Array<{ code: string; severity: 'SOFT'; message: string }>;
	clashes: PublishedRevisionClash[];
	alreadyScheduled: boolean;
};

export type ClashLabels = {
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	roomLabel?: (id: number) => string;
};

export type DescribedClash = {
	key: string;
	title: string;
	sentence: string;
	action: string;
	/** Entry ids to highlight on the timetable. */
	entryIds: string[];
};

const DAY_NAMES: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday',
};

/** `13:45` → `1:45 PM`. Unparseable input is returned unchanged. */
export function formatClockTime(value: string | null): string {
	if (!value) return '';
	const match = /^(\d{1,2}):(\d{2})$/.exec(value);
	if (!match) return value;
	const hours = Number(match[1]);
	const period = hours >= 12 ? 'PM' : 'AM';
	const twelve = hours % 12 === 0 ? 12 : hours % 12;
	return `${twelve}:${match[2]} ${period}`;
}

function when(day: string | null, start: string | null, end: string | null): string {
	const dayName = day ? DAY_NAMES[day] ?? day : '';
	const range = start && end ? `${formatClockTime(start)}–${formatClockTime(end)}` : formatClockTime(start);
	return [dayName, range].filter(Boolean).join(' ');
}

function classPhrase(entry: PublishedRevisionClashEntry, labels: ClashLabels): string {
	const section = entry.sectionId != null ? labels.sectionLabel(entry.sectionId) : 'a class';
	const subject = entry.subjectId != null ? labels.subjectLabel(entry.subjectId) : '';
	const term = entry.termIndex != null && entry.termIndex > 0 ? `, Term ${entry.termIndex}` : '';
	return subject ? `${section} (${subject}${term})` : `${section}${term ? ` (${term.slice(2)})` : ''}`;
}

/** The changed entry first, then the entries it collides with. */
function orderedEntries(clash: PublishedRevisionClash): PublishedRevisionClashEntry[] {
	return [...clash.entries].sort((a, b) => Number(b.changed) - Number(a.changed));
}

/** One plain sentence per clash, naming who and what collides, and when. */
export function describeRevisionClash(clash: PublishedRevisionClash, labels: ClashLabels, index = 0): DescribedClash {
	const [first, second] = orderedEntries(clash);
	const time = when(clash.day ?? first?.day ?? null, first?.startTime ?? clash.startTime, first?.endTime ?? clash.endTime);
	const entryIds = clash.entries.map((entry) => entry.entryId);
	let sentence: string;
	if (clash.code === 'FACULTY_TIME_CONFLICT' && first && second) {
		const facultyId = clash.facultyId ?? first.facultyId ?? second.facultyId;
		const teacher = facultyId != null ? labels.facultyLabel(facultyId) : 'The teacher';
		sentence = `${teacher} would teach ${classPhrase(first, labels)} and ${classPhrase(second, labels)} at the same time${time ? `, ${time}` : ''}.`;
	} else if (clash.code === 'ROOM_TIME_CONFLICT' && first && second) {
		const roomId = clash.roomId ?? first.roomId ?? second.roomId;
		const room = roomId != null ? (labels.roomLabel ? labels.roomLabel(roomId) : `Room ${roomId}`) : 'The room';
		sentence = `${room} would hold ${classPhrase(first, labels)} and ${classPhrase(second, labels)} at the same time${time ? `, ${time}` : ''}.`;
	} else if (clash.code === 'SECTION_TIME_CONFLICT' && first && second) {
		const sectionId = clash.sectionId ?? first.sectionId;
		const section = sectionId != null ? labels.sectionLabel(sectionId) : 'The class';
		const subjectA = first.subjectId != null ? labels.subjectLabel(first.subjectId) : 'one subject';
		const subjectB = second.subjectId != null ? labels.subjectLabel(second.subjectId) : 'another subject';
		sentence = `${section} would have ${subjectA} and ${subjectB} at the same time${time ? `, ${time}` : ''}.`;
	} else {
		const involved = orderedEntries(clash).map((entry) => classPhrase(entry, labels));
		sentence = `${clash.meaning || clash.title}${involved.length > 0 ? ` Involves ${involved.join(' and ')}` : ''}${time ? `, ${time}` : ''}.`;
	}
	return {
		key: `${clash.code}:${entryIds.join('|')}:${index}`,
		title: clash.title,
		sentence,
		action: clash.action,
		entryIds,
	};
}

export function describeRevisionClashes(clashes: PublishedRevisionClash[], labels: ClashLabels): DescribedClash[] {
	return clashes.map((clash, index) => describeRevisionClash(clash, labels, index));
}

/** The clashes carried on a refused revision (`details.clashes` of a 422), or `[]`. */
export function extractRevisionClashes(error: unknown): PublishedRevisionClash[] {
	const data = (error as { response?: { data?: { details?: { clashes?: unknown } } } } | null)?.response?.data;
	const clashes = data?.details?.clashes;
	return Array.isArray(clashes) ? clashes as PublishedRevisionClash[] : [];
}

/**
 * The hint to show under a refused revision. The server's `actionHint` wins;
 * without one, date and reason are only blamed when the error is about them.
 */
export function revisionFailureHint(error: unknown): string {
	const data = (error as { response?: { data?: { code?: unknown; actionHint?: unknown } } } | null)?.response?.data;
	if (typeof data?.actionHint === 'string' && data.actionHint.length > 0) return data.actionHint;
	const code = typeof data?.code === 'string' ? data.code : '';
	if (code.startsWith('EFFECTIVE_DATE') || code === 'REVISION_EFFECTIVE_DATE_BEFORE_SOURCE') return 'Choose tomorrow or a later school day, then try again.';
	if (code.startsWith('REVISION_REASON')) return 'Add a short reason (500 characters or fewer), then try again.';
	if (code === 'SOURCE_REVISION_STALE' || code === 'PUBLISHED_REVISION_INPUTS_STALE') return 'Someone else changed the schedule. Refresh the timetable, then try again.';
	// LANE-C C03 — a scheduled change already moved this class.
	if (code === 'REVISION_PREVIOUS_VALUES_STALE') return 'This class already has a scheduled change. Refresh the timetable, then try again.';
	return 'Nothing was saved. Review the change, then try again.';
}
