import {
	BarChart3,
	BookOpen,
	CalendarClock,
	CalendarDays,
	ClipboardList,
	GraduationCap,
	LayoutDashboard,
	MapPinned,
	Shield,
	UserCog,
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

export const facultyPlanningNav: NavItemDef[] = [
	{ label: 'Teachers', to: '/teachers', icon: Users, adminOnly: true },
	{ label: 'Teaching Load', to: '/teaching-load', icon: UserCog, adminOnly: true },
];

export const campusNav: NavItemDef[] = [
	{ label: 'Campus & Rooms', to: '/map', icon: MapPinned, adminOnly: true },
];

export const inputCollectionNav: NavItemDef[] = [
	{ label: 'Preferences', to: '/faculty/preferences', icon: ClipboardList, adminOnly: true },
	{ label: 'Room Requests', to: '/faculty/room-preferences', icon: CalendarDays, adminOnly: true },
];

export const buildValidateNav: NavItemDef[] = [
	{ label: 'Timetable', to: '/timetable', icon: CalendarClock, adminOnly: true },
	{ label: 'Schedules', to: '/schedules', icon: CalendarDays, adminOnly: true },
	{ label: 'Audit', to: '/audit', icon: Shield, adminOnly: true },
];

export const advancedNav: NavItemDef[] = [
	{ label: 'Analytics', to: '/analytics', icon: BarChart3, disabled: true },
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
	{ label: 'Teacher Planning', items: facultyPlanningNav },
	{ label: 'Campus', items: campusNav },
	{ label: 'Input Collection', items: inputCollectionNav },
	{ label: 'Build & Validate', items: buildValidateNav },
	{ label: 'My Portal', items: facultyNav },
	{ label: 'Advanced', items: advancedNav },
];
