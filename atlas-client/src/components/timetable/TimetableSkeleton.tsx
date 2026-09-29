import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';

import { TimetableSubNav } from '@/components/timetable/TimetableSubNav';

/**
 * A2 C13 (item 1) — how long the operator waits before the page offers a way out.
 *
 * Exported so a test asserts the VALUE and advances to it, rather than restating
 * "about 8 seconds" and hoping. "About 8 s" is the operator's number, and it is
 * the PROMISE. It is not changed by A2 c14.
 */
export const LOADING_RETRY_AFTER_MS = 8000;

/**
 * A2 c14 follow-up (item 2) — the lead, and why the promise needed one.
 *
 * Lane C's train-8 walk measured the page settling at 14.1 s and reported: *"no
 * Retry was visible at the 8 s check"*. Codex was right, and the cause is not the
 * diagnostic, not the gate, and not the copy.
 *
 * `state.loadAll()` is a real refetch that can be issued at ANY instant, so the
 * control was never blocked on anything resolving — the C13 deferral is a
 * deliberate "do not invite a pointless click at 0.2 s" choice, not a dependency,
 * and it is kept below. What was wrong is the LANDING. The timer was armed at
 * exactly `LOADING_RETRY_AFTER_MS`, so the state update fired at 8.000 s and
 * still needed a render and a paint before anything was on screen. The control
 * was therefore offered ON the promised instant, not BY it: an operator who
 * looked at 8 s — the number they were given — saw nothing, and had to keep
 * waiting for a second they were never promised.
 *
 * So the promise and the arming are separated. The offer is armed a lead early
 * enough that the control is in the DOM and painted with real slack before the
 * promised instant, which is what "about 8 seconds" has to mean for it to be
 * true. Nothing was added to the band and no sentence changed: the same single
 * sentence, the same one verb.
 */
export const LOADING_RETRY_LEAD_MS = 500;

/** The instant the offer is ARMED. Strictly before the promise; asserted, not assumed. */
export const LOADING_RETRY_ARM_AFTER_MS = LOADING_RETRY_AFTER_MS - LOADING_RETRY_LEAD_MS;

/**
 * A2 C13 (item 1a) — the sentence, in full.
 *
 * SUBTRACT, not reword. It used to read:
 *   "Loading timetable: navigation is ready now; the grid fills as soon as the
 *    latest run resolves."
 * and Codex graded it MAJOR: *"'latest run resolves' is technical and passive."*
 * Both clauses named the MECHANISM, which is the operator's exact complaint. They
 * are removed, not rephrased. What remains claims only what is true: the schedule
 * has not arrived yet. Nothing factual changed, so this stays VISUAL rather than
 * MEDIUM.
 */
export const LOADING_SENTENCE = 'Your schedule is still loading.';

/** A2 C13 (item 1b) — ONE primary way out. Re-runs the real load, resets the timer. */
export const LOADING_RETRY_LABEL = 'Retry';

/**
 * A2 C13 (item 1b) — the secondary way out, and the ONLY case it may appear in.
 *
 * It is rendered if and only if a published run is already derivable from state
 * the app holds (no new fetch). With no published run it does not render AT ALL:
 * a disabled link with nowhere to go is exactly the class of defect item 3 exists
 * to remove.
 */
export const LAST_PUBLISHED_SCHEDULE_LABEL = 'Show the last published schedule';

/** The route that already exists for exactly this. Never invented. */
export const PUBLIC_SCHEDULES_HREF = '/public/schedules';

/**
 * A2 C13 (item 1c) — the hook placement, and WHY it is safe here.
 *
 * `ScheduleReviewWorkspace.tsx` records the c12 defect in its own comment: a hook
 * sat BELOW the `if (state.loading && !state.draft)` early return, so the loading
 * render called one fewer hook than the resolved render and React threw #310
 * ("Rendered more hooks than during the previous render"), which the page reports
 * as an unexpected error. `moveTargetSlotKeys` and `usePastYearTimetable` were
 * hoisted for exactly that reason.
 *
 * The timer lives INSIDE `TimetableSkeleton` deliberately. This component has NO
 * early return, so its hook count is identical in every render it ever performs
 * and the #310 class of defect is structurally impossible here. A hook added to
 * `ScheduleReviewWorkspace` instead would have had to be hoisted above all four of
 * its early returns; the same behaviour with none of that risk is the better
 * placement. `a2-c12-s2-310fix.test.tsx` is the standing guard and still passes.
 */
