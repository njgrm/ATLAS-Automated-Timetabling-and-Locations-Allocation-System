import {
	Menu,
	Wifi,
	WifiOff,
	X,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';

import { captureBridgeToken } from '@/lib/bridge';
import { resolveEnrollProLogoutRedirect } from '@/lib/companion-config';
import { applyEnrollProAccentTheme, fetchPublicSettings } from '@/lib/settings';
import { verifySessionWithinDeadline } from '@/lib/session-verification';
import { invalidateActiveSchoolYearContext, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';
import {
	clearRolloverAwarenessNotice,
	evaluateRolloverTransition,
	persistRolloverAwarenessNotice,
	readRolloverAwarenessNotice,
	type RolloverAwarenessNotice,
} from '@/lib/rollover-awareness';
import {
	ATLAS_SESSION_EXPIRED_EVENT,
	clearAtlasAuthStorage,
	clearBridgeToken,
	clearLocalToken,
	clearUserRoleCache,
	isFacultyPortalRoute,
	subscribeAtlasTokenEpoch,
} from '@/lib/auth';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Separator } from '@/ui/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/ui/sidebar';
import { AccessibilityMenu } from '@/components/AccessibilityMenu';
import { RouteOutlet } from '@/components/app-shell/RouteOutlet';
import { useAccessibility } from '@/hooks/useAccessibility';
import {
	isRolloverCompletionEvent,
	useNotificationStream,
	type NotificationStreamEvent,
} from '@/hooks/useNotificationStream';
import { notifyNotificationInboxInvalidated } from '@/hooks/useNotificationInbox';
import { NotificationBell } from '@/components/app-shell/NotificationBell';

import { AppSidebar } from './app-shell/AppSidebar';
import { AppBreadcrumbs } from './app-shell/PageHeader';
import { SessionVerificationNotice } from './app-shell/SessionVerificationNotice';
import { FacultyMobileBottomNav } from '@/components/app-shell/FacultyMobileBottomNav';
import { MobileNavigationDrawer } from './app-shell/MobileNavigationDrawer';
import {
	auditNav,
	facultyNav,
	navigationNav,
	reviewPublishNav,
	setupNav,
	teachersAndRoomsNav,
	timetableNav,
	resolveRouteChrome,
	getVisibleNavigation,
} from './app-shell/navigation';

/* ─── Constants ─── */

const SHELL_BRANDING_CACHE_KEY = 'atlas:shell-branding:v1';
const DEFAULT_SHELL_SCHOOL_NAME = 'ATLAS High School';
const SIDEBAR_COOKIE_NAME = 'sidebar:state';

type ShellBrandingCache = {
	schoolName: string;
	logoUrl: string | null;
	cachedAt: string;
};

function readShellBrandingCache(): ShellBrandingCache | null {
	try {
		const raw = localStorage.getItem(SHELL_BRANDING_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ShellBrandingCache;
		if (!parsed || typeof parsed.schoolName !== 'string' || !parsed.cachedAt) return null;
		return {
			schoolName: parsed.schoolName,
			logoUrl: parsed.logoUrl ?? null,
			cachedAt: parsed.cachedAt,
		};
	} catch {
		return null;
	}
}

function writeShellBrandingCache(schoolName: string, logoUrl: string | null): void {
	try {
		const payload: ShellBrandingCache = {
			schoolName,
			logoUrl,
			cachedAt: new Date().toISOString(),
		};
		localStorage.setItem(SHELL_BRANDING_CACHE_KEY, JSON.stringify(payload));
	} catch {
		// Ignore storage restrictions.
	}
}

function enrollProAsset(path: string | null): string {
	if (!path) return '';
	return path.replace(/^\/uploads/, '/enrollpro-uploads');
}

function readSidebarOpenPreference(): boolean {
	const match = document.cookie
		.split('; ')
		.find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
	if (!match) return true;
	return match.split('=')[1] === 'true';
}

/* ─── Route outlet key (UX-R03d) ─── */

export function resolveOutletKey(pathname: string, routeEpoch: number): string {
	const scope = pathname === '/timetable' || pathname.startsWith('/timetable/') ? '/timetable' : pathname;
	return `${scope}:${routeEpoch}`;
}

/* ─── AppShell ─── */

export function AppShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const outlet = useOutlet();
	const { fontSize, setFontSize } = useAccessibility();
	const reduceMotion = useReducedMotion();
	const isTimetableRoute = location.pathname.startsWith('/timetable');
	const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpenPreference);
	const [schoolName, setSchoolName] = useState(() => readShellBrandingCache()?.schoolName ?? DEFAULT_SHELL_SCHOOL_NAME);
	const [logoUrl, setLogoUrl] = useState<string | null>(() => readShellBrandingCache()?.logoUrl ?? null);
	const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);
	const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null);
	const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
	const runtimeYearRef = useRef<{ id: number | null; label: string | null }>({ id: null, label: null });
	const verificationInFlightRef = useRef(false);
	const [routeEpoch, setRouteEpoch] = useState(0);
	const [rolloverNotice, setRolloverNotice] = useState<RolloverAwarenessNotice | null>(null);
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [sessionVerificationState, setSessionVerificationState] = useState<'verifying' | 'authenticated' | 'unauthenticated' | 'unconfirmed'>('verifying');
	const [authSource, setAuthSource] = useState<'bridge' | 'local' | null>(null);
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [mobileSyncLabel, setMobileSyncLabel] = useState<'Online' | 'Offline' | 'Syncing'>(() => navigator.onLine ? 'Online' : 'Offline');
	const authCheckSeqRef = useRef(0);

	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN' || bridgeUser?.role === 'officer';
	const isFaculty = bridgeUser?.role === 'faculty' || bridgeUser?.capabilities?.includes('faculty:self-service') === true;
	const actorSchoolId = typeof bridgeUser?.schoolId === 'number'
		&& Number.isInteger(bridgeUser.schoolId)
		&& bridgeUser.schoolId > 0
		? bridgeUser.schoolId
		: null;

	const verifyActiveSchoolYear = useCallback(async (reason: 'initial' | 'event' | 'recovery') => {
		if (!actorSchoolId || verificationInFlightRef.current) return;
		verificationInFlightRef.current = true;
		try {
			if (reason !== 'initial') invalidateActiveSchoolYearContext(actorSchoolId);
			const context = await resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				forceRefresh: true,
				verifyUpstream: true,
				allowStaleOnError: false,
				allowEnrollProFallback: false,
			});
			const previous = runtimeYearRef.current;
			runtimeYearRef.current = { id: context.activeSchoolYearId, label: context.activeSchoolYearLabel ?? null };
			setSelectedYearId(context.activeSchoolYearId);
			setActiveYearLabel(context.activeSchoolYearLabel ?? `School year ${context.activeSchoolYearId}`);
			setActiveTermLabel(isVerifiedOrderedActiveTerm(context.activeTerm)
				? context.activeTerm?.activeTerm ?? null
				: null);
			const transition = evaluateRolloverTransition({
				schoolId: actorSchoolId,
				previous,
				next: { id: context.activeSchoolYearId, label: context.activeSchoolYearLabel ?? null },
			});
			if (transition.changed && transition.notice) {
				persistRolloverAwarenessNotice(transition.notice);
				setRolloverNotice(transition.notice);
				setRouteEpoch((epoch) => epoch + 1);
			}
		} catch {
			// Remain on the last verified context. Recovery triggers will retry.
		} finally {
			verificationInFlightRef.current = false;
		}
	}, [actorSchoolId]);

	const handleNotification = useCallback((event: NotificationStreamEvent) => {
		if (isRolloverCompletionEvent(event)) void verifyActiveSchoolYear('event');
		// NOTIFICATION-INBOX-C01 (D5): the stream keeps its job — a stream
		// event only invalidates the durable inbox query so the bell updates
		// live. No polling, no stream replacement.
		notifyNotificationInboxInvalidated();
	}, [verifyActiveSchoolYear]);

	useNotificationStream({
		schoolId: actorSchoolId,
		schoolYearId: selectedYearId,
		enabled: actorSchoolId != null,
		schoolEventsEnabled: isAdmin,
		onEvent: handleNotification,
	});

	const mobileNavItems = useMemo(() => {
		if (!bridgeUser) return [];
		return getVisibleNavigation(bridgeUser);
	}, [bridgeUser]);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 1023px)');
		const onChange = (event: MediaQueryListEvent) => {
			setIsMobile(event.matches);
			if (!event.matches) setMobileNavOpen(false);
		};
		setIsMobile(media.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		const updateSyncState = () => {
			const online = navigator.onLine;
			setIsOnline(online);
			if (!online) { setMobileSyncLabel('Offline'); return; }
			let hasQueued = false;
			for (let index = 0; index < localStorage.length; index += 1) {
				const key = localStorage.key(index);
				if (!key || !key.startsWith('atlas:room-pref-outbox:')) continue;
				const raw = localStorage.getItem(key);
				if (!raw) continue;
				try {
					const parsed = JSON.parse(raw) as Array<{ status?: string }>;
					if (Array.isArray(parsed) && parsed.length > 0) { hasQueued = true; break; }
				} catch {
					continue;
				}
			}
			setMobileSyncLabel(hasQueued ? 'Syncing' : 'Online');
		};

		updateSyncState();
		window.addEventListener('online', updateSyncState);
		window.addEventListener('offline', updateSyncState);
		const timer = window.setInterval(updateSyncState, 2500);
		return () => {
			window.removeEventListener('online', updateSyncState);
			window.removeEventListener('offline', updateSyncState);
			window.clearInterval(timer);
		};
	}, [location.pathname]);

	useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

	useLayoutEffect(() => { captureBridgeToken(); }, []);

	useEffect(() => {
		if (!actorSchoolId) {
			runtimeYearRef.current = { id: null, label: null };
			setSelectedYearId(null);
			setActiveYearLabel(null);
			setActiveTermLabel(null);
			setRolloverNotice(null);
			return;
		}
		setRolloverNotice(readRolloverAwarenessNotice(actorSchoolId));
		void verifyActiveSchoolYear('initial');
	}, [actorSchoolId, verifyActiveSchoolYear]);

	useEffect(() => {
		if (!actorSchoolId) return;
		const recover = () => { if (navigator.onLine) void verifyActiveSchoolYear('recovery'); };
		const onVisibilityChange = () => { if (document.visibilityState === 'visible') recover(); };
		window.addEventListener('focus', recover);
		window.addEventListener('online', recover);
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.removeEventListener('focus', recover);
			window.removeEventListener('online', recover);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [actorSchoolId, verifyActiveSchoolYear]);

	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				const raw = s.schoolName || 'High School';
				const hsLabel = /high\s*school/i.test(raw) ? raw : `${raw}`;
				const nextSchoolName = `ATLAS ${hsLabel}`;
				setSchoolName(nextSchoolName);
				setLogoUrl(s.logoUrl);
				writeShellBrandingCache(nextSchoolName, s.logoUrl ?? null);

				if (s.logoUrl) {
					const faviconUrl = enrollProAsset(s.logoUrl);
					let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
					if (!link) {
						link = document.createElement('link');
						link.rel = 'icon';
						document.head.appendChild(link);
					}
					link.href = faviconUrl;
				}

				applyEnrollProAccentTheme(s.selectedAccentHsl);
			})
			.catch(() => {
				const cached = readShellBrandingCache();
				if (cached) {
					setSchoolName(cached.schoolName);
					setLogoUrl(cached.logoUrl ?? null);
					return;
				}
				setSchoolName(DEFAULT_SHELL_SCHOOL_NAME);
				setLogoUrl(null);
			});
	}, []);

	const verifyActorSession = useCallback(() => {
		// A7-C5: ONE deadline-bound resolver, shared with `/admin/year-setup`.
		// The three outcomes are not interchangeable, and the middle one is new:
		//
		//   unauthenticated — a real answer (no token, `null`, a rejection). The
		//     existing clear-and-redirect authority is UNCHANGED; a dead session
		//     is still dead. `no-token` keeps its narrower historical cleanup
		//     (`clearUserRoleCache` only) so this does not silently widen what an
		//     absent token destroys.
		//   unconfirmed — NO answer. The server was slow. Nothing is cleared, the
		//     operator is not signed out, and there is no redirect to `/login`.
		//   authenticated — unchanged.
		//
		// The `catch` branch is gone on purpose: the resolver never throws, and a
		// throw here would read as "signed out" over a slow network.
		setSessionVerificationState('verifying');
		authCheckSeqRef.current += 1;
		const checkSeq = authCheckSeqRef.current;

		void verifySessionWithinDeadline().then((outcome) => {
			if (checkSeq !== authCheckSeqRef.current) return;

			if (outcome.kind === 'unconfirmed') {
				// Keep `bridgeUser` and the auth source exactly as they are: this
				// is not a logout, and dropping them would blank a shell that was
				// working a moment ago.
				setSessionVerificationState('unconfirmed');
				return;
			}

			if (outcome.kind === 'unauthenticated') {
				setSessionVerificationState('unauthenticated');
				setBridgeUser(null);
				setAuthSource(null);
				if (outcome.reason === 'no-token') clearUserRoleCache();
				else clearAtlasAuthStorage();
				navigate('/login', { replace: true });
				return;
			}

			const u = outcome.user;
			setBridgeUser(u);
			setSessionVerificationState('authenticated');
			setAuthSource(u.authSource ?? 'bridge');
			localStorage.setItem('userRole', u.role);

			if (u.role === 'faculty' && !isFacultyPortalRoute(location.pathname)) {
				navigate('/my', { replace: true });
			}
		});
	}, [navigate]);

	useEffect(() => {
		verifyActorSession();
	}, [verifyActorSession]);

	// ACTOR-SCOPE-C01: a token mutation (login, logout, same-tab re-login,
	// bridge-token replacement, expiry) must drop the previous actor's shell state
	// and re-verify the new session in place — no page reload. The notification
	// stream and year verification stay disabled until the new actor school
	// resolves, so no scoped request is dispatched from stale scope.
	useEffect(() => {
		return subscribeAtlasTokenEpoch(() => {
			setSessionVerificationState('verifying');
			setBridgeUser(null);
			setAuthSource(null);
			runtimeYearRef.current = { id: null, label: null };
			setSelectedYearId(null);
			setActiveYearLabel(null);
			setActiveTermLabel(null);
			setRolloverNotice(null);
			verifyActorSession();
		});
	}, [verifyActorSession]);

	useEffect(() => {
		if (bridgeUser?.role !== 'faculty') return;
		if (!isFacultyPortalRoute(location.pathname)) navigate('/my', { replace: true });
	}, [bridgeUser?.role, location.pathname, navigate]);

	// DASH-RESILIENCE-C01 — canonical expired-session handling. A dashboard
	// data request that returns HTTP 401 raises this event; the shell performs
	// the same clear-and-navigate flow as a failed session verification so no
	// business values are rendered from an unauthorized read.
	useEffect(() => {
		const handleExpiredSession = () => {
			setSessionVerificationState('unauthenticated');
			setBridgeUser(null);
			setAuthSource(null);
			clearAtlasAuthStorage();
			navigate('/login', { replace: true });
		};
		window.addEventListener(ATLAS_SESSION_EXPIRED_EVENT, handleExpiredSession);
		return () => window.removeEventListener(ATLAS_SESSION_EXPIRED_EVENT, handleExpiredSession);
	}, [navigate]);

	const handleLogout = () => {
		setSessionVerificationState('unauthenticated');
		if (authSource === 'bridge') {
			clearBridgeToken();
			clearUserRoleCache();
			setBridgeUser(null);
			setAuthSource(null);
			// Return to the EnrollPro personnel login when the companion origin
			// is configured; otherwise stay local — never navigate to a raw IP.
			const enrollProLogin = resolveEnrollProLogoutRedirect();
			if (enrollProLogin) {
				window.location.href = enrollProLogin;
				return;
			}
			navigate('/login', { replace: true });
			return;
		}
		clearLocalToken();
		clearUserRoleCache();
		setBridgeUser(null);
		setAuthSource(null);
		navigate('/login', { replace: true });
	};

	const routeChrome = resolveRouteChrome(location.pathname);
	const currentPageTitle = routeChrome.title;

	return (
		<SidebarProvider open={isMobile ? false : sidebarOpen} onOpenChange={setSidebarOpen} className="relative">
			<div className="pointer-events-none absolute inset-0" aria-hidden="true">
				<svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<pattern id="pixel-grid-app-layout" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
							<rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
							<rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
							<rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
							<rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#pixel-grid-app-layout)" />
				</svg>
				<div
					className="absolute inset-0"
					style={{ background: 'radial-gradient(circle at center, hsl(var(--primary)/0.05) 0%, transparent 70%)' }}
				/>
			</div>

			{!isMobile && (
				<AppSidebar
					className='hidden lg:flex'
					schoolName={schoolName}
					logoUrl={logoUrl}
					activeYearLabel={activeYearLabel}
					bridgeUser={bridgeUser}
					sessionVerificationState={sessionVerificationState}
					pathname={location.pathname}
					onLogout={handleLogout}
				/>
			)}

			<SidebarInset style={{ backgroundColor: 'transparent' }}>
				<header className='flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4'>
					{isMobile ? (
						<>
							<Button variant='ghost' size='icon' className='h-9 w-9' onClick={() => setMobileNavOpen((open) => !open)}>
								{mobileNavOpen ? <X className='size-5' /> : <Menu className='size-5' />}
								<span className='sr-only'>Open navigation menu</span>
							</Button>
							<div className='flex-1 truncate text-center text-sm font-semibold'>{currentPageTitle}</div>
							<NotificationBell />
							<Badge
								variant='outline'
								className={`h-7 px-2 text-xs ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
							>
								{isOnline ? <Wifi className='mr-1 size-3' /> : <WifiOff className='mr-1 size-3' />}
								{mobileSyncLabel}
							</Badge>
						</>
				) : (
					<>
						<SidebarTrigger className='-ml-1 hidden lg:inline-flex' />
						<Separator orientation='vertical' className='mr-2 h-4! hidden lg:block' />
						<AppBreadcrumbs breadcrumbs={routeChrome.breadcrumbs} />

						<div className='ml-auto flex items-center gap-2'>
								<NotificationBell />
								<AccessibilityMenu fontSize={fontSize} setFontSize={setFontSize} />
							{/* A2-C6-TRUTH (T3b/T3c) — the separate `Active Term:` chip is
							    REMOVED, not reworded. It was a second control for one fact
							    that the term selector already owns, and it read the runtime
							    rollover context's `activeTerm` rather than the term
							    authority the timetable actually filters on — so it could
							    name a term the workspace had not confirmed. The one line
							    that states both facts now lives where the term is chosen
							    (`SimpleTermScopeLine`, and the Expert orientation strip). */}
							{activeYearLabel && (
									<Badge variant='outline' className='min-h-7 px-2 text-xs'>
										Active year: {activeYearLabel}
									</Badge>
								)}
							</div>
						</>
					)}
				</header>

				{rolloverNotice && (
					<section
						role='status'
						aria-live='polite'
						data-testid='rollover-awareness-notice'
						className='flex flex-col gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between'
					>
						<p className='leading-relaxed'>
							School year changed to <strong>{rolloverNotice.activeSchoolYearLabel}</strong>.{' '}
							{rolloverNotice.previousSchoolYearLabel} is archived and read-only. This page refreshed with the new active year.
						</p>
						<div className='flex flex-wrap gap-2'>
							<Button asChild variant='outline' className='min-h-11 bg-white'>
								<Link to={`/teaching-load/history?schoolYearId=${rolloverNotice.previousSchoolYearId}`}>View archived load</Link>
							</Button>
							<Button asChild variant='ghost' className='min-h-11'>
								<Link to='/admin/year-setup'>Year Setup</Link>
							</Button>
							<Button
								type='button'
								variant='ghost'
								size='icon'
								className='min-h-11 min-w-11 text-amber-950'
								data-testid='rollover-awareness-dismiss'
								aria-label='Dismiss school year change notice'
								onClick={() => {
									if (actorSchoolId != null) clearRolloverAwarenessNotice(actorSchoolId);
									setRolloverNotice(null);
								}}
							>
								<X className='size-4' aria-hidden='true' />
							</Button>
						</div>
					</section>
				)}

				{/* A7-C5 — the ONE recovery surface for an unconfirmed sign-in, a
				    sibling of the rollover band above. It is mounted HERE and nowhere
				    else in the tree: a page that rendered its own copy would show the
				    same sentence and a second set of buttons two inches below this
				    one, which is the "two chips that say the same thing" defect
				    §8 forbids. `Try again` re-runs the SAME resolver; `Back to
				    dashboard` is the safe way out that never costs a sign-in. */}
				{sessionVerificationState === 'unconfirmed' && (
					<SessionVerificationNotice
						onRetry={verifyActorSession}
						onBackToDashboard={() => navigate('/', { replace: true })}
					/>
				)}

				{isMobile && (
					<MobileNavigationDrawer
						open={mobileNavOpen}
						onClose={() => setMobileNavOpen(false)}
						items={mobileNavItems}
						currentPathname={location.pathname}
						onLogout={handleLogout}
						privilegedStaff={isAdmin}
					/>
				)}

				{/* A5 C4 (2026-09-29): the outlet, its remount key and its loading state
				    now live in `RouteOutlet` — the testable seam. The exit-wait gate
				    (`mode="wait"`) is GONE and is not replaced by another gate.

				    WHY IT HAD TO GO. `mode="wait"` means the new route is not rendered
				    until the OLD one has finished exiting, so the previous page stayed
				    mounted and VISIBLE under the new URL for the whole exit window. That
				    window completes on an animation frame, so a throttled or blocked
				    main thread — exactly what the A8 stalls cause — could hold the old
				    page on screen indefinitely. Codex saw `/teachers` showing Sections
				    (run 2, MAJOR, route changes).

				    The 150ms fade-in is KEPT on the `motion.div` inside `RouteOutlet`, so
				    a route change still reads as a page change. Only the EXIT phase is
				    removed, because an exit is the phase that had to wait.

				    `resolveOutletKey`'s signature and value are unchanged and still supply
				    the remount key; the page name comes from `routeChrome.title`, i.e.
				    from `resolveRouteChrome` — the same source the header and breadcrumbs
				    read, so there is no second title source to drift. Nothing else in this
				    607-line file is touched: the sidebar, auth bridge, `routeEpoch`, the
				    school-year switcher and every gate here are out of scope. */}
				<RouteOutlet
					outlet={outlet}
					outletKey={resolveOutletKey(location.pathname, routeEpoch)}
					pageName={currentPageTitle}
					timetable={isTimetableRoute}
					reduceMotion={reduceMotion ?? false}
					className={`flex-1 min-h-0 overflow-hidden ${isMobile && isFaculty ? 'pb-16' : ''}`}
				/>

				{isMobile && isFaculty && <FacultyMobileBottomNav />}
			</SidebarInset>
		</SidebarProvider>
	);
}
