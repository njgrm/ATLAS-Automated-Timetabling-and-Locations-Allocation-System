export type TimetableLoadingIntent = { title: string; message: string };

const routeCopy: Record<string, TimetableLoadingIntent> = {
	'/timetable/pre-generation': { title: 'Draft queue', message: 'Loading the selected school year and term before showing sessions to place.' },
	'/timetable/policies': { title: 'Scheduling policies', message: 'Loading the current school-year policy.' },
	'/timetable/manual-edit': { title: 'Manual edit', message: 'Loading the selected timetable before opening edit tools.' },
	'/timetable/map': { title: 'Rooms and map', message: 'Loading room and timetable context.' },
	'/timetable/building': { title: 'Building', message: 'Loading the selected room context.' },
	'/timetable/exports': { title: 'Exports', message: 'Loading the source timetable and export options.' },
	'/timetable/runs': { title: 'Generation history', message: 'Loading generation runs for the verified school year.' },
	'/timetable/setup': { title: 'Review setup', message: 'Loading the verified school-year setup and readiness.' },
};

/** Keep direct links legible while run data is unresolved; this is presentation only. */
export function resolveTimetableLoadingIntent(pathname: string): TimetableLoadingIntent | null {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return routeCopy[normalized] ?? null;
}
