/**
 * A5 C3 slice B (2026-09-29) — `/faculty`'s teacher-list filter row, extracted and on the one
 * shared picker.
 *
 * B3, FIRST. `AGENTS.md` §8 caps a React component file at **1000 physical lines** and this
 * extraction has to land in the SAME commit as the conversion, or the conversion alone would
 * push `pages/Faculty.tsx` over the cap. Re-derived at `419277e4` by
 * `[System.IO.File]::ReadAllLines(...).Count`: **981 physical lines, 914 non-blank, 67 blank.**
 * (R1 J1 quoted 981 — correct for physical lines; QA's 915 is the non-blank count, off by one.
 * Both are recorded rather than one being "corrected", because a cap that is checked with two
 * different counters is a cap that will eventually be checked wrong.)
 *
 * The filter row moves out whole: the filters, the disclosure's contents and
 * the conditional `Reset filters` button. What does NOT move is the layout decision — how
 * many filters are always visible versus behind a disclosure — which A5 c8 settled for the
 * whole product: ALL of them, in one wrapping row, with no disclosure anywhere.
 *
 * BEFORE: four Radix `@/ui/select` triggers at `h-10 w-44 text-sm bg-background` and
 * `h-10 w-36 text-sm bg-background` — a taller, wider, larger-type control than every other
 * filter in the product, with a page-local background on top.
 * AFTER: four `FilterPicker`s on the shared `@/ui/picker-trigger` variant, one width, one
 * height shared with the search box, R2-5's search box suppressed on every list short enough not
 * to need one, and R3-1's self-naming trigger (`Grade: All`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * D6 (2026-10-03, `forReview/miss-jo-1.docx`) — THE TEACHER-LIST REDESIGN. ONE CONTROL FEWER.
 *
 * The member's document renames `Roster` to `Teacher List`, adds a `GRADE LEVEL` wording, asks
 * for the load state to become a COLOUR on the department result instead of its own filter, and
 * asks for the search box to replace the reset affordance.
 *
 * WHAT LEFT, AND WHY THAT IS THE POINT. `Roster`, `Load`, `Department`, `Grade` — four filters.
 * `Teacher list`, `Department`, `Grade level` — THREE. Net visible controls on this row go DOWN by
 * one and the `Load` filter is gone entirely, because the member's own sentence says the load
 * state should "remove the load filter on the current system" and become a colour on the row. Adding
 * a `Loading` toggle as well — the document's `LOADING BUTTON: with load / non load` — would put the
 * SAME FACT back on screen as a control beside the colour that now states it, which is `AGENTS.md`
 * §8's "never two chips that say the same thing" and its design-gate rule 3, subtract first. The
 * roster's own `No subjects assigned` chip already filters to exactly that set, so the capability
 * the `LOADING BUTTON` asked for is not lost — it is one control instead of two.
 *
 * WORDS LIVE IN `facultyFilterCopy.ts`, not here, so a wording change is a one-file edit and every
 * committed test that asserts a label asserts the label this component actually renders.
 */
import { FilterPicker } from '@/ui/filter-picker';
import { GRADE_OPTIONS } from '@/lib/subject-constants';
import { departmentLabel } from '@/lib/deped-glossary';
import {
	ALL_DEPARTMENTS_OPTION_LABEL,
	ALL_GRADES_OPTION_LABEL,
	DEPARTMENT_FILTER_ARIA_LABEL,
	DEPARTMENT_FILTER_NAME,
	GRADE_LEVEL_FILTER_ARIA_LABEL,
	GRADE_LEVEL_FILTER_NAME,
	TEACHER_LIST_FILTER_ARIA_LABEL,
	TEACHER_LIST_FILTER_NAME,
	TEACHER_LIST_FILTER_OPTIONS,
} from '@/components/faculty/facultyFilterCopy';
import type { TeacherListFilterValue } from '@/components/faculty/teacherListFilter';

export type FacultyFilterRowProps = {
	teacherListFilter: TeacherListFilterValue;
	onTeacherListFilterChange: (value: string) => void;
	/** Empty hides the department filter entirely — a page with one department offers no choice. */
	departments: string[];
	departmentFilter: string;
	onDepartmentFilterChange: (value: string) => void;
	gradeLevelFilter: number | 'all';
	onGradeLevelFilterChange: (value: number | 'all') => void;
};

export function FacultyFilterRow({
	teacherListFilter,
	onTeacherListFilterChange,
	departments,
	departmentFilter,
	onDepartmentFilterChange,
	gradeLevelFilter,
	onGradeLevelFilterChange,
}: FacultyFilterRowProps) {
	return (
		<>
			<FilterPicker
				name={TEACHER_LIST_FILTER_NAME}
				width="auto"
				ariaLabel={TEACHER_LIST_FILTER_ARIA_LABEL}
				value={teacherListFilter}
				onValueChange={onTeacherListFilterChange}
				options={[...TEACHER_LIST_FILTER_OPTIONS]}
				dataTestId="teachers-list-filter"
			/>
			{departments.length > 0 && (
				<FilterPicker
					name={DEPARTMENT_FILTER_NAME}
					width="auto"
					ariaLabel={DEPARTMENT_FILTER_ARIA_LABEL}
					value={departmentFilter}
					onValueChange={onDepartmentFilterChange}
					/* Data-derived: a school with more than eight departments earns R2-5's
					 * search box, and one with fewer does not. The rule is the same rule
					 * everywhere, which is the point. */
					options={[
						{ value: 'all', label: ALL_DEPARTMENTS_OPTION_LABEL },
						...departments.map((d) => ({ value: d, label: departmentLabel(d) })),
					]}
				/>
			)}
			<FilterPicker
				name={GRADE_LEVEL_FILTER_NAME}
				width="auto"
				ariaLabel={GRADE_LEVEL_FILTER_ARIA_LABEL}
				value={String(gradeLevelFilter)}
				onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}
				options={[
					{ value: 'all', label: ALL_GRADES_OPTION_LABEL },
					...GRADE_OPTIONS.map((g) => ({ value: String(g), label: `Grade ${g}` })),
				]}
				dataTestId="teachers-grade-filter"
			/>
		</>
	);
}