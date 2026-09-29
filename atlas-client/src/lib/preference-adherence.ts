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
	teachers: Array<{
		facultyId: number;
		name: string;
		groups: Array<{
			kind: 'UNAVAILABLE' | 'PREFERRED';
			label: string;
			slotCount: number;
			kept: boolean;
			metCount: number;
		}>;
	}>;
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

/** "Unavailable Friday afternoon — kept" / "Prefers Tuesday morning — 1 of 2". */
export function preferenceGroupLine(group: PreferenceAdherenceReport['teachers'][number]['groups'][number]): string {
	if (group.kind === 'UNAVAILABLE') {
		return `${group.label} — ${group.kept ? 'kept' : 'not kept'}`;
	}
	// A fully-met preferred group reads as a plain acknowledgement; a partial one
	// names the numbers, because "1 of 2" is the thing the scheduler needs.
	return group.metCount === group.slotCount
		? `${group.label} — all ${group.slotCount} ${group.slotCount === 1 ? 'time' : 'times'} met`
		: `${group.label} — ${group.metCount} of ${group.slotCount}`;
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
