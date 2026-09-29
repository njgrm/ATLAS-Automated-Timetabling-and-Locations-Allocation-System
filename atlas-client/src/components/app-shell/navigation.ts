import {
	BookOpen,
	CalendarClock,
	CalendarDays,
	CalendarRange,
	ClipboardList,
	GraduationCap,
	HeartHandshake,
	LayoutDashboard,
	MapPinned,
	Shield,
	Users,
} from 'lucide-react';

import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';

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
	// Teacher Preferences -> make the Timetable -> look up & print schedules.
	// That is the ORDER OF THE MENU, read top to bottom. The demo script's own
	// narrative pairs Teacher Preferences with Teaching Load; `teachersAndRoomsNav`
	// has always carried Teaching Load first, and reordering it is not this
	// packet's business, so the comment records the menu rather than the story.
	{ label: 'School Year', to: '/admin/year-setup', icon: CalendarRange, adminOnly: true },
	{ label: 'Sections', to: '/sections', icon: GraduationCap, adminOnly: true },
	{ label: 'Subjects', to: '/subjects', icon: BookOpen, adminOnly: true },
];

export const teachersAndRoomsNav: NavItemDef[] = [
	{ label: 'Teachers', to: '/teachers', icon: Users, adminOnly: true },
	{ label: 'Teaching Load', to: '/teaching-load', icon: ClipboardList, adminOnly: true, schedulerAccess: true },
	/*
	 * A3 c13 — "Room Preferences" and "Faculty Preferences" are GONE as nav
	 * items. Both retired pages now fold into Teacher Preferences, and the
	 * room work is a per-class section of the selected teacher's form.
	 *
	 * A3 c15 moved the destination onto `/faculty/preferences` and retired
	 * `/faculty/concerns` as its alias, so this ONE item is the only sidebar
	 * entry for either page.
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
	{ label: 'Teacher Preferences', to: '/faculty/preferences', icon: HeartHandshake, adminOnly: true, schedulerAccess: true },
	{ label: 'Campus & Rooms', to: '/map', icon: MapPinned, adminOnly: true },
];

export const timetableNav: NavItemDef[] = [
	// A2 C13 (item 2) — the name is already "Class Schedule" here, and the
	// ruling is that it STAYS: it is the familiar name, it already reaches the nav
	// item, the group divider, the breadcrumb group, the page `<h1>` and the
	// product's own cross-page links. The internal name "Timetable" is what has
	// to stop leaking into user-visible text, not the other way round.
	// `to: '/timetable'` is the ROUTE and is unchanged.
	{ label: CLASS_SCHEDULE_LABEL, to: '/timetable', icon: CalendarClock, adminOnly: true, schedulerAccess: true },
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
	{ label: CLASS_SCHEDULE_LABEL, items: timetableNav },
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
	'/faculty/concerns': { group: 'Teachers and Rooms', title: 'Teacher Preferences' },
	'/timetabling/how-it-works': { group: CLASS_SCHEDULE_LABEL, title: 'How Scheduling Works' },
	// UX-R03a — the nested policy route shares the Class Schedule shell.
	'/timetable/policies': { group: CLASS_SCHEDULE_LABEL, title: 'Scheduling Policy' },
	// UX-R03c — the R03a/R03b routes share the Class Schedule shell instead of the generic ATLAS fallback.
	'/timetable/pre-generation': { group: CLASS_SCHEDULE_LABEL, title: 'Pre-Generation' },
	'/timetable/map': { group: CLASS_SCHEDULE_LABEL, title: 'Campus Map' },
	'/timetable/manual-edit': { group: CLASS_SCHEDULE_LABEL, title: 'Manual Edit' },
	'/timetable/building': { group: CLASS_SCHEDULE_LABEL, title: 'Building View' },
	'/timetable/exports': { group: CLASS_SCHEDULE_LABEL, title: 'Download schedules' },
	// UX-R03e (runs) - the read-only run-history route shares the Class Schedule shell.
	'/timetable/runs': { group: CLASS_SCHEDULE_LABEL, title: 'Runs' },
	// UX-R03e (setup) - the composed setup route shares the Class Schedule shell.
	'/timetable/setup': { group: CLASS_SCHEDULE_LABEL, title: 'Setup' },
	/*
	 * A7 C6 (item 1) — one destination, ONE name. `/room-schedules` and
	 * `/schedules` mount the SAME page, and the sidebar entry (at `/schedules`)
	 * reads LOOKUP_PRINT_LABEL. Without this override the deep links into the
	 * lookup page would still show the old "Room Schedules" shell title, so one
	 * page would answer to two names depending on the address.
	 *
	 * Integrated over A5 C5, which owns `pages/RoomSchedules.tsx`. The page's own
	 * heading is A5 C5's to set: it currently reads "Schedules", which is a third
	 * name for this destination and is recorded as a named follow-up for A5 C5's
	 * owner. A5 C5 must not re-point this override without changing the sidebar
	 * label in the same commit, or one destination gets two names again.
	 */
	'/room-schedules': { group: 'Review and Publish', title: LOOKUP_PRINT_LABEL },
	/*
	 * A3 c13 — the route-chrome entries for `/faculty/room-preferences` and the
	 * original `/faculty/preferences` page are RETIRED, not deleted. Their old
	 * titles ("Room Preferences", "Faculty Preferences") named pages that no
	 * longer exist; these name the page they actually land on.
	 *
	 * A URL that still exists — even one whose component is now a
	 * `<Navigate replace />` — must never flash the generic "ATLAS" title while
	 * the router settles, so every folded path resolves the chrome of the page
	 * it actually lands on: Teacher Preferences. That is one destination under one
	 * name, which is what the removal was for, and it is a behaviour the ux-r01
	 * shared-chrome row pins for every authenticated route.
	 *
	 * A7 C6 landed alongside A3 c13, so its packet note that the Room
	 * Preferences nav entry "stays until A3 c13 lands" is now moot: A3 c13 has
	 * landed and owns both the entry and this chrome title.
	 *
	 * A3 c15 promoted `/faculty/preferences` from a folded redirect to the real
	 * page route and added `/faculty/concerns` above as the retired alias, so the
	 * retired deep link shows truthful chrome for the instant before it settles.
	 */
	'/faculty/preferences': { group: 'Teachers and Rooms', title: 'Teacher Preferences' },
	'/faculty/room-preferences': { group: 'Teachers and Rooms', title: 'Teacher Preferences' },
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
