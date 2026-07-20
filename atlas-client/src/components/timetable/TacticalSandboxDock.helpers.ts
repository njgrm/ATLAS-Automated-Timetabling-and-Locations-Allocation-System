import { matchesOwnershipDepartment } from '@/lib/faculty-assignment-helpers';
import type { FacultyMirror, ManualEditBatchPreviewResult, ManualEditProposal, ScheduledEntry, Subject, TeachingLoadRepairChange } from '@/types';

export function facultyDisplayName(faculty: FacultyMirror): string {
	return `${faculty.lastName}, ${faculty.firstName}`;
}

export function ancillaryCreditHours(faculty: FacultyMirror): number {
	const rawMinutes = (faculty as FacultyMirror & { ancillaryMinutesPerWeek?: number | null }).ancillaryMinutesPerWeek;
	return typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes / 60 : 0;
}

export function getFacultySubjectIds(faculty: FacultyMirror): Set<number> {
	return new Set((faculty.facultySubjects ?? []).map((assignment) => assignment.subjectId));
}

export function isEligibleFaculty(faculty: FacultyMirror, subject: Subject | undefined, selectedEntry: ScheduledEntry): boolean {
	if (!faculty.isActiveForScheduling) return false;
	if (faculty.id === selectedEntry.facultyId) return true;
	if (!subject) return false;
	if (getFacultySubjectIds(faculty).has(subject.id)) return true;
	if (matchesOwnershipDepartment(faculty.department, subject)) return true;
	return Boolean(faculty.canTeachOutsideDepartment && subject.allowedSpecializations?.includes(faculty.specialization ?? ''));
}

export function projectEntryFaculty(
	entry: ScheduledEntry,
	sandboxFacultyByEntryId: Map<string, number>,
	selectedEntryId: string | null,
	previewFacultyId: number | null,
	bulkEntryIds: Set<string>,
): ScheduledEntry {
	const committedOverride = sandboxFacultyByEntryId.get(entry.entryId);
	if (committedOverride != null) return { ...entry, facultyId: committedOverride };
	if (previewFacultyId != null && selectedEntryId && (entry.entryId === selectedEntryId || bulkEntryIds.has(entry.entryId))) {
		return { ...entry, facultyId: previewFacultyId };
	}
	return entry;
}

export function teachingHoursForFaculty(entries: ScheduledEntry[], facultyId: number): number {
	const minutes = entries.reduce((total, entry) => entry.facultyId === facultyId ? total + entry.durationMinutes : total, 0);
	return Math.round((minutes / 60) * 10) / 10;
}

export function buildFacultyTeachingMinuteIndex(
	entries: ScheduledEntry[],
	sandboxFacultyByEntryId: Map<string, number>,
): Map<number, number> {
	const minutesByFaculty = new Map<number, number>();
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? entry.facultyId;
		if (facultyId == null) continue;
		minutesByFaculty.set(facultyId, (minutesByFaculty.get(facultyId) ?? 0) + entry.durationMinutes);
	}
	return minutesByFaculty;
}

export function projectedTeachingHoursForFaculty(
	facultyId: number,
	baseMinutesByFaculty: Map<number, number>,
	entriesById: Map<string, ScheduledEntry>,
	targetEntryIds: string[],
	targetFacultyId: number,
	sandboxFacultyByEntryId: Map<string, number>,
): number {
	let minutes = baseMinutesByFaculty.get(facultyId) ?? 0;
	for (const entryId of targetEntryIds) {
		const entry = entriesById.get(entryId);
		if (!entry) continue;
		const currentFacultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? entry.facultyId;
		if (currentFacultyId === facultyId) minutes -= entry.durationMinutes;
		if (targetFacultyId === facultyId) minutes += entry.durationMinutes;
	}
	return Math.round((Math.max(0, minutes) / 60) * 10) / 10;
}

export function formatHours(value: number): string {
	return `${Math.round(value * 10) / 10}h`;
}

export function reviewStatusCopy(preview: ManualEditBatchPreviewResult | null, canCommitPreview: boolean): string {
	if (!preview) return 'Preview checks conflicts before save.';
	if (canCommitPreview) return 'Ready to save. No blocking schedule conflict was found.';
	return 'Choose a different teacher or remove blocked rows, then review again.';
}

