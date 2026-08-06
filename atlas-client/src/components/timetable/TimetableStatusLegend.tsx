import { CircleHelp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type TimetableStatusLegendProps = {
	compact?: boolean;
};

const STATUS_ITEMS = [
	{ label: 'Can place', description: 'This is an empty slot where the selected session can be placed.', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
	{ label: 'Can swap', description: 'The slot already has a session and can be reviewed as a possible switch.', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
	{ label: 'Blocked', description: 'A hard conflict prevents this action. Fix the issue before saving.', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
	{ label: 'Warning', description: 'The action is possible, but review the softer concern before saving.', tone: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
	{ label: 'Occupied', description: 'This slot already has one or more scheduled sessions.', tone: 'border-slate-200 bg-slate-50 text-slate-800' },
	{ label: 'Current', description: "This is the selected session's current slot or current value.", tone: 'border-blue-200 bg-blue-50 text-blue-800' },
] as const;

const STATUS_SUMMARY = 'Can place = empty slot. Can swap = occupied slot to review. Blocked = fix first. Warning = review before saving. Occupied = already scheduled. Current = selected session location.';

export function TimetableStatusLegend({ compact = false }: TimetableStatusLegendProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn('h-9 shrink-0 gap-1.5 px-2.5 text-xs font-semibold', compact ? 'bg-background' : 'bg-background/80')}
					data-testid="timetable-status-legend"
					aria-label="Open timetable status key"
				>
					<CircleHelp className="size-3.5" aria-hidden="true" />
					<span>Status key</span>
					<span className="hidden sm:inline text-muted-foreground">6 states</span>
					<span className="sr-only">{STATUS_SUMMARY}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[min(22rem,calc(100vw-1.5rem))] p-3"
				data-testid="timetable-status-legend-panel"
			>
				<div className="space-y-1">
					<p className="text-sm font-semibold text-foreground">What the grid labels mean</p>
					<p className="text-xs leading-relaxed text-muted-foreground">The words stay meaningful even when colors are hard to distinguish.</p>
				</div>
				<div className="mt-3 grid gap-2" role="list" aria-label="Timetable status definitions">
					{STATUS_ITEMS.map((item) => (
						<div key={item.label} className="flex items-start gap-2" role="listitem">
							<Badge variant="outline" className={cn('mt-0.5 h-6 shrink-0 px-1.5 text-[0.68rem] font-semibold', item.tone)}>
								{item.label}
							</Badge>
							<p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
