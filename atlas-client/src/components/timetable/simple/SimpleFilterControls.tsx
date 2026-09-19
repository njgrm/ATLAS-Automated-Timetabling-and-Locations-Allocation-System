import { SlidersHorizontal, X } from 'lucide-react';

import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { SimpleFiltersContent } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';

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
			<Dialog>
				<DialogTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 min-h-11 shrink-0 gap-1.5 px-2.5 text-xs sm:min-h-0"
						data-testid="timetable-filters-trigger"
						aria-label={activeFilters.length > 0 ? `Filters, ${activeFilters.length} active` : 'Filters'}
					>
						<SlidersHorizontal className="size-3.5" aria-hidden="true" />
						<span>Filters</span>
						{activeFilters.length > 0 ? (
							<Badge className="h-5 min-w-5 justify-center px-1 text-xs" data-testid="timetable-active-filter-count">
								{activeFilters.length}
							</Badge>
						) : null}
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Filter timetable</DialogTitle>
						<DialogDescription>
							Choose which classes and issues appear on the current grid.
						</DialogDescription>
					</DialogHeader>
					<SimpleFiltersContent context={context} />
					<DialogFooter>
						{activeFilters.length > 0 ? (
							<Button type="button" variant="ghost" onClick={clearAll}>Clear all</Button>
						) : null}
						<DialogClose asChild>
							<Button type="button">Done</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
