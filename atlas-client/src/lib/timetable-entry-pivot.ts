import type { ExternalSection } from '@/types';
import type { ScheduledEntry, Violation } from '@/types';

export type TimetablePivotMode = 'section' | 'faculty' | 'room';
export type TimetableEntryContext = { sectionId: number; facultyId: number | null; roomId: number | null };

export function requiresFacultyIssueConfirmation(input: {
	viewMode: TimetablePivotMode;
	entityFilter: string;
	facultyId: number;
	canonicalFacultyExists: boolean;
}): boolean {
	return input.canonicalFacultyExists
		&& !(input.viewMode === 'faculty' && input.entityFilter === String(input.facultyId));
}

export function resolveViolationFacultyTarget(input: {
	violation: Violation;
	entries: readonly ScheduledEntry[];
	facultyIds: ReadonlySet<number>;
}): { facultyId: number | null; entry: ScheduledEntry | null } {
	const entryIds = new Set(input.violation.entities.entryIds ?? []);
	const affectedEntries = input.entries.filter((entry) => entryIds.has(entry.entryId));
	const canonicalFacultyId = input.violation.entities.facultyId;
	const inferredFacultyIds = new Set(affectedEntries.flatMap((entry) => entry.facultyId == null ? [] : [entry.facultyId]));
	const facultyId = typeof canonicalFacultyId === 'number'
		? canonicalFacultyId
		: (inferredFacultyIds.size === 1 ? [...inferredFacultyIds][0] : null);
	if (facultyId == null || !input.facultyIds.has(facultyId)) return { facultyId: null, entry: null };
	const entry = affectedEntries.find((candidate) => candidate.facultyId === facultyId) ?? null;
	return { facultyId, entry };
}

export function resolveTimetableEntryPivot(input: {
	viewMode: TimetablePivotMode;
	entry: TimetableEntryContext;
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
	const configuredHomeRoomId = input.sections.get(entry.sectionId)?.homeRoomId ?? null;
	const roomId = configuredHomeRoomId ?? entry.roomId ?? null;
	return roomId != null && input.roomIds.has(roomId)
		? { entityId: roomId, guidance: null }
		: { entityId: null, guidance: 'This session has no confirmed room or configured homeroom, so the current schedule view was kept.' };
}
