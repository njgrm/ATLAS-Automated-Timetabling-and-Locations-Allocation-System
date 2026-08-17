import { useMemo } from 'react';
import { Zap, Activity, Settings2, RotateCcw, Layers, Users, ChartColumn } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SmartHelpTrigger } from '@/components/smart/SmartPageShell';
import type { TeachingLoadSplitBrainReconcileResult, CoverageMode } from '@/types';

type WorkspaceToolbarProps = {
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	unassignedPairs: number;
	totalPairs: number;
	overCapCount: number;
	autoFillLoading: boolean;
	staffingNeedsLoading: boolean;
	autoFillEnabled: boolean;
	onAutoFillClick: () => void;
	onViewStaffingNeedsClick: () => void;
	viewMode: string;
	onViewModeChange: (value: string) => void;
	dataSource: 'live' | 'cached' | 'refreshing' | 'none';
	degradedWriteEnabled: boolean;
	isWorkspaceWritable: boolean;
	isOnline: boolean;
	dataSourceNotice: string | null;
	splitBrainIncident: TeachingLoadSplitBrainReconcileResult | null;
	splitBrainQuarantineRequired?: boolean;
	showJumpList: boolean;
	onToggleJumpList: () => void;
	coverageMode: CoverageMode;
	onCoverageModeChange: (mode: CoverageMode) => void;
	coverageModeConfig: Record<CoverageMode, { label: string; description: string }>;
	onGlobalResetClick: () => void;
	canRunGlobalReset: boolean;
	onReconcileClick: () => void;
	reconcileLoading: boolean;
	showReconcileAction: boolean;
	reconcileEnabled: boolean;
	workspaceStateLabel: string;
	workspaceStateDescription: string;
	workspaceStateNextAction: string;
	activeDraftCount: number;
	saving: boolean;
	onSave: () => void;
	onRetrySource: () => void;
};

const STRIP_TONE: Record<'success' | 'warning' | 'danger' | 'info', string> = {
	success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	warning: 'border-amber-200 bg-amber-50 text-amber-700',
	danger:  'border-rose-200 bg-rose-50 text-rose-700',
	info:    'border-sky-200 bg-sky-50 text-sky-700',
};

