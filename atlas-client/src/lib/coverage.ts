import atlasApi from '@/lib/api';
import type { SubjectCoverageSummary } from '@/types';

const DEFAULT_SCHOOL_ID = 1;

export async function fetchSubjectCoverageSummary(schoolYearId: number): Promise<SubjectCoverageSummary> {
	const { data } = await atlasApi.get<SubjectCoverageSummary>('/faculty-assignments/coverage/summary', {
		params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId },
	});
	return data;
}

export function countSubjectsWithMissingCoverage(summary: SubjectCoverageSummary): number {
	return summary.rows.filter((row) => row.uncoveredSectionCount > 0).length;
}

export function getSubjectsWithMissingCoverage(summary: SubjectCoverageSummary) {
	return summary.rows.filter((row) => row.uncoveredSectionCount > 0);
}
