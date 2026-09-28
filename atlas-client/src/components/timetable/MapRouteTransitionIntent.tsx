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
 *
 * ── WHY THE FRAME IS NOT INSIDE `AnimatePresence` ──────────────────────────
 *
 * A first attempt put the pending branch as the FIRST TERNARY ARM inside
 * `<AnimatePresence mode="wait">`. That does not work, and QA caught it: with
 * `mode="wait"` AnimatePresence KEEPS THE EXITING CHILD MOUNTED and defers the
 * incoming child's mount for the exit duration. The previous-section grid was
 * therefore still in the DOM for the ~180 ms exit — the exact thing this item
 * exists to prevent, merely deprioritised rather than absent.
 *
 * So the pending state BYPASSES the animated chain entirely: no exit animation
 * is started, so nothing lingers, so no class cell is ever in the DOM while the
 * route says map. {@link resolveCenterPane} is the single decision
 * `CenterWorkspace` consults, and it is exported so a test can exercise the
 * REAL decision rather than a parallel reimplementation of it.
 */
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

import { resolveTimetableRouteView } from '@/components/timetable/TimetableRouteViewSync';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';

/**
 * The views that cannot render without something the operator selected. Reaching
 * one of these with nothing selected is a dead end, which is what C11 M1 fixed.
 */
const SELECTION_DEPENDENT_VIEWS: ReadonlySet<string> = new Set(['manual-edit', 'building']);

/**
 * The decision `CenterWorkspace` actually makes: render the pending map intent,
 * or enter the normal animated chain.
 *
 * Returned as a discriminated value rather than a boolean so the consuming JSX
 * reads as the branch it is, and so a test can assert the exact state the render
 * will take.
 *
 * Deliberately derived from {@link resolveTimetableRouteView}, the existing
 * single route→view authority, rather than a second path comparison. Two
 * predicates for one route is the hazard the shared mappers exist to prevent.
 *
 * ── C11 M1 — the route wins when it says the GRID ─────────────────────────────
 *
 * `TimetableRouteViewSync` moves `centerView` inside a `useEffect`, so the render
 * that first reaches the DOM for a new route still carries the PREVIOUS view. The
 * reproduction of the recorded defect
 * (`docs/reviews/codex-timetable-walk-20260928/report.md`, defect 1) is that
 * disagreeing render: after `Back to Schedule` the URL is `/timetable` while
 * `centerView` is still `manual-edit`, and the pane keyed off `centerView` paints
 * the manual-edit panel for the grid URL. Inside `<AnimatePresence mode="wait">`
 * that stale child is the one kept MOUNTED while the incoming one is deferred for
 * the exit duration, so the panel is what the operator is left looking at.
 *
 * So when the route says the schedule and the view still names a
 * selection-dependent pane, the ROUTE decides and the grid renders. This is the
 * same fix shape as the map case above — one decision, taken from the route, in
 * the same seam — not a third mechanism, and it is deliberately narrow: only the
 * selection-dependent views are overridden, because a stale GRID beside a
 * selection-dependent route is the other direction and the map branch already
 * covers its own dangerous case.
 */
export type CenterPaneDecision =
	| { readonly kind: 'pending-map-intent' }
	| { readonly kind: 'center-view'; readonly view: string };

export function resolveCenterPane(pathname: string, centerView: string): CenterPaneDecision {
	const routeView = resolveTimetableRouteView(pathname);
	if (routeView === 'map' && centerView !== 'map') {
		return { kind: 'pending-map-intent' };
	}
	// C11 M1 — `/timetable` means the grid. A selection-dependent pane is only
	// reachable through its own route, so it never survives a return to the grid.
	if (routeView === 'schedule' && SELECTION_DEPENDENT_VIEWS.has(centerView)) {
		return { kind: 'center-view', view: 'schedule' };
	}
	return { kind: 'center-view', view: centerView };
}

/** True only on the renders where the route says map and the view has not moved. */
export function isMapRouteTransitionPending(pathname: string, centerView: string): boolean {
	return resolveCenterPane(pathname, centerView).kind === 'pending-map-intent';
}

/**
 * The intent shown while the map view is still catching up. Renders the existing
 * approved copy for whatever route is actually pending, so it cannot drift from
 * the one intent table.
 */
export function MapRouteTransitionIntent({ pathname }: { pathname: string }) {
	const intent = resolveTimetableLoadingIntent(pathname);
	// Defensive only: `resolveCenterPane` already guarantees the route resolves to
	// `/timetable/map`, which always has an intent. If that ever stopped being
	// true the honest answer is an EMPTY panel, never a grid and never invented
	// copy.
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

/**
 * The pending pane exactly as the center workspace renders it — deliberately
 * NOT wrapped in `AnimatePresence`, so no exit animation runs and the previous
 * view's grid is never mounted beside it.
 */
export function MapRouteTransitionFrame({ pathname }: { pathname: string }) {
	return (
		<motion.div
			key="map-route-pending"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.18 }}
			className="flex min-h-0 flex-1 flex-col"
		>
			<MapRouteTransitionIntent pathname={pathname} />
		</motion.div>
	);
}
