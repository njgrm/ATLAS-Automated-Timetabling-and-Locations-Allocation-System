import { ChartColumn, Zap, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

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
};

export function OverviewHeader({
	realAssignedPairs,
	syntheticPlaceholderPairs,
	unassignedPairs,
	rawUnassignedPairs,
	totalPairs,
	assignedFacultyCount,
	totalFacultyCount,
	activeDraftCount,
	autoFillLoading,
	staffingNeedsLoading,
	autoFillEnabled,
	onAutoFillClick,
	onViewStaffingNeedsClick,
	departmentStats = [],
}: OverviewHeaderProps & { departmentStats?: { name: string; percent: number }[] }) {
	const completenessPercent = totalPairs > 0 ? Math.round(((realAssignedPairs + syntheticPlaceholderPairs) / totalPairs) * 100) : 0;

	return (
		<div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-3 shadow-sm">
			<div className="flex flex-wrap items-center gap-6">
				{/* Completeness Stat */}
				<div className="flex items-center gap-3">
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Contract Coverage</span>
						<div className="flex items-baseline gap-2">
							<span className="text-xl font-bold tracking-tight">{realAssignedPairs + syntheticPlaceholderPairs}</span>
							<span className="text-xs text-muted-foreground">/ {totalPairs}</span>
							<Badge variant="outline" className={`ml-1 h-4 px-1.5 text-[0.6rem] font-bold ${completenessPercent === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
								{completenessPercent}%
							</Badge>
						</div>
					</div>
					<div className="h-8 w-px bg-border/60 mx-1" />
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Unassigned</span>
						<span className={`text-lg font-bold tabular-nums ${unassignedPairs > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
							{unassignedPairs}
						</span>
					</div>
				</div>

				{/* Staffing Stat */}
				<div className="flex items-center gap-3">
					<div className="h-8 w-px bg-border/60 mx-1" />
					<div className="flex flex-col">
						<span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Teacher Load</span>
						<div className="flex items-baseline gap-2">
							<span className="text-lg font-bold tracking-tight">{assignedFacultyCount}</span>
							<span className="text-xs text-muted-foreground">/ {totalFacultyCount} Active</span>
						</div>
					</div>
					{syntheticPlaceholderPairs > 0 && (
						<>
							<div className="h-8 w-px bg-border/60 mx-1" />
							<div className="flex flex-col">
								<span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Synthetic</span>
								<span className="text-lg font-bold text-violet-600">{syntheticPlaceholderPairs}</span>
							</div>
						</>
					)}
				</div>

				{/* Department Progress Mini-Sparkline */}
				{departmentStats.length > 0 && (
					<div className="hidden xl:flex items-center gap-3">
						<div className="h-8 w-px bg-border/60 mx-1" />
						<div className="flex flex-col">
							<span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground mb-1">Dept Progress</span>
							<div className="flex gap-1">
								{departmentStats.map((dept) => (
									<Tooltip key={dept.name}>
										<TooltipTrigger asChild>
											<div className="group relative h-4 w-2 rounded-t-sm bg-muted overflow-hidden">
												<div 
													className="absolute bottom-0 w-full bg-primary/40 group-hover:bg-primary transition-all" 
													style={{ height: `${dept.percent}%` }} 
												/>
											</div>
										</TooltipTrigger>
										<TooltipContent side="top" className="text-[0.7rem] font-bold">
											{dept.name}: {dept.percent}%
										</TooltipContent>
									</Tooltip>
								))}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Actions Row */}
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onViewStaffingNeedsClick}
					disabled={staffingNeedsLoading || !autoFillEnabled}
					className="h-8 text-xs font-bold border-blue-200 bg-blue-50/30 text-blue-700 hover:bg-blue-100 hover:text-blue-800 shadow-none gap-2"
				>
					<ChartColumn className="size-3.5" />
					Staffing Impact
				</Button>
				<Button 
					type="button" 
					variant="secondary" 
					size="sm"
					onClick={onAutoFillClick} 
					disabled={autoFillLoading || !autoFillEnabled} 
					className="h-8 text-xs font-bold gap-2"
				>
					<Zap className="size-3.5" />
					Auto-Fill Remaining
				</Button>
			</div>
		</div>
	);
}
