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
}: WorkspaceToolbarProps) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Offline', color: 'bg-amber-500', description: 'Disconnected from server. Changes saved locally.' };
		if (dataSource === 'refreshing') return { label: 'Syncing', color: 'bg-blue-500 animate-pulse', description: dataSourceNotice ?? 'Verifying live data...' };
		if (dataSource === 'live') return { label: 'Verified Live', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'Freshly verified. Changes synced immediately.' };
		if (isWorkspaceWritable) return { label: 'Saved Data', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS-owned runtime evidence is writable while upstream-backed verification is unavailable.' };
		if (degradedWriteEnabled) return { label: 'Saved Data', color: 'bg-amber-500', description: dataSourceNotice ?? 'Using local Section evidence.' };
		return { label: 'Read-Only', color: 'bg-blue-500', description: dataSourceNotice ?? 'Viewing saved snapshot.' };
	}, [isOnline, dataSource, isWorkspaceWritable, degradedWriteEnabled, dataSourceNotice]);

	const showReviewBadge = useMemo(() => {
		if (!splitBrainIncident) return false;
		if (splitBrainIncident.quarantine.required) return false;
		if (splitBrainIncident.counters.truthRowsToUpdate > 0) return false;
		if ((splitBrainIncident.counters.integrityMissingOwnershipPairs ?? 0) > 0) return false;
		if ((splitBrainIncident.counters.integrityOwnershipWithoutScopePairs ?? 0) > 0) return false;
		return splitBrainIncident.quarantine.severity === 'WARNING';
	}, [splitBrainIncident]);

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border border-border/40 bg-background px-5 py-2.5 shadow-md">
			<div className="flex flex-wrap items-center gap-6">
				{/* Runtime Status */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/40 cursor-help shrink-0 hover:bg-muted/30 transition-all">
							<div className={`size-1.5 rounded-full ${statusConfig.color}`} />
							<span className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 leading-none">{statusConfig.label}</span>
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
								<span className="text-xs font-black uppercase tracking-tight">Review Needed</span>
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
							<span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">Total Coverage</span>
							<div className="flex items-baseline gap-1">
								<span className="text-sm font-black tracking-tight leading-none text-primary">{realAssignedPairs + syntheticPlaceholderPairs}</span>
								<span className="text-xs font-bold text-muted-foreground/40">/ {totalPairs}</span>
								<Badge variant="outline" className={`ml-2 h-4 px-1.5 text-xs font-black border-none shadow-none ${completenessPercent === 100 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
									{completenessPercent}%
								</Badge>
							</div>
						</div>
						<div className="h-8 w-px bg-border/20" />
						<div className="flex flex-col">
							<span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">Unassigned</span>
							<span className={`text-sm font-black tabular-nums leading-none ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600/60'}`}>
								{unassignedPairs}
							</span>
						</div>
					</div>
				</div>

				<div className="h-6 w-px bg-border/40 hidden xl:inline" />

				{/* Workspace View Mode */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 hidden sm:inline">Grid Mode</span>
					<Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'teacher' | 'allocation')} className="h-7">
						<TabsList className="h-7 p-0.5 bg-muted/40 border border-border/40">
							<TabsTrigger value="teacher" className="h-6 text-xs font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">By Teacher</TabsTrigger>
							<TabsTrigger value="allocation" className="h-6 text-xs font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Section Allocation</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{showReconcileAction && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onReconcileClick}
						disabled={reconcileLoading || !reconcileEnabled}
						className="h-8 text-xs font-black gap-2 px-3 uppercase tracking-widest border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
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
								<DropdownMenuLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Staffing Mode</DropdownMenuLabel>
								<DropdownMenuRadioGroup value={coverageMode} onValueChange={(v) => onCoverageModeChange(v as CoverageMode)}>
									{Object.entries(coverageModeConfig || {}).map(([mode, config]) => (
										<DropdownMenuRadioItem key={mode} value={mode} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
											<span className="text-xs font-bold uppercase tracking-tight">{config.label}</span>
											<span className="text-xs text-muted-foreground font-medium leading-tight">{config.description}</span>
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
								
								<DropdownMenuSeparator />
								
								<DropdownMenuLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Maintenance</DropdownMenuLabel>
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
					className="h-8 text-xs font-black border-transparent bg-transparent text-primary hover:bg-primary/5 shadow-none gap-2 px-3 uppercase tracking-widest transition-all"
				>
					<ChartColumn className="size-4" />
					Staffing Audit
				</Button>

				<Button 
					type="button" 
					variant="secondary" 
					size="sm"
					onClick={onAutoFillClick} 
					disabled={autoFillLoading || !autoFillEnabled} 
					className="h-8 text-xs font-black gap-2 px-4 uppercase tracking-widest shadow-sm border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all"
				>
					<Zap className="size-4" />
					Auto-Fill
				</Button>
			</div>
		</div>
	);
}
