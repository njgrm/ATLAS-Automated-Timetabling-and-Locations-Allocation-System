import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Subject, SubjectCoverageRow } from '@/types';

type SubjectStatsInput = {
	subjects: Subject[];
	coverageBySubjectId: Map<number, SubjectCoverageRow> | null;
};

export function useSubjectStats({ subjects, coverageBySubjectId }: SubjectStatsInput) {
	return useMemo(() => {
		const activeCount = subjects.filter((s) => s.isActive).length;
		const archivedCount = subjects.length - activeCount;
		const roomConstrainedCount = subjects.filter(
			(s) => s.isActive && (s.preferredRoomType !== 'CLASSROOM' || s.requiredFeatures.length > 0),
		).length;
		const coverageRiskCount = coverageBySubjectId
			? subjects.filter((s) => s.isActive && (coverageBySubjectId.get(s.id)?.uncoveredSectionCount ?? 0) > 0).length
			: null;
		return [
			{
				label: 'Active subjects',
				value: activeCount,
				tone: activeCount > 0 ? 'success' as const : 'warning' as const,
				helpText: archivedCount > 0
					? `${activeCount} active · ${archivedCount} archived (kept for history, hidden from new setup).`
					: 'Subjects currently available for scheduling this school year.',
			},
			{
				label: 'Missing coverage',
				value: coverageRiskCount === null
					? <Loader2 className="size-3 animate-spin" data-testid="subjects-missing-coverage-spinner" />
					: coverageRiskCount,
				tone: coverageRiskCount === null ? 'info' as const : coverageRiskCount > 0 ? 'warning' as const : 'success' as const,
				helpText: coverageRiskCount === null
					? 'ATLAS is checking teaching-load coverage.'
					: 'Active schedulable subjects with one or more uncovered sections in the current teaching load.',
			},
			{
				label: 'Room constrained',
				value: roomConstrainedCount,
				tone: roomConstrainedCount > 0 ? 'warning' as const : 'success' as const,
				helpText: 'Active subjects that need a specialized room type or room feature.',
			},
		];
	}, [coverageBySubjectId, subjects]);
}

type CoverageDetailInput = {
	coverageSubject: Subject | null;
	teacherCoverage: Record<number, {
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: string[] }[];
	}>;
};

export function useCoverageDetail({ coverageSubject, teacherCoverage }: CoverageDetailInput) {
	return useMemo(() => {
		if (!coverageSubject) return null;
		const assigned = teacherCoverage[coverageSubject.id]?.assigned ?? [];
		const coveredGrades = new Set(assigned.flatMap((teacher) => teacher.grades));
		const uncoveredGrades = coverageSubject.gradeLevels.filter((grade) => !coveredGrades.has(grade));
		return {
			assigned,
			uncoveredGrades,
			programScopes: coverageSubject.programScopes ?? [],
		};
	}, [coverageSubject, teacherCoverage]);
}
