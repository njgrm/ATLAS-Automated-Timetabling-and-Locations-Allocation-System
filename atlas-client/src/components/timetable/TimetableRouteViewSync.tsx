import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * UX-R03a — the two center views that have a URL. Everything else under
 * `/timetable` (index, trailing slash, unknown children once the router
 * fallback redirects them) maps to the schedule surface.
 *
 * UX-R03b — the four remaining existing center views gain their own URLs.
 * Deferred `/timetable/runs`, `/timetable/setup` and `/timetable/exports`
 * sub-pages do not exist as components, so they keep mapping to schedule.
 */
export type TimetableRoutedView =
	| 'schedule'
	| 'policy'
	| 'pre-generation'
	| 'map'
	| 'manual-edit'
	| 'building';

/**
 * UX-R03a — pure route→view mapping for the two routed center views.
 * `/timetable/policies` renders the existing policy pane; every other
 * `/timetable*` pathname renders the index (schedule) surface.
 *
 * UX-R03b — each of the four remaining existing center views resolves to
 * its own view; unknown children still fall back to the schedule surface.
 */
export function resolveTimetableRouteView(pathname: string): TimetableRoutedView {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	switch (normalized) {
		case '/timetable/policies':
			return 'policy';
		case '/timetable/pre-generation':
			return 'pre-generation';
		case '/timetable/map':
			return 'map';
		case '/timetable/manual-edit':
			return 'manual-edit';
		case '/timetable/building':
			return 'building';
		default:
			return 'schedule';
	}
}

/**
 * UX-R03a (F2) — the route that truthfully describes the center view actually
 * shown. Only `policy` has its own route; every other view (including the
 * unrouted pre-generation/manual-edit/map/building surfaces) is described by
 * the index route, exactly as before this increment.
 *
 * UX-R03b — every existing center view now has its own route, so the restore
 * target for a cancelled guard navigation is the shown view's own route.
 * This is what closes the R03a residual: cancelling while on `pre-generation`
 * restores `/timetable/pre-generation`, which resolves back to `pre-generation`,
 * so the route effect below is a no-op and the guard cannot re-open for the
 * same cancelled navigation.
 */
export type TimetableCenterRoute =
	| '/timetable'
	| '/timetable/policies'
	| '/timetable/pre-generation'
	| '/timetable/map'
	| '/timetable/manual-edit'
	| '/timetable/building';

export function resolveTimetableRouteForView(centerView: string): TimetableCenterRoute {
	switch (centerView) {
		case 'policy':
			return '/timetable/policies';
		case 'pre-generation':
			return '/timetable/pre-generation';
		case 'map':
			return '/timetable/map';
		case 'manual-edit':
			return '/timetable/manual-edit';
		case 'building':
			return '/timetable/building';
		default:
			return '/timetable';
	}
}

/**
 * UX-R03a (F2) — the restore target when the guard dialog closes, or `null`
 * when the address bar already describes the view shown. Accepted navigations
 * converge on their own (the confirmed action sets the matching view);
 * a cancelled navigation leaves the stale URL behind and must restore it.
 */
export function resolveUrlRestoreTarget(pathname: string, centerView: string): string | null {
	const target = resolveTimetableRouteForView(centerView);
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return normalized === target ? null : target;
}

type TimetableRouteViewSyncProps = {
	centerView: string;
	switchCenterViewWithGuard: (action: () => void) => void;
	enterPolicyView: () => void;
	exitPolicyView: () => void;
	/**
	 * UX-R03b — plain route entries for the four newly routed views. Each one
	 * only sets the existing centerView state (no data request, no draft
	 * mutation); the sync below always invokes them through the guarded
	 * setter, so the unsaved-change guard is never bypassed. Richer in-app
	 * entries (reference-data fetch, draft reset) stay on their buttons.
	 */
	enterPreGenerationView: () => void;
	enterMapView: () => void;
	enterManualEditView: () => void;
	enterBuildingView: () => void;
	/** Open state of the existing leave-draft guard dialog; drives F2 restore. */
	leaveDialogOpen: boolean;
};

/**
 * UX-R03a — makes the URL the source of truth for the existing `centerView`
 * state on the two routed surfaces. Both directions pass through the existing
 * guarded setter, so the unsaved-change guard is never bypassed by navigation
 * or by direct URL entry; the guard's behaviour is unchanged.
 *
 * UX-R03b — extended to all six existing center views. Route entries for the
 * four new views are plain guarded view setters (no fetch, no draft side
 * effect); selection-dependent panes (`manual-edit`, `building`) render a
 * truthful empty state when entered without a selection.
 *
 * The effect is keyed on the pathname only (callbacks and the current view are
 * read through refs). In-app transitions that never change the URL are never
 * yanked back by this sync. This component dispatches no
 * data requests — it only reuses the existing state.
 */
export function TimetableRouteViewSync({
	centerView,
	switchCenterViewWithGuard,
	enterPolicyView,
	exitPolicyView,
	enterPreGenerationView,
	enterMapView,
	enterManualEditView,
	enterBuildingView,
	leaveDialogOpen,
}: TimetableRouteViewSyncProps) {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const centerViewRef = useRef(centerView);
	centerViewRef.current = centerView;
	const pathnameRef = useRef(pathname);
	pathnameRef.current = pathname;
	const callbacksRef = useRef({
		switchCenterViewWithGuard,
		enterPolicyView,
		exitPolicyView,
		enterPreGenerationView,
		enterMapView,
		enterManualEditView,
		enterBuildingView,
	});
	callbacksRef.current = {
		switchCenterViewWithGuard,
		enterPolicyView,
		exitPolicyView,
		enterPreGenerationView,
		enterMapView,
		enterManualEditView,
		enterBuildingView,
	};
	const appliedPathnameRef = useRef<string | null>(null);
	const leaveDialogOpenRef = useRef(leaveDialogOpen);

	useEffect(() => {
		if (appliedPathnameRef.current === pathname) return;
		appliedPathnameRef.current = pathname;
		const desired = resolveTimetableRouteView(pathname);
		if (centerViewRef.current === desired) return;
		const {
			switchCenterViewWithGuard: guarded,
			enterPolicyView: enter,
			exitPolicyView: exit,
			enterPreGenerationView: enterPreGeneration,
			enterMapView: enterMap,
			enterManualEditView: enterManualEdit,
			enterBuildingView: enterBuilding,
		} = callbacksRef.current;
		switch (desired) {
			case 'policy':
				guarded(enter);
				break;
			case 'pre-generation':
				guarded(enterPreGeneration);
				break;
			case 'map':
				guarded(enterMap);
				break;
			case 'manual-edit':
				guarded(enterManualEdit);
				break;
			case 'building':
				guarded(enterBuilding);
				break;
			default:
				guarded(exit);
				break;
		}
	}, [pathname]);

	// UX-R03a (F2) — when the leave-draft guard dialog closes, the address bar
	// must describe the center view actually shown. A confirmed navigation
	// already converges (its action sets the matching view, so the target is
	// null); a cancelled one leaves the stale URL behind, so replace it with
	// the route for the shown view. This never sets view state — the existing
	// view remains the single source of truth.
	useEffect(() => {
		const wasOpen = leaveDialogOpenRef.current;
		leaveDialogOpenRef.current = leaveDialogOpen;
		if (wasOpen !== true || leaveDialogOpen !== false) return;
		const target = resolveUrlRestoreTarget(pathnameRef.current, centerViewRef.current);
		if (target !== null) navigate(target, { replace: true });
	}, [leaveDialogOpen, navigate]);

	return null;
}
