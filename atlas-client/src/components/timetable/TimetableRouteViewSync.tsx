import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * UX-R03a — the two center views that have a URL. Everything else under
 * `/timetable` (index, trailing slash, unknown children once the router
 * fallback redirects them) maps to the schedule surface.
 */
export type TimetableRoutedView = 'schedule' | 'policy';

/**
 * UX-R03a — pure route→view mapping for the two routed center views.
 * `/timetable/policies` renders the existing policy pane; every other
 * `/timetable*` pathname renders the index (schedule) surface.
 */
export function resolveTimetableRouteView(pathname: string): TimetableRoutedView {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return normalized === '/timetable/policies' ? 'policy' : 'schedule';
}

/**
 * UX-R03a (F2) — the route that truthfully describes the center view actually
 * shown. Only `policy` has its own route; every other view (including the
 * unrouted pre-generation/manual-edit/map/building surfaces) is described by
 * the index route, exactly as before this increment.
 */
export function resolveTimetableRouteForView(centerView: string): '/timetable' | '/timetable/policies' {
	return centerView === 'policy' ? '/timetable/policies' : '/timetable';
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
	/** Open state of the existing leave-draft guard dialog; drives F2 restore. */
	leaveDialogOpen: boolean;
};

/**
 * UX-R03a — makes the URL the source of truth for the existing `centerView`
 * state on the two routed surfaces. Both directions pass through the existing
 * guarded setter, so the unsaved-change guard is never bypassed by navigation
 * or by direct URL entry; the guard's behaviour is unchanged.
 *
 * The effect is keyed on the pathname only (callbacks and the current view are
 * read through refs). In-app transitions to the four unrouted views
 * (`pre-generation`, `manual-edit`, `map`, `building`) never change the URL,
 * so they are never yanked back by this sync. This component dispatches no
 * data requests — it only reuses the existing state.
 */
export function TimetableRouteViewSync({
	centerView,
	switchCenterViewWithGuard,
	enterPolicyView,
	exitPolicyView,
	leaveDialogOpen,
}: TimetableRouteViewSyncProps) {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const centerViewRef = useRef(centerView);
	centerViewRef.current = centerView;
	const pathnameRef = useRef(pathname);
	pathnameRef.current = pathname;
	const callbacksRef = useRef({ switchCenterViewWithGuard, enterPolicyView, exitPolicyView });
	callbacksRef.current = { switchCenterViewWithGuard, enterPolicyView, exitPolicyView };
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
		} = callbacksRef.current;
		if (desired === 'policy') {
			guarded(enter);
		} else {
			guarded(exit);
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
