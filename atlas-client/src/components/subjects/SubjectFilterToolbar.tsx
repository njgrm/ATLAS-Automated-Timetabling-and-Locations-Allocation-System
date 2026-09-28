import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { FilterPicker } from '@/ui/filter-picker';
import { PICKER_CONTROL_HEIGHT_CLASS } from '@/ui/picker-trigger';
import { AdminSearchFilterToolbar } from '@/components/admin-workspace/AdminWorkspace';
import { TERM_FILTER_ALL, type TermFilterOption } from './subject-term-filter';
import { gradeLabel } from '@/lib/grade-labels';
import type { RoomType } from '@/types';

/**
 * A5 (operator items 9.1 + 41): ONE status-looking control instead of two.
 *
 * The row used to render `statusFilter` ("All Status": `all | active |
 * inactive`) AND `attentionFilter` ("All statuses": `all | missing-coverage |
 * room-constrained`). Two dropdowns that both answered "status", one of them
 * lowercase-plural, is what the operator reported as a duplicate.
 *
 * They are two different AXES, so merging them into one dropdown must not drop
 * either: one value now selects across both, and the page maps it back onto the
 * two existing predicates (`Subjects.tsx`), which is why the filtering pipeline
 * downstream is untouched. Every option that used to be reachable is still
 * reachable; the label the operator wrote, `All Status`, is what renders.
 */
export type SubjectStatusFilter =
	| 'all'
	| 'active'
	| 'inactive'
	| 'missing-coverage'
	| 'room-constrained';

type Props = {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	hasActiveFilters: boolean;
	/** A5: the one merged status control — subject lifecycle AND coverage attention. */
	subjectStatusFilter: SubjectStatusFilter;
	onSubjectStatusFilterChange: (value: SubjectStatusFilter) => void;
	roomTypeFilter: string;
	onRoomTypeFilterChange: (value: string) => void;
	gradeLevelFilter: number | 'all';
	onGradeLevelFilterChange: (value: number | 'all') => void;
	programScopeFilter: string;
	onProgramScopeFilterChange: (value: string) => void;
	/** A3-C9: the term filter. Options are derived from the real subject data. */
	termFilter: string;
	onTermFilterChange: (value: string) => void;
	termOptions: TermFilterOption[];
	onResetFilters: () => void;
};

/**
 * A5 C3 R3 §1 — the room types' SHORT trigger labels.
 *
 * The popover option list keeps `ROOM_TYPE_LABELS` exactly (`Science Laboratory`,
 * `ICT / Computer Lab`) because that list has the room and that is where a scheduler reads
 * the choices. Only the trigger's fixed rectangle is compact, so the value shown there is the
 * same room in the short words an office already uses. No room type is renamed in either place;
 * these are two lengths of the same nine names.
 */
const ROOM_TYPE_SHORT_LABELS: Record<string, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Laboratory',
	COMPUTER_LAB: 'Computer lab',
	TLE_WORKSHOP: 'Workshop',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gymnasium',
	FACULTY_ROOM: 'Faculty room',
	OFFICE: 'Office',
	OTHER: 'Other',
};

/**
 * A5 C3 (2026-09-29) — THE TRIGGER DIMENSIONS ARE NO LONGER DECLARED HERE.
 *
 * The five filters were five `@/ui/select` (Radix) triggers carrying a page-local
 * `COMPACT_SELECT` string and five different widths — `w-40`/`w-24`/`w-28`/`w-36`/`w-28`
 * (160/96/112/144/112px). That is the "filters are pills beside rectangular pickers, widths are
 * uneven" defect the operator screenshotted on 2026-09-29, and `AGENTS.md` §8 "One look per
 * control" settles it: the trigger's size, border, placeholder style and search behaviour belong
 * to `@/ui`, not to a page.
 *
 * So this file now names a filter and supplies its options. Height, width, radius, border, case
 * and the option-list search box all come from `@/ui/filter-picker` + `@/ui/picker-trigger`.
 * A future divergence is a guard failure, not a decision someone makes twice.
 */

