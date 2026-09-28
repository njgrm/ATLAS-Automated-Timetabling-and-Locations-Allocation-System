import { ALL_ROOM_TYPES, GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS, ROOM_TYPE_LABELS } from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { FilterPicker } from '@/ui/filter-picker';
import { PICKER_CONTROL_HEIGHT_CLASS } from '@/ui/picker-trigger';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { AdminSearchFilterToolbar } from '@/components/admin-workspace/AdminWorkspace';
import { TERM_FILTER_ALL, type TermFilterOption } from './subject-term-filter';
import { gradeLabel } from '@/lib/grade-labels';
import { cn } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
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
	// A5 C4 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX.
	//
	// Lane C's Codex walk, verbatim: "Keep Grade and Program visible and put the
	// other filters under 'More filters'." Codex also confirmed this page has NO
	// truncation today, so this is not a width fix. It is about five competing
	// controls where a scheduler has to read all five to know the page is
	// filtered.
	//
	//   WHAT STAYS IN THE ROW .... the search box, `Grade`, `Program`, `Reset`
	//                              (only while a filter is set), and ONE
	//                              `More filters` disclosure.
	//   WHAT GOES BEHIND IT ...... `Status`, `Room`, `Term`. These are REFINEMENTS
	//                              - they narrow an answer the scheduler already
	//                              has. Grade and Program are the two axes a
	//                              scheduler filters BY.
	//   WHAT IT COSTS ............ three rectangles leave the visible row; one
	//                              disclosure button arrives. Net visible control
	//                              count is unchanged and the row has more slack
	//                              at 1366px, not less. This is the §11 rule-3
	//                              subtraction, not an addition.
	//   WHAT IS NOT CHANGED ..... every picker below is the SAME `@/ui/filter-picker`
	//                              with its own self-naming trigger and its own
	//                              `data-testid`; opening the disclosure changes
	//                              no value; the c3 slice-B guards (Enter on a
	//                              disabled option, and never claiming `All` for a
	//                              list that has no `all` member) still sit in
	//                              `@/ui` and are untouched.
	//
	// A3-C10's earlier note here read "There is no grouping button left, so there
	// is nothing to disclose through." That was answering a different finding
	// (a combined Room+Program trigger that stood between the operator and the
	// filter). This disclosure groups only REFINEMENTS, and each picker inside it
	// keeps its own trigger - so a scheduler still reaches `Room` in one click
	// once the group is open, and never pays a click on a control that is not
	// `Room`. The finding that closed the old grouping button is recorded above
	// and is not undone.
	const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

	// THE COUNT IS OF SET FILTERS, NEVER OF OPTIONS. A disclosure that counted
	// options would read `More filters (3)` on a page where nothing is filtered,
	// which is a second thing the operator has to decode. Three filters, three
	// possible counts, and only these three are eligible.
	const refinementCount = [
		subjectStatusFilter !== 'all',
		roomTypeFilter !== 'all',
		termFilter !== TERM_FILTER_ALL,
	].filter(Boolean).length;
	const moreFiltersLabel = refinementCount > 0 ? `More filters (${refinementCount})` : 'More filters';

	// A5 C4: the shared `AdminSearchFilterToolbar` takes `filtersOpen` /
	// `onToggleFilters`, and this page used to pass `false` and an empty arrow —
	// dead props. They now carry this disclosure's REAL state. The shared
	// component renders its own `More filters` button only when it is given
	// OVERFLOW CHILDREN, and this page passes one wrapping cluster, so that
	// button does not appear; the shared component is another lane's file and is
	// deliberately left unmodified.
	return (
		<AdminSearchFilterToolbar
			searchValue={searchQuery}
			onSearchChange={onSearchChange}
			searchPlaceholder="Search name or code..."
			filtersOpen={moreFiltersOpen}
			onToggleFilters={() => setMoreFiltersOpen((open) => !open)}
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

				{/* A5 C4: THE ONE DISCLOSURE.
				 *
				 * `@/ui/popover` — the repo's own primitive, and the same one every
				 * `@/ui/filter-picker` is built on — so this is not a hand-rolled
				 * grouping control and it matches every other page (§8).
				 *
				 * `modal={false}` is load-bearing, not a preference: a Radix POPOVER
				 * defaulting to modal sets `pointer-events: none` on the body and
				 * stacks a `DismissableLayer`. Three FilterPickers open their OWN
				 * popovers from inside this one, so a modal outer would leave the
				 * inner pickers unclickable. Non-modal keeps outside-click dismissal
				 * and `Escape` (both are `DismissableLayer`, which does not depend
				 * on modality) while letting a nested picker be a real control.
				 */}
				<Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen} modal={false}>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							data-testid="subjects-more-filters"
							/* The visible label is the ONLY place the count appears, and
							   it counts SET filters. `aria-expanded` and `aria-haspopup`
							   come from the primitive, so the control is keyboard
							   reachable and announces itself as a disclosure without
							   this file restating that. */
							className={cn(PICKER_CONTROL_HEIGHT_CLASS, 'shrink-0 gap-1.5 whitespace-nowrap px-3 text-xs font-normal normal-case')}
						>
							<SlidersHorizontal className="size-3.5" aria-hidden="true" />
							{moreFiltersLabel}
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						/* The primitive's own `w-[var(--radix-popover-trigger-width)]` is
						   the width of the DISCLOSURE button, which is sized for the
						   label, not for a list of filters. One declared width, from the
						   same `w-*` group so tailwind-merge drops the primitive's. */
						className="w-[19rem] space-y-2.5 p-3"
					>
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Refine the subjects shown
						</p>
						<div className="flex flex-col gap-2.5">
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
							<FilterPicker
								name="Term"
								ariaLabel="Filter by rotation term"
								value={termFilter}
								onValueChange={onTermFilterChange}
								options={termOptions.map((option) => ({ value: option.value, label: option.label }))}
							/>
						</div>
					</PopoverContent>
				</Popover>

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
