import { CheckCircle2, Info, RefreshCw } from 'lucide-react';

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
	softCount = 0,
}: {
	readiness: string;
	publishBlocked: boolean;
	blockingHardCount: number;
	/**
	 * LANE-C-PLAIN-LANGUAGE-C03 (J4.2) — the count the label beside the tick is
	 * describing, so the icon can agree with the text instead of contradicting
	 * it. Defaults to 0 for callers that pass none.
	 */
	softCount?: number;
}) {
	if (publishBlocked) {
		/* J4.1 — unplaced classes are the ROUTINE state before anyone has touched
		 * the grid, but this chip was `h-10` (double the neutral chip), fully
		 * destructive-tinted and wearing an AlertTriangle, so a brand-new run
		 * looked like a fire. The fact genuinely blocks publishing, so it is kept
		 * and the label still states the consequence; only the alarm register goes,
		 * and the height returns to the neutral chip's. No control was added. */
		return (
			<Badge
				variant="outline"
				className={cn(
					'h-6 min-w-0 shrink gap-1.5 truncate rounded-full px-2 text-xs font-semibold sm:h-6 sm:shrink-0 sm:gap-1.5 sm:px-2',
					'border-border bg-muted text-foreground',
				)}
				data-testid="timetable-simple-readiness-chip"
				data-readiness-state="unplaced"
			>
				<Info className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="truncate">{readiness}</span>
			</Badge>
		);
	}

	/* J4.2 — one consistent signal. This chip previously rendered a green
	 * CheckCircle2 unconditionally, so a scheduler could read a tick beside
	 * "5 warnings" (self-contradicting) and, worse, a green tick inside a
	 * destructive badge when `blockingHardCount > 0`. The icon now follows the
	 * state the badge is actually describing; the label is untouched. */
	const state: 'blockers' | 'outstanding' | 'clear'
		= blockingHardCount > 0 ? 'blockers' : softCount > 0 ? 'outstanding' : 'clear';

	return (
		<Badge
			variant={state === 'clear' ? 'secondary' : 'outline'}
			className={cn(
				'h-6 min-w-0 shrink gap-1.5 truncate px-2 text-xs font-semibold sm:h-6 sm:shrink-0 sm:gap-1.5 sm:px-2',
				state === 'blockers' && 'border-destructive/40 bg-destructive/10 text-destructive',
				state === 'outstanding' && 'border-border bg-muted text-foreground',
			)}
			data-testid="timetable-simple-readiness-chip"
			data-readiness-state={state}
		>
			{state === 'clear'
				? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
				: <Info className="size-3.5 shrink-0" aria-hidden="true" />}
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
