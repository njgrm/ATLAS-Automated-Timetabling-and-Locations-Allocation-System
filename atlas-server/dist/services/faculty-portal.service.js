import { prisma } from '../lib/prisma.js';
import { getLatestFacultyRoomPreferenceState } from './room-preference.service.js';
const PHASE_COPY = {
    SETUP: 'Setup in progress. Scheduling configuration is still being prepared.',
    PREFERENCE_COLLECTION: 'Preference collection is open. Your submitted preferences are being gathered.',
    GENERATION: 'Schedule generation is currently running.',
    REVIEW: 'Schedule review is in progress. Draft schedules may still change.',
    PUBLISHED: 'Schedule is published and final.',
    ARCHIVED: 'This school year schedule is archived.',
};
function currentPhase() {
    const value = (process.env.ATLAS_LIFECYCLE_PHASE ?? 'REVIEW').toUpperCase();
    if (value === 'SETUP'
        || value === 'PREFERENCE_COLLECTION'
        || value === 'GENERATION'
        || value === 'REVIEW'
        || value === 'PUBLISHED'
        || value === 'ARCHIVED') {
        return value;
    }
    return 'REVIEW';
}
export async function getFacultyPortalDashboard(params) {
    const phase = currentPhase();
    const latestRun = await prisma.generationRun.findFirst({
        where: {
            schoolId: params.schoolId,
            schoolYearId: params.schoolYearId,
            status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            status: true,
            finishedAt: true,
        },
    });
    if (!latestRun) {
        return {
            phase,
            phaseMessage: PHASE_COPY[phase],
            fallbackBanner: {
                show: phase !== 'PUBLISHED',
                title: 'No published schedule yet',
                message: 'Your schedule is still in draft preparation and may change after scheduler review.',
            },
            schedulePreview: {
                runId: null,
                runVersion: null,
                entries: [],
                counts: { total: 0, pending: 0, approved: 0, rejected: 0, unchanged: 0 },
            },
            statuses: {
                requestStatusLabel: 'No schedule generated yet',
                reviewStatusLabel: 'Waiting for generated draft',
            },
        };
    }
    const state = await getLatestFacultyRoomPreferenceState(params.schoolId, params.schoolYearId, params.facultyId);
    const counts = {
        total: state.entries.length,
        pending: state.entries.filter((entry) => entry.status === 'SUBMITTED' && entry.decisionStatus === 'PENDING').length,
        approved: state.entries.filter((entry) => entry.decisionStatus === 'APPROVED').length,
        rejected: state.entries.filter((entry) => entry.decisionStatus === 'REJECTED').length,
        unchanged: state.entries.filter((entry) => !entry.requestedRoomId).length,
    };
    return {
        phase,
        phaseMessage: PHASE_COPY[phase],
        fallbackBanner: {
            show: phase !== 'PUBLISHED',
            title: 'Latest generated fallback (not final / not yet published)',
            message: 'This preview reflects the latest generated draft and active room-request reviews. Final room assignments apply only after publish.',
            runId: latestRun.id,
            generatedAt: latestRun.finishedAt?.toISOString() ?? null,
        },
        schedulePreview: {
            runId: state.runId,
            runVersion: state.runVersion,
            entries: state.entries,
            counts,
        },
        statuses: {
            requestStatusLabel: counts.pending > 0 ? `${counts.pending} request(s) pending review` : 'No pending room requests',
            reviewStatusLabel: counts.rejected > 0 ? `${counts.rejected} request(s) were rejected and need action` : 'Review status is up to date',
        },
    };
}
//# sourceMappingURL=faculty-portal.service.js.map