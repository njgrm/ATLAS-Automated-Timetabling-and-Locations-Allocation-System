import {
	ArrowRightLeft,
	Building2,
	ChevronDown,
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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { runAnchorLabel } from '@/lib/timetable-plain-language';
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
	/**
	 * DRAFT-UX-C01 (S5) — the Simple layout has no left rail; the
	 * "Unassigned sessions (N)" entry leads the daily tasks.
	 */
	unassignedEntry?: ReactNode;
	/**
	 * Row 46 — the menu closes itself when the names are refreshed, so the cue
	 * that the refresh happened cannot live inside the menu. This tells the
	 * header to show it in the status region directly above the action row.
	 */
	onSchoolNamesRefreshed?: () => void;
};

/**
 * #50 — a group heading, at the strength a first-level list item needs, with the
 * number of rows under it.
 *
 * The recorded measurement was 25+ items in a 510px scrolling box whose content
 * was 1464px, with a thin scrollbar and no "more below" cue; one runner read the
 * top eight rows and concluded the rest did not exist. A heading that says how
 * many rows it owns is the cheapest honest fix for the "is this all of it?"
 * question, and it survives the rows that are currently scrolled out of sight.
 */
function MoreGroupHeading({ label, itemCount }: { label: string; itemCount: number }) {
	return (
		<DropdownMenuLabel
			className="flex items-baseline gap-2 px-0 py-0 text-sm font-semibold text-foreground"
			data-more-group={label}
		>
			<span>{label}</span>
			<span className="text-xs font-normal text-muted-foreground">
				{itemCount} {itemCount === 1 ? 'item' : 'items'}
			</span>
		</DropdownMenuLabel>
	);
}

/**
 * #50 — the scrolling region of the More menu, with an explicit overflow cue.
 *
 * The recorded measurement: 25+ items, a 510px visible box, 1464px of content, a
 * 6px scrollbar and no "more below" cue — so Help & display, Tools and Schedule
 * data all sat below an unmarked fold, and one runner reported the rest of the
 * menu as not existing. Three changes, all here:
 *
 *   1. the visible cap rises from `min(82svh, 32rem)` to `min(88svh, 44rem)`,
 *      so 704px of the list is on screen instead of 512px;
 *   2. the 6px `scrollbar-thin` utility is dropped here, because a scrollbar you
 *      cannot see is the same defect as no cue;
 *   3. a sticky cue says so in words, and MEASURES it: it appears only when the
 *      content really is taller than the box, so it can never claim an overflow
 *      that is not there, and it changes to "end of list" at the bottom.
 *
 * The region is a menu, not a page, so it keeps its own bounded height and the
 * no-scroll architecture (no root scrollbar is introduced).
 */
export function SimpleMoreScrollRegion({ children }: { children: ReactNode }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [overflow, setOverflow] = useState<'fits' | 'more' | 'end'>('fits');

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		const measure = () => {
			const hidden = element.scrollHeight - element.clientHeight;
			if (hidden <= 4) {
				setOverflow('fits');
				return;
			}
			setOverflow(element.scrollTop + element.clientHeight >= element.scrollHeight - 4 ? 'end' : 'more');
		};
		measure();
		element.addEventListener('scroll', measure, { passive: true });
		// jsdom has no ResizeObserver; the guard keeps the measurement honest
		// instead of crashing a test that renders the menu.
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
		observer?.observe(element);
		return () => {
			element.removeEventListener('scroll', measure);
			observer?.disconnect();
		};
	}, [children]);

	return (
		<div
			ref={scrollRef}
			className="max-h-[min(88svh,44rem)] overflow-y-auto p-2"
			data-testid="timetable-simple-more-scroll"
		>
			{overflow === 'fits' ? null : (
				<p
					role="status"
					data-testid="timetable-simple-more-overflow-cue"
					data-overflow-state={overflow}
					className="sticky top-0 z-10 mb-1 flex items-center gap-1.5 rounded border border-border bg-background/95 px-2 py-1 text-xs font-medium text-foreground"
				>
					<ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
					{overflow === 'end'
						? 'End of this list. Scroll up for the first items.'
						: 'More items below. Scroll down to see all of them.'}
				</p>
			)}
			{children}
		</div>
	);
}

