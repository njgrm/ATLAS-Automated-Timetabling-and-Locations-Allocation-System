/**
 * The /sections row sorter, extracted from `pages/Sections.tsx`.
 *
 * WHY A MODULE (A2 c15 correction B2). The "Grade" column used to sort with
 * `a.gradeLevelId - b.gradeLevelId` — the raw EnrollPro `grade_level_id`, an
 * opaque FK that re-mints on every wipe or rollover (observed on staging:
 * 5..8, then 17..20, then 1..4 as of 2026-09-28). The column claimed to sort by
 * grade while ordering by an id space. Routing it through the one client
 * authority fixed that, and pushed `Sections.tsx` to 1003 physical lines, over
 * the AGENTS §8 1000-line ceiling — so the comparator now lives here, where it
 * is also directly testable instead of only reachable through a rendered page.
 *
 * A section that names no real grade sorts LAST. It is never sorted as grade 0
 * or grade 1, and it never borrows another grade's position.
 */
import type { ExternalSection } from '@/types';
import { resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import type { SortDir, SortField } from '@/components/sections/SectionsSortableHeader';

export type { SortDir, SortField };

/** The real grade a row sorts under, or `null` when it names no grade. */
export function sectionSortGrade(section: ExternalSection): number | null {
	return resolveSectionGradeNumber(section);
}

/**
 * The one comparator behind the /sections table header. `gradeLevelId` is the
 * sort FIELD NAME the header has always carried; the value it orders by is the
 * resolved grade, which is what the operator is actually reading.
 */
export function compareSections(
	a: ExternalSection,
	b: ExternalSection,
	sortField: SortField,
	sortDir: SortDir,
): number {
	let cmp = 0;
	if (sortField === 'name') {
		cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
	} else if (sortField === 'gradeLevelId') {
		const gradeA = sectionSortGrade(a) ?? Number.MAX_SAFE_INTEGER;
		const gradeB = sectionSortGrade(b) ?? Number.MAX_SAFE_INTEGER;
		cmp = gradeA - gradeB;
		if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
	} else if (sortField === 'enrolledCount') {
		cmp = a.enrolledCount - b.enrolledCount;
	} else if (sortField === 'maxCapacity') {
		cmp = a.maxCapacity - b.maxCapacity;
	} else if (sortField === 'fill') {
		const fillA = a.maxCapacity > 0 ? a.enrolledCount / a.maxCapacity : 0;
		const fillB = b.maxCapacity > 0 ? b.enrolledCount / b.maxCapacity : 0;
		cmp = fillA - fillB;
	}
	return sortDir === 'desc' ? -cmp : cmp;
}