export function TimetableSkeleton({
	onRetry,
	hasPublishedRun = false,
}: {
	/**
	 * Re-runs the REAL data load. The workspace offers `loadAll`, so this is a
	 * genuine refetch — NOT a `window.location.reload()`, which would throw away
	 * the operator's filters, term and view for no reason.
	 */
	onRetry?: () => void;
	/**
	 * A published run is ALREADY derivable from data on screen. Callers derive it
	 * from `usePublishedTimetableReturnState`, which is populated only when a
	 * published run has been on screen — so this is a read of existing state and
	 * never a request fired to discover whether a link may be offered.
	 */
	hasPublishedRun?: boolean;
}) {
	const [attempt, setAttempt] = useState(0);
	const [offered, setOffered] = useState(false);

	useEffect(() => {
		// Armed at ARM, not at the promise: see `LOADING_RETRY_LEAD_MS`. The
		// offered control must already be painted when the promised instant
		// arrives, which a timer armed AT that instant cannot achieve.
		const timer = window.setTimeout(() => setOffered(true), LOADING_RETRY_ARM_AFTER_MS);
		return () => window.clearTimeout(timer);
	}, [attempt]);

	// The reset lives in the CLICK, not in an effect: the timer is torn down and
	// re-armed by the `attempt` change, so a second failed retry offers itself
	// again after another 8 s. No setState-in-effect, no double render.
	const handleRetry = () => {
		setAttempt((previous) => previous + 1);
		setOffered(false);
		onRetry?.();
	};

	return (
		<motion.div
			className="flex flex-col h-[calc(100svh-3.5rem)]"
			data-testid="timetable-first-paint"
			initial={{ opacity: 1 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0 }}
		>
			<div className="h-0.5 shrink-0 bg-emerald-500 animate-pulse" />
			{/* B3 — progressive first paint: the shell, the labelled sub-nav and the
          skeleton paint immediately; only the grid waits for the latest run. */}
			<TimetableSubNav />
			<div className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 space-y-2">
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-40 bg-muted/80" />
					<Skeleton className="h-8 w-30 bg-muted/80" />
					<Skeleton className="h-8 w-24 bg-muted/80" />
					<div className="ml-auto flex items-center gap-2">
						<Skeleton className="h-5 w-18 bg-muted/80" />
						<Skeleton className="h-5 w-18 bg-muted/80" />
						<Skeleton className="h-5 w-18 bg-muted/80" />
					</div>
				</div>
				{/* A2 C13 — one band, one sentence, and (only after the limit, only
            while the skeleton is still showing) at most TWO ways out. Before the
            limit this band carries the sentence and NO controls: a control that
            appears and disappears on a timer is motion, not help. */}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
					<span className="font-medium text-foreground" data-testid="timetable-loading-sentence">
						{LOADING_SENTENCE}
					</span>
					{offered ? (
						<>
							<Button
								type="button"
								variant="default"
								size="sm"
								className="h-7 gap-1.5 px-2.5 text-xs"
								onClick={handleRetry}
								data-testid="timetable-loading-retry"
							>
								<RefreshCw className="size-3.5" aria-hidden="true" />
								<span>{LOADING_RETRY_LABEL}</span>
							</Button>
							{hasPublishedRun ? (
								<Button asChild variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
									<Link to={PUBLIC_SCHEDULES_HREF} data-testid="timetable-loading-last-published">
										{LAST_PUBLISHED_SCHEDULE_LABEL}
									</Link>
								</Button>
							) : null}
						</>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-7 w-32 bg-muted/80" />
					<Skeleton className="h-7 w-80 bg-muted/80" />
					<Skeleton className="h-7 w-36 bg-muted/80" />
					<Skeleton className="h-7 w-36 bg-muted/80" />
				</div>
			</div>

			<div className="flex flex-1 min-h-0">
				<div className="w-64 border-r border-border bg-muted/15 p-3 space-y-2">
					{Array.from({ length: 8 }).map((_, index) => (
						<Skeleton key={index} className="h-10 w-full bg-muted/80" />
					))}
				</div>
				<div className="flex-1 min-w-0 bg-muted/10 p-3">
					<Skeleton className="h-full w-full rounded-lg bg-muted/80" />
				</div>
				<div className="w-80 border-l border-border bg-muted/15 p-3 space-y-2">
					{Array.from({ length: 6 }).map((_, index) => (
						<Skeleton key={index} className="h-12 w-full bg-muted/80" />
					))}
				</div>
			</div>
		</motion.div>
	);
}
