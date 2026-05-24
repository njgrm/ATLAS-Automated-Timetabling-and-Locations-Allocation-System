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
}: OverviewHeaderProps & { departmentStats?: { name: string; percent: number }[] }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	return (
		<div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-3 shadow-sm">
			<div className="flex flex-wrap items-center gap-6">
				{/* Coverage Truth */}
				<div className="flex items-center gap-3">
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Contract Coverage</span>
						<div className="flex items-baseline gap-2">
							<span className="text-xl font-black tracking-tighter">{realAssignedPairs + syntheticPlaceholderPairs}</span>
							<span className="text-xs font-bold text-muted-foreground/60">/ {totalPairs}</span>
							<Badge variant="outline" className={`ml-1 h-4 px-1.5 text-[0.6rem] font-black border-none shadow-none ${completenessPercent === 100 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
								{completenessPercent}%
							</Badge>
						</div>
					</div>
					<div className="h-8 w-px bg-border/60 mx-1" />
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Unassigned</span>
						<span className={`text-lg font-black tabular-nums ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
							{unassignedPairs}
						</span>
					</div>
				</div>

				{/* Staffing Truth */}
				<div className="flex items-center gap-3">
					<div className="h-8 w-px bg-border/60 mx-1" />
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Staffing Gaps</span>
						<div className="flex items-baseline gap-2">
							<span className={`text-lg font-black tracking-tighter ${syntheticPlaceholderPairs > 0 ? 'text-violet-600' : 'text-emerald-600'}`}>
								{syntheticPlaceholderPairs > 0 ? `${syntheticPlaceholderPairs} Slots` : 'Fully Staffed'}
							</span>
						</div>
					</div>
				</div>

				{/* Workspace View Mode Selector */}
				{onViewModeChange && (
					<div className="flex items-center gap-3">
						<div className="h-8 w-px bg-border/60 mx-1" />
						<div className="flex flex-col">
							<span className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Workspace Mode</span>
							<Tabs value={viewMode} onValueChange={onViewModeChange} className="h-8">
								<TabsList className="h-8 p-0.5 bg-muted/50 border border-border/50">
									<TabsTrigger value="assignments" className="h-7 text-[0.65rem] font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Assignments</TabsTrigger>
									<TabsTrigger value="shortage" className="h-7 text-[0.65rem] font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Shortage</TabsTrigger>
									<TabsTrigger value="utilization" className="h-7 text-[0.65rem] font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Utilization</TabsTrigger>
									<TabsTrigger value="redistribution" className="h-7 text-[0.65rem] font-black uppercase px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Programs</TabsTrigger>
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
					className="h-9 text-[0.7rem] font-black border-blue-200/50 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 shadow-sm gap-2 px-3 uppercase tracking-tight"
				>
					<ChartColumn className="size-3.5" />
					Staffing Audit
				</Button>
				<Button 
					type="button" 
					variant="secondary" 
					size="sm"
					onClick={onAutoFillClick} 
					disabled={autoFillLoading || !autoFillEnabled} 
					className="h-9 text-[0.7rem] font-black gap-2 px-3 uppercase tracking-tight shadow-sm border border-primary/10"
				>
					<Zap className="size-3.5" />
					Auto-Fill Gaps
				</Button>
			</div>
		</div>
	);
}
