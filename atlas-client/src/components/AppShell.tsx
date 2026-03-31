import {
	ALargeSmall,
	BarChart3,
	BookOpen,
	CalendarClock,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	GraduationCap,
	HelpCircle,
	LayoutDashboard,
	Lock,
	LogOut,
	MapPinned,
	PanelLeft,
	School,
	UserCog,
	Users,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

import { captureBridgeToken, getBackHref } from '@/lib/bridge';
import { fetchActiveSchoolYear, fetchPublicSettings, fetchSchoolYears, verifyBridgeToken } from '@/lib/settings';
import type { BridgeUser } from '@/types';
import type { SchoolYear } from '@/lib/settings';
import { Badge } from '@/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/ui/breadcrumb';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';

/* ─── WCAG contrast helpers (ported from EnrollPro RootLayout) ─── */

function relativeLuminance(hsl: string): number {
	const [h, s, l] = hsl.split(/\s+/).map((v) => parseFloat(v));
	const sN = s / 100;
	const lN = l / 100;
	const a = sN * Math.min(lN, 1 - lN);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
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

/* ─── Nav items ─── */

const ENROLLPRO_URL = import.meta.env.VITE_ENROLLPRO_URL ?? 'http://localhost:5173';
const ENROLLPRO_API_BASE =
	(import.meta.env.VITE_ENROLLPRO_API ?? 'http://localhost:5000/api').replace('/api', '');

type NavItem = {
	label: string;
	to: string;
	icon: typeof LayoutDashboard;
	end?: boolean; // exact match
	adminOnly?: boolean;
	disabled?: boolean;
	/** Visually nested child items */
	children?: NavItem[];
};

const navigationNav: NavItem[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
];

const schedulingNav: NavItem[] = [
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
	{
		label: 'Faculty',
		to: '/faculty',
		icon: Users,
		adminOnly: true,
		children: [
			{ label: 'Assignments', to: '/faculty/assignments', icon: UserCog, adminOnly: true },
		],
	},
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true, disabled: true },
	{ label: 'Timetable', to: '/timetable', icon: CalendarClock, adminOnly: true, disabled: true },
];

const campusNav: NavItem[] = [
	{ label: 'Map Editor', to: '/map', icon: MapPinned, adminOnly: true },
];

const insightsNav: NavItem[] = [
	{ label: 'Analytics', to: '/analytics', icon: BarChart3, disabled: true },
];

export function AppShell() {
	const location = useLocation();
	const [schoolName, setSchoolName] = useState('ATLAS');
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [activeYearLabel, setActiveYearLabel] = useState<string | null>(null);
	const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
	const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [largeText, setLargeText] = useState(false);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	/* Capture bridge token on mount */
	useLayoutEffect(() => {
		captureBridgeToken();
	}, []);

	/* Fetch EnrollPro settings + apply dynamic accent theming */
	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				// A2: append "High School" if not already present
				const raw = s.schoolName || 'ATLAS';
				const displayName = /high\s*school/i.test(raw) ? raw : `${raw} High School`;
				setSchoolName(displayName);
				setLogoUrl(s.logoUrl);

				// Set favicon from school logo
				if (s.logoUrl) {
					const faviconUrl = `${ENROLLPRO_API_BASE}${s.logoUrl}`;
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

	/* Accessibility: toggle large text */
	useEffect(() => {
		document.documentElement.style.fontSize = largeText ? '18px' : '';
	}, [largeText]);

	const isAdmin = bridgeUser?.role === 'admin' || bridgeUser?.role === 'SYSTEM_ADMIN';

	/* Breadcrumbs from current route */
	const breadcrumbs = (() => {
		const groups: { label: string; items: NavItem[] }[] = [
			{ label: 'Navigation', items: navigationNav },
			{ label: 'Scheduling', items: schedulingNav },
			{ label: 'Campus', items: campusNav },
			{ label: 'Insights', items: insightsNav },
		];

		for (const group of groups) {
			for (const item of group.items) {
				// Check children first for deeper matches
				if (item.children) {
					const childMatch = item.children.find((c) =>
						c.end ? location.pathname === c.to : location.pathname.startsWith(c.to),
					);
					if (childMatch) {
						return group.label === 'Navigation'
							? [{ label: item.label }, { label: childMatch.label }]
							: [{ label: group.label }, { label: item.label }, { label: childMatch.label }];
					}
				}
				// Check the item itself
				const isMatch = item.end
					? location.pathname === item.to
					: location.pathname.startsWith(item.to);
				if (isMatch) {
					if (group.label === 'Navigation') {
						return [{ label: item.label }];
					}
					return [{ label: group.label }, { label: item.label }];
				}
			}
		}
		return [{ label: 'ATLAS' }];
	})();

	const renderNavItem = (item: NavItem) => {
		if (item.disabled) {
			return (
				<span
					key={item.to}
					className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed transition-all duration-150 ${
						!sidebarOpen ? 'justify-center px-0' : ''
					}`}
				>
					<item.icon className="size-4 shrink-0" />
					{sidebarOpen && (
						<>
							{item.label}
							<Lock className="ml-auto size-3 shrink-0" />
						</>
					)}
				</span>
			);
		}

		const hasChildren = item.children && item.children.length > 0;

		return (
			<div key={item.to}>
				<NavLink
					to={item.to}
					end={item.end ?? hasChildren}
					className={({ isActive }) =>
						`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 ${
							isActive
								? 'bg-sidebar-primary text-sidebar-primary-foreground'
								: 'text-sidebar-foreground hover:bg-sidebar-accent/60'
						} ${!sidebarOpen ? 'justify-center px-0' : ''}`
					}
				>
					<item.icon className="size-4 shrink-0" />
					{sidebarOpen && item.label}
				</NavLink>
				{hasChildren && sidebarOpen && (
					<div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
						{item.children!
							.filter((c) => !c.adminOnly || isAdmin)
							.map(renderNavItem)}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
			{/* ─── Sidebar ─── */}
			<aside
				className={`flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-linear ${
					sidebarOpen ? 'w-64' : 'w-14'
				}`}
			>
				{/* Brand */}
				<div className="flex items-center gap-3 border-b border-sidebar-border px-3 py-3">
					{logoUrl ? (
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
							<img src={`${ENROLLPRO_API_BASE}${logoUrl}`} alt="Logo" className="size-8 object-contain" />
						</div>
					) : (
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<School className="size-4" />
						</div>
					)}
					{sidebarOpen && (
						<div className="grid flex-1 text-left text-sm leading-tight overflow-hidden">
							<span className="truncate font-semibold text-sidebar-foreground">
								{schoolName}
							</span>
							<div className="flex items-center gap-1 mt-0.5">
								{activeYearLabel ? (
									<>
										<span className="truncate text-[0.6875rem] text-foreground">
											S.Y. {activeYearLabel}
										</span>
										<span className="shrink-0 text-[0.625rem] font-semibold text-green-600">
											● ACTIVE
										</span>
									</>
								) : (
									<span className="text-[0.6875rem] text-muted-foreground">
										ATLAS
									</span>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Navigation */}
				<nav className="flex-1 overflow-auto px-2 py-2">
					{sidebarOpen && (
						<p className="px-2 pb-1 pt-3 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Navigation
						</p>
					)}
					{navigationNav
						.filter((item) => !item.adminOnly || isAdmin)
						.map(renderNavItem)}

					{sidebarOpen && (
						<p className="px-2 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Scheduling
						</p>
					)}
					{schedulingNav
						.filter((item) => !item.adminOnly || isAdmin)
						.map(renderNavItem)}

					{sidebarOpen && (
						<p className="px-2 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Campus
						</p>
					)}
					{campusNav
						.filter((item) => !item.adminOnly || isAdmin)
						.map(renderNavItem)}

					{sidebarOpen && (
						<p className="px-2 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Insights
						</p>
					)}
					{insightsNav.map(renderNavItem)}

					{sidebarOpen && (
						<p className="px-2 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Platform
						</p>
					)}
					<a
						href={getBackHref()}
						className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors ${
							!sidebarOpen ? 'justify-center px-0' : ''
						}`}
					>
						<ExternalLink className="size-4 shrink-0" />
						{sidebarOpen && 'Back to EnrollPro'}
					</a>
				</nav>

				{/* Collapse toggle */}
				<button
					onClick={() => setSidebarOpen((v) => !v)}
					className="flex items-center justify-center border-t border-sidebar-border py-2 text-muted-foreground hover:text-foreground transition-colors"
				>
					{sidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
				</button>

				{/* Footer */}
				<div className="border-t border-sidebar-border px-3 py-3">
					<button
						onClick={() => setShowLogoutConfirm(true)}
						className="flex w-full items-center gap-2.5 rounded-md px-0 py-0 text-left transition-colors hover:bg-sidebar-accent/60"
					>
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
							{bridgeUser?.role ? bridgeUser.role.charAt(0).toUpperCase() : 'G'}
						</div>
						{sidebarOpen && (
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className="truncate text-sm font-medium text-sidebar-foreground">
										{bridgeUser?.role ?? 'Guest'}
									</p>
									{isAdmin && (
										<Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0">
											Admin
										</Badge>
									)}
								</div>
								<p className="truncate text-[0.6875rem] text-muted-foreground">Bridge session</p>
							</div>
						)}
						{sidebarOpen && (
							<LogOut className="ml-auto size-4 shrink-0 text-muted-foreground" />
						)}
					</button>
				</div>
			</aside>

			{/* ─── Main area ─── */}
			<div className="flex min-w-0 flex-1 flex-col">
				{/* Header bar */}
				<header className="flex h-14.5 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
					<button
						onClick={() => setSidebarOpen((v) => !v)}
						className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors"
						title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
					>
						<PanelLeft className="size-4" />
					</button>
					<div className="mr-2 h-4 w-px bg-border" />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/">ATLAS</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							{breadcrumbs.map((crumb, i) => (
								<React.Fragment key={crumb.label}>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										{i === breadcrumbs.length - 1 ? (
											<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
										) : (
											<span className="text-sm text-muted-foreground">{crumb.label}</span>
										)}
									</BreadcrumbItem>
								</React.Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>

					{/* Right-side header controls */}
					<div className="ml-auto flex items-center gap-2">
						{/* School year selector */}
						{schoolYears.length > 0 && (
							<div className="flex items-center gap-1.5">
								<CalendarDays className="size-3.5 text-muted-foreground" />
								<select
									value={selectedYearId ?? ''}
									onChange={(e) => {
										const id = Number(e.target.value);
										setSelectedYearId(id);
										const yr = schoolYears.find((y) => y.id === id);
										if (yr) setActiveYearLabel(yr.yearLabel);
									}}
									className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
								>
									{schoolYears.map((sy) => (
										<option key={sy.id} value={sy.id}>
											S.Y. {sy.yearLabel}{sy.isActive ? ' (Active)' : ''}
										</option>
									))}
								</select>
							</div>
						)}

						{/* Accessibility — text size toggle */}
						<button
							onClick={() => setLargeText((v) => !v)}
							title={largeText ? 'Normal text size' : 'Large text size'}
							className={`inline-flex size-8 items-center justify-center rounded-md transition-colors ${
								largeText
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
							}`}
						>
							<ALargeSmall className="size-4" />
						</button>
					</div>
				</header>

				{/* Page content via router outlet */}
				<AnimatePresence mode="wait">
					<motion.main
						key={location.pathname}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
						className="flex-1 overflow-auto scrollbar-thin"
					>
						<Outlet context={{ bridgeUser, schoolName }} />
					</motion.main>
				</AnimatePresence>
			</div>

			{/* ─── Sign-out confirmation modal (matches EnrollPro UX) ─── */}
			<Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
				<DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm rounded-3xl p-8 overflow-hidden bg-sidebar shadow-2xl">
					{/* Icon badge */}
					<div className="flex justify-center mb-5">
						<span className="flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--primary))] ring-[6px] ring-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary-foreground))]">
							<HelpCircle className="w-6 h-6" strokeWidth={2.5} />
						</span>
					</div>
					<DialogHeader className="space-y-2 text-center items-center">
						<DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
							Sign Out
						</DialogTitle>
						<DialogDescription className="text-sm leading-relaxed text-gray-500 text-center">
							Are you sure you want to sign out of your account?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex flex-row gap-3 mt-7 sm:justify-center">
						<Button
							variant="outline"
							onClick={() => setShowLogoutConfirm(false)}
							className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150 active:scale-[0.97]"
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								sessionStorage.removeItem('atlas_bridge_token');
								window.location.href = `${ENROLLPRO_URL}/login`;
							}}
							className="flex-1 h-12 rounded-2xl font-semibold text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md transition-all duration-150 active:scale-[0.97]"
						>
							Sign Out
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
