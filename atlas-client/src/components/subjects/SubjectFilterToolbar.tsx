import { Check, SlidersHorizontal } from 'lucide-react';

import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
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

/**
 * A3-C9: the two narrow CATALOG lookups — Room Type and Program scope — as one
 * `@/ui` Popover trigger in the same row, rather than two selects that would
 * not fit 1366px beside the four triage filters and the new Term filter.
 *
 * WHY BUTTONS AND NOT TWO NESTED `<Select>`s. A Radix `Select` portals its
 * listbox to `document.body`, outside the Popover, so a click on an option can
 * dismiss the popover that owns the trigger — a real, reported failure mode of
 * nested Radix overlays. The option lists here are short and fixed, so plain
 * `aria-pressed` toggle buttons give the same one-click-per-choice behaviour
 * with no overlay inside an overlay, and they read better for a mouse-first
 * scheduler: the whole catalogue list is visible at once.
 */
function CatalogFilterPopover({
	roomTypeFilter,
	onRoomTypeFilterChange,
	programScopeFilter,
	onProgramScopeFilterChange,
}: Pick<Props, 'roomTypeFilter' | 'onRoomTypeFilterChange' | 'programScopeFilter' | 'onProgramScopeFilterChange'>) {
	const catalogActive = roomTypeFilter !== 'all' || programScopeFilter !== 'all';
	const roomLabel = roomTypeFilter === 'all'
		? 'Any room'
		: (ROOM_TYPE_LABELS as Record<string, string>)[roomTypeFilter] ?? roomTypeFilter;
	const programLabel = programScopeFilter === 'all'
		? 'Any program'
		: PROGRAM_SCOPE_OPTIONS.find((o) => o.value === programScopeFilter)?.label ?? programScopeFilter;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant={catalogActive ? 'secondary' : 'outline'}
					size="sm"
					data-testid="subjects-catalog-filter-trigger"
					data-catalog-filter-active={catalogActive ? 'true' : 'false'}
					aria-label={`Room type and program filters. Room type ${roomLabel}. Program ${programLabel}.`}
					className="h-10 w-40 shrink-0 gap-1.5 px-2 text-sm"
				>
					<SlidersHorizontal className="size-3.5 shrink-0" />
					<span className="truncate">{catalogActive ? `${roomLabel} · ${programLabel}` : 'Room & program'}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 space-y-3 p-3" data-testid="subjects-catalog-filter">
				<div className="space-y-1.5">
					<p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Room type</p>
					<div className="flex flex-wrap gap-1.5">
						<CatalogOption
							label="Any room"
							selected={roomTypeFilter === 'all'}
							onSelect={() => onRoomTypeFilterChange('all')}
							testId="subjects-room-type-option"
							value="all"
						/>
						{ALL_ROOM_TYPES.map((t) => (
							<CatalogOption
								key={t}
								label={ROOM_TYPE_LABELS[t]}
								selected={roomTypeFilter === t}
								onSelect={() => onRoomTypeFilterChange(t)}
								testId="subjects-room-type-option"
								value={t}
							/>
						))}
					</div>
				</div>
				<div className="space-y-1.5">
					<p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Program</p>
					<div className="flex flex-wrap gap-1.5">
						<CatalogOption
							label="Any program"
							selected={programScopeFilter === 'all'}
							onSelect={() => onProgramScopeFilterChange('all')}
							testId="subjects-program-option"
							value="all"
						/>
						{PROGRAM_SCOPE_OPTIONS.map((o) => (
							<CatalogOption
								key={o.value}
								label={o.label}
								selected={programScopeFilter === o.value}
								onSelect={() => onProgramScopeFilterChange(o.value)}
								testId="subjects-program-option"
								value={o.value}
							/>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function CatalogOption({
	label,
	selected,
	onSelect,
	testId,
	value,
}: {
	label: string;
	selected: boolean;
	onSelect: () => void;
	testId: string;
	value: string;
}) {
	return (
		<Button
			type="button"
			variant={selected ? 'secondary' : 'outline'}
			size="sm"
			aria-pressed={selected}
			data-testid={testId}
			data-value={value}
			onClick={onSelect}
			className="h-7 gap-1 px-2 text-xs"
		>
			{selected ? <Check className="size-3" /> : null}
			{label}
		</Button>
	);
}

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
	// A3-C9: ONE row of controls. The "More filters" disclosure is gone; Room
	// Type and Program scope moved into the catalog popover that sits in the
	// same row, so every filter is reachable without opening a second row.
	//
	// THE ORDER BELOW IS THE CONTRACT, and it is triage order: the four filters
	// that answer "what needs my attention right now" come first — Status,
	// Attention, Grade, then the new Term — and the narrow catalog lookups, which
	// are setup and export checks, come last. The term filter sits with the
	// triage group because "which subjects run in which term" is a routine
	// planning question, not a catalog sweep.
	//
	// WIDTHS (source-level arithmetic, not a measured pixel result — see the
	// owed live-acceptance row). Every trigger carries a fixed width and the
	// wrapper is `flex-nowrap`, so the row cannot reflow to a second line:
	//   search 160 + status 112 + attention 176 + grade 96 + term 128
	//   + catalog 160 = 832; 6 gaps x 8 = 48; reset (text, ~120) = 1000px.
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
			primaryFilterCount={6}
			primaryFilterLayout="inline"
			searchMaxWidthClassName="sm:max-w-40"
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
				<SelectTrigger className="h-10 w-44 shrink-0 text-sm" aria-label="Filter by attention status">
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
				<SelectTrigger className="h-10 w-32 shrink-0 text-sm" aria-label="Filter by rotation term">
					<SelectValue placeholder="All terms" />
				</SelectTrigger>
				<SelectContent>
					{termOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
					))}
				</SelectContent>
			</Select>
			<CatalogFilterPopover
				roomTypeFilter={roomTypeFilter}
				onRoomTypeFilterChange={(v) => onRoomTypeFilterChange(v as RoomType | 'all')}
				programScopeFilter={programScopeFilter}
				onProgramScopeFilterChange={onProgramScopeFilterChange}
			/>

			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					className="h-10 shrink-0 whitespace-nowrap px-3 text-sm text-muted-foreground hover:text-foreground"
					data-testid="subjects-reset-filters"
					onClick={onResetFilters}
				>
					Reset filters
				</Button>
			)}
		</AdminSearchFilterToolbar>
	);
}

/** Re-exported so a caller can compare a stored value against the default. */
export { TERM_FILTER_ALL };
