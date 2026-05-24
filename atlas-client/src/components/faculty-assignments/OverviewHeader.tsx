import { useMemo } from 'react';
import { ChartColumn, Zap, Layers, Users, Info } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';

type OverviewHeaderProps = {
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	unassignedPairs: number;
	rawUnassignedPairs?: number;
	totalPairs: number;
	assignedFacultyCount: number;
	totalFacultyCount: number;
	activeDraftCount: number;
	autoFillLoading: boolean;
	staffingNeedsLoading: boolean;
	autoFillEnabled: boolean;
	onAutoFillClick: () => void;
	onViewStaffingNeedsClick: () => void;
	viewMode?: string;
	onViewModeChange?: (value: string) => void;
	dataSource?: 'live' | 'cached' | 'none';
	degradedWriteEnabled?: boolean;
	isOnline?: boolean;
};

export function OverviewHeader({
	realAssignedPairs,
	syntheticPlaceholderPairs,
	unassignedPairs,
	totalPairs,
	assignedFacultyCount,
	totalFacultyCount,
	autoFillLoading,
	staffingNeedsLoading,
	autoFillEnabled,
	onAutoFillClick,
	onViewStaffingNeedsClick,
	departmentStats = [],
	viewMode = 'assignments',
	onViewModeChange,
	dataSource = 'live',
	degradedWriteEnabled = false,
	isOnline = true,
}: OverviewHeaderProps & { departmentStats?: { name: string; percent: number }[] }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Offline', color: 'bg-muted', description: 'You are currently disconnected. Changes will be saved locally.' };
		if (dataSource === 'live') return { label: 'Synced', color: 'bg-emerald-500 animate-pulse', description: 'Live connection to EnrollPro is active. All data is up to date.' };
		if (degradedWriteEnabled) return { label: 'Independent', color: 'bg-amber-500 animate-pulse', description: 'Upstream is unavailable, but you can continue working using local ATLAS data.' };
		return { label: 'Read-Only', color: 'bg-blue-500', description: 'Viewing last known data. Upstream is unavailable and local evidence is insufficient for writes.' };
	}, [isOnline, dataSource, degradedWriteEnabled]);

	return (
		<div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-border/40 bg-background px-4 py-2 shadow-xs">
			<div className="flex flex-wrap items-center gap-6">
				{/* Workspace Status Badge */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/30 border border-border/50 cursor-help">
							<div className={`size-1.5 rounded-full ${statusConfig.color}`} />
							<span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/80">{statusConfig.label}</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="text-[0.65rem] font-bold max-w-[200px]">
						{statusConfig.description}
					</TooltipContent>
				</Tooltip>

				<div className="h-6 w-px bg-border/40 hidden xl:inline" />

				{/* Coverage & Staffing Truth */}
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-3">
						<div className="flex flex-col">
							<span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Coverage</span>
							<div className="flex items-baseline gap-1.5">
								<span className="text-base font-black tracking-tight">{realAssignedPairs + syntheticPlaceholderPairs}</span>
								<span className="text-[0.65rem] font-bold text-muted-foreground/50">/ {totalPairs}</span>
								<Badge variant="outline" className={`ml-1 h-3.5 px-1 text-[0.55rem] font-black border-none shadow-none ${completenessPercent === 100 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
									{completenessPercent}%
								</Badge>
							</div>
						</div>
						<div className="h-6 w-px bg-border/40" />
						<div className="flex flex-col">
							<span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Unassigned</span>
							<span className={`text-base font-black tabular-nums leading-none ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
								{unassignedPairs}
							</span>
						</div>
					</div>

					<div className="h-8 w-px bg-border/60 mx-1" />

					<div className="flex flex-col">
						<span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Staffing Needs</span>
						<div className="flex items-baseline gap-1.5">
							<span className={`text-base font-black tracking-tight leading-none ${syntheticPlaceholderPairs > 0 ? 'text-violet-600' : 'text-emerald-600'}`}>
								{syntheticPlaceholderPairs > 0 ? `${syntheticPlaceholderPairs} Slots` : 'Zero'}
							</span>
						</div>
					</div>
				</div>

				{/* Workspace View Mode Selector */}
				{onViewModeChange && (
					<div className="flex items-center gap-4">
						<div className="h-8 w-px bg-border/60 mx-1" />
						<div className="flex items-center gap-3">
							<span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground/60 hidden sm:inline">Mode</span>
							<Tabs value={viewMode} onValueChange={onViewModeChange} className="h-7">
								<TabsList className="h-7 p-0.5 bg-muted/40 border border-border/40">
									<TabsTrigger value="assignments" className="h-6 text-[0.6rem] font-bold uppercase px-3 data-[state=active]:bg-background">Work</TabsTrigger>
									<TabsTrigger value="shortage" className="h-6 text-[0.6rem] font-bold uppercase px-3 data-[state=active]:bg-background">Gap</TabsTrigger>
									<TabsTrigger value="utilization" className="h-6 text-[0.6rem] font-bold uppercase px-3 data-[state=active]:bg-background">Load</TabsTrigger>
									<TabsTrigger value="redistribution" className="h-6 text-[0.6rem] font-bold uppercase px-3 data-[state=active]:bg-background">Spec</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>
				)}
			</div>

			{/* Actions Group */}
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onViewStaffingNeedsClick}
					disabled={staffingNeedsLoading || !autoFillEnabled}
					className="h-8 text-[0.65rem] font-bold border-blue-200/50 bg-blue-50/50 text-blue-700 hover:bg-blue-100 shadow-none gap-1.5 px-2.5 uppercase tracking-tight"
				>
					<ChartColumn className="size-3" />
					Audit
				</Button>
				<Button 
					type="button" 
					variant="secondary" 
					size="sm"
					onClick={onAutoFillClick} 
					disabled={autoFillLoading || !autoFillEnabled} 
					className="h-8 text-[0.65rem] font-bold gap-1.5 px-2.5 uppercase tracking-tight shadow-none border border-primary/10"
				>
					<Zap className="size-3" />
					Auto-Fill
				</Button>
			</div>
		</div>
	);
}
