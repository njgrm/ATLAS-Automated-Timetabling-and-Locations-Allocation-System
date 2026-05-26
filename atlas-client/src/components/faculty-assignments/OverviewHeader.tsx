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
	dataSourceNotice?: string | null;
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
	dataSourceNotice = null,
}: OverviewHeaderProps & { departmentStats?: { name: string; percent: number }[] }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	const statusConfig = useMemo(() => {
		if (!isOnline) return { label: 'Working Offline', color: 'bg-amber-500', description: 'Disconnected from EnrollPro. Changes are saved locally and will sync when you reconnect.' };
		if (dataSource === 'live') return { label: 'Verified Live', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'Freshly verified with EnrollPro. All changes are synced immediately.' };
		if (degradedWriteEnabled) {
			return {
				label: 'Working from Saved Data',
				color: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
				description: dataSourceNotice ?? 'Using ATLAS-saved section evidence while upstream verification is unavailable.',
			};
		}
		return {
			label: 'Viewing Saved Data (Read-Only)',
			color: 'bg-blue-500',
			description: dataSourceNotice ?? 'Viewing ATLAS-saved section evidence in read-only mode.',
		};
	}, [isOnline, dataSource, degradedWriteEnabled, dataSourceNotice]);

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-border/40 bg-background px-3 py-1 shadow-sm">
			<div className="flex flex-wrap items-center gap-4">
				{/* Workspace Status Badge */}
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/20 border border-border/40 cursor-help shrink-0 hover:bg-muted/30 transition-colors">
							<div className={`size-1 rounded-full ${statusConfig.color}`} />
							<span className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">{statusConfig.label}</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="text-[0.65rem] font-semibold max-w-[250px] p-2.5">
						{statusConfig.description}
					</TooltipContent>
				</Tooltip>

				<div className="h-5 w-px bg-border/40 hidden xl:inline" />

				{/* Coverage & Staffing Truth */}
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/50 leading-none">Coverage</span>
							<div className="flex items-baseline gap-0.5">
								<span className="text-[0.8rem] font-bold tracking-tight leading-none">{realAssignedPairs + syntheticPlaceholderPairs}</span>
								<span className="text-[0.55rem] font-semibold text-muted-foreground/40">/ {totalPairs}</span>
								<Badge variant="outline" className={`ml-1 h-3 px-1 text-[0.5rem] font-bold border-none shadow-none ${completenessPercent === 100 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
									{completenessPercent}%
								</Badge>
							</div>
						</div>
						<div className="h-4 w-px bg-border/30" />
						<div className="flex items-center gap-2">
							<span className="text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/50 leading-none">Unassigned</span>
							<span className={`text-[0.8rem] font-bold tabular-nums leading-none ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
								{unassignedPairs}
							</span>
						</div>
					</div>

					<div className="h-6 w-px bg-border/40 mx-0.5" />

					<div className="flex items-center gap-2">
						<span className="text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/50 leading-none">Temp Roles</span>
						<span className={`text-[0.8rem] font-bold tracking-tight leading-none ${syntheticPlaceholderPairs > 0 ? 'text-violet-600' : 'text-emerald-600/60'}`}>
							{syntheticPlaceholderPairs > 0 ? syntheticPlaceholderPairs : '0'}
						</span>
					</div>
				</div>

				{/* Workspace View Mode Selector */}
				{onViewModeChange && (
					<div className="flex items-center gap-3">
						<div className="h-6 w-px bg-border/40 mx-0.5" />
						<div className="flex items-center gap-2">
							<span className="text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/50 hidden sm:inline">View</span>
							<Tabs value={viewMode} onValueChange={onViewModeChange} className="h-6">
								<TabsList className="h-6 p-0.5 bg-muted/40 border border-border/40">
									<TabsTrigger value="assignments" className="h-5 text-[0.55rem] font-bold uppercase px-2 data-[state=active]:bg-background">Assign</TabsTrigger>
									<TabsTrigger value="shortage" className="h-5 text-[0.55rem] font-bold uppercase px-2 data-[state=active]:bg-background">Shortage</TabsTrigger>
									<TabsTrigger value="utilization" className="h-5 text-[0.55rem] font-bold uppercase px-2 data-[state=active]:bg-background">Teachers</TabsTrigger>
									<TabsTrigger value="redistribution" className="h-5 text-[0.55rem] font-bold uppercase px-2 data-[state=active]:bg-background">Special</TabsTrigger>
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
					variant="ghost"
					size="sm"
					onClick={onViewStaffingNeedsClick}
					disabled={staffingNeedsLoading || !autoFillEnabled}
					className="h-7 text-[0.6rem] font-bold border-transparent bg-transparent text-blue-700 hover:bg-blue-50 hover:text-blue-800 shadow-none gap-1.5 px-2.5 uppercase tracking-tight"
				>
					<ChartColumn className="size-3" />
					Shortage Audit
				</Button>
				<Button 
					type="button" 
					variant="secondary" 
					size="sm"
					onClick={onAutoFillClick} 
					disabled={autoFillLoading || !autoFillEnabled} 
					className="h-7 text-[0.6rem] font-bold gap-1.5 px-2.5 uppercase tracking-tight shadow-sm border border-primary/10 bg-primary/5 text-primary hover:bg-primary/10 transition-all"
				>
					<Zap className="size-3" />
					Auto-Fill
				</Button>
			</div>
		</div>
	);
}
