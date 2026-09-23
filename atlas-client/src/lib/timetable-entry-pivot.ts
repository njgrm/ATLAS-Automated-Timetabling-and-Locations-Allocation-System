import type { ExternalSection, ScheduledEntry } from '@/types';

export type TimetablePivotMode = 'section' | 'faculty' | 'room';

export function resolveTimetableEntryPivot(input: {
	viewMode: TimetablePivotMode;
	entry: ScheduledEntry;
	sections: ReadonlyMap<number, Pick<ExternalSection, 'homeRoomId'>>;
	facultyIds: ReadonlySet<number>;
	roomIds: ReadonlySet<number>;
}): { entityId: number | null; guidance: string | null } {
	const { viewMode, entry } = input;
	if (viewMode === 'section') {
		return input.sections.has(entry.sectionId)
			? { entityId: entry.sectionId, guidance: null }
			: { entityId: null, guidance: 'Section details are unavailable, so the current schedule view was kept.' };
	}
	if (viewMode === 'faculty') {
		return entry.facultyId != null && input.facultyIds.has(entry.facultyId)
			? { entityId: entry.facultyId, guidance: null }
			: { entityId: null, guidance: 'This session has no confirmed teacher, so the current schedule view was kept.' };
	}
	const roomId = entry.roomId ?? input.sections.get(entry.sectionId)?.homeRoomId ?? null;
	return roomId != null && input.roomIds.has(roomId)
		? { entityId: roomId, guidance: null }
		: { entityId: null, guidance: 'This session has no confirmed room or configured homeroom, so the current schedule view was kept.' };
}
