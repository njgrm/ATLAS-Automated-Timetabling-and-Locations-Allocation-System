import {
	BookOpen,
	CalendarClock,
	CalendarDays,
	ClipboardList,
	GraduationCap,
	HeartHandshake,
	LayoutDashboard,
	MapPinned,
	Shield,
	Users,
} from 'lucide-react';

export type NavItemDef = {
	label: string;
	to: string;
	icon: typeof LayoutDashboard;
	adminOnly?: boolean;
	facultyOnly?: boolean;
	schedulerAccess?: boolean;
	disabled?: boolean;
};

export const navigationNav: NavItemDef[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard },
];

export const setupNav: NavItemDef[] = [
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true },
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
];

export const teachersAndRoomsNav: NavItemDef[] = [
	{ label: 'Teachers', to: '/teachers', icon: Users, adminOnly: true },
	{ label: 'Teaching Load', to: '/teaching-load', icon: ClipboardList, adminOnly: true, schedulerAccess: true },
	/*
	 * A3 c13 — "Room Preferences" and "Faculty Preferences" are GONE as nav
	 * items. Both routes now redirect here, and the room work is a per-class
	 * section of the selected teacher's form.
	 *
	 * A3-C8 originally ADDED the Room Preferences item because the 692-line
	 * `OfficerRoomPreferences` review queue was fully built and had zero inbound
	 * links. That was a real reachability defect and the fix was right for the
	 * surface that existed. The queue is now retired: keeping the item would
	 * advertise a second destination that immediately redirects, which is the
	 * duplicate-link defect the same lane removed elsewhere.
	 *
	 * The A3-C8 authority note still stands where it matters: the room APPLY is
	 * guarded server-side by `PRIVILEGED_ROLES = {admin, officer, SYSTEM_ADMIN}`
	 * (`routes/room-preference.router.ts` review PATCH). This page item carries
	 * `schedulerAccess: true`, so a scheduler holding only `timetable:read` can
	 * RECORD a room need but will be refused with 403 on the apply. That refusal
	 * is the server's answer, shown verbatim, and is the correct division: the
	 * note moves here rather than being silently lost.
	 */
	{ label: 'Teacher Concerns', to: '/faculty/concerns', icon: HeartHandshake, adminOnly: true, schedulerAccess: true },
	{ label: 'Campus & Rooms', to: '/map', icon: MapPinned, adminOnly: true },
];

export const timetableNav: NavItemDef[] = [
	{ label: 'Class Schedule', to: '/timetable', icon: CalendarClock, adminOnly: true, schedulerAccess: true },
];

export const reviewPublishNav: NavItemDef[] = [
	{ label: 'Room Schedules', to: '/schedules', icon: CalendarDays, adminOnly: true, schedulerAccess: true },
];

export const auditNav: NavItemDef[] = [
	{ label: 'Audit', to: '/audit', icon: Shield, adminOnly: true },
];

export const facultyNav: NavItemDef[] = [
	// Operator instruction 2026-09-26 — `/my` now resolves to the retirement
	// tombstone (`RetiredFacultyPortalNotice`), not a dashboard. The entry stays so
	// faculty keep one stable faculty-portal destination instead of an unmatched URL.
	{ label: 'My Dashboard', to: '/my', icon: LayoutDashboard, facultyOnly: true },
];

export const breadcrumbGroups: { label: string; items: NavItemDef[] }[] = [
	{ label: 'Navigation', items: navigationNav },
	{ label: 'School Setup', items: setupNav },
	{ label: 'Teachers and Rooms', items: teachersAndRoomsNav },
	{ label: 'Class Schedule', items: timetableNav },
	{ label: 'Review and Publish', items: reviewPublishNav },
	{ label: 'Audit', items: auditNav },
	{ label: 'My Portal', items: facultyNav },
];

export type NavigationActor = { role: string; capabilities?: string[] };

export function canSeeNavItem(actor: NavigationActor, item: NavItemDef): boolean {
	const isAdmin = actor.role === 'admin' || actor.role === 'SYSTEM_ADMIN' || actor.role === 'officer';
	const canSchedule = actor.capabilities?.includes('timetable:read') === true;
	const canSelfServe = actor.capabilities?.includes('faculty:self-service') === true || actor.role === 'faculty';
	if (item.disabled) return false;
	if (item.to === '/' && canSelfServe && !canSchedule && !isAdmin) return false;
	if (item.facultyOnly) return canSelfServe;
	if (!item.adminOnly) return true;
	return isAdmin || (item.schedulerAccess === true && canSchedule);
}

