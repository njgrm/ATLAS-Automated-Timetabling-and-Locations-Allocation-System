import {
	BarChart3,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	LayoutDashboard,
	LogOut,
	MapPinned,
	PanelLeft,
	Pencil,
	School,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import atlasApi from '@/lib/api';
import { captureBridgeToken, getBackHref } from '@/lib/bridge';
import { fetchPublicSettings, verifyBridgeToken } from '@/lib/settings';
import type { BridgeUser } from '@/types';
import { Badge } from '@/ui/badge';

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

const ENROLLPRO_URL = 'http://localhost:5173';

type NavItem = {
	label: string;
	to: string;
	icon: typeof LayoutDashboard;
	end?: boolean; // exact match
};

const navItems: NavItem[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
	{ label: 'Campus Map', to: '/map', icon: MapPinned, end: true },
	{ label: 'Map Editor', to: '/map/editor', icon: Pencil },
];

const analyticsNav: NavItem[] = [
	{ label: 'Analytics', to: '/analytics', icon: BarChart3 },
];

export function AppShell() {
	const location = useLocation();
	const [schoolName, setSchoolName] = useState('ATLAS');
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [bridgeUser, setBridgeUser] = useState<BridgeUser | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(true);

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
		const allNav = [...navItems, ...analyticsNav];
		const match = allNav.find((n) =>
			n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
		);
		return match?.label ?? 'ATLAS';
	})();

	const renderNavItem = (item: NavItem) => (
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
						<img src={logoUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
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
					{navItems
						.filter((item) => item.to !== '/map/editor' || isAdmin)
						.map(renderNavItem)}

					{sidebarOpen && (
						<p className="px-2 pb-1 pt-4 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
							Insights
						</p>
					)}
					{analyticsNav.map(renderNavItem)}

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
					<div className="flex items-center gap-2.5">
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
							<a
								href={`${ENROLLPRO_URL}/login`}
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								<LogOut className="size-4" />
							</a>
						)}
					</div>
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
		</div>
	);
}
