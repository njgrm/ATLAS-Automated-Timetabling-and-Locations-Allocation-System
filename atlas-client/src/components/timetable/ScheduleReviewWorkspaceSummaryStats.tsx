/**
 * ScheduleReviewWorkspaceSummaryStats
 *
 * C1 (TIMETABLE-RELAXED-MAIN-C01) — extracted from ScheduleReviewWorkspaceHeader
 * to keep that file inside the 1000-physical-line component cap (AGENTS.md §8).
 * The rendered DOM is unchanged: presence avatars, the run-status badge, and the
 * Assigned / Must fix / Duration stat items.
 *
 * LANE-C-PLAIN-LANGUAGE-C03 (J1) — the stat label read "Hard" while the grid
 * read "Blocked" and the Simple header read "blocker" for the same concept, so
 * one viewport carried four names. It now reads MUST_FIX_LABEL. This is a
 * label string only: no control, no layout and no count changed here.
 */
import { Check, Clock, ShieldAlert } from 'lucide-react';

import { MUST_FIX_LABEL } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { StatItem } from '@/components/timetable/TimetableShared';

type PresenceUser = {
	connectionId: string;
	displayName?: string | null;
	role?: string | null;
};

export function ScheduleReviewWorkspaceSummaryStats({
	summary,
	presence,
	statusColor,
	draftStatus,
	durationMs,
	formatDuration,
}: {
	summary: { assignedCount: number; classesProcessed: number; hardViolationCount: number };
	presence?: ReadonlyArray<PresenceUser>;
	statusColor: (value: string) => string;
	draftStatus: string;
	durationMs: number | null;
	formatDuration: (value: number | null) => string;
}) {
	return (
		<div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
			{/* Active Collaborators */}
			{presence && presence.length > 0 && (
				<div className="flex items-center gap-1.5 mr-1 select-none print:hidden">
					<span className="text-xs font-bold uppercase text-muted-foreground/80">Online:</span>
					<div className="flex -space-x-1.5 overflow-hidden">
						{presence.map((user) => {
							const label = user.displayName || 'Collaborator';
							const initials = label.substring(0, 2).toUpperCase();
							return (
								<TooltipProvider key={user.connectionId}>
									<Tooltip>
										<TooltipTrigger asChild>
											<div className="inline-flex size-7 items-center justify-center rounded-full border border-background bg-indigo-600 text-xs font-bold text-white shadow-sm ring-1 ring-black/5">
												{initials}
											</div>
										</TooltipTrigger>
										<TooltipContent className="p-2 text-xs">
											<p className="font-semibold text-foreground">{label}</p>
											<p className="text-xs capitalize text-muted-foreground">{user.role?.toLowerCase()} &middot; Active</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							);
						})}
					</div>
				</div>
			)}
			<Badge variant="outline" className={`h-5 px-1.5 text-xs font-bold ${statusColor(draftStatus)}`}>
				{draftStatus}
			</Badge>
			<StatItem
				icon={Check}
				label="Assigned"
				value={`${summary.assignedCount}/${summary.classesProcessed}`}
				explanation="Classes successfully placed vs total classes the algorithm attempted to schedule."
			/>
			<StatItem
				icon={ShieldAlert}
				label={MUST_FIX_LABEL}
				value={String(summary.hardViolationCount)}
				className={summary.hardViolationCount > 0 ? 'text-red-600 font-semibold' : ''}
				explanation="Critical policy violations. A schedule with any Hard Violations cannot be published."
			/>
			<StatItem
				icon={Clock}
				label="Duration"
				value={formatDuration(durationMs)}
				explanation="Real-world computing time it took to generate this draft."
			/>
		</div>
	);
}
