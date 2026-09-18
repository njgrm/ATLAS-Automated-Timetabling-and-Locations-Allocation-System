import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, BookOpen, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, Download, GraduationCap, ListChecks, Play, Send, Settings2, SlidersHorizontal, Sun, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { TimetableCapabilities, TimetableLifecycleState } from '@/lib/timetable-capabilities';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';

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

type SimpleTutorialStep = {
	title: string;
	body: string;
	target: string;
	targetTestId: string;
	icon: LucideIcon;
};

const SCHEDULE_SWITCHER_STEP: SimpleTutorialStep = {
	title: 'Choose whose schedule to see',
	body: 'Use the schedule switcher to switch between Section, Teacher, and Room views without leaving Simple mode.',
	target: 'Schedule switcher',
	targetTestId: 'timetable-simple-schedule-switcher',
	icon: CalendarClock,
};

const NO_RUN_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'Check the lifecycle action',
		body: 'With no timetable yet, the main button is your next step: generate a timetable, or open Year Setup if setup is not ready.',
		target: 'Lifecycle action',
		targetTestId: 'timetable-simple-primary-action',
		icon: Send,
	},
	{
		title: 'Confirm before generating',
		body: 'Generating opens a confirmation that lists your school year, terms, expected sessions, and saved draft anchors. Nothing is published by generating.',
		target: 'Generate confirmation',
		targetTestId: 'timetable-simple-primary-action',
		icon: ListChecks,
	},
	{
		title: 'Repair setup on Year Setup',
		body: 'If the active year, ordered terms, or Subject scheduling metadata are missing or out of sync, ATLAS sends you to Year Setup and Subjects.',
		target: 'Open Year Setup',
		targetTestId: 'timetable-simple-primary-action',
		icon: ClipboardCheck,
	},
	{
		title: 'Use Advanced only for expert repair',
		body: 'Advanced view is for expert tools like policy, map, diagnostics, and full manual-edit panels. Simple mode covers daily scheduling once a run exists.',
		target: 'Advanced view',
		targetTestId: 'timetable-layout-toggle',
		icon: Settings2,
	},
];

const GENERATED_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'Generate or re-generate the timetable',
		body: 'Use Generate to build a fresh run after setup or data changes. The run status chip shows whether the schedule is clean, blocked, or published, and Generate stays visible without opening More.',
		target: 'Generate action',
		targetTestId: 'timetable-simple-generate-action',
		icon: Play,
	},
	{
		title: 'Understand publish blockers',
		body: 'If the readiness chip shows blockers, tap it to see which sessions need fixing and why the schedule cannot be published yet.',
		target: 'Readiness chip',
		targetTestId: 'timetable-simple-readiness-chip',
		icon: ListChecks,
	},
	{
		title: 'Select a class to repair it',
		body: 'Tap a scheduled class on the grid to open its actions: Move, Change room, Swap, or class details. Teacher leaving stays a separate bulk task.',
		target: 'Selected class',
		targetTestId: 'timetable-selection-strip',
		icon: ClipboardCheck,
	},
	{
		title: 'Preview then save or undo',
		body: 'A clean placement is labelled as a one-click action and shows a prominent Undo right after saving. Warning or occupied moves always ask you to review first.',
		target: 'Selected class action',
		targetTestId: 'simple-selected-primary-action',
		icon: ClipboardCheck,
	},
	{
		title: 'Show full day when needed',
		body: 'If earlier rows are hidden, tap "Show full day" to see the complete schedule including shifted time slots.',
		target: 'Show full day',
		targetTestId: 'timetable-show-full-day-toggle',
		icon: Sun,
	},
	{
		title: 'Export workbook for review',
		body: 'Use More > Schedule data > Export workbook to download a summary for offline review or printing.',
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Download,
	},
];

const PUBLISHED_STEPS: readonly SimpleTutorialStep[] = [
	SCHEDULE_SWITCHER_STEP,
	{
		title: 'This timetable is published',
		body: 'Published schedules are read-only history. Review the grid, use Generate to build a new run from current data, or export an offline copy.',
		target: 'Published state',
		targetTestId: 'timetable-simple-published-state',
		icon: CheckCircle2,
	},
	{
		title: 'Export workbook for review',
		body: 'Use More > Schedule data > Export workbook to download a summary for offline review or printing.',
		target: 'More menu',
		targetTestId: 'timetable-simple-more-trigger',
		icon: Download,
	},
	{
		title: 'Use Advanced only for expert repair',
		body: 'Advanced view is for expert tools like policy, map, diagnostics, and full manual-edit panels.',
		target: 'Advanced view',
		targetTestId: 'timetable-layout-toggle',
		icon: Settings2,
	},
];

