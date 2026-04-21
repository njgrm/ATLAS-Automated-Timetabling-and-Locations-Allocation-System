import type { ExternalSection, SectionsByGrade } from './section-adapter.js';

export interface ScopedSection extends ExternalSection {
	displayOrder: number;
}

export interface SectionRosterIndex {
	sectionMap: Map<number, ScopedSection>;
	sectionsByGrade: Map<number, ScopedSection[]>;
}

export interface AssignmentScopeInput {
	subjectId: number;
	gradeLevels?: number[] | null;
	sectionIds?: number[] | null;
}

export interface NormalizedAssignmentScope {
	subjectId: number;
	gradeLevels: number[];
	sectionIds: number[];
	sections: ScopedSection[];
	scopeSource: 'sectionIds' | 'legacyGradeLevels';
}

export interface ScopeNormalizationError {
	code: 'INVALID_SECTION_IDS' | 'INVALID_GRADE_LEVELS' | 'EMPTY_SCOPE';
	message: string;
	invalidSectionIds?: number[];
	invalidGradeLevels?: number[];
}

export interface ScopeNormalizationResult {
	ok: true;
	value: NormalizedAssignmentScope;
}

export interface ScopeNormalizationFailure {
	ok: false;
	error: ScopeNormalizationError;
}

export interface FacultySectionOwnership {
	facultyId: number;
	facultyName: string;
	subjectId: number;
	sectionIds: number[];
}

export interface OwnershipConflict {
	subjectId: number;
	sectionId: number;
	ownerFacultyId: number;
	ownerFacultyName: string;
}

function uniqueSortedPositiveInts(values: readonly number[] | null | undefined): number[] {
	return Array.from(
		new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0)),
	).sort((left, right) => left - right);
}

function sortSections(left: ScopedSection, right: ScopedSection): number {
	return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id;
}

function buildNormalizedScope(
	subjectId: number,
	sections: ScopedSection[],
	scopeSource: NormalizedAssignmentScope['scopeSource'],
): NormalizedAssignmentScope {
	const sortedSections = [...sections].sort(sortSections);
	return {
		subjectId,
		gradeLevels: Array.from(new Set(sortedSections.map((section) => section.displayOrder))).sort((left, right) => left - right),
		sectionIds: sortedSections.map((section) => section.id),
		sections: sortedSections,
		scopeSource,
	};
}

function normalizeFromSectionIds(
	subjectId: number,
	sectionIds: readonly number[] | null | undefined,
	rosterIndex: SectionRosterIndex,
): ScopeNormalizationResult | ScopeNormalizationFailure {
	const requestedSectionIds = uniqueSortedPositiveInts(sectionIds);
	if (requestedSectionIds.length === 0) {
		return {
			ok: false,
			error: {
				code: 'EMPTY_SCOPE',
				message: 'At least one section must be selected for each subject assignment.',
			},
		};
	}

	const invalidSectionIds = requestedSectionIds.filter((sectionId) => !rosterIndex.sectionMap.has(sectionId));
	if (invalidSectionIds.length > 0) {
		return {
			ok: false,
			error: {
				code: 'INVALID_SECTION_IDS',
				message: 'One or more selected sections are not part of the active school year roster.',
				invalidSectionIds,
			},
		};
	}

	return {
		ok: true,
		value: buildNormalizedScope(
			subjectId,
			requestedSectionIds
				.map((sectionId) => rosterIndex.sectionMap.get(sectionId))
				.filter((section): section is ScopedSection => section != null),
			'sectionIds',
		),
	};
}

function normalizeFromGradeLevels(
	subjectId: number,
	gradeLevels: readonly number[] | null | undefined,
	rosterIndex: SectionRosterIndex,
): ScopeNormalizationResult | ScopeNormalizationFailure {
	const requestedGrades = uniqueSortedPositiveInts(gradeLevels);
	if (requestedGrades.length === 0) {
		return {
			ok: false,
			error: {
				code: 'EMPTY_SCOPE',
				message: 'At least one section or legacy grade scope must be provided for each subject assignment.',
			},
		};
	}

	const missingGrades = requestedGrades.filter((gradeLevel) => (rosterIndex.sectionsByGrade.get(gradeLevel)?.length ?? 0) === 0);
	if (missingGrades.length > 0) {
		return {
			ok: false,
			error: {
				code: 'INVALID_GRADE_LEVELS',
				message: 'Legacy grade-level assignments could not be expanded because one or more grades have no active sections in the selected school year.',
				invalidGradeLevels: missingGrades,
			},
		};
	}

	const expandedSections = requestedGrades.flatMap((gradeLevel) => rosterIndex.sectionsByGrade.get(gradeLevel) ?? []);
	return {
		ok: true,
		value: buildNormalizedScope(subjectId, expandedSections, 'legacyGradeLevels'),
	};
}

