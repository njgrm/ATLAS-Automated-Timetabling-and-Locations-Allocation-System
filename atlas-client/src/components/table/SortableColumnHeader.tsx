/**
 * A5 (operator items 34 + 35) — the ONE sortable column header.
 *
 * WHY A SHARED OWNER: four tables (Subjects, Sections, Teachers, Teaching Load)
 * each carried their own near-identical copy of this `<th>`, and each copy
 * rendered its tooltip inside `AdminTableShell`'s `overflow-auto` scroll box, so
 * the bubble was cut off at the container's top edge on every one of them. The
 * clipping is fixed once, in `ui/tooltip.tsx` (the portal); this module owns the
 * rest of the contract so a new table cannot reintroduce the same header:
 *
 *   - `aria-sort` carries the WCAG value, so the sort state is perceivable
 *     rather than inferred from an icon.
 *   - the trigger is a real `<Button>` — keyboard reachable and activatable
 *     (AGENTS.md §8: no raw unstyled `<button>`, no `title=`, no `<details>`).
 *   - the button's `aria-label` keeps the established plain-language contract
 *     `Sort by <Label>, currently <direction>`, because that string is what
 *     screen readers announce and what existing controls already assert.
 *   - the TOOLTIP TEXT is a different, action-shaped string, because the
 *     operator asked for the bubble to say what pressing it will do
 *     ("Sort by Section", "Sort ascending") rather than restate the aria label
 *     with a comma. Both name the column; only the bubble names the ACTION.
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

/** The WCAG `aria-sort` values, plus the inert `none`. */
export type SortableColumnDirection = 'ascending' | 'descending' | 'none';

export type SortableColumnSortDir = 'asc' | 'desc';

/**
 * The sort state a column is in, as `aria-sort` spells it.
 *
 * Exported as a pure function so a control can pin the value without a DOM.
 */
export function sortableColumnDirection(
	sortField: string,
	field: string,
	sortDir: SortableColumnSortDir,
): SortableColumnDirection {
	if (sortField !== field) return 'none';
	return sortDir === 'asc' ? 'ascending' : 'descending';
}

/**
 * The button's accessible name — the established contract, unchanged.
 * `Sort by <Label>, currently <direction>`.
 */
export function sortableColumnAriaLabel(label: string, direction: SortableColumnDirection): string {
	return `Sort by ${label}, currently ${direction}`;
}

/**
 * The bubble's visible text: the same column, phrased as the ACTION the press
 * performs, per operator item 34 ("the tooltip text explicitly describes the
 * sort action"). Deliberately NOT the aria label, so the two are not the same
 * string twice.
 */
export function sortableColumnTooltipText(label: string, direction: SortableColumnDirection): string {
	if (direction === 'ascending') return `Sort ascending by ${label}`;
	if (direction === 'descending') return `Sort descending by ${label}`;
	return `Sort by ${label}`;
}

export type SortableColumnHeaderProps<TField extends string> = {
	/** The column's own sort key. */
	field: TField;
	/** The visible column label. */
	label: string;
	/** The page's current sort key. */
	sortField: TField;
	/** The page's current sort direction. */
	sortDir: SortableColumnSortDir;
	/** Toggles `field`; the page owns the state. */
	onToggleSort: (field: TField) => void;
	align?: 'left' | 'right';
	/** Merged AFTER the layout classes, so a table can re-pad or right-align. */
	headerClassName?: string;
	/** Tooltip open delay. Default 200ms, the app-wide header behaviour. */
	tooltipDelayMs?: number;
};

export function SortableColumnHeader<TField extends string>({
	field,
	label,
	sortField,
	sortDir,
	onToggleSort,
	align = 'left',
	headerClassName,
	tooltipDelayMs = 200,
}: SortableColumnHeaderProps<TField>) {
	const isActive = sortField === field;
	const direction = sortableColumnDirection(sortField, field, sortDir);
	return (
		<th
			className={cn('px-4 py-3 text-left', align === 'right' && 'text-right', headerClassName)}
			aria-sort={direction}
			data-testid="sortable-column-header"
			data-sort-field={field}
		>
			<TooltipProvider delayDuration={tooltipDelayMs}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onToggleSort(field)}
							aria-label={sortableColumnAriaLabel(label, direction)}
							className={cn(
								'h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground',
								align === 'right' && 'ml-auto',
							)}
						>
							{label}
							{!isActive && <ArrowUpDown className="size-3 text-muted-foreground/50" />}
							{isActive && sortDir === 'asc' && <ArrowUp className="size-3" />}
							{isActive && sortDir === 'desc' && <ArrowDown className="size-3" />}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top">
						{sortableColumnTooltipText(label, direction)}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</th>
	);
}
