import { getLatestFacultyRoomPreferenceState } from './room-preference.service.js';
import { getFacultyRoomPreferenceState } from './room-preference.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';

type LifecyclePhase = 'SETUP' | 'PREFERENCE_COLLECTION' | 'GENERATION' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

const PHASE_COPY: Record<LifecyclePhase, string> = {
	SETUP: 'Setup in progress. Scheduling configuration is still being prepared.',
	PREFERENCE_COLLECTION: 'Preference collection is open. Your submitted preferences are being gathered.',
	GENERATION: 'Schedule generation is currently running.',
	REVIEW: 'Schedule review is in progress. Draft schedules may still change.',
	PUBLISHED: 'Schedule is published and final.',
	ARCHIVED: 'This school year schedule is archived.',
};

function currentPhase(): LifecyclePhase {
	const value = (process.env.ATLAS_LIFECYCLE_PHASE ?? 'REVIEW').toUpperCase();
	if (
		value === 'SETUP'
		|| value === 'PREFERENCE_COLLECTION'
		|| value === 'GENERATION'
		|| value === 'REVIEW'
		|| value === 'PUBLISHED'
		|| value === 'ARCHIVED'
	) {
		return value;
	}
	return 'REVIEW';
}

export async function getFacultyPortalDashboard(params: {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
}) {
	const phase = currentPhase();
	let state: Awaited<ReturnType<typeof getLatestFacultyRoomPreferenceState>> | null = null;
	let resolvedRun: Awaited<ReturnType<typeof resolveActiveDraftRun>> | null = null;

	try {
		resolvedRun = await resolveActiveDraftRun(params.schoolId, params.schoolYearId);
		state = await getFacultyRoomPreferenceState(params.schoolId, params.schoolYearId, resolvedRun.id, params.facultyId);
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code !== 'NO_ACTIVE_DRAFT') {
			throw error;
		}

		return {
			phase,
			phaseMessage: PHASE_COPY[phase],
			runContext: {
				state: 'NO_ACTIVE_DRAFT' as const,
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
			statuses: {
				requestStatusLabel: 'No active draft run yet',
				reviewStatusLabel: 'Waiting for scheduler generation',
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

	return {
		phase,
		phaseMessage: PHASE_COPY[phase],
		runContext: {
			state: 'ACTIVE_DRAFT' as const,
			runId: state.runId,
			runVersion: state.runVersion,
			generatedAt: state.runGeneratedAt,
			reason: null,
			recoveryHint: null,
		},
		fallbackBanner: {
			show: phase !== 'PUBLISHED',
			title: 'Active draft run (not final / not yet published)',
			message: 'This preview reflects the latest generated draft and active room-request reviews. Final room assignments apply only after publish.',
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
		statuses: {
			requestStatusLabel: counts.pending > 0 ? `${counts.pending} request(s) pending review` : 'No pending room requests',
			reviewStatusLabel: counts.rejected > 0 ? `${counts.rejected} request(s) were rejected and need action` : 'Review status is up to date',
		},
	};
}
