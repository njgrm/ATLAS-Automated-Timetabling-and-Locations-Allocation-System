/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 * Wave 3.5: includes fetchedAt, isStale, and special program metadata.
 */

import { sectionAdapter, type SectionSummary } from './section-adapter.js';

export async function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary> {
	const result = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);

	const byGradeLevel: Record<number, number> = {};
	const enrolledByGradeLevel: Record<number, number> = {};
	const allSections: SectionSummary['sections'] = [];
	let totalEnrolled = 0;

	for (const gl of result.gradeLevels) {
		byGradeLevel[gl.displayOrder] = gl.sections.length;
		const gradeEnrolled = gl.sections.reduce((sum, s) => sum + s.enrolledCount, 0);
		enrolledByGradeLevel[gl.displayOrder] = gradeEnrolled;
		totalEnrolled += gradeEnrolled;
		allSections.push(...gl.sections);
	}

	return {
		schoolId,
		schoolYearId,
		totalSections: allSections.length,
		totalEnrolled,
		byGradeLevel,
		enrolledByGradeLevel,
		sections: allSections,
		source: result.source,
		fetchedAt: result.fetchedAt,
		isStale: result.isStale ?? false,
		...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
	};
}
