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
	HelpCircle,
	History,
	Info,
	ListChecks,
	Loader2,
	MoreHorizontal,
	Play,
	GraduationCap,
	RefreshCw,
	Settings2,
	SlidersHorizontal,
	Sun,
	UserRoundX,
	type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { deriveTimetableCapabilities, describeSetupState, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness } from '@/lib/timetable-generation-readiness';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { TimetableLayoutMode, TimetableSimpleTask } from '@/components/timetable/TimetableSimpleTypes';
import type { RepairOrigin } from '@/components/timetable/TimetableTaskDrawer';
import { TimetableStatusLegend } from '@/components/timetable/TimetableStatusLegend';
import { SimplePublishReadinessSheet } from '@/components/timetable/SimplePublishReadinessSheet';
import { UnassignedInsertionWorkflow } from '@/components/timetable/UnassignedInsertionWorkflow';
import {
	chooseRecommendedTask,
	hasPivotValue,
	firstPivotValue,
	readinessLabel,
	SimpleFiltersContent,
	SimpleScheduleControls,
	SimpleScheduleSheet,
	SimpleTutorialControl,
	sourceLabel,
	useSimpleTasks,
} from '@/components/timetable/simple/SimpleHeaderHelpers';
import type { SimpleViewMode } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { SimpleExportErrorBanner, SimpleExportMenu, SimpleTermSwitcher } from '@/components/timetable/simple/SimpleBeneficiaryControls';
import { dispatchSimpleExport, resolveSimpleExportRequest, type SimpleExportKind } from '@/components/timetable/simple/simpleExportRequests';

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
	swapClassTimesMode?: 'select-first' | 'select-second' | null;
	onSwapClassTimesStart?: () => void;
	onSwapClassTimesCancel?: () => void;
};