export function previewErrorCopy(error: unknown): string {
	const response = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
	if (response?.code === 'COHORT_REPAIR_UNSUPPORTED') {
		return 'This class is part of a grouped or special-program coverage block. Use section coverage repair before changing Teaching Load from the timetable.';
	}
	if (response?.code === 'VERSION_CONFLICT') {
		return 'This schedule changed while the panel was open. Refresh schedule, review the class again, then preview.';
	}
	if (response?.code === 'FACULTY_VERSION_CONFLICT') {
		return 'Teaching Load changed while the panel was open. Refresh schedule, review the teacher, then preview.';
	}
	if (response?.code === 'RUN_ALREADY_PUBLISHED') {
		return 'This schedule is already published. Create a timetable revision instead of rewriting Teaching Load.';
	}
	return response?.message ?? (error instanceof Error ? error.message : 'Preview could not run. Check the selected class and try again.');
}

export function compactLoadStatus(candidate: { overCapHours: number; toCapHours: number }): 'Under load' | 'Near limit' | 'Over limit' {
	if (candidate.overCapHours > 0) return 'Over limit';
	if (candidate.toCapHours <= 2) return 'Near limit';
	return 'Under load';
}

export function buildFacultyChangeProposals(entries: ScheduledEntry[], sandboxFacultyByEntryId: Map<string, number>): ManualEditProposal[] {
	const proposals: ManualEditProposal[] = [];
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		if (facultyId == null || facultyId === entry.facultyId) continue;
		proposals.push({
			editType: 'CHANGE_FACULTY',
			entryId: entry.entryId,
			targetFacultyId: facultyId,
		});
	}
	return proposals;
}

export function findCanonicalOwner(subjectId: number | null, sectionId: number | null, facultyMap: Map<number, FacultyMirror>): FacultyMirror | null {
	if (!subjectId || !sectionId) return null;
	for (const faculty of facultyMap.values()) {
		const ownsEntry = (faculty.facultySubjects ?? []).some((assignment) =>
			assignment.subjectId === subjectId && (assignment.sectionIds ?? []).includes(sectionId),
		);
		if (ownsEntry) return faculty;
	}
	return null;
}

export function buildTeachingLoadRepairProposals(
	entries: ScheduledEntry[],
	proposals: ManualEditProposal[],
	canonicalOnlyTargets: Map<string, number>,
): ManualEditProposal[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const stagedEntryIds = new Set<string>();
	const changes: ManualEditProposal[] = [...proposals];

	for (const proposal of proposals) {
		if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') continue;
		stagedEntryIds.add(proposal.entryId);
	}

	for (const [entryId, targetFacultyId] of canonicalOnlyTargets.entries()) {
		if (stagedEntryIds.has(entryId)) continue;
		const entry = entriesById.get(entryId);
		if (!entry || entry.facultyId == null || entry.facultyId !== targetFacultyId) continue;
		changes.push({
			editType: 'CHANGE_FACULTY',
			entryId,
			targetFacultyId,
		});
	}

	return changes;
}

export function buildEntryRepairChanges(entries: ScheduledEntry[], proposals: ManualEditProposal[], canonicalOnlyTargets: Map<string, number>): TeachingLoadRepairChange[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const seen = new Set<string>();
	return [...proposals, ...Array.from(canonicalOnlyTargets.entries()).map(([entryId, targetFacultyId]) => ({ editType: 'CHANGE_FACULTY' as const, entryId, targetFacultyId }))]
		.flatMap((proposal) => {
			if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') return [];
			if (seen.has(proposal.entryId)) return [];
			seen.add(proposal.entryId);
			const entry = entriesById.get(proposal.entryId);
			if (!entry) return [];
			return [{
				kind: 'ENTRY' as const,
				entryId: entry.entryId,
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				fromFacultyId: entry.facultyId,
				toFacultyId: proposal.targetFacultyId,
			}];
		});
}

export function revisionDateError(value: string): string | null {
	if (!value.trim()) return 'Choose the first school day when this revision should take effect.';
	const parsed = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return 'Enter a valid effective date.';

	const now = new Date();
	const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const selectedUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
	if (selectedUtc <= todayUtc) return 'Choose tomorrow or a later school day. Same-day published revisions are not allowed.';
	return null;
}

export function formatSlot(entry: ScheduledEntry, formatTimeValue: (value: string) => string): string {
	return `${entry.day} ${formatTimeValue(entry.startTime)}-${formatTimeValue(entry.endTime)}`;
}

export function buildRevisionPayloadChange(change: { entry: ScheduledEntry; targetFacultyId: number }) {
	const previous = {
		facultyId: change.entry.facultyId,
		roomId: change.entry.roomId,
		day: change.entry.day,
		startTime: change.entry.startTime,
		endTime: change.entry.endTime,
		subjectId: change.entry.subjectId,
		sectionId: change.entry.sectionId,
	};
	return {
		entryId: change.entry.entryId,
		changeType: 'CHANGE_FACULTY',
		previous,
		next: {
			...previous,
			facultyId: change.targetFacultyId,
		},
	};
}
