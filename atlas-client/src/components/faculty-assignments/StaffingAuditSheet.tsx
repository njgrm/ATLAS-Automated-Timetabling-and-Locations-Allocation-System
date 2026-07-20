import { useMemo } from 'react';
import { 
	Sheet, 
	SheetContent, 
	SheetHeader, 
	SheetTitle, 
	SheetDescription 
} from '@/ui/sheet';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { 
	CheckCircle2, 
	AlertTriangle, 
	Users, 
	BookOpen, 
	Layers, 
	ArrowRight,
	Activity,
	Clock,
	Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FacultySummary, Subject, TeachingLoadCoverageTotals } from '@/types';

type StaffingAuditSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	coverageTotals: TeachingLoadCoverageTotals | null;
	faculty: FacultySummary[];
	subjects: Subject[];
	coverageStateLabel: string;
	coverageStateDescription: string;
	workspaceStateLabel: string;
	workspaceStateNextAction: string;
	onNavigateToAllocation?: () => void;
};

export function StaffingAuditSheet({
	open,
	onOpenChange,
	coverageTotals,
	faculty,
	subjects,
	coverageStateLabel,
	coverageStateDescription,
	workspaceStateLabel,
	workspaceStateNextAction,
	onNavigateToAllocation
}: StaffingAuditSheetProps) {
	const completenessPercent = useMemo(() => {
		if (!coverageTotals || coverageTotals.totalPairs === 0) return 0;
		return Math.round(((coverageTotals.realFacultyAssignedPairs + coverageTotals.syntheticPlaceholderPairs) / coverageTotals.totalPairs) * 100);
	}, [coverageTotals]);

	const unassignedCount = coverageTotals?.unassignedPairs ?? 0;
	const hasCoverageData = Boolean(coverageTotals && coverageTotals.totalPairs > 0);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-100 sm:w-135 overflow-y-auto no-scrollbar">
				<SheetHeader className="pb-6 border-b border-border/50">
					<div className="flex items-center gap-2 mb-2">
						<Activity className="size-5 text-primary" />
						<SheetTitle className="text-xl font-semibold uppercase tracking-tight">Staffing Health Audit</SheetTitle>
					</div>
					<SheetDescription className="text-sm font-medium text-muted-foreground italic">
						Operational report on current school year teaching load coverage.
					</SheetDescription>
				</SheetHeader>

				<div className="py-8 space-y-10">
					{!hasCoverageData && (
						<div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center">
							<BookOpen className="mx-auto mb-4 size-10 text-muted-foreground/40" />
							<h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">{coverageStateLabel}</h4>
							<p className="mx-auto mt-2 max-w-sm text-sm font-medium text-muted-foreground">{coverageStateDescription}</p>
							<p className="mx-auto mt-3 max-w-sm text-xs font-semibold text-primary">{workspaceStateLabel}: {workspaceStateNextAction}</p>
						</div>
					)}
					{/* Coverage Progress */}
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Overall Coverage</h4>
							<Badge variant="outline" className={cn("h-5 font-semibold uppercase tracking-tight", completenessPercent === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
								{completenessPercent}% Complete
							</Badge>
						</div>
						<div className="space-y-2">
							<div className="h-3 w-full bg-muted rounded-full overflow-hidden border border-border/20 shadow-inner">
								<div 
									className={cn("h-full transition-all duration-1000", completenessPercent === 100 ? "bg-emerald-500" : "bg-primary")} 
									style={{ width: `${completenessPercent}%` }} 
								/>
							</div>
							<div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
								<span>{coverageTotals?.assignedPairs ?? 0} Staffed</span>
								<span>{coverageTotals?.totalPairs ?? 0} Total Needs</span>
							</div>
						</div>
					</section>

					{/* Critical Metrics Grid */}
					<div className="grid grid-cols-2 gap-4">
						<div className={cn("p-5 rounded-2xl border transition-all", unassignedCount > 0 ? "bg-rose-50/50 border-rose-100" : "bg-muted/5 border-border/40")}>
							<div className="flex items-center gap-2 mb-3">
								<AlertTriangle className={cn("size-4", unassignedCount > 0 ? "text-rose-500" : "text-muted-foreground/40")} />
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Unassigned</span>
							</div>
							<p className={cn("text-3xl font-semibold tabular-nums tracking-tighter", unassignedCount > 0 ? "text-rose-600" : "text-muted-foreground/40")}>
								{unassignedCount}
							</p>
							<p className="text-xs font-bold text-muted-foreground/60 uppercase mt-1 tracking-tighter">Open Subject-Sections</p>
						</div>

						<div className="p-5 rounded-2xl border border-border/40 bg-muted/5">
							<div className="flex items-center gap-2 mb-3">
								<Layers className="size-4 text-violet-500" />
								<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Temp Roles</span>
							</div>
							<p className="text-3xl font-semibold tabular-nums tracking-tighter text-violet-600">
								{coverageTotals?.syntheticPlaceholderPairs ?? 0}
							</p>
							<p className="text-xs font-bold text-muted-foreground/60 uppercase mt-1 tracking-tighter">Teacher X Assignments</p>
						</div>
					</div>

					{/* Review Items */}
					<section className="space-y-4">
						<h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Review Items</h4>
						<div className="grid gap-3">
							<div className="flex items-center justify-between p-4 rounded-xl border border-amber-100 bg-amber-50/20">
								<div className="flex items-center gap-3">
									<Clock className="size-5 text-amber-600" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Overload Review</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Teachers above 30h</p>
									</div>
								</div>
								<span className="text-lg font-semibold text-amber-700">
									{faculty.filter(f => !f.isPlaceholder && (f.policyCreditedHours ?? 0) > 30).length}
								</span>
							</div>

							<div className="flex items-center justify-between p-4 rounded-xl border border-violet-100 bg-violet-50/20">
								<div className="flex items-center gap-3">
									<Star className="size-5 text-violet-600" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Special Programs</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SPA, SPS, STE Staffing</p>
									</div>
								</div>
								<span className="text-lg font-semibold text-violet-700">
									{subjects.filter(s => s.programType != null && s.programType !== 'REGULAR').length}
								</span>
							</div>
						</div>
					</section>

					{/* Roster Capacity */}
					<section className="space-y-4">
						<h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Roster Capacity</h4>
						<div className="space-y-3">
							<div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/5">
								<div className="flex items-center gap-3">
									<Users className="size-5 text-blue-500" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Active Faculty</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Excluding Placeholders</p>
									</div>
								</div>
								<span className="text-lg font-semibold">{faculty.filter(f => !f.isPlaceholder).length}</span>
							</div>
						</div>
					</section>

					{/* Action Guidance */}
					<div className="p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 space-y-4">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 text-primary" />
							<h5 className="text-xs font-semibold uppercase tracking-tight text-primary">Recommended Next Steps</h5>
						</div>
						<ul className="space-y-3">
							{unassignedCount > 0 ? (
								<li className="flex items-start gap-3">
									<ArrowRight className="size-4 text-primary mt-0.5 shrink-0" />
									<p className="text-xs text-muted-foreground font-medium leading-relaxed">
										Switch to <span className="font-bold text-foreground">Section Allocation</span> mode to staff the remaining {unassignedCount} open sections.
									</p>
								</li>
							) : (
								<li className="flex items-start gap-3">
									<ArrowRight className="size-4 text-primary mt-0.5 shrink-0" />
									<p className="text-xs text-muted-foreground font-medium leading-relaxed">
										All sections are staffed. Review <span className="font-bold text-foreground">Overload States</span> in the Teacher grid to ensure balance.
									</p>
								</li>
							)}
						</ul>
						{unassignedCount > 0 && onNavigateToAllocation && (
							<Button 
								className="w-full h-10 font-semibold uppercase tracking-widest text-xs mt-2"
								onClick={() => {
									onNavigateToAllocation();
									onOpenChange(false);
								}}
							>
								Go to Allocation Workflow
							</Button>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
