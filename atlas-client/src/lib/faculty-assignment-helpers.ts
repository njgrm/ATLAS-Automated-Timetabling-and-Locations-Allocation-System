import type { ExternalSection, Subject } from '../types';

export const STANDARD_WEEKLY_TEACHING_HOURS = 30;
export const MAX_WEEKLY_TEACHING_HOURS = 40;
export const CLASS_ADVISER_EQUIVALENT_HOURS = 5;

export type LoadStatus = 'below-standard' | 'compliant' | 'overload-allowed' | 'over-cap';

export type FacultyAssignmentDraft = {
	subjectId: number;
	sectionIds: number[];
	gradeLevels: number[];
};

export type FacultyOwnershipState = {
	facultyId: number;
	facultyName: string;
	source: 'saved' | 'pending';
};

export type LoadBreakdownItem = {
	subjectId: number;
	subjectName: string;
	subjectCode: string;
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	minutesPerWeek: number;
	totalMinutes: number;
};

export type LoadProfile = {
	actualTeachingHours: number;
	equivalentHours: number;
	creditedTotalHours: number;
	overloadHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	breakdown: LoadBreakdownItem[];
};

function uniqueSortedPositiveInts(values: readonly number[] | null | undefined): number[] {
	return Array.from(new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0))).sort(
		(left, right) => left - right,
	);
}

export function deriveLoadStatus(actualTeachingHours: number): { status: LoadStatus; label: string } {
	if (actualTeachingHours > MAX_WEEKLY_TEACHING_HOURS) {
		return { status: 'over-cap', label: 'Over Cap' };
	}
	if (actualTeachingHours >= STANDARD_WEEKLY_TEACHING_HOURS) {
		return {
			status: 'overload-allowed',
			label: actualTeachingHours > STANDARD_WEEKLY_TEACHING_HOURS ? 'Overload Allowed' : 'Compliant',
		};
	}
	return { status: 'below-standard', label: 'Below Standard' };
}

export function buildSectionMap(sections: ExternalSection[]): Map<number, ExternalSection> {
	return new Map(sections.map((section) => [section.id, section]));
}

export function deriveGradeLevelsForSections(
	sectionIds: readonly number[],
	sectionMap: Map<number, ExternalSection>,
): number[] {
	return Array.from(
		new Set(
			uniqueSortedPositiveInts(sectionIds)
				.map((sectionId) => sectionMap.get(sectionId)?.displayOrder)
				.filter(
					(displayOrder): displayOrder is number =>
						typeof displayOrder === 'number' && Number.isInteger(displayOrder) && displayOrder > 0,
				),
		),
	).sort((left, right) => left - right);
}

export function normalizeDraftAssignments(
	assignments: FacultyAssignmentDraft[],
	sectionMap: Map<number, ExternalSection>,
): FacultyAssignmentDraft[] {
	return assignments
		.map((assignment) => {
			const sectionIds = uniqueSortedPositiveInts(assignment.sectionIds).filter((sectionId) => sectionMap.has(sectionId));
			return {
				subjectId: assignment.subjectId,
				sectionIds,
				gradeLevels: deriveGradeLevelsForSections(sectionIds, sectionMap),
			};
		})
		.filter((assignment) => assignment.sectionIds.length > 0)
		.sort((left, right) => left.subjectId - right.subjectId);
}

export function buildAssignmentSignature(assignments: FacultyAssignmentDraft[]): string {
	return assignments
		.map((assignment) => `${assignment.subjectId}:${uniqueSortedPositiveInts(assignment.sectionIds).join(',')}`)
		.sort()
		.join('|');
}

export function getAssignmentOwnershipKey(subjectId: number, sectionId: number): string {
	return `${subjectId}:${sectionId}`;
}

export function buildOwnershipMap(
	assignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
	source: FacultyOwnershipState['source'],
): Record<string, FacultyOwnershipState> {
	const ownershipMap: Record<string, FacultyOwnershipState> = {};
	for (const [facultyIdRaw, assignments] of Object.entries(assignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				ownershipMap[getAssignmentOwnershipKey(assignment.subjectId, sectionId)] = {
					facultyId,
					facultyName,
					source,
				};
			}
		}
	}
	return ownershipMap;
}

export function buildPendingOwnershipMap(
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	draftAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
): Record<string, FacultyOwnershipState> {
	const savedOwnershipMap = buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved');
	const pendingOwnershipMap: Record<string, FacultyOwnershipState> = {};

	for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		const savedSignature = new Set(
			(savedAssignmentsByFaculty[facultyId] ?? []).flatMap((assignment) =>
				assignment.sectionIds.map((sectionId) => getAssignmentOwnershipKey(assignment.subjectId, sectionId)),
			),
		);

		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
				const savedOwner = savedOwnershipMap[key];
				if (savedSignature.has(key) && savedOwner?.facultyId === facultyId) {
					continue;
				}
				pendingOwnershipMap[key] = {
					facultyId,
					facultyName,
					source: 'pending',
				};
			}
		}
	}

	return pendingOwnershipMap;
}

export function buildTeachingLoadProfile(
	assignments: FacultyAssignmentDraft[],
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
	equivalentHours = 0,
): LoadProfile {
	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	const breakdown: LoadBreakdownItem[] = [];
	let totalMinutes = 0;

	for (const assignment of assignments) {
		const subject = subjectMap.get(assignment.subjectId);
		if (!subject) continue;
		for (const sectionId of assignment.sectionIds) {
			const section = sectionMap.get(sectionId);
			if (!section) continue;
			breakdown.push({
				subjectId: subject.id,
				subjectName: subject.name,
				subjectCode: subject.code,
				sectionId,
				sectionName: section.name,
				gradeLevel: section.displayOrder,
				minutesPerWeek: subject.minMinutesPerWeek,
				totalMinutes: subject.minMinutesPerWeek,
			});
			totalMinutes += subject.minMinutesPerWeek;
		}
	}

	const actualTeachingHours = Math.round((totalMinutes / 60) * 10) / 10;
	const normalizedEquivalentHours = Math.round(equivalentHours * 10) / 10;
	const creditedTotalHours = Math.round((actualTeachingHours + normalizedEquivalentHours) * 10) / 10;
	const overloadHours = Math.round(Math.max(actualTeachingHours - STANDARD_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
	const overCapHours = Math.round(Math.max(actualTeachingHours - MAX_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
	const { status, label } = deriveLoadStatus(actualTeachingHours);

	return {
		actualTeachingHours,
		equivalentHours: normalizedEquivalentHours,
		creditedTotalHours,
		overloadHours,
		overCapHours,
		status,
		statusLabel: label,
		breakdown: breakdown.sort(
			(left, right) =>
				left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode),
		),
	};
}