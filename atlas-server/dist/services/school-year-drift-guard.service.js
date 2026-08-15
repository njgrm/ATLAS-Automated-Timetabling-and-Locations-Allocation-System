import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';
import { prisma } from '../lib/prisma.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
async function getSavedActiveSchoolYearId(schoolId) {
    const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
        where: { schoolId, isActive: true },
        orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
        select: { enrollProSchoolYearId: true },
    });
    return mirror?.enrollProSchoolYearId ?? null;
}
export async function assertActiveSchoolYearForGeneration(schoolId, schoolYearId, authToken) {
    const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
    if (upstreamYear) {
        // EnrollPro is reachable — check against its active year
        if (upstreamYear.id === schoolYearId)
            return;
        throw err(409, 'ACTIVE_YEAR_DRIFT', `EnrollPro is now on ${upstreamYear.yearLabel}. Sync the new school year before generating schedules.`, {
            actionHint: 'Run EnrollPro rollover sync, review Sections and Teaching Load for the new school year, then generate the timetable again.',
            details: {
                schoolId,
                requestedSchoolYearId: schoolYearId,
                enrollProSchoolYearId: upstreamYear.id,
                enrollProSchoolYearLabel: upstreamYear.yearLabel,
                nextAction: 'RUN_ROLLOVER_SYNC',
            },
        });
    }
    // EnrollPro is unreachable — use saved active year as source of truth
    const savedActiveYearId = await getSavedActiveSchoolYearId(schoolId);
    if (savedActiveYearId && savedActiveYearId !== schoolYearId) {
        throw err(409, 'ACTIVE_YEAR_DRIFT', `ATLAS is set up for school year ${savedActiveYearId}. Create new schedules only for the active school year.`, {
            actionHint: 'Open Year Setup or Timetable and use the active school year.',
            details: {
                schoolId,
                requestedSchoolYearId: schoolYearId,
                savedActiveSchoolYearId: savedActiveYearId,
                nextAction: 'USE_ACTIVE_YEAR',
            },
        });
    }
}
//# sourceMappingURL=school-year-drift-guard.service.js.map