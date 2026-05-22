import {
	AlertTriangle,
	BarChart3,
	BookOpen,
	CalendarClock,
	CalendarDays,
	ChevronsUpDown,
	ClipboardList,
	ExternalLink,
	GraduationCap,
	LayoutDashboard,
	Lock,
	LogOut,
	MapPinned,
	Menu,
	School,
	Shield,
	UserCog,
	Users,
	Wifi,
	WifiOff,
	X,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

import { captureBridgeToken, getBackHref } from '@/lib/bridge';
import { applyEnrollProAccentTheme, fetchPublicSettings, fetchSchoolYears, verifySessionToken } from '@/lib/settings';
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
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from '@/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { AccessibilityMenu } from '@/components/AccessibilityMenu';
import { TimetableSkeleton } from '@/components/timetable/TimetableSkeleton';
import { useAccessibility } from '@/hooks/useAccessibility';

/* --- Constants --- */

const ENROLLPRO_URL = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://100.88.55.125:5173';

/** Map an EnrollPro `/uploads/-` path to the Vite proxy prefix. */
function enrollProAsset(path: string | null): string {
	if (!path) return '';
	// logoUrl comes as "/uploads/logo-xxx.jpg"; rewrite to "/enrollpro-uploads/logo-xxx.jpg"
	return path.replace(/^\/uploads/, '/enrollpro-uploads');
}

/* --- Nav structure --- */

type NavItemDef = {
	label: string;
	to: string;
	icon: typeof LayoutDashboard;
	adminOnly?: boolean;
	facultyOnly?: boolean;
	disabled?: boolean;
};

const navigationNav: NavItemDef[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard },
];

const schedulingNav: NavItemDef[] = [
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
	{ label: 'Teachers', to: '/teachers', icon: Users, adminOnly: true },
	{ label: 'Teaching Load', to: '/teaching-load', icon: UserCog, adminOnly: true },
	{ label: 'Audit', to: '/audit', icon: Shield, adminOnly: true },
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true },
	{ label: 'Preferences', to: '/faculty/preferences', icon: ClipboardList, adminOnly: true },
	{ label: 'Timetable', to: '/timetable', icon: CalendarClock, adminOnly: true },
	{ label: 'Room Schedules', to: '/room-schedules', icon: CalendarDays, adminOnly: true },
	{ label: 'Room Requests', to: '/faculty/room-preferences', icon: CalendarDays, adminOnly: true },
];

const facultyNav: NavItemDef[] = [
	{ label: 'My Dashboard', to: '/my', icon: LayoutDashboard, facultyOnly: true },
	{ label: 'My Preferences', to: '/my/preferences', icon: ClipboardList, facultyOnly: true },
	{ label: 'My Room Requests', to: '/my/room-preferences', icon: CalendarDays, facultyOnly: true },
];

const campusNav: NavItemDef[] = [
	{ label: 'Map Editor', to: '/map', icon: MapPinned, adminOnly: true },
];

const insightsNav: NavItemDef[] = [
	{ label: 'Analytics', to: '/analytics', icon: BarChart3, disabled: true },
];

/* --- Sidebar nav helper components (matches EnrollPro pattern) --- */

function NavDivider({ label }: { label: string }) {
	return (
		<div className='px-3 py-2 mt-2 transition-[margin,opacity,height] duration-200 ease-linear group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden'>
			<span className='text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground opacity-60 whitespace-nowrap'>
				{label}
			</span>
		</div>
	);
}

