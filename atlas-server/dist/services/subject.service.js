import { prisma } from '../lib/prisma.js';
import { inferSubjectProgramScopes } from './subject-program-scope.service.js';
const MATATAG_DEFAULTS = [
    { code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'ESP', name: 'Edukasyon sa Pagpapakatao (EsP)', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR', 'SPA'] },
    { code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['REGULAR'] },
    { code: 'ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 180, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'RESEARCH_I', name: 'Research I / Basic Statistics', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'BASIC_STATISTICS', name: 'Basic Statistics', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'RESEARCH_II', name: 'Research II / Advanced Statistics', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'ADVANCED_STATISTICS', name: 'Advanced Statistics', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'BIOTECHNOLOGY', name: 'Biotechnology', minMinutesPerWeek: 180, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'RESEARCH_III', name: 'Research III / Advanced Physics', minMinutesPerWeek: 180, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'ADVANCED_PHYSICS', name: 'Advanced Physics', minMinutesPerWeek: 180, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'ADVANCED_CHEMISTRY', name: 'Advanced Chemistry', minMinutesPerWeek: 180, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
    { code: 'ELECTRONICS', name: 'Electronics', minMinutesPerWeek: 180, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], programScopes: ['STE'] },
];
export async function ensureDefaultSubjects(schoolId) {
    await prisma.$transaction(MATATAG_DEFAULTS.map((subject) => prisma.subject.upsert({
        where: {
            schoolId_code: {
                schoolId,
                code: subject.code,
            },
        },
        update: {
            name: subject.name,
            minMinutesPerWeek: subject.minMinutesPerWeek,
            preferredRoomType: subject.preferredRoomType,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            isSeedable: true,
            isActive: true,
        },
        create: {
            schoolId,
            code: subject.code,
            name: subject.name,
            minMinutesPerWeek: subject.minMinutesPerWeek,
            preferredRoomType: subject.preferredRoomType,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            isSeedable: true,
            isActive: true,
        },
    })));
}
export async function getSubjectsBySchool(schoolId, filters) {
    const subjects = await prisma.subject.findMany({
        where: { schoolId },
        orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
    });
    const includeSte = filters?.includeSte ?? true;
    const includeSpa = filters?.includeSpa ?? true;
    // Use stored programScopes; fall back to heuristic inference for legacy rows with empty scopes
    return subjects
        .map((subject) => ({
        ...subject,
        programScopes: subject.programScopes.length > 0
            ? subject.programScopes
            : inferSubjectProgramScopes(subject.code, subject.name),
    }))
        .filter((subject) => {
        if (!includeSte && subject.programScopes.includes('STE'))
            return false;
        if (!includeSpa && subject.programScopes.includes('SPA'))
            return false;
        return true;
    });
}
export async function getSubjectById(id) {
    return prisma.subject.findUnique({ where: { id } });
}
export async function createSubject(schoolId, data) {
    // Validate inter-section grade levels are within subject's grade levels
    const interGrades = data.interSectionGradeLevels ?? [];
    if (interGrades.length > 0) {
        const invalid = interGrades.filter((g) => !data.gradeLevels.includes(g));
        if (invalid.length > 0) {
            throw Object.assign(new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`), { statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' });
        }
    }
    return prisma.subject.create({
        data: {
            schoolId,
            code: data.code,
            name: data.name,
            minMinutesPerWeek: data.minMinutesPerWeek,
            preferredRoomType: data.preferredRoomType,
            sessionPattern: data.sessionPattern ?? 'ANY',
            gradeLevels: data.gradeLevels,
            isActive: true,
            isSeedable: false,
            interSectionEnabled: data.interSectionEnabled ?? false,
            interSectionGradeLevels: interGrades,
            programScopes: data.programScopes ?? ['REGULAR'],
        },
    });
}
export async function updateSubject(id, data) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject)
        return null;
    // Validate inter-section grade levels if provided
    const newGradeLevels = data.gradeLevels ?? subject.gradeLevels;
    if (data.interSectionGradeLevels !== undefined && data.interSectionGradeLevels.length > 0) {
        const invalid = data.interSectionGradeLevels.filter((g) => !newGradeLevels.includes(g));
        if (invalid.length > 0) {
            throw Object.assign(new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`), { statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' });
        }
    }
    // Seedable subjects can update name, minMinutesPerWeek, gradeLevels, and programScopes
    if (subject.isSeedable) {
        const allowed = {};
        if (data.name !== undefined)
            allowed.name = data.name;
        if (data.minMinutesPerWeek !== undefined)
            allowed.minMinutesPerWeek = data.minMinutesPerWeek;
        if (data.gradeLevels !== undefined)
            allowed.gradeLevels = data.gradeLevels;
        if (data.sessionPattern !== undefined)
            allowed.sessionPattern = data.sessionPattern;
        if (data.interSectionEnabled !== undefined)
            allowed.interSectionEnabled = data.interSectionEnabled;
        if (data.interSectionGradeLevels !== undefined)
            allowed.interSectionGradeLevels = data.interSectionGradeLevels;
        if (data.programScopes !== undefined)
            allowed.programScopes = data.programScopes;
        if (data.allowedSpecializations !== undefined)
            allowed.allowedSpecializations = data.allowedSpecializations;
        return prisma.subject.update({ where: { id }, data: allowed });
    }
    const updateData = {};
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.minMinutesPerWeek !== undefined)
        updateData.minMinutesPerWeek = data.minMinutesPerWeek;
    if (data.preferredRoomType !== undefined)
        updateData.preferredRoomType = data.preferredRoomType;
    if (data.sessionPattern !== undefined)
        updateData.sessionPattern = data.sessionPattern;
    if (data.gradeLevels !== undefined)
        updateData.gradeLevels = data.gradeLevels;
    if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
    if (data.interSectionEnabled !== undefined)
        updateData.interSectionEnabled = data.interSectionEnabled;
    if (data.interSectionGradeLevels !== undefined)
        updateData.interSectionGradeLevels = data.interSectionGradeLevels;
    if (data.programScopes !== undefined)
        updateData.programScopes = data.programScopes;
    if (data.allowedSpecializations !== undefined)
        updateData.allowedSpecializations = data.allowedSpecializations;
    return prisma.subject.update({ where: { id }, data: updateData });
}
export async function deleteSubject(id) {
    const subject = await prisma.subject.findUnique({
        where: { id },
        include: { facultySubjects: { select: { id: true }, take: 1 } },
    });
    if (!subject)
        return { success: false, error: 'Subject not found.' };
    if (subject.isSeedable)
        return { success: false, error: 'DepEd standard subjects cannot be deleted.' };
    if (subject.facultySubjects.length > 0) {
        return { success: false, error: 'Cannot delete a subject that is assigned to faculty.' };
    }
    await prisma.subject.delete({ where: { id } });
    return { success: true };
}
export async function getSubjectCountBySchool(schoolId) {
    return prisma.subject.count({ where: { schoolId, isActive: true } });
}
export async function getSubjectsWithoutFaculty(schoolId) {
    return prisma.subject.findMany({
        where: {
            schoolId,
            isActive: true,
            facultySubjects: { none: {} },
        },
        select: { id: true, name: true, code: true },
    });
}
//# sourceMappingURL=subject.service.js.map