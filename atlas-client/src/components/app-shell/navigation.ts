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
	{ label: 'Timetable', to: '/timetable', icon: CalendarClock, adminOnly: true },
];

export const reviewPublishNav: NavItemDef[] = [
	{ label: 'Schedules', to: '/schedules', icon: CalendarDays, adminOnly: true },
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
	{ label: 'Timetable', items: timetableNav },
	{ label: 'Review and Publish', items: reviewPublishNav },
	{ label: 'Audit', items: auditNav },
	{ label: 'My Portal', items: facultyNav },
];
