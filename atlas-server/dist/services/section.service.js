/**
 * Section service — bridge to section adapter.
 * Returns a summary of sections by grade level sourced from the enrollment service.
 */
import { sectionAdapter } from './section-adapter.js';
export async function getSectionSummary(schoolYearId, schoolId, authToken) {
    const gradeLevels = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
    const byGradeLevel = {};
    const enrolledByGradeLevel = {};
    const allSections = [];
    let totalEnrolled = 0;
    for (const gl of gradeLevels) {
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
    };
}
//# sourceMappingURL=section.service.js.map