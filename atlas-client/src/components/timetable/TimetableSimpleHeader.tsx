import { memo, useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	ArrowRightLeft,
	BookOpen,
	CalendarClock,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ClipboardCheck,
	Download,
	HelpCircle,
	History,
	Info,
	ListChecks,
	Loader2,
	MoreHorizontal,
	Play,
	GraduationCap,
	RefreshCw,
	Send,
	Settings2,
	SlidersHorizontal,
	Sun,
	UserRoundX,
	type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { getPreferredAccessToken } from '@/lib/auth';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { SearchableSelect } from '@/ui/searchable-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { TimetableStatusLegend } from '@/components/timetable/TimetableStatusLegend';
import { SimplePublishReadinessSheet } from '@/components/timetable/SimplePublishReadinessSheet';

type TimetableSimpleHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
	layoutMode: TimetableLayoutMode;
	onLayoutModeChange: (mode: TimetableLayoutMode) => void;
	activeTask: TimetableSimpleTask | null;
	onTaskChange: (task: TimetableSimpleTask | null) => void;
	onOpenTeacherDeparture?: () => void;
	onSetRepairOrigin?: (origin: RepairOrigin | null) => void;
	readinessSheetOpen?: boolean;
	onReadinessSheetOpenChange?: (open: boolean) => void;
};

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
		icon: AlertTriangle,
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

function taskCount(count: number, noun: string) {
	if (count <= 0) return undefined;
	return count > 99 ? `99+ ${noun}` : `${count} ${noun}`;
}

function sourceLabel(context: ScheduleReviewWorkspaceHeaderContext) {
	const sourceContext = context.schoolYearContext;
	if (!sourceContext) return 'Checking source';
	if (sourceContext.source === 'enrollpro-verified') return 'Verified with EnrollPro';
	if (sourceContext.source === 'enrollpro') return 'Using EnrollPro settings';
	if (sourceContext.source === 'cache') return 'Using cached school year';
	return 'Using saved ATLAS data';
}

