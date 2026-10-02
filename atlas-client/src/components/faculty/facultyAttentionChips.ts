/**
 * A3 c17 x A6 c11 — THE ROSTER'S ATTENTION CHIPS, and the arithmetic that fills them.
 *
 * Extracted from `pages/Faculty.tsx` by D6 (2026-10-03) because that file was already at §8's
 * **1000 physical-line** cap — 991 at `4c4682b9` — and D6's own additions took it over. A cap that
 * is breached by a copy change is a cap that gets raised, so the block moved WHOLE and nothing
 * changed about what it computes.
 *
 * WHY IT IS A FUNCTION AND NOT A CONSTANT. Four of the five chips count, and each count is a
 * DIFFERENT question, which is the whole reason they are five chips rather than one number:
 *
 *   - `No subjects assigned` counts from `loadTruth`, the one three-state arithmetic
 *     `teacherLoadTruth.ts` owns, and it excludes to-be-hired records because a placeholder is an
 *     unfilled slot rather than a person.
 *   - `Above weekly max` counts `overCapRealCount` from the same arithmetic and takes its helper
 *     TEXT from `overCapChipHelper`, which reads the saved weekly maximum instead of a hard-coded
 *     40h (A3 c17). Decision 13 is honoured by both: only real teaching hours count toward the cap.
 *   - `No sections assigned` and `Temporary teachers` count straight off the roster, because
 *     `loadTruth` has no opinion about either: one asks about `sectionCount` among real active
 *     teachers, the other asks about `isPlaceholder` across the whole roster.
 *   - `All teachers` is the roster's own size, preferring the server's `rosterStats.totalCount`
 *     when the server has published one.
 *
 * THE A CHIP AND A FILTER ARE THE SAME FACT, NOT TWO. D6 removed the standalone `Load` filter and
 * made the load state a colour on each row; `No subjects assigned` is the control that still narrows
 * to `(subjectCount ?? 0) === 0`, which is what that filter's `unassigned` half did. One control,
 * not two — `AGENTS.md` §8's "never two chips that say the same thing", and §11's design gate rule 3.
 */
import { overCapChipHelper } from '@/components/faculty/facultyOverCapHelpers';
import type { TeacherAttentionChip } from '@/components/faculty/TeacherAttentionFilters';
import type { TeacherLoadTruth } from '@/components/faculty/teacherLoadTruth';
import type { FacultySummary } from '@/types';

/** The minimum a roster row needs for the two counts `loadTruth` does not own. */
export type AttentionChipRosterRow = Pick<FacultySummary, 'isActiveForScheduling' | 'isPlaceholder' | 'sectionCount'>;

/** The five chips, in reading order, with their counts and their one helper sentence each. */
export function facultyAttentionChips(input: {
	roster: readonly AttentionChipRosterRow[];
	loadTruth: TeacherLoadTruth;
	/** The server's published `rosterStats.totalCount`, when there is one. */
	serverTotalCount?: number | null;
}): TeacherAttentionChip[] {
	const { roster, loadTruth } = input;
	return [
		/*
		 * A3 c17 x A6 c11 union. A6 c11 owns the COUNTS (`loadTruth.*`, which excludes synthetic
		 * placeholder load); A3 c17 owns the `over-cap` helper TEXT, which must read the saved
		 * weekly maximum rather than a hard-coded 40h. Keep their counts and that helper.
		 */
		{ id: 'needs-load', label: 'No subjects assigned', helper: 'Active teachers with no subject assigned in Teaching Load.', count: loadTruth.withoutLoadCount },
		{ id: 'over-cap', label: 'Above weekly max', helper: overCapChipHelper(roster as FacultySummary[]), count: loadTruth.overCapRealCount },
		{
			id: 'no-active-load',
			label: 'No sections assigned',
			helper: 'Active teachers with no section assigned yet.',
			count: roster.filter((teacher) => teacher.isActiveForScheduling && !teacher.isPlaceholder && (teacher.sectionCount ?? 0) === 0).length,
		},
		{
			id: 'placeholders',
			label: 'Temporary teachers',
			helper: 'Placeholder records for teachers who have not been hired yet. Replace before publishing.',
			count: roster.filter((teacher) => teacher.isPlaceholder).length,
		},
		{ id: 'all', label: 'All teachers', helper: 'Clear the attention filter and show every teacher.', count: input.serverTotalCount ?? roster.length },
	];
}