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
			label: 'Preview auto-fill',
			onClick: onAutoFillClick,
			disabled: autoFillLoading || !autoFillEnabled,
			variant: 'secondary' as const,
			helper: autoFillEnabled ? 'Review automated assignment help before applying it.' : 'Auto-fill needs live writable data.',
		};
	}, [activeDraftCount, autoFillEnabled, autoFillLoading, dataSource, isOnline, isWorkspaceWritable, onAutoFillClick, onRetrySource, onSave, saving]);

	const showReviewBadge = useMemo(() => {
		if (reviewDismissed) return false;
		if (!splitBrainIncident) return false;
		if (splitBrainIncident.quarantine.required) return false;
		if (splitBrainIncident.counters.truthRowsToUpdate > 0) return false;
		if ((splitBrainIncident.counters.integrityMissingOwnershipPairs ?? 0) > 0) return false;
		if ((splitBrainIncident.counters.integrityOwnershipWithoutScopePairs ?? 0) > 0) return false;
		return splitBrainIncident.quarantine.severity === 'WARNING';
	}, [splitBrainIncident, reviewDismissed]);

	return (
		<div className="rounded-2xl border border-border/40 bg-background px-5 py-3 shadow-md space-y-3">
			<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
				<div className="min-w-60 space-y-1">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-xl font-semibold tracking-tight text-foreground">Teaching Load</h1>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge variant="outline" className="h-5 cursor-help rounded-full border-primary/15 bg-primary/5 px-2 text-xs font-semibold text-primary shadow-none">
									{workspaceStateLabel}
								</Badge>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
								<p className="font-semibold text-foreground">{workspaceStateDescription}</p>
								<p className="mt-1 text-muted-foreground">{workspaceStateNextAction}</p>
							</TooltipContent>
						</Tooltip>
					</div>
					<p className="text-sm font-medium text-muted-foreground">Assign subjects and sections to teachers before generation.</p>
				</div>

				<div className="flex flex-wrap items-center gap-6">
				{/* Runtime Status */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/40 cursor-help shrink-0 hover:bg-muted/30 transition-all">
							<div className={`size-1.5 rounded-full ${statusConfig.color}`} />
							<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80 leading-none">{statusConfig.label}</span>
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
								className="h-8 px-3 gap-2 bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-all"
							>
								<Info className="size-4" />
								<span className="text-xs font-semibold uppercase tracking-tight">Review Needed</span>
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

				<div className="h-6 w-px bg-border/40 hidden xl:inline" />

				{/* Coverage Stats */}
				<div className="flex items-center gap-5">
					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">{hasCoverageUniverse ? 'Staffed coverage' : coverageStateLabel}</span>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-72 p-3 text-xs font-medium leading-relaxed">
									{coverageStateDescription}
								</TooltipContent>
							</Tooltip>
							<div className="flex items-baseline gap-1">
								<span className="text-sm font-semibold tracking-tight leading-none text-primary">{assignedPairs}</span>
								<span className="text-xs font-bold text-muted-foreground/40">/ {totalPairs}</span>
								<Badge variant="outline" className={`ml-2 h-4 px-1.5 text-xs font-semibold border-none shadow-none ${completenessPercent === 100 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
									{completenessPercent}%
								</Badge>
							</div>
						</div>
						{syntheticPlaceholderPairs > 0 && (
							<div className="h-8 w-px bg-border/20" />
						)}
						{syntheticPlaceholderPairs > 0 && (
							<div className="flex flex-col">
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">Teacher X</span>
								<span className="text-sm font-semibold tabular-nums leading-none text-violet-600">{syntheticPlaceholderPairs}</span>
							</div>
						)}
						<div className="h-8 w-px bg-border/20" />
						<div className="flex flex-col">
							<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">Unassigned</span>
							<span className={`text-sm font-semibold tabular-nums leading-none ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600/60'}`}>
								{unassignedPairs}
							</span>
						</div>
					</div>
				</div>

				<div className="h-6 w-px bg-border/40 hidden xl:inline" />

				{/* Workspace View Mode */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 hidden sm:inline">Work mode</span>
					<Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')} className="h-7">
						<TabsList className="h-7 p-0.5 bg-muted/40 border border-border/40">
							<Tooltip>
								<TooltipTrigger asChild>
									<TabsTrigger value="teacher" className="h-6 text-xs font-semibold uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">By teacher</TabsTrigger>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
									Inspect and adjust one teacher at a time.
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<TabsTrigger value="allocation" className="h-6 text-xs font-semibold uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Section allocation</TabsTrigger>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="max-w-62.5 text-xs font-semibold">
									Fill section coverage gaps by subject.
								</TooltipContent>
							</Tooltip>
						</TabsList>
					</Tabs>
				</div>
				</div>
			</div>

			{/* Step Wizard Workflow */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/35 pt-3.5">
				{/* Step 1 */}
				<button 
					type="button"
					onClick={onViewStaffingNeedsClick}
					disabled={staffingNeedsLoading}
					className="group flex items-center gap-3 text-left hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-muted/20 hover:bg-muted/40 p-2 rounded-xl border border-border/30"
				>
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
						1
					</div>
					<div className="min-w-0">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-all leading-none">Step 1</p>
						<p className="text-xs font-semibold text-foreground truncate mt-1">Check Staffing Needs</p>
					</div>
				</button>
				
				{/* Step 2 */}
				<button 
					type="button"
					onClick={onAutoFillClick}
					disabled={autoFillLoading || !autoFillEnabled}
					className="group flex items-center gap-3 text-left hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-muted/20 hover:bg-muted/40 p-2 rounded-xl border border-border/30"
				>
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
						2
					</div>
					<div className="min-w-0">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-all leading-none">Step 2</p>
						<p className="text-xs font-semibold text-foreground truncate mt-1">Auto-Fill Base Load</p>
					</div>
				</button>

				{/* Step 3 */}
				<div className="flex items-center gap-3 text-left bg-emerald-50/20 p-2 rounded-xl border border-emerald-200/30">
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-700">
						3
					</div>
					<div className="min-w-0">
						<p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 leading-none">Step 3</p>
						<p className="text-xs font-semibold text-foreground truncate mt-1">Manual Fine-Tuning</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-3">
				<p className="text-xs font-medium text-muted-foreground">
					<span className="font-semibold text-foreground">Next:</span> {workspaceStateNextAction}
				</p>
				<div className="flex items-center gap-3">
				{showReconcileAction && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onReconcileClick}
						disabled={reconcileLoading || !reconcileEnabled}
						className="h-8 text-xs font-semibold gap-2 px-3 uppercase tracking-widest border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
					>
						<Layers className="size-4" />
						{reconcileLoading ? 'Reconciling...' : 'Reconcile Saved Coverage'}
					</Button>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon-sm" className="h-8 w-8 shadow-sm">
									<Settings2 className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-64 p-2">
								<DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Staffing Mode</DropdownMenuLabel>
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
					<TooltipContent side="bottom" className="text-xs font-bold">Workspace settings</TooltipContent>
				</Tooltip>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onViewStaffingNeedsClick}
					className="h-8 text-xs font-semibold border-transparent bg-transparent text-primary hover:bg-primary/5 shadow-none gap-2 px-3 uppercase tracking-widest transition-all"
				>
					<ChartColumn className="size-4" />
					Staffing audit
				</Button>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant={primaryAction.variant}
							size="sm"
							onClick={primaryAction.onClick}
							disabled={primaryAction.disabled}
							className="h-8 text-xs font-semibold gap-2 px-4 uppercase tracking-widest shadow-sm border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all"
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
		</div>
	);
}