export function SubjectFilterToolbar({
	searchQuery,
	onSearchChange,
	hasActiveFilters,
	subjectStatusFilter,
	onSubjectStatusFilterChange,
	roomTypeFilter,
	onRoomTypeFilterChange,
	gradeLevelFilter,
	onGradeLevelFilterChange,
	programScopeFilter,
	onProgramScopeFilterChange,
	termFilter,
	onTermFilterChange,
	termOptions,
	onResetFilters,
}: Props) {
	// A3-C10 (FIX-15 re-issued): ONE row of controls, and NOTHING in it is a
	// disclosure. c9 removed the "More filters" row but left Room Type and
	// Program behind a single combined "Room & program" popover trigger, so
	// reaching "Room Type" still cost an initial click on a control that is not
	// Room Type. Each is now its own `Select` — the same primitive, with the same
	// one-click-to-open-then-choose shape. There is no grouping button left, so
	// there is nothing to disclose through.
	//
	// A5 (items 9.1 + 41) re-issued it again, in the operator's order:
	//   Search | All Status | All Grades | All Programs | All Room Types
	// on one `flex flex-wrap items-center gap-2.5` cluster that is a single line
	// at 1366px and wraps cleanly below it. The green EnrollPro strip is gone
	// (A3-C10) and stays gone — this row is the only thing above the table.
	//
	// THE TERM FILTER IS THE FIFTH CONTROL, RETAINED DELIBERATELY. The
	// operator's list of four does not mention it. Deleting a working planning
	// filter to satisfy a compaction request is a silent capability regression,
	// so it stays, compact, in the same row; it is one `SelectItem` in this
	// component to remove if that is ever wanted.
	//
	// WIDTH BUDGET at 1366 (R3 §1 arithmetic, measured from the Tailwind width classes
	// these elements carry — NOT a rendered pixel result; jsdom has no layout engine):
	//   search w-[240px] = 240, its gap = 10,
	//   5 filters x w-32 (8rem) = 5 x 128 = 640,
	//   4 cluster gaps x 10 (gap-2.5) = 40, reset (text) = 80
	//   =>  1010px.
	// The 1366px viewport minus the 256px expanded sidebar, the 40px page padding at
	// `lg`, and the toolbar card's 8px inset leaves ~1062px — 52px of slack, so the
	// cluster holds ONE line. The previous `w-52` with R1 A1's `Room type: All room
	// types` came to 1420px and wrapped 3+2; the compact trigger is what removed the
	// wrap, not a narrower box, a smaller font, or a filter pushed behind `More`.
	return (
		<AdminSearchFilterToolbar
			searchValue={searchQuery}
			onSearchChange={onSearchChange}
			searchPlaceholder="Search name or code..."
			filtersOpen={false}
			onToggleFilters={() => {}}
			hasActiveFilters={hasActiveFilters}
			/* A3-C10: the single wrapping cluster is the one primary child. It is
			   a child of the row rather than a sibling set of children, which is
			   what lets it wrap. */
			primaryFilterCount={1}
			primaryFilterLayout="inline"
			searchMaxWidthClassName="w-[240px] max-w-[240px]"
			/* A5: the search box matches the compact triggers' type size, and takes its
			   HEIGHT from the same `@/ui` token the triggers take theirs from (R1 J3) —
			   one `h-9`, not two hand-matched literals.

			   `sm:text-xs` is NOT redundant. `@/ui` `Input` ends its base class
			   with the responsive pair `text-base … sm:text-sm`, and
			   tailwind-merge treats `sm:text-sm` as a different variant from a
			   bare `text-xs`, so it keeps BOTH — and at any viewport ≥640px the
			   `sm:` variant wins. The real-browser row measured 14px and caught
			   exactly that: a class-list assertion could not, because the
			   class-list assertion was true. */
			searchInputClassName={`${PICKER_CONTROL_HEIGHT_CLASS} pl-9 text-xs sm:text-xs`}
		>
			<div
				className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5"
				data-testid="subjects-filter-cluster"
			>
				{/* R3 §1: the operator's own words are `Grade: All`, `Program: All` — the
				    TRIGGER shows the filter's short name and a short value, the POPOVER keeps
				    the full labels, and the ACCESSIBLE NAME keeps the long form composed from
				    `ariaLabel`. R1 A1's `Grade: All grades` was the packet's own lengthening of
				    that example, and it is what forced the cluster to wrap. This is
				    `/timetable`'s entity picker unchanged: a compact trigger over a list of
				    long options (R2-6 rule 5). */}
				<FilterPicker
					name="Status"
					ariaLabel="Filter by subject status"
					value={subjectStatusFilter}
					onValueChange={(v) => onSubjectStatusFilterChange(v as SubjectStatusFilter)}
					options={[
						{ value: 'all', label: 'All statuses' },
						{ value: 'active', label: 'Active' },
						{ value: 'inactive', label: 'Archived' },
						/* The coverage-attention axis, folded into the one status
						   control rather than dropped (see `SubjectStatusFilter`). */
						{ value: 'missing-coverage', label: 'Missing teacher coverage' },
						{ value: 'room-constrained', label: 'Room-constrained subjects' },
					]}
					shortLabels={{
						active: 'Active',
						inactive: 'Archived',
						'missing-coverage': 'No coverage',
						'room-constrained': 'Room-constrained',
					}}
					dataTestId="subjects-status-filter"
				/>
				<FilterPicker
					name="Grade"
					ariaLabel="Filter by grade level"
					value={String(gradeLevelFilter)}
					onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}
					options={[
						{ value: 'all', label: 'All grades' },
						...GRADE_OPTIONS.map((g) => ({
							value: String(g),
							/* The shared compact grade form (`GR7`), the same one
							   the grade chips and the coverage dialog use — not
							   `Grade 7`, and not a second spelling. */
							label: gradeLabel(g),
						})),
					]}
				/>
				<FilterPicker
					name="Program"
					ariaLabel="Filter by program scope"
					value={programScopeFilter}
					onValueChange={(v) => onProgramScopeFilterChange(v)}
					options={[
						{ value: 'all', label: 'All programs' },
						...PROGRAM_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
					]}
					dataTestId="subjects-program-filter"
				/>
				{/*
				 * A3-C10, unchanged in substance: Room Type and Program are DIRECT
				 * filters. Each trigger is the filter itself — it shows the current
				 * value, it is named, and it opens its OWN listbox in one click. A5
				 * C3 changes only the primitive and the chrome, never the reach: there
				 * is still no parent control grouping the two, so there is still no
				 * disclosure click between the operator and the filter.
				 */}
				<FilterPicker
					name="Room"
					ariaLabel="Filter by room type"
					value={roomTypeFilter}
					onValueChange={(v) => onRoomTypeFilterChange(v)}
					options={[
						{ value: 'all', label: 'All room types' },
						...ALL_ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] })),
					]}
					/* R3 §1: the popover keeps the full labels (`Science Laboratory`,
					   `ICT / Computer Lab`); only the trigger's rectangle is compact. */
					shortLabels={ROOM_TYPE_SHORT_LABELS}
					dataTestId="subjects-room-type-filter"
				/>
				{/* A3-C9, retained as the fifth compact control — see the note above. */}
				<FilterPicker
					name="Term"
					ariaLabel="Filter by rotation term"
					value={termFilter}
					onValueChange={onTermFilterChange}
					options={termOptions.map((option) => ({ value: option.value, label: option.label }))}
				/>


				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-9 shrink-0 whitespace-nowrap px-3 text-xs text-muted-foreground hover:text-foreground"
						data-testid="subjects-reset-filters"
						onClick={onResetFilters}
					>
						Reset
					</Button>
				)}
			</div>
		</AdminSearchFilterToolbar>
	);
}

/** Re-exported so a caller can compare a stored value against the default. */
export { TERM_FILTER_ALL };
