import { useMemo, type ReactNode } from 'react';
import { ArrowRightLeft, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap, ListChecks, Play, Send, SlidersHorizontal, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { BUILD_NEW_DRAFT_LABEL, mustFixCountLabel, PUBLISHED_SCHEDULE_STAYS_IN_USE } from '@/lib/timetable-plain-language';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';
import type { SimpleLifecycleKind } from '@/lib/simple-timetable-state';
import { formatCheckedAtAge } from '@/components/timetable/timetableWorkspaceTruth';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
/* ROW 37 / A2-UX-MENU-C2 — the tutorial moved to its own module so this file
 * stays inside the 1000-line component budget. Both exports are re-exported here
 * so `TimetableSimpleHeader`, the committed source contracts and every existing
 * importer keep their current import path unchanged. */
export { SimpleTutorialControl, simpleTutorialSteps } from '@/components/timetable/simple/SimpleTutorial';

type SimpleTaskDefinition = {
	id: TimetableSimpleTask;
	label: string;
	primaryLabel: string;
	helper: string;
	icon: LucideIcon;
	badge?: string;
	disabled?: boolean;
	href?: string;
};

type SimpleViewMode = ScheduleReviewWorkspaceHeaderContext['viewMode'];

export type { SimpleViewMode };

/** Simple mode always starts with the complete schedule; Expert review keeps
 * its independent filters and can reapply them deliberately. */
export function resetSimpleWorkspaceFilters(context: Pick<ScheduleReviewWorkspaceHeaderContext,
	'programFilter' | 'entryKindFilter' | 'severityFilter' | 'setProgramFilter' | 'setEntryKindFilter' | 'setSeverityFilter'>) {
	if (context.programFilter !== 'all') context.setProgramFilter('all');
	if (context.entryKindFilter !== 'all') context.setEntryKindFilter('all');
	if (context.severityFilter !== 'all') context.setSeverityFilter('all');
}

export function taskCount(count: number, noun: string) {
	if (count <= 0) return undefined;
	return count > 99 ? `99+ ${noun}` : `${count} ${noun}`;
}

export function sourceLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const sourceContext = context.schoolYearContext;
	if (!sourceContext) return 'Checking source';
	if (sourceContext.source === 'enrollpro-verified') return 'Verified with EnrollPro';
	if (sourceContext.source === 'enrollpro') return 'Using EnrollPro settings';
	if (sourceContext.source === 'cache') {
		// D4 (TIMETABLE-TRUTHFULNESS-C01) — the Simple header used to describe
		// the school year by its storage mechanism, which reads as staleness
		// even when the value on screen is fresh (`stale:false`) and was
		// confirmed upstream. Name the authority, what the value is, and when
		// it was last checked instead of the storage mechanism; when the copy
		// is older and a background recheck is in flight, say that plainly.
		if (sourceContext.stale) return 'School year from ATLAS, rechecking';
		const checkedAge = formatCheckedAtAge(sourceContext.cachedAt);
		return checkedAge
			? `School year from ATLAS, ${checkedAge}`
			: 'School year from ATLAS, up to date';
	}
	return 'Using saved ATLAS data';
}

export function readinessLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const yearLabel = context.schoolYearContext?.activeSchoolYearLabel;
	if (context.isPreGenerationWorkspace) {
		if (context.curriculumReadiness?.state === 'loading') return 'Checking schedule information…';
		if (context.curriculumReadiness?.state === 'failed' || context.curriculumReadiness?.state === 'unavailable') {
			return 'Schedule check needs retry';
		}
		return 'Working schedule draft';
	}
	if (!context.draft) return yearLabel ? `No ${yearLabel} timetable yet` : 'No current-year timetable yet';
	const summaryRaw = context.draft.summary as unknown as Record<string, unknown> | null;
	const isPublished = summaryRaw?.isPublished === true;
	if (isPublished) {
		const unassigned = context.summary?.unassignedCount ?? 0;
		if (unassigned > 0) return `Published with ${unassigned} follow-up item${unassigned === 1 ? '' : 's'}`;
		return 'Published';
	}
	if (context.blockingHardCount > 0) return mustFixCountLabel(context.blockingHardCount);
	// Unresolved sessions block publish exactly like hard blockers: individual
	// previewability is not joint feasibility, so never report ready while any
	// session still needs fixing.
	const unassigned = context.summary?.unassignedCount ?? 0;
	if (unassigned > 0) return `${unassigned} unresolved`;
	if (context.softCount > 0) return `${context.softCount} warning${context.softCount === 1 ? '' : 's'}`;
	return 'Ready to publish';
}

