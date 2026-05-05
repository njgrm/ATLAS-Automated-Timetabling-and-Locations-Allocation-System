import type { ReactNode } from 'react';

import { SearchableSelect } from '@/ui/searchable-select';
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
	programFilterOptions: Option[];
	entryKindFilter: string;
	onEntryKindFilterChange: (value: string) => void;
	entryKindFilterOptions: Option[];
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
		<div className="flex items-center gap-2 px-4 pb-2 flex-wrap" data-tutorial="grid-controls">
			<Select value={viewMode} onValueChange={onViewModeChange}>
				<SelectTrigger className="h-7 w-32 text-xs">
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
				triggerClassName="h-7 w-80 text-xs"
				groups={groupedPivotEntities.map((group) => ({
					label: group.label,
					items: group.ids.map((id) => ({ value: String(id), label: pivotLabel(id) })),
				}))}
			/>

			<Select value={programFilter} onValueChange={onProgramFilterChange}>
				<SelectTrigger className="h-7 w-36 text-xs">
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

			<Select value={entryKindFilter} onValueChange={onEntryKindFilterChange}>
				<SelectTrigger className="h-7 w-36 text-xs">
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

			{children}
		</div>
	);
}
