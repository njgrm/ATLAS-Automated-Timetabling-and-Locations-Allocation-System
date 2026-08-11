import { useMemo, type ReactNode } from 'react';
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

// Phase 4.9: compact inline stat chip (dense, not a giant metric card).
function InlineStat({
	label,
	value,
	tone = 'neutral',
	icon,
}: {
	label: string;
	value: string | number;
	tone?: 'neutral' | 'warning' | 'info';
	icon?: ReactNode;
}) {
	const toneClass = {
		neutral: 'border-slate-200 bg-slate-50 text-slate-700',
		warning: 'border-amber-200 bg-amber-50 text-amber-700',
		info: 'border-violet-200 bg-violet-50 text-violet-700',
	}[tone];
	return (
		<div className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm', toneClass)}>
			{icon}
			<span className="text-[0.65rem] uppercase tracking-wide opacity-75">{label}</span>
			<span className="text-sm font-bold tabular-nums">{value}</span>
		</div>
	);
}

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

	// Phase 4.9: plain-language derived figures.
	const overloadCount = faculty.filter(f => !f.isPlaceholder && (f.policyCreditedHours ?? 0) > 30).length;
	const specialProgramSubjects = subjects.filter(s => s.programType != null && s.programType !== 'REGULAR').length;
	const activeFacultyCount = faculty.filter(f => !f.isPlaceholder).length;
	const substituteCount = coverageTotals?.syntheticPlaceholderPairs ?? 0;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
				<SheetHeader className="pb-6 border-b border-border/50">
					<div className="flex items-center gap-2 mb-2">
						<Activity className="size-5 text-primary" />
						{/* Phase 4.9: "Staffing Health Audit" -> "Staffing summary" */}
						<SheetTitle className="text-xl font-semibold tracking-tight">Staffing summary</SheetTitle>
					</div>
					<SheetDescription className="text-sm font-medium text-muted-foreground">
						Overview of which classes have a teacher assigned for this school year.
					</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-8">
					{!hasCoverageData && (
						<div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center">
							<BookOpen className="mx-auto mb-4 size-10 text-muted-foreground/40" />
							<h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">{coverageStateLabel}</h4>
							<p className="mx-auto mt-2 max-w-sm text-sm font-medium text-muted-foreground">{coverageStateDescription}</p>
							<p className="mx-auto mt-3 max-w-sm text-xs font-semibold text-primary">{workspaceStateLabel}: {workspaceStateNextAction}</p>
						</div>
					)}

					{/* Phase 4.9: dense inline stat banner replaces the 2-col metric cards. */}
					<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
						<InlineStat
							label="Staffed"
							value={`${coverageTotals?.assignedPairs ?? 0}/${coverageTotals?.totalPairs ?? 0}`}
							tone={completenessPercent === 100 ? 'neutral' : 'warning'}
							icon={<CheckCircle2 className="size-3.5" />}
						/>
						<InlineStat
							label="Open classes"
							value={unassignedCount}
							tone={unassignedCount > 0 ? 'warning' : 'neutral'}
							icon={<AlertTriangle className="size-3.5" />}
						/>
						<InlineStat
							label="Substitutes"
							value={substituteCount}
							tone={substituteCount > 0 ? 'info' : 'neutral'}
							icon={<Layers className="size-3.5" />}
						/>
					</div>

					{/* Coverage Progress */}
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Overall coverage</h4>
							<Badge variant="outline" className={cn("h-5 font-semibold uppercase tracking-tight", completenessPercent === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
								{completenessPercent}% complete
							</Badge>
						</div>
						<div className="space-y-2">
							<div className="h-3 w-full bg-muted rounded-full overflow-hidden border border-border/20 shadow-inner">
								<div 
									className={cn("h-full transition-all duration-1000", completenessPercent === 100 ? "bg-emerald-500" : "bg-primary")} 
									style={{ width: `${completenessPercent}%` }} 
								/>
							</div>
							<div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
								<span>{coverageTotals?.assignedPairs ?? 0} with a teacher</span>
								<span>{coverageTotals?.totalPairs ?? 0} classes total</span>
							</div>
						</div>
					</section>

					{/* Review Items */}
					<section className="space-y-4">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Needs review</h4>
						<div className="grid gap-3">
							<div className="flex items-center justify-between p-4 rounded-xl border border-amber-100 bg-amber-50/20">
								<div className="flex items-center gap-3">
									<Clock className="size-5 text-amber-600" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Teachers above 30h</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Over the standard</p>
									</div>
								</div>
								<span className="text-lg font-semibold text-amber-700">
									{overloadCount}
								</span>
							</div>

							<div className="flex items-center justify-between p-4 rounded-xl border border-violet-100 bg-violet-50/20">
								<div className="flex items-center gap-3">
									<Star className="size-5 text-violet-600" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Special programs</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SPA, SPS, STE</p>
									</div>
								</div>
								<span className="text-lg font-semibold text-violet-700">
									{specialProgramSubjects}
								</span>
							</div>
						</div>
					</section>

					{/* Roster Capacity */}
					<section className="space-y-4">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Teacher roster</h4>
						<div className="space-y-3">
							<div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/5">
								<div className="flex items-center gap-3">
									<Users className="size-5 text-blue-500" />
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase tracking-tight">Real teachers</p>
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Without substitutes</p>
									</div>
								</div>
								<span className="text-lg font-semibold">{activeFacultyCount}</span>
							</div>
						</div>
					</section>

					{/* Action Guidance */}
					<div className="p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 space-y-4">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 text-primary" />
							<h5 className="text-xs font-semibold uppercase tracking-tight text-primary">Recommended next steps</h5>
						</div>
						<ul className="space-y-3">
							{unassignedCount > 0 ? (
								<li className="flex items-start gap-3">
									<ArrowRight className="size-4 text-primary mt-0.5 shrink-0" />
									<p className="text-xs text-muted-foreground font-medium leading-relaxed">
										Switch to <span className="font-bold text-foreground">by section</span> view to assign teachers to the remaining {unassignedCount} open classes.
									</p>
								</li>
							) : (
								<li className="flex items-start gap-3">
									<ArrowRight className="size-4 text-primary mt-0.5 shrink-0" />
									<p className="text-xs text-muted-foreground font-medium leading-relaxed">
										All classes have a teacher. Review <span className="font-bold text-foreground">teachers above the weekly max</span> to balance load before generating.
									</p>
								</li>
							)}
						</ul>
						{unassignedCount > 0 && onNavigateToAllocation && (
							<Button 
								className="w-full h-10 font-semibold uppercase tracking-wider text-xs mt-2"
								onClick={() => {
									onNavigateToAllocation();
									onOpenChange(false);
								}}
							>
								Assign by section
							</Button>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}