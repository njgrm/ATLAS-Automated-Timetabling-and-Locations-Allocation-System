import {
	Menu,
	Wifi,
	WifiOff,
	X,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

import { captureBridgeToken, getBackHref as _getBackHref } from '@/lib/bridge';
import { applyEnrollProAccentTheme, fetchPublicSettings, fetchSchoolYears, verifySessionToken } from '@/lib/settings';
import { cacheActiveSchoolYearContext, resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import {
	clearAtlasAuthStorage,
	clearBridgeToken,
	clearLocalToken,
	clearUserRoleCache,
	hasAnyAuthToken,
	isFacultyPortalRoute,
} from '@/lib/auth';
import type { BridgeUser } from '@/types';
import type { SchoolYear } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/ui/breadcrumb';
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

import { AppSidebar } from './app-shell/AppSidebar';
import { MobileNavigationDrawer } from './app-shell/MobileNavigationDrawer';
import { SchoolYearSwitcher } from './app-shell/SchoolYearSwitcher';
import {
	advancedNav,
	breadcrumbGroups,
	buildValidateNav,
	facultyNav,
	facultyPlanningNav,
	inputCollectionNav,
	navigationNav,
	setupNav,
	type NavItemDef,
} from './app-shell/navigation';

// Re-import to satisfy linter without unused warning when bridge href is used elsewhere later.
void _getBackHref;

/* ─── Constants ─── */

const ENROLLPRO_URL = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://100.88.55.125:5173';
const SHELL_BRANDING_CACHE_KEY = 'atlas:shell-branding:v1';
const DEFAULT_SHELL_SCHOOL_NAME = 'ATLAS High School';

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

/* ─── AppShell ─── */

export function AppShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const outlet = useOutlet();
	const { fontSize, setFontSize } = useAccessibility();
	const isTimetableRoute = location.pathname.startsWith('/timetable');
	const suspenseFallback = isTimetableRoute
		? <TimetableSkeleton />
		: <div className="p-6"><Skeleton className="h-100 w-full rounded-lg" /></div>;
	const [sidebarOpen, setSidebarOpen] = useState(() => !window.location.pathname.startsWith('/timetable'));
	const previousPathnameRef = useRef(location.pathname);
	const [schoolName, setSchoolName] = useState(() => readShellBrandingCache()?.schoolName ?? DEFAULT_SHELL_SCHOOL_NAME);
	const [logoUrl, setLogoUrl] = useState<string | null>(() => readShellBrandingCache()?.logoUrl ?? null);
	const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);
	const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
	const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
	const runtimeYearRef = useRef<{ id: number | null; label: string | null }>({ id: null, label: null });
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [authSource, setAuthSource] = useState<'bridge' | 'local' | null>(null);
	const [syOpen, setSyOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [mobileSyncLabel, setMobileSyncLabel] = useState<'Online' | 'Offline' | 'Syncing'>(() => navigator.onLine ? 'Online' : 'Offline');
	const authCheckSeqRef = useRef(0);

	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN' || bridgeUser?.role === 'officer';
	const isFaculty = bridgeUser?.role === 'faculty';

	const mobileNavItems = useMemo(() => {
		if (isFaculty) return facultyNav;
		const aggregated = [
			...navigationNav,
			...setupNav,
			...facultyPlanningNav,
			...inputCollectionNav,
			...buildValidateNav,
			...advancedNav,
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
		previousPathnameRef.current = location.pathname;
	}, [isTimetableRoute, location.pathname]);

	useEffect(() => {
		resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false })
			.then((context) => {
				runtimeYearRef.current = {
					id: context.activeSchoolYearId,
					label: context.activeSchoolYearLabel ?? null,
				};
				setSelectedYearId(context.activeSchoolYearId);
				if (context.activeSchoolYearLabel) setActiveYearLabel(context.activeSchoolYearLabel);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				const runtimeYearId = runtimeYearRef.current.id;
				const runtimeYearLabel = runtimeYearRef.current.label;
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

				if (!runtimeYearId && s.activeSchoolYearId) setSelectedYearId(s.activeSchoolYearId);
				if (!runtimeYearLabel && s.activeSchoolYearLabel) setActiveYearLabel(s.activeSchoolYearLabel);
				if (!runtimeYearId) cacheActiveSchoolYearContext(s.activeSchoolYearId ?? null, s.activeSchoolYearLabel ?? null);
				fetchSchoolYears().then((years) => {
					setSchoolYears(years);
					if (!runtimeYearLabel && !s.activeSchoolYearLabel) {
						const effectiveYearId = runtimeYearId ?? s.activeSchoolYearId;
						const active = years.find((y) => y.id === effectiveYearId);
						if (active) setActiveYearLabel(active.yearLabel);
					}
				});

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
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbLink asChild>
											<Link to='/'>ATLAS</Link>
										</BreadcrumbLink>
									</BreadcrumbItem>
									{breadcrumbs.map((crumb, i) => (
										<React.Fragment key={crumb.label}>
											<BreadcrumbSeparator />
											<BreadcrumbItem>
												{i === breadcrumbs.length - 1 ? (
													<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
												) : (
													<span className='text-sm text-muted-foreground'>{crumb.label}</span>
												)}
											</BreadcrumbItem>
										</React.Fragment>
									))}
								</BreadcrumbList>
							</Breadcrumb>

							<div className='ml-auto flex items-center gap-2'>
								<AccessibilityMenu fontSize={fontSize} setFontSize={setFontSize} />
								<SchoolYearSwitcher
									schoolYears={schoolYears}
									selectedYearId={selectedYearId}
									open={syOpen}
									onToggle={() => setSyOpen(!syOpen)}
									onSelect={(sy) => {
										setSelectedYearId(sy.id);
										setActiveYearLabel(sy.yearLabel);
										setSyOpen(false);
									}}
								/>
							</div>
						</>
					)}
				</header>

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
						key={location.pathname}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15, ease: 'linear' }}
						className='flex-1 min-h-0 overflow-hidden'
					>
						<Suspense fallback={suspenseFallback}>
							{outlet && React.cloneElement(outlet as React.ReactElement, { key: location.pathname })}
						</Suspense>
					</motion.div>
				</AnimatePresence>
			</SidebarInset>
		</SidebarProvider>
	);
}