function TimetableSimpleHeaderImpl({
	context,
	onLayoutModeChange,
	activeTask,
	onTaskChange,
	onOpenTeacherDeparture,
	onSetRepairOrigin,
	readinessSheetOpen: readinessSheetOpenProp,
	onReadinessSheetOpenChange,
	swapClassTimesMode,
	onSwapClassTimesStart,
	onSwapClassTimesCancel,
}: TimetableSimpleHeaderProps) {
	const navigate = useNavigate();
	const [moreOpen, setMoreOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [statusKeyOpen, setStatusKeyOpen] = useState(false);
	const [tutorialOpen, setTutorialOpen] = useState(false);
	const [readinessSheetOpenLocal, setReadinessSheetOpenLocal] = useState(false);
	const [exportingKind, setExportingKind] = useState<SimpleExportKind | null>(null);
	const [exportError, setExportError] = useState<{ kind: SimpleExportKind; message: string } | null>(null);
	const readinessSheetOpen = readinessSheetOpenProp ?? readinessSheetOpenLocal;
	const setReadinessSheetOpen = onReadinessSheetOpenChange ?? setReadinessSheetOpenLocal;
	const [blockerReasonFilter, setBlockerReasonFilter] = useState<string | null>(null);
const [insertionOpen, setInsertionOpen] = useState(false);
	const [lastEntityByMode, setLastEntityByMode] = useState<Partial<Record<SimpleViewMode, string>>>({});
	const tasks = useSimpleTasks(context);
	const recommendedTask = chooseRecommendedTask(tasks, context);
	const visibleRunId = context.draft?.runId ?? null;
	const visibleYearLabel = context.schoolYearContext?.activeSchoolYearLabel ?? (context.schoolYearId ? `SY #${context.schoolYearId}` : null);
	const source = sourceLabel(context);
	const readiness = readinessLabel(context);
	const setupState = describeSetupState(context.curriculumReadiness);
	const scopeResolved = Number.isInteger(context.schoolId) && context.schoolId > 0
		&& Number.isInteger(context.schoolYearId) && (context.schoolYearId ?? 0) > 0;

	// A failed or invalidated run is history, not a timetable that can be reviewed or published.
	const hasGeneratedRun = Boolean(context.draft);
	// Run-scoped daily tools are only meaningful once a schedule or draft exists.
	const runToolsAvailable = hasGeneratedRun || context.isPreGenerationWorkspace;
	// Newest run failed while nothing reviewable exists: name it explicitly so
	// operators do not read this as "nothing ever happened".
	const latestRunFailed = !hasGeneratedRun && (context.runs?.[0]?.status === 'FAILED');
	const draftSummaryRaw = context.draft?.summary as unknown as Record<string, unknown> | null;
	const isRunPublished = draftSummaryRaw?.isPublished === true;

	// One shared capability and generation decision for Simple and Advanced.
	const capabilities = deriveTimetableCapabilities({
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		generating: context.generating,
		isPreGeneration: context.isPreGenerationWorkspace,
		hasGeneratedRun,
		isPublished: isRunPublished,
		latestRunFailed,
		hardCount: context.hardCount,
		unassignedCount: context.summary?.unassignedCount ?? 0,
		softCount: context.softCount,
		hasSelectedEntry: context.hasSelectedEntry,
		requestPendingCount: context.requestPendingCount,
		generationDiagnostic: summarizeGenerationReadiness(context.curriculumReadiness),
		readinessRepair: context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.repair : null,
	});
	const generationGate = capabilities.generation;
	const generationReady = generationGate.enabled;
	const setupRepair = generationGate.repair.kind === 'navigate' ? generationGate.repair : setupState.repair;
	const canPlanOrGenerate = scopeResolved && generationReady && !context.loading;
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
		if (currentEntityIsValid || context.sectionFocusId != null) return;
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

	const publishBlocked = hasGeneratedRun && !isRunPublished && (context.hardCount > 0 || (context.summary?.unassignedCount ?? 0) > 0);
	const publishBlockedReason = context.hardCount > 0
		? `${context.hardCount} hard blocker${context.hardCount === 1 ? '' : 's'} must be fixed before publish.`
		: (context.summary?.unassignedCount ?? 0) > 0
			? `${context.summary?.unassignedCount} session${(context.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} still need fixing before publish.`
			: '';
	const lifecycleAction = deriveSimpleLifecycleAction({
		hasGeneratedRun,
		isPreGeneration: context.isPreGenerationWorkspace,
		generating: context.generating,
		hardCount: context.hardCount,
		unassignedCount: context.summary?.unassignedCount ?? 0,
		softCount: context.softCount,
		isPublished: isRunPublished,
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		latestRunFailed,
	});

	const handlePublishClick = () => {
		if (isRunPublished) return;
		if (context.hardCount > 0 || (context.summary?.unassignedCount ?? 0) > 0) {
			setReadinessSheetOpen(true);
			return;
		}
		context.setPublishAcknowledged(false);
		context.setShowPublishDialog(true);
	};

	const handleLifecycleAction = () => {
		switch (lifecycleAction.kind) {
			case 'resolve-scope': break;
			case 'fix-setup': navigate(YEAR_SETUP_HREF); break;
			case 'start-draft': void startTask('plan-draft'); break;
			case 'generate':
				if (generationReady) context.handleTriggerGenerate();
				break;
			case 'retry-generate': context.handleTriggerGenerate(); break;
			case 'retry-readiness': context.handleRefresh(); break;
			case 'fix-blockers': setReadinessSheetOpen(true); break;
			case 'review-warnings': void startTask('review-issues'); break;
			case 'publish': handlePublishClick(); break;
			case 'review-follow-ups': void startTask('place-unresolved'); break;
			case 'generating':
			case 'published': break;
		}
	};

	// Official beneficiary downloads are bound to exactly one selected ordered
	// term. "All terms" resolves to no request so nothing mixed-term is exported.
	const exportRunId = context.draft?.runId ?? context.activeGeneratedRunId ?? null;
	const exportFacultyId = context.viewMode === 'faculty' && context.entityFilter ? Number(context.entityFilter) : null;
	const summaryExport = resolveSimpleExportRequest('summary-teacher-schedule', {
		schoolId: context.schoolId,
		schoolYearId: context.schoolYearId,
		runId: exportRunId,
		termFilter: context.termFilter,
	});
	const classProgramExport = resolveSimpleExportRequest('class-program', {
		schoolId: context.schoolId,
		schoolYearId: context.schoolYearId,
		runId: exportRunId,
		termFilter: context.termFilter,
	});
	const teacherProgramExport = resolveSimpleExportRequest('teacher-program', {
		schoolId: context.schoolId,
		schoolYearId: context.schoolYearId,
		runId: exportRunId,
		termFilter: context.termFilter,
		facultyId: exportFacultyId,
	});

	const handleSimpleExport = async (kind: SimpleExportKind) => {
		// Prevent duplicate concurrent downloads: one official export at a time.
		if (exportingKind !== null) return;
		const descriptor = kind === 'summary-teacher-schedule'
			? summaryExport
			: kind === 'class-program'
				? classProgramExport
				: teacherProgramExport;
		if (!descriptor) return;
		setExportError(null);
		setExportingKind(kind);
		try {
			await dispatchSimpleExport(descriptor);
		} catch (err) {
			// Every beneficiary download surfaces its own visible, retryable error.
			setExportError({ kind, message: err instanceof Error && err.message ? err.message : 'Export failed' });
		} finally {
			setExportingKind(null);
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
			onSwapClassTimesStart?.();
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
			// Unresolved sessions block publish exactly like hard blockers: route
			// to the single readiness summary instead of opening publish.
			if ((context.summary?.unassignedCount ?? 0) > 0) {
				setReadinessSheetOpen(true);
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
			{/* Keep source, readiness, schedule choice, and actions in one non-overlapping row. */}
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-hidden px-3 py-1.5 lg:flex-nowrap [&>*]:min-w-0">
				<Badge
					variant="outline"
					className={cn(
						'h-6 min-w-0 max-w-[28vw] shrink gap-1.5 truncate px-2 text-[0.68rem] font-semibold sm:max-w-[30rem] sm:text-xs',
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
					<Badge
						variant="outline"
						className={cn(
							'h-10 min-w-0 shrink gap-1.5 truncate rounded-full px-3 text-sm font-semibold',
							'border-destructive/30 bg-destructive/10 text-destructive',
						)}
						data-testid="timetable-simple-readiness-chip"
					>
						<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{readiness}</span>
					</Badge>
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
							'h-6 shrink-0 gap-1.5 px-2 text-xs font-semibold hidden 2xl:inline-flex',
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

				<div className="hidden min-w-0 flex-1 lg:flex">
					<SimpleScheduleControls
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
				</div>

				<div className="order-last flex w-full min-w-0 shrink-0 items-center justify-start gap-1.5 overflow-x-auto lg:order-none lg:ml-auto lg:w-auto lg:max-w-[48vw] lg:justify-end">
					<SimpleTermSwitcher context={context} />
					<SimpleScheduleSheet
						context={context}
						lastEntityByMode={lastEntityByMode}
						onViewModeChange={handleViewModeChange}
						onEntityChange={handleEntityChange}
					/>
					<SimpleTutorialControl open={tutorialOpen} onOpenChange={setTutorialOpen} lifecycle={capabilities.lifecycle} />
					{hasGeneratedRun ? (
						<SimpleExportMenu
							summary={summaryExport}
							classProgram={classProgramExport}
							teacherProgram={teacherProgramExport}
							showTeacherProgram={context.viewMode === 'faculty' && Boolean(context.entityFilter)}
							needsTerm={context.termFilter === 'all'}
							exportingKind={exportingKind}
							onExport={(kind) => { void handleSimpleExport(kind); }}
						/>
					) : null}

					<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 min-h-11 min-w-11 shrink gap-1 px-1.5 text-xs sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-2.5"
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
									<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-place-unresolved" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('place-unresolved'); }}>
										<ClipboardCheck className="size-3.5" aria-hidden="true" />
										Place unresolved sessions
										{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
									</DropdownMenuItem>
									<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-swap-sessions" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('swap-sessions'); }}>
										<ArrowRightLeft className="size-3.5" aria-hidden="true" />
										Swap sessions
										{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
									</DropdownMenuItem>
									<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!canPlanOrGenerate} onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('plan-draft'); }}>
										<CalendarClock className="size-3.5" aria-hidden="true" />
										Plan draft
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										disabled={!runToolsAvailable}
										onSelect={(event) => { event.preventDefault(); openTeacherDeparture(); }}
										data-testid="teacher-departure-trigger"
									>
										<UserRoundX className="size-3.5" aria-hidden="true" />
										Teacher leaving / Reassign load
										{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
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
									<DropdownMenuItem className="h-9 gap-2 text-xs" disabled={!runToolsAvailable} data-testid="timetable-more-review-issues" onSelect={(event) => { event.preventDefault(); setMoreOpen(false); void startTask('review-issues'); }}>
										<ListChecks className="size-3.5" aria-hidden="true" />
										Review issues
										{!runToolsAvailable && <span className="sr-only"> Unavailable: no generated run yet.</span>}
									</DropdownMenuItem>
									<DropdownMenuItem
										className="h-9 gap-2 text-xs"
										disabled={!canPlanOrGenerate}
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
									</div>
								</div>
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<SimpleExportErrorBanner
				error={exportError}
				onRetry={(kind) => { void handleSimpleExport(kind); }}
				onDismiss={() => setExportError(null)}
			/>

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

			{context.schoolYearId ? (
				<UnassignedInsertionWorkflow
					open={insertionOpen}
					onOpenChange={setInsertionOpen}
					schoolId={context.schoolId}
					schoolYearId={context.schoolYearId}
				/>
			) : null}

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
								No timetable exists for {visibleYearLabel ?? 'the active school year'}
							</p>
							<p className="break-words text-xs text-muted-foreground" data-testid="timetable-curriculum-readiness-message">
								{setupState.message}
							</p>
							{setupRepair.kind === 'navigate' && (
								<p className="text-xs text-muted-foreground" data-testid="timetable-setup-repair-hint">
									{setupRepair.label ? `Fix this in ${setupRepair.label}.` : 'Finish setup before generating.'}
								</p>
							)}
							{latestRunFailed && (
								<p className="break-words text-xs font-medium text-red-700" data-testid="timetable-last-generation-failed-message">
									The last generation run failed. Review setup, then try generating again.
								</p>
							)}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
						<TimetableStatusLegend compact />
						{lifecycleAction.kind === 'fix-setup' && setupRepair.kind === 'navigate' ? (
							<Button asChild type="button" size="sm" className="h-11 gap-1.5 px-3 text-sm" data-testid="timetable-simple-primary-action">
								<Link to={setupRepair.href ?? YEAR_SETUP_HREF}>
									<BookOpen className="size-3.5" aria-hidden="true" />
									{setupRepair.label ?? lifecycleAction.label}
								</Link>
							</Button>
						) : (
							<Button
								type="button"
								size="sm"
								className="h-11 gap-1.5 px-3 text-sm"
								disabled={lifecycleAction.disabled}
								onClick={handleLifecycleAction}
								data-testid="timetable-simple-primary-action"
							>
								{lifecycleAction.kind === 'generating' || (lifecycleAction.kind === 'retry-readiness' && lifecycleAction.disabled)
									? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
									: lifecycleAction.kind === 'retry-generate' || lifecycleAction.kind === 'retry-readiness'
										? <RefreshCw className="size-3.5" aria-hidden="true" />
										: <CalendarClock className="size-3.5" aria-hidden="true" />}
								<span>{lifecycleAction.label}</span>
							</Button>
						)}
						{generationReady && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-11 gap-1.5 px-3 text-sm"
								disabled={!canPlanOrGenerate}
								onClick={() => setInsertionOpen(true)}
								data-testid="timetable-unassigned-insertion-action"
							>
								<CalendarClock className="size-3.5" aria-hidden="true" />
								<span>Preview demand</span>
							</Button>
						)}
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
								{activeTask ? activeTaskDefinition.label : lifecycleAction.label}
							</p>
							<p className="hidden text-sm text-muted-foreground sm:block">{activeTask ? activeTaskDefinition.helper : readiness}</p>
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
					<TimetableStatusLegend compact />
					{activeTask && activeTaskDefinition.href ? (
						<Button
							asChild
							size="sm"
							className="h-11 min-w-28 gap-1.5 px-3 text-sm"
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
							className="h-11 min-w-28 gap-1.5 px-3 text-sm"
							disabled={activeTask ? activeTaskDefinition.disabled : lifecycleAction.disabled}
							onClick={() => activeTask ? void startTask(activeTaskDefinition.id) : handleLifecycleAction()}
							data-testid="timetable-simple-primary-action"
						>
							{activeTask ? activeTaskDefinition.primaryLabel : lifecycleAction.label}
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
			{swapClassTimesMode != null ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="timetable-swap-class-times-banner"
					className="border-b border-blue-200 bg-blue-50/80 px-3 py-2 text-sm"
				>
					<div className="flex items-center justify-between gap-2">
						<p className="min-w-0 truncate">
							{swapClassTimesMode === 'select-first' ? (
								<span className="text-blue-900"><span className="font-bold">Swap class times:</span> choose Class A on the grid.</span>
							) : (
								<span className="text-blue-900"><span className="font-bold">Swap class times:</span> Class A selected. Choose Class B on the grid.</span>
							)}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-11 shrink-0 gap-1.5 px-3 text-sm"
							data-testid="timetable-swap-class-times-cancel"
							onClick={() => onSwapClassTimesCancel?.()}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : null}
		</header>
	);
}

export const TimetableSimpleHeader = memo(TimetableSimpleHeaderImpl);
