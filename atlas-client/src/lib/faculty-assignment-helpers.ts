import type { 
	ExternalSection, 
	Subject, 
	FacultySummary,
	LoadStatus,
	FacultyAssignmentDraft,
	FacultyOwnershipState,
	SubjectSectionOwnershipIndexEntry,
	LoadBreakdownItem,
	RotationFamilyBreakdownItem,
	LoadProfile,
} from '../types';
import { isDepartmentMatch } from './grade-labels';

export type { FacultyAssignmentDraft, FacultyOwnershipState, LoadStatus, SubjectSectionOwnershipIndexEntry };

export const STANDARD_WEEKLY_TEACHING_HOURS = 30;
export const MAX_WEEKLY_TEACHING_HOURS = 40;
export const CLASS_ADVISER_EQUIVALENT_HOURS = 5;

export function normalizeDepartmentCode(value: string | null | undefined): string {
	const normalized = (value ?? '').trim().toUpperCase();
	if (!normalized) return '';
	const table: Record<string, string> = {
		SCIENCE: 'SCI',
		SCI: 'SCI',
		MATHEMATICS: 'MATH',
		MATH: 'MATH',
		ENGLISH: 'ENG',
		ENG: 'ENG',
		FILIPINO: 'FIL',
		FIL: 'FIL',
		MAPEH: 'MAPEH',
		ESP: 'ESP',
		VALUES: 'ESP',
		'VALUES EDUCATION': 'ESP',
		AP: 'AP',
		'SOCIAL STUDIES': 'AP',
		'ARALING PANLIPUNAN': 'AP',
		TLE: 'TLE',
		LANGUAGES: 'ENG',
		SPA: 'SPA',
		SPS: 'SPS',
	};
	return table[normalized] ?? normalized;
}

export function matchesOwnershipDepartment(facultyDepartment: string | null | undefined, subject: Subject): boolean {
	const ownerDepartments = [
		...(subject.ownerDepartment ? [subject.ownerDepartment] : []),
		...(subject.allowedOwnerDepartments ?? []),
	]
		.map((value) => normalizeDepartmentCode(value))
		.filter((value): value is string => Boolean(value));

	if (ownerDepartments.length > 0) {
		const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
		if (!normalizedFaculty) return false;
		if (ownerDepartments.includes(normalizedFaculty)) return true;
		if ((ownerDepartments.includes('ENG') || ownerDepartments.includes('FIL')) && normalizedFaculty === 'ENG') return true;
		return false;
	}

	return isDepartmentMatch(facultyDepartment ?? null, subject.code, subject.name);
}

export function getFacultyComparableLoadHours(member: FacultySummary): number {
	if (member.isPlaceholder) {
		return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
	}
	return member.policyCreditedHours ?? member.subjectHours ?? 0;
}

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

type RotationTermMetadata = {
	termRank: number | null;
	termLabel: string | null;
	termGroupId: string | null;
	termCount: number | null;
};

function toCanonicalRotationTermLabel(termLabel: string | null | undefined, termRank: number | null): string | null {
	if (typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0) {
		return `Term ${termRank}`;
	}

	const trimmed = (termLabel ?? '').trim();
	if (!trimmed) {
		return null;
	}

	const rankMatch = trimmed.match(/(\d+)/);
	if (rankMatch) {
		const parsed = Number(rankMatch[1]);
		if (Number.isInteger(parsed) && parsed > 0) {
			return `Term ${parsed}`;
		}
	}

	return trimmed;
}

