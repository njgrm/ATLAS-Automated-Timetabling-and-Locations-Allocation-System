import {
	BarChart3,
	BookOpen,
	CalendarClock,
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
import { useEffect, useLayoutEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { captureBridgeToken, getBackHref } from '@/lib/bridge';
import { fetchPublicSettings, verifyBridgeToken } from '@/lib/settings';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';
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
};

const navigationNav: NavItem[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
];

const schedulingNav: NavItem[] = [
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
	{ label: 'Faculty', to: '/faculty', icon: Users, adminOnly: true },
	{ label: 'Assignments', to: '/faculty/assignments', icon: UserCog, adminOnly: true },
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
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	/* Capture bridge token on mount */
	useLayoutEffect(() => {
		captureBridgeToken();
	}, []);

	/* Fetch EnrollPro settings + apply dynamic accent theming */
	useEffect(() => {
		fetchPublicSettings()
			.then((s) => {
				setSchoolName(s.schoolName || 'ATLAS');
				setLogoUrl(s.logoUrl);
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

	const isAdmin = bridgeUser?.role === 'admin';

	/* Page title from current route */
	const pageTitle = (() => {
		const allNav = [...navigationNav, ...schedulingNav, ...campusNav, ...insightsNav];
		const match = allNav.find((n) =>
			n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
		);
		return match?.label ?? 'ATLAS';
	})();

	const renderNavItem = (item: NavItem) => {
		if (item.disabled) {
			return (
				<span
					key={item.to}
					className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed ${
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
		return (
			<NavLink
				key={item.to}
				to={item.to}
				end={item.end}
				className={({ isActive }) =>
					`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
						isActive
							? 'bg-sidebar-accent text-sidebar-accent-foreground'
							: 'text-sidebar-foreground hover:bg-sidebar-accent/60'
					} ${!sidebarOpen ? 'justify-center px-0' : ''}`
				}
			>
				<item.icon className="size-4 shrink-0" />
				{sidebarOpen && item.label}
			</NavLink>
		);
	};

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
			{/* ─── Sidebar ─── */}
			<aside
				className={`flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${
					sidebarOpen ? 'w-64' : 'w-14'
				}`}
			>
				{/* Brand */}
				<div className="flex items-center gap-3 border-b border-sidebar-border px-3 py-3">
					{logoUrl ? (
						<img src={`${ENROLLPRO_API_BASE}${logoUrl}`} alt="" className="size-8 shrink-0 rounded-md object-cover" />
					) : (
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
							<School className="size-4" />
						</div>
					)}
					{sidebarOpen && (
						<div className="min-w-0">
							<p className="truncate text-sm font-bold leading-tight text-sidebar-foreground">ATLAS</p>
							<p className="truncate text-[0.6875rem] text-muted-foreground">{schoolName}</p>
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
				<header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
					<button
						onClick={() => setSidebarOpen((v) => !v)}
						className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors md:hidden"
					>
						<PanelLeft className="size-4" />
					</button>
					<div className="mr-2 h-4 w-px bg-border md:hidden" />
					<span className="text-sm font-medium text-muted-foreground">{pageTitle}</span>
				</header>

				{/* Page content via router outlet */}
				<main className="flex-1 overflow-auto scrollbar-thin">
					<Outlet context={{ bridgeUser, schoolName }} />
				</main>
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
