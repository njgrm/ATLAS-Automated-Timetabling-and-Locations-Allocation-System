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
 * one viewport carried four names.
 *
 * LANE-C-PLAIN-LANGUAGE-C03 (J1r, QA F1) — that first pass gave this stat
 * `MUST_FIX_LABEL`, which was a NEW falsehood: the number it renders is the
 * run's TOTAL, not the publication-blocking count, so a run with
 * `hardViolationCount: 4` and `blockingHardViolationCount: 0` rendered
 * "Must fix: 4" while the same viewport's publish gate read 0. The blocking
 * word is now reserved for `blockingHardCount` (which has its own summary key,
 * `blockingHardViolationCount`) and this stat carries the checklist's own
 * plain wording for the total, `ALL_SERIOUS_PROBLEMS_LABEL`. A label string and
 * an explanation only: no control, no layout and no count changed here.
 */
import { Check, Clock, ShieldAlert } from 'lucide-react';

import { ALL_SERIOUS_PROBLEMS_LABEL, plainGenerationRunStatus } from '@/lib/timetable-plain-language';
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
			{/* PLAIN-LANGUAGE-J2J3-C01 (J2): the badge rendered `{draftStatus}`
				 * raw, i.e. the `GenerationRunStatus` enum, beside the two plain
				 * stat labels J1 just introduced. `statusColor` deliberately still
				 * receives the RAW value: it is a colour lookup keyed on the
				 * enum, and humanising the argument would silently change which
				 * runs render in which colour. Only the visible text is
				 * humanised. */}
			<Badge variant="outline" className={`h-5 px-1.5 text-xs font-bold ${statusColor(draftStatus)}`}>
				{plainGenerationRunStatus(draftStatus)}
			</Badge>
			<StatItem
				icon={Check}
				label="Assigned"
				value={`${summary.assignedCount}/${summary.classesProcessed}`}
				explanation="Class periods successfully placed, out of all the class periods the scheduler tried to place."
			/>
			<StatItem
				icon={ShieldAlert}
				/* WHICH count this is: `RunSummary.hardViolationCount` — the run's
				 * recorded TOTAL of serious problems, including codes that no longer
				 * block publication. The publication-relevant count is a DIFFERENT
				 * field, `RunSummary.blockingHardViolationCount`, which reaches the
				 * Simple surface as `blockingHardCount` (`timetableWorkspaceTruth.ts`
				 * `deriveRunWideReadiness` resolves the two separately) and is the one
				 * `MUST_FIX_LABEL` names. So this stat must never wear the blocking
				 * word; if a future producer ever passed a blocking count here, the
				 * label below would have to change with it. */
				label={ALL_SERIOUS_PROBLEMS_LABEL}
				value={String(summary.hardViolationCount)}
				className={summary.hardViolationCount > 0 ? 'text-red-600 font-semibold' : ''}
				explanation="Every serious problem this run recorded, including some that do not stop you publishing. The “Must fix” count is the smaller set that does."
			/>
			<StatItem
				icon={Clock}
				label="Duration"
				value={formatDuration(durationMs)}
				explanation="How long it really took to build this schedule."
			/>
		</div>
	);
}