function resolveRotationTermMetadata(subject: Subject): RotationTermMetadata {
	const explicitTermRank =
		typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0
			? subject.rotationTermRank
			: null;
	const derivedTermRank =
		typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0
			? subject.modularOrder
			: null;
	const termRank = explicitTermRank ?? derivedTermRank;

	const explicitTermCount =
		typeof subject.rotationTermCount === 'number' && Number.isInteger(subject.rotationTermCount) && subject.rotationTermCount > 0
			? subject.rotationTermCount
			: null;
	const derivedTermCount =
		typeof subject.termCount === 'number' && Number.isInteger(subject.termCount) && subject.termCount > 0
			? subject.termCount
			: null;
	const termCount = explicitTermCount ?? derivedTermCount;

	const explicitTermLabel = (subject.rotationTermLabel ?? '').trim();
	const termLabel = toCanonicalRotationTermLabel(explicitTermLabel, termRank);

	const explicitTermGroupId = (subject.rotationTermGroupId ?? '').trim();
	const derivedTermGroupId = (subject.termGroupId ?? '').trim();
	const termGroupId = explicitTermGroupId || derivedTermGroupId || null;

	return {
		termRank,
		termLabel,
		termGroupId,
		termCount,
	};
}

function normalizeRotationTermLaneKey(termRank: number | null): number {
	return typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0 ? termRank : 0;
}

function uniqueSortedPositiveInts(values: readonly number[] | null | undefined): number[] {
	return Array.from(new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0))).sort(
		(left, right) => left - right,
	);
}

export function deriveLoadStatus(policyCreditedHours: number, maxHoursPerWeek = MAX_WEEKLY_TEACHING_HOURS): { status: LoadStatus; label: string } {
	if (policyCreditedHours > maxHoursPerWeek) {
		// Phase 3 / Decision 3: plain DepEd language -- no engineering
		// vocabulary and no fake approval process.
		return { status: 'over-cap', label: 'Over maximum - move classes before generating' };
	}
	if (policyCreditedHours > STANDARD_WEEKLY_TEACHING_HOURS) {
		return {
			status: 'overload-allowed',
			label: 'Above standard - review before generating',
		};
	}
	if (policyCreditedHours === STANDARD_WEEKLY_TEACHING_HOURS) {
		return { status: 'compliant', label: 'At standard' };
	}
	return { status: 'below-standard', label: 'Below standard' };
}

export function getFacultyLoadSortRank(
	faculty: Pick<FacultySummary, 'isActiveForScheduling' | 'policyCreditedHours' | 'subjectCount' | 'maxHoursPerWeek'>,
): number {
	const weeklyHours = faculty.policyCreditedHours ?? 0;
	const subjectCount = faculty.subjectCount ?? 0;
	const maxHours = faculty.maxHoursPerWeek ?? MAX_WEEKLY_TEACHING_HOURS;
	const loadStatus = deriveLoadStatus(weeklyHours, maxHours);

	// Ascending order puts the scheduler's most urgent repair states first.
	if (!faculty.isActiveForScheduling) return 5;
	if (weeklyHours === 0 || subjectCount === 0) return 4;
	if (loadStatus.status === 'over-cap') return 0;
	if (loadStatus.status === 'overload-allowed') return 1;
	if (loadStatus.status === 'compliant') return 2;
	return 3;
}

export type WorkloadCapacitySummary = {
	teachingHours: number;
	creditHours: number;
	creditedTotalHours: number;
	toStandardHours: number;
	toCapHours: number;
	overStandardHours: number;
	overCapHours: number;
	status: LoadStatus;
	statusLabel: string;
};

function roundHours(value: number): number {
	return Math.round(value * 10) / 10;
}