export function firstPivotValue(context: ScheduleReviewWorkspaceHeaderContext) {
	for (const group of context.groupedPivotEntities) {
		const firstId = group.ids[0];
		if (firstId != null) return String(firstId);
	}
	return '';
}

export function hasPivotValue(context: ScheduleReviewWorkspaceHeaderContext, value: string | undefined) {
	if (!value || value === 'all') return false;
	return context.groupedPivotEntities.some((group) => group.ids.some((id) => String(id) === value));
}

export function pivotEntityGroups(context: ScheduleReviewWorkspaceHeaderContext) {
	return context.groupedPivotEntities.map((group) => ({
		label: group.label,
		items: group.ids.map((id) => ({ value: String(id), label: context.pivotLabel(id) })),
	}));
}

export function SimpleScheduleControls({
	context,
	lastEntityByMode,
	onViewModeChange,
	onEntityChange,
}: {
	context: ScheduleReviewWorkspaceHeaderContext;
	lastEntityByMode: Partial<Record<SimpleViewMode, string>>;
	onViewModeChange: (value: string) => void;
	onEntityChange: (value: string) => void;
}) {
	const groups = useMemo(() => pivotEntityGroups(context), [context]);
	const entityOptionsAvailable = groups.some((group) => group.items.length > 0);
	const selectedLabel = hasPivotValue(context, context.entityFilter)
		? context.pivotLabel(Number(context.entityFilter))
		: 'Choose schedule';
	const rememberedLabel = lastEntityByMode[context.viewMode] && hasPivotValue(context, lastEntityByMode[context.viewMode])
		? context.pivotLabel(Number(lastEntityByMode[context.viewMode]))
		: selectedLabel;

	return (
		<div
			className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2 py-1 lg:min-w-[24rem]"
			data-testid="timetable-simple-schedule-switcher"
			role="group"
			aria-label="Choose timetable view and entity"
			data-view-mode={context.viewMode}
			data-entity-filter={context.entityFilter}
			/* ROW 37: a tutorial step points at this control, and a plain <div>
			 * cannot take programmatic focus, so "Show me" scrolled and did
			 * nothing visible. Focusable programmatically, still not a tab stop. */
			tabIndex={-1}
		>
			{/* LANE-C-PLAIN-LANGUAGE-C03 (J5) — the two highest-traffic controls get
			    plain visible labels again, as NON-INTERACTIVE <span>s. DRAFT-UX-C01
			    (S2) removed them to satisfy the ≤6 visible-control cap; a span is
			    not a control, so that cap and the one-solid-primary contract are
			    both unchanged, and the aria-labels below are unchanged. The words
			    describe the destination in the scheduler's own vocabulary. */}
			<span className="shrink-0 text-xs font-medium text-muted-foreground" data-testid="timetable-simple-view-mode-label">
				Show
			</span>
			<Select value={context.viewMode} onValueChange={onViewModeChange}>
				<SelectTrigger
					className="h-8 w-[7.25rem] shrink-0 text-xs"
					aria-label="View type"
					data-testid="timetable-simple-view-mode-select"
				>
					<SelectValue placeholder="View by" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="section">Section</SelectItem>
					<SelectItem value="faculty">Teacher</SelectItem>
					<SelectItem value="room">Room</SelectItem>
				</SelectContent>
			</Select>
			<span className="shrink-0 text-xs font-medium text-muted-foreground" data-testid="timetable-simple-entity-label">
				Schedule for
			</span>
			<div className="min-w-[9rem] flex-1" data-testid="timetable-simple-entity-select">
				<SearchableSelect
					value={context.entityFilter}
					onValueChange={onEntityChange}
					placeholder={`Choose ${context.VIEW_MODE_LABELS[context.viewMode] ?? 'schedule'}...`}
					triggerClassName="h-8 w-full min-w-[9rem] max-w-[18rem] text-xs"
					className="w-[min(24rem,calc(100vw-2rem))]"
					groups={groups}
					disabled={!entityOptionsAvailable}
					disabledReason="No schedule options are available yet. Generate or load a timetable first."
				/>
			</div>
			<span className="sr-only">Showing {context.VIEW_MODE_LABELS[context.viewMode]} schedule: {rememberedLabel}</span>
		</div>
	);
}

