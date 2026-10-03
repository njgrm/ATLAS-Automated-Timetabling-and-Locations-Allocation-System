/**
 * A3 c17 row 5 — the `Above weekly max` helper sentence, with the weekly
 * maximum READ FROM THE ROSTER instead of typed into the string.
 *
 * The operator's report was "Above weekly max hover text cut off" with the note
 * that "its text hard-codes 40h". The clipping is a shared-tooltip matter that
 * A5 owns; what is wrong HERE, and what only this function can fix, is the
 * number. A teacher saved with a 32h maximum was being told, in this sentence,
 * that they were above the 40h weekly maximum — a different rule from the one
 * the roster applied to them, in the sentence that explains the count.
 *
 * The fallbacks are ordered by how much is actually known: the maximum among
 * the teachers THIS chip counts, then the roster-wide maximum, then the policy
 * constant. The constant is reached only for an empty roster, where no teacher
 * was miscounted and so nothing on screen is false.
 *
 * The counted set is the same predicate the chip's `count` uses, less
 * placeholders: a to-be-hired record is an unfilled slot, not a person over a
 * cap, and it is excluded from the count for the same reason it is excluded
 * here. `count` semantics are untouched by this change — several tests assert
 * that number, and it is the generation-blocking one.
 *
 * Exported so a control can drive the real derivation with a real roster
 * instead of matching this sentence as a literal in the source. A source-text
 * assertion would pass unchanged if the template silently reverted to `40h`,
 * which is the exact defect this row exists to remove.
 */
import type { FacultySummary } from '@/types';
import { MAX_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';

export function overCapWeeklyMaxHours(roster: FacultySummary[]): number {
	const counted = roster.filter((teacher) => teacher.isActiveForScheduling && !teacher.isPlaceholder &&
		(teacher.sectionTeachingHours ?? 0) > teacher.maxHoursPerWeek);
	const maximumOf = (list: FacultySummary[]) => list.reduce((max, teacher) => Math.max(max, teacher.maxHoursPerWeek ?? 0), 0);
	return maximumOf(counted) || maximumOf(roster) || MAX_WEEKLY_TEACHING_HOURS;
}

export function overCapChipHelper(roster: FacultySummary[]): string {
	return `Active teachers above the ${overCapWeeklyMaxHours(roster)}h weekly maximum. Move classes before generating.`;
}
