import atlasApi from '@/lib/api';

/**
 * TT-SYNC-TERM-C03R4 — client contract for the "Sync timetable setup" action.
 *
 * The server now requires the exact run version the operator reviewed
 * (`expectedRunVersion`) and fails closed on a stale version or stale source
 * authority. This module owns the request body, the typed-error classification,
 * the duplicate-click in-flight guard, and the refresh-only-on-success rule so
 * the component cannot silently retry, drop the version, or refresh on failure.
 */

export type SyncSetupSuccessData = {
	runId?: number;
	version?: number;
	replayed?: boolean;
	noChange?: boolean;
	updatedFacultyCount?: number;
	displacedEntriesCount?: number;
	addedUnassignedCount?: number;
	hardViolationCount?: number;
	softViolationCount?: number;
	summary?: unknown;
};

export type SyncSetupErrorKind = 'STALE' | 'AUTHORITY' | 'FORBIDDEN' | 'BLOCKED' | 'VALIDATION' | 'UNKNOWN';

export type SyncSetupErrorClassification = {
	code: string | null;
	kind: SyncSetupErrorKind;
	message: string;
	retryable: boolean;
};

export class SyncSetupVersionMissingError extends Error {
	constructor(message = 'This run has no reviewable version yet. Refresh the timetable and try again.') {
		super(message);
		this.name = 'SyncSetupVersionMissingError';
	}
}

/** Builds the exact request body bound to the reviewed run version. */
export function buildSyncSetupBody(draftVersion: unknown): { expectedRunVersion: number } {
	if (typeof draftVersion !== 'number' || !Number.isInteger(draftVersion) || draftVersion < 1) {
		throw new SyncSetupVersionMissingError();
	}
	return { expectedRunVersion: draftVersion };
}

export function buildSyncSetupPath(schoolId: number, schoolYearId: number, runId: number): string {
	return `/generation/${schoolId}/${schoolYearId}/runs/${runId}/sync-setup`;
}

const ERROR_KIND_BY_CODE: Record<string, SyncSetupErrorKind> = {
	RUN_VERSION_STALE: 'STALE',
	SYNC_TRANSACTION_CONFLICT: 'STALE',
	SOURCE_AUTHORITY_STALE: 'AUTHORITY',
	DERIVED_DEMAND_BLOCKED: 'AUTHORITY',
	INVALID_TERM_IDENTITY: 'AUTHORITY',
	COHORT_DEMAND_UNSUPPORTED: 'AUTHORITY',
	PER_TERM_CONSERVATION_VIOLATION: 'AUTHORITY',
	CROSS_SCHOOL_DENIED: 'FORBIDDEN',
	FORBIDDEN: 'FORBIDDEN',
	ACTOR_SCHOOL_UNRESOLVED: 'FORBIDDEN',
	RUN_ALREADY_PUBLISHED: 'BLOCKED',
	RUN_NOT_FOUND: 'BLOCKED',
	RUN_NOT_COMPLETED: 'BLOCKED',
	INVALID_PARAM: 'VALIDATION',
};

export function classifySyncSetupError(error: unknown): SyncSetupErrorClassification {
	const candidate = error as { code?: unknown; message?: unknown; response?: { data?: { code?: unknown; message?: unknown } } } | null;
	const responseData = candidate?.response?.data;
	const code = typeof responseData?.code === 'string'
		? responseData.code
		: typeof candidate?.code === 'string'
			? candidate.code
			: null;
	const kind = code ? ERROR_KIND_BY_CODE[code] ?? 'UNKNOWN' : 'UNKNOWN';
	const message = typeof responseData?.message === 'string' && responseData.message.length > 0
		? responseData.message
		: typeof candidate?.message === 'string' && candidate.message.length > 0
			? candidate.message
			: 'Sync failed.';
	return { code, kind, message, retryable: kind === 'STALE' };
}

export type SyncSetupOutcome =
	| { status: 'COMMITTED'; data: SyncSetupSuccessData; refresh: true }
	| { status: 'REPLAYED'; data: SyncSetupSuccessData; refresh: true }
	| { status: 'FAILED'; error: SyncSetupErrorClassification; refresh: false }
	| { status: 'SKIPPED_IN_FLIGHT'; refresh: false };

export type SyncSetupInFlightGuard = {
	tryEnter: () => boolean;
	exit: () => void;
	isInFlight: () => boolean;
};

/** Single-flight guard so a second click cannot dispatch while a sync is active. */
export function createSyncSetupInFlightGuard(): SyncSetupInFlightGuard {
	let inFlight = false;
	return {
		tryEnter() {
			if (inFlight) return false;
			inFlight = true;
			return true;
		},
		exit() {
			inFlight = false;
		},
		isInFlight() {
			return inFlight;
		},
	};
}

export type SyncSetupPoster = (
	path: string,
	body: { expectedRunVersion: number },
) => Promise<{ data: SyncSetupSuccessData }>;

export async function runSyncSetup(params: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	draftVersion: unknown;
	guard: SyncSetupInFlightGuard;
	post?: SyncSetupPoster;
}): Promise<SyncSetupOutcome> {
	let body: { expectedRunVersion: number };
	try {
		body = buildSyncSetupBody(params.draftVersion);
	} catch (error) {
		return {
			status: 'FAILED',
			error: {
				code: 'DRAFT_VERSION_UNAVAILABLE',
				kind: 'VALIDATION',
				message: error instanceof Error ? error.message : 'This run has no reviewable version yet.',
				retryable: false,
			},
			refresh: false,
		};
	}

	if (!params.guard.tryEnter()) {
		return { status: 'SKIPPED_IN_FLIGHT', refresh: false };
	}

	try {
		const post: SyncSetupPoster = params.post ?? ((path, requestBody) => atlasApi.post(path, requestBody));
		const { data } = await post(buildSyncSetupPath(params.schoolId, params.schoolYearId, params.runId), body);
		const replayed = data?.replayed === true || data?.noChange === true;
		return replayed
			? { status: 'REPLAYED', data, refresh: true }
			: { status: 'COMMITTED', data, refresh: true };
	} catch (error) {
		return { status: 'FAILED', error: classifySyncSetupError(error), refresh: false };
	} finally {
		params.guard.exit();
	}
}