export function SimpleScheduleSheet({
	context,
	lastEntityByMode,
	onViewModeChange,
	onEntityChange,
}: {
	context: ScheduleReviewWorkspaceHeaderContext;
	lastEntityByMode: Partial<Record<SimpleViewMode, string>>;
	onViewModeChange: (value: string) => void;
	onEntityChange: (value: string) => void;
}) {
	const selectedLabel = hasPivotValue(context, context.entityFilter)
		? context.pivotLabel(Number(context.entityFilter))
		: 'Choose schedule';

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					/* The compact sheet is reserved for touch-sized layouts. Desktop
					   keeps the view-type and searchable entity chooser visible in the
					   header at every desktop breakpoint. */
					className="h-8 min-h-11 min-w-11 max-w-[28vw] gap-1.5 px-1.5 text-xs sm:px-2 lg:hidden"
					data-testid="timetable-simple-schedule-sheet-trigger"
					aria-label={`Showing ${context.VIEW_MODE_LABELS[context.viewMode]} schedule: ${selectedLabel}`}
				>
					<span className="hidden min-[420px]:inline truncate max-w-[20vw] sm:max-w-none">{selectedLabel}</span>
					<ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="bottom"
				className="flex max-h-[82svh] flex-col gap-3 rounded-t-2xl p-4"
				data-testid="timetable-simple-schedule-sheet"
			>
				<SheetHeader>
					<SheetTitle className="text-base">Choose schedule view</SheetTitle>
					<SheetDescription>
						Switch between section, teacher, and room schedules without opening Expert view.
					</SheetDescription>
				</SheetHeader>
				<SimpleScheduleControls
					context={context}
					lastEntityByMode={lastEntityByMode}
					onViewModeChange={onViewModeChange}
					onEntityChange={onEntityChange}
				/>
			</SheetContent>
		</Sheet>
	);
}

