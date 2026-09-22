/**
 * ScheduleReviewWorkspaceTaskModes
 *
 * C1 (TIMETABLE-RELAXED-MAIN-C01) — extracted from ScheduleReviewWorkspaceHeader
 * to keep that file inside the 1000-physical-line component cap (AGENTS.md §8).
 * Renders the same task-mode button row (`timetable-task-*`), each button still
 * anchored to `#timetable-foolproof-help`, so the visible DOM is unchanged.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type TimetableTaskMode = {
	id: 'review' | 'place' | 'switch' | 'plan' | 'requests';
	label: string;
	helper: string;
	icon: LucideIcon;
	active: boolean;
	disabled?: boolean;
	onClick: () => void;
	badge?: ReactNode;
};

export function ScheduleReviewWorkspaceTaskModes({ taskModes }: { taskModes: TimetableTaskMode[] }) {
	return (
		<div
			role="group"
			aria-label="Timetable task modes"
			className="flex min-w-0 gap-1 overflow-x-auto pb-0.5 sm:flex-1 [@media(max-height:500px)]:pb-0"
		>
			{taskModes.map((task) => {
				const Icon = task.icon;
				return (
					<TooltipProvider key={task.id}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant={task.active ? 'default' : 'outline'}
									size="sm"
									className="h-11 shrink-0 gap-1.5 px-3 text-xs"
									disabled={task.disabled}
									onClick={task.onClick}
									data-testid={`timetable-task-${task.id}`}
									aria-describedby="timetable-foolproof-help"
								>
									<Icon className="size-3.5" aria-hidden="true" />
									<span>{task.label}</span>
									{task.badge !== undefined && (
										<Badge
											variant={task.active ? 'secondary' : 'outline'}
											className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[0.65rem]"
										>
											{task.badge}
										</Badge>
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs text-xs">
								{task.helper}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			})}
		</div>
	);
}