export function simpleTutorialSteps(lifecycle: TimetableLifecycleState | undefined): readonly SimpleTutorialStep[] {
	if (lifecycle === 'published') return PUBLISHED_STEPS;
	if (lifecycle === 'generated-issues' || lifecycle === 'generated-reviewable' || lifecycle === 'pre-generation') return GENERATED_STEPS;
	return NO_RUN_STEPS;
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
	if (sourceContext.source === 'cache') return 'Using cached school year';
	return 'Using saved ATLAS data';
}

export function readinessLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const yearLabel = context.schoolYearContext?.activeSchoolYearLabel;
	if (context.isPreGenerationWorkspace) return 'Planning draft';
	if (!context.draft) return yearLabel ? `No ${yearLabel} timetable yet` : 'No current-year timetable yet';
	const summaryRaw = context.draft.summary as unknown as Record<string, unknown> | null;
	const isPublished = summaryRaw?.isPublished === true;
	if (isPublished) {
		const unassigned = context.summary?.unassignedCount ?? 0;
		if (unassigned > 0) return `Published with ${unassigned} follow-up item${unassigned === 1 ? '' : 's'}`;
		return 'Published';
	}
	if (context.blockingHardCount > 0) return `${context.blockingHardCount} blocker${context.blockingHardCount === 1 ? '' : 's'}`;
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
			className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2 py-1"
			data-testid="timetable-simple-schedule-switcher"
			data-view-mode={context.viewMode}
			data-entity-filter={context.entityFilter}
		>
			<span className="hidden shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground xl:inline">
				Showing
			</span>
			<Select value={context.viewMode} onValueChange={onViewModeChange}>
				<SelectTrigger
					className="h-8 w-[7.25rem] shrink-0 text-xs"
					aria-label="View schedule by"
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
					className="h-8 min-h-11 min-w-11 max-w-[28vw] gap-1.5 px-1.5 text-xs sm:px-2 lg:hidden"
					aria-label={`Showing ${context.VIEW_MODE_LABELS[context.viewMode]} schedule: ${selectedLabel}`}
					data-testid="timetable-simple-schedule-sheet-trigger"
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
						Switch between section, teacher, and room schedules without opening Advanced view.
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
			<p className="text-xs text-muted-foreground">
				These filters keep you in Simple view. Use Advanced view only for expert repair panels.
			</p>
		</div>
	);
}

