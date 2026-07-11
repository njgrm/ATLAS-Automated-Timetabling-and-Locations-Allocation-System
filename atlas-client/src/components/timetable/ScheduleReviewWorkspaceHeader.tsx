import { memo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Clock, ClipboardList, Crosshair, GraduationCap, History, Lightbulb, Loader2, MoreHorizontal, Play, RefreshCw, RotateCw, SearchCheck, Send, Settings2, ShieldAlert, Undo2, Wrench } from 'lucide-react';
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

type ScheduleReviewWorkspaceHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
};

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
		presentationMode,
		setPresentationMode,
		selectedRunId,
		handleRunChange,
		runs,
		centerView,
		newDraftLoading,
		schoolYearId,
		handleStartNewPreGenerationDraft,
		draftBoard,
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
		editHistory,
		revertLastEdit,
		setShowEditHistory,
		tutorial,
		summary,
		statusColor,
		formatDuration,
		formatTimestamp,
		VIEW_MODE_LABELS,
		viewMode,
		setViewMode,
		setEntityFilter,
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
	const editHistoryItems = editHistory ?? [];
	const visibleViolations = violations ?? [];

	return (
		<div className="shrink-0 border-b border-border bg-background">
			<div className="flex items-center gap-2 px-4 pt-3 pb-1.5 flex-wrap">
				<Badge
					variant={isPreGenerationWorkspace ? 'secondary' : 'default'}
					className={cn('h-7 px-2.5 text-xs font-semibold uppercase', isPreGenerationWorkspace ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
				>
					{isPreGenerationWorkspace ? 'Pre-Generation Draft' : `Generated Run #${activeGeneratedRunId ?? '-'}`}
				</Badge>

				<div data-tutorial="run-selector">
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
					className="h-8 gap-1.5"
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
								className="h-8 gap-1.5"
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

				<DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 gap-1.5">
							<MoreHorizontal className="size-3.5" />
							More
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72 p-2">
						<div className="grid gap-1" onClick={() => setMoreOpen(false)}>

				<Button
					variant="outline"
					size="sm"
					className="h-8 gap-1.5"
					disabled={newDraftLoading || !schoolYearId}
					onClick={handleStartNewPreGenerationDraft}
				>
					{newDraftLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
					New Pre-Generation Draft
				</Button>

				{(draftBoard?.counts.draft ?? 0) > 0 && !isPreGenerationWorkspace && (
					<Button
						variant="secondary"
						size="sm"
						className="h-8 gap-1.5 border border-primary/30"
						onClick={() => void openPreGenerationWorkspace(false)}
					>
						<CalendarClock className="size-3.5" />
						Continue Draft
					</Button>
				)}

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
								data-tutorial="undo-btn"
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={revertLoading || editHistoryItems.length === 0 || !draft}
								onClick={revertLastEdit}
							>
								<Undo2 className={`size-3.5 ${revertLoading ? 'animate-spin' : ''}`} />
								Undo
							</Button>
						</TooltipTrigger>
						<TooltipContent>Revert the last manual edit</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 gap-1.5"
								disabled={editHistoryItems.length === 0}
								onClick={() => setShowEditHistory(true)}
							>
								<History className="size-3.5" />
								<span className="text-xs">{editHistoryItems.length}</span>
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
					<div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
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
											disabled={!context.selectedEntry}
											onClick={() => context.enterManualEditView('CHANGE_FACULTY')}
										>
											<Wrench className="size-3.5" />
											Manually Repair
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>{context.selectedEntry ? 'Repair the selected class without regenerating.' : 'Select a timetable class before using manual repair.'}</TooltipContent>
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
	);
}

export const ScheduleReviewWorkspaceHeader = memo(ScheduleReviewWorkspaceHeaderImpl);
