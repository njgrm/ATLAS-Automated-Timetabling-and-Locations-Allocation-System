import { memo, Profiler, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CalendarClock, ClipboardCheck, ClipboardList, Crosshair, GraduationCap, History, Lightbulb, ListChecks, Loader2, MoreHorizontal, Play, RefreshCw, RotateCw, SearchCheck, Send, Settings2, Undo2, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import type { RolloverStatus } from '@/lib/settings';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { QuickPlaceSummaryModal } from '@/components/timetable/QuickPlaceSummaryModal';
import {
	SetupImpactDialog,
	SyncTimetableConfirmDialog,
} from '@/components/timetable/ScheduleReviewWorkspaceDialogs';
import { FilterChip } from '@/components/timetable/TimetableShared';
import { ScheduleReviewWorkspaceSummaryStats } from '@/components/timetable/ScheduleReviewWorkspaceSummaryStats';
import {
	ScheduleReviewWorkspaceTaskModes,
	type TimetableTaskMode,
} from '@/components/timetable/ScheduleReviewWorkspaceTaskModes';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { EntryKindFilter, ProgramFilter } from '@/lib/schedule-review-helpers';
import { onProfilerRender } from '@/components/timetable/ScheduleReviewWorkspace';
import { isDraftPublishedStrict } from '@/components/timetable/timetableWorkspaceTruth';
import { ScheduleReviewInputStateBanner } from '@/components/timetable/ScheduleReviewInputStateBanner';
import { TimetableAdvancedHeaderHelp } from '@/components/timetable/TimetableAdvancedHeaderHelp';
import { deriveTimetableCapabilities, YEAR_SETUP_HREF } from '@/lib/timetable-capabilities';
import { summarizeGenerationReadiness } from '@/lib/timetable-generation-readiness';
import { createSyncSetupInFlightGuard, runSyncSetup } from '@/lib/timetable-sync-setup';
import { resolveTermAuthorityNotice } from '@/hooks/useTimetableData';

type ScheduleReviewWorkspaceHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
};

function formatTaskCount(count: number, label: string): string {
	if (count > 99) return `99+ ${label}`;
	return `${count} ${label}`;
}

const INPUT_DOMAIN_LABELS: Record<string, string> = {
	teachingLoad: 'Teaching Load',
	policy: 'Policy',
	rooms: 'Rooms',
	sections: 'Sections',
	subjects: 'Subjects',
};

function formatChangedDomains(domains: string[] | undefined): string[] {
	if (!domains || domains.length === 0) return ['Comparison details are unavailable'];
	return domains.map((domain) => INPUT_DOMAIN_LABELS[domain] ?? domain);
}

