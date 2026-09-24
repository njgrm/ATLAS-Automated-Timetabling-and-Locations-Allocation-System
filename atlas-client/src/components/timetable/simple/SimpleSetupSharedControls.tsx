import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { readinessLabel } from '@/components/timetable/simple/SimpleHeaderHelpers';

/**
 * UX-R03e (setup) — the shared setup-truth controls consumed by both the
 * Simple header (`TimetableSimpleHeader`) and the `/timetable/setup` center
 * view (`TimetableSetupPane`). One implementation, two entry points: every
 * existing header/More-menu control keeps working where it is, and the setup
 * route is an additional place to land. No behaviour change to sync, repair,
 * refresh, or the readiness sheet.
 *
 * (The readiness-sheet repair dispatch keeps its canonical home in
 * `TimetableSimpleHeader`, exported for the pane, so the existing
 * header-source contracts keep passing unedited.)
 */

/**
 * The minimal run state the readiness chip derives from. Every field here is
 * read by `readinessLabel` or the shared `publishBlocked` predicate, so the
 * header context satisfies it structurally.
 */
export type SimpleReadinessSnapshot = {
	draft: ScheduleReviewWorkspaceHeaderContext['draft'];
	blockingHardCount: number;
	summary: ScheduleReviewWorkspaceHeaderContext['summary'];
	softCount: number;
	isPreGenerationWorkspace: boolean;
	schoolYearContext: ScheduleReviewWorkspaceHeaderContext['schoolYearContext'];
	hasGeneratedRun: boolean;
	isRunPublished: boolean;
};

export function resolveSimpleReadiness(input: SimpleReadinessSnapshot): {
	readiness: string;
	publishBlocked: boolean;
	publishBlockedReason: string;
} {
	// The snapshot carries every field `readinessLabel` reads; the cast only
	// narrows the header-context type to that shared subset.
	const readiness = readinessLabel(input as unknown as ScheduleReviewWorkspaceHeaderContext);
	const publishBlocked = input.hasGeneratedRun
		&& !input.isRunPublished
		&& (input.blockingHardCount > 0 || (input.summary?.unassignedCount ?? 0) > 0);
	const publishBlockedReason = input.blockingHardCount > 0
		? `${input.blockingHardCount} hard blocker${input.blockingHardCount === 1 ? '' : 's'} must be fixed before publish.`
		: (input.summary?.unassignedCount ?? 0) > 0
			? `${input.summary?.unassignedCount} session${(input.summary?.unassignedCount ?? 0) === 1 ? '' : 's'} still need fixing before publish.`
			: '';
	return { readiness, publishBlocked, publishBlockedReason };
}

/**
 * The readiness chip, extracted verbatim from `TimetableSimpleHeader`
 * (previously inline JSX deriving `readinessLabel(context)` / `publishBlocked`).
 * Display-only: opening the readiness detail stays with the caller.
 */
export function SimpleReadinessChip({
	readiness,
	publishBlocked,
	blockingHardCount,
}: {
	readiness: string;
	publishBlocked: boolean;
	blockingHardCount: number;
}) {
	if (publishBlocked) {
		return (
			<Badge
				variant="outline"
				className={cn(
					'h-10 min-w-0 shrink gap-1.5 truncate rounded-full px-3 text-sm font-semibold',
					'border-destructive/30 bg-destructive/10 text-destructive',
				)}
				data-testid="timetable-simple-readiness-chip"
			>
				<AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="truncate">{readiness}</span>
			</Badge>
		);
	}
	return (
		<Badge
			variant={blockingHardCount > 0 ? 'destructive' : 'secondary'}
			className="h-5 shrink min-w-0 gap-1 truncate px-1.5 text-xs font-semibold sm:h-6 sm:shrink-0 sm:gap-1.5 sm:px-2"
			data-testid="timetable-simple-readiness-chip"
		>
			<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="truncate">{readiness}</span>
		</Badge>
	);
}

/**
 * The setup-name refresh control, extracted verbatim from the More-menu item
 * (`SimpleMoreMenuContent`, previously bound to the header context plus
 * `onClose`). The caller owns the menu-close; the refresh itself is unchanged.
 */
export function RefreshSetupNamesButton({ onRefreshNames }: { onRefreshNames: () => void }) {
	return (
		<div className="space-y-1" data-testid="timetable-refresh-setup-names-guidance">
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-9 justify-start gap-1.5 text-xs"
			onClick={onRefreshNames}
			data-testid="timetable-refresh-setup-names"
		>
			<RefreshCw className="size-3.5" aria-hidden="true" />
			Refresh school names
		</Button>
		<p className="text-xs leading-relaxed text-muted-foreground">Updates displayed names for the selected school year only. It does not change the schedule. If names still look wrong, check School information.</p>
		</div>
	);
}
