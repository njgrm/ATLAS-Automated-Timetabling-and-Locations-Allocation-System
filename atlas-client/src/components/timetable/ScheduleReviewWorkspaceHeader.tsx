import { memo, Profiler, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRightLeft, CalendarClock, Check, Clock, ClipboardCheck, ClipboardList, Crosshair, GraduationCap, History, Info, Lightbulb, ListChecks, Loader2, MoreHorizontal, Play, RefreshCw, RotateCw, SearchCheck, Send, Settings2, ShieldAlert, Undo2, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { QuickPlaceSummaryModal } from '@/components/timetable/QuickPlaceSummaryModal';
import { FilterChip, StatItem } from '@/components/timetable/TimetableShared';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { EntryKindFilter, ProgramFilter } from '@/lib/schedule-review-helpers';
import { DEFAULT_SCHOOL_ID } from '@/components/timetable/ScheduleReviewWorkspace.constants';
import { onProfilerRender } from '@/components/timetable/ScheduleReviewWorkspace';

type ScheduleReviewWorkspaceHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
};

type TimetableTaskMode = {
	id: 'review' | 'place' | 'switch' | 'plan' | 'requests';
	label: string;
	helper: string;
	icon: LucideIcon;
	active: boolean;
	disabled?: boolean;
	onClick: () => void;
	badge?: ReactNode;
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
			const { data } = await atlasApi.post(
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${activeGeneratedRunId}/sync-setup`
			);
			setSyncResult(data);
			if (data.displacedEntriesCount > 0 || data.addedUnassignedCount > 0) {
				setShowPostSyncOffer(true);
			} else {
				toast.success(
					`Timetable synced successfully: updated ${data.updatedFacultyCount} teacher assignments, ` +
					`displaced ${data.displacedEntriesCount} entries, added ${data.addedUnassignedCount} unassigned sessions.`
				);
			}
			handleRefresh();
		} catch (err: any) {
			const msg = err.response?.data?.message || err.message || 'Sync failed.';
			toast.error(msg);
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
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/preview`
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
				`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${activeGeneratedRunId}/quick-place/apply`,
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
	const openLeftTask = (tab: 'violations' | 'unassigned' | 'requests') => {
		leftPanelRef.current?.expand();
		setLeftTab(tab);
		setPresentationMode('workflow');
	};
	const openDraftPlannerTask = async () => {
		await handleStartNewPreGenerationDraft();
		setLeftTab('unassigned');
		leftPanelRef.current?.expand();
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
	const foolproofHelp = isPreGenerationWorkspace
		? 'Draft mode: choose a draft queue item, then tap or click a grid slot. Review draft placement opens before anything is saved. Switch: select one placed draft session, then another occupied slot.'
		: 'Place: open Needs attention, choose Place session, then tap or click a grid slot. Switch: select one class, then another occupied class to open Review occupied-slot swap. Draft: use Plan before generating for draft anchors.';
	const statusLegend = 'Can place = empty slot. Can swap = occupied slot. Blocked = fix first. Warning = review only.';
	const sourceContext = context.schoolYearContext;
	const sourceLabel = !sourceContext
		? 'Checking source'
		: sourceContext.source === 'enrollpro-verified'
			? 'Verified with EnrollPro'
			: sourceContext.source === 'enrollpro'
				? 'Using EnrollPro settings'
				: sourceContext.source === 'cache'
					? 'Using cached school year'
					: 'Using saved ATLAS data';
	const sourceTone = !sourceContext || sourceContext.source === 'enrollpro-verified' || sourceContext.source === 'enrollpro'
		? 'border-emerald-200 bg-emerald-50 text-emerald-900'
		: 'border-amber-200 bg-amber-50 text-amber-950';
	const latestRunCandidate = runOptions[0] ?? null;
	const visibleRunId = draft?.runId ?? activeGeneratedRunId;
	const newerFailedRunNotice = selectedRunId === 'latest'
		&& draft?.runId != null
		&& latestRunCandidate?.id != null
		&& latestRunCandidate.id !== draft.runId
		&& latestRunCandidate.status !== 'COMPLETED'
			? `Grid uses completed run #${draft.runId}; newer run #${latestRunCandidate.id} is ${latestRunCandidate.status ?? 'not completed'}.`
			: null;
	const showSourceTruthNotice = Boolean(newerFailedRunNotice || sourceContext?.stale || sourceContext?.source === 'cache' || sourceContext?.source === 'atlas-persisted');

	return (
		<Profiler id="Header" onRender={onProfilerRender}>
			<div className="shrink-0 border-b border-border bg-background">
			<div className="flex items-center gap-2 overflow-x-auto px-4 pt-2 pb-1.5 xl:flex-wrap [@media(max-height:500px)]:pt-1 [@media(max-height:500px)]:pb-1">
				<Badge
					variant={isPreGenerationWorkspace ? 'secondary' : 'default'}
					className={cn('h-7 shrink-0 px-2.5 text-xs font-semibold uppercase', isPreGenerationWorkspace ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
				>
					{isPreGenerationWorkspace ? 'Pre-Generation Draft' : `Generated Run #${activeGeneratedRunId ?? '-'}`}
				</Badge>

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
								disabled={!draft || hardCount > 0 || centerView === 'pre-generation'}
								onClick={() => {
									setPublishAcknowledged(false);
									setShowPublishDialog(true);
								}}
							>
								<Send className="size-3.5" />
								Publish
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{hardCount > 0 ? `Cannot publish: ${hardCount} hard violation(s) remaining` : 'Publish this schedule'}
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
							leftPanelRef.current?.expand();
							setPresentationMode('workflow');
						})}
					>
						<CalendarClock className="size-3.5" />
						Continue draft
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
				{isPreGenerationWorkspace && activeGeneratedRunId != null && (
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5"
						onClick={returnToGeneratedRun}
					>
						<Undo2 className="size-3.5" />
						Back to Generated Run
					</Button>
				)}

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="default"
								size="sm"
								className="h-8 gap-1.5"
								disabled={generating || loading || !schoolYearId}
								onClick={handleTriggerGenerate}
							>
								{generating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
								{generating ? 'Generating…' : 'Generate'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Trigger a new schedule generation run</TooltipContent>
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
								onClick={() => setLeftTab('requests')}
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
					<div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
						{/* Active Collaborators */}
						{context.presence && context.presence.length > 0 && (
							<div className="flex items-center gap-1.5 mr-1 select-none print:hidden">
								<span className="text-xs font-bold uppercase text-muted-foreground/80">Online:</span>
								<div className="flex -space-x-1.5 overflow-hidden">
									{context.presence.map((user) => {
										const initials = (user.email || 'U').substring(0, 2).toUpperCase();
										return (
											<TooltipProvider key={user.connectionId}>
												<Tooltip>
													<TooltipTrigger asChild>
												<div className="inline-flex size-7 items-center justify-center rounded-full border border-background bg-indigo-600 text-xs font-bold text-white shadow-sm ring-1 ring-black/5">
															{initials}
														</div>
													</TooltipTrigger>
													<TooltipContent className="p-2 text-xs">
														<p className="font-semibold text-foreground">{user.email}</p>
													<p className="text-xs capitalize text-muted-foreground">{user.role?.toLowerCase()} &middot; Active</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										);
									})}
								</div>
							</div>
						)}
						<Badge variant="outline" className={`h-5 px-1.5 text-xs font-bold ${statusColor(draft?.status ?? '')}`}>
							{draft?.status ?? '—'}
						</Badge>
						<StatItem
							icon={Check}
							label="Assigned"
							value={`${summary.assignedCount}/${summary.classesProcessed}`}
							explanation="Classes successfully placed vs total classes the algorithm attempted to schedule."
						/>
						<StatItem
							icon={ShieldAlert}
							label="Hard"
							value={String(summary.hardViolationCount)}
							className={summary.hardViolationCount > 0 ? 'text-red-600 font-semibold' : ''}
							explanation="Critical policy violations. A schedule with any Hard Violations cannot be published."
						/>
						<StatItem
							icon={Clock}
							label="Duration"
							value={formatDuration(
								draft
									? runOptions.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runOptions[0]?.id))?.durationMs ?? null
									: null,
							)}
							explanation="Real-world computing time it took to generate this draft."
						/>
					</div>
				)}
			</div>

			{showSourceTruthNotice && (
				<div
					data-testid="timetable-source-truth"
					className={cn(
						'mx-4 mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-sm',
						sourceTone,
					)}
				>
					<div className="flex min-w-0 items-center gap-2">
						<Info className="size-3.5 shrink-0" aria-hidden="true" />
						<p className="min-w-0 truncate font-semibold">
							{sourceLabel}
							{schoolYearId ? ` · School year #${schoolYearId}` : ''}
							{visibleRunId ? ` · Run #${visibleRunId}` : ''}
						</p>
					</div>
					<p className="min-w-0 text-current/80 sm:truncate" data-testid="timetable-run-source-note">
						{newerFailedRunNotice ?? 'Live EnrollPro verification is not confirmed. Review this as saved ATLAS data until source is refreshed.'}
					</p>
				</div>
			)}

			<div
				data-testid="timetable-task-guide"
				className="relative mx-4 mb-1 rounded-lg border border-border bg-muted/20 px-2 py-1 shadow-sm xl:px-3 [@media(max-height:500px)]:mb-0 [@media(max-height:500px)]:py-1"
			>
				<div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
					<div className="hidden min-w-0 items-center gap-2 sm:flex sm:w-64 sm:flex-none">
						<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-sm ring-1 ring-border">
							<ActiveTaskIcon className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Next task</p>
							<p className="truncate text-sm font-semibold text-foreground">{activeTask.label}</p>
						</div>
					</div>

					<div
						role="group"
						aria-label="Timetable task modes"
						className="flex min-w-0 gap-1 overflow-x-auto pb-0.5 sm:flex-1"
					>
						{taskModes.map((task) => {
							const Icon = task.icon;
							return (
								<TooltipProvider key={task.id}>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												type="button"
												variant={task.active ? 'default' : 'outline'}
												size="sm"
												className="h-11 shrink-0 gap-1.5 px-3 text-xs"
												disabled={task.disabled}
												onClick={task.onClick}
												data-testid={`timetable-task-${task.id}`}
												aria-describedby="timetable-foolproof-help"
											>
												<Icon className="size-3.5" aria-hidden="true" />
												<span>{task.label}</span>
												{task.badge !== undefined && (
													<Badge
														variant={task.active ? 'secondary' : 'outline'}
														className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[0.65rem]"
													>
														{task.badge}
													</Badge>
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom" className="max-w-xs text-xs">
											{task.helper}
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							);
						})}
					</div>
				</div>
				<div
					id="timetable-foolproof-help"
					data-testid="timetable-foolproof-help"
					className="mt-1 flex min-w-0 flex-col gap-1 rounded-md bg-background/70 px-2 py-1 text-xs leading-snug text-muted-foreground sm:flex-row sm:items-center sm:justify-between [@media(max-height:500px)]:py-0.5"
				>
					<p className="min-w-0 truncate">
						<span className="font-semibold text-foreground">No precision dragging required.</span>{' '}
						<span className="hidden md:inline">{foolproofHelp}</span>
						<span className="md:hidden">{activeTask.helper}</span>
						<span className="sr-only">{foolproofHelp}</span>
					</p>
					<div className="flex shrink-0 items-center gap-2">
						<p
							className="hidden font-medium text-foreground lg:block"
							data-testid="timetable-status-legend"
						>
							{statusLegend}
						</p>
						<span className="sr-only">{statusLegend}</span>
						{editHistoryCount > 0 && !isPreGenerationWorkspace && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden h-8 gap-1.5 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 md:inline-flex"
							onClick={revertLastEdit}
							disabled={revertLoading}
							data-testid="timetable-visible-undo"
							aria-label="Undo last manual timetable change"
						>
							{revertLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Undo2 className="size-3.5" aria-hidden="true" />}
							<span className="hidden sm:inline">Undo last change</span>
							<span className="sm:hidden">Undo</span>
						</Button>
						)}
					</div>
				</div>
			</div>

			{showInputStateBanner && (
				<div className={cn(
					'mx-4 mb-2 flex flex-col gap-3 rounded-xl border px-3 py-2.5 shadow-sm lg:flex-row lg:items-center lg:justify-between',
					inputState?.status === 'STALE'
						? 'border-amber-200 bg-amber-50 text-amber-950'
						: 'border-sky-200 bg-sky-50 text-sky-950',
				)}>
					<div className="flex min-w-0 items-start gap-3">
						<div className={cn(
							'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
							inputState?.status === 'STALE' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700',
						)}>
							{inputState?.status === 'STALE' ? <AlertTriangle className="size-4" /> : <ShieldAlert className="size-4" />}
						</div>
						<div className="min-w-0 space-y-1">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-bold">{inputState?.status === 'STALE' ? 'Setup changes detected' : 'Setup comparison unavailable'}</p>
								{inputState?.status === 'STALE' && changedDomainLabels.slice(0, 3).map((label) => (
									<Badge key={label} variant="outline" className="h-5 border-amber-300 bg-white/70 px-1.5 text-xs font-bold text-amber-800">
										{label}
									</Badge>
								))}
							</div>
							<p className="text-xs font-medium leading-relaxed text-current/80">
								{inputState?.message ?? 'ATLAS could not check this run against the latest setup data.'}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<Button variant="outline" size="sm" className="h-8 gap-1.5 bg-background/80" onClick={() => setShowImpactPreview(true)}>
							<SearchCheck className="size-3.5" />
							Preview Impact
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1.5 bg-background/80 font-semibold border-amber-300 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
							onClick={() => setShowSyncConfirm(true)}
							disabled={loading || syncing}
						>
							{syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
							Sync with Setup
						</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											variant="outline"
											size="sm"
											className="h-8 gap-1.5 bg-background/80"
											disabled={!hasSelectedEntry}
											onClick={() => context.enterManualEditView('CHANGE_FACULTY')}
										>
											<Wrench className="size-3.5" />
											Manually Repair
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>{hasSelectedEntry ? 'Repair the selected class without regenerating.' : 'Select a timetable class before using manual repair.'}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<Button variant="destructive" size="sm" className="h-8 gap-1.5" disabled={generating || loading || !schoolYearId} onClick={handleTriggerGenerate}>
							<RotateCw className="size-3.5" />
							Regenerate Draft
						</Button>
					</div>
				</div>
			)}

			<Dialog open={showImpactPreview} onOpenChange={setShowImpactPreview}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
							<DialogTitle>{inputState?.status === 'STALE' ? 'Setup changes detected' : 'Setup comparison unavailable'}</DialogTitle>
						<DialogDescription>
							{inputState?.status === 'STALE'
								? 'This draft was not changed automatically. Review the changed setup areas, then choose manual repair or regenerate when ready.'
								: 'This draft can still be reviewed, but ATLAS cannot prove whether its setup inputs match the latest data.'}
						</DialogDescription>
					</DialogHeader>
					<div className="rounded-lg border border-border bg-muted/30 p-3">
						<p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Changed setup areas</p>
						<div className="flex flex-wrap gap-2">
							{changedDomainLabels.map((label) => (
								<Badge key={label} variant="outline" className="bg-background text-xs font-semibold">
									{label}
								</Badge>
							))}
						</div>
					</div>
					<p className="text-xs leading-relaxed text-muted-foreground">{inputState?.actionHint}</p>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setShowImpactPreview(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Sync Timetable with Setup</DialogTitle>
						<DialogDescription className="space-y-2">
							<span>This will update the timetable draft to match live setup changes:</span>
							<ul className="list-disc list-inside text-xs space-y-1">
								<li>Sync scheduled classes with current teacher assignments.</li>
								<li>Import newly created sections or subjects into the unassigned queue.</li>
								<li>Remove entries for deleted sections or subjects.</li>
								<li>Re-evaluate policy violations.</li>
							</ul>
							<p className="text-xs font-semibold text-amber-600">
								Manual slot swaps and pins will be preserved, but new conflicts may be highlighted.
							</p>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setShowSyncConfirm(false)} disabled={syncing}>
							Cancel
						</Button>
						<Button variant="default" size="sm" onClick={handleSyncSetup} disabled={syncing}>
							{syncing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <RefreshCw className="size-3 mr-1.5" />}
							Sync Now
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
