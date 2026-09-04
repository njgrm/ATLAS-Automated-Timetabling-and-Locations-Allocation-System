import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, BookOpen, CalendarClock, ChevronDown, ClipboardCheck, Download, GraduationCap, ListChecks, Send, Settings2, SlidersHorizontal, Sun, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
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

const SIMPLE_TUTORIAL_STEPS = [
	{
		title: 'Choose whose schedule to see',
		body: 'Use the schedule switcher to switch between Section, Teacher, and Room views without leaving Simple mode.',
		target: 'Schedule switcher',
		targetTestId: 'timetable-simple-schedule-switcher',
		icon: CalendarClock,
	},
	{
		title: 'Check the lifecycle action',
		body: 'The lifecycle button shows your current status: Generate, Fix blockers, Review warnings, or Publish. Tap it to take the next step.',
		target: 'Lifecycle action',
		targetTestId: 'timetable-simple-primary-action',
		icon: Send,
	},
	{
		title: 'Understand publish blockers',
		body: 'If the readiness chip shows blockers, tap it to see which sessions need fixing and why the schedule cannot be published yet.',
		target: 'Readiness chip',
		targetTestId: 'timetable-simple-readiness-chip',
		icon: ListChecks,
	},
	{
		title: 'Fix a blocker group',
		body: 'From the publish readiness sheet, tap a repair action to open the correct fix path. Use "Back to blocker summary" to return.',
		target: 'Publish readiness sheet',
		targetTestId: 'timetable-simple-readiness-chip',
		icon: ClipboardCheck,
	},
	{
		title: 'Place or repair one session',
		body: 'Choose one unresolved session from the queue, then click a green grid slot. ATLAS shows a review before saving.',
		target: 'Start placing',
		targetTestId: 'timetable-simple-primary-action',
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
	{
		title: 'Use Advanced only for expert repair',
		body: 'Advanced view is for expert tools like policy, map, diagnostics, and full manual-edit panels. Simple mode covers daily scheduling.',
		target: 'Advanced view',
		targetTestId: 'timetable-layout-toggle',
		icon: Settings2,
	},
] as const;

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
	if (context.hardCount > 0) return `${context.hardCount} blocker${context.hardCount === 1 ? '' : 's'}`;
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
					className="h-8 max-w-[28vw] gap-1.5 px-1.5 text-xs sm:px-2 lg:hidden"
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

export function SimpleTutorialControl({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const [stepIndex, setStepIndex] = useState(0);
	const step = SIMPLE_TUTORIAL_STEPS[stepIndex];
	const StepIcon = step.icon;
	const isLast = stepIndex === SIMPLE_TUTORIAL_STEPS.length - 1;

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

	const focusStepTarget = () => {
		const target = document.querySelector<HTMLElement>(`[data-testid="${step.targetTestId}"]`);
		target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
		target?.focus({ preventScroll: true });
		target?.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
		window.setTimeout(() => target?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1400);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 px-1.5 text-xs sm:px-2.5"
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
						Step {stepIndex + 1} of {SIMPLE_TUTORIAL_STEPS.length}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3" data-testid="timetable-simple-tutorial-step" aria-live="polite">
					<div className="flex gap-1" aria-hidden="true">
						{SIMPLE_TUTORIAL_STEPS.map((_, index) => (
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
							else setStepIndex((value) => Math.min(SIMPLE_TUTORIAL_STEPS.length - 1, value + 1));
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

export function useSimpleTasks(context: ScheduleReviewWorkspaceHeaderContext): SimpleTaskDefinition[] {
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
				helper: 'Choose one class on the grid, then choose another class to switch with it. Each teacher stays with their class.',
				icon: ArrowRightLeft,
			},
			{
				id: 'review-issues',
				label: 'Review issues',
				primaryLabel: 'Review issues',
				helper: 'See the most important blockers and warnings without opening the full diagnostics wall.',
				icon: ListChecks,
				badge: taskCount(context.hardCount || context.softCount, context.hardCount > 0 ? 'blocked' : 'warnings'),
				disabled: context.isPreGenerationWorkspace,
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
				helper: context.hardCount > 0 ? 'Publishing is blocked until hard issues are cleared.' : 'Publish when the schedule is clean.',
				icon: Send,
				disabled: !context.draft || context.hardCount > 0 || context.isPreGenerationWorkspace,
			},
		];
	}, [context.draft, context.draftPlacementCount, context.hardCount, context.isPreGenerationWorkspace, context.newDraftLoading, context.schoolYearContext?.activeSchoolYearLabel, context.schoolYearId, context.softCount, context.summary?.unassignedCount]);
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