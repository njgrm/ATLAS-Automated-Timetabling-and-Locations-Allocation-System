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
	PencilLine,
	RefreshCw,
	Send,
	Settings2,
	Trash2,
	UserRoundX,
} from 'lucide-react';

import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { runAnchorLabel } from '@/lib/timetable-plain-language';
import { MANUAL_EDIT_NEEDS_SELECTION_REASON } from '@/components/timetable/CenterWorkspaceManualEditEmpty';
// A2-C6-TRUTH (T1b): which sentence the Schedule history entry may print.
import { editHistoryEmptyStateMessage, type EditHistoryReadState } from '@/lib/timetable-edit-history-truth';
import { cn } from '@/lib/utils';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';
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
	/**
	 * C11 D, correction 2 (QA-B2) — the draft actions the header does NOT render
	 * as its own controls, rendered as entries in the menu that is ALREADY on
	 * screen.
	 *
	 * The strip used to render `Edit`, `Discard draft` and `Publish` itself, which
	 * took the Simple header from six visible controls to nine and put two
	 * publication controls on screen at once. `Publish` is the header's own
	 * publication control; `Edit draft` and `Discard draft` live here, beside the
	 * `Manual edit` entry they sit beside in meaning, and beside Expert's
	 * `More tools` rows in the same shape.
	 *
	 * DRAFT-UX-C01 (operator, 2026-09-25) fixes the ONE solid primary as
	 * `Publish schedule` once a run exists, so the draft's own verb is a menu
	 * entry — moving it here, not re-deciding the primary.
	 *
	 * The HEADER owns the gates — it holds the one `resolveDraftStripProps`
	 * derivation — and passes each entry already decided, so a menu row can never
	 * disagree with the header about whether the action is available.
	 */
	draftActions?: {
		/** `null` when the header's primary already IS the publication control. */
		publish: { visible: boolean; enabled: boolean; reason: string | null; onSelect: () => void } | null;
		edit: { visible: boolean; enabled: boolean; reason: string | null; onSelect: () => void };
		discard: { visible: boolean; enabled: boolean; reason: string | null; onSelect: () => void };
	};
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
	draftActions,
}: SimpleMoreMenuContentProps) {
	// #50 — the item counts behind each heading. They are derived from the SAME
	// conditions that render the rows, so a heading can never claim a row count
	// the group does not have.
	const hasUnassignedRunTasks = (context.summary?.unassignedCount ?? 0) > 0;
	const hasPendingRequests = context.requestPendingCount > 0;
	// C11 correction 4 (F2, #50) — the draft rows are counted ONCE, here, and then
	// each heading counts ONLY the rows its OWN group renders. Previously
	// `dailyTaskCount` added the draft rows to the DAILY TASKS group while the rows
	// were appended to TOOLS, and `Tools` kept a hard-coded `itemCount={4}` — so the
	// menu claimed 5/3 rows for Daily tasks against 3, and 4 against 6 or 7 rendered.
	// A heading that names a row count its own group does not have IS the recorded
	// #50 defect, and this range regressed it in every run state.
	const draftPublishRow = draftActions?.publish?.visible ? 1 : 0;
	const draftEditRow = draftActions?.edit?.visible ? 1 : 0;
	const draftDiscardRow = draftActions?.discard?.visible ? 1 : 0;
	// One term per rendered row: the unassigned entry, the unresolved-placement row,
	// `Swap sessions`, `Teacher leaving / Reassign load`, the room-request row. The
	// `place-unresolved` row is CONDITIONAL, so a fixed `+1` for it was the base
	// 4/3 offset; it is counted from the same condition that renders it now.
	const dailyTaskCount = (unassignedEntry ? 1 : 0)
		+ (hasUnassignedRunTasks ? 1 : 0)
		+ 1
		+ 1
		+ (hasPendingRequests ? 1 : 0);
	// The four unconditional Tools rows — Teacher concerns · Campus map · Manual edit
	// · Building view — plus whatever draft rows this group actually renders.
	const toolsCount = 1 + 1 + 1 + 1 + draftPublishRow + draftEditRow + draftDiscardRow;
	const expertToolCount = (hideReviewIssues ? 0 : 1) + 3;
	// A2-C6-TRUTH (T1b): the entry's own state comes from the last READ, not from
	// a row count that a failed or unfinished read also produces.
	const historyReadState: EditHistoryReadState = context.editHistoryReadState ?? 'idle';
	const historyReadable = historyReadState === 'ready' && context.editHistoryCount > 0;
	const dayOptionsVisible = Boolean(context.policyAlignmentWarning) || context.hiddenRowCount > 0;
	// C11 M1 — the manual-edit pane is selection-dependent, so the menu entry is too.
	const hasSelectedClass = context.hasSelectedEntry;
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
					className={cn('gap-2 text-xs', historyReadState !== 'ready' || context.editHistoryCount === 0 ? 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100' : 'h-9')}
					disabled={!historyReadable}
					onSelect={(event) => { event.preventDefault(); onClose(); context.setShowEditHistory(true); }}
					data-testid="timetable-more-schedule-history"
				>
					<History className={cn('size-3.5', (historyReadState !== 'ready' || context.editHistoryCount === 0) && 'mt-0.5 text-muted-foreground')} aria-hidden="true" />
					{historyReadState !== 'ready' || context.editHistoryCount === 0 ? (
						<span className="flex flex-col">
							<span className="text-muted-foreground">Schedule history</span>
							{/* A2-C6-TRUTH (T1b): the sentence is chosen by the READ, not by
							    the row count. A term change cleared the ledger and nothing
							    refilled it, so this entry printed "no class has been
							    moved…" about a run holding four recorded changes. Only a
							    `ready` read of zero rows may print the empty-run claim;
							    an in-flight or failed read prints its own sentence. */}
							<span className="text-xs text-muted-foreground" data-testid="timetable-more-schedule-history-reason" data-history-read-state={historyReadState}>
								{editHistoryEmptyStateMessage(historyReadState, context.editHistoryCount)}
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
					<div className="grid gap-1" role="list" aria-label={`${CLASS_SCHEDULE_LABEL} status definitions`}>
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
				<MoreGroupHeading label="Tools" itemCount={toolsCount} />
				{/* S2 — the scheduler concern workspace is reachable from Simple's More
				    menu as a real link (no state dispatch, no header prop change). */}
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-teacher-concerns">
					<Link to="/faculty/preferences" onClick={onClose}>
						<HeartHandshake className="size-3.5" aria-hidden="true" />
						Teacher preferences
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-map">
					<Link to="/timetable/map" onClick={onClose}>
						<MapPin className="size-3.5" aria-hidden="true" />
						Campus map
					</Link>
				</DropdownMenuItem>
				{/* C11 M1 — this entry used to be a bare `<Link to="/timetable/manual-edit">`.
				    It opened a pane that needs a selected class, so with nothing selected
				    it always landed on the empty state, and the recorded walk
				    (`report.md` defect 1) could not get back to the grid from there.

				    Two changes, both from the same decision:
				      - WITH a class selected it is an in-app control, so the selection
				        travels with it through the existing `enterManualEditView` (the
				        same entry the grid's own selection actions use) instead of being
				        dropped at a route boundary.
				      - WITHOUT one it says why, in the visible reason line the Schedule
				        history entry above already uses — a disabled entry whose
				        explanation needs a hover is silence for a mouse-and-keyboard
				    operator (AGENTS.md §8, and the A2-TIMETABLE-CUSTODY-R2 precedent). */}
				<DropdownMenuItem
					className={cn('gap-2 text-xs', hasSelectedClass ? 'h-9' : 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100')}
					disabled={!hasSelectedClass}
					data-testid="timetable-more-manual-edit"
					onSelect={(event) => {
						event.preventDefault();
						onClose();
						context.enterManualEditView('CHANGE_TIMESLOT');
					}}
				>
					<MousePointerClick className="size-3.5" aria-hidden="true" />
					{hasSelectedClass ? (
						<span>Manual edit</span>
					) : (
						<span className="flex flex-col">
							<span className="text-muted-foreground">Manual edit</span>
							<span className="text-xs text-muted-foreground" data-testid="timetable-more-manual-edit-reason">
								{MANUAL_EDIT_NEEDS_SELECTION_REASON}
							</span>
						</span>
					)}
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="h-9 gap-2 text-xs" data-testid="timetable-more-building">
					<Link to="/timetable/building" onClick={onClose}>
						<Building2 className="size-3.5" aria-hidden="true" />
						Building view
					</Link>
				</DropdownMenuItem>
				{/* ── C11 D, correction 2 (QA-B2) — the draft actions the header handed
				    to this menu ────────────────────────────────────────────────────
				    `Publish`, `Edit draft` and `Discard draft` used to be buttons on
				    the draft strip, which put the header over its accepted six-control
				    cap and gave the view TWO publication controls at once. `Publish` is
				    the header's own publication control now; `Edit draft` and
				    `Discard draft` are here, beside the `Manual edit` entry they belong
				    with, and each is DISABLED WITH A VISIBLE REASON rather than a
				    hover-only tooltip (AGENTS.md §8). The header supplies the gate, so
				    a menu row cannot disagree with the header about whether the action
				    is available. */}
				{draftActions?.publish?.visible ? (
					<DropdownMenuItem
						className={cn('gap-2 text-xs', draftActions.publish.enabled ? 'h-9' : 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100')}
						disabled={!draftActions.publish.enabled}
						data-testid="timetable-more-publish"
						onSelect={(event) => {
							event.preventDefault();
							onClose();
							draftActions.publish?.onSelect();
						}}
					>
						<Send className="size-3.5" aria-hidden="true" />
						{draftActions.publish.enabled ? (
							<span>Publish schedule</span>
						) : (
							<span className="flex flex-col">
								<span className="text-muted-foreground">Publish schedule</span>
								<span className="text-xs text-muted-foreground" data-testid="timetable-more-publish-reason">
									{draftActions.publish.reason}
								</span>
							</span>
						)}
					</DropdownMenuItem>
				) : null}
				{draftActions?.edit?.visible ? (
					/* C11 correction 4 (F1) — this row was a bare `<Button>`, so it carried
					   `role=null` and no `tabindex`: Radix roving focus skipped the draft's
					   own verb, and a keyboard user could not reach it while the menu was
					   open. It is now a real `DropdownMenuItem` — the same element its two
					   siblings in this group are — so it is announced, reachable and
					   activatable from the keyboard, and it closes the menu on the way out
					   (the defect: `Discard draft` closed, `Edit draft` did not). Its blocked
					   reason is still VISIBLE TEXT beside the row, never a `title` and never
					   hover-only (AGENTS.md §8), and its `data-testid` is unchanged. */
					<DropdownMenuItem
						className={cn('gap-2 text-xs', draftActions.edit.enabled ? 'h-9' : 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100')}
						disabled={!draftActions.edit.enabled}
						data-testid="timetable-simple-edit-draft-action"
						onSelect={(event) => {
							event.preventDefault();
							onClose();
							draftActions.edit?.onSelect();
						}}
					>
						<PencilLine className="size-3.5" aria-hidden="true" />
						{draftActions.edit.enabled ? (
							<span>Edit draft</span>
						) : (
							<span className="flex flex-col">
								<span className="text-muted-foreground">Edit draft</span>
								<span className="text-xs text-muted-foreground" data-testid="timetable-edit-draft-blocked-reason">
									{draftActions.edit.reason}
								</span>
							</span>
						)}
					</DropdownMenuItem>
				) : null}
				{draftActions?.discard?.visible ? (
					<DropdownMenuItem
						className={cn('gap-2 text-xs', draftActions.discard.enabled ? 'h-9' : 'h-auto min-h-9 items-start py-1.5 data-[disabled]:opacity-100')}
						disabled={!draftActions.discard.enabled}
						data-testid="timetable-more-discard-draft"
						onSelect={(event) => {
							event.preventDefault();
							onClose();
							draftActions.discard?.onSelect();
						}}
					>
						<Trash2 className="size-3.5" aria-hidden="true" />
						{draftActions.discard.enabled ? (
							<span>Discard draft</span>
						) : (
							<span className="flex flex-col">
								<span className="text-muted-foreground">Discard draft</span>
								<span className="text-xs text-muted-foreground" data-testid="timetable-more-discard-draft-reason">
									{draftActions.discard.reason}
								</span>
							</span>
						)}
					</DropdownMenuItem>
				) : null}
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
