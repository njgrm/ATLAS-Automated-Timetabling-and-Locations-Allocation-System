/**
 * A2 place-one-action — the pre-generation DRAFT grid projection and view filter.
 *
 * The projection and the filter used to live inline in `useTimetableData.ts`. They
 * are extracted here for two reasons:
 *
 *  1. The projection DROPPED the placement's persisted `termIndex`, so every
 *     committed draft placement became invisible the moment a NUMERIC term was
 *     selected: `filterDraftEntriesForView` runs each entry through
 *     `matchesTermScope`, which returns false for a null/undefined `termIndex`
 *     under a numeric term. Carrying `termIndex` here is the fix for "invisible
 *     after placing".
 *  2. A rendered control can exercise the REAL projection + the REAL term
 *     predicate against the REAL grid, instead of asserting source text.
 */
import { matchesEntryKindFilter, matchesProgramFilter } from '@/lib/schedule-review-helpers';
import { matchesTermScope } from '@/lib/timetable-term-scope';
import { minutesBetween } from '@/lib/timetable-utils';
import type {
	DraftPlacement,
	EntryKindFilter,
	ExternalSection,
	ProgramFilter,
	ScheduledEntry,
} from '@/types';

/**
 * Project the draft board's DRAFT placements into grid entries. A placement with
 * no resolved owner or room is not grid-renderable and is skipped, exactly as the
 * inline projection did. `termIndex` is CARRIED, never defaulted: an unscoped
 * legacy placement stays unscoped and still fails a numeric term filter.
 */
export function projectDraftPlacementsToEntries(placements: readonly DraftPlacement[]): ScheduledEntry[] {
	return placements
		.filter((placement) => placement.status === 'DRAFT' && placement.facultyId != null && placement.roomId != null)
		.map((placement) => ({
			entryId: `draft-placement-${placement.id}`,
			facultyId: placement.facultyId!,
			roomId: placement.roomId!,
			subjectId: placement.subjectId,
			sectionId: placement.sectionId,
			day: placement.day,
			startTime: placement.startTime,
			endTime: placement.endTime,
			durationMinutes: minutesBetween(placement.startTime, placement.endTime),
			entryKind: placement.entryKind,
			cohortCode: placement.cohortCode ?? null,
			termIndex: placement.termIndex ?? undefined,
		}));
}

/**
 * The one view filter the pre-generation grid uses. Term is the authoritative
 * schedule scope: an entry belongs to exactly one numeric term, and an entry with
 * no `termIndex` is visible only in all-term review.
 */
export function filterDraftEntriesForView(
	entries: readonly ScheduledEntry[],
	options: {
		programFilter: ProgramFilter;
		entryKindFilter: EntryKindFilter;
		termFilter: 'all' | number;
		sectionMap: Map<number, ExternalSection>;
	},
): ScheduledEntry[] {
	return entries.filter((entry) => {
		const programType = entry.programType ?? options.sectionMap.get(entry.sectionId)?.programType ?? null;
		if (!matchesProgramFilter(programType, options.programFilter)) return false;
		if (!matchesEntryKindFilter(entry.entryKind, options.entryKindFilter)) return false;
		if (!matchesTermScope(entry, options.termFilter)) return false;
		return true;
	});
}
