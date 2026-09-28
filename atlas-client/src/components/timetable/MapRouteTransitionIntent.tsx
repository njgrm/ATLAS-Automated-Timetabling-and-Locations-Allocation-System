/**
 * A2 C5 item 2 — `/timetable/map` painted the PREVIOUS section's schedule grid
 * for about two seconds.
 *
 * The recorded cause, verified at base `bd789d86`:
 *
 *  - `TimetableRouteViewSync` moves `centerView` to `'map'` inside a `useEffect`
 *    (its `resolveTimetableRouteView` switch, lines 222-269 of that file). An
 *    effect runs AFTER the first paint, so the render that reaches the DOM for
 *    `/timetable/map` still has `centerView === 'schedule'`.
 *  - `CenterWorkspace` keys its map pane off `centerView === 'map'`, so that
 *    first paint falls all the way through the chain to the schedule/matrix
 *    branch and paints the previous section's cells.
 *  - The `Suspense` in `CenterWorkspace` wraps only the lazy `CampusMap` chunk.
 *    It covers the module fetch, not the view transition, so a fast chunk load
 *    does not mask the stale grid.
 *
 * WHY A LOADING STATE IS THE RIGHT ANSWER, not a blank: a stale grid is worse
 * than an empty panel for an older, mouse-first user, because it looks like
 * data. It says "these are this section's classes" when they are the last
 * section's, and a scheduler can act on it. An honest "Rooms and map / Checking
 * rooms and schedule information." says nothing false and is already the
 * operator-approved copy for this exact route.
 *
 * NO NEW COPY: the title and message come from the single existing export
 * {@link resolveTimetableLoadingIntent}, which already declares `/timetable/map`
 * (the packet's "do not invent a fourth variant"). Only the CONTAINER is new,
 * because {@link TimetableRouteLoadingState} is a whole-page
 * `h-[calc(100svh-3.5rem)]` section and this renders INSIDE the center
 * resizable panel, where a viewport-height block would fight the no-scroll
 * architecture (AGENTS.md §8).
 */
import { Loader2 } from 'lucide-react';

import { resolveTimetableRouteView } from '@/components/timetable/TimetableRouteViewSync';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';

/**
 * True on every render where the ROUTE already resolves to the map view but
 * `centerView` has not caught up yet — precisely the window in which the base
 * code painted the previous view's grid.
 *
 * Deliberately derived from {@link resolveTimetableRouteView}, the existing
 * single route→view authority, rather than a second path comparison. Two
 * predicates for one route is the hazard the shared mappers exist to prevent.
 *
 * It is scoped to the map view on purpose. The other six routed views have the
 * same asynchronous entry, but the recorded defect is a grid of real-looking
 * class cells preceding a map; widening this to every view would blank the
 * schedule on unrelated navigations.
 */
export function isMapRouteTransitionPending(pathname: string, centerView: string): boolean {
	return resolveTimetableRouteView(pathname) === 'map' && centerView !== 'map';
}

/**
 * The intent shown while the map view is still catching up. Renders the existing
 * approved copy for whatever route is actually pending, so it cannot drift from
 * the one intent table.
 */
export function MapRouteTransitionIntent({ pathname }: { pathname: string }) {
	const intent = resolveTimetableLoadingIntent(pathname);
	// Defensive only: `isMapRouteTransitionPending` already guarantees the route
	// resolves to `/timetable/map`, which always has an intent. If that ever
	// stopped being true the honest answer is an EMPTY panel, never a grid and
	// never invented copy.
	if (!intent) return null;
	return (
		<div
			className="flex min-h-0 flex-1 items-center justify-center p-6"
			data-testid="timetable-map-route-transition-intent"
			aria-live="polite"
		>
			<div className="max-w-md space-y-2 text-center">
				<p className="text-sm font-medium text-foreground">{intent.title}</p>
				<p className="text-xs text-muted-foreground">{intent.message}</p>
				<p className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground" role="status">
					<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					Loading this view…
				</p>
			</div>
		</div>
	);
}