function ScheduleReviewWorkspaceHeaderImpl({ context }: ScheduleReviewWorkspaceHeaderProps) {
	const [showImpactPreview, setShowImpactPreview] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [showSyncConfirm, setShowSyncConfirm] = useState(false);
	const [showQuickPlaceConfirm, setShowQuickPlaceConfirm] = useState(false);
	const [quickPlacePlaced, setQuickPlacePlaced] = useState<any[]>([]);
	const [quickPlaceUnplaced, setQuickPlaceUnplaced] = useState<any[]>([]);
	const [quickPlaceLoading, setQuickPlaceLoading] = useState(false);
	const [syncResult, setSyncResult] = useState<any | null>(null);
	const [showPostSyncOffer, setShowPostSyncOffer] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const [rolloverStatus, setRolloverStatus] = useState<RolloverStatus | null>(null);
	const syncGuardRef = useRef(createSyncSetupInFlightGuard());

	const {
		isPreGenerationWorkspace,
		activeGeneratedRunId,
		leftTab,
		leftPanelRef,
		presentationMode,
		setPresentationMode,
		selectedRunId,
		handleRunChange,
		runs,
		schoolId,
		centerView,
		newDraftLoading,
		schoolYearId,
		handleStartNewPreGenerationDraft,
		draftPlacementCount,
		openPreGenerationWorkspace,
		returnToGeneratedRun,
		generating,
		loading,
		handleTriggerGenerate,
		draft,
		hardCount,
		blockingHardCount,
		setPublishAcknowledged,
		setShowPublishDialog,
		exitPolicyView,
		switchCenterViewWithGuard,
		enterPolicyView,
		openMapWorkspace,
		handleRefresh,
		revertLoading,
		editHistoryCount,
		revertLastEdit,
		setShowEditHistory,
		tutorial,
		summary,
		requestPendingCount,
		statusColor,
		formatDuration,
		formatTimestamp,
		VIEW_MODE_LABELS,
		viewMode,
		setViewMode,
		setEntityFilter,
		hasSelectedEntry,
		setSelectedEntry,
		setSelectedViolation,
		setPreGenKbSource,
		setKbSelectedSource,
		entityFilter,
		groupedPivotEntities,
		pivotLabel,
		programFilter,
		setProgramFilter,
		PROGRAM_FILTER_OPTIONS,
		entryKindFilter,
		setEntryKindFilter,
		ENTRY_KIND_FILTER_OPTIONS,
		termFilter,
		onTermFilterChange,
		termOptions,
		activeTermIndex,
		violations,
		severityFilter,
		setSeverityFilter,
		setLeftTab,
		softCount,
		WELLBEING_CODES,
		CONFLICT_CODES,
	} = context;

	const handleSyncSetup = async () => {
		if (!schoolYearId || activeGeneratedRunId == null) return;
		setSyncing(true);
		try {
			const outcome = await runSyncSetup({
				schoolId,
				schoolYearId,
				runId: activeGeneratedRunId,
				draftVersion: draft?.version,
				guard: syncGuardRef.current,
			});
			if (outcome.status === 'COMMITTED') {
				const data = outcome.data;
				setSyncResult(data);
				if ((data.displacedEntriesCount ?? 0) > 0 || (data.addedUnassignedCount ?? 0) > 0) {
					setShowPostSyncOffer(true);
				} else {
					const retainedReviewedCount = data.retainedFacultyPinCount ?? 0;
					const retainedCopy = retainedReviewedCount > 0
						? `, retained ${retainedReviewedCount} reviewed teacher assignment(s)`
						: '';
					toast.success(
						`Timetable synced successfully: updated ${data.updatedFacultyCount ?? 0} teacher assignments, ` +
						`displaced ${data.displacedEntriesCount ?? 0} entries, added ${data.addedUnassignedCount ?? 0} unassigned sessions` +
						`${retainedCopy}.`
					);
				}
				handleRefresh();
			} else if (outcome.status === 'REPLAYED') {
				toast.success('Timetable setup already matches the current run. Nothing to change.');
				handleRefresh();
			} else if (outcome.status === 'FAILED') {
				toast.error(outcome.error.message);
			}
			// SKIPPED_IN_FLIGHT: a sync is already running; do nothing.
		} finally {
			setSyncing(false);
			setShowSyncConfirm(false);
		}
	};

	const handleTriggerQuickPlacePreview = async () => {
		if (!schoolYearId || activeGeneratedRunId == null) return;
		setQuickPlaceLoading(true);
		setShowPostSyncOffer(false);
		try {
			const { data } = await atlasApi.post(
				`/generation/${schoolId}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/preview`
			);
			setQuickPlacePlaced(data.placed);
			setQuickPlaceUnplaced(data.unplaced);
			setShowQuickPlaceConfirm(true);
		} catch (err: any) {
			toast.error(err.response?.data?.message || err.message || 'Quick place preview failed.');
		} finally {
			setQuickPlaceLoading(false);
		}
	};

	const handleCommitQuickPlace = async () => {
		if (!schoolYearId || activeGeneratedRunId == null || !draft) return;
		setQuickPlaceLoading(true);
		try {
			const { data } = await atlasApi.post(
				`/generation/${schoolId}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/apply`,
				{ expectedRunVersion: draft.version }
			);
			toast.success(`Successfully placed ${data.placedCount} sessions!`);
			setShowQuickPlaceConfirm(false);
			handleRefresh();
		} catch (err: any) {
			toast.error(err.response?.data?.message || err.message || 'Failed to apply quick placements.');
		} finally {
			setQuickPlaceLoading(false);
		}
	};
	const inputState = draft?.inputState;
	const showInputStateBanner = Boolean(inputState && inputState.status !== 'FRESH' && !isPreGenerationWorkspace);
	const changedDomainLabels = formatChangedDomains(inputState?.changedDomains);
	const runOptions = runs ?? [];
	const visibleViolations = violations ?? [];
	const unassignedCount = summary?.unassignedCount ?? 0;
	const generationBlockedByDrift = rolloverStatus?.drift.status === 'atlas-stale' || rolloverStatus?.drift.status === 'mapping-conflict';

	// R1: Advanced consumes the exact same generation decision as Simple. No
	// separate readiness boolean may gate a generation trigger.
	const scopeResolved = Number.isInteger(schoolId) && schoolId > 0
		&& Number.isInteger(schoolYearId) && (schoolYearId ?? 0) > 0;
	const isRunPublished = isDraftPublishedStrict(draft);
	const latestRunFailed = !draft && runOptions[0]?.status === 'FAILED';
	const capabilities = deriveTimetableCapabilities({
		scopeResolved,
		curriculumState: context.curriculumReadiness?.state ?? 'unavailable',
		generating,
		isPreGeneration: isPreGenerationWorkspace,
		hasGeneratedRun: Boolean(draft),
		isPublished: isRunPublished,
		latestRunFailed,
		// F2 — the publication gate uses the allowlist-filtered blocking count.
		hardCount: blockingHardCount,
		unassignedCount,
		softCount,
		hasSelectedEntry,
		requestPendingCount,
		driftBlocked: generationBlockedByDrift,
		driftMessage: rolloverStatus?.drift.message ?? null,
		generationDiagnostic: summarizeGenerationReadiness(context.curriculumReadiness),
		readinessRepair: context.curriculumReadiness?.state === 'blocked' ? context.curriculumReadiness.repair : null,
	});
	const generationGate = capabilities.generation;
	const generationRepairHref = generationGate.repair.kind === 'navigate' ? generationGate.repair.href : null;
	const generationRepairLabel = generationGate.repair.label ?? 'Fix setup';
	const handleGenerationTrigger = () => {
		if (generationGate.enabled) {
			handleTriggerGenerate();
			return;
		}
		if (generationGate.repair.kind === 'retry') {
			handleRefresh();
		}
	};
	const expandLeftPanelForTask = () => {
		leftPanelRef.current?.expand();
		if (typeof window !== 'undefined' && window.innerWidth < 1024) {
			leftPanelRef.current?.resize(72);
		}
	};
	const openLeftTask = (tab: 'violations' | 'unassigned' | 'requests') => {
		expandLeftPanelForTask();
		setLeftTab(tab);
		setPresentationMode('workflow');
	};
	const openDraftPlannerTask = async () => {
		await handleStartNewPreGenerationDraft();
		setLeftTab('unassigned');
		expandLeftPanelForTask();
		setPresentationMode('workflow');
	};
	const taskModes: TimetableTaskMode[] = [
		{
			id: 'review',
			label: 'Review schedule',
			helper: hardCount > 0 ? 'Start with hard blockers before publishing.' : 'Check the generated timetable and publish when clean.',
			icon: ListChecks,
			active: !isPreGenerationWorkspace && leftTab === 'violations' && !hasSelectedEntry,
			onClick: () => {
				openLeftTask('violations');
			},
			badge: hardCount > 0 ? formatTaskCount(hardCount, 'blocked') : undefined,
		},
		{
			id: 'place',
			label: 'Place unassigned',
			helper: 'Open the queue, choose a session, then choose where it should go.',
			icon: ClipboardCheck,
			active: !isPreGenerationWorkspace && leftTab === 'unassigned',
			onClick: () => {
				openLeftTask('unassigned');
			},
			badge: unassignedCount > 0 ? formatTaskCount(unassignedCount, 'to place') : undefined,
		},
		{
			id: 'switch',
			label: 'Switch sessions',
			helper: hasSelectedEntry ? 'Choose another occupied slot to review the switch.' : 'Select one class on the grid, then choose another class to switch with it.',
			icon: ArrowRightLeft,
			active: !isPreGenerationWorkspace && hasSelectedEntry,
			onClick: () => {
				openLeftTask('violations');
			},
		},
		{
			id: 'plan',
			label: isPreGenerationWorkspace ? 'Planning draft' : 'Draft planner',
			helper: isPreGenerationWorkspace ? 'Use the draft queue and grid before generating a new run.' : 'Open the pre-generation draft queue and place sessions before generating.',
			icon: CalendarClock,
			active: isPreGenerationWorkspace,
			disabled: newDraftLoading || !schoolYearId,
			onClick: () => {
				void openDraftPlannerTask();
			},
			badge: draftPlacementCount > 0 ? formatTaskCount(draftPlacementCount, 'draft') : undefined,
		},
		{
			id: 'requests',
			label: 'Review room requests',
			helper: 'Open teacher room requests and approve, deny, or preview them.',
			icon: ClipboardList,
			active: leftTab === 'requests',
			onClick: () => {
				openLeftTask('requests');
			},
			badge: requestPendingCount > 0 ? formatTaskCount(requestPendingCount, 'request') : undefined,
		},
	];
	const activeTask = taskModes.find((task) => task.active)
		?? (unassignedCount > 0 ? taskModes[1] : requestPendingCount > 0 ? taskModes[4] : taskModes[0]);
	const ActiveTaskIcon = activeTask.icon;
	const sourceContext = context.schoolYearContext;
	const activeTermContext = sourceContext?.activeTerm ?? null;
	const verifiedOrderedTerm = activeTermContext?.verified === true
		&& activeTermContext.termIndex != null
		&& Boolean(activeTermContext.orderedTerms?.some((term) => term.order === activeTermContext.termIndex));
	const activeTermLabel = verifiedOrderedTerm
		? (activeTermContext?.orderedTerms?.find((term) => term.order === activeTermContext.termIndex)?.displayLabel ?? `Term ${activeTermContext?.termIndex}`)
		: null;
	const latestRunCandidate = runOptions[0] ?? null;
	const newerFailedRunNotice = selectedRunId === 'latest'
		&& draft?.runId != null
		&& latestRunCandidate?.id != null
		&& latestRunCandidate.id !== draft.runId
		&& latestRunCandidate.status !== 'COMPLETED'
			? `Grid uses completed run #${draft.runId}; newer run #${latestRunCandidate.id} is ${latestRunCandidate.status ?? 'not completed'}.`
			: null;
	// TIMETABLE-TERM-GATE-C01 (D3) — the explicit-scope fallback is visible: an
	// unverified authority with data on screen means the timetable loaded one
	// explicit term instead of dead-ending. A blocked page (no data) keeps the
	// setup message instead.
	const termAuthorityNotice = resolveTermAuthorityNotice(
		sourceContext,
		context.draft != null || context.runs.length > 0,
	);
	const nextActionLabel = isPreGenerationWorkspace
		? 'Review the draft before generating'
		: blockingHardCount > 0
			? 'Resolve the highlighted blockers'
			: unassignedCount > 0
				? 'Place the sessions needing attention'
				: 'Review the schedule, then publish when ready';
	const selectedDurationMs = draft
		? runOptions.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runOptions[0]?.id))?.durationMs ?? null
		: null;

	return (
		<Profiler id="Header" onRender={onProfilerRender}>
			<div className="shrink-0 border-b border-border bg-background">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground" data-testid="timetable-scheduler-orientation">
				<span><span className="font-semibold text-foreground">Term:</span> {activeTermLabel ?? 'Term setup required'}</span>
				<span><span className="font-semibold text-foreground">Scope:</span> {termFilter === 'all' ? 'All terms' : (termOptions.find((option) => option.value === String(termFilter))?.label ?? 'Selected term')}</span>
				<span><span className="font-semibold text-foreground">Next:</span> {nextActionLabel}</span>
			</div>
			<div className="flex items-center gap-2 overflow-x-auto px-4 pt-2 pb-1.5 [@media(max-height:500px)]:pt-1 [@media(max-height:500px)]:pb-1">
				<Badge
					variant={isPreGenerationWorkspace ? 'secondary' : 'default'}
					className={cn('h-7 shrink-0 px-2.5 text-xs font-semibold uppercase', isPreGenerationWorkspace ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
				>
					{isPreGenerationWorkspace ? 'Planning draft' : activeGeneratedRunId != null ? 'Generated timetable' : 'No generated run yet'}
				</Badge>

				{newerFailedRunNotice && (
					<Badge variant="outline" data-testid="timetable-newer-run-failed" className="h-7 shrink-0 px-2 text-xs font-semibold border-amber-200 bg-amber-50 text-amber-950">
						A newer run failed; showing the last completed schedule.
					</Badge>
				)}

				{termAuthorityNotice && (
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge
									variant="outline"
									data-testid="timetable-term-authority-unverified"
									className={cn('h-7 max-w-[34vw] shrink-0 gap-1.5 px-2 text-xs font-semibold', 'border-amber-200 bg-amber-50 text-amber-950')}
								>
									<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">
										{termAuthorityNotice}
									</span>
								</Badge>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs text-xs" data-testid="timetable-term-authority-unverified-disclosure">
								{termAuthorityNotice}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}

				<div data-tutorial="run-selector" className="shrink-0">
					<Select value={selectedRunId} onValueChange={handleRunChange} disabled={runOptions.length === 0 || centerView === 'pre-generation'}>
						<SelectTrigger className="h-8 w-44 text-xs">
							<SelectValue placeholder={runOptions.length === 0 ? 'No generated run yet' : 'Select run'} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest" disabled={runOptions.length === 0}>Latest Run</SelectItem>
							{runOptions.map((r) => (
								<SelectItem key={r.id} value={String(r.id)}>
									Run #{r.id} · {formatTimestamp(r.createdAt)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					variant="outline"
					size="sm"
					className="h-8 shrink-0 gap-1.5"
					onClick={handleRefresh}
					disabled={loading}
				>
					<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
					<span className="hidden sm:inline">Refresh schedule</span>
					<span className="sr-only sm:hidden">Refresh schedule</span>
				</Button>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 shrink-0 gap-1.5"
								disabled={!draft || isRunPublished || blockingHardCount > 0 || unassignedCount > 0 || centerView === 'pre-generation'}
								onClick={() => {
									setPublishAcknowledged(false);
									setShowPublishDialog(true);
								}}
								data-testid="timetable-advanced-publish"
							>
								<Send className="size-3.5" />
								Publish
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{isRunPublished
								? 'This run is already published. Create an effective-dated revision instead of re-publishing.'
								: blockingHardCount > 0
									? `Cannot publish: ${blockingHardCount} hard violation(s) remaining`
									: unassignedCount > 0
										? `Cannot publish: ${unassignedCount} session(s) still need placing`
										: 'Publish this schedule'}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={isPreGenerationWorkspace ? 'default' : 'outline'}
								size="sm"
								className="h-8 shrink-0 gap-1.5"
								disabled={newDraftLoading || !schoolYearId}
								onClick={() => void openDraftPlannerTask()}
							>
								{newDraftLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
								{newDraftLoading ? 'Opening draft…' : 'Plan before generating'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open the draft grid so you can place unassigned sessions before generating.</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{draftPlacementCount > 0 && !isPreGenerationWorkspace && (
					<Button
						variant="secondary"
						size="sm"
						className="h-8 shrink-0 gap-1.5 border border-primary/30"
						onClick={() => void openPreGenerationWorkspace(false).then(() => {
							setLeftTab('unassigned');
							expandLeftPanelForTask();
							setPresentationMode('workflow');
						})}
					>
						<CalendarClock className="size-3.5" />
						Continue draft
					</Button>
				)}
				{isPreGenerationWorkspace && context.hasPublishedReturnState && (
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						onClick={returnToGeneratedRun}
						data-testid="timetable-return-to-published"
					>
						<Undo2 className="size-3.5" />
						Return to published schedule
					</Button>
				)}

					<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5">
							<MoreHorizontal className="size-3.5" />
							More tools
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72 p-2">
						<div className="grid gap-1" onClick={() => setMoreOpen(false)}>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							{generationRepairHref ? (
								<Button asChild variant="default" size="sm" className="h-8 gap-1.5" data-testid="timetable-advanced-generate-repair">
									<Link to={generationRepairHref}>
										<Wrench className="size-3.5" />
										{generationRepairLabel}
									</Link>
								</Button>
							) : (
								<Button
									variant="default"
									size="sm"
									className="h-8 gap-1.5"
									disabled={!generationGate.enabled || loading}
									onClick={handleGenerationTrigger}
									data-testid="timetable-advanced-generate"
								>
									{generating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
									{generating ? 'Generating…' : 'Generate'}
								</Button>
							)}
						</TooltipTrigger>
						<TooltipContent>
							{generationGate.enabled
								? 'Trigger a new schedule generation run'
								: (generationGate.reason ?? 'Generation is not available yet.')}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								data-tutorial="policy-btn"
								variant={centerView === 'policy' ? 'default' : 'outline'}
								size="sm"
								className="h-8 gap-1.5"
								disabled={!schoolYearId}
								onClick={() => centerView === 'policy' ? exitPolicyView() : switchCenterViewWithGuard(enterPolicyView)}
							>
								<Settings2 className="size-3.5" />
								{centerView === 'policy' ? 'Close Policy' : 'Policy'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Configure scheduling policy and soft-constraint weights</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={centerView === 'map' || centerView === 'building' ? 'default' : 'outline'}
								size="sm"
								className="h-8 gap-1.5"
								disabled={!schoolYearId}
								onClick={() => { void openMapWorkspace(); }}
							>
								<Crosshair className="size-3.5" />
								{centerView === 'map' || centerView === 'building' ? 'Map Workspace' : 'Map View'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Navigate buildings and rooms without leaving the editable grid</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
								<Link to="/faculty/preferences">
									<ClipboardList className="size-3.5" />
									Input status
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Check which teachers have submitted preferences</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								onClick={() => openLeftTask('requests')}
								data-testid="timetable-advanced-requests"
							>
								<ClipboardList className="size-3.5" />
								Requests
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open the room requests queue inside Timetable</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								onClick={() => setShowSyncConfirm(true)}
								disabled={loading || syncing || isPreGenerationWorkspace || activeGeneratedRunId == null}
								aria-label="Sync with Setup"
							>
								{syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
								Sync with Setup
							</Button>
						</TooltipTrigger>
						<TooltipContent>Sync teacher assignments and curriculum setup from database</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={revertLoading || editHistoryCount === 0 || !draft}
								onClick={revertLastEdit}
							>
								{revertLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
								<span className="hidden xl:inline">Undo</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Undo last manual edit</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={editHistoryCount === 0}
								onClick={() => setShowEditHistory(true)}
							>
								<History className="size-3.5" />
								<span className="text-xs">{editHistoryCount}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>View manual edit history</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 gap-1.5"
								onClick={tutorial.start}
							>
								<GraduationCap className="size-3.5" />
								Tour
							</Button>
						</TooltipTrigger>
						<TooltipContent>Start guided tour of the schedule review page</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Link to="/timetabling/how-it-works" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
					<Lightbulb className="size-3.5" />
					How It Works
				</Link>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>

				{summary && (
					<ScheduleReviewWorkspaceSummaryStats
						summary={summary}
						presence={context.presence}
						statusColor={statusColor}
						draftStatus={draft?.status ?? '—'}
						durationMs={selectedDurationMs}
						formatDuration={formatDuration}
					/>
				)}
			</div>

			<div className="px-4 pb-1.5">
				{Number.isInteger(schoolId) && schoolId > 0 ? (
					<RolloverGuidanceCard compact schoolId={schoolId} onStatus={setRolloverStatus} onApplied={() => handleRefresh()} />
				) : null}
			</div>

			<div
				data-testid="timetable-task-guide"
				className="relative mx-2 mb-1 rounded-lg border border-border bg-muted/20 px-2 py-0.5 shadow-sm sm:mx-4 xl:px-3 [@media(max-height:500px)]:mb-0 [@media(max-height:500px)]:py-0"
			>
				<div className="flex min-w-0 items-center justify-between gap-1.5">
					<div className="sr-only">
						<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-sm ring-1 ring-border">
							<ActiveTaskIcon className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next task</p>
							<p className="truncate text-sm font-semibold text-foreground">{activeTask.label}</p>
						</div>
					</div>

					<ScheduleReviewWorkspaceTaskModes taskModes={taskModes} />
				</div>
				{/* B2 — the plain-language guidance is visible to sighted users here,
				    not only to screen readers. See TimetableAdvancedHeaderHelp. */}
				<TimetableAdvancedHeaderHelp
					mode={isPreGenerationWorkspace ? 'draft' : 'schedule'}
					activeTaskHelper={activeTask.helper}
					editHistoryCount={editHistoryCount}
					revertLoading={revertLoading}
					onRevertLastEdit={revertLastEdit}
				/>
			</div>

			{showInputStateBanner && (
				<ScheduleReviewInputStateBanner
					inputState={inputState}
					changedDomainLabels={changedDomainLabels}
					loading={loading}
					syncing={syncing}
					hasSelectedEntry={hasSelectedEntry}
					generationEnabled={generationGate.enabled}
					onPreviewImpact={() => setShowImpactPreview(true)}
					onSync={() => setShowSyncConfirm(true)}
					onManualRepair={() => context.enterManualEditView('CHANGE_FACULTY')}
					onRegenerate={handleGenerationTrigger}
				/>
			)}

			<SyncTimetableConfirmDialog
				open={showSyncConfirm}
				onOpenChange={setShowSyncConfirm}
				syncing={syncing}
				onSyncNow={handleSyncSetup}
			/>
			<SetupImpactDialog
				open={showImpactPreview}
				onOpenChange={setShowImpactPreview}
				inputState={inputState}
				changedDomainLabels={changedDomainLabels}
			/>

			<TimetableToolbar
				viewMode={viewMode}
				viewModeLabels={VIEW_MODE_LABELS}
				onViewModeChange={(value) => {
					setViewMode(value as 'section' | 'faculty' | 'room');
					setEntityFilter('');
					setSelectedEntry(null);
					setSelectedViolation(null);
					setPreGenKbSource(null);
					setKbSelectedSource(null);
				}}
				entityFilter={entityFilter}
				onEntityFilterChange={(value) => {
					setEntityFilter(value);
					setSelectedEntry(null);
					setSelectedViolation(null);
					setPreGenKbSource(null);
					setKbSelectedSource(null);
				}}
				groupedPivotEntities={groupedPivotEntities}
				pivotLabel={pivotLabel}
				programFilter={programFilter}
				onProgramFilterChange={(value) => setProgramFilter(value as ProgramFilter)}
				programFilterOptions={PROGRAM_FILTER_OPTIONS}
				entryKindFilter={entryKindFilter}
				onEntryKindFilterChange={(value) => setEntryKindFilter(value as EntryKindFilter)}
				entryKindFilterOptions={ENTRY_KIND_FILTER_OPTIONS}
				termFilter={termFilter}
				onTermFilterChange={onTermFilterChange}
				termOptions={termOptions}
				activeTermIndex={activeTermIndex}
			>
				<div className="flex items-center gap-1">
					<Button
						variant={presentationMode === 'workflow' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-xs"
						onClick={() => setPresentationMode('workflow')}
					>
						Schedule review
					</Button>
					<Button
						variant={presentationMode === 'matrix' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-xs"
						onClick={() => setPresentationMode('matrix')}
					>
						Grid view
					</Button>
				</div>
				<div className="h-4 w-px bg-border mx-0.5" />
				<FilterChip
					label="All"
					count={visibleViolations.length}
					active={severityFilter === 'all'}
					onClick={() => setSeverityFilter('all')}
				/>
				<FilterChip
					label="Hard"
					count={hardCount}
					active={severityFilter === 'hard'}
					onClick={() => setSeverityFilter('hard')}
					variant="destructive"
				/>
				<FilterChip
					label="Soft"
					count={softCount}
					active={severityFilter === 'soft'}
					onClick={() => setSeverityFilter('soft')}
					variant="warning"
				/>
				<FilterChip
					label="Conflicts"
					count={visibleViolations.filter((v) => CONFLICT_CODES.has(v.code)).length}
					active={severityFilter === 'conflicts'}
					onClick={() => setSeverityFilter('conflicts')}
				/>
				<FilterChip
					label="Well-being"
					count={visibleViolations.filter((v) => WELLBEING_CODES.has(v.code)).length}
					active={severityFilter === 'wellbeing'}
					onClick={() => setSeverityFilter('wellbeing')}
				/>
			</TimetableToolbar>

			<ConfirmationModal
				open={showPostSyncOffer}
				onOpenChange={setShowPostSyncOffer}
				{...{ title: 'Place available sessions?' }}
				description={`Setup sync updated ${syncResult?.updatedFacultyCount} teacher assignments, moved ${syncResult?.displacedEntriesCount} sessions to Needs attention, and found ${syncResult?.addedUnassignedCount} new sessions. Review the sessions ATLAS can place now.`}
				onConfirm={handleTriggerQuickPlacePreview}
				confirmText="Review placements"
				variant="success"
			/>

			<QuickPlaceSummaryModal
				open={showQuickPlaceConfirm}
				onOpenChange={setShowQuickPlaceConfirm}
				placed={quickPlacePlaced}
				unplaced={quickPlaceUnplaced}
				onConfirm={handleCommitQuickPlace}
				loading={quickPlaceLoading}
			/>
			</div>
		</Profiler>
	);
}

export const ScheduleReviewWorkspaceHeader = memo(ScheduleReviewWorkspaceHeaderImpl);
