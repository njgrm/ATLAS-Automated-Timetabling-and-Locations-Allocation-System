import {
	Menu,
	Wifi,
	WifiOff,
	X,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { captureBridgeToken, getBackHref as _getBackHref } from '@/lib/bridge';
import { applyEnrollProAccentTheme, fetchPublicSettings, verifySessionToken } from '@/lib/settings';
import { invalidateActiveSchoolYearContext, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import {
	evaluateRolloverTransition,
	persistRolloverAwarenessNotice,
	readRolloverAwarenessNotice,
	type RolloverAwarenessNotice,
} from '@/lib/rollover-awareness';
import {
	clearAtlasAuthStorage,
	clearBridgeToken,
	clearLocalToken,
	clearUserRoleCache,
	hasAnyAuthToken,
	isFacultyPortalRoute,
} from '@/lib/auth';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Separator } from '@/ui/separator';
import { Skeleton } from '@/ui/skeleton';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/ui/sidebar';
import { AccessibilityMenu } from '@/components/AccessibilityMenu';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import { useAccessibility } from '@/hooks/useAccessibility';
import {
	isRolloverCompletionEvent,
	useNotificationStream,
	type NotificationStreamEvent,
} from '@/hooks/useNotificationStream';

import { AppSidebar } from './app-shell/AppSidebar';
import { FacultyMobileBottomNav } from '@/components/app-shell/FacultyMobileBottomNav';
import { MobileNavigationDrawer } from './app-shell/MobileNavigationDrawer';
import {
	breadcrumbGroups,
	auditNav,
	facultyNav,
	navigationNav,
	reviewPublishNav,
	setupNav,
	teachersAndRoomsNav,
	timetableNav,
	type NavItemDef,
} from './app-shell/navigation';

// Re-import to satisfy linter without unused warning when bridge href is used elsewhere later.
void _getBackHref;

/* ─── Constants ─── */

const ENROLLPRO_URL = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://100.88.55.125:5173';
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

/* ─── AppShell ─── */

export function AppShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const outlet = useOutlet();
	const { fontSize, setFontSize } = useAccessibility();
	const reduceMotion = useReducedMotion();
	const isTimetableRoute = location.pathname.startsWith('/timetable');
	const suspenseFallback = isTimetableRoute
		? <TimetableSkeleton />
		: <div className="p-6"><Skeleton className="h-100 w-full rounded-lg" /></div>;
	const [sidebarOpen, setSidebarOpen] = useState(() => (
		window.location.pathname.startsWith('/timetable') ? false : readSidebarOpenPreference()
	));
	const previousPathnameRef = useRef(location.pathname);
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
	const [authSource, setAuthSource] = useState<'bridge' | 'local' | null>(null);
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [mobileSyncLabel, setMobileSyncLabel] = useState<'Online' | 'Offline' | 'Syncing'>(() => navigator.onLine ? 'Online' : 'Offline');
	const authCheckSeqRef = useRef(0);

	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN' || bridgeUser?.role === 'officer';
	const isFaculty = bridgeUser?.role === 'faculty';
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
			setActiveTermLabel(context.activeTerm?.activeTerm ?? null);
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
	}, [verifyActiveSchoolYear]);

	useNotificationStream({
		schoolId: actorSchoolId,
		schoolYearId: selectedYearId,
		enabled: actorSchoolId != null,
		schoolEventsEnabled: isAdmin,
		onEvent: handleNotification,
	});

	const mobileNavItems = useMemo(() => {
		if (isFaculty) return facultyNav;
		const aggregated = [
			...navigationNav,
			...setupNav,
			...teachersAndRoomsNav,
			...timetableNav,
			...reviewPublishNav,
			...auditNav,
		]
			.filter((item) => !item.disabled)
			.filter((item) => !item.adminOnly || isAdmin);
		const deduped = new Map<string, NavItemDef>();
		for (const item of aggregated) deduped.set(item.to, item);
		return [...deduped.values()];
	}, [isAdmin, isFaculty]);

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

	useLayoutEffect(() => {
		const wasTimetableRoute = previousPathnameRef.current.startsWith('/timetable');
		if (isTimetableRoute && !wasTimetableRoute) setSidebarOpen(false);
		if (!isTimetableRoute && wasTimetableRoute) setSidebarOpen(readSidebarOpenPreference());
		previousPathnameRef.current = location.pathname;
	}, [isTimetableRoute, location.pathname]);

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

	useEffect(() => {
		if (!hasAnyAuthToken()) {
			setBridgeUser(null);
			setAuthSource(null);
			clearUserRoleCache();
			navigate('/login', { replace: true });
			return;
		}

		authCheckSeqRef.current += 1;
		const checkSeq = authCheckSeqRef.current;

		verifySessionToken().then((u) => {
			if (checkSeq !== authCheckSeqRef.current) return;

			if (!u) {
				setBridgeUser(null);
				setAuthSource(null);
				clearAtlasAuthStorage();
				navigate('/login', { replace: true });
				return;
			}

			setBridgeUser(u);
			setAuthSource(u.authSource ?? 'bridge');
			localStorage.setItem('userRole', u.role);

			if (u.role === 'faculty' && !isFacultyPortalRoute(location.pathname)) {
				navigate('/my', { replace: true });
			}
		});
	}, [navigate]);

	useEffect(() => {
		if (bridgeUser?.role !== 'faculty') return;
		if (!isFacultyPortalRoute(location.pathname)) navigate('/my', { replace: true });
	}, [bridgeUser?.role, location.pathname, navigate]);

	const handleLogout = () => {
		if (authSource === 'bridge') {
			clearBridgeToken();
			clearUserRoleCache();
			window.location.href = `${ENROLLPRO_URL}/login`;
			return;
		}
		clearLocalToken();
		clearUserRoleCache();
		setBridgeUser(null);
		setAuthSource(null);
		navigate('/login', { replace: true });
	};

	const breadcrumbs = (() => {
		for (const group of breadcrumbGroups) {
			for (const item of group.items) {
				if (location.pathname === item.to) {
					if (group.label === 'Navigation') return [{ label: item.label }];
					return [{ label: group.label }, { label: item.label }];
				}
			}
		}
		return [{ label: 'ATLAS' }];
	})();
	const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'ATLAS';
	const eyebrowLabel = breadcrumbs.length > 1 ? breadcrumbs[0]?.label : null;

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
							<Badge
								variant='outline'
								className={`h-7 px-2 text-[0.65rem] ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
							>
								{isOnline ? <Wifi className='mr-1 size-3' /> : <WifiOff className='mr-1 size-3' />}
								{mobileSyncLabel}
							</Badge>
						</>
				) : (
					<>
						<SidebarTrigger className='-ml-1 hidden lg:inline-flex' />
						<Separator orientation='vertical' className='mr-2 h-4! hidden lg:block' />
						<div className='flex flex-col'>
							{eyebrowLabel && (
								<span className='text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider'>
									{eyebrowLabel}
								</span>
							)}
							<span className='text-base font-bold text-foreground'>
								{currentPageTitle}
							</span>
						</div>

						<div className='ml-auto flex items-center gap-2'>
								<AccessibilityMenu fontSize={fontSize} setFontSize={setFontSize} />
								{activeTermLabel && (
									<Badge
										variant='outline'
										className='h-7 px-2 text-[0.65rem] border-primary/20 bg-primary/5 text-primary hidden sm:inline-flex'
									>
										Active Term: {activeTermLabel}
									</Badge>
								)}
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
						</div>
					</section>
				)}

				{isMobile && (
					<MobileNavigationDrawer
						open={mobileNavOpen}
						onClose={() => setMobileNavOpen(false)}
						items={mobileNavItems}
						currentPathname={location.pathname}
						onLogout={handleLogout}
					/>
				)}

				<AnimatePresence mode="wait">
					<motion.div
						key={`${location.pathname}:${routeEpoch}`}
						initial={reduceMotion ? false : { opacity: 0 }}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
						exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'linear' }}
						className={`flex-1 min-h-0 overflow-hidden ${isMobile && isFaculty ? 'pb-16' : ''}`}
					>
						<Suspense fallback={suspenseFallback}>
							{outlet && React.cloneElement(outlet as React.ReactElement, { key: `${location.pathname}:${routeEpoch}` })}
						</Suspense>
					</motion.div>
				</AnimatePresence>

				{isMobile && isFaculty && <FacultyMobileBottomNav />}
			</SidebarInset>
		</SidebarProvider>
	);
}
