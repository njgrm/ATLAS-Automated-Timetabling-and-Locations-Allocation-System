import { prisma } from '../lib/prisma.js';
const MATATAG_DEFAULTS = [
    { code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    { code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    { code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    { code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10] },
    { code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    { code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10] },
    { code: 'VE', name: 'Values Education', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
    { code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10] },
    { code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10] },
];
export async function ensureDefaultSubjects(schoolId) {
    const count = await prisma.subject.count({ where: { schoolId } });
    if (count > 0)
        return;
    await prisma.subject.createMany({
        data: MATATAG_DEFAULTS.map((s) => ({
            schoolId,
            code: s.code,
            name: s.name,
            minMinutesPerWeek: s.minMinutesPerWeek,
            preferredRoomType: s.preferredRoomType,
            gradeLevels: s.gradeLevels,
            isSeedable: true,
            isActive: true,
        })),
    });
}
export async function getSubjectsBySchool(schoolId) {
    return prisma.subject.findMany({
        where: { schoolId },
        orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
    });
}
export async function getSubjectById(id) {
    return prisma.subject.findUnique({ where: { id } });
}
export async function createSubject(schoolId, data) {
    return prisma.subject.create({
        data: {
            schoolId,
            code: data.code,
            name: data.name,
            minMinutesPerWeek: data.minMinutesPerWeek,
            preferredRoomType: data.preferredRoomType,
            gradeLevels: data.gradeLevels,
            isActive: true,
            isSeedable: false,
        },
    });
}
export async function updateSubject(id, data) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject)
        return null;
    // Seedable subjects can update name, minMinutesPerWeek, and gradeLevels
    if (subject.isSeedable) {
        const allowed = {};
        if (data.name !== undefined)
            allowed.name = data.name;
        if (data.minMinutesPerWeek !== undefined)
            allowed.minMinutesPerWeek = data.minMinutesPerWeek;
        if (data.gradeLevels !== undefined)
            allowed.gradeLevels = data.gradeLevels;
        return prisma.subject.update({ where: { id }, data: allowed });
    }
    const updateData = {};
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.minMinutesPerWeek !== undefined)
        updateData.minMinutesPerWeek = data.minMinutesPerWeek;
    if (data.preferredRoomType !== undefined)
        updateData.preferredRoomType = data.preferredRoomType;
    if (data.gradeLevels !== undefined)
        updateData.gradeLevels = data.gradeLevels;
    if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
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