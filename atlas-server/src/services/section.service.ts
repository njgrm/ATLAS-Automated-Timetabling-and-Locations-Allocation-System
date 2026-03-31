/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 */

import { sectionAdapter, type SectionSummary } from './section-adapter.js';

export async function getSectionSummary(schoolYearId: number, authToken?: string): Promise<SectionSummary> {
	const gradeLevels = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, authToken);

	const byGradeLevel: Record<number, number> = {};
	const allSections: SectionSummary['sections'] = [];

	for (const gl of gradeLevels) {
		byGradeLevel[gl.displayOrder] = gl.sections.length;
		allSections.push(...gl.sections);
	}

	return {
		totalSections: allSections.length,
		byGradeLevel,
		sections: allSections,
	};
}
