import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { SearchableSelect } from '@/ui/searchable-select';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

export interface TimetableToolbarGroup {
	label: string;
	ids: number[];
}

interface Option {
	value: string;
	label: string;
}

interface TimetableToolbarProps {
	viewMode: string;
	viewModeLabels: Record<string, string>;
	onViewModeChange: (value: string) => void;
	entityFilter: string;
	onEntityFilterChange: (value: string) => void;
	groupedPivotEntities: TimetableToolbarGroup[];
	pivotLabel: (id: number) => string;
	programFilter: string;
	onProgramFilterChange: (value: string) => void;
	programFilterOptions: ReadonlyArray<Option>;
	entryKindFilter: string;
	onEntryKindFilterChange: (value: string) => void;
	entryKindFilterOptions: ReadonlyArray<Option>;
	children?: ReactNode;
}

export function TimetableToolbar({
	viewMode,
	viewModeLabels,
	onViewModeChange,
	entityFilter,
	onEntityFilterChange,
	groupedPivotEntities,
	pivotLabel,
	programFilter,
	onProgramFilterChange,
	programFilterOptions,
	entryKindFilter,
	onEntryKindFilterChange,
	entryKindFilterOptions,
	children,
}: TimetableToolbarProps) {
	return (
		<div className="flex items-center gap-2 overflow-x-auto px-4 pb-1.5 xl:flex-wrap" data-tutorial="grid-controls">
			<Select value={viewMode} onValueChange={onViewModeChange}>
				<SelectTrigger className="h-7 w-32 shrink-0 text-xs">
					<SelectValue placeholder="View by" />
				</SelectTrigger>
				<SelectContent>
					{Object.entries(viewModeLabels).map(([key, label]) => (
						<SelectItem key={key} value={key}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<SearchableSelect
				value={entityFilter}
				onValueChange={onEntityFilterChange}
				placeholder={`Select ${viewModeLabels[viewMode] ?? viewMode}...`}
				triggerClassName="h-7 w-60 shrink-0 text-xs sm:w-72 xl:w-80"
				groups={groupedPivotEntities.map((group) => ({
					label: group.label,
					items: group.ids.map((id) => ({ value: String(id), label: pivotLabel(id) })),
				}))}
			/>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
						data-testid="timetable-filters-trigger"
					>
						<SlidersHorizontal className="size-3.5" aria-hidden="true" />
						Filters
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
					<div className="space-y-3">
						<div>
							<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</p>
							<Select value={programFilter} onValueChange={onProgramFilterChange}>
								<SelectTrigger className="h-8 w-full text-xs">
									<SelectValue placeholder="Program" />
								</SelectTrigger>
								<SelectContent>
									{programFilterOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entry type</p>
							<Select value={entryKindFilter} onValueChange={onEntryKindFilterChange}>
								<SelectTrigger className="h-8 w-full text-xs">
									<SelectValue placeholder="Entry Type" />
								</SelectTrigger>
								<SelectContent>
									{entryKindFilterOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{children ? (
							<div>
								<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention type</p>
								<div className="flex flex-wrap gap-1.5">
									{children}
								</div>
							</div>
						) : null}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
