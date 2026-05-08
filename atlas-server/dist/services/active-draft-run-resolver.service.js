import { prisma } from '../lib/prisma.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
function extractDraftFacultyIds(draftEntries) {
    if (!Array.isArray(draftEntries))
        return [];
    const facultyIds = draftEntries
        .map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? entry.facultyId : undefined))
        .filter((facultyId) => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
    return [...new Set(facultyIds)];
}
export async function resolveActiveDraftRun(schoolId, schoolYearId) {
    const latestRun = await prisma.generationRun.findFirst({
        where: { schoolId, schoolYearId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            schoolId: true,
            schoolYearId: true,
            status: true,
            version: true,
            finishedAt: true,
            createdAt: true,
            draftEntries: true,
        },
    });
    if (!latestRun) {
        throw err(404, 'NO_ACTIVE_DRAFT', 'No active draft timetable run is available for this school year.', {
            actionHint: 'Ask the scheduling officer to generate a new timetable draft, then refresh this page.',
        });
    }
    const activeFaculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isActiveForScheduling: true, isStale: false },
        select: { id: true },
    });
    const activeFacultyIds = new Set(activeFaculty.map((member) => member.id));
    const staleFacultyIds = extractDraftFacultyIds(latestRun.draftEntries).filter((facultyId) => !activeFacultyIds.has(facultyId));
    if (staleFacultyIds.length > 0) {
        throw err(409, 'STALE_RUN_DATA', 'Latest draft timetable run references stale faculty assignments.', {
            actionHint: 'Trigger a fresh generation run after faculty sync so the latest draft binds to current faculty records.',
            details: {
                latestRunId: latestRun.id,
                staleFacultyIds,
            },
        });
    }
    return {
        ...latestRun,
        status: 'COMPLETED',
    };
}
//# sourceMappingURL=active-draft-run-resolver.service.js.map