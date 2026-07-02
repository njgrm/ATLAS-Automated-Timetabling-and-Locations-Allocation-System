import { cn } from '@/lib/utils';
import { MAX_WEEKLY_TEACHING_HOURS, STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';

type StackedWorkloadBarProps = {
	teachingHours: number;
	creditHours: number;
	maxHours?: number;
	className?: string;
	compact?: boolean;
	showLegend?: boolean;
	hoverHours?: number;
};

function percentOfCap(value: number, maxHours: number): number {
	return Math.min(100, Math.max(0, (value / Math.max(maxHours, 1)) * 100));
}

function formatHours(value: number): string {
	return `${Math.round(value * 10) / 10}h`;
}

export function StackedWorkloadBar({
	teachingHours,
	creditHours,
	maxHours = MAX_WEEKLY_TEACHING_HOURS,
	className,
	compact = false,
	showLegend = true,
	hoverHours = 0,
}: StackedWorkloadBarProps) {
	const normalizedTeachingHours = Math.max(teachingHours, 0);
	const normalizedCreditHours = Math.max(creditHours, 0);
	const normalizedHoverHours = Math.max(hoverHours, 0);
	const creditedTotalHours = normalizedTeachingHours + normalizedCreditHours;
	const totalWidth = percentOfCap(creditedTotalHours, maxHours);
	const hoverWidth = percentOfCap(creditedTotalHours + normalizedHoverHours, maxHours) - totalWidth;
	const standardMarker = percentOfCap(STANDARD_WEEKLY_TEACHING_HOURS, maxHours);
	const overCap = creditedTotalHours > maxHours;
	const projectedOverCap = (creditedTotalHours + normalizedHoverHours) > maxHours;

	const barColor = 
		creditedTotalHours > maxHours ? 'bg-rose-500'
		: creditedTotalHours > STANDARD_WEEKLY_TEACHING_HOURS ? 'bg-orange-500'
		: creditedTotalHours === STANDARD_WEEKLY_TEACHING_HOURS ? 'bg-sky-500'
		: 'bg-emerald-500';

	const ghostColor = projectedOverCap ? 'bg-rose-400/50 animate-pulse' : 'bg-primary/40 animate-pulse';

	return (
		<div className={cn('space-y-1.5', className)}>
			<div
				className={cn(
					'relative w-full overflow-hidden rounded-full border border-border/40 bg-muted shadow-inner',
					compact ? 'h-2' : 'h-3',
					overCap && 'border-rose-300 ring-1 ring-rose-200',
				)}
				role="img"
				aria-label={`Credited workload ${formatHours(creditedTotalHours)}: ${formatHours(normalizedTeachingHours)} teaching plus ${formatHours(normalizedCreditHours)} advisory or ancillary credit. Standard is ${STANDARD_WEEKLY_TEACHING_HOURS}h and cap is ${maxHours}h.`}
			>
				<div
					className={cn("absolute left-0 top-0 h-full rounded-full transition-all", barColor)}
					style={{ width: `${totalWidth}%` }}
				/>
				{normalizedHoverHours > 0 && hoverWidth > 0 && (
					<div
						className={cn("absolute top-0 h-full rounded-full transition-all", ghostColor)}
						style={{ left: `${totalWidth}%`, width: `${hoverWidth}%` }}
					/>
				)}
				{overCap && <div className="absolute right-0 top-0 h-full w-1.5 bg-rose-600 z-10" />}
				<div
					className="absolute top-0 h-full w-px bg-foreground/60 z-10"
					style={{ left: `${standardMarker}%` }}
				/>
			</div>

			{showLegend && (
				<div className="flex items-center justify-between gap-2 text-[0.65rem] font-semibold uppercase tracking-tighter text-muted-foreground/85">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className={cn("inline-block size-2 rounded-full", barColor)} />
						<span className="truncate">Total Load: {formatHours(creditedTotalHours)} ({formatHours(normalizedTeachingHours)} teaching + {formatHours(normalizedCreditHours)} credits)</span>
					</div>
					<span className="shrink-0 tabular-nums">30h standard / {maxHours}h cap</span>
				</div>
			)}
		</div>
	);
}