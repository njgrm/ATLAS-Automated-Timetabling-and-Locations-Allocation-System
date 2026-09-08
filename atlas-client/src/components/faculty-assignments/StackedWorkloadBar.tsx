import { cn } from '@/lib/utils';
import { resolveWorkloadBarState } from '@/lib/faculty-assignment-helpers';

type StackedWorkloadBarProps = {
	/** Actual instructional teaching hours — drives width, color, marker, excess, over-cap. */
	teachingHours: number;
	/** Advisory/ancillary credit hours — neutral stacked segment only, never status. */
	creditHours: number;
	/** Explicit weekly cap (per-faculty data). Required: no local fallback. */
	maxHours: number;
	/**
	 * Explicit effective teaching standard (hours). Null/omitted renders the
	 * unconfigured state: no standard marker, neutral tone, honest label.
	 */
	standardHours?: number | null;
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
	maxHours,
	standardHours,
	className,
	compact = false,
	showLegend = true,
	hoverHours = 0,
}: StackedWorkloadBarProps) {
	// hoverHours carries incoming TEACHING minutes only (never credit).
	const state = resolveWorkloadBarState({ teachingHours, creditHours, maxHours, standardHours, incomingTeachingHours: hoverHours });
	const normalizedHoverHours = Math.max(hoverHours, 0);
	const creditedTotalHours = Math.max(teachingHours, 0) + Math.max(creditHours, 0);
	const filledWidth = state.teachingWidthPercent + state.creditWidthPercent;
	const projectedFill = Math.min(100, (state.projectedTeachingHours / Math.max(maxHours, 1)) * 100 + state.creditWidthPercent);
	const hoverWidth = Math.max(0, projectedFill - filledWidth);
	const overCap = state.isOverCap || state.projectedOverCap;
	const projectedOverCap = state.projectedOverCap;

	const barColor =
		state.tone === 'over-cap' ? 'bg-rose-500'
		: state.tone === 'excess' ? 'bg-orange-500'
		: state.tone === 'at-standard' ? 'bg-sky-500'
		: state.tone === 'below-standard' ? 'bg-emerald-500'
		: 'bg-slate-400';

	const ghostColor = projectedOverCap ? 'bg-rose-400/50 animate-pulse' : 'bg-primary/40 animate-pulse';
	const standardLabel = standardHours != null && standardHours > 0 ? `${standardHours}h standard` : 'standard not configured';

	return (
		<div className={cn('space-y-1.5', className)}>
			<div
				className={cn(
					'relative w-full overflow-hidden rounded-full border border-border/40 bg-muted shadow-inner',
					compact ? 'h-2' : 'h-3',
					overCap && 'border-rose-300 ring-1 ring-rose-200',
				)}
				role="img"
				aria-label={`Teaching load ${formatHours(Math.max(teachingHours, 0))} of ${formatHours(maxHours)} cap (${standardLabel}); plus ${formatHours(Math.max(creditHours, 0))} advisory or ancillary credit shown separately.${normalizedHoverHours > 0 ? ` Projected teaching ${formatHours(state.projectedTeachingHours)} (${state.projectedTone}).` : ''}`}
			>
				<div
					className={cn("absolute left-0 top-0 h-full rounded-full transition-all", barColor)}
					style={{ width: `${state.teachingWidthPercent}%` }}
				/>
				{state.creditWidthPercent > 0 && (
					<div
						className="absolute top-0 h-full bg-slate-300/80 transition-all"
						style={{ left: `${state.teachingWidthPercent}%`, width: `${state.creditWidthPercent}%` }}
					/>
				)}
				{normalizedHoverHours > 0 && hoverWidth > 0 && (
					<div
						className={cn("absolute top-0 h-full rounded-full transition-all", ghostColor)}
						style={{ left: `${filledWidth}%`, width: `${hoverWidth}%` }}
					/>
				)}
				{overCap && <div className="absolute right-0 top-0 h-full w-1.5 bg-rose-600 z-10" />}
				{state.standardMarkerPercent != null && (
					<div
						className="absolute top-0 h-full w-px bg-foreground/60 z-10"
						style={{ left: `${state.standardMarkerPercent}%` }}
					/>
				)}
			</div>

			{showLegend && (
				<div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-tighter text-muted-foreground/85">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className={cn("inline-block size-2 rounded-full", barColor)} />
						<span className="truncate">Teaching: {formatHours(Math.max(teachingHours, 0))} (+{formatHours(Math.max(creditHours, 0))} credits){normalizedHoverHours > 0 ? ` → projected ${formatHours(state.projectedTeachingHours)}` : ''}</span>
					</div>
					<span className="shrink-0 tabular-nums">{standardLabel} / {maxHours}h cap</span>
				</div>
			)}
		</div>
	);
}