export function buildSectionRosterIndex(gradeLevels: SectionsByGrade[]): SectionRosterIndex {
	const sectionMap = new Map<number, ScopedSection>();
	const sectionsByGrade = new Map<number, ScopedSection[]>();

	for (const gradeLevel of gradeLevels) {
		const scopedSections = gradeLevel.sections
			.map((section) => ({ ...section, displayOrder: gradeLevel.displayOrder }))
			.sort(sortSections);
		sectionsByGrade.set(gradeLevel.displayOrder, scopedSections);
		for (const section of scopedSections) {
			sectionMap.set(section.id, section);
		}
	}

	return { sectionMap, sectionsByGrade };
}

export function normalizeIncomingAssignmentScope(
	assignment: AssignmentScopeInput,
	rosterIndex: SectionRosterIndex,
): ScopeNormalizationResult | ScopeNormalizationFailure {
	if (Array.isArray(assignment.sectionIds)) {
		return normalizeFromSectionIds(assignment.subjectId, assignment.sectionIds, rosterIndex);
	}

	if (Array.isArray(assignment.gradeLevels)) {
		return normalizeFromGradeLevels(assignment.subjectId, assignment.gradeLevels, rosterIndex);
	}

	return {
		ok: false,
		error: {
			code: 'EMPTY_SCOPE',
			message: 'Each subject assignment requires sectionIds or legacy gradeLevels.',
		},
	};
}

export function normalizeStoredAssignmentScope(
	assignment: AssignmentScopeInput,
	rosterIndex: SectionRosterIndex,
): NormalizedAssignmentScope {
	const requestedSectionIds = uniqueSortedPositiveInts(assignment.sectionIds);
	const validStoredSections = requestedSectionIds
		.map((sectionId) => rosterIndex.sectionMap.get(sectionId))
		.filter((section): section is ScopedSection => section != null);

	if (validStoredSections.length > 0) {
		return buildNormalizedScope(assignment.subjectId, validStoredSections, 'sectionIds');
	}

	const legacyResult = normalizeFromGradeLevels(assignment.subjectId, assignment.gradeLevels, rosterIndex);
	if (legacyResult.ok) {
		return legacyResult.value;
	}

	return {
		subjectId: assignment.subjectId,
		gradeLevels: [],
		sectionIds: [],
		sections: [],
		scopeSource: 'sectionIds',
	};
}

export function getAssignmentOwnershipKey(subjectId: number, sectionId: number): string {
	return `${subjectId}:${sectionId}`;
}

export function detectSectionOwnershipConflicts(
	proposedFacultyId: number,
	proposedAssignments: Pick<NormalizedAssignmentScope, 'subjectId' | 'sectionIds'>[],
	existingAssignments: FacultySectionOwnership[],
): OwnershipConflict[] {
	const proposedKeys = new Set<string>();
	for (const assignment of proposedAssignments) {
		for (const sectionId of assignment.sectionIds) {
			proposedKeys.add(getAssignmentOwnershipKey(assignment.subjectId, sectionId));
		}
	}

	const conflicts: OwnershipConflict[] = [];
	const seenConflicts = new Set<string>();
	for (const ownership of existingAssignments) {
		if (ownership.facultyId === proposedFacultyId) continue;
		for (const sectionId of ownership.sectionIds) {
			const key = getAssignmentOwnershipKey(ownership.subjectId, sectionId);
			if (!proposedKeys.has(key) || seenConflicts.has(key)) continue;
			seenConflicts.add(key);
			conflicts.push({
				subjectId: ownership.subjectId,
				sectionId,
				ownerFacultyId: ownership.facultyId,
				ownerFacultyName: ownership.facultyName,
			});
		}
	}

	return conflicts;
}