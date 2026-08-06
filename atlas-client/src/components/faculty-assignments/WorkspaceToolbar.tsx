import { useMemo } from 'react';
import { ChartColumn, Zap, Layers, Users, Info, Activity, Settings2, RotateCcw } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TeachingLoadSplitBrainReconcileResult, CoverageMode } from '@/types';

type WorkspaceToolbarProps = {
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	unassignedPairs: number;
	totalPairs: number;
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
	coverageStateLabel: string;
	coverageStateDescription: string;
	activeDraftCount: number;
	saving: boolean;
	onSave: () => void;
	onRetrySource: () => void;
};

export function WorkspaceToolbar({
	realAssignedPairs,
	syntheticPlaceholderPairs,
	unassignedPairs,
	totalPairs,
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
	coverageStateLabel,
	coverageStateDescription,
	activeDraftCount,
	saving,
	onSave,
	onRetrySource,
}: WorkspaceToolbarProps & { reviewDismissed?: boolean }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;
	const hasCoverageUniverse = totalPairs > 0;
	const assignedPairs = realAssignedPairs + syntheticPlaceholderPairs;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Offline', color: 'bg-amber-500', description: 'Disconnected from the server. Changes are locked until ATLAS reconnects.' };
		if (dataSource === 'refreshing') return { label: 'Checking source', color: 'bg-blue-500 animate-pulse', description: dataSourceNotice ?? 'Verifying live data before edits continue.' };
		if (dataSource === 'live') return { label: 'Verified live', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'Freshly verified. Draft changes can be saved.' };
		if (isWorkspaceWritable) return { label: 'Using saved data', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS-owned runtime evidence is writable while upstream-backed verification is unavailable.' };
		if (degradedWriteEnabled) return { label: 'Using saved data', color: 'bg-amber-500', description: dataSourceNotice ?? 'Using local Section evidence.' };
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

	return (
		<div className="rounded-xl border border-border/40 bg-background px-2.5 py-1.5 shadow-sm" data-testid="teaching-load-command-header">
			{/* Compact workflow guide: keep Teaching Load to one decision row; disclose stats and repair tools through More. */}
			<div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
				<div className="flex min-w-0 shrink-0 items-center gap-2">
					<h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Teaching Load</h1>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge variant="outline" className="h-7 cursor-help rounded-full border-primary/15 bg-primary/5 px-2 text-xs font-semibold text-primary shadow-none">
								{workspaceStateLabel}
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
							<p className="font-semibold text-foreground">{workspaceStateDescription}</p>
							<p className="mt-1 text-muted-foreground">{workspaceStateNextAction}</p>
						</TooltipContent>
					</Tooltip>
				</div>

				<p
					data-testid="teaching-load-source-truth-summary"
					className="hidden max-w-sm shrink truncate text-xs font-medium text-muted-foreground xl:block"
				>
					Source truth: {statusConfig.description}
				</p>

				<div className="ml-auto flex shrink-0 items-center gap-2">
				{/* Runtime Status */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className="flex h-8 items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 transition-all hover:bg-muted/30"
							data-source-state={dataSource}
							aria-label={`${statusConfig.label}. ${statusConfig.description}`}
						>
							<div className={`size-1.5 rounded-full ${statusConfig.color}`} />
							<span className="text-xs font-bold uppercase tracking-tight text-muted-foreground/80 leading-none">{statusConfig.label}</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-62.5 p-2.5 text-xs font-semibold">
						{statusConfig.description}
					</TooltipContent>
				</Tooltip>

				{showReviewBadge && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={onViewStaffingNeedsClick}
								className="h-8 gap-2 border border-amber-100 bg-amber-50 px-2.5 text-amber-700 transition-all hover:bg-amber-100"
							>
								<Info className="size-4" />
								<span className="text-xs font-bold uppercase tracking-tight">Review</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-50 text-xs font-bold">
							{splitBrainIncident?.quarantine.message}
							<div className="mt-1 flex items-center gap-2 opacity-70">
								<span>{splitBrainIncident?.counters.loadReviewRows ?? 0} Overloads</span>
							</div>
						</TooltipContent>
					</Tooltip>
				)}

				{/* Workspace View Mode */}
				<div className="flex items-center gap-3">
					<Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')} className="h-7">
						<TabsList className="h-7 p-0.5 bg-muted/40 border border-border/40">
							<Tooltip>
								<TooltipTrigger asChild>
									<TabsTrigger value="teacher" className="h-6 px-2 text-xs font-semibold uppercase data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-3">Teacher</TabsTrigger>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
									Inspect and adjust one teacher at a time.
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<TabsTrigger value="allocation" className="h-6 px-2 text-xs font-semibold uppercase data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-3">Sections</TabsTrigger>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
									Fill section coverage gaps by subject.
								</TooltipContent>
							</Tooltip>
						</TabsList>
					</Tabs>
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon-sm" className="h-8 w-8 shadow-sm" aria-label="More Teaching Load tools">
									<Settings2 className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-64 p-2">
								<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Coverage snapshot</DropdownMenuLabel>
								<div className="grid gap-1 px-2 py-1 text-xs">
									<p className="font-semibold text-foreground">{hasCoverageUniverse ? 'Staffed coverage' : coverageStateLabel}</p>
									<p className="text-muted-foreground">{coverageStateDescription}</p>
									<div className="mt-1 flex flex-wrap gap-1.5">
										<Badge variant="outline" className={cn('h-6', completenessPercent === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>{completenessPercent}% staffed</Badge>
										<Badge variant="outline" className="h-6">{assignedPairs}/{totalPairs} pairs</Badge>
										{syntheticPlaceholderPairs > 0 && <Badge variant="outline" className="h-6 border-violet-200 bg-violet-50 text-violet-700">{syntheticPlaceholderPairs} Teacher X</Badge>}
										<Badge variant="outline" className={cn('h-6', unassignedPairs > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{unassignedPairs} unassigned</Badge>
									</div>
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={onViewStaffingNeedsClick} disabled={staffingNeedsLoading} className="gap-2 font-semibold">
									<ChartColumn className="size-4" />
									Open staffing audit
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={onToggleJumpList} className="gap-2 font-semibold">
									<Users className="size-4" />
									{showJumpList ? 'Hide teacher jump list' : 'Show teacher jump list'}
								</DropdownMenuItem>
								{showReconcileAction && (
									<DropdownMenuItem onSelect={onReconcileClick} disabled={reconcileLoading || !reconcileEnabled} className="gap-2 font-semibold text-amber-800">
										<Layers className="size-4" />
										{reconcileLoading ? 'Reconciling...' : 'Reconcile saved coverage'}
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

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant={primaryAction.variant}
							size="sm"
							onClick={primaryAction.onClick}
							disabled={primaryAction.disabled}
							data-testid={primaryAction.label === 'Suggest Teaching Load draft' ? 'teaching-load-suggest-draft-action' : undefined}
							className="h-8 gap-2 border border-primary/20 bg-primary/5 px-3 text-xs font-bold uppercase tracking-tight text-primary shadow-sm transition-all hover:bg-primary/10 sm:px-4"
						>
							{activeDraftCount > 0 ? <Activity className="size-4" /> : <Zap className="size-4" />}
							{primaryAction.label}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
						{primaryAction.helper}
					</TooltipContent>
				</Tooltip>

				</div>
			</div>
			<p className="sr-only">
				<span className="font-semibold text-foreground">Next:</span> {workspaceStateNextAction}
			</p>
			<p className="sr-only" aria-live="polite">
				{statusConfig.label}. {statusConfig.description}
			</p>
		</div>
	);
}