export function SimpleFiltersContent({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
	return (
		<div className="space-y-3" data-testid="timetable-simple-filters-popover">
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</p>
				<Select value={context.programFilter} onValueChange={context.setProgramFilter}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by program">
						<SelectValue placeholder="Program" />
					</SelectTrigger>
					<SelectContent>
						{context.PROGRAM_FILTER_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entry type</p>
				<Select value={context.entryKindFilter} onValueChange={context.setEntryKindFilter}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by entry type">
						<SelectValue placeholder="Entry type" />
					</SelectTrigger>
					<SelectContent>
						{context.ENTRY_KIND_FILTER_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention</p>
				<Select value={context.severityFilter} onValueChange={(value) => context.setSeverityFilter(value as ScheduleReviewWorkspaceHeaderContext['severityFilter'])}>
					<SelectTrigger className="h-9 text-xs" aria-label="Filter by attention type">
						<SelectValue placeholder="Attention" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All issues</SelectItem>
						<SelectItem value="hard">Hard blockers</SelectItem>
						<SelectItem value="soft">Warnings</SelectItem>
						<SelectItem value="conflicts">Conflicts</SelectItem>
						<SelectItem value="wellbeing">Well-being</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<p className="text-xs leading-relaxed text-muted-foreground">
				These refinements only affect what appears in the grid. Timetable assignments and publish readiness stay unchanged.
			</p>
		</div>
	);
}

/**
 * UX-QUICKFIX-C01 — the Simple header action cluster.
 *
 * Generate and Publish were previously reachable only through the More menu
 * (Generate) or as the single dynamic primary button (Publish). They are now
 * first-class, always-visible controls in the header action row. Every control
 * reads the SAME capability gate the More menu and the lifecycle dispatcher use,
 * so a closed gate renders a disabled control with a truthful tooltip and can
 * never dispatch a request.
 */
function GatedAction({ disabled, reason, children }: { disabled: boolean; reason: string | null; children: ReactNode }) {
	if (!disabled || !reason) return <>{children}</>;
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					{/* A disabled button cannot receive pointer events, so the tooltip
					    trigger is a focusable wrapper. The reason is also exposed through
					    the control's aria-label for keyboard/screen-reader users. */}
					<span className="inline-flex" tabIndex={0}>
						{children}
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
					{reason}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * TIMETABLE-HEADER-COLLAPSE-C01 (D3) — the visible Generate control, demoted.
 *
 * UX-QUICKFIX-C01 introduced Generate as a first-class header control; the
 * published-state review then found it rendered at the same `h-11 / text-sm`
 * size as the lifecycle primary, so it competed for dominance even when it was
 * not the next action. The row owns exactly one dominant control — the
 * lifecycle primary, or the published status surface — so Generate is now a
 * compact secondary control (`h-8 / text-xs`) in EVERY state. It stays present
 * in the header render (two committed contracts require it), keeps its label,
 * its gate-derived disabled state, its truthful aria-label, and the
 * `shouldDispatchSimpleGenerate` guard ahead of dispatch.
 */
/**
 * #56 — ONE verb, from the copy module, for "make a new schedule from a
 * published one".
 *
 * It was `'New version'` here and `'Build a new version'` in the header
 * aria-label while the dialog the item opens already asked "Build a new
 * draft?" and warned that the published schedule stays in use. Three names for
 * one action on one screen, and the two shortest implied an edit to the LIVE
 * schedule. Both the constant and the sentence are now DERIVED from
 * `timetable-plain-language`, so a future rename in the copy module cannot
 * leave this surface behind — and the exported name is kept because
 * `SimpleHeaderActions` and the committed label contract both import it.
 */
export const PUBLISHED_GENERATE_LABEL = BUILD_NEW_DRAFT_LABEL;
export const PUBLISHED_GENERATE_DESCRIPTION = `${BUILD_NEW_DRAFT_LABEL}. ${PUBLISHED_SCHEDULE_STAYS_IN_USE}`;

export function SimpleGenerateAction({
	disabled,
	disabledReason,
	onClick,
	published = false,
	primary = false,
}: {
	disabled: boolean;
	disabledReason: string | null;
	onClick: () => void;
	/**
	 * #56 — on a published schedule a bare "Generate" beside the published chip
	 * read as "regenerate what teachers see". It builds a new DRAFT instead, and
	 * the label and the aria-label both say so, in the one verb the dialog uses.
	 */
	published?: boolean;
	/**
	 * DRAFT-UX-C01 (operator, 2026-09-25) — Generate is the header's one solid
	 * primary while the school year/term has no generated run. Once a run
	 * exists, Publish owns the primary slot and Generate moves into More.
	 */
	primary?: boolean;
}) {
	const reason = disabled ? (disabledReason ?? 'Generation is not available for this school year yet.') : null;
	const name = published ? PUBLISHED_GENERATE_DESCRIPTION : 'Generate schedule';
	return (
		<GatedAction disabled={disabled} reason={reason}>
			<Button
				type="button"
				variant={primary ? 'default' : 'outline'}
				size="sm"
				className={primary ? 'h-11 min-w-28 gap-1.5 px-3 text-sm' : 'h-8 gap-1.5 px-2.5 text-xs'}
				disabled={disabled}
				aria-label={reason ? `${published ? BUILD_NEW_DRAFT_LABEL : 'Generate schedule'} — ${reason}` : name}
				onClick={onClick}
				data-testid="timetable-simple-generate-action"
			>
				<Play className="size-3.5" aria-hidden="true" />
				<span>{published ? PUBLISHED_GENERATE_LABEL : 'Generate'}</span>
			</Button>
		</GatedAction>
	);
}

export function SimplePublishAction({
	enabled,
	disabledReason,
	primary,
	onClick,
}: {
	enabled: boolean;
	disabledReason: string | null;
	/** C01R C1 — the solid primary exactly when the lifecycle primary is
	    suppressed for the publish slot; secondary/outline otherwise, so the
	    header never shows two solid actions or two publish controls. */
	primary: boolean;
	onClick: () => void;
}) {
	const reason = enabled ? null : (disabledReason ?? 'Publishing is not available for this run yet.');
	return (
		/* A2-C6-TRUTH (T3g) — the reason is IN PLACE, not in a tooltip.
		 *
		 * The live measurement, 2026-09-28: a big red `Publish schedule` on a draft
		 * holding warnings, with the only explanation one screen away behind a
		 * disabled control. A disabled button cannot be hovered reliably, cannot be
		 * focused, and its `aria-label` is read by a screen reader rather than seen
		 * by the person deciding whether to keep working — so the state was a red
		 * control that looked broken and a reason that had to be hunted for. The
		 * tooltip is KEPT for the keyboard/hover case, and the sentence is now also
		 * printed next to the control, in the same place, before it is pressed. */
		<span className="flex min-w-0 flex-col items-start gap-0.5">
			<GatedAction disabled={!enabled} reason={reason}>
				<Button
					type="button"
					variant={primary ? 'default' : 'outline'}
					size="sm"
					className="h-11 gap-1.5 px-3 text-sm"
					disabled={!enabled}
					aria-label={reason ? `Publish schedule — ${reason}` : 'Publish schedule'}
					onClick={onClick}
					data-testid="timetable-simple-publish-action"
				>
					<Send className="size-3.5" aria-hidden="true" />
					<span>Publish schedule</span>
				</Button>
			</GatedAction>
			{reason ? (
				<p className="max-w-[22rem] text-xs font-medium text-muted-foreground" data-testid="timetable-publish-blocked-reason">
					{reason}
				</p>
			) : null}
		</span>
	);
}

/**
 * TIMETABLE-HEADER-COLLAPSE-C01 (D2) — the published run's dominant lifecycle
 * surface.
 *
 * A published schedule is read-only history, so the published state *is* the
 * lifecycle primary for that state: it sits where the primary sits, and it must
 * out-rank the adjacent controls. Before this correction it was a light
 * `border-emerald-200 / bg-emerald-50` chip the same height as the full-size
 * outline Generate beside it, so Generate read as the largest control on the
 * row. It now keeps the `h-11 / text-sm font-semibold` lifecycle sizing, with a
 * strengthened emerald outline, so it is the one dominant element while
 * Generate is demoted below it.
 *
 * It stays a status surface, never an action: the committed "a published run
 * renders no solid action" contract holds (no `<button>`, no `bg-primary`), and
 * the copy is unchanged and honest (`read only`, or the follow-up count). The
 * published run offers no publish affordance, and re-generating remains the
 * adjacent Generate control.
 */
/** LANE-C C03 (B4) — what a published schedule allows, in one line. */
export const PUBLISHED_CHANGE_HINT = 'Changes start on a date you choose';

export function SimplePublishedState({ followUpCount }: { followUpCount: number }) {
	// LANE-C C03 (B4) — SUPERSEDED: 'Published schedule — view only'. The chip
	// sat beside Swap and Teacher leaving, which do change a published schedule
	// (as dated changes), so "view only" was untrue. The chip now says what a
	// change does instead.
	const label = followUpCount > 0
		? `Published schedule — ${followUpCount} follow-up item${followUpCount === 1 ? '' : 's'} remain`
		: 'Published schedule';
	return (
		<div
			className="flex h-11 min-w-28 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900"
			data-testid="timetable-simple-published-state"
			data-published-follow-ups={followUpCount}
			role="status"
			aria-label={`${label}. ${PUBLISHED_CHANGE_HINT}.`}
		>
			<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="flex min-w-0 flex-col leading-tight">
				<span className="truncate">{label}</span>
				<span className="truncate text-xs font-normal text-emerald-800" data-testid="timetable-simple-published-hint">{PUBLISHED_CHANGE_HINT}</span>
			</span>
		</div>
	);
}

export function useSimpleTasks(
	context: ScheduleReviewWorkspaceHeaderContext,
	gates: TimetableCapabilities['gates'],
): SimpleTaskDefinition[] {
	return useMemo(() => {
		const unassignedCount = context.summary?.unassignedCount ?? 0;
		const noCurrentTimetable = !context.draft && !context.isPreGenerationWorkspace;
		const yearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? 'current school year';
		// C1-b — the task badge reads the same single authority as the
		// recommended task and the lifecycle next step. It previously counted
		// every HARD violation and labelled it "blocked", so a run the publish
		// gate called ready showed "3 blocked" on its own review task.
		const publishTruth = resolvePublishBlockTruth(context);
		return [
			{
				id: 'place-unresolved',
				label: 'Place unresolved',
				primaryLabel: 'Start placing',
				helper: 'Choose one unresolved session, then choose a green slot on the grid. No dragging required.',
				icon: ClipboardCheck,
				badge: taskCount(unassignedCount, 'to place'),
				disabled: context.isPreGenerationWorkspace,
			},
			{
				id: 'swap-sessions',
				label: 'Swap class times',
				primaryLabel: 'Start swapping',
				helper: gates.swap.enabled
					? 'Choose one class on the grid, then choose another class to switch with it. Each teacher stays with their class.'
					: (gates.swap.reason ?? 'Swapping is not available for this run yet.'),
				icon: ArrowRightLeft,
				disabled: !gates.swap.enabled,
			},
			{
				id: 'review-issues',
				label: 'Review issues',
				primaryLabel: 'Review issues',
				helper: 'See the most important blockers and warnings without opening the full diagnostics wall.',
				icon: ListChecks,
				badge: taskCount(
					publishTruth.blockingHardCount || context.softCount,
					publishTruth.blockingHardCount > 0 ? 'blocked' : 'warnings',
				),
				disabled: context.isPreGenerationWorkspace || !gates.issueReview.enabled,
			},
			{
				id: 'plan-draft',
				label: noCurrentTimetable ? 'Build Teaching Load' : context.isPreGenerationWorkspace ? 'Continue draft' : 'Plan draft',
				primaryLabel: noCurrentTimetable ? 'Open Teaching Load' : context.isPreGenerationWorkspace ? 'Continue draft' : 'Plan before generating',
				helper: noCurrentTimetable
					? `No ${yearLabel} timetable yet. Build Teaching Load before creating the first timetable.`
					: 'Open the pre-generation draft queue and place sessions before generating a new run.',
				icon: noCurrentTimetable ? GraduationCap : CalendarClock,
				badge: taskCount(context.draftPlacementCount, 'draft'),
				disabled: context.newDraftLoading || !context.schoolYearId,
				href: noCurrentTimetable ? '/teaching-load' : undefined,
			},
			{
				id: 'publish',
				label: 'Publish',
				primaryLabel: 'Publish schedule',
				helper: gates.publication.enabled
					? 'Publish when the schedule is clean.'
					: (gates.publication.reason ?? 'Publishing is not available for this run yet.'),
				icon: Send,
				disabled: !gates.publication.enabled,
			},
		];
	}, [
		context.draft,
		context.draftPlacementCount,
		context.blockingHardCount,
		context.hardCount,
		context.isPreGenerationWorkspace,
		context.newDraftLoading,
		context.schoolYearContext?.activeSchoolYearLabel,
		context.schoolYearId,
		context.softCount,
		context.summary?.unassignedCount,
		gates.swap.enabled,
		gates.swap.reason,
		gates.issueReview.enabled,
		gates.publication.enabled,
		gates.publication.reason,
	]);
}

/**
 * C1-b — the ONE predicate for "what must I fix before this can be published".
 *
 * `hardCount` is every HARD violation the run reports. `blockingHardCount` is
 * the allowlist-filtered, publication-relevant subset — the count the publish
 * gate, the readiness chip, the readiness sheet, and `deriveSimpleLifecycleAction`
 * already agree on. The Simple header's *recommended task* used to read
 * `hardCount` instead, so with `hardCount = 3, blockingHardCount = 0` the header
 * recommended "Review issues" while the same header reported "Ready to publish".
 *
 * Every surface now reads this single derivation, so that state is unreachable.
 * The HARD violations that do not block publication are real, so they are not
 * hidden either: `nonBlockingHardCount` is stated on the header in plain words.
 */
export type SimplePublishBlockTruth = {
	/** The one count that decides what must be fixed before this can be published. */
	blockingHardCount: number;
	/** HARD rule breaks that do not stop publishing; still worth stating plainly. */
	nonBlockingHardCount: number;
};

export function resolvePublishBlockTruth(context: { hardCount: number; blockingHardCount: number }): SimplePublishBlockTruth {
	return {
		blockingHardCount: context.blockingHardCount,
		nonBlockingHardCount: Math.max(0, context.hardCount - context.blockingHardCount),
	};
}

export function chooseRecommendedTask(tasks: SimpleTaskDefinition[], context: ScheduleReviewWorkspaceHeaderContext) {
	const unassignedCount = context.summary?.unassignedCount ?? 0;
	if (context.isPreGenerationWorkspace) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (!context.draft) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (unassignedCount > 0) return tasks.find((task) => task.id === 'place-unresolved') ?? tasks[0];
	// C1-b — `blockingHardCount`, the same count the lifecycle next step and the
	// publish gate read. Reading `hardCount` here is what let the header
	// recommend "Review issues" beside its own "Ready to publish".
	if (context.blockingHardCount > 0 || context.softCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	if (context.requestPendingCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	return tasks.find((task) => task.id === 'publish') ?? tasks[0];
}

/**
 * C07B/F2 — where the `publish` task must land.
 *
 * The publish task is a real publish-readiness surface, not a dead branch:
 *  - gate open  → `publish-task`: the task drawer renders `PublishChecklistContent`
 *    (run-wide gate + grouped blockers + the Publish action);
 *  - gate closed → `readiness-sheet`: the read-only `SimplePublishReadinessSheet`
 *    explains why publishing is unavailable.
 *
 * The candidate never armed the task (the old dispatcher opened the publish
 * dialog directly), which left the corrected checklist component unreachable.
 */
export type PublishTaskDispatch = 'publish-task' | 'readiness-sheet';

export function resolvePublishTaskDispatch(publicationEnabled: boolean): PublishTaskDispatch {
	return publicationEnabled ? 'publish-task' : 'readiness-sheet';
}

/**
 * C7 — does the header's single primary action already dispatch the
 * review-issues task?
 *
 * The audit contract is one primary action and no action reachable from both
 * the header primary and `More`. The primary dispatches `startTask('review-issues')`
 * in exactly two states: an armed `review-issues` task, or the lifecycle
 * `review-warnings` next step. In both, `More` must not offer the same action a
 * second time. Every other state keeps the `More` entry, because there the
 * primary owns a different action and removing it would strand the review.
 */
export function primaryDispatchesReviewIssues(input: {
	activeTaskId: TimetableSimpleTask | null;
	lifecycleKind: SimpleLifecycleKind;
}): boolean {
	if (input.activeTaskId != null) return input.activeTaskId === 'review-issues';
	return input.lifecycleKind === 'review-warnings';
}

/* ------------------------------------------------------------------ *
 * UX-QUICKFIX-C01 — visible Generate/Publish dispatch guards
 * ------------------------------------------------------------------ */

export type SimpleHeaderActionState = {
	disabled: boolean;
	reason: string | null;
};

/**
 * The single guard behind the visible Generate control. A closed generation
 * gate must dispatch zero requests, so the click handler reads this decision
 * before it calls `context.handleTriggerGenerate()`.
 */
export function shouldDispatchSimpleGenerate(canPlanOrGenerate: boolean): boolean {
	return canPlanOrGenerate;
}

/**
 * The single guard behind the visible Publish control. A closed publication
 * gate (including an already-published run) must dispatch zero requests.
 */
export function shouldDispatchSimplePublish(publicationEnabled: boolean, isRunPublished: boolean): boolean {
	return publicationEnabled && !isRunPublished;
}

export function resolveSimpleGenerateActionState(input: {
	canPlanOrGenerate: boolean;
	loading: boolean;
	generating: boolean;
	gateReason: string | null;
}): SimpleHeaderActionState {
	if (input.canPlanOrGenerate) return { disabled: false, reason: null };
	if (input.generating) return { disabled: true, reason: 'A generation run is already in progress.' };
	if (input.loading) return { disabled: true, reason: 'The timetable is still loading.' };
	return { disabled: true, reason: input.gateReason ?? 'Generation is not available for this school year yet.' };
}

export function resolveSimplePublishActionState(input: {
	publicationEnabled: boolean;
	isRunPublished: boolean;
	gateReason: string | null;
}): SimpleHeaderActionState {
	if (input.isRunPublished) return { disabled: true, reason: 'This timetable is already published.' };
	if (input.publicationEnabled) return { disabled: false, reason: null };
	return { disabled: true, reason: input.gateReason ?? 'Publishing is not available for this run yet.' };
}
