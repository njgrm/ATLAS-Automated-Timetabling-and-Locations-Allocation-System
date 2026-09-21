import {
	BookOpen,
	CalendarClock,
	CalendarDays,
	ClipboardList,
	GraduationCap,
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
	{ label: 'Teaching Load', to: '/teaching-load', icon: ClipboardList, adminOnly: true },
	{ label: 'Campus & Rooms', to: '/map', icon: MapPinned, adminOnly: true },
];

export const timetableNav: NavItemDef[] = [
	{ label: 'Class Schedule', to: '/timetable', icon: CalendarClock, adminOnly: true },
];

export const reviewPublishNav: NavItemDef[] = [
	{ label: 'Room Schedules', to: '/schedules', icon: CalendarDays, adminOnly: true },
];

export const auditNav: NavItemDef[] = [
	{ label: 'Audit', to: '/audit', icon: Shield, adminOnly: true },
];

export const facultyNav: NavItemDef[] = [
	{ label: 'My Dashboard', to: '/my', icon: LayoutDashboard, facultyOnly: true },
	{ label: 'My Schedule', to: '/my/schedule', icon: CalendarClock, facultyOnly: true },
	{ label: 'My Preferences', to: '/my/preferences', icon: ClipboardList, facultyOnly: true },
	{ label: 'My Room Requests', to: '/my/room-preferences', icon: CalendarDays, facultyOnly: true },
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

export type RouteChrome = {
	title: string;
	breadcrumbs: string[];
};

const routeChromeOverrides: Record<string, { group?: string; title: string }> = {
	'/subjects/requirements': { group: 'School Setup', title: 'Subject Requirements' },
	'/subjects/decision-workspace': { group: 'School Setup', title: 'Subject Decisions' },
	'/teaching-load/history': { group: 'Teachers and Rooms', title: 'Archived Teaching Load' },
	'/faculty': { group: 'Teachers and Rooms', title: 'Faculty' },
	'/assignments': { group: 'Teachers and Rooms', title: 'Assignments' },
	'/faculty/preferences': { group: 'Teachers and Rooms', title: 'Faculty Preferences' },
	'/timetabling/how-it-works': { group: 'Class Schedule', title: 'How Scheduling Works' },
	// UX-R03a — the nested policy route shares the Class Schedule shell.
	'/timetable/policies': { group: 'Class Schedule', title: 'Scheduling Policy' },
	// UX-R03c — the R03a/R03b routes share the Class Schedule shell instead of the generic ATLAS fallback.
	'/timetable/pre-generation': { group: 'Class Schedule', title: 'Pre-Generation' },
	'/timetable/map': { group: 'Class Schedule', title: 'Campus Map' },
	'/timetable/manual-edit': { group: 'Class Schedule', title: 'Manual Edit' },
	'/timetable/building': { group: 'Class Schedule', title: 'Building View' },
	'/timetable/exports': { group: 'Class Schedule', title: 'Exports' },
	// UX-R03e (runs) — the read-only run-history route shares the Class Schedule shell.
	'/timetable/runs': { group: 'Class Schedule', title: 'Runs' },
	'/room-schedules': { group: 'Review and Publish', title: 'Room Schedules' },
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
