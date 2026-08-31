import type { RoomScheduleEntry } from '@/types';

export type SectionInfo = { name: string; gradeLevel: number | null };

export type ViewMode = 'rooms' | 'teachers' | 'sections';

export const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

export type ScheduleGridSharedProps = {
	viewMode: ViewMode;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, SectionInfo>;
	roomMap: Map<number, string>;
};

export type ConflictClickHandler = (day: string, dayLabel: string, startTime: string, endTime: string, entries: RoomScheduleEntry[]) => void;
