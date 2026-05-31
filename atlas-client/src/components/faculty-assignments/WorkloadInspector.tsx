import { 
	Star, 
	AlertTriangle, 
	Info, 
	Layers, 
	RotateCcw, 
	BookOpen,
	TrendingDown,
	CheckCircle2,
	Clock,
	Users,
	Layout
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FacultySummary, LoadProfile, RotationFamilyTermBreakdown } from '@/types';
import { gradeLabel } from '@/lib/grade-labels';

type WorkloadInspectorProps = {
	selected: FacultySummary | null;
	loadProfile: LoadProfile | null;
	rotationTermBreakdown: RotationFamilyTermBreakdown[];
	hoveredIncomingMinutes: number;
	previewLoadHours: number;
	isReadOnlyMode: boolean;
	writeBlockedReason?: string | null;
	onClose?: () => void;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; icon: any }> = {
	'below-standard': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: TrendingDown },
	compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
	'overload-allowed': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle },
	'over-cap': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertTriangle },
};

export function WorkloadInspector({
	selected,
	loadProfile,
	rotationTermBreakdown,
	hoveredIncomingMinutes,
	previewLoadHours,
	isReadOnlyMode,
	writeBlockedReason,
	onClose
}: WorkloadInspectorProps) {
	if (!selected || !loadProfile) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/5">
				<div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
					<Users className="size-6 text-muted-foreground/40" />
				</div>
				<p className="text-sm font-semibold text-muted-foreground">Select a teacher to inspect workload.</p>
				<p className="mt-2 text-xs font-medium text-muted-foreground/70">Use By teacher mode to review assignments, capacity, and the next safe action for one teacher.</p>
			</div>
		);
	}

	const status = STATUS_COLORS[loadProfile.status] || STATUS_COLORS['compliant'];

	return (
		<div className="flex h-full flex-col bg-background border-l border-border/50">
			<div className="shrink-0 p-6 border-b border-border/40 space-y-4">
				{isReadOnlyMode && writeBlockedReason && (
					<div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-amber-900">
						<p className="text-xs font-semibold uppercase tracking-widest">Read-only mode</p>
						<p className="mt-1 text-xs font-medium text-amber-800/80">{writeBlockedReason}</p>
					</div>
				)}
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Teacher Workload</h3>
					<Badge variant="outline" className={cn("h-5 font-semibold uppercase tracking-tighter shadow-none text-xs whitespace-nowrap", status.bg, status.text, status.border)}>
						{loadProfile.statusLabel}
					</Badge>
				</div>

				<div className="flex items-center gap-4">
					<div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary border border-primary/20 relative">
						{selected.firstName[0]}{selected.lastName[0]}
						{selected.isClassAdviser && (
							<div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shadow-sm">
								<Star className="size-3 text-amber-600 fill-amber-600" />
							</div>
						)}
					</div>
					<div className="min-w-0">
						<h4 className="text-base font-semibold uppercase tracking-tight truncate leading-tight">
							{selected.lastName}, {selected.firstName}
						</h4>
						<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">
							{selected.department || 'No Department'}
						</p>
					</div>
				</div>

				{selected.isClassAdviser && (
					<div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 flex items-center gap-3">
						<div className="size-7 rounded-md bg-amber-100 flex items-center justify-center border border-amber-200 shadow-sm">
							<Star className="size-3.5 text-amber-600 fill-amber-600" />
						</div>
						<div className="min-w-0">
							<p className="text-xs font-semibold text-amber-800/60 uppercase tracking-widest leading-none mb-1">Advisory Assignment</p>
							<p className="text-sm font-semibold text-amber-900 uppercase truncate">
								{selected.advisedSectionName || 'Section Unassigned'}
							</p>
						</div>
					</div>
				)}
			</div>

			<div className="flex-1 overflow-auto p-6 space-y-8 no-scrollbar">
				{/* Capacity Gauge */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Weekly Capacity</span>
						<span className="text-sm font-semibold tabular-nums">{loadProfile.creditedTotalHours} / {selected.maxHoursPerWeek}h</span>
					</div>
					<div className="space-y-2">
						<div className="h-2 w-full bg-muted border border-border/20 shadow-inner rounded-full overflow-hidden">
							<div 
								className="h-full bg-primary transition-all duration-500" 
								style={{ width: `${Math.min(100, (loadProfile.creditedTotalHours / selected.maxHoursPerWeek) * 100)}%` }} 
							/>
						</div>
						<div className="flex justify-between items-center text-xs font-semibold uppercase tracking-tighter text-muted-foreground/60">
							<span>0%</span>
							<span>{Math.round((loadProfile.creditedTotalHours / selected.maxHoursPerWeek) * 100)}% Utilized</span>
							<span>100%</span>
						</div>
					</div>
				</section>

				{/* Primary Stats Grid */}
				<div className="grid grid-cols-2 gap-3">
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest block">Credited</span>
						<p className="text-xl font-black tracking-tight tabular-nums">{loadProfile.creditedTotalHours}h</p>
					</div>
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest block">Remaining</span>
						<p className={cn("text-xl font-black tracking-tight tabular-nums", loadProfile.remainingHours < 0 ? 'text-rose-600' : 'text-emerald-600')}>
							{loadProfile.remainingHours.toFixed(1)}h
						</p>
					</div>
				</div>

				{/* Handled Classes Summary */}
				<section className="space-y-4">
					<h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Handled Classes</h5>
					{loadProfile.breakdown.length === 0 ? (
						<div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/5 text-center">
							<p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest italic">No sections assigned yet</p>
						</div>
					) : (
						<div className="space-y-2">
							{loadProfile.breakdown.map((item, idx) => (
								<div key={`${item.subjectId}-${item.sectionId}-${idx}`} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-background shadow-sm">
									<Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold uppercase bg-primary/5 text-primary border-primary/10">
										{item.subjectCode}
									</Badge>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold uppercase truncate leading-tight">{item.sectionName}</p>
										<div className="flex items-center gap-1.5 mt-0.5">
											<span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{gradeLabel(item.gradeLevel)}</span>
											{item.rotationFamily && (
												<>
													<span className="text-muted-foreground/30">•</span>
													<span className="text-xs font-semibold text-violet-600 uppercase tracking-tighter">{item.rotationTermLabel || 'Rotational'}</span>
												</>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Arithmetic Breakdown */}
				<section className="space-y-4">
					<h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Load Arithmetic</h5>
					<div className="space-y-2.5">
						<div className="flex items-center justify-between text-xs font-bold">
							<div className="flex items-center gap-2 text-muted-foreground">
								<BookOpen className="size-4 opacity-40" />
								<span>Total Classes Sum</span>
							</div>
							<span className="tabular-nums">{(loadProfile.rawTeachingHours).toFixed(1)}h</span>
						</div>

						{loadProfile.rotationOvercountHours > 0 && (
							<div className="flex items-center justify-between text-xs font-bold text-violet-700 bg-violet-50/50 p-2 rounded-lg border border-violet-100/50">
								<div className="flex items-center gap-2">
									<Layers className="size-4 opacity-60" />
									<span>Rotation Deduction</span>
								</div>
								<span className="tabular-nums">-{(loadProfile.rotationOvercountHours).toFixed(1)}h</span>
							</div>
						)}

						<div className="flex items-center justify-between text-xs font-bold">
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="size-4 opacity-40" />
								<span>Actual Teaching</span>
							</div>
							<span className="tabular-nums">{(loadProfile.actualTeachingHours).toFixed(1)}h</span>
						</div>

						{loadProfile.equivalentHours > 0 && (
							<div className="flex items-center justify-between text-xs font-bold text-emerald-700">
								<div className="flex items-center gap-2">
									<Star className="size-4 opacity-60" />
									<span>Advisory / Ancillary</span>
								</div>
								<span className="tabular-nums">+{(loadProfile.equivalentHours).toFixed(1)}h</span>
							</div>
						)}

						<div className="pt-2 mt-2 border-t border-dashed border-border/60 flex items-center justify-between">
							<span className="text-sm font-semibold uppercase tracking-tight text-primary">Total Credited</span>
							<span className="text-lg font-semibold tabular-nums text-primary">{loadProfile.creditedTotalHours.toFixed(1)}h</span>
						</div>
					</div>
				</section>

				{/* Rotational Families */}
				{rotationTermBreakdown.length > 0 && (
					<section className="space-y-4">
						<h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Rotational Groups</h5>
						<div className="space-y-4">
							{rotationTermBreakdown.map((family) => (
								<div key={family.family} className="p-4 rounded-xl border border-sky-100 bg-sky-50/20 space-y-4">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<span className="text-xs font-semibold uppercase tracking-widest text-sky-900/40 block leading-none mb-1">Group</span>
											<span className="text-sm font-semibold uppercase tracking-tight text-sky-900 truncate block">{family.family}</span>
										</div>
										<div className="text-right">
											<span className="text-lg font-semibold text-sky-900 tabular-nums leading-none">
												{(family.peakTermMinutesPerWeek / 60).toFixed(1)}h
											</span>
											<span className="text-xs font-bold text-sky-600/70 uppercase tracking-tighter block mt-1">Peak Weekly</span>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-2">
										{[1, 2, 3].map((term) => {
											const bucket = family.termBuckets.find(b => b.termRank === term);
											const isPeak = bucket?.isPeakTerm ?? false;
											return (
												<div
													key={term}
													className={cn(
														"rounded-lg border p-2 flex flex-col items-center gap-0.5 transition-all",
														isPeak 
															? "border-sky-300 bg-white ring-2 ring-sky-300/10 shadow-sm" 
															: "border-sky-100 bg-sky-50/50 opacity-60"
													)}
												>
													<span className={cn("text-xs font-semibold uppercase tracking-widest", isPeak ? "text-sky-900" : "text-sky-700/60")}>
														T{term}
													</span>
													<div className={cn("text-xs font-semibold tabular-nums leading-none", isPeak ? "text-sky-800" : "text-sky-700/60")}>
														{bucket ? `${(bucket.creditedMinutesPerWeek / 60).toFixed(1)}h` : '0.0h'}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Guidance */}
				<div className="p-4 rounded-xl border border-dashed border-border bg-muted/20">
					<h6 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
						<Info className="size-4" />
						Scheduling Guidance
					</h6>
					<p className="text-sm text-muted-foreground/80 font-medium leading-relaxed italic">
						{loadProfile.status === 'over-cap' 
							? "This teacher exceeds the 40h legal limit. Reduce their assignments immediately to ensure timetable feasibility."
							: loadProfile.status === 'overload-allowed'
							? "Load is within overload boundaries (31-40h). Ensure this is approved by the department head."
							: loadProfile.status === 'below-standard'
							? "Capacity remains for additional assignments. Prioritize unassigned sections from the shortage grid."
							: "Teacher load is optimal."}
					</p>
				</div>
			</div>
		</div>
	);
}

