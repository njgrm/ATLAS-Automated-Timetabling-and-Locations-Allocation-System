/**
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — THE Teachers filter bar's WORDS, in one file.
 *
 * WHY THIS FILE EXISTS. The packet renames a filter, so a literal pasted at the call site would make
 * a wording change a four-file edit and leave the committed tests holding a string that no longer
 * exists on screen. Every user-facing sentence the redesigned Teachers filter row shows — the
 * filter's own name, its options, its accessible names, the search box's placeholder — is declared
 * HERE once, and both the component and its tests import it. Changing a word is then a one-file
 * edit, and a test that asserts a label asserts the label the component actually renders.
 *
 * IT IS A COPY MODULE AND NOTHING ELSE: no React, no state, no arithmetic. Anything that has to
 * DECIDE something lives in `teacherListFilter.ts` / `teacherLoadColour.ts` beside it.
 */

/** D6 §1 — the `Roster` filter, renamed in the member's own words. */
export const TEACHER_LIST_FILTER_NAME = 'Teacher list';

/** D6 §4 — the `Grade` filter, renamed to the member's `GRADE LEVEL`. */
export const GRADE_LEVEL_FILTER_NAME = 'Grade level';

/** D6 §1 — the department filter's own name. Unchanged by this packet; named here so all three sit together. */
export const DEPARTMENT_FILTER_NAME = 'Department';

export const TEACHER_LIST_FILTER_ARIA_LABEL = 'Filter teachers by employment in the teacher list';

export const DEPARTMENT_FILTER_ARIA_LABEL = 'Filter by department';

export const GRADE_LEVEL_FILTER_ARIA_LABEL = 'Filter by grade level';

/**
 * D6 §1 — THE OPTIONS, and the honest state of each.
 *
 * `Permanent` is the member's word for a hired teacher ATLAS can actually schedule. It is backed by
 * two real fields on the roster row: `isActiveForScheduling` and `isPlaceholder`. `Others` is its
 * complement — every record on the roster that is not a hired, schedulable teacher: to-be-hired
 * records plus anyone excluded from scheduling. Both are real, and `teacherListFilter.ts` states
 * exactly which two fields decide them.
 *
 * `Substitute` is DELIBERATELY ABSENT. `forReview/miss-jo-1.docx` asks for it, and ATLAS holds no
 * field for it: EnrollPro's faculty adapter writes `employmentStatus: 'PERMANENT'` for every
 * teacher it syncs (`atlas-server/src/services/faculty-adapter.ts`), so that column has exactly one
 * value on a synced roster, and the only substitute-shaped record in the system
 * (`TEMPORARY_SUBSTITUTE`) is a preview row with a null `facultyId` that is never saved. Shipping a
 * `Substitute` option would be a control that always answers "nobody" — a filter that lies about
 * what ATLAS knows. It is reported as NEEDS_DECISION instead, and this comment is why.
 *
 * The unset option is `All teachers`, and the trigger shortens it to `All` — `FilterPicker` does
 * that for every filter in the product, which is why it is not restated here.
 */
export const TEACHER_LIST_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: 'all', label: 'All teachers' },
	{ value: 'permanent', label: 'Permanent' },
	{ value: 'others', label: 'Others' },
];

export const ALL_GRADES_OPTION_LABEL = 'All grades';

export const ALL_DEPARTMENTS_OPTION_LABEL = 'All Departments';

/**
 * D6 §3 — THE SEARCH BOX.
 *
 * The document lists four things it wants the one search box to cover: by subject, by grade level,
 * by loading, by non-loading. See the packet report for what this placeholder says about each. The
 * placeholder is SHORT ON PURPOSE, and it is budgeted rather than guessed: the bar's search wrapper
 * is a FIXED `w-[240px]` with a 16px leading icon and roughly 16px of padding on each side, which
 * leaves about 190px of text at the bar's own type size — around 22 characters. The previous
 * placeholder was 47 characters and the member's screenshot shows it cut off mid-phrase; a longer one
 * would only move where the truncation falls, and a truncated sentence is an `AGENTS.md` §8 failure.
 *
 * `Search teachers` is what fits in that budget with room to spare, and it is honest: name is what a
 * scheduler types here, and department and specialization are matched by the same query behind it.
 */
export const TEACHER_SEARCH_PLACEHOLDER = 'Search teachers';

/**
 * The accessible name keeps the FULL list of what is matched, because a screen reader has no width
 * limit and the placeholder is deliberately short. The two must agree with each other, so both are
 * written here rather than one being derived from a truncated copy of the other.
 */
export const TEACHER_SEARCH_ARIA_LABEL = 'Search teachers by name, department, or specialization';