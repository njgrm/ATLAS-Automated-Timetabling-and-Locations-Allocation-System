/**
 * A2 C12 / ITEM S2 — WHICH YEAR IS ON SCREEN, decided in one pure place.
 *
 * ## Why this file exists at all
 * The live walk (`docs/reviews/codex-live-newyear-2022-2023-20260928.md`) found
 * no URL an operator could use to open a past school year. The URL is now
 * `/timetable?schoolYearId=<id>`, and the single most dangerous thing that URL
 * can do is SILENTLY SHOW THE CURRENT YEAR.
 *
 * So the decision "which year is on screen" is one pure function, and the ONE
 * invariant it exists to protect is stated here rather than left to be inferred
 * from the JSX:
 *
 *   ## THE INVARIANT
 *   A `schoolYearId` that is present in the URL decides the view. It resolves to
 *   EITHER that past year OR a notice. There is no third outcome in which the
 *   current year is rendered. The ONLY case that yields `current-year` while a
 *   parameter is present is the exact case where the parameter IS the active year
 *   — which is not a fall-through, it is the requested target.
 *
 *   Silently showing the current year's schedule while the operator believes
 *   they are looking at 2022-2023 is the failure class this project keeps paying
 *   for. An empty state is a small annoyance; a wrong year is a lie.
 *
 * ## Why the scoped READ, and not a local guess
 * `read` is the server's answer. The client does not decide whether a year is
 * readable — it asks, and it honours the answer. A `pending` read is a NOTICE,
 * not the current year: rendering today's schedule while the operator's year is
 * still loading is the same lie, one frame earlier.
 *
 * ## Why a malformed id is a notice and not a crash
 * `?schoolYearId=<a href from a stale link>` must render the existing empty /
 * notice state. It must not throw, and it must not resolve to the current year.
 */

export type PastYearNoticeReason =
	/** The parameter is not a positive integer. No read was attempted. */
	| 'malformed-school-year-id'
	/** The scoped read has not answered yet. Deliberately NOT the current year. */
	| 'school-year-still-loading'
	/** The server refused: the year is not the caller's, or is unknown to the school. */
	| 'school-year-out-of-scope'
	/** The read answered, but for a different year than the one requested. */
	| 'school-year-read-mismatch';

export type PastYearScopedRead =
	| { status: 'pending' }
	| { status: 'refused'; code: string }
	| { status: 'published'; schoolYearId: number; yearLabel: string };

export type PastYearViewState =
	| { kind: 'current-year' }
	| { kind: 'past-year'; schoolYearId: number; yearLabel: string }
	| { kind: 'notice'; reason: PastYearNoticeReason; schoolYearId: number | null };

/**
 * A strict positive-integer parse, mirroring the server's
 * `parsePositiveIntegerParam`. Deliberately stricter than `Number(raw)`: a
 * partial parse like `'7abc'` and a fractional `'7.5'` are REFUSALS, not values.
 * The two definitions are kept identical on purpose — a client that accepts
 * `'7.5'` would send a year the server then refuses, and the operator would see a
 * notice for a URL that looked valid.
 */
export function parsePastYearIdParam(raw: string | null | undefined): number | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	// An EMPTY value means "no year was asked for" — that is what a link builder
	// emits when it has no year — so it is absent, not malformed.
	if (trimmed.length === 0) return null;
	if (!/^\d+$/.test(trimmed)) return null;
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function resolvePastYearViewState(input: {
	/** The RAW `schoolYearId` query value, verbatim and never pre-parsed. */
	requestedSchoolYearId: string | null | undefined;
	/** The actor school's active year, from the ONE active-year authority. */
	activeSchoolYearId: number | null;
	read: PastYearScopedRead;
}): PastYearViewState {
	const raw = input.requestedSchoolYearId;
	const trimmed = typeof raw === 'string' ? raw.trim() : '';

	// 1. No year asked for. THIS IS TODAY'S BEHAVIOUR, unchanged. An empty string
	//    is "no year asked for", not a malformed id.
	if (trimmed.length === 0) return { kind: 'current-year' };

	// 2. A year was asked for and it is not a usable id. Notice — never the
	//    current year, and never a throw.
	const schoolYearId = parsePastYearIdParam(trimmed);
	if (schoolYearId === null) {
		return { kind: 'notice', reason: 'malformed-school-year-id', schoolYearId: null };
	}

	// 3. The parameter IS the active year. That is the requested target, not a
	//    fall-through, so the current-year view is the truthful answer — but only
	//    when the active-year authority actually resolved, so the comparison is
	//    never made against a guess.
	if (input.activeSchoolYearId !== null && schoolYearId === input.activeSchoolYearId) {
		return { kind: 'current-year' };
	}

	// 4. From here on, EVERY outcome is a notice or the requested past year. There
	//    is deliberately no path back to `current-year`.
	if (input.read.status === 'pending') {
		return { kind: 'notice', reason: 'school-year-still-loading', schoolYearId };
	}
	if (input.read.status === 'refused') {
		return { kind: 'notice', reason: 'school-year-out-of-scope', schoolYearId };
	}
	// 5. A read that answers for a DIFFERENT year is a mismatch, not that year. A
	//    stale response must never be shown under the year that was requested.
	if (input.read.schoolYearId !== schoolYearId) {
		return { kind: 'notice', reason: 'school-year-read-mismatch', schoolYearId };
	}
	return { kind: 'past-year', schoolYearId, yearLabel: input.read.yearLabel };
}

/**
 * The banner's two facts, in plain words. A scheduler reads this once and must
 * come away knowing WHICH year and WHETHER it can be changed.
 *
 * The year label is the one the server sent with the scoped read — the same
 * `enrollpro_school_year_mirrors.year_label` authority the rest of the screen
 * uses — so a second, invented year-label source never appears.
 */
export function pastYearBannerCopy(yearLabel: string): { heading: string; body: string } {
	return {
		heading: 'Past school year',
		body: `You are viewing ${yearLabel}, a past school year. This schedule is read-only — you cannot change it.`,
	};
}

/** The refusal, in plain words. Never a bare status code. */
export function pastYearNoticeCopy(reason: PastYearNoticeReason, yearLabel: string | null): string {
	switch (reason) {
		case 'malformed-school-year-id':
			return 'That is not a school year ATLAS can open. Check the link and try again.';
		case 'school-year-still-loading':
			return 'Loading that past school year…';
		case 'school-year-out-of-scope':
			return 'You cannot open that school year. It is not a past year of your school, or it has no timetable to show.';
		case 'school-year-read-mismatch':
			return 'ATLAS read a different school year than the one requested, so it is showing nothing rather than the wrong schedule.';
		default:
			return `No timetable is available for ${yearLabel ?? 'that past school year'}.`;
	}
}

/**
 * The URL that returns to the CURRENT year: the same timetable address with
 * `schoolYearId` removed and every OTHER parameter kept. Returning to this year
 * should not also reset the operator's chosen view and term.
 */
export function buildPastYearBackHref(pathname: string, search: string): string {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	params.delete('schoolYearId');
	const rest = params.toString();
	return rest.length > 0 ? `${pathname}?${rest}` : pathname;
}
