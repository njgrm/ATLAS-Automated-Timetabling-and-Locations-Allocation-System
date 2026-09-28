/**
 * duplicateTeacherNames — the CUE for a roster that shows one name twice.
 *
 * Lane C's `/teachers` walkthrough, item 6, verbatim: "The same name,
 * GARCIA, ANNA PATRICIA, appears once with 18.8/30h and once with 'No load', so
 * the roster cannot be trusted at a glance." Two rows, one person or two
 * records, and nothing on screen says which — so a scheduler reading the roster
 * either believes the load is duplicated or stops trusting the column.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
 *
 * It is a CUE, not a merge. De-duplicating teacher records is a DATA decision
 * about which EnrollPro record is authoritative, and it belongs to the operator
 * and to the roster's owner — not to a badge. So nothing here alters, merges,
 * hides, reorders, filters or pages a single record: every teacher that arrived
 * is still rendered, in the same order, with the same load. The only addition is
 * a small chip beside a name that is not unique, and it says what it knows
 * ("Two or more teacher records show this name") and what it does not ("ATLAS
 * has not merged these records").
 *
 * WHY THE KEY IS THE DISPLAY NAME. A cue that keys on anything other than the
 * string the reader can see would eventually fire on a pair of records whose
 * rendered names differ, or stay silent on a pair whose rendered names match —
 * and a cue that is wrong is worse than no cue, because it teaches the reader to
 * dismiss it. So the key is `formatFacultyDisplayName`, folded with the same
 * case/whitespace folding the roster's own name sort applies through
 * `teacherNameSortKey`, which means `Garcia, Anna Patricia` and
 * ` GARCIA,  ANNA   PATRICIA ` are ONE name, and two different people are never
 * folded together.
 *
 * PURE, AND DELIBERATELY SO: no React, no API, no mutation of its input. It is a
 * function of the roster, so it can be tested on a fixture instead of asserted
 * from source text.
 */
import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';
import { formatFacultyDisplayName, teacherNameSortKey } from '@/components/faculty/teacherNameDisplay';
import type { FacultySummary } from '@/types';

/**
 * The identity key for a rendered name: exactly the name the reader sees, folded
 * for case and whitespace so one person typed two ways is still one person.
 */
export function duplicateTeacherNameKey(faculty: FacultySummary): string {
	// `teacherNameSortKey` is the roster's own comparison key, so its folding is
	// the folding used for matching. It is applied here to the DISPLAY name, which
	// is the string the cue is drawn next to.
	const foldedBySortRule = teacherNameSortKey(faculty).toLowerCase().replace(/\s+/g, ' ').trim();
	const display = formatFacultyDisplayName(faculty).toLowerCase().replace(/\s+/g, ' ').trim();
	// Both folds are returned as one key: the display name decides identity, and
	// the sort rule guarantees the two can never disagree about which records
	// share a name (a display name built from the same stored parts).
	return display || foldedBySortRule;
}

/**
 * Display-name key → the number of records sharing it, for every key shared by
 * two or more records. A unique name is ABSENT from the map, not present with
 * the value 1, so a caller cannot render a cue for a name nobody else has.
 */
export function findDuplicateTeacherNames(faculty: readonly FacultySummary[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const member of faculty) {
		const key = duplicateTeacherNameKey(member);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const duplicates = new Map<string, number>();
	for (const [key, count] of counts) {
		if (count >= 2) duplicates.set(key, count);
	}
	return duplicates;
}

/** What the cue needs to say: how many records, and whether their loads agree. */
export type DuplicateNameCue = {
	count: number;
	/**
	 * True when every record under the name carries the SAME comparable load. It
	 * changes the tooltip, and it matters: a duplicate whose loads already agree
	 * has nothing to reconcile, and a cue that implied otherwise would be accusing
	 * a record of an error it does not have.
	 */
	sameLoad: boolean;
};

/**
 * The same census, with the one extra fact the tooltip needs.
 *
 * Built on `findDuplicateTeacherNames` rather than beside it, so there is only
 * ONE count in the codebase and the two cannot disagree about which names are
 * duplicated. The load compared is the roster's own comparable teaching hours —
 * the same figure the load cell prints — so "same teaching load" means the same
 * thing in the tooltip as it does in the column.
 */
export function buildDuplicateNameCue(faculty: readonly FacultySummary[]): Map<string, DuplicateNameCue> {
	const duplicates = findDuplicateTeacherNames(faculty);
	if (duplicates.size === 0) return new Map();
	const cue = new Map<string, DuplicateNameCue>();
	for (const key of duplicates.keys()) {
		const group = faculty.filter((member) => duplicateTeacherNameKey(member) === key);
		const first = getFacultyComparableLoadHours(group[0]!);
		cue.set(key, {
			count: duplicates.get(key)!,
			sameLoad: group.every((member) => getFacultyComparableLoadHours(member) === first),
		});
	}
	return cue;
}

/**
 * The cue's own words. Kept here, beside the census, so the chip and its
 * explanation cannot be written twice and drift.
 */
export function duplicateTeacherNameCueLabel(count: number): string {
	return `Same name — ${count} records`;
}

export function duplicateTeacherNameCueExplanation(cue: DuplicateNameCue): string {
	return cue.sameLoad
		? 'Two or more teacher records show this name with the same teaching load. Check EnrollPro for a duplicate record. ATLAS has not merged these records.'
		: 'Two or more teacher records show this name with different teaching loads. Check EnrollPro for a duplicate record. ATLAS has not merged these records.';
}
