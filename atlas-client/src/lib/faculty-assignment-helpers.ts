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

export type SubjectSectionOwnershipIndexEntry = {
	subjectId: number;
	sectionId: number;
	facultyId: number;
	facultyName: string;
};

export type LoadBreakdownItem = {
	subjectId: number;
	subjectName: string;
	subjectCode: string;
	rotationFamily: string | null;
	isRotationDuplicate: boolean;
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	minutesPerWeek: number;
	totalMinutes: number;
};

export type RotationFamilyBreakdownItem = {
	family: string;
	rawHours: number;
	creditedHours: number;
	overcountHours: number;
	unitCount: number;
	subjectCodes: string[];
};

export type LoadProfile = {
	actualTeachingHours: number;
	rawTeachingHours: number;
	rotationOvercountHours: number;
	equivalentHours: number;
	creditedTotalHours: number;
	overloadHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
	rotationFamilies: RotationFamilyBreakdownItem[];
	breakdown: LoadBreakdownItem[];
};

function resolveRotationFamily(subject: Pick<Subject, 'code' | 'rotationFamily'>): string | null {
	const explicit = (subject.rotationFamily ?? '').trim().toUpperCase();
	if (explicit.length > 0) {
		return explicit;
	}
	const code = (subject.code ?? '').trim().toUpperCase();
	if (code.startsWith('TLE')) return 'TLE_ROTATION';
	if (code.startsWith('SCI_')) return 'SCIENCE';
	return null;
}

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

export function buildOwnershipMapFromIndex(
	ownershipIndex: SubjectSectionOwnershipIndexEntry[],
): Record<string, FacultyOwnershipState> {
	const ownershipMap: Record<string, FacultyOwnershipState> = {};
	for (const entry of ownershipIndex) {
		ownershipMap[getAssignmentOwnershipKey(entry.subjectId, entry.sectionId)] = {
			facultyId: entry.facultyId,
			facultyName: entry.facultyName,
			source: 'saved',
		};
	}
	return ownershipMap;
}

/**
 * Like buildOwnershipMap but accumulates ALL owners per key instead of last-write-wins.
 * Use this to detect database-level duplicate ownership conflicts that bypass the
 * transaction guardrails (e.g. via seeding scripts).
 */
export function buildMultiOwnerSavedMap(
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
): Record<string, FacultyOwnershipState[]> {
	const multiMap: Record<string, FacultyOwnershipState[]> = {};
	for (const [facultyIdRaw, assignments] of Object.entries(savedAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		for (const assignment of assignments) {
			for (const sectionId of assignment.sectionIds) {
				const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
				const existing = multiMap[key];
				if (existing) {
					existing.push({ facultyId, facultyName, source: 'saved' });
				} else {
					multiMap[key] = [{ facultyId, facultyName, source: 'saved' }];
				}
			}
		}
	}
	return multiMap;
}

/**
 * Returns the set of ownership keys (subjectId:sectionId) that are owned by more
 * than one faculty in saved data — these are hard database-level conflicts.
 */
export function detectSavedConflictKeys(
	multiOwnerMap: Record<string, FacultyOwnershipState[]>,
): Set<string> {
	const conflicted = new Set<string>();
	for (const [key, owners] of Object.entries(multiOwnerMap)) {
		if (owners.length > 1) {
			conflicted.add(key);
		}
	}
	return conflicted;
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
	let rawMinutes = 0;
	const creditedLanes = new Map<string, number>();
	const familyAccumulators = new Map<
		string,
		{ rawMinutes: number; laneMinutes: Map<number, number>; subjectCodes: Set<string> }
	>();

	for (const assignment of assignments) {
		const subject = subjectMap.get(assignment.subjectId);
		if (!subject) continue;
		const rotationFamily = resolveRotationFamily(subject);
		for (const sectionId of assignment.sectionIds) {
			const section = sectionMap.get(sectionId);
			if (!section) continue;
			const laneKey = rotationFamily ? `family:${rotationFamily}:${sectionId}` : `subject:${subject.id}:${sectionId}`;
			const currentLaneMinutes = creditedLanes.get(laneKey) ?? 0;
			if (subject.minMinutesPerWeek > currentLaneMinutes) {
				creditedLanes.set(laneKey, subject.minMinutesPerWeek);
			}
			const isRotationDuplicate = rotationFamily ? subject.minMinutesPerWeek <= currentLaneMinutes : false;
			breakdown.push({
				subjectId: subject.id,
				subjectName: subject.name,
				subjectCode: subject.code,
				rotationFamily,
				isRotationDuplicate,
				sectionId,
				sectionName: section.name,
				gradeLevel: section.displayOrder,
				minutesPerWeek: subject.minMinutesPerWeek,
				totalMinutes: subject.minMinutesPerWeek,
			});
			rawMinutes += subject.minMinutesPerWeek;

			if (rotationFamily) {
				const accumulator = familyAccumulators.get(rotationFamily) ?? {
					rawMinutes: 0,
					laneMinutes: new Map<number, number>(),
					subjectCodes: new Set<string>(),
				};
				accumulator.rawMinutes += subject.minMinutesPerWeek;
				const familyLaneMinutes = accumulator.laneMinutes.get(sectionId) ?? 0;
				if (subject.minMinutesPerWeek > familyLaneMinutes) {
					accumulator.laneMinutes.set(sectionId, subject.minMinutesPerWeek);
				}
				accumulator.subjectCodes.add(subject.code);
				familyAccumulators.set(rotationFamily, accumulator);
			}
		}
	}

	const creditedMinutes = Array.from(creditedLanes.values()).reduce((sum, value) => sum + value, 0);
	const actualTeachingHours = Math.round((creditedMinutes / 60) * 10) / 10;
	const rawTeachingHours = Math.round((rawMinutes / 60) * 10) / 10;
	const rotationOvercountHours = Math.round(Math.max(0, rawTeachingHours - actualTeachingHours) * 10) / 10;
	const normalizedEquivalentHours = Math.round(equivalentHours * 10) / 10;
	const creditedTotalHours = Math.round((actualTeachingHours + normalizedEquivalentHours) * 10) / 10;
	const overloadHours = Math.round(Math.max(actualTeachingHours - STANDARD_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
	const overCapHours = Math.round(Math.max(actualTeachingHours - MAX_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
	const { status, label } = deriveLoadStatus(actualTeachingHours);
	const rotationFamilies: RotationFamilyBreakdownItem[] = Array.from(familyAccumulators.entries())
		.map(([family, stats]) => {
			const creditedFamilyMinutes = Array.from(stats.laneMinutes.values()).reduce((sum, value) => sum + value, 0);
			return {
				family,
				rawHours: Math.round((stats.rawMinutes / 60) * 10) / 10,
				creditedHours: Math.round((creditedFamilyMinutes / 60) * 10) / 10,
				overcountHours: Math.round(((stats.rawMinutes - creditedFamilyMinutes) / 60) * 10) / 10,
				unitCount: stats.laneMinutes.size,
				subjectCodes: Array.from(stats.subjectCodes).sort((left, right) => left.localeCompare(right)),
			};
		})
		.sort((left, right) => right.overcountHours - left.overcountHours || left.family.localeCompare(right.family));

	return {
		actualTeachingHours,
		rawTeachingHours,
		rotationOvercountHours,
		equivalentHours: normalizedEquivalentHours,
		creditedTotalHours,
		overloadHours,
		overCapHours,
		status,
		statusLabel: label,
		rotationFamilies,
		breakdown: breakdown.sort(
			(left, right) =>
				left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode),
		),
	};
}