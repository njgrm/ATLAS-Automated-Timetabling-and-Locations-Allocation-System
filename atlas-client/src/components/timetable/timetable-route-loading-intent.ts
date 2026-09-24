export type TimetableLoadingIntent = { title: string; message: string };

const routeCopy: Record<string, TimetableLoadingIntent> = {
	'/timetable/pre-generation': { title: 'Draft queue', message: 'Checking the school year and schedule information before showing sessions to place.' },
	'/timetable/policies': { title: 'Scheduling policies', message: 'Checking the schedule rules for this school year.' },
	'/timetable/manual-edit': { title: 'Manual edit', message: 'Checking the selected schedule before opening edit tools.' },
	'/timetable/map': { title: 'Rooms and map', message: 'Checking rooms and schedule information.' },
	'/timetable/building': { title: 'Building', message: 'Checking the selected room information.' },
	'/timetable/exports': { title: 'Exports', message: 'Checking the schedule and available downloads.' },
	'/timetable/runs': { title: 'Generation history', message: 'Checking schedules for this school year.' },
	'/timetable/setup': { title: 'Check schedule information', message: 'ATLAS is checking the school year and schedule information. No changes are made by this check.' },
};

/** Keep direct links legible while run data is unresolved; this is presentation only. */
export function resolveTimetableLoadingIntent(pathname: string): TimetableLoadingIntent | null {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return routeCopy[normalized] ?? null;
}
