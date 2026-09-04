import type { CoverageMode, ExternalSection, SectionAssignedClassesIndexResult } from '@/types';

export const COVERAGE_MODE_CONFIG: Record<CoverageMode, { label: string; description: string }> = {
	REAL_FACULTY_STANDARD: {
		label: 'Real teachers first, up to 30h/week',
		description: 'Fills qualified real teachers up to the 30h standard. Some sections may stay unassigned.',
	},
	REAL_FACULTY_HARD_CAP: {
		label: 'Maximum allowed hours (40h)',
		description: 'Fills real teachers up to the 40h DepEd Magna Carta maximum before leaving any section unassigned.',
	},
	REAL_FACULTY_THEN_TEACHER_X: {
		label: 'Real teachers first, then substitutes',
		description: 'Prioritizes real teachers, then uses temporary substitutes for the remaining sections.',
	},
};

export function formatTeachingLoadSaveError(error: any) {
	const code = error?.response?.data?.code;
	const message = error?.response?.data?.message;
	if (code === 'VERSION_CONFLICT') {
		return `${message ?? 'The Teaching Load changed in another session.'} ATLAS reloaded the latest saved data. Review your draft before saving again.`;
	}
	if (typeof message === 'string' && message.trim()) {
		if (/over.*cap|cap/i.test(message)) {
			return 'This teacher is already above the weekly maximum. Choose another teacher or move one class first.';
		}
		if (/owner|ownership|already assigned/i.test(message)) {
			return 'This section already has an owner for this subject. Review the current owner before saving.';
		}
		return message;
	}
	return 'ATLAS could not save Teaching Load. Check the highlighted repair reason, then try again.';
}

export function buildSectionsBySubject(
	sectionAssignedClassesIndex: SectionAssignedClassesIndexResult | null,
	sectionMap: Map<number, ExternalSection>,
	gradeLevelFilter: string,
): Record<number, ExternalSection[]> {
	const grouped: Record<number, ExternalSection[]> = {};
	for (const sectionResult of sectionAssignedClassesIndex?.sections ?? []) {
		const section = sectionMap.get(sectionResult.sectionId);
		if (!section) continue;
		const gradeMatch = gradeLevelFilter === 'all' || section.displayOrder === Number(gradeLevelFilter);
		if (!gradeMatch) continue;

		const contractRows = [
			...sectionResult.classes.map((entry) => ({
				subjectId: entry.subjectId,
				specializationCode: entry.specializationCode,
				specializationLabel: entry.specializationLabel,
				rotationFamily: entry.rotationFamily,
				rotationTermRank: entry.rotationTermRank,
				rotationTermLabel: entry.rotationTermLabel,
				rotationTermGroupId: entry.rotationTermGroupId,
				rotationTermCount: entry.rotationTermCount,
				minMinutesPerWeek: entry.minMinutesPerWeek,
			})),
			...((sectionResult.unassignedExpectedClasses ?? []).map((entry) => ({
				subjectId: entry.subjectId,
				specializationCode: null,
				specializationLabel: null,
				rotationFamily: entry.rotationFamily,
				rotationTermRank: entry.rotationTermRank,
				rotationTermLabel: entry.rotationTermLabel,
				rotationTermGroupId: entry.rotationTermGroupId,
				rotationTermCount: entry.rotationTermCount,
				minMinutesPerWeek: entry.minMinutesPerWeek,
			}))),
		];

		for (const contractRow of contractRows) {
			if (!grouped[contractRow.subjectId]) grouped[contractRow.subjectId] = [];
			grouped[contractRow.subjectId].push({
				...section,
				assignmentSpecializationCode: contractRow.specializationCode,
				assignmentSpecializationLabel: contractRow.specializationLabel,
				assignmentRotationFamily: contractRow.rotationFamily,
				assignmentRotationTermRank: contractRow.rotationTermRank,
				assignmentRotationTermLabel: contractRow.rotationTermLabel,
				assignmentRotationTermGroupId: contractRow.rotationTermGroupId,
				assignmentRotationTermCount: contractRow.rotationTermCount,
				assignmentRawMinutesPerWeek: contractRow.minMinutesPerWeek,
			});
		}
	}
	return grouped;
}

export function resolveCoverageState(params: {
	loading: boolean;
	activeSchoolYearId: number | null;
	coverageTotals: unknown;
	totalPairs: number;
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
}): { label: string; description: string } {
	if (params.loading && !params.coverageTotals) {
		return {
			label: 'Checking assignment needs',
			description: 'Coverage totals are loading. Zeroes shown now are placeholders, not final staffing counts.',
		};
	}
	if (!params.activeSchoolYearId) {
		return {
			label: 'No active school year',
			description: 'ATLAS needs an active school year before it can count teacher-section assignment needs.',
		};
	}
	if (!params.coverageTotals || params.totalPairs === 0) {
		return {
			label: 'No assignment universe',
			description: 'Coverage is 0 / 0 because ATLAS has no schedulable subject-section pairs for the current source state.',
		};
	}
	if (params.syntheticPlaceholderPairs > 0) {
		return {
			label: 'Mixed coverage',
			description: `${params.realAssignedPairs} pairs are staffed by real teachers and ${params.syntheticPlaceholderPairs} use temporary substitutes.`,
		};
	}
	return {
		label: 'Real-teacher coverage',
		description: 'Coverage counts are based on real teacher assignments for the current school year.',
	};
}
