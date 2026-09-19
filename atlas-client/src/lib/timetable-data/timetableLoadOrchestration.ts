/**
 * UX-P01 (R1) — the real Timetable load orchestration.
 *
 * `useTimetableData().loadAll` delegates its sequencing here. Grouping every
 * independent school/year-scoped read into one parallel batch is the whole point
 * of this module, so the ordering is testable against the real production
 * function with instrumented ports instead of by asserting on hook source text.
 *
 * Ordering contract:
 *   1. actor school / school year resolve (owned by the caller; genuinely
 *      dependent) — `syId` is already resolved when this function is entered.
 *   2. batch A (parallel): runs, readiness, reference data, draft board.
 *   3. batch B (parallel, needs the resolved run): run bundle + room requests.
 */
import type { GenerationRun } from '@/types';

export type TimetableLoadPorts = {
	/** The actor school stored when the scope was resolved. */
	readResolvedSchoolId: () => number | null;
	/** The school the hook rendered with; used for the late-scope discard check. */
	currentSchoolId: number | null;

	fetchRuns: (schoolYearId: number) => Promise<GenerationRun[]>;
	fetchCurriculumReadiness: (schoolYearId: number) => void;
	fetchReferenceData: (schoolYearId: number) => Promise<void>;
	fetchDraftBoardSummary: (schoolYearId: number) => Promise<unknown>;
	fetchRunData: (schoolYearId: number, runId: string) => Promise<void>;
	loadRoomRequestSummary: (schoolYearId: number) => Promise<void>;

	errorCodeOf: (error: unknown) => string | undefined;
	clearRoomRequestError: () => void;
	readSelectedRunId: () => string;

	preserveRun: boolean;

	onScopeMismatch: () => void;
	onNoRuns: () => void;
	onRunSelected: (runId: string) => void;
};

export async function runTimetableLoad(
	ports: TimetableLoadPorts,
	schoolYearId: number,
): Promise<void> {
	if (ports.readResolvedSchoolId() !== ports.currentSchoolId) {
		ports.onScopeMismatch();
		return;
	}

	// Batch A — every read whose only inputs are (schoolId, schoolYearId), all
	// dispatched together in one Promise.all.
	ports.fetchCurriculumReadiness(schoolYearId);
	const railBatch = Promise.all([
		ports.fetchReferenceData(schoolYearId).catch(() => {
			// Reference labels and advanced map pivots are non-primary for first grid
			// readiness. Keep the timetable usable with ID fallbacks.
		}),
		ports.fetchDraftBoardSummary(schoolYearId),
	]);

	// The resolved-run reads below genuinely depend on the runs list.
	const fetchedRuns = await ports.fetchRuns(schoolYearId);
	const hasCompletedRun = fetchedRuns.some((run) => run.status === 'COMPLETED');

	if (fetchedRuns.length === 0) {
		ports.onNoRuns();
		void railBatch;
		return;
	}

	const runId = ports.preserveRun ? ports.readSelectedRunId() : 'latest';
	if (!ports.preserveRun) ports.onRunSelected('latest');

	// Batch B — once the run resolver has completed, the run bundle and the
	// room-request summary are independent of each other, so they share one
	// Promise.all. The room-request summary depends only on `hasCompletedRun`.
	const runBundlePromise = (async () => {
		try {
			await ports.fetchRunData(schoolYearId, runId);
		} catch (error) {
			if (runId === 'latest' && ports.errorCodeOf(error) === 'STALE_RUN_DATA') {
				const latestRunId = fetchedRuns[0]?.id;
				if (latestRunId == null) throw error;
				await ports.fetchRunData(schoolYearId, String(latestRunId));
			} else {
				throw error;
			}
		}
	})();
	const roomRequestPromise = hasCompletedRun
		? ports.loadRoomRequestSummary(schoolYearId)
		: Promise.resolve(ports.clearRoomRequestError());

	await Promise.all([runBundlePromise, roomRequestPromise, railBatch]);
}
