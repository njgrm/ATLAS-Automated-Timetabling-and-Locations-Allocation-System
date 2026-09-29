/**
 * A5 C5 (2026-09-29) — the ONE sentence that names the timetable on screen.
 *
 * `AGENTS.md` §8 (subtract first / one status per fact) and the A5 c5 packet: the page states
 * which timetable it is showing, in words, and **never** shows a run id. The old page ended its
 * stat banner with `Run #{state.data.source.runId} · {state.data.source.status}` — a database key
 * presented to a scheduler as a status, which is the confusion the operator reported.
 *
 * WHY A HELPER AND NOT AN INLINE TEMPLATE. The sentence is the one thing on this page whose
 * correctness is about *truthfulness under three different conditions* (a date is present, a date
 * is absent, an older timetable is pinned), and it is the sentence a reviewer will check against
 * the browser. Those three branches are unit-tested here rather than eyeballed in JSX, so a
 * missing `generatedAt` cannot silently render `Showing the timetable made on ` — which is the
 * shape of a lie.
 *
 * WHY NOT `Intl.DateTimeFormat`. A fixed table keeps the output byte-stable across ICU versions
 * and host locales, which matters because this string is asserted in tests and read aloud in
 * acceptance. A scheduler in the Philippines reading "29 Sept" and a reviewer reading the same
 * token is worth more than a locale-perfect "Sep 29".
 */
import { academicTermDisplayLabel, type OrderedAcademicTerm } from './academic-term';

const MONTHS = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * `29 Sept` — or `29 Sept 2026` when the date is in a different year from the one the reader is
 * looking at, because a bare day-and-month on a multi-year archive is ambiguous.
 *
 * Returns `null` for anything that is not a parseable date. A `null` is the honest answer, and
 * the caller has a real sentence for it: the timetable has no recorded date, so the page says
 * `Showing the latest timetable` rather than inventing one.
 *
 * `now` is a parameter, not `new Date()`, so the year comparison is testable.
 */
export function formatScheduleMadeOn(iso: string | null | undefined, now: Date = new Date()): string | null {
	if (!iso) return null;
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return null;
	const day = parsed.getDate();
	const month = MONTHS[parsed.getMonth()] ?? '';
	const year = parsed.getFullYear() === now.getFullYear() ? '' : ` ${parsed.getFullYear()}`;
	return `${day} ${month}${year}`.trim();
}

export type ScheduleSourceSentenceInput = {
	/** `RoomScheduleView.source.generatedAt` — when the timetable on screen was produced. */
	madeAt?: string | null;
	/** The term label from the verified ordered-term authority, or `null` when unverified. */
	termIndex?: number | null;
	orderedTerms?: OrderedAcademicTerm[] | null;
	/** True when the reader pinned an older timetable from the dated disclosure. */
	isOlder?: boolean;
	now?: Date;
};

/**
 * The one quiet line: `Showing the timetable made on 29 Sept · First Term`.
 *
 * Three cases, each a complete sentence, and none of them mentions a run id:
 *  - dated, current  → `Showing the timetable made on 29 Sept · First Term`
 *  - dated, pinned   → `Showing the timetable made on 4 Sept, an older one · First Term`
 *  - undated         → `Showing the latest timetable` (the server resolved it; it just has no
 *                       recorded date, and claiming a date it cannot prove is the defect this
 *                       whole change removes)
 */
export function buildScheduleSourceSentence({
	madeAt,
	termIndex = null,
	orderedTerms = null,
	isOlder = false,
	now,
}: ScheduleSourceSentenceInput): string {
	const made = formatScheduleMadeOn(madeAt, now);
	const base = made
		? `Showing the timetable made on ${made}${isOlder ? ', an older one' : ''}`
		: 'Showing the latest timetable';
	const termLabel = termIndex != null
		? academicTermDisplayLabel(orderedTerms, termIndex)
		: null;
	return termLabel ? `${base} · ${termLabel}` : base;
}
