import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

export type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'gradeLevels' | 'isSeedable';
export type SortDir = 'asc' | 'desc';

type SortableHeaderProps = {
	field: SortField;
	label: string;
	sortField: SortField;
	sortDir: SortDir;
	onToggleSort: (field: SortField) => void;
	align?: 'left' | 'right';
};

export function SortableHeader({
	field,
	label,
	sortField,
	sortDir,
	onToggleSort,
	align = 'left',
}: SortableHeaderProps) {
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
							{label}
							{!isActive && <ArrowUpDown className="size-3 text-muted-foreground/50" />}
							{isActive && sortDir === 'asc' && <ArrowUp className="size-3" />}
							{isActive && sortDir === 'desc' && <ArrowDown className="size-3" />}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="text-xs">{ariaLabel}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</th>
	);
}
