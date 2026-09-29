import {
	BookOpen,
	CalendarClock,
	CalendarDays,
	CalendarRange,
	ClipboardList,
	DoorOpen,
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

/**
 * A7 C6 (item 1) — the lookup/print step's ONE plain name, shared by the
 * sidebar label and the route chrome so the two can never drift.
 */
export const LOOKUP_PRINT_LABEL = 'Look up & print schedules';

export const navigationNav: NavItemDef[] = [
	{ label: 'Dashboard', to: '/', icon: LayoutDashboard },
];

export const setupNav: NavItemDef[] = [
	// A7 C6 (item 1) — the demo story starts here. Before this entry the
	// school-year step had NO menu item at all: the only door handle was a
	// Dashboard link to the raw `/admin/year-setup`, so a first-time scheduler
	// could not find step 1 without being told the address.
	//
	// `adminOnly: true` and NO `schedulerAccess` is the load-bearing part, and
	// it is not a guess: `pages/AdminYearSetup.tsx` admits exactly
	// `ADMIN_ROLES = {admin, SYSTEM_ADMIN, officer}` and sends everyone else
	// back to `/`. `canSeeNavItem` resolves an `adminOnly` item with no
	// `schedulerAccess` to that same three-role set, so nav visibility and the
	// page's own authority agree exactly. Do NOT add `schedulerAccess: true`
	// here: that would advertise a page the page itself refuses.
	//
	// STORY POSITION: first in `setupNav`, before Subjects, because the demo
	// walks School Year -> Sections -> Subjects -> Teachers -> Teaching Load ->
	// Teacher Concerns -> make the Timetable -> look up & print schedules.
	// That is the ORDER OF THE MENU, read top to bottom. The demo script's own
	// narrative pairs Teacher Concerns with Teaching Load; `teachersAndRoomsNav`
	// has always carried Teaching Load first, and reordering it is not this
	// packet's business, so the comment records the menu rather than the story.
	{ label: 'School Year', to: '/admin/year-setup', icon: CalendarRange, adminOnly: true },
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true },
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
];

export const teachersAndRoomsNav: NavItemDef[] = [
	{ label: 'Teachers', to: '/teachers', icon: Users, adminOnly: true },
	{ label: 'Teaching Load', to: '/teaching-load', icon: ClipboardList, adminOnly: true, schedulerAccess: true },
	{ label: 'Teacher Concerns', to: '/faculty/concerns', icon: HeartHandshake, adminOnly: true, schedulerAccess: true },
	// A3-C8 REACHABILITY — `/faculty/room-preferences` is a real, fully built
	// review queue (620-line `OfficerRoomPreferences`, live summary read, preview
	// and review actions) that the shell already titled correctly via the
	// `routeChromeOverrides` entry for that path, yet had ZERO inbound links, so
	// no operator could reach it.
	//
	// `schedulerAccess` is DELIBERATELY ABSENT and load-bearing. The server
	// (`routes/room-preference.router.ts`) guards both the review PATCH and the
	// appeal-status PATCH with `PRIVILEGED_ROLES = {admin, officer,
	// SYSTEM_ADMIN}` and answers 403 FORBIDDEN — "Only admin, officer, or
	// SYSTEM_ADMIN can review room preferences." This item is `adminOnly` and
	// carries no `schedulerAccess`, so `canSeeNavItem` resolves visibility to
	// exactly that same three-role set: nav visibility and server authority
	// agree. Adding `schedulerAccess: true` would advertise an approve/reject
	// queue to a scheduler holding only `timetable:read` — a NEW false errand,
	// which is the exact defect class this lane exists to remove. The omission
	// is pinned by test row 3 in
	// `__tests__/a3-c8-room-preferences-reachability.test.tsx`; do not "fix"
	// this by adding the flag.
	{ label: 'Room Preferences', to: '/faculty/room-preferences', icon: DoorOpen, adminOnly: true },
	{ label: 'Campus & Rooms', to: '/map', icon: MapPinned, adminOnly: true },
];

export const timetableNav: NavItemDef[] = [
	{ label: 'Class Schedule', to: '/timetable', icon: CalendarClock, adminOnly: true, schedulerAccess: true },
];

export const reviewPublishNav: NavItemDef[] = [
	// A7 C6 (item 1) — one name per job. "Class Schedule" (the Timetable entry,
	// which A2 C13 has ruled STAYS) and "Room Schedules" both used to read like
	// "review", so an older user could find both and still not know which one
	// reviews the timetable. This entry is the LAST step of the demo story —
	// look something up and print it — so it now says that. The route `to` is
	// unchanged: this is a label, not a destination.
	{ label: LOOKUP_PRINT_LABEL, to: '/schedules', icon: CalendarDays, adminOnly: true, schedulerAccess: true },
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
	'/faculty/preferences': { group: 'Teachers and Rooms', title: 'Faculty Preferences' },
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
	// A7 C6 (item 1) — one destination, ONE name. `/room-schedules` and
	// `/schedules` mount the SAME page, and the sidebar entry (at `/schedules`)
	// now reads "Look up & print schedules". Without this override the deep
	// links from `RoomSchedulePreview` / `RoomScheduleOverlay` would still show
	// the old "Room Schedules" shell title, so one page would answer to two
	// names depending on the address — the duplicate-label defect the A3-C8
	// reachability row 5 forbids. The page itself is NOT touched here: A5 C5
	// owns `pages/RoomSchedules.tsx` and its own PageHeader; if A5 C5 picks a
	// different plain name, it changes this override and the nav label together.
	'/room-schedules': { group: 'Review and Publish', title: LOOKUP_PRINT_LABEL },

	'/faculty/room-preferences': { group: 'Teachers and Rooms', title: 'Room Preferences' },
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
