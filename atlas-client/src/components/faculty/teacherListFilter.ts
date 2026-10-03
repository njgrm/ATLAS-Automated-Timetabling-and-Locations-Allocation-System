/**
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — "TEACHER LIST FILTER", and what each of its
 * options actually MEANS in the data.
 *
 * THE PACKET ASKED FOR THREE OPTIONS. `Permanent`, `Substitute` and `Others`. This module is the
 * answer to what ATLAS can honestly offer, and it is deliberately smaller than the packet:
 *
 *   - `Permanent` — a HIRED teacher ATLAS can schedule. Decided by `isActiveForScheduling` and
 *     `!isPlaceholder`. Two real fields, both already on every roster row and both already load-bearing
 *     elsewhere on this page (`teacherLoadTruth` excludes placeholders from every count of people for
 *     exactly this reason).
 *   - `Others` — every record on the roster that is NOT a hired, schedulable teacher. The exact
 *     complement of `Permanent`: to-be-hired records, plus anyone excluded from scheduling. It is a
 *     real set, it is never empty by construction, and it needs no new field.
 *   - `Substitute` — NOT OFFERED, because ATLAS HAS NO SUBSTITUTE. EnrollPro's faculty adapter writes
 *     `employmentStatus: 'PERMANENT'` for every teacher it syncs
 *     (`atlas-server/src/services/faculty-adapter.ts`), so the `employment_status` column carries one
 *     value on a synced roster, and the only substitute-shaped record in the system
 *     (`TEMPORARY_SUBSTITUTE`) is a preview row whose `facultyId` is null and which is never saved
 *     (`atlas-server/src/services/teaching-load-automation.service.ts`). A `Substitute` option would
 *     therefore be a filter that can only ever answer "nobody" — a control that claims ATLAS knows a
 *     distinction it cannot make. It is reported as NEEDS_DECISION, not faked.
 *
 * WHY A MODULE AND NOT A LINE IN THE PAGE. Two surfaces read this predicate: the roster's own filter
 * (client-side, over the page it already holds) and the attention-chip row. A second inline spelling
 * of "is this a person" is the defect `teacherLoadTruth.ts` exists to prevent, so the predicate is
 * stated once here and both surfaces read it.
 */

/** The minimum a roster row needs for this filter. Every field is on `FacultySummary`. */
export type TeacherListFilterRow = {
	isActiveForScheduling: boolean;
	/** The roster's own flag: a to-be-hired record, not a hired person. */
	isPlaceholder: boolean;
};

/** The filter's selected value. `Substitute` is intentionally absent — see the note above. */
export type TeacherListFilterValue = 'all' | 'permanent' | 'others';

/**
 * Every value the type admits, as data.
 *
 * `facultyFilterCopy` holds the LABELS and this holds the VALUES, and nothing restates either. A
 * control cannot offer an option whose value is missing from this list, so the two cannot fall out of
 * step, and a test can assert the filter's whole value space without naming a value the type forbids.
 */
export const TEACHER_LIST_FILTER_VALUES: readonly TeacherListFilterValue[] = ['all', 'permanent', 'others'];

/**
 * `Permanent`: a HIRED teacher ATLAS can schedule.
 *
 * It is `isActiveForScheduling && !isPlaceholder`, which is the same person-test
 * `teacherLoadTruth.ts` calls `isRealActive`. Reusing it is the point: the roster's own count of
 * active teachers and this filter's `Permanent` option must not be able to disagree about how many
 * people there are.
 */
export function isPermanentTeacher(row: TeacherListFilterRow): boolean {
	return row.isActiveForScheduling && !row.isPlaceholder;
}

/**
 * `Others`: the exact complement of `Permanent`.
 *
 * Computed as `!isPermanentTeacher(row)` rather than re-spelled as
 * `!isActiveForScheduling || isPlaceholder`. The two are equivalent today, but only one of them
 * stays the complement when a third state is added later: re-spelling the negation is how a filter
 * silently starts overlapping the one beside it.
 */
export function isOtherTeacher(row: TeacherListFilterRow): boolean {
	return !isPermanentTeacher(row);
}

/** Whether ONE roster row belongs in the currently-selected slice. An unknown value matches nothing rather than everything. */
export function teacherListFilterMatches(row: TeacherListFilterRow, value: TeacherListFilterValue): boolean {
	if (value === 'permanent') return isPermanentTeacher(row);
	if (value === 'others') return isOtherTeacher(row);
	return value === 'all';
}

/** Filter a roster down to the selected slice, without mutating the input. */
export function applyTeacherListFilter<T extends TeacherListFilterRow>(
	roster: readonly T[],
	value: TeacherListFilterValue,
): T[] {
	if (value === 'all') return [...roster];
	return roster.filter((row) => teacherListFilterMatches(row, value));
}