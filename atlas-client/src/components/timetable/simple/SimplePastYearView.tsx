/**
 * A2 C12 / ITEM S2 — the PAST-YEAR GATE on the existing `/timetable` route.
 *
 * ## What this is
 * A gate, not a screen. There is still ONE grid, ONE filter bar and ONE term
 * authority on `/timetable`; the live walk's finding was that there was no URL to
 * reach a past year, not that the past year needed a page of its own. So no route,
 * no page and no nav entry is added here — `SimplePastYearView` decides which of
 * two already-existing surfaces to render.
 *
 * ## Why the gate is STRUCTURAL, not conventional (C1)
 * A past year is history. `ScheduleReviewWorkspace` renders through this gate
 * BEFORE it mounts the DndContext, `TimetableSimpleHeader`,
 * `ScheduleReviewWorkspaceBody`, the drag overlay, the workflow dialogs and the
 * undo/redo strip. In a past year none of those are mounted at all, so there is
 * no reachable path to a placement, quick-place, swap, generate, publish, discard,
 * undo/redo commit, manual-edit commit, or term/generation action.
 *
 * Hiding and disabling were both considered. DISABLING was rejected: C1 prefers
 * not offering an action that a server would reject, and §8 would then require a
 * VISIBLE reason for each disabled control — a wall of reasons is a worse screen
 * than no controls. So the mutation controls are absent, and there is no disabled
 * action whose reason could be hover-only.
 *
 * ## Why a notice is never the current year (C2)
 * See `pastYearViewState.ts`, whose header states the invariant this file renders.
 * The notice below is the EXISTING empty/notice shape: a plain sentence and a way
 * back. It is small on purpose — an empty state is an annoyance, a wrong year is a
 * lie, and this surface chooses the annoyance.
 *
 * ## What is NOT claimed here
 * Whether the banner READS WELL, and whether the grid is actually POPULATED for a
 * real past year, are BROWSER rows (AGENTS.md §11/§12) owned by Lane C on A4's
 * staging. JSDOM cannot decide either.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
	buildPastYearBackHref,
	pastYearBannerCopy,
	pastYearNoticeCopy,
	type PastYearViewState,
} from '@/components/timetable/simple/pastYearViewState';

/**
 * The way back, rendered on BOTH the past-year banner and the notice — a refusal
 * that leaves the operator stuck would be its own small lie.
 */
function BackToThisYear({ href }: { href: string }) {
	return (
		<Link
			to={href}
			data-testid="timetable-past-year-back"
			// §8 — an accessible name that says WHERE it goes. A bare "Back" is not
			// one, and neither is an icon.
			aria-label="Back to this year's timetable"
			className="inline-flex h-11 items-center gap-1.5 rounded border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
		>
			Back to this year
		</Link>
	);
}

export function SimplePastYearView({
	view,
	backHref,
	currentSurface,
	pastSurface,
}: {
	view: PastYearViewState;
	/** From `buildPastYearBackHref` — the current-year URL, no `schoolYearId`. */
	backHref: string;
	/** Today's surface. Rendered ONLY for `current-year`. */
	currentSurface: ReactNode;
	/** The read-only past-year surface. Rendered ONLY for `past-year`. */
	pastSurface: ReactNode;
}) {
	// 1. No year asked for. Byte-for-byte today's behaviour — this is the path
	//    every existing `/timetable` visit takes, and it is deliberately untouched.
	if (view.kind === 'current-year') {
		return <>{currentSurface}</>;
	}

	// 2. A year was asked for and could not be shown. The notice, and NEITHER
	//    surface. The current-year body is not rendered anywhere in this branch —
	//    that is C2, and it is the reason `currentSurface` is not the fallback.
	if (view.kind === 'notice') {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col overflow-auto p-4"
				data-testid="timetable-past-year-notice"
				data-notice-reason={view.reason}
				role="status"
			>
				<div className="mx-auto max-w-2xl rounded border border-border bg-card p-6">
					<h2 className="text-base font-semibold text-foreground">Past school year</h2>
					<p className="mt-2 text-sm text-muted-foreground">{pastYearNoticeCopy(view.reason, null)}</p>
					<p className="mt-1 text-sm text-muted-foreground">
						ATLAS is not showing this year&rsquo;s timetable here. Showing a different year would be
						misleading, so nothing is shown instead.
					</p>
					<div className="mt-4">
						<BackToThisYear href={backHref} />
					</div>
				</div>
			</div>
		);
	}

	// 3. The requested past year, read-only.
	const { heading, body } = pastYearBannerCopy(view.yearLabel);
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-auto" data-testid="timetable-past-year-view">
			<div
				role="status"
				data-testid="timetable-past-year-banner"
				data-school-year-id={view.schoolYearId}
				data-read-only="true"
				className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5"
			>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-amber-900">{heading}</p>
					<p className="text-sm text-amber-900">{body}</p>
				</div>
				<BackToThisYear href={backHref} />
			</div>
			{pastSurface}
		</div>
	);
}

export { BackToThisYear, buildPastYearBackHref };
