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
import type { RoomType } from '@/types';

type Props = {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	hasActiveFilters: boolean;
	statusFilter: string;
	onStatusFilterChange: (value: string) => void;
	attentionFilter: string;
	onAttentionFilterChange: (value: string) => void;
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

export function SubjectFilterToolbar({
	searchQuery,
	onSearchChange,
	hasActiveFilters,
	statusFilter,
	onStatusFilterChange,
	attentionFilter,
	onAttentionFilterChange,
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
	// Room Type. The criterion asks for "one interaction with the target filter,
	// not an initial disclosure click", so each of the two is now its own
	// `Select` — the same primitive, with the same one-click-to-open-then-choose
	// shape, that Status, Attention, Grade and Term already use. There is no
	// grouping button left, so there is nothing to disclose through.
	//
	// THE ORDER BELOW IS THE CONTRACT, and it is triage order: the filters that
	// answer "what needs my attention right now" come first — Status, Attention,
	// Grade, Term — and the two narrow catalog lookups, which are setup and
	// export checks, come last. The term filter sits with the triage group
	// because "which subjects run in which term" is a routine planning question,
	// not a catalog sweep.
	//
	// THE CLUSTER. `AdminSearchFilterToolbar`'s inline row is `flex-nowrap` by
	// design (it is the shared component, and the c9 control asserts it). Six
	// fixed-width controls plus the search box DO fit one line at 1366px — the
	// declared budget below proves that by class arithmetic — but `flex-nowrap`
	// on a narrower viewport would push the last control past the page edge and
	// give the document a horizontal scrollbar. So the controls sit in one
	// `flex-wrap` cluster INSIDE the row: one line at 1366px, a clean wrap below
	// it, and no horizontal overflow at any width.
	//
	// WIDTHS (source-level arithmetic over the Tailwind width classes these
	// elements carry — NOT a measured pixel result; jsdom has no layout engine
	// and the live pixel confirmation is still owed):
	//   search sm:max-w-40 = 160, status w-28 = 112, attention w-40 = 160,
	//   grade w-24 = 96, term w-28 = 112, room type w-36 = 144,
	//   program w-28 = 112, reset (text) = 80, 7 gaps x 8 = 56  =>  1032px.
	// The 1366px viewport minus the 256px expanded sidebar, the 40px page
	// padding at `lg`, and the toolbar card's 8px inset leaves 1062px.
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
			searchMaxWidthClassName="sm:max-w-40"
		>
			<div
				className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
				data-testid="subjects-filter-cluster"
			>
				<Select value={statusFilter} onValueChange={onStatusFilterChange}>
					<SelectTrigger className="h-10 w-28 shrink-0 text-sm" aria-label="Filter by subject status">
						<SelectValue placeholder="All Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="inactive">Archived</SelectItem>
					</SelectContent>
				</Select>
				<Select value={attentionFilter} onValueChange={onAttentionFilterChange}>
					<SelectTrigger className="h-10 w-40 shrink-0 text-sm" aria-label="Filter by attention status">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="missing-coverage">Missing teacher coverage</SelectItem>
						<SelectItem value="room-constrained">Room-constrained subjects</SelectItem>
					</SelectContent>
				</Select>
				<Select value={String(gradeLevelFilter)} onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}>
					<SelectTrigger className="h-10 w-24 shrink-0 text-sm" aria-label="Filter by grade level">
						<SelectValue placeholder="Grade" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All grade levels</SelectItem>
						{GRADE_OPTIONS.map((g) => (
							<SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={termFilter} onValueChange={onTermFilterChange}>
					<SelectTrigger className="h-10 w-28 shrink-0 text-sm" aria-label="Filter by rotation term">
						<SelectValue placeholder="All terms" />
					</SelectTrigger>
					<SelectContent>
						{termOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
						className="h-10 w-36 shrink-0 text-sm"
						aria-label="Filter by room type"
						data-testid="subjects-room-type-filter"
					>
						<SelectValue placeholder="Any room" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any room</SelectItem>
						{ALL_ROOM_TYPES.map((t) => (
							<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={programScopeFilter}
					onValueChange={(v) => onProgramScopeFilterChange(v)}
				>
					<SelectTrigger
						className="h-10 w-28 shrink-0 text-sm"
						aria-label="Filter by program scope"
						data-testid="subjects-program-filter"
					>
						<SelectValue placeholder="Any program" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any program</SelectItem>
						{PROGRAM_SCOPE_OPTIONS.map((o) => (
							<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
						))}
					</SelectContent>
				</Select>

				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-10 shrink-0 whitespace-nowrap px-3 text-sm text-muted-foreground hover:text-foreground"
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
