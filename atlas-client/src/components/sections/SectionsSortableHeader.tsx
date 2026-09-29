/**
 * A3 C4 — the Sections table's sortable column header (extracted from
 * `pages/Sections.tsx`).
 *
 * WHY THIS MOVED OUT (review finding B1, 2026-09-28): the page passed the
 * 1000-line AGENTS.md §8 cap at 1063 physical lines. `SortIcon` and
 * `SortableSectionHeader` were declared INSIDE the page component, closing over
 * `sortField`/`sortDir`/`toggleSort`, even though neither needs anything from
 * the page but those three values. They are one coherent presentational unit —
 * a sortable `<th>` — and a `<th>` is not page-level logic. They are now a
 * sibling component that takes the sort state as ordinary props.
 *
 * The accessibility contract is carried across unchanged, because it was the
 * point of the original Phase 1.5 work:
 *   - `aria-sort` carries the WCAG-standard "ascending" / "descending" /
 *     "none" value, so a screen reader and voice control both perceive the
 *     current sort state rather than inferring it from an icon.
 *   - The button carries a plain-language accessible name that names both the
 *     column and the current direction, e.g. "Sort by Enrolled, currently
 *     ascending", and the same string is the visible Tooltip content.
 *   - The header is a real `<Button>` (not a bare icon), so it is keyboard
 *     reachable and activatable.
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

/** The sortable columns, and their direction. Declared here because the header
 *  is what makes a column sortable; the page owns the state that drives it. */
export type SortField = 'name' | 'gradeLevelId' | 'enrolledCount' | 'maxCapacity' | 'fill';
export type SortDir = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
	if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
	return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

export function SortableSectionHeader({
	field,
	label,
	align = 'left',
	sortField,
	sortDir,
	onToggleSort,
}: {
	field: SortField;
	label: string;
	align?: 'left' | 'right';
	sortField: SortField;
	sortDir: SortDir;
	onToggleSort: (field: SortField) => void;
}) {
	const isActive = sortField === field;
	const direction = isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
	const ariaLabel = `Sort by ${label}, currently ${direction}`;
	return (
		<th
			className={cn('px-4 py-3 text-left', align === 'right' && 'text-right')}
			aria-sort={direction as 'ascending' | 'descending' | 'none'}
		>
			<TooltipProvider delayDuration={200}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onToggleSort(field)}
							aria-label={ariaLabel}
							className={cn(
								'h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground',
								align === 'right' && 'ml-auto',
							)}
						>
							{label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="">{ariaLabel}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</th>
	);
}
