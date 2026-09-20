import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

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

type TimetableRouteViewSyncProps = {
	centerView: string;
	switchCenterViewWithGuard: (action: () => void) => void;
	enterPolicyView: () => void;
	exitPolicyView: () => void;
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
}: TimetableRouteViewSyncProps) {
	const { pathname } = useLocation();
	const centerViewRef = useRef(centerView);
	centerViewRef.current = centerView;
	const callbacksRef = useRef({ switchCenterViewWithGuard, enterPolicyView, exitPolicyView });
	callbacksRef.current = { switchCenterViewWithGuard, enterPolicyView, exitPolicyView };
	const appliedPathnameRef = useRef<string | null>(null);

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

	return null;
}
