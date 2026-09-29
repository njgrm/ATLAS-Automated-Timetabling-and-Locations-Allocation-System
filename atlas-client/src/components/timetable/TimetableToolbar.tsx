/**
 * A5 c8 (2026-09-29) — `/timetable`'s schedule controls, on the ONE shared bar.
 *
 * THE LAYOUT NOTE, BEFORE THE JSX.
 *
 * The Codex sweep filed this page as a MINOR — "Schedule controls (`Term`, `Show`,
 * `Schedule for`) live in a separate tabbed top strip rather than the list-page
 * FilterBar, adding another control language" — and the operator's own complaint list
 * named the same thing from the other end: the system "isn't responsive anymore",
 * because four pages each read differently.
 *
 * WHAT WAS WRONG HERE SPECIFICALLY:
 *   1. The row was a horizontal `overflow-x-auto` strip. A filter row that scrolls
 *      sideways hides controls with no cue, and `AGENTS.md` §8's no-scrollbar rule
 *      says a filter bar must never be a scroll container. It is now a wrapping row.
 *   2. Every control was `h-7` — 28px beside a 36px search box on every other page.
 *      They take their height from `@/ui` now, so the row is `h-9` throughout.
 *   3. `Program`, `Entry type` and the attention-type chips lived behind a `Filters`
 *      DISCLOSURE popover: a second click to find out the page is filtered, which is
 *      the exact defect the whole A5 c8 change exists to remove.
 *   4. A bare `<span>Term</span>` sat beside the term trigger, so the term control
 *      read `Term` and nothing else while every other filter reads `Name: value`.
 *   5. The two program/entry-type triggers inside the popover were `h-8 w-full` and
 *      carried `[&>span]:line-clamp-1` from `@/ui/select`, so a long program name was
 *      cut with an ellipsis — the same clamp that cut `Archived year: 2029-2030` on
 *      `/teaching-load/history`.
 *
 * WHAT STAYS IN THE ROW .... view mode, `Schedule for` (the entity picker),
 *                              `Term`, `Program`, `Entry type`, and the attention-type
 *                              chips, in that order, all at the shared height, with the
 *                              page's own `viewModeLabels`, `pivotLabel`, group labels
 *                              and every option list exactly as they were.
 * WHAT GOES ............... the `overflow-x-auto` strip, the bare `Term` span, the
 *                              `Filters` button, its `Popover`, its two uppercase
 *                              `Program` / `Entry type` sub-headings and its
 *                              `Attention type` sub-heading.
 * WHAT MOVES .............. the `timetable-filters-trigger` `data-testid` onto the
 *                              bar's container, because the control it named no longer
 *                              exists and a testid that points at a deleted button is a
 *                              testid that silently stops testing anything. The
 *                              `timetable-term-filter` `data-testid` STAYS on the term
 *                              trigger, because that control still exists and is still
 *                              the term filter.
 * WHAT IS NOT CHANGED ..... which run is shown, which terms are offered, what
 *                              `data-tutorial="grid-controls"` wraps, the tabs above,
 *                              and every predicate. If an edit here changes WHAT THE
 *                              GRID SHOWS, it has stopped being this change.
 */
import type { ReactNode } from 'react';

import { SearchableSelect } from '@/ui/searchable-select';
import { FilterBar } from '@/ui/filter-bar';
import { FilterPicker } from '@/ui/filter-picker';
import { pickerTriggerClass } from '@/ui/picker-trigger';

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
	termFilter: 'all' | number;
	onTermFilterChange: (value: 'all' | number) => void;
	termOptions: ReadonlyArray<Option>;
	activeTermIndex: number | null;
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
	termFilter,
	onTermFilterChange,
	termOptions,
	children,
}: TimetableToolbarProps) {
	/* The view mode is a choice of WHAT is shown, not a narrowing of a list, so it
	 * keeps the plain trigger the page always had — but it now wears the SHARED
	 * `auto` variant and the shared height, so it is not a second control language. */
	const viewModeOptions = Object.entries(viewModeLabels).map(([value, label]) => ({ value, label }));
	const termPickerOptions = termOptions.map((option) => ({
		value: option.value,
		label: option.value === 'all' ? 'All terms' : `Term ${option.value}`,
	}));

	return (
		<FilterBar dataTestId="timetable-filters-trigger" dataTutorial="grid-controls">
			<FilterPicker
				name="Show"
				width="auto"
				ariaLabel="Schedule view"
				value={viewMode}
				onValueChange={onViewModeChange}
				options={viewModeOptions}
			/>
			{/* The entity picker keeps `SearchableSelect` and keeps its GROUPED list — the
			    * grouping is this page's (by grade for sections, by department elsewhere)
			    * and `FilterPicker` is flat-only by design. Its chrome is the shared
			    * `auto` variant, so the face wraps instead of spilling and the height is
			    * the row's height rather than 28px. */}
			<SearchableSelect
				value={entityFilter}
				onValueChange={onEntityFilterChange}
				placeholder={`Select ${viewModeLabels[viewMode] ?? viewMode}...`}
				ariaLabel={`Schedule for ${viewModeLabels[viewMode] ?? viewMode}`}
				triggerLabelPrefix="Schedule for"
				triggerClassName={pickerTriggerClass('auto')}
				groups={groupedPivotEntities.map((group) => ({
					label: group.label,
					items: group.ids.map((id) => ({ value: String(id), label: pivotLabel(id) })),
				}))}
			/>
			<FilterPicker
				name="Term"
				width="auto"
				ariaLabel="Filter by term"
				value={String(termFilter)}
				onValueChange={(value) => onTermFilterChange(value === 'all' ? 'all' : Number(value))}
				options={termPickerOptions}
				dataTestId="timetable-term-filter"
			/>
			<FilterPicker
				name="Program"
				width="auto"
				ariaLabel="Filter by program"
				value={programFilter}
				onValueChange={onProgramFilterChange}
				options={[...programFilterOptions]}
			/>
			<FilterPicker
				name="Entry type"
				width="auto"
				ariaLabel="Filter by entry type"
				value={entryKindFilter}
				onValueChange={onEntryKindFilterChange}
				options={[...entryKindFilterOptions]}
			/>
			{/* The attention-type chips were the third thing inside the deleted popover.
			    * They are toggles rather than pickers, so they stay the page's own
			    * elements — the bar only decides the row they sit in and the `gap-2`
			    * between them. */}
			{children ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div> : null}
		</FilterBar>
	);
}