function readinessLabel(context: ScheduleReviewWorkspaceHeaderContext) {
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

function firstPivotValue(context: ScheduleReviewWorkspaceHeaderContext) {
	for (const group of context.groupedPivotEntities) {
		const firstId = group.ids[0];
		if (firstId != null) return String(firstId);
	}
	return '';
}

function hasPivotValue(context: ScheduleReviewWorkspaceHeaderContext, value: string | undefined) {
	if (!value || value === 'all') return false;
	return context.groupedPivotEntities.some((group) => group.ids.some((id) => String(id) === value));
}

function pivotEntityGroups(context: ScheduleReviewWorkspaceHeaderContext) {
	return context.groupedPivotEntities.map((group) => ({
		label: group.label,
		items: group.ids.map((id) => ({ value: String(id), label: context.pivotLabel(id) })),
	}));
}

function SimpleScheduleControls({
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

function SimpleScheduleSheet({
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

function SimpleFiltersContent({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
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

function SimpleTutorialControl({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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

function useSimpleTasks(context: ScheduleReviewWorkspaceHeaderContext): SimpleTaskDefinition[] {
	return useMemo(() => {
		const unassignedCount = context.summary?.unassignedCount ?? 0;
		const noCurrentTimetable = !context.draft && !context.isPreGenerationWorkspace && context.runs.length === 0;
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
				label: 'Swap sessions',
				primaryLabel: 'Start swapping',
				helper: 'Choose one class on the grid, then choose another class to switch with it.',
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
	}, [context.draft, context.draftPlacementCount, context.hardCount, context.isPreGenerationWorkspace, context.newDraftLoading, context.runs.length, context.schoolYearContext?.activeSchoolYearLabel, context.schoolYearId, context.softCount, context.summary?.unassignedCount]);
}

function chooseRecommendedTask(tasks: SimpleTaskDefinition[], context: ScheduleReviewWorkspaceHeaderContext) {
	const unassignedCount = context.summary?.unassignedCount ?? 0;
	if (context.isPreGenerationWorkspace) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (!context.draft && context.runs.length === 0) return tasks.find((task) => task.id === 'plan-draft') ?? tasks[0];
	if (unassignedCount > 0) return tasks.find((task) => task.id === 'place-unresolved') ?? tasks[0];
	if (context.hardCount > 0 || context.softCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	if (context.requestPendingCount > 0) return tasks.find((task) => task.id === 'review-issues') ?? tasks[0];
	return tasks.find((task) => task.id === 'publish') ?? tasks[0];
}

function TimetableSimpleHeaderImpl({
	context,
	onLayoutModeChange,
	activeTask,
	onTaskChange,
	onOpenTeacherDeparture,
	onSetRepairOrigin,
	readinessSheetOpen: readinessSheetOpenProp,
	onReadinessSheetOpenChange,
}: TimetableSimpleHeaderProps) {
	const navigate = useNavigate();
	const [moreOpen, setMoreOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [statusKeyOpen, setStatusKeyOpen] = useState(false);
	const [tutorialOpen, setTutorialOpen] = useState(false);
	const [readinessSheetOpenLocal, setReadinessSheetOpenLocal] = useState(false);
	const [teacherProgramExporting, setTeacherProgramExporting] = useState(false);
	const [teacherProgramExportError, setTeacherProgramExportError] = useState<string | null>(null);
	const readinessSheetOpen = readinessSheetOpenProp ?? readinessSheetOpenLocal;
	const setReadinessSheetOpen = onReadinessSheetOpenChange ?? setReadinessSheetOpenLocal;
	const [blockerReasonFilter, setBlockerReasonFilter] = useState<string | null>(null);
	const [lastEntityByMode, setLastEntityByMode] = useState<Partial<Record<SimpleViewMode, string>>>({});
	const tasks = useSimpleTasks(context);
	const recommendedTask = chooseRecommendedTask(tasks, context);
	const visibleRunId = context.draft?.runId ?? context.activeGeneratedRunId;
	const visibleYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? (context.schoolYearId ? `SY #${context.schoolYearId}` : null);
	const source = sourceLabel(context);
	const readiness = readinessLabel(context);
	const activeTaskDefinition = tasks.find((task) => task.id === activeTask) ?? recommendedTask;
	const ActiveIcon = activeTaskDefinition.icon;
	const currentEntityIsValid = hasPivotValue(context, context.entityFilter);

	useEffect(() => {
		if (!currentEntityIsValid) return;
		setLastEntityByMode((previous) => {
			if (previous[context.viewMode] === context.entityFilter) return previous;
			return { ...previous, [context.viewMode]: context.entityFilter };
		});
	}, [context.entityFilter, context.viewMode, currentEntityIsValid]);

	useEffect(() => {
		if (currentEntityIsValid) return;
		const remembered = lastEntityByMode[context.viewMode];
		const nextValue = hasPivotValue(context, remembered) ? remembered! : firstPivotValue(context);
		if (nextValue && nextValue !== context.entityFilter) {
			context.setEntityFilter(nextValue);
		}
	}, [context, currentEntityIsValid, lastEntityByMode]);

	useEffect(() => {
		if (activeTask !== 'place-unresolved' && blockerReasonFilter) {
			setBlockerReasonFilter(null);
			context.setUnassignedReasonFilter('all');
		}
	}, [activeTask, blockerReasonFilter, context]);

	const hasGeneratedRun = Boolean(context.draft || context.runs.length > 0);
	const draftSummaryRaw = context.draft?.summary as unknown as Record<string, unknown> | null;
	const isRunPublished = draftSummaryRaw?.isPublished === true;
	const publishBlocked = hasGeneratedRun && !isRunPublished && (context.hardCount > 0 || (context.summary?.unassignedCount ?? 0) > 0);
	const publishBlockedReason = context.hardCount > 0
		? `${context.hardCount} hard blocker${context.hardCount === 1 ? '' : 's'} must be fixed before publish.`
		: (context.summary?.unassignedCount ?? 0) > 0
			? `${context.summary?.unassignedCount} session${(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} still need fixing before publish.`
			: '';

	const handlePublishClick = () => {
		if (isRunPublished) return;
		if (context.hardCount > 0 || (context.summary?.unassignedCount ?? 0) > 0) {
			setReadinessSheetOpen(true);
			return;
		}
		context.setPublishAcknowledged(false);
		context.setShowPublishDialog(true);
	};

	const handleExportWorkbook = async () => {
		const runId = context.draft?.runId ?? context.activeGeneratedRunId;
		if (!runId || !context.schoolYearId) return;
		try {
			const token = getPreferredAccessToken();
			const response = await fetch(
				`/api/v1/generation/${context.schoolId}/${context.schoolYearId}/runs/${runId}/export/summary-teacher-schedule.xlsx`,
				{
					headers: {
						Authorization: `Bearer ${token ?? ''}`,
					},
				},
			);
			if (!response.ok) throw new Error('Export failed');
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `summary-teacher-schedule-run-${runId}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// Export failed silently - user can retry
		}
	};

	const handleExportTeacherProgram = async () => {
		const runId = context.draft?.runId ?? context.activeGeneratedRunId;
		const facultyId = context.viewMode === 'faculty' ? context.entityFilter : null;
		if (!runId || !context.schoolYearId || !facultyId || !context.schoolId) return;
		setTeacherProgramExportError(null);
		try {
			setTeacherProgramExporting(true);
			const token = getPreferredAccessToken();
			const response = await fetch(
				`/api/v1/generation/${context.schoolId}/${context.schoolYearId}/runs/${runId}/export/teacher-program.docx?facultyId=${encodeURIComponent(facultyId)}`,
				{
					headers: {
						Authorization: `Bearer ${token ?? ''}`,
					},
				},
			);
			if (!response.ok) {
				const err = await response.json().catch(() => ({ message: 'Export failed' }));
				throw new Error(err.message ?? 'Export failed');
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `teacher-program-${facultyId}.docx`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			setTeacherProgramExportError(err instanceof Error ? err.message : 'Export failed');
		} finally {
			setTeacherProgramExporting(false);
		}
	};

	const clearGridSelection = () => {
		context.setSelectedEntry(null);
		context.setSelectedViolation(null);
		context.setPreGenKbSource(null);
		context.setKbSelectedSource(null);
	};

	const handleViewModeChange = (value: string) => {
		const nextMode = value as SimpleViewMode;
		if (currentEntityIsValid) {
			setLastEntityByMode((previous) => ({ ...previous, [context.viewMode]: context.entityFilter }));
		}
		context.setViewMode(nextMode);
		context.setEntityFilter(lastEntityByMode[nextMode] ?? '');
		clearGridSelection();
	};

	const handleEntityChange = (value: string) => {
		context.setEntityFilter(value);
		setLastEntityByMode((previous) => ({ ...previous, [context.viewMode]: value }));
		clearGridSelection();
	};

	const startTask = async (task: TimetableSimpleTask) => {
		if (task === 'place-unresolved') {
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'review-issues') {
			context.setLeftTab('violations');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'swap-sessions') {
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'plan-draft') {
			if (!context.isPreGenerationWorkspace) {
				await context.handleStartNewPreGenerationDraft();
			}
			context.setLeftTab('unassigned');
			context.setPresentationMode('workflow');
			onTaskChange(task);
			return;
		}
		if (task === 'publish') {
			if (context.hardCount > 0) {
				context.setLeftTab('violations');
				onTaskChange('review-issues');
				return;
			}
			context.setPublishAcknowledged(false);
			context.setShowPublishDialog(true);
		}
	};

	const openTeacherDeparture = () => {
		onOpenTeacherDeparture?.();
		setMoreOpen(false);
	};

	return (
		<header className="shrink-0 border-b border-border bg-background" data-testid="timetable-simple-header">
			{/* Primary row: source, readiness, lookup, schedule switcher, right-side actions */}
			<div className="relative flex min-w-0 items-center gap-1.5 overflow-hidden px-3 py-0.5 [&>*]:min-w-0">
				<Badge
					variant="outline"
					className={cn(
						'h-5 shrink min-w-0 max-w-[22vw] gap-1.5 truncate px-1.5 text-[0.65rem] font-semibold sm:shrink-0 sm:max-w-[44vw] sm:h-6 sm:px-2 sm:text-xs',
						context.schoolYearContext?.source === 'enrollpro-verified'
							? 'border-emerald-200 bg-emerald-50 text-emerald-800'
							: 'border-amber-200 bg-amber-50 text-amber-900',
					)}
					data-testid="timetable-simple-source-chip"
				>
					<Info className="size-3.5 shrink-0" aria-hidden="true" />
					<span className="truncate">{source}</span>
					{visibleYearLabel ? <span className="hidden sm:inline">· {visibleYearLabel}</span> : null}
					{visibleRunId ? <span className="hidden sm:inline">· Run #{visibleRunId}</span> : null}
				</Badge>

				{publishBlocked ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className={cn(
							'h-5 shrink min-w-0 gap-1 truncate rounded-full px-1.5 text-[0.65rem] font-semibold sm:shrink-0 sm:gap-1.5 sm:px-2 sm:text-xs sm:h-6',
							'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20',
						)}
						data-testid="timetable-simple-readiness-chip"
						onClick={() => setReadinessSheetOpen(true)}
					>
						<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{readiness}</span>
					</Button>
				) : (
					<Badge
						variant={context.hardCount > 0 ? 'destructive' : 'secondary'}
						className="h-5 shrink min-w-0 gap-1 truncate px-1.5 text-[0.65rem] font-semibold sm:shrink-0 sm:gap-1.5 sm:px-2 sm:text-xs sm:h-6"
						data-testid="timetable-simple-readiness-chip"
					>
						<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{readiness}</span>
					</Badge>
				)}
				<Badge
					variant="outline"
					className={cn(
						'h-5 shrink-0 gap-1.5 px-2 text-xs font-semibold sm:h-6 hidden md:inline-flex',
						context.referenceLookupStatus.state === 'ready'
							? 'border-emerald-200 bg-emerald-50 text-emerald-800'
							: context.referenceLookupStatus.state === 'needs-refresh'
								? 'border-amber-200 bg-amber-50 text-amber-900'
								: 'border-border bg-muted text-muted-foreground',
					)}
					data-testid="timetable-lookup-status"
				>
					{context.referenceLookupStatus.label}
				</Badge>

				<div className="hidden min-w-[240px] shrink-0 flex-1 lg:flex">
					<SimpleScheduleControls
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
				</div>

				<div className="absolute right-3 top-0.5 z-10 flex min-w-0 shrink items-center gap-1.5 overflow-hidden">
					<SimpleScheduleSheet
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
					<SimpleTutorialControl open={tutorialOpen} onOpenChange={setTutorialOpen} />
					{(() => {
						const mobileLabel = !hasGeneratedRun && !context.isPreGenerationWorkspace
							? 'Generate'
							: context.generating
								? 'Generating…'
								: isRunPublished
									? 'Published'
									: publishBlocked
										? 'Fix blockers'
										: (context.summary?.unassignedCount ?? 0) > 0
											? 'Review warnings'
											: hasGeneratedRun
												? 'Publish'
												: 'Generate';
						const mobileDisabled = context.generating || context.loading || !context.schoolYearId
							|| (publishBlocked && mobileLabel !== 'Fix blockers')
							|| (isRunPublished && mobileLabel === 'Published');
						const mobileIcon = context.generating
							? Loader2
							: isRunPublished
								? CheckCircle2
								: publishBlocked
									? AlertTriangle
									: hasGeneratedRun
										? Send
										: Play;
						const MobileIcon = mobileIcon;
						return (
							<TooltipProvider delayDuration={300}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant={isRunPublished ? 'outline' : publishBlocked ? 'outline' : 'default'}
											size="sm"
											className={cn(
												'h-8 shrink gap-1.5 px-2 text-xs sm:hidden sm:px-2.5',
												isRunPublished && 'border-emerald-200 bg-emerald-50 text-emerald-800',
												!isRunPublished && !publishBlocked && 'bg-emerald-600 text-white hover:bg-emerald-700',
											)}
											disabled={mobileDisabled}
											onClick={() => {
												if (!hasGeneratedRun && !context.isPreGenerationWorkspace) {
													context.handleTriggerGenerate();
												} else if (publishBlocked) {
													setReadinessSheetOpen(true);
												} else if (hasGeneratedRun && !isRunPublished) {
													handlePublishClick();
												}
											}}
											data-testid="timetable-simple-mobile-lifecycle-action"
										>
											<MobileIcon className={cn('size-3.5', context.generating && 'animate-spin')} aria-hidden="true" />
											<span className="hidden min-[420px]:inline">{mobileLabel}</span>
										</Button>
									</TooltipTrigger>
									{publishBlocked && (
										<TooltipContent side="bottom" className="max-w-xs">
											<p>{publishBlockedReason}</p>
											<p className="mt-1 text-xs opacity-80">Tap to review and fix issues.</p>
										</TooltipContent>
									)}
									{isRunPublished && (context.summary?.unassignedCount ?? 0) > 0 && (
										<TooltipContent side="bottom" className="max-w-xs">
											<p>This schedule is published.</p>
											<p className="mt-1 text-xs opacity-80">{context.summary?.unassignedCount} follow-up item{(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} still need review.</p>
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						);
					})()}
					<Button
						type="button"
						variant="default"
						size="sm"
						className="hidden h-8 shrink-0 gap-1.5 px-2 text-xs sm:inline-flex sm:px-2.5"
						disabled={context.generating || context.loading || !context.schoolYearId}
						onClick={context.handleTriggerGenerate}
						data-testid="timetable-simple-generate-action"
					>
						{context.generating ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
						<span className="hidden sm:inline">{context.generating ? 'Generating…' : 'Generate'}</span>
						<span className="sr-only sm:hidden">{context.generating ? 'Generating' : 'Generate schedule'}</span>
					</Button>

					{hasGeneratedRun && (
						<TooltipProvider delayDuration={300}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant={isRunPublished ? 'outline' : publishBlocked ? 'outline' : 'default'}
										size="sm"
										className={cn(
											'hidden h-8 shrink-0 gap-1.5 px-2 text-xs sm:inline-flex sm:px-2.5',
											isRunPublished && 'border-emerald-200 bg-emerald-50 text-emerald-800',
											!isRunPublished && !publishBlocked && 'bg-emerald-600 text-white hover:bg-emerald-700',
										)}
										disabled={publishBlocked}
										onClick={handlePublishClick}
										data-testid="timetable-simple-publish-action"
									>
										{isRunPublished ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
										<span className="hidden sm:inline">{isRunPublished ? 'Published' : 'Publish'}</span>
										<span className="sr-only sm:hidden">{isRunPublished ? 'Published schedule' : 'Publish schedule'}</span>
									</Button>
								</TooltipTrigger>
								{publishBlocked && (
									<TooltipContent side="bottom" className="max-w-xs" data-testid="timetable-publish-blocked-reason">
										<p>{publishBlockedReason}</p>
										<p className="mt-1 text-xs opacity-80">Click to review and fix issues.</p>
									</TooltipContent>
								)}
								{isRunPublished && (
									<TooltipContent side="bottom" className="max-w-xs">
										<p>This schedule is published.</p>
										{(context.summary?.unassignedCount ?? 0) > 0 && (
											<p className="mt-1 text-xs opacity-80">{context.summary?.unassignedCount} follow-up item{(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} still need review.</p>
										)}
									</TooltipContent>
								)}
							</Tooltip>
						</TooltipProvider>
					)}

					<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 shrink gap-1 px-1.5 text-xs sm:gap-1.5 sm:px-2.5"
								aria-label="More"
								data-testid="timetable-simple-more-trigger"
							>
								<MoreHorizontal className="size-3.5" aria-hidden="true" />
								<span className="hidden sm:inline">More</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="max-h-[min(82svh,32rem)] w-80 overflow-y-auto p-2">
							<div className="space-y-2">
								<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2" data-testid="timetable-simple-more-daily-tasks">
									<DropdownMenuLabel className="px-0 py-0 text-xs">Daily tasks</DropdownMenuLabel>
									<DropdownMenuItem className="h-9 gap-2 text-xs" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('place-unresolved'); }}>
										<ClipboardCheck className="size-3.5" aria-hidden="true" />
										Place unresolved sessions
									</DropdownMenuItem>
									<DropdownMenuItem className="h-9 gap-2 text-xs" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('swap-sessions'); }}>
										<ArrowRightLeft className="size-3.5" aria-hidden="true" />
										Swap sessions
									</DropdownMenuItem>
									<DropdownMenuItem className="h-9 gap-2 text-xs" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('plan-draft'); }}>
										<CalendarClock className="size-3.5" aria-hidden="true" />
										Plan draft
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										onSelect={(event) => { event.preventDefault(); openTeacherDeparture(); }}
										data-testid="teacher-departure-trigger"
									>
										<UserRoundX className="size-3.5" aria-hidden="true" />
										Teacher leaving / Reassign load
									</DropdownMenuItem>
								</div>
								<div className="space-y-1 rounded-md border border-border bg-muted/20 p-2">
									<DropdownMenuLabel className="px-0 py-0 text-xs">Help</DropdownMenuLabel>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										onSelect={(event) => { event.preventDefault(); setMoreOpen(false); setTutorialOpen(true); }}
									>
										<BookOpen className="size-3.5" aria-hidden="true" />
										Tutorial
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										onSelect={(event) => { event.preventDefault(); setMoreOpen(false); setStatusKeyOpen(true); }}
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
									<DropdownMenuItem className="h-9 gap-2 text-xs" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('review-issues'); }}>
										<ListChecks className="size-3.5" aria-hidden="true" />
										Review issues
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										disabled={context.generating || context.loading || !context.schoolYearId}
										onSelect={(event) => { event.preventDefault(); setMoreOpen(false); context.handleTriggerGenerate(); }}
									>
										<Play className="size-3.5" aria-hidden="true" />
										Generate schedule
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										disabled={context.editHistoryCount === 0}
										onSelect={(event) => { event.preventDefault(); setMoreOpen(false); context.setShowEditHistory(true); }}
									>
										<History className="size-3.5" aria-hidden="true" />
										Edit history
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										onSelect={(event) => { event.preventDefault(); setMoreOpen(false); onLayoutModeChange('advanced'); }}
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
											onSelect={(event) => { event.preventDefault(); setMoreOpen(false); setFiltersOpen(true); }}
										>
											<SlidersHorizontal className="size-3.5" aria-hidden="true" />
											Filters
										</DropdownMenuItem>
										<Button type="button" variant="outline" size="sm" className="h-9 justify-start gap-1.5 text-xs" onClick={() => { setMoreOpen(false); context.handleRefresh(); }}>
											<RefreshCw className="size-3.5" aria-hidden="true" />
											Refresh timetable
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-9 justify-start gap-1.5 text-xs"
											onClick={() => { setMoreOpen(false); context.refreshReferenceLabels(); }}
											data-testid="timetable-refresh-setup-names"
										>
											<RefreshCw className="size-3.5" aria-hidden="true" />
											Refresh names
										</Button>
										{hasGeneratedRun && (
											<DropdownMenuItem
												className="h-9 gap-2 text-xs"
												data-testid="timetable-simple-export-workbook"
												onSelect={(event) => {
													event.preventDefault();
													setMoreOpen(false);
													void handleExportWorkbook();
												}}
											>
												<Download className="size-3.5" aria-hidden="true" />
												Export workbook
											</DropdownMenuItem>
										)}
										{hasGeneratedRun && context.viewMode === 'faculty' && context.entityFilter && (
											<DropdownMenuItem
												className="h-9 gap-2 text-xs"
												data-testid="timetable-simple-export-teacher-program"
												disabled={teacherProgramExporting}
												onSelect={(event) => {
													event.preventDefault();
													setMoreOpen(false);
													void handleExportTeacherProgram();
												}}
											>
												{teacherProgramExporting ? (
													<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
												) : (
													<Download className="size-3.5" aria-hidden="true" />
												)}
												Export teacher program
											</DropdownMenuItem>
										)}
									</div>
								</div>
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{teacherProgramExportError && (
				<div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border-t border-red-200" data-testid="timetable-teacher-program-export-error">
					<AlertTriangle className="size-3.5 text-red-600 shrink-0" aria-hidden="true" />
					<span className="text-xs text-red-700">{teacherProgramExportError}</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-5 px-1 text-xs text-red-600 hover:text-red-800"
						onClick={() => setTeacherProgramExportError(null)}
					>
						Dismiss
					</Button>
				</div>
			)}

			{/* Secondary row: hidden-row status controls (only when applicable) */}
			{(context.policyAlignmentWarning || context.hiddenRowCount > 0) && (
				<div className="flex items-center gap-1.5 px-3 py-0.5" data-testid="timetable-hidden-row-controls">
					{context.policyAlignmentWarning && (
						<TooltipProvider delayDuration={300}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										tabIndex={0}
										role="status"
										aria-label={`${context.hiddenRowCount} earlier row${context.hiddenRowCount === 1 ? '' : 's'} hidden`}
										className="h-5 shrink-0 cursor-default gap-1 border-amber-200 bg-amber-50 px-1.5 text-xs text-amber-800 sm:h-6"
										data-testid="timetable-hidden-rows-chip"
										onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
									>
										{context.hiddenRowCount} earlier row{context.hiddenRowCount === 1 ? '' : 's'} hidden
									</Badge>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-xs" data-testid="timetable-hidden-rows-explanation">
									<p>{context.policyAlignmentWarning}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{context.hiddenRowCount > 0 && (
						<Button
							type="button"
							variant={context.showFullDay ? 'default' : 'outline'}
							size="sm"
							className="h-5 shrink-0 gap-1 px-1.5 text-xs sm:h-6"
							onClick={() => context.setShowFullDay(!context.showFullDay)}
							data-testid="timetable-show-full-day-toggle"
						>
							<Sun className="size-3" aria-hidden="true" />
							<span className="hidden sm:inline">{context.showFullDay ? 'Full day' : 'Show full day'}</span>
						</Button>
					)}
				</div>
			)}

			<Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Simple filters</DialogTitle>
						<DialogDescription>
							Filter what appears on the grid without opening Advanced view.
						</DialogDescription>
					</DialogHeader>
					<SimpleFiltersContent context={context} />
					<DialogFooter>
						<Button type="button" onClick={() => setFiltersOpen(false)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={statusKeyOpen} onOpenChange={setStatusKeyOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Status key</DialogTitle>
						<DialogDescription>
							Plain-language meanings for grid labels.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1">
						<p className="text-sm font-semibold text-foreground">What the grid labels mean</p>
						<p className="text-xs leading-relaxed text-muted-foreground">The words stay meaningful even when colors are hard to distinguish.</p>
					</div>
					<div className="mt-3 grid gap-2" role="list" aria-label="Timetable status definitions">
						{[
							{ label: 'Can place', description: 'This is an empty slot where the selected session can be placed.', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
							{ label: 'Can swap', description: 'The slot already has a session and can be reviewed as a possible switch.', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
							{ label: 'Blocked', description: 'A hard conflict prevents this action. Fix the issue before saving.', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
							{ label: 'Warning', description: 'The action is possible, but review the softer concern before saving.', tone: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
							{ label: 'Occupied', description: 'This slot already has one or more scheduled sessions.', tone: 'border-slate-200 bg-slate-50 text-slate-800' },
							{ label: 'Current', description: "This is the selected session's current slot or current value.", tone: 'border-blue-200 bg-blue-50 text-blue-800' },
						].map((item) => (
							<div key={item.label} className="flex items-start gap-2" role="listitem">
								<Badge variant="outline" className={cn('mt-0.5 h-6 shrink-0 px-1.5 text-[0.68rem] font-semibold', item.tone)}>
									{item.label}
								</Badge>
								<p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
							</div>
						))}
					</div>
					<DialogFooter>
						<Button type="button" onClick={() => setStatusKeyOpen(false)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{!hasGeneratedRun && !context.isPreGenerationWorkspace ? (
				<div
					className="mx-3 mb-0 flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2 py-0 shadow-sm sm:px-3"
					data-testid="timetable-simple-task-prompt"
					role="status"
					aria-live="polite"
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border sm:size-6">
							<CalendarClock className="size-4 sm:size-4.5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="hidden text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground sm:block">Get started</p>
							<p className="truncate text-sm font-semibold text-foreground" data-testid="timetable-simple-next-action">
								No timetable yet — start with a draft or generate directly
							</p>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-10 gap-1.5 px-3 text-xs sm:text-sm"
							disabled={context.newDraftLoading || !context.schoolYearId}
							onClick={() => void startTask('plan-draft')}
							data-testid="timetable-empty-start-draft-action"
						>
							<CalendarClock className="size-3.5" aria-hidden="true" />
							<span className="hidden sm:inline">Start Pre-Generation Draft</span>
							<span className="sm:hidden">Draft</span>
						</Button>
						<Button
							type="button"
							size="sm"
							className="h-10 gap-1.5 px-3 text-xs sm:text-sm"
							disabled={context.generating || context.loading || !context.schoolYearId}
							onClick={context.handleTriggerGenerate}
							data-testid="timetable-empty-generate-action"
						>
							{context.generating ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
							<span className="hidden sm:inline">Generate when ready</span>
							<span className="sm:hidden">Generate</span>
						</Button>
					</div>
				</div>
			) : (
				<div
					className="mx-3 mb-0 flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2 py-0 shadow-sm sm:px-3"
					data-testid="timetable-simple-task-prompt"
					role="status"
					aria-live="polite"
				>
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-primary ring-1 ring-border sm:size-6">
							<ActiveIcon className="size-4 sm:size-4.5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="hidden text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground sm:block">Next step</p>
							<p className="truncate text-sm font-semibold text-foreground" data-testid="timetable-simple-next-action">
								{activeTask ? activeTaskDefinition.label : recommendedTask.label}
							</p>
							<p className="hidden text-xs text-muted-foreground sm:block">{activeTaskDefinition.helper}</p>
						</div>
					</div>

					{publishBlocked && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden min-w-0 items-center gap-1.5 border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 sm:flex"
							data-testid="timetable-publish-readiness-summary"
							onClick={() => setReadinessSheetOpen(true)}
						>
							<span className="truncate">{publishBlockedReason}</span>
							<ChevronRight className="size-3 shrink-0" aria-hidden="true" />
						</Button>
					)}
					{isRunPublished && !publishBlocked && (context.summary?.unassignedCount ?? 0) > 0 && (
						<div
							className="hidden min-w-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 sm:flex"
							data-testid="timetable-publish-readiness-summary"
						>
							<CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
							<span className="truncate">Published — {context.summary?.unassignedCount} follow-up item{(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} remain</span>
						</div>
					)}

					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
					{activeTaskDefinition.href ? (
						<Button
							asChild
							size="sm"
							className="h-10 min-w-28 gap-1.5 px-3 text-xs sm:text-sm"
							disabled={activeTaskDefinition.disabled}
							data-testid="timetable-simple-primary-action"
						>
							<Link to={activeTaskDefinition.href}>
								{activeTaskDefinition.primaryLabel}
								<ChevronDown className="size-3.5" aria-hidden="true" />
							</Link>
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							className="h-10 min-w-28 gap-1.5 px-3 text-xs sm:text-sm"
							disabled={activeTaskDefinition.disabled}
							onClick={() => void startTask(activeTaskDefinition.id)}
							data-testid="timetable-simple-primary-action"
						>
							{activeTaskDefinition.primaryLabel}
							<ChevronDown className="size-3.5" aria-hidden="true" />
						</Button>
					)}
				</div>
			</div>
			)}

			<SimplePublishReadinessSheet
				open={readinessSheetOpen}
				onOpenChange={setReadinessSheetOpen}
				draft={context.draft}
				violations={context.violations}
				sectionLabel={context.sectionLabel}
				subjectLabel={context.subjectLabel}
				facultyLabel={context.facultyLabel}
				onNavigateToRepair={(href, reason) => {
					setReadinessSheetOpen(false);
					const plainReason = reason === 'NO_AVAILABLE_SLOT' ? 'No available slot'
						: reason === 'FACULTY_OVERLOADED' ? 'Teachers are overloaded'
						: reason === 'NO_QUALIFIED_FACULTY' ? 'No qualified teacher'
						: reason === 'NO_COMPATIBLE_ROOM' ? 'No compatible room'
						: reason === 'ROOM_CAPACITY_EXCEEDED' ? 'Room capacity exceeded'
						: 'Unknown issue';
					onSetRepairOrigin?.({ reason: reason ?? 'UNKNOWN', plainReason, groupCount: 0 });
					if (reason === 'FACULTY_OVERLOADED' || reason === 'NO_QUALIFIED_FACULTY') {
						navigate('/teaching-load');
					} else if (reason === 'NO_AVAILABLE_SLOT') {
						context.setUnassignedReasonFilter('NO_AVAILABLE_SLOT');
						setBlockerReasonFilter('NO_AVAILABLE_SLOT');
						context.setLeftTab('unassigned');
						context.setPresentationMode('workflow');
						onTaskChange('place-unresolved');
					} else if (reason === 'NO_COMPATIBLE_ROOM' || reason === 'ROOM_CAPACITY_EXCEEDED') {
						navigate('/campus-rooms');
					}
				}}
			/>
		</header>
	);
}

export const TimetableSimpleHeader = memo(TimetableSimpleHeaderImpl);
