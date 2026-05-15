import { prisma } from '../lib/prisma.js';
import { inferSubjectProgramScopes } from './subject-program-scope.service.js';
const MATATAG_DEFAULTS = [
    { code: 'FIL', name: 'Filipino', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'ENG', name: 'English', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 240, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 240, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    { code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'] },
    { code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 1, programScopes: ['REGULAR'] },
    { code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 2, programScopes: ['REGULAR'] },
    { code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 3, programScopes: ['REGULAR'] },
    { code: 'SCI_PHYS', name: 'Science - Physics', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 4, programScopes: ['REGULAR'] },
    { code: 'ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },
    { code: 'BIOTECHNOLOGY', name: 'Biotechnology', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
    { code: 'CONSUMERS_CHEMISTRY', name: 'Consumers Chemistry', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
    { code: 'ELECTRONICS_ROBOTICS', name: 'Electronics and Robotics', minMinutesPerWeek: 90, preferredRoomType: 'LABORATORY', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
    { code: 'SPA_SPEC', name: 'SPA Specialization', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'] },
    { code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE', 'SPA'] },
];
const DEPRECATED_SUBJECT_CODES = [
    'SCI',
    'ICT',
    'TLE_ICT_7',
    'TLE_ICT_8',
    'TLE_ICT_9',
    'TLE_ICT_10',
    'RESEARCH_I',
    'RESEARCH_II',
    'RESEARCH_III',
    'RESEARCH_IV',
    'MUSIC',
    'VISUAL_ARTS',
    'THEATER_ARTS',
    'MEDIA_ARTS',
    'CREATIVE_WRITING',
    'DANCE',
];
export async function ensureDefaultSubjects(schoolId) {
    await prisma.subject.updateMany({
        where: {
            schoolId,
            code: { in: DEPRECATED_SUBJECT_CODES },
        },
        data: {
            isActive: false,
            isSeedable: false,
        },
    });
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
            sessionPattern: subject.sessionPattern ?? 'ANY',
            modularGroupId: subject.modularGroupId ?? null,
            modularOrder: subject.modularOrder ?? null,
            termGroupId: subject.termGroupId ?? subject.modularGroupId ?? null,
            termCount: subject.termCount ?? 3,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            isSeedable: subject.isSeedable,
            isActive: true,
        },
        create: {
            schoolId,
            code: subject.code,
            name: subject.name,
            minMinutesPerWeek: subject.minMinutesPerWeek,
            preferredRoomType: subject.preferredRoomType,
            sessionPattern: subject.sessionPattern ?? 'ANY',
            modularGroupId: subject.modularGroupId ?? null,
            modularOrder: subject.modularOrder ?? null,
            termGroupId: subject.termGroupId ?? subject.modularGroupId ?? null,
            termCount: subject.termCount ?? 3,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            isSeedable: subject.isSeedable,
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
            isActive: data.isActive ?? true,
            isSeedable: data.isSeedable ?? false,
            interSectionEnabled: data.interSectionEnabled ?? false,
            interSectionGradeLevels: interGrades,
            modularGroupId: data.modularGroupId ?? null,
            modularOrder: data.modularOrder ?? null,
            termGroupId: data.termGroupId ?? null,
            termCount: data.termCount ?? 3,
            programScopes: data.programScopes ?? ['REGULAR'],
            allowedSpecializations: data.allowedSpecializations ?? [],
            requiredFeatures: data.requiredFeatures ?? [],
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
        if (data.isSeedable !== undefined)
            allowed.isSeedable = data.isSeedable;
        if (data.modularGroupId !== undefined)
            allowed.modularGroupId = data.modularGroupId;
        if (data.modularOrder !== undefined)
            allowed.modularOrder = data.modularOrder;
        if (data.termGroupId !== undefined)
            allowed.termGroupId = data.termGroupId;
        if (data.termCount !== undefined)
            allowed.termCount = data.termCount;
        if (data.programScopes !== undefined)
            allowed.programScopes = data.programScopes;
        if (data.allowedSpecializations !== undefined)
            allowed.allowedSpecializations = data.allowedSpecializations;
        if (data.requiredFeatures !== undefined)
            allowed.requiredFeatures = data.requiredFeatures;
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
    if (data.isSeedable !== undefined)
        updateData.isSeedable = data.isSeedable;
    if (data.interSectionEnabled !== undefined)
        updateData.interSectionEnabled = data.interSectionEnabled;
    if (data.interSectionGradeLevels !== undefined)
        updateData.interSectionGradeLevels = data.interSectionGradeLevels;
    if (data.modularGroupId !== undefined)
        updateData.modularGroupId = data.modularGroupId;
    if (data.modularOrder !== undefined)
        updateData.modularOrder = data.modularOrder;
    if (data.termGroupId !== undefined)
        updateData.termGroupId = data.termGroupId;
    if (data.termCount !== undefined)
        updateData.termCount = data.termCount;
    if (data.programScopes !== undefined)
        updateData.programScopes = data.programScopes;
    if (data.allowedSpecializations !== undefined)
        updateData.allowedSpecializations = data.allowedSpecializations;
    if (data.requiredFeatures !== undefined)
        updateData.requiredFeatures = data.requiredFeatures;
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