import { matchPath, NavLink, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { resolveRouteChrome } from '@/components/app-shell/navigation';

type TimetableSubNavItem = {
	key: string;
	label: string;
	to: string;
	end?: boolean;
};

/**
 * C01R D1 — the persistent timetable sub-nav (the U3 spine). Five links into the
 * already-mounted `/timetable` shell: the nested children are element-less (see
 * `App.tsx`), so moving between them never remounts the workspace or refetches the grid —
 * this nav is the missing entry point, not a new tree.
 *
 * C01R D5 — the single visible `h1` naming the current timetable surface, reusing the
 * shared route-chrome titles instead of a forked copy.
 *
 * A2-TIMETABLE-CUSTODY (#51): the draft tab was "Planning", which read as a run state;
 * decision 8 settled it on "Draft". `key` is unchanged, so `timetable-sub-nav-draft` and
 * every assertion on it still hold.
 */
export const SUB_NAV_ITEMS: TimetableSubNavItem[] = [
	{ key: 'schedule', label: 'Schedule', to: '/timetable', end: true },
	{ key: 'draft', label: 'Draft', to: '/timetable/pre-generation' },
	{ key: 'setup', label: 'Setup', to: '/timetable/setup' },
	{ key: 'policies', label: 'Policies', to: '/timetable/policies' },
	{ key: 'runs', label: 'Runs', to: '/timetable/runs' },
];

/*
 * LAYOUT NOTE (MR-31 / MR-32, member review, class-schedule.docx) — written BEFORE the JSX
 * per AGENTS.md §11, and held short by the 150-line budget this file is committed to. The
 * member's verbatim report, the failing-first evidence and the contrast maths live in
 * `__tests__/member-tabs-affordance.test.ts`, which is where a reader should look.
 *
 * MEMBER: "It is not obvious that it is clickable because of its color. Light gray is
 * assumed to be unable to click. … for the button that is clicked, it will have a change of
 * color just like the "class schedule" menu."
 *
 * STAYS: the five tabs, their words, their order (decision 2); the <nav>/<h1> shape and
 * every existing data-testid; row-1 placement; and the control budget — five tabs are
 * navigation, not ACTION controls, so §8/decision-2's "at most 7 above the grid" is
 * UNCHANGED. Nothing added, nothing moved into `More`.
 *
 * GOES (the subtraction): (1) `text-muted-foreground` on an inactive tab — the app's
 * SECONDARY TEXT role, which at 12px reads as the disabled affordance the member named. It
 * becomes the full-ink `text-foreground` every other nav label wears, so all five tabs read
 * as pressable and the active one is no longer the only dark thing in the row. (2) The
 * ambiguous `bg-muted` active pill, indistinguishable from a neighbour's hover wash; it
 * becomes the app's ONE active-nav colour, so the pressed tab changes colour "just like
 * the class schedule menu" — the member's exact ask.
 *
 * ONE LOOK PER CONTROL (§8): `bg-accent text-accent-foreground` is NOT a new local variant —
 * it is the active treatment of BOTH the sidebar nav items and the app's own `@/ui` Tabs,
 * so this nav cannot drift from the item the member compares it to. Contrast: inactive
 * `--foreground`, active `--accent-foreground` on `--accent` (the same solid-button pairing
 * the primary button wears).
 *
 * STATE, NOT CLASS NAMES: colour alone dies in a screen reader and in monochrome print, so
 * the active tab is ARIA-distinguishable too — `role="tab"` + `aria-selected` per link,
 * `<nav>` as `role="tablist"`. `aria-current="page"` (NavLink already set it; three suites
 * assert it) is KEPT and must agree with `aria-selected`. `aria-selected` is a VALUE, not a
 * render-prop: `NavLink` forwards functions only for className/style/children and drops
 * them silently elsewhere, so it is computed from `matchPath` below — the same rule that
 * paints the className.
 */
/**
 * A7 c14 (operator, 2026-09-30 08:15) — the page TITLE alone, no tabs.
 *
 * The Simple header's ONE control row carries `Class Schedule` as a non-control
 * heading and NOTHING else from this module; the five section links move into the
 * `More` menu (see `TimetableSubNavLinks` with `variant="menu"`). This is the same
 * `<h1>`, the same `data-testid` and the same `resolveRouteChrome` call the
 * extracted row used, so the title can never drift between the two surfaces.
 */
export function TimetablePageHeading() {
	const location = useLocation();
	const chrome = resolveRouteChrome(location.pathname);

	return (
		<h1
			className="shrink-0 text-base font-bold tracking-tight text-foreground"
			data-testid="timetable-page-heading"
		>
			{chrome.title}
		</h1>
	);
}

/**
 * A7 c14 (operator, 2026-09-30 08:15) — the five section links, as ONE list with
 * TWO homes.
 *
 * `variant="nav"` is the standalone band every other timetable surface renders.
 * `variant="menu"` rehomes the identical five links into the Simple header's
 * `More` menu, so decision 2's requirement ("the tabs stay reachable and
 * labelled") still holds after the tabs leave the header row. Every
 * `timetable-sub-nav-${key}` testid and every href is unchanged, and there is
 * still exactly ONE `SUB_NAV_ITEMS` list — the menu is a renderer, not a copy.
 */
export function TimetableSubNavLinks({ variant = 'nav' }: { variant?: 'nav' | 'menu' }) {
	const location = useLocation();
	const isTabActive = (item: TimetableSubNavItem) =>
		matchPath({ path: item.to, end: item.end ?? false, caseSensitive: false }, location.pathname) !== null;

	if (variant === 'menu') {
		return (
			<div aria-label={`${CLASS_SCHEDULE_LABEL} sections`} data-testid="timetable-sub-nav" role="group">
				{SUB_NAV_ITEMS.map((item) => (
					<DropdownMenuItem key={item.key} asChild className="h-9 gap-2 text-xs">
						<NavLink
							to={item.to}
							end={item.end}
							aria-current={isTabActive(item) ? 'page' : undefined}
							data-testid={`timetable-sub-nav-${item.key}`}
							className={({ isActive }) => cn('flex w-full items-center', isActive ? 'font-semibold text-foreground' : 'text-muted-foreground')}
						>
							{item.label}
						</NavLink>
					</DropdownMenuItem>
				))}
			</div>
		);
	}

	return (
		<nav
			aria-label={`${CLASS_SCHEDULE_LABEL} sections`}
			data-testid="timetable-sub-nav"
			role="tablist"
			className="flex min-w-0 flex-wrap items-center gap-1"
		>
			{SUB_NAV_ITEMS.map((item) => (
				<NavLink
					key={item.key}
					to={item.to}
					end={item.end}
					role="tab"
					aria-selected={isTabActive(item)}
					data-testid={`timetable-sub-nav-${item.key}`}
					// A full-ink rounded chip, and the ONE active-nav colour the Class Schedule
					// sidebar item wears (§8). font-semibold stays on BOTH states: the weight
					// says "control", while fill and ink carry the state.
					className={({ isActive }) =>
						cn(
							'rounded-md border border-transparent px-2 py-1 text-xs font-semibold transition-colors',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
							isActive
								? 'border-accent bg-accent text-accent-foreground'
								: 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
						)
					}
				>
					{item.label}
				</NavLink>
			))}
			</nav>
	);
}

export function TimetableSubNavRow() {
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
			<TimetablePageHeading />
		<TimetableSubNavLinks />
		</div>
	);
}

/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the presentational row ALONE, and the
 * standalone band every other surface renders.
 *
 * The `<h1>` and the `<nav>` used to be welded to the `shrink-0 border-b
 * border-border bg-background` wrapper, so the only way to show the title and the tabs
 * inside the Simple header's row 1 was to render a SECOND bordered band — which is how a
 * header ends up with a title row, a sub-nav row and two control rows, the "regressed /
 * messy" shape the operator reported. `TimetableSimpleHeader` therefore renders
 * `TimetableSubNavRow` directly and `ScheduleReviewWorkspace` skips this band exactly
 * when it does, so the two are never on screen twice.
 *
 * ONE definition of the title, ONE `SUB_NAV_ITEMS` list, ONE `resolveRouteChrome` call, so
 * the two surfaces cannot drift onto two different titles or tab sets. EVERY existing
 * `data-testid` is on the same element as before, and `SUB_NAV_ITEMS` is untouched.
 */
export function TimetableSubNav() {
	return (
		<div className="shrink-0 border-b border-border bg-background">
			<TimetableSubNavRow />
		</div>
	);
}