function NavItem({
	to,
	icon: Icon,
	label,
	pathname,
}: {
	to: string;
	icon: React.ElementType;
	label: string;
	pathname: string;
}) {
	const isActive = pathname === to;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={isActive} tooltip={label}>
				<Link to={to}>
					<Icon className='size-4' />
					<span>{label}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavItemDisabled({
	icon: Icon,
	label,
}: {
	icon: React.ElementType;
	label: string;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={`${label} (Coming Soon)`}
				className='cursor-not-allowed opacity-40'
				disabled
			>
				<Icon className='size-4' />
				<span>{label}</span>
				<Lock className='ml-auto size-3' />
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/* --- AppSidebar --- */

function AppSidebar({
	schoolName,
	logoUrl,
	activeYearLabel,
	bridgeUser,
	pathname,
	onLogout,
	className,
}: {
	schoolName: string;
	logoUrl: string | null;
	activeYearLabel: string | null;
	bridgeUser: BridgeUser | null;
	pathname: string;
	onLogout: () => void;
	className?: string;
}) {
	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN' || bridgeUser?.role === 'officer';
	const isFaculty = bridgeUser?.role === 'faculty';
	// Faculty top-nav is intentionally empty; all faculty links live under the "My Portal" group below.
	const topNavigation = isFaculty ? [] : navigationNav;
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	return (
		<>
			<Sidebar collapsible='icon' className={className}>
				{/* -- Header: School Identity -- */}
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size='lg'
								className='data-[state=open]:bg-sidebar-accent cursor-default'
								tooltip={schoolName}
							>
								{logoUrl ? (
									<div className='flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0'>
										<img
											src={enrollProAsset(logoUrl)}
											alt='Logo'
											className='size-8 object-contain'
										/>
									</div>
								) : (
									<div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-muted shrink-0'>
										<School className='size-4 text-muted-foreground' />
									</div>
								)}
								<div className='grid flex-1 text-left text-sm leading-tight overflow-hidden'>
									{schoolName ? (
										<span className='truncate font-semibold'>
											{schoolName}
										</span>
									) : (
										<Skeleton className='h-3.5 w-28 my-0.5' />
									)}
									<div className='flex items-center gap-1 mt-0.5'>
										{activeYearLabel ? (
											<>
												<span className='truncate text-[0.6875rem] text-foreground'>
													S.Y. {activeYearLabel}
												</span>
												<span className='shrink-0 text-[0.625rem] font-semibold text-green-600'>
													- ACTIVE
												</span>
											</>
										) : (
											<>
												<AlertTriangle className='size-3 shrink-0 text-amber-500' />
												<span className='text-[0.6875rem] text-muted-foreground'>
													No Active Year
												</span>
											</>
										)}
									</div>
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarSeparator />

				{/* -- Navigation -- */}
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<NavDivider label='Navigation' />
								{topNavigation
									.filter((item) => !item.adminOnly || isAdmin)
									.map((item) => (
										<NavItem
											key={item.to}
											to={item.to}
											icon={item.icon}
											label={item.label}
											pathname={pathname}
										/>
									))}

								{!isFaculty && (
									<>
										<NavDivider label='Scheduling' />
										{schedulingNav
											.filter((item) => !item.adminOnly || isAdmin)
											.map((item) =>
												item.disabled ? (
													<NavItemDisabled
														key={item.to}
														icon={item.icon}
														label={item.label}
													/>
												) : (
													<NavItem
														key={item.to}
														to={item.to}
														icon={item.icon}
														label={item.label}
														pathname={pathname}
													/>
												),
											)}

										<NavDivider label='Campus' />
										{campusNav
											.filter((item) => !item.adminOnly || isAdmin)
											.map((item) => (
												<NavItem
													key={item.to}
													to={item.to}
													icon={item.icon}
													label={item.label}
													pathname={pathname}
												/>
											))}
									</>
								)}

								{isFaculty && (
									<>
										<NavDivider label='My Portal' />
										{facultyNav.map((item) => (
											<NavItem
												key={item.to}
												to={item.to}
												icon={item.icon}
												label={item.label}
												pathname={pathname}
											/>
										))}
									</>
								)}

								{!isFaculty && (
									<>
										<NavDivider label='Insights' />
										{insightsNav.map((item) =>
											item.disabled ? (
												<NavItemDisabled
													key={item.to}
													icon={item.icon}
													label={item.label}
												/>
											) : (
												<NavItem
													key={item.to}
													to={item.to}
													icon={item.icon}
													label={item.label}
													pathname={pathname}
												/>
											),
										)}
									</>
								)}

								<NavDivider label='Platform' />
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip='Back to EnrollPro'>
										<a href={getBackHref()}>
											<ExternalLink className='size-4' />
											<span>Back to EnrollPro</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				{/* -- Footer: User -- */}
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size='lg'
								tooltip={bridgeUser?.role ?? 'User'}
								onClick={() => setShowLogoutConfirm(true)}
								className='relative'
							>
								{/* Collapsed State: LogOut Icon only */}
								<div className='absolute inset-0 flex items-center justify-center transition-all duration-200 opacity-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:scale-100 scale-75'>
									<LogOut className='size-4 text-muted-foreground' />
								</div>

								{/* Expanded State: Full Profile */}
								<div className='flex w-full items-center gap-2 transition-all duration-200 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:pointer-events-none'>
									<div className='flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground overflow-hidden'>
										<span className='text-xs font-semibold'>
											{bridgeUser?.role
												? bridgeUser.role.charAt(0).toUpperCase()
												: 'G'}
										</span>
									</div>
									<div className='grid flex-1 text-left text-sm leading-tight overflow-hidden'>
										<span className='truncate font-semibold'>
											{bridgeUser?.role ?? 'Guest'}
										</span>
										{isAdmin && (
											<Badge
												variant='outline'
												className='mt-0.5 w-fit h-4 px-1 text-[0.5625rem] font-bold border-purple-200 bg-purple-50 text-purple-700'
											>
												Admin
											</Badge>
										)}
										{isFaculty && (
											<span className='truncate text-[0.6875rem] text-muted-foreground'>
												Faculty
											</span>
										)}
										{!isAdmin && !isFaculty && (
											<span className='truncate text-[0.6875rem] text-muted-foreground'>
												Portal access
											</span>
										)}
									</div>
									<LogOut className='ml-auto size-4 shrink-0 text-muted-foreground' />
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>

			<ConfirmationModal
				open={showLogoutConfirm}
				onOpenChange={setShowLogoutConfirm}
				title='Sign Out'
				description='Are you sure you want to sign out of your account?'
				confirmText='Sign Out'
				onConfirm={onLogout}
				variant='primary'
			/>
		</>
	);
}

/* --- AppShell (exported layout) --- */

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
	const [schoolName, setSchoolName] = useState('');
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);
	const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
	const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
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
		const aggregated = [...navigationNav, ...schedulingNav, ...campusNav, ...insightsNav]
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
			if (!online) {
				setMobileSyncLabel('Offline');
				return;
			}

			let hasQueued = false;
			for (let index = 0; index < localStorage.length; index += 1) {
				const key = localStorage.key(index);
				if (!key || !key.startsWith('atlas:room-pref-outbox:')) continue;
				const raw = localStorage.getItem(key);
				if (!raw) continue;
				try {
					const parsed = JSON.parse(raw) as Array<{ status?: string }>;
					if (Array.isArray(parsed) && parsed.length > 0) {
						hasQueued = true;
						break;
					}
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

	useEffect(() => {
		setMobileNavOpen(false);
	}, [location.pathname]);

	/* Capture bridge token on mount */
	useLayoutEffect(() => {
		captureBridgeToken();
	}, []);

	useLayoutEffect(() => {
		const wasTimetableRoute = previousPathnameRef.current.startsWith('/timetable');
		if (isTimetableRoute && !wasTimetableRoute) {
			setSidebarOpen(false);
		}
		previousPathnameRef.current = location.pathname;
	}, [isTimetableRoute, location.pathname]);

	/* Fetch EnrollPro settings + apply dynamic accent theming */
	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				const raw = s.schoolName || 'High School';
				const hsLabel = /high\s*school/i.test(raw) ? raw : `${raw}`;
				setSchoolName(`ATLAS ${hsLabel}`);
				setLogoUrl(s.logoUrl);

				// Set favicon from school logo
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

				// Fetch school years list + active label
				if (s.activeSchoolYearId) setSelectedYearId(s.activeSchoolYearId);
				if (s.activeSchoolYearLabel) setActiveYearLabel(s.activeSchoolYearLabel);
				fetchSchoolYears().then((years) => {
					setSchoolYears(years);
					// If settings/public didn't have the label, fall back to the years list
					if (!s.activeSchoolYearLabel) {
						const active = years.find((y) => y.id === s.activeSchoolYearId);
						if (active) setActiveYearLabel(active.yearLabel);
					}
				});

				applyEnrollProAccentTheme(s.selectedAccentHsl);
			})
			.catch(() => {});
	}, []);

	/* Verify session identity */
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
		if (!isFacultyPortalRoute(location.pathname)) {
			navigate('/my', { replace: true });
		}
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

	/* Breadcrumbs from current route */
	const breadcrumbs = (() => {
		const groups: { label: string; items: NavItemDef[] }[] = [
			{ label: 'Navigation', items: navigationNav },
			{ label: 'Scheduling', items: schedulingNav },
			{ label: 'My Portal', items: facultyNav },
			{ label: 'Campus', items: campusNav },
			{ label: 'Insights', items: insightsNav },
		];

		for (const group of groups) {
			for (const item of group.items) {
				if (location.pathname === item.to) {
					if (group.label === 'Navigation') {
						return [{ label: item.label }];
					}
					return [{ label: group.label }, { label: item.label }];
				}
			}
		}
		return [{ label: 'ATLAS' }];
	})();
	const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'ATLAS';

	return (
		<SidebarProvider open={isMobile ? false : sidebarOpen} onOpenChange={setSidebarOpen}>
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

			<SidebarInset>
				{/* Top bar */}
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
													<span className='text-sm text-muted-foreground'>
														{crumb.label}
													</span>
												)}
											</BreadcrumbItem>
										</React.Fragment>
									))}
								</BreadcrumbList>
							</Breadcrumb>

							{/* Right-side header controls */}
							<div className='ml-auto flex items-center gap-2'>
								<AccessibilityMenu fontSize={fontSize} setFontSize={setFontSize} />

								{/* School year selector - EnrollPro-style popover */}
								{schoolYears.length > 0 && (
									<div className='relative'>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant='outline'
														size='sm'
														className='h-8 gap-1.5 text-xs font-medium'
														onClick={() => setSyOpen(!syOpen)}
													>
														<CalendarDays className='size-3.5' />
														<span>
															{schoolYears.find((y) => y.id === selectedYearId)?.yearLabel ?? 'No Year'}
														</span>
														<ChevronsUpDown className='size-3 opacity-50' />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Switch School Year</TooltipContent>
											</Tooltip>
										</TooltipProvider>
										{syOpen && (
											<>
												<div className='fixed inset-0 z-40' onClick={() => setSyOpen(false)} />
												<div className='absolute right-0 top-full z-50 mt-1 min-w-45 rounded-md border border-border bg-popover p-1 shadow-md'>
													{schoolYears.map((sy) => (
														<button
															key={sy.id}
															onClick={() => {
																setSelectedYearId(sy.id);
																setActiveYearLabel(sy.yearLabel);
																setSyOpen(false);
															}}
															className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${
																sy.id === selectedYearId
																	? 'bg-accent text-accent-foreground'
																	: 'hover:bg-sidebar-accent hover:text-accent-foreground'
															}`}
														>
															<span className='flex-1 text-left'>{sy.yearLabel}</span>
															<span className={`rounded px-1 py-0.5 text-[0.625rem] font-medium ${
																sy.isActive
																	? 'bg-green-100 text-green-700'
																	: (sy.status === 'UPCOMING'
																		? 'bg-blue-100 text-blue-700'
																		: sy.status === 'DRAFT'
																			? 'bg-yellow-100 text-yellow-700'
																			: 'bg-gray-100 text-gray-500')
															}`}>
																{sy.isActive ? 'ACTIVE' : (sy.status ?? 'CLOSED')}
															</span>
														</button>
													))}
												</div>
											</>
										)}
									</div>
								)}
							</div>
						</>
					)}
				</header>

				<AnimatePresence initial={false}>
					{isMobile && mobileNavOpen && (
						<>
							<motion.button
								type='button'
								className='fixed inset-0 top-14 z-40 bg-black/30 will-change-[opacity]'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.16, ease: 'easeOut' }}
								onClick={() => setMobileNavOpen(false)}
							/>
							<motion.nav
								className='fixed inset-x-2 top-14 z-50 overflow-hidden rounded-b-2xl border border-border bg-background shadow-xl transform-gpu will-change-transform'
								initial={{ opacity: 0, y: -16 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -16 }}
								transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
							>
								<div className='space-y-1 p-3'>
									{mobileNavItems.map((item) => (
										<Button
											key={item.to}
											variant={location.pathname === item.to ? 'secondary' : 'ghost'}
											className='h-11 w-full justify-start text-sm'
											onClick={() => {
												navigate(item.to);
												setMobileNavOpen(false);
											}}
										>
											<item.icon className='mr-2 size-4' />
											{item.label}
										</Button>
									))}
									<Separator className='my-2' />
									<Button asChild variant='ghost' className='h-11 w-full justify-start text-sm'>
										<a href={getBackHref()}>
											<ExternalLink className='mr-2 size-4' />
											Back to EnrollPro
										</a>
									</Button>
									<Button variant='ghost' className='h-11 w-full justify-start text-sm text-destructive' onClick={handleLogout}>
										<LogOut className='mr-2 size-4' />
										Sign out
									</Button>
								</div>
							</motion.nav>
						</>
					)}
				</AnimatePresence>

				{/* Page content */}
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