export function deriveWorkloadCapacity(
	teachingHours: number,
	creditHours: number,
	maxHours = MAX_WEEKLY_TEACHING_HOURS,
): WorkloadCapacitySummary {
	const normalizedTeachingHours = roundHours(Math.max(teachingHours, 0));
	const normalizedCreditHours = roundHours(Math.max(creditHours, 0));
	const creditedTotalHours = roundHours(normalizedTeachingHours + normalizedCreditHours);
	const { status, label } = deriveLoadStatus(creditedTotalHours, maxHours);

	return {
		teachingHours: normalizedTeachingHours,
		creditHours: normalizedCreditHours,
		creditedTotalHours,
		toStandardHours: roundHours(Math.max(STANDARD_WEEKLY_TEACHING_HOURS - creditedTotalHours, 0)),
		toCapHours: roundHours(Math.max(maxHours - creditedTotalHours, 0)),
		overStandardHours: roundHours(Math.max(creditedTotalHours - STANDARD_WEEKLY_TEACHING_HOURS, 0)),
		overCapHours: roundHours(Math.max(creditedTotalHours - maxHours, 0)),
		status,
		statusLabel: label,
	};
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
 * than one faculty in saved data - these are hard database-level conflicts.
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

/**
 * Builds a map of subject-section ownership that reflects the actual state of the world
 * including all active drafts. If a faculty member has a draft, their draft COMPLETELY
 * overrides their saved assignments for the purpose of this map.
 */
export function buildEffectiveOwnershipMap(
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>,
	facultyNames: Record<number, string>,
	pendingOwnershipMap: Record<string, FacultyOwnershipState>,
): Record<string, FacultyOwnershipState & { isPending: boolean }> {
	const map: Record<string, FacultyOwnershipState & { isPending: boolean }> = {};
	
	for (const [facultyIdRaw, assignments] of Object.entries(effectiveAssignmentsByFaculty)) {
		const facultyId = Number(facultyIdRaw);
		const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
		
		for (const a of assignments) {
			for (const sectionId of a.sectionIds) {
				const key = getAssignmentOwnershipKey(a.subjectId, sectionId);
				const isPending = pendingOwnershipMap[key]?.facultyId === facultyId;
				
				map[key] = {
					facultyId,
					facultyName,
					source: isPending ? 'pending' : 'saved',
					isPending
				};
			}
		}
	}
	return map;
}

export function computeSectionAssignmentDeltaMinutes(
	subject: Subject,
	sectionId: number,
	currentAssignments: FacultyAssignmentDraft[],
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
	equivalentHours: number,
): number {
	const currentProfile = buildTeachingLoadProfile(currentAssignments, subjects, sectionMap, equivalentHours);
	const currentMinutes = currentProfile.actualTeachingHours * 60;

	const nextAssignments = currentAssignments.map((a) =>
		a.subjectId === subject.id
			? { ...a, sectionIds: Array.from(new Set([...a.sectionIds, sectionId])) }
			: a,
	);
	if (!currentAssignments.some((a) => a.subjectId === subject.id)) {
		nextAssignments.push({ subjectId: subject.id, sectionIds: [sectionId], gradeLevels: [] });
	}

	const nextProfile = buildTeachingLoadProfile(nextAssignments, subjects, sectionMap, equivalentHours);
	const nextMinutes = nextProfile.actualTeachingHours * 60;

	return Math.max(0, nextMinutes - currentMinutes);
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
	const nonRotationLanes = new Map<string, number>();
	const familyAccumulators = new Map<
		string,
		{
			rawMinutes: number;
			subjectCodes: Set<string>;
			termBuckets: Map<
				number,
				{
					termRank: number | null;
					termLabel: string | null;
					termGroupId: string | null;
					termCount: number | null;
					laneMinutes: Map<number, number>;
				}
			>;
		}
	>();

	const computeTermBucketMinutes = (bucket: { laneMinutes: Map<number, number> }): number =>
		Array.from(bucket.laneMinutes.values()).reduce((sum, value) => sum + value, 0);

	const computeFamilyPeakMinutes = (
		termBuckets: Map<
			number,
			{
				termRank: number | null;
				termLabel: string | null;
				termGroupId: string | null;
				termCount: number | null;
				laneMinutes: Map<number, number>;
			}
		>,
	): number => {
		let peak = 0;
		for (const bucket of termBuckets.values()) {
			const bucketMinutes = computeTermBucketMinutes(bucket);
			if (bucketMinutes > peak) {
				peak = bucketMinutes;
			}
		}
		return peak;
	};

	for (const assignment of assignments) {
		const subject = subjectMap.get(assignment.subjectId);
		if (!subject) continue;
		const rotationFamily = resolveRotationFamily(subject);
		const rotationTermMetadata = resolveRotationTermMetadata(subject);
		for (const sectionId of assignment.sectionIds) {
			const section = sectionMap.get(sectionId);
			if (!section) continue;
			let isRotationDuplicate = false;

			if (rotationFamily) {
				const accumulator = familyAccumulators.get(rotationFamily) ?? {
					rawMinutes: 0,
					subjectCodes: new Set<string>(),
					termBuckets: new Map(),
				};

				const termKey = normalizeRotationTermLaneKey(rotationTermMetadata.termRank);
				const termBucket = accumulator.termBuckets.get(termKey) ?? {
					termRank: rotationTermMetadata.termRank,
					termLabel: rotationTermMetadata.termLabel,
					termGroupId: rotationTermMetadata.termGroupId,
					termCount: rotationTermMetadata.termCount,
					laneMinutes: new Map<number, number>(),
				};

				if (!termBucket.termLabel && rotationTermMetadata.termLabel) {
					termBucket.termLabel = rotationTermMetadata.termLabel;
				}
				if (!termBucket.termGroupId && rotationTermMetadata.termGroupId) {
					termBucket.termGroupId = rotationTermMetadata.termGroupId;
				}
				if (!termBucket.termCount && rotationTermMetadata.termCount) {
					termBucket.termCount = rotationTermMetadata.termCount;
				}
				if (!termBucket.termRank && rotationTermMetadata.termRank) {
					termBucket.termRank = rotationTermMetadata.termRank;
				}

				const familyPeakBefore = computeFamilyPeakMinutes(accumulator.termBuckets);
				const termBucketBeforeMinutes = computeTermBucketMinutes(termBucket);
				const currentTermLaneMinutes = termBucket.laneMinutes.get(sectionId) ?? 0;
				const laneIncrease = Math.max(0, subject.minMinutesPerWeek - currentTermLaneMinutes);
				const termBucketAfterMinutes = termBucketBeforeMinutes + laneIncrease;
				const familyPeakAfter = Math.max(familyPeakBefore, termBucketAfterMinutes);
				isRotationDuplicate = laneIncrease <= 0 || familyPeakAfter <= familyPeakBefore;

				if (laneIncrease > 0) {
					termBucket.laneMinutes.set(sectionId, subject.minMinutesPerWeek);
				}

				termBucket.termLabel = toCanonicalRotationTermLabel(termBucket.termLabel, termBucket.termRank);
				accumulator.rawMinutes += subject.minMinutesPerWeek;
				accumulator.subjectCodes.add(subject.code);
				accumulator.termBuckets.set(termKey, termBucket);
				familyAccumulators.set(rotationFamily, accumulator);
			} else {
				const laneKey = `subject:${subject.id}:${sectionId}`;
				const currentLaneMinutes = nonRotationLanes.get(laneKey) ?? 0;
				if (subject.minMinutesPerWeek > currentLaneMinutes) {
					nonRotationLanes.set(laneKey, subject.minMinutesPerWeek);
				}
			}

			breakdown.push({
				subjectId: subject.id,
				subjectName: subject.name,
				subjectCode: subject.code,
				rotationFamily,
				rotationTermRank: rotationTermMetadata.termRank,
				rotationTermLabel: rotationTermMetadata.termLabel,
				rotationTermGroupId: rotationTermMetadata.termGroupId,
				rotationTermCount: rotationTermMetadata.termCount,
				isRotationDuplicate,
				sectionId,
				sectionName: section.name,
				gradeLevel: section.displayOrder,
				minutesPerWeek: subject.minMinutesPerWeek,
				totalMinutes: subject.minMinutesPerWeek,
			});
			rawMinutes += subject.minMinutesPerWeek;
		}
	}

	const nonRotationCreditedMinutes = Array.from(nonRotationLanes.values()).reduce((sum, value) => sum + value, 0);
	const rotationFamilyComputations = Array.from(familyAccumulators.entries()).map(([family, stats]) => {
		const termBuckets = Array.from(stats.termBuckets.values()).map((bucket) => ({
			termRank: bucket.termRank,
			termLabel: bucket.termLabel,
			termGroupId: bucket.termGroupId,
			termCount: bucket.termCount,
			creditedMinutes: computeTermBucketMinutes(bucket),
			unitCount: bucket.laneMinutes.size,
		}));
		const peakMinutes = [...termBuckets].reduce((max, b) => Math.max(max, b.creditedMinutes), 0);
		const peakBuckets = termBuckets.filter(b => b.creditedMinutes === peakMinutes && b.creditedMinutes > 0);
		const peakLabels = peakBuckets
			.map(b => toCanonicalRotationTermLabel(b.termLabel, b.termRank))
			.filter(Boolean) as string[];

		const creditedFamilyMinutes = peakMinutes;

		return {
			creditedFamilyMinutes,
			detail: {
				family,
				rawHours: Math.round((stats.rawMinutes / 60) * 10) / 10,
				creditedHours: Math.round((creditedFamilyMinutes / 60) * 10) / 10,
				overcountHours: Math.round(((stats.rawMinutes - creditedFamilyMinutes) / 60) * 10) / 10,
				unitCount: termBuckets.reduce((sum, bucket) => sum + bucket.unitCount, 0),
				dominantTermRank: peakBuckets[0]?.termRank ?? null,
				dominantTermLabel: peakLabels.length > 1 ? `Tied: ${peakLabels.join(', ')}` : (peakLabels[0] ?? null),
				termGroupId: peakBuckets[0]?.termGroupId ?? null,
				termCount: peakBuckets[0]?.termCount ?? null,
				termBuckets: termBuckets.map(b => ({
					...b,
					subjectCodes: Array.from(stats.subjectCodes).sort((left, right) => left.localeCompare(right))
				})),
				subjectCodes: Array.from(stats.subjectCodes).sort((left, right) => left.localeCompare(right)),
			} satisfies RotationFamilyBreakdownItem,
		};
	});
	const creditedMinutes = nonRotationCreditedMinutes
		+ rotationFamilyComputations.reduce((sum, family) => sum + family.creditedFamilyMinutes, 0);
	const actualTeachingHours = Math.round((creditedMinutes / 60) * 10) / 10;
	const rawTeachingHours = Math.round((rawMinutes / 60) * 10) / 10;
	const rotationOvercountHours = Math.round(Math.max(0, rawTeachingHours - actualTeachingHours) * 10) / 10;
	const workloadCapacity = deriveWorkloadCapacity(actualTeachingHours, equivalentHours);
	const normalizedEquivalentHours = workloadCapacity.creditHours;
	const creditedTotalHours = workloadCapacity.creditedTotalHours;
	const rotationFamilies: RotationFamilyBreakdownItem[] = rotationFamilyComputations
		.map((entry) => entry.detail)
		.sort((left, right) => right.overcountHours - left.overcountHours || left.family.localeCompare(right.family));

	return {
		actualTeachingHours,
		rawTeachingHours,
		rotationOvercountHours,
		equivalentHours: normalizedEquivalentHours,
		creditedTotalHours,
		overloadHours: workloadCapacity.overStandardHours,
		overCapHours: workloadCapacity.overCapHours,
		remainingHours: workloadCapacity.toCapHours,
		status: workloadCapacity.status,
		statusLabel: workloadCapacity.statusLabel,
		rotationFamilies,
		breakdown: breakdown.sort(
			(left, right) =>
				left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode),
		),
	};
}