export function WorkspaceToolbar({
	realAssignedPairs,
	syntheticPlaceholderPairs,
	unassignedPairs,
	totalPairs,
	overCapCount,
	autoFillLoading,
	staffingNeedsLoading,
	autoFillEnabled,
	onAutoFillClick,
	onViewStaffingNeedsClick,
	viewMode,
	onViewModeChange,
	dataSource,
	degradedWriteEnabled,
	isWorkspaceWritable,
	isOnline,
	dataSourceNotice,
	splitBrainIncident,
	splitBrainQuarantineRequired = false,
	showJumpList,
	onToggleJumpList,
	coverageMode,
	onCoverageModeChange,
	coverageModeConfig,
	onGlobalResetClick,
	canRunGlobalReset,
	onReconcileClick,
	reconcileLoading,
	showReconcileAction,
	reconcileEnabled,
	reviewDismissed,
	workspaceStateLabel,
	workspaceStateDescription,
	workspaceStateNextAction,
	activeDraftCount,
	saving,
	onSave,
	onRetrySource,
}: WorkspaceToolbarProps & { reviewDismissed?: boolean }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Offline', color: 'bg-amber-500', description: 'Disconnected from the server. Changes are locked until ATLAS reconnects.' };
		if (dataSource === 'refreshing') return { label: 'Checking source', color: 'bg-blue-500 animate-pulse', description: dataSourceNotice ?? 'Verifying live data before edits continue.' };
		if (dataSource === 'live') return { label: 'EnrollPro roster verified', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'ATLAS Teaching Load draft. Freshly verified. Draft changes can be saved.' };
		if (isWorkspaceWritable) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
		if (degradedWriteEnabled) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
		return { label: 'Read-only', color: 'bg-blue-500', description: dataSourceNotice ?? 'Viewing a saved snapshot. Edits need source verification first.' };
	}, [isOnline, dataSource, isWorkspaceWritable, degradedWriteEnabled, dataSourceNotice]);

	const primaryAction = useMemo(() => {
		if (activeDraftCount > 0) {
			return {
				label: saving ? 'Saving...' : `Save draft (${activeDraftCount})`,
				onClick: onSave,
				disabled: saving || !isWorkspaceWritable,
				variant: 'default' as const,
				helper: isWorkspaceWritable ? 'Save pending assignment changes.' : 'Saving is blocked until this workspace is writable.',
			};
		}
		if (dataSource === 'refreshing') {
			return {
				label: 'Checking source',
				onClick: onRetrySource,
				disabled: true,
				variant: 'outline' as const,
				helper: 'ATLAS is checking live assignment data.',
			};
		}
		if (!isOnline || dataSource === 'none') {
			return {
				label: isOnline ? 'Retry source' : 'Offline',
				onClick: onRetrySource,
				disabled: !isOnline,
				variant: 'outline' as const,
				helper: isOnline ? 'Try loading teaching load data again.' : 'Reconnect before retrying.',
			};
		}
		return {
			label: 'Suggest Teaching Load draft',
			onClick: onAutoFillClick,
			disabled: autoFillLoading || !autoFillEnabled,
			variant: 'secondary' as const,
			helper: autoFillEnabled ? 'Preview ATLAS suggestions before any Teaching Load rows are saved.' : 'Suggestions need live writable data.',
		};
	}, [activeDraftCount, autoFillEnabled, autoFillLoading, dataSource, isOnline, isWorkspaceWritable, onAutoFillClick, onRetrySource, onSave, saving]);

	const showReviewBadge = useMemo(() => {
		if (!splitBrainIncident) return false;
		if (splitBrainIncident.quarantine.required) return true;
		if (splitBrainIncident.counters.truthRowsToUpdate > 0) return true;
		if ((splitBrainIncident.counters.integrityMissingOwnershipPairs ?? 0) > 0) return true;
		if ((splitBrainIncident.counters.integrityOwnershipWithoutScopePairs ?? 0) > 0) return true;
		if (reviewDismissed) return false;
		return splitBrainIncident.quarantine.severity === 'WARNING';
	}, [splitBrainIncident, reviewDismissed]);

	// State-driven alert chip: surfaces only when something needs attention.
	// Priority: split-brain review > above-weekly-maximum classes (generation blocker) > temporary teacher placeholders.
	const alertChip = useMemo(() => {
		if (showReviewBadge) {
			const isLocked = splitBrainIncident?.quarantine.required === true;
			return {
				key: 'review',
				label: isLocked ? 'Unlock editing' : 'Review saved coverage',
				tone: 'warning' as const,
				tooltip: isLocked
					? 'Editing is locked. Open the lock recovery dialog to review and unlock.'
					: 'ATLAS detected a mismatch between local assignments and saved coverage. Review before continuing.',
				onClick: isLocked ? onReconcileClick : onViewStaffingNeedsClick,
				disabled: isLocked ? (reconcileLoading || !reconcileEnabled) : staffingNeedsLoading,
				testId: isLocked ? 'teaching-load-alert-unlock-editing' : 'teaching-load-alert-review-coverage',
			};
		}
		if (overCapCount > 0) {
			return {
				key: 'overcap',
				label: `Above weekly max: ${overCapCount}`,
				tone: 'danger' as const,
				tooltip: 'Active teachers above the weekly maximum. Move classes before generating.',
				onClick: onViewStaffingNeedsClick,
				disabled: staffingNeedsLoading,
				testId: 'teaching-load-alert-over-cap',
			};
		}
		if (syntheticPlaceholderPairs > 0) {
			return {
				key: 'teacherx',
				label: `Temporary substitutes: ${syntheticPlaceholderPairs}`,
				tone: 'warning' as const,
				tooltip: 'Temporary substitutes are filling load rows. Replace before publishing.',
				onClick: undefined as (() => void) | undefined,
				disabled: false,
				testId: 'teaching-load-alert-teacher-x',
			};
		}
		return null;
	}, [overCapCount, syntheticPlaceholderPairs, showReviewBadge, onViewStaffingNeedsClick, staffingNeedsLoading]);

	return (
		<div className="rounded-xl border border-border/40 bg-background px-2 py-1 shadow-sm" data-testid="teaching-load-command-header">
			{/* Compact workflow guide: keep Teaching Load to one decision row; disclose stats and repair tools through More. */}
			<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto" data-testid="teaching-load-compact-command-header">
				<div className="flex min-w-0 shrink-0 items-center gap-2">
					<h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Teaching Load</h1>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge variant="outline" className="h-6 cursor-help rounded-full border-primary/15 bg-primary/5 px-2 text-xs font-semibold text-primary shadow-none">
								{workspaceStateLabel}
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
							<p className="font-semibold text-foreground">{workspaceStateDescription}</p>
							<p className="mt-1 text-muted-foreground">{workspaceStateNextAction}</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="outline"
								data-source-state={dataSource}
								className="h-6 cursor-help rounded-full border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none"
							>
								<span className={cn('mr-1.5 size-2 rounded-full', statusConfig.color)} />
								{statusConfig.label}
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
							{statusConfig.description}
						</TooltipContent>
					</Tooltip>
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-2">
				<SmartHelpTrigger
					title="How to use Teaching Load"
					description="Use this page to build and review which teacher owns each subject-section load before timetable generation."
					steps={[
						{
							title: 'Start with the repair queue',
							body: 'ATLAS puts missing load, overloads, placeholders, and unsaved draft work in the order scheduler officers should fix them.',
						},
						{
							title: 'Preview suggestions first',
							body: 'Suggest Teaching Load draft shows what ATLAS can fill before anything becomes final.',
						},
						{
							title: 'Use Advanced grid only when needed',
							body: 'Dense teacher and section grids stay available for expert repair, but they should not be your first stop.',
						},
						{
							title: 'Save only after review',
							body: 'Draft changes stay visible near the action bar so you can save, undo, or discard with a clear status message.',
						},
					]}
					triggerLabel="Help"
					className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
				/>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant={primaryAction.variant}
							size="sm"
							onClick={primaryAction.onClick}
							disabled={primaryAction.disabled}
							data-testid={primaryAction.label === 'Suggest Teaching Load draft' ? 'teaching-load-suggest-draft-action' : undefined}
							className="h-7 gap-1.5 border border-primary/20 bg-primary/5 px-2 text-xs font-bold uppercase tracking-tight text-primary shadow-sm transition-all hover:bg-primary/10 sm:px-3"
						>
							{activeDraftCount > 0 ? <Activity className="size-4" /> : <Zap className="size-4" />}
							{primaryAction.label}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
						{primaryAction.helper}
					</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon-sm" className="h-7 w-7 shadow-sm" aria-label="More Teaching Load tools">
									<Settings2 className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-64 p-2">
								<DropdownMenuItem onSelect={onViewStaffingNeedsClick} disabled={staffingNeedsLoading} className="gap-2 font-semibold">
									<ChartColumn className="size-4" />
									Open staffing audit
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={onToggleJumpList} className="gap-2 font-semibold">
									<Users className="size-4" />
									{showJumpList ? 'Hide teacher jump list' : 'Show teacher jump list'}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">View mode</DropdownMenuLabel>
								<DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')}>
									<DropdownMenuRadioItem value="teacher" className="cursor-pointer py-2 text-xs font-bold uppercase tracking-tight">
										Teacher view
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="allocation" className="cursor-pointer py-2 text-xs font-bold uppercase tracking-tight">
										Section view
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							{showReconcileAction && (
								<DropdownMenuItem onSelect={onReconcileClick} disabled={reconcileLoading || !reconcileEnabled} className="gap-2 font-semibold text-amber-800">
									<Layers className="size-4" />
									{reconcileLoading ? 'Unlocking...' : splitBrainQuarantineRequired ? 'Review and unlock editing' : 'Reconcile saved coverage'}
								</DropdownMenuItem>
							)}
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Staffing mode</DropdownMenuLabel>
								<DropdownMenuRadioGroup value={coverageMode} onValueChange={(v) => onCoverageModeChange(v as CoverageMode)}>
									{Object.entries(coverageModeConfig || {}).map(([mode, config]) => (
										<DropdownMenuRadioItem key={mode} value={mode} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
											<span className="text-xs font-bold uppercase tracking-tight">{config.label}</span>
											<span className="text-xs text-muted-foreground font-medium leading-tight">{config.description}</span>
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Maintenance</DropdownMenuLabel>
								<DropdownMenuItem
									onSelect={onGlobalResetClick}
									disabled={!canRunGlobalReset}
									className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer py-2"
								>
									<RotateCcw className="size-4 mr-2" />
									<div className="flex flex-col gap-0.5">
										<span className="text-xs font-bold uppercase tracking-tight">Global Reset</span>
										<span className="text-xs opacity-80">Wipe all assignments for this year</span>
									</div>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="text-xs font-bold">More teaching-load tools</TooltipContent>
				</Tooltip>

				</div>
			</div>

			{/* Readiness strip: at-a-glance health below the command row.
				% staffed (always) + Unassigned pairs (always, prominent) + state-driven alert chip. */}
			<div className="mt-1.5 hidden min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5 sm:flex" data-testid="teaching-load-readiness-strip">
				<div
					className={cn(
						'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm',
						STRIP_TONE[completenessPercent === 100 ? 'success' : 'warning'],
					)}
				>
					<span className="text-[0.65rem] uppercase tracking-wide opacity-75">% staffed</span>
					<span className="text-sm font-bold tabular-nums">{completenessPercent}%</span>
				</div>

				<div
					className={cn(
						'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm',
						STRIP_TONE[unassignedPairs > 0 ? 'warning' : 'success'],
					)}
				>
					<span className="text-[0.65rem] uppercase tracking-wide opacity-75">Unassigned pairs</span>
					<span className="text-sm font-bold tabular-nums">{unassignedPairs}</span>
				</div>

{alertChip ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="outline"
							data-testid={alertChip.testId}
							data-alert-key={alertChip.key}
							onClick={alertChip.onClick}
							disabled={alertChip.disabled}
							aria-label={alertChip.label}
							className={cn(
								'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm transition-colors',
								STRIP_TONE[alertChip.tone],
								alertChip.onClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
							)}
						>
							{alertChip.key === 'review' ? <Layers className="size-3.5" /> : alertChip.key === 'overcap' ? <Activity className="size-3.5" /> : <Users className="size-3.5" />}
							<span className="text-sm font-bold">{alertChip.label}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-64 text-xs leading-relaxed">
						{alertChip.tooltip}
					</TooltipContent>
				</Tooltip>
			) : null}
			</div>

			<p className="sr-only">
				<span className="font-semibold text-foreground">Next:</span> {workspaceStateNextAction}
			</p>
			<p className="sr-only" aria-live="polite" data-testid="teaching-load-source-truth-summary">
				{statusConfig.label}. {statusConfig.description}
			</p>
		</div>
	);
}
