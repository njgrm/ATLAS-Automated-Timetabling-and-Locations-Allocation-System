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
	Users
} from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FacultySummary, LoadProfile, RotationFamilyTermBreakdown } from '@/types';

type WorkloadInspectorProps = {
	selected: FacultySummary | null;
	loadProfile: LoadProfile | null;
	rotationTermBreakdown: RotationFamilyTermBreakdown[];
	hoveredIncomingMinutes: number;
	previewLoadHours: number;
	isReadOnlyMode: boolean;
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
	onClose
}: WorkloadInspectorProps) {
	if (!selected || !loadProfile) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-8 text-center bg-muted/5">
				<div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
					<Users className="size-6 text-muted-foreground/40" />
				</div>
				<p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Select a teacher<br/>to inspect workload</p>
			</div>
		);
	}

	const loadCapMinutes = (selected.maxHoursPerWeek || 40) * 60;
	const status = STATUS_COLORS[loadProfile.status] || STATUS_COLORS['compliant'];
	const StatusIcon = status.icon;

	return (
		<div className="flex h-full flex-col bg-background border-l border-border/50">
			<div className="shrink-0 p-6 border-b border-border/40 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Teacher Workload</h3>
					<Badge variant="outline" className={cn("h-5 font-black uppercase tracking-tighter shadow-none", status.bg, status.text, status.border)}>
						{loadProfile.statusLabel}
					</Badge>
				</div>

				<div className="flex items-center gap-4">
					<div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-black text-primary border border-primary/20">
						{selected.firstName[0]}{selected.lastName[0]}
					</div>
					<div className="min-w-0">
						<h4 className="text-base font-black uppercase tracking-tight truncate leading-tight">
							{selected.lastName}, {selected.firstName}
						</h4>
						<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest truncate">
							{selected.department || 'No Department'}
						</p>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto p-6 space-y-8 no-scrollbar">
				{/* Capacity Gauge */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground/60">Weekly Capacity</span>
						<span className="text-sm font-black tabular-nums">{loadProfile.creditedTotalHours} / {selected.maxHoursPerWeek}h</span>
					</div>
					<div className="space-y-2">
						<div className="h-2 w-full bg-muted border border-border/20 shadow-inner rounded-full overflow-hidden">
							<div 
								className="h-full bg-primary transition-all duration-500" 
								style={{ width: `${Math.min(100, (loadProfile.creditedTotalHours / selected.maxHoursPerWeek) * 100)}%` }} 
							/>
						</div>
						<div className="flex justify-between items-center text-[0.55rem] font-black uppercase tracking-tighter text-muted-foreground/60">
							<span>0%</span>
							<span>{Math.round((loadProfile.creditedTotalHours / selected.maxHoursPerWeek) * 100)}% Utilized</span>
							<span>100%</span>
						</div>
					</div>
				</section>

				{/* Primary Stats Grid */}
				<div className="grid grid-cols-2 gap-3">
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest block">Credited</span>
						<p className="text-xl font-black tracking-tight tabular-nums">{loadProfile.creditedTotalHours}h</p>
					</div>
					<div className="p-4 rounded-xl border border-border/40 bg-muted/5 space-y-1">
						<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest block">Remaining</span>
						<p className={cn("text-xl font-black tracking-tight tabular-nums", loadProfile.remainingHours < 0 ? 'text-rose-600' : 'text-emerald-600')}>
							{loadProfile.remainingHours.toFixed(1)}h
						</p>
					</div>
				</div>

				{/* Arithmetic Breakdown */}
				<section className="space-y-4">
					<h5 className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Load Arithmetic</h5>
					<div className="space-y-2.5">
						<div className="flex items-center justify-between text-xs font-bold">
							<div className="flex items-center gap-2 text-muted-foreground">
								<BookOpen className="size-3.5 opacity-40" />
								<span>Total Classes Sum</span>
							</div>
							<span className="tabular-nums">{(loadProfile.rawTeachingHours).toFixed(1)}h</span>
						</div>

						{loadProfile.rotationOvercountHours > 0 && (
							<div className="flex items-center justify-between text-xs font-bold text-violet-700 bg-violet-50/50 p-2 rounded-lg border border-violet-100/50">
								<div className="flex items-center gap-2">
									<Layers className="size-3.5 opacity-60" />
									<span>Rotation Deduction</span>
								</div>
								<span className="tabular-nums">-{(loadProfile.rotationOvercountHours).toFixed(1)}h</span>
							</div>
						)}

						<div className="flex items-center justify-between text-xs font-bold">
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="size-3.5 opacity-40" />
								<span>Actual Teaching</span>
							</div>
							<span className="tabular-nums">{(loadProfile.actualTeachingHours).toFixed(1)}h</span>
						</div>

						{loadProfile.equivalentHours > 0 && (
							<div className="flex items-center justify-between text-xs font-bold text-emerald-700">
								<div className="flex items-center gap-2">
									<Star className="size-3.5 opacity-60" />
									<span>Advisory / Ancillary</span>
								</div>
								<span className="tabular-nums">+{(loadProfile.equivalentHours).toFixed(1)}h</span>
							</div>
						)}

						<div className="pt-2 mt-2 border-t border-dashed border-border/60 flex items-center justify-between">
							<span className="text-sm font-black uppercase tracking-tight text-primary">Total Credited</span>
							<span className="text-lg font-black tabular-nums text-primary">{loadProfile.creditedTotalHours.toFixed(1)}h</span>
						</div>
					</div>
				</section>

				{/* Rotational Families */}
				{rotationTermBreakdown.length > 0 && (
					<section className="space-y-4">
						<h5 className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/40 pb-2">Rotational Groups</h5>
						<div className="space-y-4">
							{rotationTermBreakdown.map((family) => (
								<div key={family.family} className="p-4 rounded-xl border border-sky-100 bg-sky-50/20 space-y-4">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<span className="text-[0.55rem] font-black uppercase tracking-widest text-sky-900/40 block leading-none mb-1">Group</span>
											<span className="text-sm font-black uppercase tracking-tight text-sky-900 truncate block">{family.family}</span>
										</div>
										<div className="text-right">
											<span className="text-lg font-black text-sky-900 tabular-nums leading-none">
												{(family.peakTermMinutesPerWeek / 60).toFixed(1)}h
											</span>
											<span className="text-[0.5rem] font-bold text-sky-600/70 uppercase tracking-tighter block mt-1">Peak Weekly</span>
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
													<span className={cn("text-[0.5rem] font-black uppercase tracking-widest", isPeak ? "text-sky-900" : "text-sky-700/60")}>
														T{term}
													</span>
													<div className={cn("text-xs font-black tabular-nums leading-none", isPeak ? "text-sky-800" : "text-sky-700/60")}>
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
					<h6 className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
						<Info className="size-3.5" />
						Scheduling Guidance
					</h6>
					<p className="text-[0.7rem] text-muted-foreground/80 font-medium leading-relaxed italic">
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