export function getVisibleNavigation(actor: NavigationActor): NavItemDef[] {
	return breadcrumbGroups.flatMap((group) => group.items.filter((item) => canSeeNavItem(actor, item)));
}

export type RouteChrome = {
	title: string;
	breadcrumbs: string[];
};

const routeChromeOverrides: Record<string, { group?: string; title: string }> = {
	// Operator instruction 2026-09-26 — the faculty portal is retired, so `/my`
	// states that truthfully in its own chrome. The breadcrumb leaf equals the
	// rendered tombstone title, which `RetiredFacultyPortalNotice` reads from here.
	'/my': { group: 'My Portal', title: 'Faculty Portal Retired' },
	'/subjects/requirements': { group: 'School Setup', title: 'Subject Requirements' },
	'/subjects/decision-workspace': { group: 'School Setup', title: 'Subject Decisions' },
	'/teaching-load/history': { group: 'Teachers and Rooms', title: 'Archived Teaching Load' },
	'/faculty': { group: 'Teachers and Rooms', title: 'Faculty' },
	'/assignments': { group: 'Teachers and Rooms', title: 'Assignments' },
	'/faculty/concerns': { group: 'Teachers and Rooms', title: 'Teacher Concerns' },
	'/timetabling/how-it-works': { group: 'Class Schedule', title: 'How Scheduling Works' },
	// UX-R03a — the nested policy route shares the Class Schedule shell.
	'/timetable/policies': { group: 'Class Schedule', title: 'Scheduling Policy' },
	// UX-R03c — the R03a/R03b routes share the Class Schedule shell instead of the generic ATLAS fallback.
	'/timetable/pre-generation': { group: 'Class Schedule', title: 'Pre-Generation' },
	'/timetable/map': { group: 'Class Schedule', title: 'Campus Map' },
	'/timetable/manual-edit': { group: 'Class Schedule', title: 'Manual Edit' },
	'/timetable/building': { group: 'Class Schedule', title: 'Building View' },
	'/timetable/exports': { group: 'Class Schedule', title: 'Download schedules' },
	// UX-R03e (runs) — the read-only run-history route shares the Class Schedule shell.
	'/timetable/runs': { group: 'Class Schedule', title: 'Runs' },
	// UX-R03e (setup) — the composed setup route shares the Class Schedule shell.
	'/timetable/setup': { group: 'Class Schedule', title: 'Setup' },
	'/room-schedules': { group: 'Review and Publish', title: 'Room Schedules' },
	/*
	 * A3 c13 — the two retired route-chrome entries for
	 * `/faculty/room-preferences` (title "Room Preferences") and
	 * `/faculty/preferences` (title "Faculty Preferences") are REMOVED, not
	 * re-pointed. Both pages now render `<Navigate to="/faculty/concerns"
	 * replace />`, so the browser lands on the concerns route and resolves its
	 * chrome from the entry above. Keeping a title for a path that is never
	 * rendered is a second name for one destination — the duplicate-link defect
	 * A3-C6 removed elsewhere.
	 */
	'/admin/year-setup': { group: 'School Setup', title: 'School Year Setup' },
};

function breadcrumbLabels(group: string | undefined, title: string): string[] {
	if (!group || group === 'Navigation' || group === title) return [title];
	return [group, title];
}

/** Resolve one truthful shell title and breadcrumb trail for every authenticated route. */
export function resolveRouteChrome(pathname: string): RouteChrome {
	const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	const override = routeChromeOverrides[normalizedPath];
	if (override) {
		return {
			title: override.title,
			breadcrumbs: breadcrumbLabels(override.group, override.title),
		};
	}

	for (const group of breadcrumbGroups) {
		const item = group.items.find((candidate) => candidate.to === normalizedPath);
		if (!item) continue;
		return {
			title: item.label,
			breadcrumbs: breadcrumbLabels(group.label, item.label),
		};
	}

	return { title: 'ATLAS', breadcrumbs: ['ATLAS'] };
}
