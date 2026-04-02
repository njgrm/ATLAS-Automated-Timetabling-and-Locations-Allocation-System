/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 */
import { sectionAdapter } from './section-adapter.js';
export async function getSectionSummary(schoolYearId, authToken) {
    const gradeLevels = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, authToken);
    const byGradeLevel = {};
    const allSections = [];
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
//# sourceMappingURL=section.service.js.map