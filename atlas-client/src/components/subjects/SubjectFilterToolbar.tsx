import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
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
 * THE TRIGGER DIMENSIONS ARE THE CONTRACT (items 9.1(3) and 41(4), verbatim):
 * `h-9 text-xs px-3 rounded-xl border border-slate-200 bg-white
 * hover:bg-slate-50 transition-colors` on every select, so the five controls and
 * the search box are one visual row. Each trigger keeps its own `w-*` so the
 * one-row width budget in the Subjects controls stays decidable from the
 * rendered classes.
 */
const COMPACT_SELECT =
	'h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs transition-colors hover:bg-slate-50';

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
	// WIDTHS (source-level arithmetic over the Tailwind width classes these
	// elements carry — NOT a measured pixel result; jsdom has no layout engine):
	//   search w-[240px] = 240, status w-40 = 160, grade w-24 = 96,
	//   program w-28 = 112, room type w-36 = 144, term w-28 = 112,
	//   reset (text) = 80, 6 gaps x 10 (gap-2.5) = 60  =>  1004px.
	// The 1366px viewport minus the 256px expanded sidebar, the 40px page padding
	// at `lg`, and the toolbar card's 8px inset leaves 1062px.
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
			/* A5: the search box matches the compact triggers' height and type
			   size. Default-off in the shared toolbar, so no other page moves.

			   `sm:text-xs` is NOT redundant. `@/ui` `Input` ends its base class
			   with the responsive pair `text-base … sm:text-sm`, and
			   tailwind-merge treats `sm:text-sm` as a different variant from a
			   bare `text-xs`, so it keeps BOTH — and at any viewport ≥640px the
			   `sm:` variant wins. The real-browser row measured 14px and caught
			   exactly that: a class-list assertion could not, because the
			   class-list assertion was true. */
			searchInputClassName="h-9 pl-9 text-xs sm:text-xs"
		>
			<div
				className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5"
				data-testid="subjects-filter-cluster"
			>
				<Select
					value={subjectStatusFilter}
					onValueChange={(v) => onSubjectStatusFilterChange(v as SubjectStatusFilter)}
				>
					<SelectTrigger
						className={`${COMPACT_SELECT} w-40`}
						aria-label="Filter by subject status"
						data-testid="subjects-status-filter"
					>
						<SelectValue placeholder="All Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="inactive">Archived</SelectItem>
						{/* The coverage-attention axis, folded into the one status
						    control rather than dropped (see `SubjectStatusFilter`). */}
						<SelectItem value="missing-coverage">Missing teacher coverage</SelectItem>
						<SelectItem value="room-constrained">Room-constrained subjects</SelectItem>
					</SelectContent>
				</Select>
				<Select value={String(gradeLevelFilter)} onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}>
					<SelectTrigger className={`${COMPACT_SELECT} w-24`} aria-label="Filter by grade level">
						<SelectValue placeholder="All Grades" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Grades</SelectItem>
						{GRADE_OPTIONS.map((g) => (
							/* The shared compact grade form (`GR7`), the same one the
							   grade chips and the coverage dialog use — not
							   `Grade 7`, and not a second spelling. */
							<SelectItem key={g} value={String(g)}>{gradeLabel(g)}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={programScopeFilter}
					onValueChange={(v) => onProgramScopeFilterChange(v)}
				>
					<SelectTrigger
						className={`${COMPACT_SELECT} w-28`}
						aria-label="Filter by program scope"
						data-testid="subjects-program-filter"
					>
						<SelectValue placeholder="All Programs" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Programs</SelectItem>
						{PROGRAM_SCOPE_OPTIONS.map((o) => (
							<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
						))}
					</SelectContent>
				</Select>
				{/*
				 * A3-C10: Room Type and Program are DIRECT filters now. Each
				 * trigger is the filter itself — it shows the current value, it is
				 * labelled with `aria-label`, and it opens its OWN listbox in one
				 * click. There is no parent control that groups the two, so there
				 * is no disclosure click between the operator and the filter.
				 */}
				<Select
					value={roomTypeFilter}
					onValueChange={(v) => onRoomTypeFilterChange(v)}
				>
					<SelectTrigger
						className={`${COMPACT_SELECT} w-36`}
						aria-label="Filter by room type"
						data-testid="subjects-room-type-filter"
					>
						<SelectValue placeholder="All Room Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Room Types</SelectItem>
						{ALL_ROOM_TYPES.map((t) => (
							<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
						))}
					</SelectContent>
				</Select>
				{/* A3-C9, retained as the fifth compact control — see the note above. */}
				<Select value={termFilter} onValueChange={onTermFilterChange}>
					<SelectTrigger className={`${COMPACT_SELECT} w-28`} aria-label="Filter by rotation term">
						<SelectValue placeholder="All terms" />
					</SelectTrigger>
					<SelectContent>
						{termOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
						))}
					</SelectContent>
				</Select>

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
