import type { FacultySummary } from '@/types';
import { MAX_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';

export function overCapWeeklyMaxHours(roster: FacultySummary[]): number {
	const counted = roster.filter((teacher) => teacher.isActiveForScheduling && !teacher.isPlaceholder &&
		(teacher.sectionTeachingHours ?? 0) > teacher.maxHoursPerWeek);
	const maximumOf = (list: FacultySummary[]) => list.reduce((max, teacher) => Math.max(max, teacher.maxHoursPerWeek ?? 0), 0);
	return maximumOf(counted) || maximumOf(roster) || MAX_WEEKLY_TEACHING_HOURS;
}

export function overCapChipHelper(roster: FacultySummary[]): string {
	return `Active teachers above the ${overCapWeeklyMaxHours(roster)}h weekly maximum. Move classes before generating.`;
}
