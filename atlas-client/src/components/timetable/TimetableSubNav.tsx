import { NavLink, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { resolveRouteChrome } from '@/components/app-shell/navigation';

type TimetableSubNavItem = {
	key: string;
	label: string;
	to: string;
	end?: boolean;
};

/**
 * C01R D1 — the persistent timetable sub-nav (the U3 spine). Five links into
 * the already-mounted `/timetable` shell: the nested children are element-less
 * (see `App.tsx`), so moving between them never remounts the workspace or
 * refetches the grid — this nav is the missing entry point, not a new tree.
 *
 * C01R D5 — the single visible `h1` naming the current timetable surface,
 * reusing the shared route-chrome titles instead of a forked copy.
 */
const SUB_NAV_ITEMS: TimetableSubNavItem[] = [
	{ key: 'schedule', label: 'Schedule', to: '/timetable', end: true },
	// A5 — the pre-generation draft surface gets a real sub-nav home instead of
	// being reachable only by typing the URL.
	{ key: 'draft', label: 'Draft', to: '/timetable/pre-generation' },
	{ key: 'setup', label: 'Setup', to: '/timetable/setup' },
	{ key: 'policies', label: 'Policies', to: '/timetable/policies' },
	{ key: 'runs', label: 'Runs', to: '/timetable/runs' },
	{ key: 'exports', label: 'Exports', to: '/timetable/exports' },
];

export function TimetableSubNav() {
	const location = useLocation();
	const chrome = resolveRouteChrome(location.pathname);

	return (
		<div className="shrink-0 border-b border-border bg-background">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
				<h1
					className="text-base font-bold tracking-tight text-foreground"
					data-testid="timetable-page-heading"
				>
					{chrome.title}
				</h1>
				<nav
					aria-label="Timetable sections"
					data-testid="timetable-sub-nav"
					className="flex min-w-0 flex-wrap items-center gap-1"
				>
					{SUB_NAV_ITEMS.map((item) => (
						<NavLink
							key={item.key}
							to={item.to}
							end={item.end}
							data-testid={`timetable-sub-nav-${item.key}`}
							className={({ isActive }) =>
								cn(
									'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
									isActive
										? 'bg-muted text-foreground'
										: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
								)
							}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
			</div>
		</div>
	);
}
