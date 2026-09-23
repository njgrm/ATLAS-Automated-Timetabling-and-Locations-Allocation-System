import { SlidersHorizontal, X } from 'lucide-react';

import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { SimpleFiltersContent } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';

type SimpleFilterKey = 'program' | 'entry-kind' | 'attention';

export type ActiveSimpleFilter = {
	key: SimpleFilterKey;
	label: string;
};

export function resolveActiveSimpleFilters({
	programFilter,
	entryKindFilter,
	severityFilter,
	programOptions,
	entryKindOptions,
}: {
	programFilter: string;
	entryKindFilter: string;
	severityFilter: string;
	programOptions: ReadonlyArray<{ value: string; label: string }>;
	entryKindOptions: ReadonlyArray<{ value: string; label: string }>;
}): ActiveSimpleFilter[] {
	const filters: ActiveSimpleFilter[] = [];
	if (programFilter !== 'all') {
		filters.push({
			key: 'program',
			label: programOptions.find((option) => option.value === programFilter)?.label ?? programFilter,
		});
	}
	if (entryKindFilter !== 'all') {
		filters.push({
			key: 'entry-kind',
			label: entryKindOptions.find((option) => option.value === entryKindFilter)?.label ?? entryKindFilter,
		});
	}
	if (severityFilter !== 'all') {
		const attentionLabels: Record<string, string> = {
			hard: 'Hard blockers',
			soft: 'Warnings',
			conflicts: 'Conflicts',
			wellbeing: 'Well-being',
		};
		filters.push({ key: 'attention', label: attentionLabels[severityFilter] ?? severityFilter });
	}
	return filters;
}

function activeFiltersFor(context: ScheduleReviewWorkspaceHeaderContext) {
	const activeFilters = resolveActiveSimpleFilters({
		programFilter: context.programFilter,
		entryKindFilter: context.entryKindFilter,
		severityFilter: context.severityFilter,
		programOptions: context.PROGRAM_FILTER_OPTIONS,
		entryKindOptions: context.ENTRY_KIND_FILTER_OPTIONS,
	});
	return activeFilters;
}

function clearSimpleFilter(context: ScheduleReviewWorkspaceHeaderContext, key: SimpleFilterKey) {
	if (key === 'program') context.setProgramFilter('all');
	if (key === 'entry-kind') context.setEntryKindFilter('all');
	if (key === 'attention') context.setSeverityFilter('all');
}

function clearAllSimpleFilters(context: ScheduleReviewWorkspaceHeaderContext) {
	context.setProgramFilter('all');
	context.setEntryKindFilter('all');
	context.setSeverityFilter('all');
}

export function SimpleActiveFilterChips({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
	const activeFilters = activeFiltersFor(context);
	if (activeFilters.length === 0) return null;

	return (
		<div
			className="order-last flex min-w-0 basis-full items-center gap-1.5 overflow-x-auto sm:basis-auto lg:order-none lg:shrink-0"
			data-testid="timetable-active-filters"
			role="group"
			aria-label="Active timetable filters"
		>
			{activeFilters.map((filter) => (
				<Button
					key={filter.key}
					type="button"
					variant="secondary"
					size="sm"
					className="h-7 shrink-0 gap-1 px-2 text-xs"
					onClick={() => clearSimpleFilter(context, filter.key)}
					aria-label={`Remove ${filter.label} filter`}
				>
					{filter.label}
					<X className="size-3" aria-hidden="true" />
				</Button>
			))}
			<Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => clearAllSimpleFilters(context)}>
				Clear all
			</Button>
		</div>
	);
}

export function SimpleFilterControls({ context, renderActiveFilters = true }: { context: ScheduleReviewWorkspaceHeaderContext; renderActiveFilters?: boolean }) {
	const activeFilters = activeFiltersFor(context);

	const clearFilter = (key: SimpleFilterKey) => {
		clearSimpleFilter(context, key);
	};

	const clearAll = () => {
		clearAllSimpleFilters(context);
	};

	return (
		<>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="hidden h-8 shrink-0 gap-1.5 px-2.5 text-xs lg:inline-flex"
						data-testid="timetable-filters-trigger"
						aria-label={activeFilters.length > 0 ? `Refine grid, ${activeFilters.length} active` : 'Refine grid'}
					>
						<SlidersHorizontal className="size-3.5" aria-hidden="true" />
						<span>Refine</span>
						{activeFilters.length > 0 ? (
							<Badge className="h-5 min-w-5 justify-center px-1 text-xs" data-testid="timetable-active-filter-count">
								{activeFilters.length}
							</Badge>
						) : null}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-4" data-testid="timetable-simple-filters-popover-content">
					<div className="mb-4 border-b border-border pb-3">
						<h2 className="text-sm font-semibold">Refine this grid</h2>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							Narrow what is visible. These choices do not change timetable assignments.
						</p>
					</div>
					<SimpleFiltersContent context={context} />
					<div className="mt-4 flex items-center justify-between border-t border-border pt-3">
						{activeFilters.length > 0 ? (
							<Button type="button" variant="ghost" onClick={clearAll}>Clear all</Button>
						) : <span className="text-xs text-muted-foreground">No refinements applied</span>}
						<PopoverClose asChild>
							<Button type="button" size="sm" className="h-8">Done</Button>
						</PopoverClose>
					</div>
				</PopoverContent>
			</Popover>

			<Sheet>
				<SheetTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-11 min-w-11 shrink-0 gap-1.5 px-2.5 text-xs lg:hidden"
						data-testid="timetable-filters-mobile-trigger"
						aria-label={activeFilters.length > 0 ? `Filters, ${activeFilters.length} active` : 'Filters'}
					>
						<SlidersHorizontal className="size-3.5" aria-hidden="true" />
						<span>Filters</span>
						{activeFilters.length > 0 ? <Badge className="h-5 min-w-5 justify-center px-1 text-xs">{activeFilters.length}</Badge> : null}
					</Button>
				</SheetTrigger>
				<SheetContent side="bottom" className="flex max-h-[82svh] flex-col gap-3 rounded-t-2xl p-4">
					<SheetHeader>
						<SheetTitle>Refine this grid</SheetTitle>
						<SheetDescription>Narrow what is visible. These choices do not change timetable assignments.</SheetDescription>
					</SheetHeader>
					<SimpleFiltersContent context={context} />
					<SheetFooter className="mt-2 gap-2 border-t border-border pt-3">
						{activeFilters.length > 0 ? <Button type="button" variant="ghost" onClick={clearAll}>Clear all</Button> : null}
						<SheetClose asChild><Button type="button">Done</Button></SheetClose>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			{renderActiveFilters && activeFilters.length > 0 ? (
				<div
					className="relative z-10 flex min-w-0 basis-full items-center gap-1.5 overflow-x-auto sm:basis-auto"
					data-testid="timetable-active-filters"
					role="group"
					aria-label="Active timetable filters"
				>
					{activeFilters.map((filter) => (
						<Button
							key={filter.key}
							type="button"
							variant="secondary"
							size="sm"
							className="h-7 shrink-0 gap-1 px-2 text-xs"
							onClick={() => clearFilter(filter.key)}
							aria-label={`Remove ${filter.label} filter`}
						>
							{filter.label}
							<X className="size-3" aria-hidden="true" />
						</Button>
					))}
					<Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={clearAll}>
						Clear all
					</Button>
				</div>
			) : null}
		</>
	);
}
