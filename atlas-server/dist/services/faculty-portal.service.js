import { getFacultyRoomPreferenceState } from './room-preference.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getFacultyAssignmentIdentitySummary } from './faculty-assignment.service.js';
const PHASE_COPY = {
    SETUP: 'Setup in progress. Scheduling configuration is still being prepared.',
    PREFERENCE_COLLECTION: 'Preference collection is open. Your submitted preferences are being gathered.',
    GENERATION: 'Schedule generation is currently running.',
    REVIEW: 'Schedule review is in progress. Draft schedules may still change.',
    PUBLISHED: 'Schedule is published and final.',
    ARCHIVED: 'This school year schedule is archived.',
};
function buildObjectiveState(input) {
    const hasTeachingLoad = input.teachingAssignmentCount > 0;
    const hasDraftEntries = input.draftEntryCount > 0;
    if (!hasTeachingLoad) {
        return {
            code: 'NO_TEACHING_LOAD',
            hasTeachingLoad,
            hasActiveDraft: input.hasActiveDraft,
            hasDraftEntries,
            publishedScheduleAvailable: input.phase === 'PUBLISHED',
            title: 'No teaching load is linked yet',
            message: 'Your account is active, but ATLAS has not found assignment-bearing classes for this school year.',
            roomRequestMessage: 'Room requests open after a teaching load is linked and a review draft places your classes.',
            nextActionLabel: 'Ask the scheduling officer to check your teaching load',
        };
    }
    if (!input.hasActiveDraft) {
        return {
            code: 'LOAD_WAITING_FOR_DRAFT',
            hasTeachingLoad,
            hasActiveDraft: false,
            hasDraftEntries,
            publishedScheduleAvailable: input.phase === 'PUBLISHED',
            title: 'Teaching load ready, draft timetable not generated',
            message: 'Your teaching load is linked, but there is no active review draft yet.',
            roomRequestMessage: 'Room requests will open after the scheduler generates the review draft.',
            nextActionLabel: 'Wait for the review draft',
        };
    }
    if (!hasDraftEntries) {
        return {
            code: 'LOAD_WITHOUT_DRAFT_ENTRIES',
            hasTeachingLoad,
            hasActiveDraft: true,
            hasDraftEntries,
            publishedScheduleAvailable: input.phase === 'PUBLISHED',
            title: 'Teaching load ready, classes not plotted yet',
            message: 'ATLAS found your teaching load, but this review draft has not placed those classes on the timetable.',
            roomRequestMessage: 'Room requests will appear after your classes are plotted in the review draft.',
            nextActionLabel: 'Check back after draft plotting',
        };
    }
    return {
        code: input.phase === 'PUBLISHED' ? 'PUBLISHED_SCHEDULE_AVAILABLE' : 'DRAFT_ENTRIES_READY',
        hasTeachingLoad,
        hasActiveDraft: true,
        hasDraftEntries,
        publishedScheduleAvailable: input.phase === 'PUBLISHED',
        title: input.phase === 'PUBLISHED' ? 'Published schedule available' : 'Review draft ready',
        message: input.phase === 'PUBLISHED'
            ? 'Your published timetable is available. Room changes now follow the published-schedule process.'
            : 'Your classes are plotted in the review draft. You can submit room or time requests for scheduler decision.',
        roomRequestMessage: input.phase === 'PUBLISHED'
            ? 'Use room requests only when the published-schedule workflow allows changes.'
            : 'Free slots create move requests. Occupied slots create swap requests for scheduler review.',
        nextActionLabel: input.phase === 'PUBLISHED' ? 'View published schedule' : 'Review room requests',
    };
}
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
    let state = null;
    let resolvedRun = null;
    const teachingAssignments = await getFacultyAssignmentIdentitySummary(params.facultyId, params.schoolYearId, params.authToken);
    try {
        resolvedRun = await resolveActiveDraftRun(params.schoolId, params.schoolYearId);
        state = await getFacultyRoomPreferenceState(params.schoolId, params.schoolYearId, resolvedRun.id, params.facultyId);
    }
    catch (error) {
        const code = error.code;
        if (code !== 'NO_ACTIVE_DRAFT') {
            throw error;
        }
        return {
            phase,
            phaseMessage: PHASE_COPY[phase],
            runContext: {
                state: 'NO_ACTIVE_DRAFT',
                runId: null,
                runVersion: null,
                generatedAt: null,
                reason: 'No active draft timetable run is available for this school year.',
                recoveryHint: 'Ask the scheduling officer to generate a new draft, then refresh My Portal.',
            },
            fallbackBanner: {
                show: true,
                title: 'No active draft run available',
                message: 'Your dashboard is waiting for the latest draft run from the review workflow.',
            },
            schedulePreview: {
                runId: null,
                runVersion: null,
                generatedAt: null,
                entries: [],
                counts: { total: 0, pending: 0, approved: 0, rejected: 0, unchanged: 0 },
            },
            teachingAssignments,
            objectiveState: buildObjectiveState({
                phase,
                hasActiveDraft: false,
                teachingAssignmentCount: teachingAssignments.length,
                draftEntryCount: 0,
            }),
            statuses: {
                requestStatusLabel: 'No active draft run yet',
                reviewStatusLabel: teachingAssignments.length > 0
                    ? 'Teaching load linked; waiting for draft generation'
                    : 'Waiting for teaching load and draft generation',
            },
        };
    }
    if (!state || !resolvedRun) {
        throw new Error('Resolved run context was expected but not found.');
    }
    const counts = {
        total: state.entries.length,
        pending: state.entries.filter((entry) => entry.status === 'SUBMITTED' && entry.decisionStatus === 'PENDING').length,
        approved: state.entries.filter((entry) => entry.decisionStatus === 'APPROVED').length,
        rejected: state.entries.filter((entry) => entry.decisionStatus === 'REJECTED').length,
        unchanged: state.entries.filter((entry) => !entry.requestedRoomId).length,
    };
    const objectiveState = buildObjectiveState({
        phase,
        hasActiveDraft: true,
        teachingAssignmentCount: teachingAssignments.length,
        draftEntryCount: counts.total,
    });
    return {
        phase,
        phaseMessage: PHASE_COPY[phase],
        runContext: {
            state: 'ACTIVE_DRAFT',
            runId: state.runId,
            runVersion: state.runVersion,
            generatedAt: state.runGeneratedAt,
            reason: null,
            recoveryHint: null,
        },
        fallbackBanner: {
            show: phase !== 'PUBLISHED',
            title: objectiveState.title,
            message: objectiveState.roomRequestMessage,
            runId: state.runId,
            generatedAt: state.runGeneratedAt,
        },
        schedulePreview: {
            runId: state.runId,
            runVersion: state.runVersion,
            generatedAt: state.runGeneratedAt,
            entries: state.entries,
            counts,
        },
        teachingAssignments,
        objectiveState,
        statuses: {
            requestStatusLabel: counts.pending > 0 ? `${counts.pending} request(s) pending review` : 'No pending room requests',
            reviewStatusLabel: counts.rejected > 0 ? `${counts.rejected} request(s) were rejected and need action` : 'Review status is up to date',
        },
    };
}
//# sourceMappingURL=faculty-portal.service.js.map