import { Sun } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * C01R C3 — day-start visibility disclosed through a Day options popover that
 * lives inside the Simple header's single status region (instead of a sibling
 * strip). The hidden-row chip, the full-day toggle, and every testid keep
 * their dispatch and identity; the popover content stays mounted (forceMount)
 * so the controls remain in the DOM while disclosed through the trigger.
 */
export function SimpleDayOptions({
	policyAlignmentWarning,
	hiddenRowCount,
	showFullDay,
	onToggleFullDay,
}: {
	policyAlignmentWarning: string | null;
	hiddenRowCount: number;
	showFullDay: boolean;
	onToggleFullDay: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5 py-0.5">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-6 shrink-0 gap-1 px-1.5 text-xs"
						data-testid="timetable-day-options-trigger"
						aria-label={hiddenRowCount > 0
							? `Day options, ${hiddenRowCount} earlier row${hiddenRowCount === 1 ? '' : 's'} hidden`
							: 'Day options'}
					>
						<Sun className="size-3" aria-hidden="true" />
						<span>Day options</span>
						{hiddenRowCount > 0 ? (
							<span className="rounded bg-muted px-1 font-semibold">{hiddenRowCount} hidden</span>
						) : null}
					</Button>
				</PopoverTrigger>
				<PopoverContent forceMount align="start" className="w-72 p-2" data-testid="timetable-day-options-panel">
					<div className="flex flex-col gap-1.5" data-testid="timetable-hidden-row-controls">
						{policyAlignmentWarning && (
							<TooltipProvider delayDuration={300}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge
											variant="outline"
											tabIndex={0}
											role="status"
											aria-label={`${hiddenRowCount} earlier row${hiddenRowCount === 1 ? '' : 's'} hidden`}
											className="h-5 w-fit shrink-0 cursor-default gap-1 border-amber-200 bg-amber-50 px-1.5 text-xs text-amber-800 sm:h-6"
											data-testid="timetable-hidden-rows-chip"
											onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
										>
											{hiddenRowCount} earlier row{hiddenRowCount === 1 ? '' : 's'} hidden
										</Badge>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-xs" data-testid="timetable-hidden-rows-explanation">
										<p>{policyAlignmentWarning}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}

						{hiddenRowCount > 0 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 w-fit shrink-0 gap-1 px-1.5 text-xs"
								aria-pressed={showFullDay}
								onClick={onToggleFullDay}
								data-testid="timetable-show-full-day-toggle"
							>
								<Sun className="size-3" aria-hidden="true" />
								<span>{showFullDay ? 'Full day' : 'Show full day'}</span>
							</Button>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
