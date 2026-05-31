import { cn } from '@/lib/utils';
import { MAX_WEEKLY_TEACHING_HOURS, STANDARD_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';

type StackedWorkloadBarProps = {
	teachingHours: number;
	creditHours: number;
	maxHours?: number;
	className?: string;
	compact?: boolean;
	showLegend?: boolean;
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
}: StackedWorkloadBarProps) {
	const normalizedTeachingHours = Math.max(teachingHours, 0);
	const normalizedCreditHours = Math.max(creditHours, 0);
	const creditedTotalHours = normalizedTeachingHours + normalizedCreditHours;
	const teachingWidth = percentOfCap(normalizedTeachingHours, maxHours);
	const creditStart = percentOfCap(normalizedTeachingHours, maxHours);
	const creditWidth = Math.max(0, percentOfCap(creditedTotalHours, maxHours) - creditStart);
	const standardMarker = percentOfCap(STANDARD_WEEKLY_TEACHING_HOURS, maxHours);
	const overCap = creditedTotalHours > maxHours;

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
					className="absolute left-0 top-0 h-full rounded-l-full bg-sky-500 transition-all"
					style={{ width: `${teachingWidth}%` }}
				/>
				<div
					className="absolute top-0 h-full bg-slate-400 transition-all"
					style={{ left: `${creditStart}%`, width: `${creditWidth}%` }}
				/>
				{overCap && <div className="absolute right-0 top-0 h-full w-1.5 bg-rose-500" />}
				<div
					className="absolute top-0 h-full w-px bg-foreground/50"
					style={{ left: `${standardMarker}%` }}
				/>
			</div>

			{showLegend && (
				<div className="flex items-center justify-between gap-2 text-[0.6rem] font-semibold uppercase tracking-tighter text-muted-foreground/80">
					<div className="flex min-w-0 items-center gap-2">
						<span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="inline-block size-2 rounded-full bg-sky-500" />Teaching</span>
						<span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="inline-block size-2 rounded-full bg-slate-400" />Credits</span>
					</div>
					<span className="shrink-0 tabular-nums">30h standard / {maxHours}h cap</span>
				</div>
			)}
		</div>
	);
}