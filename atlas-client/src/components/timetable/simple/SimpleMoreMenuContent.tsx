import { Link } from 'react-router-dom';
import {
	ArrowRightLeft,
	BookOpen,
	CalendarClock,
	ClipboardCheck,
	HelpCircle,
	History,
	Info,
	ListChecks,
	Play,
	RefreshCw,
	Settings2,
	SlidersHorizontal,
	UserRoundX,
} from 'lucide-react';

import { Button } from '@/ui/button';
import { DropdownMenuItem, DropdownMenuLabel } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';

/**
 * R7 — the Simple "More" menu. Extracted so every migrated Simple entry point
 * (room-request review, policy link, setup-tools) is directly renderable and
 * testable, and so the header stays within the component-size budget.
 */
export type SimpleMoreMenuContentProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	runToolsAvailable: boolean;
	canPlanOrGenerate: boolean;
	onClose: () => void;
	onStartTask: (task: TimetableSimpleTask) => void;
	onOpenTeacherDeparture: () => void;
	onOpenRequests: () => void;
	onOpenTutorial: () => void;
	onOpenStatusKey: () => void;
	onOpenFilters: () => void;
	onLayoutModeChange: (mode: TimetableLayoutMode) => void;
};

export function SimpleMoreMenuContent({
	context,
	runToolsAvailable,
	canPlanOrGenerate,
	onClose,
	onStartTask,
	onOpenTeacherDeparture,
	onOpenRequests,
	onOpenTutorial,
	onOpenStatusKey,
	onOpenFilters,
	onLayoutModeChange,
}: SimpleMoreMenuContentProps) {
	return (
		<div className="space-y-2">
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-daily-tasks">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Daily tasks</DropdownMenuLabel>
				<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-place-unresolved" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('place-unresolved'); }}>
					<ClipboardCheck className="size-3.5" aria-hidden="true" />
					Place unresolved sessions
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
				</DropdownMenuItem>
				<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-swap-sessions" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('swap-sessions'); }}>
					<ArrowRightLeft className="size-3.5" aria-hidden="true" />
					Swap sessions
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
				</DropdownMenuItem>
				<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!canPlanOrGenerate} onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('plan-draft'); }}>
					<CalendarClock className="size-3.5" aria-hidden="true" />
					Plan draft
				</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={!runToolsAvailable}
					onSelect={(event) => { event.preventDefault(); onOpenTeacherDeparture(); }}
					data-testid="teacher-departure-trigger"
				>
					<UserRoundX className="size-3.5" aria-hidden="true" />
					Teacher leaving / Reassign load
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
				</DropdownMenuItem>
				{/* R7 — room-request review is reachable from Simple when requests are pending. */}
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={context.requestPendingCount === 0}
					onSelect={(event) => { event.preventDefault(); onClose(); onOpenRequests(); }}
					data-testid="timetable-more-review-requests"
				>
					<ClipboardCheck className="size-3.5" aria-hidden="true" />
					Review room requests{context.requestPendingCount > 0 ? ` (${context.requestPendingCount})` : ''}
				</DropdownMenuItem>
			</div>
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Help</DropdownMenuLabel>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); onOpenTutorial(); }}
				>
					<BookOpen className="size-3.5" aria-hidden="true" />
					Tutorial
				</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); onOpenStatusKey(); }}
				>
					<Info className="size-3.5" aria-hidden="true" />
					Status key
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs">
					<Link to="/timetabling/how-it-works">
						<HelpCircle className="size-3.5" aria-hidden="true" />
						How this works
					</Link>
				</DropdownMenuItem>
			</div>
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-expert-tools">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Expert tools</DropdownMenuLabel>
				<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-review-issues" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('review-issues'); }}>
					<ListChecks className="size-3.5" aria-hidden="true" />
					Review issues
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
				</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={!canPlanOrGenerate}
					onSelect={(event) => { event.preventDefault(); onClose(); context.handleTriggerGenerate(); }}
				>
					<Play className="size-3.5" aria-hidden="true" />
					Generate schedule
				</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={context.editHistoryCount === 0}
					onSelect={(event) => { event.preventDefault(); onClose(); context.setShowEditHistory(true); }}
				>
					<History className="size-3.5" aria-hidden="true" />
					Edit history
				</DropdownMenuItem>
				{/* R7 — policy editing stays Advanced; Simple exposes the link. */}
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => {
						event.preventDefault();
						onClose();
						onLayoutModeChange('advanced');
						window.requestAnimationFrame(() => context.switchCenterViewWithGuard(context.enterPolicyView));
					}}
					data-testid="timetable-more-policy"
				>
					<Settings2 className="size-3.5" aria-hidden="true" />
					Scheduling policy (Advanced)
				</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); onLayoutModeChange('advanced'); }}
					data-testid="timetable-layout-toggle"
				>
					<Settings2 className="size-3.5" aria-hidden="true" />
					Advanced view
				</DropdownMenuItem>
			</div>
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-schedule-data">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Schedule data</DropdownMenuLabel>
				<Select value={context.selectedRunId} onValueChange={context.handleRunChange} disabled={context.runs.length === 0 || context.centerView === 'pre-generation'}>
					<SelectTrigger className="h-9 text-xs">
						<SelectValue placeholder={context.runs.length === 0 ? 'No generated run yet' : 'Run to review'} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="latest" disabled={context.runs.length === 0}>Latest Run</SelectItem>
						{context.runs.map((run) => (
							<SelectItem key={run.id} value={String(run.id)}>
								Run #{run.id} · {context.formatTimestamp(run.createdAt)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="grid gap-1.5">
					<DropdownMenuItem
						className="h-9 gap-2 text-xs"
						data-testid="timetable-filters-trigger"
						onSelect={(event) => { event.preventDefault(); onClose(); onOpenFilters(); }}
					>
						<SlidersHorizontal className="size-3.5" aria-hidden="true" />
						Filters
					</DropdownMenuItem>
					<Button type="button" variant="outline" size="sm" className="h-9 justify-start gap-1.5 text-xs" onClick={() => { onClose(); context.handleRefresh(); }}>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						Refresh timetable
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9 justify-start gap-1.5 text-xs"
						onClick={() => { onClose(); context.refreshReferenceLabels(); }}
						data-testid="timetable-refresh-setup-names"
					>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						Refresh names
					</Button>
				</div>
			</div>
		</div>
	);
}
