import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { AdminSearchFilterToolbar } from '@/components/admin-workspace/AdminWorkspace';

type Props = {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	showFilters: boolean;
	onToggleFilters: () => void;
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
	onResetFilters: () => void;
};

export function SubjectFilterToolbar({
	searchQuery,
	onSearchChange,
	showFilters,
	onToggleFilters,
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
	onResetFilters,
}: Props) {
	// A3-15: the FIRST three selects are PRIMARY and stay on one directly
	// visible row. Reasoning: Status, Attention and Grade are the three an
	// operator reaches for to answer "what needs my attention right now" — they
	// gate every routine triage pass, so hiding them behind a disclosure put two
	// clicks in front of the commonest read. Room Type and Program are narrower
	// catalog lookups used for setup and export checks, so they keep the
	// disclosure. The reset button stays in the overflow group: it only exists
	// once a filter is active, and the "Active" badge on the disclosure already
	// advertises it.
	//
	// THE CHILD ORDER BELOW IS THE CONTRACT, and Grade is deliberately declared
	// third: the previous source order was Status, Attention, Room Type, Grade,
	// which would have made Room Type the third primary filter and silently
	// demoted Grade. The A3 control asserts which labels are in the primary row.
	return (
		<AdminSearchFilterToolbar
			searchValue={searchQuery}
			onSearchChange={onSearchChange}
			searchPlaceholder="Search name or code..."
			filtersOpen={showFilters}
			onToggleFilters={onToggleFilters}
			hasActiveFilters={hasActiveFilters}
			primaryFilterCount={3}
		>
			<Select value={statusFilter} onValueChange={onStatusFilterChange}>
				<SelectTrigger className="h-10 w-36 text-sm" aria-label="Filter by subject status">
					<SelectValue placeholder="All Status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Status</SelectItem>
					<SelectItem value="active">Active</SelectItem>
					<SelectItem value="inactive">Archived</SelectItem>
				</SelectContent>
			</Select>
			<Select value={attentionFilter} onValueChange={onAttentionFilterChange}>
				<SelectTrigger className="h-10 w-52 text-sm" aria-label="Filter by attention status">
					<SelectValue placeholder="All statuses" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All statuses</SelectItem>
					<SelectItem value="missing-coverage">Missing teacher coverage</SelectItem>
					<SelectItem value="room-constrained">Room-constrained subjects</SelectItem>
				</SelectContent>
			</Select>
			<Select value={String(gradeLevelFilter)} onValueChange={(v) => onGradeLevelFilterChange(v === 'all' ? 'all' : Number(v))}>
				<SelectTrigger className="h-10 w-36 text-sm" aria-label="Filter by grade level">
					<SelectValue placeholder="All grade levels" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All grade levels</SelectItem>
					{GRADE_OPTIONS.map((g) => (
						<SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={roomTypeFilter} onValueChange={onRoomTypeFilterChange}>
				<SelectTrigger className="h-10 w-44 text-sm" aria-label="Filter by room type">
					<SelectValue placeholder="All Room Types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Room Types</SelectItem>
					{ALL_ROOM_TYPES.map((t) => (
						<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={programScopeFilter} onValueChange={onProgramScopeFilterChange}>
				<SelectTrigger className="h-10 w-40 text-sm" aria-label="Filter by program scope">
					<SelectValue placeholder="All Programs" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Programs</SelectItem>
					{PROGRAM_SCOPE_OPTIONS.map((o) => (
						<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
					))}
				</SelectContent>
			</Select>

			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					className="px-3 text-sm text-muted-foreground hover:text-foreground"
					data-testid="subjects-reset-filters"
					onClick={onResetFilters}
				>
					Reset filters
				</Button>
			)}
		</AdminSearchFilterToolbar>
	);
}
