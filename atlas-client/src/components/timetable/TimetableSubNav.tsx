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
	//
	// A2-TIMETABLE-CUSTODY (#51): the label was "Draft", which on a PUBLISHED run
	// sat beside a generated schedule and read as that run's state. This link is a
	// SECTION, not a run state, so it is named for the section. The run's own
	// Draft/Published word now comes from one place —
	// `runStateSentence` in the header's orientation strip — so a section name and
	// a run state can no longer be read as the same claim. `key` is unchanged, so
	// the `timetable-sub-nav-draft` testid and every existing assertion on it
	// still hold.
	{ key: 'draft', label: 'Planning', to: '/timetable/pre-generation' },
	{ key: 'setup', label: 'Setup', to: '/timetable/setup' },
	{ key: 'policies', label: 'Policies', to: '/timetable/policies' },
	{ key: 'runs', label: 'Runs', to: '/timetable/runs' },
];

/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the presentational row ALONE.
 *
 * The `<h1>` and the `<nav>` used to be welded to the `shrink-0 border-b
 * border-border bg-background` wrapper, so the only way to show the title and the
 * tabs inside the Simple header's row 1 was to render a SECOND bordered band —
 * which is how a header ends up with a title row, a sub-nav row and two control
 * rows, the "regressed / messy" shape the operator reported.
 *
 * This component renders the two elements and nothing else. `TimetableSubNav`
 * below keeps the wrapper for every other surface, so its appearance is unchanged
 * to the pixel; the Simple header renders `TimetableSubNavRow` directly, inside
 * its own row 1. There is still exactly ONE definition of the title, ONE
 * `SUB_NAV_ITEMS` list and ONE `resolveRouteChrome` call, so the two surfaces
 * cannot drift onto two different titles or two different tab sets.
 *
 * EVERY existing `data-testid` (`timetable-page-heading`, `timetable-sub-nav`, and
 * `timetable-sub-nav-${key}`) is on the same element as before, and `SUB_NAV_ITEMS`
 * is untouched.
 */
export function TimetableSubNavRow() {
	const location = useLocation();
	const chrome = resolveRouteChrome(location.pathname);

	return (
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
	);
}

/**
 * The standalone band every other surface renders: the presentational row inside
 * its `shrink-0 border-b border-border bg-background` wrapper, byte-identical to
 * what this file rendered before the row was extracted.
 */
export function TimetableSubNav() {
	return (
		<div className="shrink-0 border-b border-border bg-background">
			<TimetableSubNavRow />
		</div>
	);
}
