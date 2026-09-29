/**
 * A2 C17 — the WORDS for "were teacher preferences kept?".
 *
 * Every visible string for this feature is built here and nowhere else, so the
 * line, the list and the unreviewed notice cannot drift from each other and a
 * test can decide the wording without a DOM. The group phrases themselves are
 * NOT built here: the server derives them (a painted block is one phrase, and
 * the picker vocabulary belongs with the picker), so there is exactly one place a
 * day or a period of day is named.
 *
 * THE SINGULAR SENTENCE. The plural is fixed by the packet:
 *   "2 teachers' preferences are not reviewed yet, so they were not used"
 * Its "they" has no antecedent for ONE teacher, which is why the singular does
 * not reuse that shape. "1 teacher's preferences are not reviewed yet, so they
 * were not used" is the ungrammatical form the packet names and it is NOT used.
 * The singular makes the PREFERENCES the relative clause of a plural subject, so
 * "they" has a real antecedent in both sentences and neither needs a second verb
 * or a rewording of the plural.
 */

/** One preference line, as the server rolled it up: a kind plus a part of day. */
export type PreferenceAdherencePreference = {
	kind: 'UNAVAILABLE' | 'PREFERRED';
	/** `Prefers mornings` / `Unavailable Friday afternoon`. Never a raw enum. */
	label: string;
	/** Day-windows this line covers — the denominator of the packet's "N of M". */
	totalCount: number;
	/** Day-windows honoured. The server guarantees this never exceeds `totalCount`. */
	metCount: number;
	/** The underlying stored 15-minute rows. Reported for reference; never in a ratio. */
	slotCount: number;
	kept: boolean;
	/** One short row per day, carrying no ratio. */
	days: Array<{ day: string; met: boolean; classCount: number }>;
};

export type PreferenceAdherenceTeacher = {
	facultyId: number;
	name: string;
	preferences: PreferenceAdherencePreference[];
};

/** The report shape returned by `GET /generation/:s/:y/runs/:r/preference-adherence`. */
export type PreferenceAdherenceReport = {
	runId: number;
	schoolYearId: number;
	termIndex: number;
	totals: {
		unavailableSlots: number;
		unavailableKept: number;
		preferredSlots: number;
		preferredMet: number;
	};
	teachers: PreferenceAdherenceTeacher[];
	notReviewedTeacherCount: number;
	notReviewedTeacherNames: string[];
	hasAny: boolean;
};

/** The one label of the one control. */
export const PREFERENCES_LINE_LEAD = 'Teacher preferences:';

/**
 * "2 of 2 unavailable times kept · 5 of 7 preferred times met"
 *
 * A segment whose denominator is 0 is OMITTED, so a year with only unavailable
 * times never prints "0 of 0 preferred times met". When both denominators are 0
 * the report's `hasAny` is already false and the component renders nothing, so
 * this function is never asked for a sentence it cannot make.
 */
export function preferenceAdherenceLine(totals: PreferenceAdherenceReport['totals']): string | null {
	const segments: string[] = [];
	if (totals.unavailableSlots > 0) {
		segments.push(`${totals.unavailableKept} of ${totals.unavailableSlots} unavailable times kept`);
	}
	if (totals.preferredSlots > 0) {
		segments.push(`${totals.preferredMet} of ${totals.preferredSlots} preferred times met`);
	}
	if (segments.length === 0) return null;
	return `${PREFERENCES_LINE_LEAD} ${segments.join(' · ')}`;
}

/**
 * The packet's per-teacher line, in its own words:
 *
 *   `Unavailable Friday afternoon — kept`      the kept case, no count (the packet)
 *   `Unavailable Friday afternoon — 1 of 2`    when some of the days were not kept
 *   `Prefers mornings — 3 of 5`                the rolled-up preferred count
 *
 * BOTH SIDES OF EVERY NUMBER COME FROM THE SAME PLACE: the server's day-windows.
 * A fully-met preferred group still reads as a plain acknowledgement rather than
 * "5 of 5", because "all of them" is what a scheduler wants to hear and a bare
 * ratio reads like a score.
 */
export function preferenceLine(preference: PreferenceAdherencePreference): string {
	if (preference.kind === 'UNAVAILABLE' && preference.kept) {
		return `${preference.label} — kept`;
	}
	if (preference.kind === 'PREFERRED' && preference.metCount === preference.totalCount) {
		const times = preference.totalCount === 1 ? 'time' : 'times';
		return `${preference.label} — all ${preference.totalCount} ${times} met`;
	}
	return `${preference.label} — ${preference.metCount} of ${preference.totalCount}`;
}

/**
 * The per-day detail row. It carries NO ratio on purpose: the line above it already
 * counts in day-windows, and a second number in a different unit beside it is how
 * this list came to mix units in the first place. It answers one question per day —
 * did something land there, or not.
 *
 * It does NOT branch on the preference's kind. `days[].met` is one NEUTRAL fact the
 * server sets identically for both kinds ("a class of this teacher landed in that
 * day's window"), and the kept/violated polarity is applied once, on the server, in
 * the line above. Branching here would have been a second place to get the two
 * readings backwards — which is exactly what happened when the two were unified.
 */
export function preferenceDayLine(day: PreferenceAdherencePreference['days'][number]): string {
	return day.met ? `${day.day} — a class was placed there` : `${day.day} — nothing placed there`;
}

/**
 * The in-words notice that some preferences were never used, plus the one
 * destination that fixes them.
 *
 * `null` when every teacher with preferences has been reviewed — the notice is a
 * statement about something missing, and a page that has nothing missing says
 * nothing (AGENTS.md §8, and the packet's "no empty box" rule).
 */
export function preferenceUnreviewedNotice(count: number): { text: string; action: string } | null {
	if (!Number.isInteger(count) || count < 1) return null;
	if (count === 1) {
		return {
			text: '1 teacher has preferences that are not reviewed yet, so they were not used.',
			action: 'Review this teacher’s preferences',
		};
	}
	return {
		text: `${count} teachers' preferences are not reviewed yet, so they were not used.`,
		action: 'Review these teachers’ preferences',
	};
}

/** The real route the preferences form is served at. `App.tsx` mounts `TeacherConcerns` here. */
export const TEACHER_PREFERENCES_ROUTE = '/faculty/preferences';

/** The accessible name of the disclosure control, for a screen reader. */
export function preferencesLineAccessibleName(line: string): string {
	return `${line} — show each teacher’s preferences`;
}
