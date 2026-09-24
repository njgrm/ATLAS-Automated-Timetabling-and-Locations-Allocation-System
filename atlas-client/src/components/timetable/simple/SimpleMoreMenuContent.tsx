import {
	ArrowRightLeft,
	Building2,
	CalendarClock,
	CircleHelp,
	ClipboardCheck,
	HeartHandshake,
	History,
	ListChecks,
	MapPin,
	MousePointerClick,
	RefreshCw,
	Settings2,
	UserRoundX,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { RefreshSetupNamesButton } from '@/components/timetable/simple/SimpleSetupSharedControls';
import { SimpleDayOptions } from '@/components/timetable/simple/SimpleDayOptions';
import { STATUS_ITEMS } from '@/components/timetable/TimetableStatusLegend';
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
	/**
	 * C7 — when the header's single primary action already dispatches the
	 * review-issues task (the lifecycle `review-warnings` step, or an armed
	 * review task), this entry is a duplicate of that action and must not
	 * render. Every other state keeps it, so the review is never stranded.
	 */
	hideReviewIssues?: boolean;
	onClose: () => void;
	onStartTask: (task: TimetableSimpleTask) => void;
	onOpenTeacherDeparture: () => void;
	onOpenRequests: () => void;
	onLayoutModeChange: (mode: TimetableLayoutMode) => void;
	/** A3 — the tutorial dialog now opens from here, not the main header row. */
	onOpenTutorial?: () => void;
};

export function SimpleMoreMenuContent({
	context,
	runToolsAvailable,
	canPlanOrGenerate,
	hideReviewIssues = false,
	onClose,
	onStartTask,
	onOpenTeacherDeparture,
	onOpenRequests,
	onLayoutModeChange,
	onOpenTutorial,
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
					Prepare
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
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-expert-tools">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Expert tools</DropdownMenuLabel>
				{hideReviewIssues ? null : (
					<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-review-issues" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('review-issues'); }}>
						<ListChecks className="size-3.5" aria-hidden="true" />
						Review issues
						{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={context.editHistoryCount === 0}
					onSelect={(event) => { event.preventDefault(); onClose(); context.setShowEditHistory(true); }}
				>
					<History className="size-3.5" aria-hidden="true" />
					Schedule history
				</DropdownMenuItem>
			{/* UX-R03a — policy editing stays Advanced; Simple links to the nested
			    policy route. The route→view sync drives the existing guarded
			    centerView state, so no state workaround is needed here. */}
			<DropdownMenuItem
				asChild
				className="h-9 gap-2 text-xs"
				data-testid="timetable-more-policy"
			>
				<Link
					to="/timetable/policies"
					onClick={() => { onClose(); onLayoutModeChange('advanced'); }}
				>
					<Settings2 className="size-3.5" aria-hidden="true" />
					Advanced rules
				</Link>
			</DropdownMenuItem>
				<DropdownMenuItem
					className="h-9 gap-2 text-xs"
					onSelect={(event) => { event.preventDefault(); onClose(); onLayoutModeChange('advanced'); }}
					data-testid="timetable-layout-toggle"
				>
					<Settings2 className="size-3.5" aria-hidden="true" />
					Expert view
				</DropdownMenuItem>
			</div>
			{/* A3 — Status key, Tutorial and Day options move out of the main header
			    row into More, so the header keeps one status region and one action
			    row. One STATUS_ITEMS source is shared with the grid legend. */}
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-help">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Help &amp; display</DropdownMenuLabel>
				{onOpenTutorial ? (
					<DropdownMenuItem
						className="h-9 gap-2 text-xs"
						onSelect={(event) => { event.preventDefault(); onClose(); onOpenTutorial(); }}
						data-testid="timetable-more-tutorial"
					>
						<ListChecks className="size-3.5" aria-hidden="true" />
						Tutorial
					</DropdownMenuItem>
				) : null}
				{(context.policyAlignmentWarning || context.hiddenRowCount > 0) ? (
					<div className="rounded-md border border-border/60 bg-background p-2" data-testid="timetable-more-day-options">
						<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Day options</p>
						<SimpleDayOptions
							inline
							policyAlignmentWarning={context.policyAlignmentWarning}
							hiddenRowCount={context.hiddenRowCount}
							showFullDay={context.showFullDay}
							onToggleFullDay={() => context.setShowFullDay(!context.showFullDay)}
						/>
					</div>
				) : null}
				<div className="rounded-md border border-border/60 bg-background p-2" data-testid="timetable-more-status-key">
					<p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						<CircleHelp className="size-3.5" aria-hidden="true" />
						Status key
					</p>
					<div className="grid gap-1" role="list" aria-label="Timetable status definitions">
						{STATUS_ITEMS.map((item) => (
							<div key={item.label} className="flex items-start gap-1.5" role="listitem">
								<Badge variant="outline" className={cn('mt-0.5 h-5 shrink-0 px-1 text-xs font-semibold', item.tone)}>
									{item.label}
								</Badge>
								<p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
							</div>
						))}
					</div>
				</div>
			</div>
			{/* A5 — /map, /manual-edit and /building stay in-flow tools, but each is
			    now reachable from a labelled control on the index (no orphan route). */}
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-tools">
				<DropdownMenuLabel className="px-0 py-0 text-xs">Tools</DropdownMenuLabel>
				{/* S2 — the scheduler concern workspace is reachable from Simple's More
				    menu as a real link (no state dispatch, no header prop change). */}
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-teacher-concerns">
					<Link to="/faculty/concerns" onClick={onClose}>
						<HeartHandshake className="size-3.5" aria-hidden="true" />
						Teacher concerns
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-map">
					<Link to="/timetable/map" onClick={onClose}>
						<MapPin className="size-3.5" aria-hidden="true" />
						Campus map
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-manual-edit">
					<Link to="/timetable/manual-edit" onClick={onClose}>
						<MousePointerClick className="size-3.5" aria-hidden="true" />
						Manual edit
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-building">
					<Link to="/timetable/building" onClick={onClose}>
						<Building2 className="size-3.5" aria-hidden="true" />
						Building view
					</Link>
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
					<Button type="button" variant="outline" size="sm" className="h-9 justify-start gap-1.5 text-xs" onClick={() => { onClose(); context.handleRefresh(); }}>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						Refresh timetable
					</Button>
					{/* UX-R03e (setup) — one shared refresh implementation with the
					    `/timetable/setup` pane; the menu-close stays here. */}
					<RefreshSetupNamesButton onRefreshNames={() => { onClose(); context.refreshReferenceLabels(); }} />
				</div>
			</div>
		</div>
	);
}
