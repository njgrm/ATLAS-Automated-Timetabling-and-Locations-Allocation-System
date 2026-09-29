import { ALL_ROOM_TYPES, GRADE_OPTIONS, PROGRAM_SCOPE_OPTIONS, ROOM_TYPE_LABELS } from '@/lib/subject-constants';
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
 *
 * EXPORTED since A5 C7, and the export is the point rather than an accident. The
 * room row is the one picker whose trigger face this page SHORTENS from its own map,
 * so the map is real surface a test needs to read: `AGENTS.md` §11 ("a control's
 * fixture must come from the real surface, and a computed artifact's byte
 * serialization must be recorded") rejected the invented-label fixture that A5 C3
 * round 1 was caught using, and a test that re-declared these nine strings would be
 * the same mistake one layer out. Reading the exported map is how the longest Room
 * face is measured against `@/ui`'s real character budget.
 */
export const ROOM_TYPE_SHORT_LABELS: Record<string, string> = {
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
	// A5 C7 (2026-09-29) — THE LAYOUT NOTE, BEFORE THE JSX.
	//
	// WHAT THE OPERATOR NOW WANTS. Lane C's walk filed two items in opposite
	// directions and only one of them is a preference. A5 C4 read the Codex line
	// "keep Grade and Program visible and put the other filters under `More
	// filters`" as authority and shipped the disclosure. The operator then used
	// the page and filed the disclosure itself (fix-3 item 43): a scheduler has to
	// CLICK A BUTTON to find out that the page is filtered, and the button that
	// counts the filters is a number an older, mouse-first scheduler does not read
	// off a filter bar. Item 43 supersedes A5 C4. Codex's own note — no
	// truncation, one line at 1366 — is the reason this is affordable.
	//
	//   WHAT STAYS IN THE ROW .... everything. The search box, `Grade`, `Program`,
	//                              `Status`, `Room`, `Term`, and `Reset` while a
	//                              filter is set.
	//   WHAT GOES ............... the `More filters` trigger, the popover behind
	//                              it, its `Refine the subjects shown` heading, the
	//                              `(n)` count and the `SlidersHorizontal` icon.
	//                              One control out, zero in. This is §11 rule 3
	//                              subtraction with nothing added back: no chip, no
	//                              "N filters applied", no summary line, no helper
	//                              sentence.
	//   WHAT IT COSTS ............ nothing but reachability of three controls,
	//                              which is exactly what item 43 was filed about.
	//   THE WIDTH BUDGET ........ `@/ui/picker-trigger` already publishes the
	//                              `md` (=`w-32`, 128px) variant for THIS case in
	//                              its own words: "5 × 128 + 4 cluster gaps +
	//                              Reset + the 240px search box + its gap =
	//                              1020px against ~1062px available at 1366".
	//                              With this file's `gap-2` (8px) it is
	//                              240 + 10 + 640 + 40 + 80 = 1010px against
	//                              1062px. Nothing needs a new width variant and
	//                              §8 forbids inventing one at a call site; the
	//                              cluster keeps `flex-wrap` so a NARROWER
	//                              viewport still degrades by wrapping instead of
	//                              overflowing (§8's no-scroll rule), and the
	//                              rendered 1366x768 no-wrap proof is the browser
	//                              capture, because jsdom cannot measure layout.
	//   WHAT IS NOT CHANGED ..... every picker below is still the SAME
	//                              `@/ui/filter-picker` at the same `width`, with
	//                              its own self-naming trigger, its own
	//                              `ariaLabel` and its own `data-testid`; the
	//                              merged `SubjectStatusFilter` axis, its
	//                              `shortLabels`, `ROOM_TYPE_SHORT_LABELS`,
	//                              `gradeLabel(g)` and `TERM_FILTER_ALL` are all
	//                              untouched. This is a layout change. If an edit
	//                              here ever changes WHICH SUBJECTS a value
	//                              selects, it has stopped being a layout change.
	//
	// A5 C4, SUPERSEDED VERBATIM: its note argued the disclosure was subtraction
	// ("three rectangles leave the row, one button arrives"). Kept here as the
	// record of why the argument was wrong — the button it added was a thing a
	// scheduler had to open, and §11 rule 4 counts controls a scheduler must
	// find, not controls on screen.
	//
	// `filtersOpen` / `onToggleFilters`, DELIBERATELY (A5 C7). The shared
	// `AdminSearchFilterToolbar` still requires both, and they exist only for ITS
	// disclosure — a control this page no longer renders. Passing this page's old
	// disclosure state would be a lie, and passing a real `useState` would keep a
	// value nothing reads. So both are passed inert (`false` / a no-op): with
	// `primaryFilterCount={1}` and exactly ONE child (the cluster) the shared
	// component's `overflowChildren` is empty, and its `More filters` button and
	// overflow panel are both guarded on that being non-empty, so neither renders.
	// That is why no stray disclosure appears and `AdminWorkspace.tsx` — another
	// lane's file — needs no change. The browser capture is the check; this
	// comment is the reason to expect it.
	return (
		<AdminSearchFilterToolbar
			searchValue={searchQuery}
			onSearchChange={onSearchChange}
			searchPlaceholder="Search name or code..."
			/* A5 C7: INERT, see the note above. Both are required props and both
			   exist only for the shared component's own disclosure, which this page
			   does not render. Nothing here reads either value. */
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
			{/* ONE cluster, ONE line at 1366. `gap-2` is A5 C7's change from
			    A5 C4's `gap-2.5` and is part of the budget arithmetic above; it is
			    the spacing between siblings of a flex row, not chrome on a
			    primitive, so §8 does not apply to it. */}
			<div
				className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
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

				{/* A5 C7: THE THREE THAT SAT BEHIND `More filters`, now IN the row.
				 *
				 * Their order is unchanged from the popover they came out of, and
				 * every option list, `shortLabels` map, `ariaLabel` and
				 * `dataTestId` is what it was. This is a MOVE, not a rewrite: the
				 * A5 C4 QA that wrote most of these comments — that no filter may
				 * claim `All` for a list with no `all` member, that the trigger is
				 * compact while the list keeps the full label, that `gradeLabel`
				 * is the one shared grade spelling — decided about the CONTROL,
				 * and none of it depends on where the control sits. */}
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
