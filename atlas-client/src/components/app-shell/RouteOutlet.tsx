/**
 * A5 C4 ITEM 4 (2026-09-29) — the route outlet, and the loading state a route
 * change shows AT ONCE.
 *
 * THE FINDING, VERBATIM (Lane C, Codex staging walk, train 6):
 *   "when you change page, the old page's content stays up (for example,
 *    /teachers showed Sections). Show that page's own loading state."
 * Codex run 2 scored it MAJOR, under route changes.
 *
 * THE CAUSE, AND IT IS NOT A TIMING BUG.
 *
 * `AppShell` wrapped the outlet in `<AnimatePresence mode="wait">`:
 *
 *     <AnimatePresence mode="wait">
 *       <motion.div key={resolveOutletKey(location.pathname, routeEpoch)} ...>
 *         <Suspense fallback={<Skeleton className="h-100 w-full" />}>
 *
 * `mode="wait"` means the NEW route is not rendered until the OLD one has finished
 * EXITING. The old page therefore stays mounted and visible under the new URL for
 * the whole exit window — and that window is not bounded in practice: the exit
 * completes on an animation frame, so a throttled or blocked main thread (exactly
 * what the A8 stalls and the leaked live-update streams cause) can hold the previous
 * page on screen indefinitely. A scheduler who clicks "Teachers" and sees Sections
 * is reading a screen that is no longer the page they asked for.
 *
 * On top of that the fallback was ONE GREY BAR — `<Skeleton className="h-100
 * w-full" />` — which is not a loading state a scheduler can read at all: no words,
 * no page named, nothing to tell them the app is working.
 *
 * WHAT THIS FILE IS, AND WHY THE EXTRACTION IS THE POINT OF THE ITEM.
 *
 * `AppShell` is a 595-line authenticated shell: sidebar, auth bridge, school-year
 * switcher, rollover notice, mobile drawer, breadcrumb chrome, accessibility menu.
 * None of that is in scope, and a test that mounts it to observe a Suspense boundary
 * has to stand up all of it. So the outlet and its fallback are extracted here — the
 * testable seam — and `AppShell` composes it. That is also what keeps the shell
 * under the AGENTS.md 8 file-size cap once the panel is added.
 *
 * AGENTS.md 11, applied to the fallback:
 *   1 ONE PRIMARY ACTION — a route change has no action; the panel only has to say
 *     which page is arriving, so the scheduler knows the click registered.
 *   2 NOTHING CRAMPED — a centred panel, not a full-height grey bar pretending to be
 *     a page.
 *   3 NO JARGON — the page's OWN title, taken from `resolveRouteChrome`, which is the
 *     same function the header and breadcrumbs already use. There is deliberately no
 *     second title source: two would drift.
 *   4 ONE STATUS PER FACT — "Loading <page>" is the only thing on screen.
 *
 * `resolveOutletKey`'s SIGNATURE AND VALUE ARE UNCHANGED. The `key` on the outlet is
 * what gives a route change a clean remount, and `resolveOutletKey` is exported and
 * pinned by tests, so it is used here exactly as the shell used it.
 */
import { Suspense, cloneElement } from 'react';
import { motion } from 'motion/react';
import { AdminStatePanel } from '@/components/admin-workspace/AdminWorkspace';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import { BookOpen } from 'lucide-react';

/**
 * The page's OWN loading state, named by the page being opened.
 *
 * The page name comes from the caller, which reads it out of `resolveRouteChrome` —
 * the same source as the header and the breadcrumbs. `/timetable` keeps its existing
 * `TimetableSkeleton`, which already works and is a schedule-shaped placeholder
 * rather than a generic one.
 *
 * ONE SENTENCE. A second line of helper text under a button is the thing AGENTS.md
 * §8's header budget calls out, and there is nothing a scheduler can do while a page
 * loads, so there is nothing to instruct.
 */
export function RouteLoadingPanel({ pageName, timetable }: { pageName: string; timetable: boolean }) {
	if (timetable) return <TimetableSkeleton />;
	return (
		<div className="p-6" data-testid="route-loading-panel">
			<AdminStatePanel icon={<BookOpen className="size-8" />} title={`Loading ${pageName}…`} />
		</div>
	);
}

type Props = {
	/** The outlet element from `useOutlet()`. `null` when the route renders no child. */
	outlet: React.ReactElement | null;
	/** `resolveOutletKey(location.pathname, routeEpoch)` — unchanged, and still the remount key. */
	outletKey: string;
	/** `routeChrome.title` from `resolveRouteChrome(location.pathname)`. */
	pageName: string;
	/** True for `/timetable`, which keeps its own schedule-shaped skeleton. */
	timetable: boolean;
	/** The shell's padding for the faculty mobile bottom nav. */
	className: string;
	/**
	 * A5 C4: the fade is KEPT, and the exit animation is REMOVED.
	 *
	 * `mode="wait"` was what held the old page on screen; an `exit` prop only means
	 * something while something is waiting for it. With no `AnimatePresence` there is
	 * no exit phase, so the new route renders on the same commit the URL changes —
	 * which is the whole fix. The 150ms fade-in stays, so a route change still reads
	 * as a page change rather than a flicker.
	 */
	reduceMotion: boolean;
};

export function RouteOutlet({ outlet, outletKey, pageName, timetable, className, reduceMotion }: Props) {
	// THE FIX. There is no `AnimatePresence` and no `exit` prop, so there is no phase
	// that can wait: the new route renders on the same commit the url changes. The
	// 150ms fade-in is kept, because a route change should still read as a page
	// change rather than a flicker — what was removed is the EXIT, and an exit only
	// existed in order to be waited on.
	return (
		<motion.div
			key={outletKey}
			data-testid="route-outlet"
			data-page={pageName}
			initial={reduceMotion ? false : { opacity: 0 }}
			animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
			transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'linear' }}
			className={className}
		>
			<Suspense fallback={<RouteLoadingPanel pageName={pageName} timetable={timetable} />}>
				{/* `cloneElement` with the key, EXACTLY as the shell did it: the remount
				    key belongs on the outlet element itself, and a wrapper <div> here
				    would change the DOM every route renders into. */}
				{outlet ? cloneElement(outlet, { key: outletKey }) : null}
			</Suspense>
		</motion.div>
	);
}
