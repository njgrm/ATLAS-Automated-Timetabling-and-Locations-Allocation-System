/**
 * A5 C3 slice B (2026-09-29) — `/faculty`'s roster filter row, extracted and on the one
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
 * The filter row moves out whole: the four filters, the `More filters` disclosure's contents and
 * the conditional `Reset filters` button. What does NOT move is the disclosure decision — how
 * many filters are always visible versus behind `More` is a page question about layout, not
 * about how a control looks, and A3-15's `primaryFilterCount` behaviour in
 * `AdminSearchFilterToolbar` is unchanged by this slice.
 *
 * BEFORE: four Radix `@/ui/select` triggers at `h-10 w-44 text-sm bg-background` and
 * `h-10 w-36 text-sm bg-background` — a taller, wider, larger-type control than every other
 * filter in the product, with a page-local background on top.
 * AFTER: four `FilterPicker`s on the shared `@/ui/picker-trigger` variant, one width, one
 * height shared with the search box, R2-5's search box suppressed on every list short enough not
 * to need one, and R3-1's self-naming trigger (`Grade: All`).
 *
 * EVERY WORD IS THE PAGE'S OWN — `All roster states`, `Active teachers`, `Excluded teachers`,
 * `All load states`, `With teaching load`, `Needs teaching load`, `All Departments`,
 * `All grades`, `Grade {n}`. The accessible names keep the long form, and
 * `data-testid="teachers-grade-filter"` is preserved so the committed suites that reach for it
 * keep working.
 */
import { FilterPicker } from '@/ui/filter-picker';
import { Button } from '@/ui/button';
import { GRADE_OPTIONS } from '@/lib/subject-constants';
import { departmentLabel } from '@/lib/deped-glossary';

export type FacultyFilterRowProps = {
	schedulingFilter: string;
	onSchedulingFilterChange: (value: string) => void;
	assignmentFilter: string;
	onAssignmentFilterChange: (value: string) => void;
	/** Empty hides the department filter entirely — a page with one department offers no choice. */
	departments: string[];
	departmentFilter: string;
	onDepartmentFilterChange: (value: string) => void;
	gradeLevelFilter: number | 'all';
	onGradeLevelFilterChange: (value: number | 'all') => void;
	hasActiveFilters: boolean;
	onClearAllFilters: () => void;
};

export function FacultyFilterRow({
	schedulingFilter,
	onSchedulingFilterChange,
	assignmentFilter,
	onAssignmentFilterChange,
	departments,
	departmentFilter,
	onDepartmentFilterChange,
	gradeLevelFilter,
	onGradeLevelFilterChange,
	hasActiveFilters,
	onClearAllFilters,
}: FacultyFilterRowProps) {
	return (
		<>
			<FilterPicker
				name="Roster"
				ariaLabel="Filter by teacher roster state"
				value={schedulingFilter}
				onValueChange={onSchedulingFilterChange}
				options={[
					{ value: 'all', label: 'All roster states' },
					{ value: 'active', label: 'Active teachers' },
					{ value: 'excluded', label: 'Excluded teachers' },
				]}
			/>
			<FilterPicker
				name="Load"
				ariaLabel="Filter by teaching load state"
				value={assignmentFilter}
				onValueChange={onAssignmentFilterChange}
				options={[
					{ value: 'all', label: 'All load states' },
					{ value: 'assigned', label: 'With teaching load' },
					{ value: 'unassigned', label: 'Needs teaching load' },
				]}
			/>
			{departments.length > 0 && (
				<FilterPicker
					name="Department"
					ariaLabel="Filter by department"
					value={departmentFilter}
					onValueChange={onDepartmentFilterChange}
					/* Data-derived: a school with more than eight departments earns R2-5's
					 * search box, and one with fewer does not. The rule is the same rule
					 * everywhere, which is the point. */
					options={[
						{ value: 'all', label: 'All Departments' },
						...departments.map((d) => ({ value: d, label: departmentLabel(d) })),
					]}
				/>
			)}
			<FilterPicker
				name="Grade"
				ariaLabel="Filter by grade taught"
				value={String(gradeLevelFilter)}
				onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}
				options={[
					{ value: 'all', label: 'All grades' },
					...GRADE_OPTIONS.map((g) => ({ value: String(g), label: `Grade ${g}` })),
				]}
				dataTestId="teachers-grade-filter"
			/>
			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					className="px-3 text-sm text-muted-foreground hover:text-foreground font-semibold"
					onClick={onClearAllFilters}
				>
					Reset filters
				</Button>
			)}
		</>
	);
}
