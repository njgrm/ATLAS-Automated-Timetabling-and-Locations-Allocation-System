/**
 * PolicyImpactSummary — compact card showing soft violation breakdown
 * and top violated rules. Placed inside the violations tab of the left panel.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Violation, ViolationCode, RunSummary } from '@/types';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const VIOLATION_SHORT_LABELS: Partial<Record<ViolationCode, string>> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Limit',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Req.',
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Travel Dist.',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Bldg. Trans.',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Trans. Buffer',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Idle Gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early Start',
	FACULTY_LATE_END_PREFERENCE: 'Late End',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily Max',
};

export default function PolicyImpactSummary({
	violations,
	previousSummary,
}: {
	violations: Violation[];
	previousSummary?: RunSummary | null;
}) {
	const softViolations = violations.filter((v) => v.severity === 'SOFT');

	if (softViolations.length === 0) return null;

	// Count by code
	const byCode = new Map<ViolationCode, number>();
	for (const v of softViolations) {
		byCode.set(v.code, (byCode.get(v.code) ?? 0) + 1);
	}

	// Top 3 most violated
	const sorted = Array.from(byCode.entries()).sort((a, b) => b[1] - a[1]);
	const top3 = sorted.slice(0, 3);

	// Trend vs previous run
	const prevSoftCount = previousSummary?.violationCounts
		? Object.entries(previousSummary.violationCounts)
				.filter(([code]) => !['FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'FACULTY_OVERLOAD', 'ROOM_TYPE_MISMATCH', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'FACULTY_DAILY_MAX_EXCEEDED'].includes(code))
				.reduce((sum, [, count]) => sum + count, 0)
		: null;

	const trend = prevSoftCount != null
		? softViolations.length - prevSoftCount
		: null;

	return (
		<div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-2 mb-2">
			<div className="flex items-center justify-between">
				<span className="text-[0.6875rem] font-semibold text-foreground">Policy Impact</span>
				<div className="flex items-center gap-1.5">
					<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] border-amber-300 bg-amber-50 text-amber-700">
						{softViolations.length} soft
					</Badge>
					{trend != null && (
						<TooltipProvider delayDuration={200}>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className={`flex items-center gap-0.5 text-[0.625rem] font-medium ${
										trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : 'text-muted-foreground'
									}`}>
										{trend > 0 ? <TrendingUp className="size-3" /> : trend < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
										{trend > 0 ? `+${trend}` : String(trend)}
									</span>
								</TooltipTrigger>
								<TooltipContent className="text-xs">
									{trend === 0 ? 'Same as previous run' : trend > 0 ? `${trend} more soft violations than previous run` : `${Math.abs(trend)} fewer soft violations than previous run`}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			</div>

			{/* Top 3 most violated soft rules */}
			<div className="space-y-1">
				{top3.map(([code, count]) => (
					<div key={code} className="flex items-center justify-between text-[0.625rem]">
						<span className="text-muted-foreground truncate">{VIOLATION_SHORT_LABELS[code] ?? code}</span>
						<span className="font-mono font-medium text-foreground">{count}</span>
					</div>
				))}
			</div>

			{sorted.length > 3 && (
				<div className="text-[0.5625rem] text-muted-foreground">
					+{sorted.length - 3} more violation types
				</div>
			)}
		</div>
	);
}
