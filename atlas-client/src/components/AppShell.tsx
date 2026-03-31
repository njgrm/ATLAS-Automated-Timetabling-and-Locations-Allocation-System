import {
	AlertTriangle,
	BarChart3,
	BookOpen,
	CalendarClock,
	CalendarDays,
	ChevronsUpDown,
	ExternalLink,
	GraduationCap,
	LayoutDashboard,
	Lock,
	LogOut,
	MapPinned,
	School,
	UserCog,
	Users,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useState, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

import { captureBridgeToken, getBackHref } from '@/lib/bridge';
import { fetchPublicSettings, fetchSchoolYears, verifyBridgeToken } from '@/lib/settings';
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
import { useAccessibility } from '@/hooks/useAccessibility';

/* ─── WCAG contrast helpers (ported from EnrollPro RootLayout) ─── */

function relativeLuminance(hsl: string): number {
	const parts = hsl.trim().split(/\s+/);
	if (parts.length < 3) return 0.5;
	const h = parseFloat(parts[0]) || 0;
	const s = (parseFloat(parts[1]) || 0) / 100;
	const l = (parseFloat(parts[2]) || 0) / 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

function contrastForeground(hsl: string): string {
	const lum = relativeLuminance(hsl);
	const contrastWhite = 1.05 / (lum + 0.05);
	const contrastBlack = (lum + 0.05) / 0.05;
	return contrastWhite >= contrastBlack ? '0 0% 100%' : '0 0% 0%';
}

/* ─── Constants ─── */

const ENROLLPRO_URL = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://localhost:5173';

/** Map an EnrollPro `/uploads/…` path to the Vite proxy prefix. */
function enrollProAsset(path: string | null): string {
	if (!path) return '';
	// logoUrl comes as "/uploads/logo-xxx.jpg"; rewrite to "/enrollpro-uploads/logo-xxx.jpg"
	return path.replace(/^\/uploads/, '/enrollpro-uploads');
}

/* ─── Nav structure ─── */

type NavItemDef = {
	label: string;
	to: string;
	icon: typeof LayoutDashboard;
	adminOnly?: boolean;
	disabled?: boolean;
};

const navigationNav: NavItemDef[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard },
];

const schedulingNav: NavItemDef[] = [
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
	{ label: 'Faculty', to: '/faculty', icon: Users, adminOnly: true },
	{ label: 'Assignments', to: '/assignments', icon: UserCog, adminOnly: true },
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true },
	{ label: 'Timetable', to: '/timetable', icon: CalendarClock, adminOnly: true, disabled: true },
];

const campusNav: NavItemDef[] = [
	{ label: 'Map Editor', to: '/map', icon: MapPinned, adminOnly: true },
];

const insightsNav: NavItemDef[] = [
	{ label: 'Analytics', to: '/analytics', icon: BarChart3, disabled: true },
];

/* ─── Sidebar nav helper components (matches EnrollPro pattern) ─── */

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

/* ─── AppSidebar ─── */

function AppSidebar({
	schoolName,
	logoUrl,
	activeYearLabel,
	bridgeUser,
	pathname,
	onLogout,
}: {
	schoolName: string;
	logoUrl: string | null;
	activeYearLabel: string | null;
	bridgeUser: BridgeUser | null;
	pathname: string;
	onLogout: () => void;
}) {
	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN';
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	return (
		<>
			<Sidebar collapsible='icon'>
				{/* ── Header: School Identity ── */}
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
													● ACTIVE
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

				{/* ── Navigation ── */}
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<NavDivider label='Navigation' />
								{navigationNav
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

				{/* ── Footer: User ── */}
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
										{!isAdmin && (
											<span className='truncate text-[0.6875rem] text-muted-foreground'>
												Bridge session
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

/* ─── AppShell (exported layout) ─── */

export function AppShell() {
	const location = useLocation();
	const { fontSize, setFontSize } = useAccessibility();
	const [schoolName, setSchoolName] = useState('');
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);
	const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
	const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [syOpen, setSyOpen] = useState(false);

	/* Capture bridge token on mount */
	useLayoutEffect(() => {
		captureBridgeToken();
	}, []);

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
				fetchSchoolYears().then((years) => {
					setSchoolYears(years);
					const active = years.find((y) => y.id === s.activeSchoolYearId);
					if (active) setActiveYearLabel(active.yearLabel);
				});

				if (s.selectedAccentHsl) {
					const hsl = s.selectedAccentHsl;
					const fg = contrastForeground(hsl);
					const parts = hsl.split(/\s+/);
					const muted = `${parts[0]} ${parts[1]} 94%`;
					const root = document.documentElement;
					root.style.setProperty('--accent', hsl);
					root.style.setProperty('--accent-foreground', fg);
					root.style.setProperty('--accent-muted', muted);
					root.style.setProperty('--accent-ring', hsl);
					root.style.setProperty('--primary', `var(--accent)`);
					root.style.setProperty('--primary-foreground', `var(--accent-foreground)`);
					root.style.setProperty('--ring', `var(--accent-ring)`);
					root.style.setProperty('--sidebar-primary', `var(--accent)`);
					root.style.setProperty('--sidebar-primary-foreground', `var(--accent-foreground)`);
					root.style.setProperty('--sidebar-ring', `var(--accent-ring)`);
					root.style.setProperty('--sidebar-accent', muted);
				}
			})
			.catch(() => {});
	}, []);

	/* Verify bridge identity */
	useEffect(() => {
		verifyBridgeToken().then((u) => {
			if (u) setBridgeUser(u);
		});
	}, []);

	const handleLogout = () => {
		sessionStorage.removeItem('atlas_bridge_token');
		window.location.href = `${ENROLLPRO_URL}/login`;
	};

	/* Breadcrumbs from current route */
	const breadcrumbs = (() => {
		const groups: { label: string; items: NavItemDef[] }[] = [
			{ label: 'Navigation', items: navigationNav },
			{ label: 'Scheduling', items: schedulingNav },
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

	return (
		<SidebarProvider>
			<AppSidebar
				schoolName={schoolName}
				logoUrl={logoUrl}
				activeYearLabel={activeYearLabel}
				bridgeUser={bridgeUser}
				pathname={location.pathname}
				onLogout={handleLogout}
			/>

			<SidebarInset>
				{/* Top bar */}
				<header className='flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4'>
					<SidebarTrigger className='-ml-1' />
					<Separator orientation='vertical' className='mr-2 h-4!' />
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

						{/* School year selector — EnrollPro-style popover */}
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
				</header>

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
						<Suspense fallback={<div className="p-6"><Skeleton className="h-[400px] w-full rounded-lg" /></div>}>
							<Outlet context={{ bridgeUser, schoolName }} />
						</Suspense>
					</motion.div>
				</AnimatePresence>
			</SidebarInset>
		</SidebarProvider>
	);
}