export function SimpleMoreMenuContent({
	context,
	runToolsAvailable,
	hideReviewIssues = false,
	onClose,
	onStartTask,
	onOpenTeacherDeparture,
	onOpenRequests,
	onLayoutModeChange,
	onOpenTutorial,
	onSchoolNamesRefreshed,
	unassignedEntry = null,
}: SimpleMoreMenuContentProps) {
	// #50 — the item counts behind each heading. They are derived from the SAME
	// conditions that render the rows, so a heading can never claim a row count
	// the group does not have.
	const hasUnassignedRunTasks = (context.summary?.unassignedCount ?? 0) > 0;
	const hasPendingRequests = context.requestPendingCount > 0;
	const dailyTaskCount = 1 + 1 + 1 + (unassignedEntry ? 1 : 0)
		+ (hasUnassignedRunTasks ? 1 : 0)
		+ (hasPendingRequests ? 1 : 0);
	const expertToolCount = (hideReviewIssues ? 0 : 1) + 3;
	const dayOptionsVisible = Boolean(context.policyAlignmentWarning) || context.hiddenRowCount > 0;
	const helpAndDisplayCount = (onOpenTutorial ? 1 : 0) + (dayOptionsVisible ? 1 : 0) + 1;
	return (
		<div className="space-y-2">
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-daily-tasks">
				<MoreGroupHeading label="Daily tasks" itemCount={dailyTaskCount} />
				{unassignedEntry}
				{hasUnassignedRunTasks ? <DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-place-unresolved" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('place-unresolved'); }}>
					<ClipboardCheck className="size-3.5" aria-hidden="true" />
					Place unresolved sessions
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
				</DropdownMenuItem> : null}
				<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-swap-sessions" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('swap-sessions'); }}>
					<ArrowRightLeft className="size-3.5" aria-hidden="true" />
					Swap sessions
					{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
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
				{context.requestPendingCount > 0 ? <DropdownMenuItem
					className="h-9 gap-2 text-xs"
					disabled={context.requestPendingCount === 0}
					onSelect={(event) => { event.preventDefault(); onClose(); onOpenRequests(); }}
					data-testid="timetable-more-review-requests"
				>
					<ClipboardCheck className="size-3.5" aria-hidden="true" />
					Review room requests ({context.requestPendingCount})
				</DropdownMenuItem> : null}
			</div>
			<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-expert-tools">
				<MoreGroupHeading label="Expert tools" itemCount={expertToolCount} />
				{hideReviewIssues ? null : (
					<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-review-issues" onSelect={(event) => { event.preventDefault(); onClose(); void onStartTask('review-issues'); }}>
						<ListChecks className="size-3.5" aria-hidden="true" />
						Review issues
						{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
					</DropdownMenuItem>
				)}
				{/* LANE-C C03 (B10) — a disabled entry says why instead of only
				    greying out; the reason stays readable (full opacity). */}
				<DropdownMenuItem
					className={cn('gap-2 text-xs', context.editHistoryCount === 0 ? 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100' : 'h-9')}
					disabled={context.editHistoryCount === 0}
					onSelect={(event) => { event.preventDefault(); onClose(); context.setShowEditHistory(true); }}
					data-testid="timetable-more-schedule-history"
				>
					<History className={cn('size-3.5', context.editHistoryCount === 0 && 'mt-0.5 text-muted-foreground')} aria-hidden="true" />
					{context.editHistoryCount === 0 ? (
						<span className="flex flex-col">
							<span className="text-muted-foreground">Schedule history</span>
							<span className="text-xs text-muted-foreground" data-testid="timetable-more-schedule-history-reason">
								Nothing to show yet: no class has been moved, swapped or given a new room in this schedule.
							</span>
						</span>
					) : (
						<span>Schedule history ({context.editHistoryCount})</span>
					)}
				</DropdownMenuItem>
			{/* UX-R03a — policy editing stays Advanced; Simple links to the nested
			    policy route. The route→view sync drives the existing guarded
			    centerView state, so no state workaround is needed here.

			    #49 (a) — the link used to ALSO save the Expert layout in the
			    browser (`onLayoutModeChange('advanced')` → `setLayoutMode` →
			    localStorage). The policy page renders no scheduler chrome at all
			    (`isTimetableSchedulerView('policy') === false`), so that write was
			    invisible: the user opened a policy page, found no header, and every
			    later /timetable load — including a new tab — opened "GENERATED
			    TIMETABLE" in Expert view with a different More menu, and the only
			    way out was a 12px button one runner could not find and another
			    could only reach on the second click.

			    Navigation here now mutates NOTHING but the URL. Staying in Expert
			    is a separate, explicit choice: the `Expert view` item below. */}
			<DropdownMenuItem
				asChild
				className="h-9 gap-2 text-xs"
				data-testid="timetable-more-policy"
			>
				<Link
					to="/timetable/policies"
					onClick={onClose}
				>
					<Settings2 className="size-3.5" aria-hidden="true" />
					Advanced rules
				</Link>
			</DropdownMenuItem>
				{/* #49 (a) — this is the ONE place in More that deliberately changes
				    and SAVES the layout, because the user chose it by name. The
				    tutorial points at More ▸ Expert tools, never here by testid, so
				    no step can promise a highlight that only exists while the menu
				    is open. */}
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
				<MoreGroupHeading label="Help & display" itemCount={helpAndDisplayCount} />
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
				{(context.policyAlignmentWarning || context.hiddenRowCount > 0) ? (					<div className="rounded-md border border-border/60 bg-background p-2" data-testid="timetable-more-day-options">
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
				<MoreGroupHeading label="Tools" itemCount={4} />
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
				<MoreGroupHeading label="Schedule data" itemCount={3} />
				<Select value={context.selectedRunId} onValueChange={context.handleRunChange} disabled={context.runs.length === 0 || context.centerView === 'pre-generation'}>
					<SelectTrigger className="h-9 text-xs">
						<SelectValue placeholder={context.runs.length === 0 ? 'No generated run yet' : 'Run to review'} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="latest" disabled={context.runs.length === 0}>Latest Run</SelectItem>
					{context.runs.map((run) => (
						<SelectItem key={run.id} value={String(run.id)}>
							{/* J2 (P3): the run number stays — it is the one internal id a
							 * scheduler can quote — but it is a quiet suffix behind the
							 * run's own timestamp instead of being the label. */}
							{runAnchorLabel(run.id, run.createdAt ? context.formatTimestamp(run.createdAt) : null)}
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
					    `/timetable/setup` pane; the menu-close stays here. Row 46: the
					    close is also why the "it happened" cue is the header's — see
					    `onSchoolNamesRefreshed`. */}
					<RefreshSetupNamesButton
						onRefreshNames={() => {
							onClose();
							context.refreshReferenceLabels();
							onSchoolNamesRefreshed?.();
						}}
					/>
				</div>
			</div>
		</div>
	);
}
