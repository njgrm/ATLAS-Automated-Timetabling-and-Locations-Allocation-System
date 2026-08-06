import type { ScheduledEntry, Violation, ViolationSeverity } from '@/types';

export const TIMETABLE_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

export const TIMETABLE_DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

export const EMPTY_SCHEDULED_ENTRIES: ScheduledEntry[] = [];

export function getEntrySeverity(entryId: string, violationIndex: Map<string, Violation[]>): ViolationSeverity | null {
	const entries = violationIndex.get(entryId) ?? [];
	if (entries.some((violation) => violation.severity === 'HARD')) return 'HARD';
	if (entries.some((violation) => violation.severity === 'SOFT')) return 'SOFT';
	return null;
}
