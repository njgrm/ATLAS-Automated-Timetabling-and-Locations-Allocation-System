import { memo } from 'react';
import { CalendarClock, Check, Clock, Crosshair, GraduationCap, History, Lightbulb, Loader2, Play, RefreshCw, Send, Settings2, ShieldAlert, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

import { FilterChip, StatItem } from '@/components/timetable/TimetableShared';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { EntryKindFilter, ProgramFilter } from '@/lib/schedule-review-helpers';

type ScheduleReviewWorkspaceHeaderProps = {
	context: ScheduleReviewWorkspaceHeaderContext;
};

function ScheduleReviewWorkspaceHeaderImpl({ context }: ScheduleReviewWorkspaceHeaderProps) {
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
		softCount,
		WELLBEING_CODES,
		CONFLICT_CODES,
	} = context;

	return (
		<div className="shrink-0 border-b border-border bg-background">
			<div className="flex items-center gap-2 px-4 pt-3 pb-1.5 flex-wrap">
				<Badge
					variant={isPreGenerationWorkspace ? 'secondary' : 'default'}
					className={cn('h-7 px-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase', isPreGenerationWorkspace ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
				>
					{isPreGenerationWorkspace ? 'Pre-Generation Draft' : `Generated Run #${activeGeneratedRunId ?? '-'}`}
				</Badge>

				<div data-tutorial="run-selector">
					<Select value={selectedRunId} onValueChange={handleRunChange} disabled={runs.length === 0 || centerView === 'pre-generation'}>
						<SelectTrigger className="h-8 w-44 text-xs">
							<SelectValue placeholder={runs.length === 0 ? 'No generated run yet' : 'Select run'} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest" disabled={runs.length === 0}>Latest Run</SelectItem>
							{runs.map((r) => (
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
							<Button
								variant="outline"
								size="sm"
								className="h-8"
								onClick={handleRefresh}
								disabled={loading}
								aria-label="Refresh data"
							>
								<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh data</TooltipContent>
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
								disabled={revertLoading || editHistory.length === 0 || !draft}
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
								disabled={editHistory.length === 0}
								onClick={() => setShowEditHistory(true)}
							>
								<History className="size-3.5" />
								<span className="text-[0.625rem]">{editHistory.length}</span>
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

				{summary && (
					<div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
						<Badge variant="outline" className={`h-5 px-1.5 text-[0.625rem] font-bold ${statusColor(draft?.status ?? '')}`}>
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
									? runs.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runs[0]?.id))?.durationMs ?? null
									: null,
							)}
							explanation="Real-world computing time it took to generate this draft."
						/>
						<div className="h-4 w-px bg-border mx-1" />
						<span className="text-[0.625rem] font-medium text-foreground">
							Manual Review: <span className="font-semibold">{(context.policy?.teacherMoveEnabled ?? true) ? 'Enabled' : 'Disabled'}</span>
						</span>
					</div>
				)}
			</div>

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
						className="h-7 px-2.5 text-[0.625rem]"
						onClick={() => setPresentationMode('workflow')}
					>
						Workflow
					</Button>
					<Button
						variant={presentationMode === 'matrix' ? 'default' : 'outline'}
						size="sm"
						className="h-7 px-2.5 text-[0.625rem]"
						onClick={() => setPresentationMode('matrix')}
					>
						Class Program Matrix
					</Button>
				</div>
				<div className="h-4 w-px bg-border mx-0.5" />
				<FilterChip
					label="All"
					count={violations.length}
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
					count={violations.filter((v) => CONFLICT_CODES.has(v.code)).length}
					active={severityFilter === 'conflicts'}
					onClick={() => setSeverityFilter('conflicts')}
				/>
				<FilterChip
					label="Well-being"
					count={violations.filter((v) => WELLBEING_CODES.has(v.code)).length}
					active={severityFilter === 'wellbeing'}
					onClick={() => setSeverityFilter('wellbeing')}
				/>
			</TimetableToolbar>
		</div>
	);
}

export const ScheduleReviewWorkspaceHeader = memo(ScheduleReviewWorkspaceHeaderImpl);