export function SimpleTutorialControl({ open, onOpenChange, lifecycle }: { open: boolean; onOpenChange: (open: boolean) => void; lifecycle?: TimetableLifecycleState }) {
	const [stepIndex, setStepIndex] = useState(0);
	const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
	const steps = useMemo(() => simpleTutorialSteps(lifecycle), [lifecycle]);
	const step = steps[Math.min(stepIndex, steps.length - 1)];
	const StepIcon = step.icon;
	const isLast = stepIndex >= steps.length - 1;

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

	useEffect(() => {
		setStepIndex((value) => Math.min(value, steps.length - 1));
	}, [steps.length]);

	useEffect(() => {
		setUnavailableMessage(null);
	}, [stepIndex]);

	const focusStepTarget = () => {
		const target = document.querySelector<HTMLElement>(`[data-testid="${step.targetTestId}"]`);
		if (!target) {
			setUnavailableMessage(`"${step.target}" is not available in the current view. ${step.body}`);
			return;
		}
		setUnavailableMessage(null);
		target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
		target.focus({ preventScroll: true });
		target.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
		window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1400);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-h-11 min-w-11 gap-1.5 px-1.5 text-xs sm:min-h-0 sm:min-w-0 sm:px-2.5"
					aria-label="Open timetable tutorial"
					data-testid="timetable-simple-tutorial-trigger"
				>
					<BookOpen className="size-3.5" aria-hidden="true" />
					<span className="hidden sm:inline">Tutorial</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-md" data-testid="timetable-simple-tutorial">
				<DialogHeader>
					<DialogTitle>Simple timetable tutorial</DialogTitle>
					<DialogDescription>
						Step {stepIndex + 1} of {steps.length}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3" data-testid="timetable-simple-tutorial-step" aria-live="polite">
					<div className="flex gap-1" aria-hidden="true">
						{steps.map((_, index) => (
							<div
								key={index}
								className={cn('h-1 flex-1 rounded-full', index <= stepIndex ? 'bg-primary' : 'bg-border')}
							/>
						))}
					</div>
					<div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[auto_1fr]" data-testid="simple-visual-help-step">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
							<StepIcon className="size-5" />
						</div>
						<div className="min-w-0">
							<Badge variant="outline" className="mb-2 h-6 max-w-full text-xs">
								<span className="truncate">Look for: {step.target}</span>
							</Badge>
							<p className="text-sm font-semibold text-foreground">{step.title}</p>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
							<Button type="button" variant="secondary" size="sm" className="mt-3 h-8 text-xs" onClick={focusStepTarget}>
								Show me
							</Button>
							{unavailableMessage ? (
								<p
									role="status"
									data-testid="timetable-simple-tutorial-unavailable"
									className="mt-2 text-xs font-medium text-amber-700"
								>
									{unavailableMessage}
								</p>
							) : null}
						</div>
					</div>
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
					<Button
						type="button"
						variant="outline"
						disabled={stepIndex === 0}
						onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
						data-testid="timetable-simple-tutorial-back"
					>
						Back
					</Button>
					<Button
						type="button"
						onClick={() => {
							if (isLast) onOpenChange(false);
							else setStepIndex((value) => Math.min(steps.length - 1, value + 1));
						}}
						data-testid="timetable-simple-tutorial-next"
					>
						{isLast ? 'Finish' : 'Next'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
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

export function SimpleGenerateAction({
	disabled,
	disabledReason,
	onClick,
}: {
	disabled: boolean;
	disabledReason: string | null;
	onClick: () => void;
}) {
	const reason = disabled ? (disabledReason ?? 'Generation is not available for this school year yet.') : null;
	return (
		<GatedAction disabled={disabled} reason={reason}>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-11 gap-1.5 px-3 text-sm"
				disabled={disabled}
				aria-label={reason ? `Generate schedule — ${reason}` : 'Generate schedule'}
				onClick={onClick}
				data-testid="timetable-simple-generate-action"
			>
				<Play className="size-3.5" aria-hidden="true" />
				<span>Generate</span>
			</Button>
		</GatedAction>
	);
}

export function SimplePublishAction({
	enabled,
	disabledReason,
	onClick,
}: {
	enabled: boolean;
	disabledReason: string | null;
	onClick: () => void;
}) {
	const reason = enabled ? null : (disabledReason ?? 'Publishing is not available for this run yet.');
	return (
		<GatedAction disabled={!enabled} reason={reason}>
			<Button
				type="button"
				variant={enabled ? 'default' : 'outline'}
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
	);
}

/**
 * The honest published state. A published run has no publish action; showing a
 * disabled "Publish schedule" as the primary control read as a dead end. The
 * adjacent Generate control is the real next step (re-generate from new data).
 */
export function SimplePublishedState({ followUpCount }: { followUpCount: number }) {
	const label = followUpCount > 0
		? `Published — ${followUpCount} follow-up item${followUpCount === 1 ? '' : 's'} remain`
		: 'Published — read only';
	return (
		<div
			className="flex h-11 min-w-28 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800"
			data-testid="timetable-simple-published-state"
			data-published-follow-ups={followUpCount}
			role="status"
			aria-label={label}
		>
			<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="truncate">{label}</span>
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
				badge: taskCount(context.hardCount || context.softCount, context.hardCount > 0 ? 'blocked' : 'warnings'),
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

export function chooseRecommendedTask(tasks: SimpleTaskDefinition[], context: ScheduleReviewWorkspaceHeaderContext) {
	const unassignedCount = context.summary?.unassignedCount ?? 0;
	if (context.isPreGenerationWorkspace) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (!context.draft) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (unassignedCount > 0) return tasks.find((task) => task.id === 'place-unresolved') ?? tasks[0];
	if (context.hardCount > 0 || context.softCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
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
