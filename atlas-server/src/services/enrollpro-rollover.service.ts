import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { syncFacultyFromExternal, type FacultySyncMode } from './faculty.service.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
import { syncSectionsFromExternal } from './section.service.js';
import { fetchEnrollProActiveSchoolYear, normalizeProgramMetadata } from './section-adapter.js';
import { publishNotificationEvent } from './notification-events.service.js';
import { ensureCanonicalClassProgramSlots } from './class-program-slot.service.js';
import { ensureTeachingLoadCycle, serializeTeachingLoadCycle, type TeachingLoadCycleSource } from './teaching-load-cycle.service.js';

type DriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RolloverAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR' | 'RUN_ARCHIVE_AND_SYNC';

export type RolloverServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

export type EnrollProYearInfo = {
	id: number;
	yearLabel: string;
};

export type ActiveYearDriftState = {
	status: DriftStatus;
	message: string;
	recommendedAction: RolloverAction;
	atlasSchoolYearId: number | null;
	enrollProSchoolYearId: number | null;
	enrollProSchoolYearLabel: string | null;
	mirrorSyncedAt: string | null;
};

export type RolloverFeedCounts = {
	facultyCount: number;
	sectionCount: number;
	settingsReachable: boolean;
};

export type RolloverConflict = {
	code: string;
	message: string;
	details?: Record<string, unknown>;
};

export type RecoveryClassification =
	| 'AUTO_ROLLOVER_READY'
	| 'MANUAL_RECONFIGURE_REQUIRED'
	| 'MANUAL_MAPPING_CONFLICT_REQUIRED'
	| 'TEST_DATA_RECOVERY_AVAILABLE'
	| 'TEST_DATA_RECOVERY_BLOCKED'
	| 'ARCHIVE_AND_SYNC_AVAILABLE'
	| 'ENROLLPRO_UNREACHABLE';

export type RecoveryClassifierResult = {
	classification: RecoveryClassification;
	schoolId: number;
	enrollProActiveYear: EnrollProYearInfo | null;
	atlasSchoolYearId: number | null;
	conflictCode: string | null;
	artifactCounts: RolloverDummyYearRecordCounts | null;
	blockers: RolloverConflict[];
	confirmationText: string;
	message: string;
	canClearTestData: boolean;
	testDataMarked: boolean;
};

export type ReconfiguredSection = {
	externalId: number;
	sectionName: string;
	previousName: string | null;
	previousGradeLevelId: number | null;
	previousProgramType: string | null;
	newName: string;
	newGradeLevelId: number;
	newProgramType: string;
};

export type RolloverDummyYearRecordCounts = {
	sectionMirrors: number;
	facultyPreferences: number;
	preferenceTimeSlots: number;
	preferenceReviews: number;
	facultyRoomPreferences: number;
	roomRequestAppeals: number;
	roomRequestAppealHistory: number;
	schedulingPolicies: number;
	generationRuns: number;
	publishedGenerationRuns: number;
	manualScheduleEdits: number;
	followUpFlags: number;
	publishedScheduleRevisions: number;
	auditLogs: number;
	lockedSessions: number;
	lockedSessionActions: number;
	gradeShiftWindows: number;
	facultySnapshots: number;
	sectionSnapshots: number;
	instructionalCohorts: number;
	teachingLoadFacultySubjects: number;
	teachingLoadOwnerships: number;
};

export type RolloverDummyYearResetPreview = {
	targetSchoolYearId: number | null;
	confirmationText: string;
	canResetDummyYear: boolean;
	publishedResetBlocked: boolean;
	teachingLoadResetRequired: boolean;
	counts: RolloverDummyYearRecordCounts;
	blockers: RolloverConflict[];
};

export type ArchivedYearSummary = {
	enrollProSchoolYearId: number;
	yearLabel: string;
	archivedAt: string | null;
	archivedBy: number | null;
	archiveReason: string | null;
	preservedCounts: ArchivedYearPreservedCounts | null;
};

export type RolloverStatusResult = {
	schoolId: number;
	atlasSchoolYearId: number | null;
	enrollProActiveYear: EnrollProYearInfo | null;
	drift: ActiveYearDriftState;
	mirror: {
		enrollProSchoolYearId: number;
		yearLabel: string;
		isActive: boolean;
		lastVerifiedAt: string | null;
		lastSyncedAt: string | null;
		facultyCount: number;
		sectionCount: number;
		syncStatus: string;
		lastFailureSummary: string | null;
	} | null;
	counts?: RolloverFeedCounts;
	conflicts: RolloverConflict[];
	reconfiguredSections: ReconfiguredSection[];
	canResetDummyYear: boolean;
	resetTargetSchoolYearId: number | null;
	conflictingRecordCounts: RolloverDummyYearRecordCounts | null;
	teachingLoadResetRequired: boolean;
	publishedResetBlocked: boolean;
	testDataMarked: boolean;
	/** RR-09A: years already archived as read-only history. */
	archivedYears?: ArchivedYearSummary[];
};

export type RolloverApplyResult = RolloverStatusResult & {
	applied: boolean;
	sync: {
		faculty: Awaited<ReturnType<typeof syncFacultyFromExternal>> | null;
		sections: Awaited<ReturnType<typeof syncSectionsFromExternal>> | null;
		policyReady: boolean;
		canonicalTemplatesSeeded: number;
	};
};

export type ResetDummyYearInput = {
	schoolId: number;
	actorId: number;
	authToken?: string;
	confirmReset?: boolean;
	confirmationText?: string;
};

export type RolloverDummyYearResetResult = RolloverStatusResult & {
	previewOnly: boolean;
	resetApplied: boolean;
	reset: RolloverDummyYearResetPreview;
	rolloverApply: RolloverApplyResult | null;
	/**
	 * RR-08 resumability: `'fresh'` when this run executed the destructive
	 * clear phase, `'resumed-after-clear'` when a prior run had already
	 * committed the clear (phase marker `cleared: true`) but died before the
	 * EnrollPro apply — in that case the destructive transaction is skipped
	 * entirely and only the apply + teaching-load clear run.
	 */
	resumePath?: 'fresh' | 'resumed-after-clear';
};

type ResetPhaseMarker = {
	cleared: boolean;
	syncApplied: boolean;
	teachingLoadCleared: boolean;
};

async function findResumableResetMarker(
	schoolId: number,
	schoolYearId: number,
): Promise<{ auditId: number; marker: ResetPhaseMarker } | null> {
	const priorReset = await prisma.auditLog.findFirst({
		where: { schoolId, schoolYearId, action: 'DUMMY_YEAR_RESET' },
		orderBy: { id: 'desc' },
		select: { id: true, metadata: true },
	});
	if (!priorReset) return null;
	const phases = (priorReset.metadata as { phases?: ResetPhaseMarker } | null)?.phases;
	if (!phases || typeof phases !== 'object') return null;
	if (phases.cleared === true && phases.syncApplied !== true) {
		return { auditId: priorReset.id, marker: phases };
	}
	return null;
}

const SCHOOL_YEAR_ENDPOINT = '/integration/v1/school-year';
const SECTION_ENDPOINT = '/integration/v1/sections';
const FACULTY_ENDPOINTS = ['/integration/v1/faculty', '/integration/v1/default/faculty'];
const PUBLIC_SETTINGS_ENDPOINT = '/settings/public';
const HEALTH_ENDPOINT = '/integration/v1/health';
const DUMMY_YEAR_RESET_CONFIRMATION_TEXT = 'RESET_DUMMY_SCHOOL_YEAR_1';

export function serviceError(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): RolloverServiceError {
	return Object.assign(new Error(message), {
		statusCode,
		code,
		actionHint: options?.actionHint,
		details: options?.details,
	});
}

function authHeaders(authToken?: string, options?: { useServiceTokenFallback?: boolean }): Record<string, string> | undefined {
	const token = authToken ?? (options?.useServiceTokenFallback === false ? undefined : process.env.ENROLLPRO_SERVICE_TOKEN);
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export type EnrollProHealthResult = {
	reachable: boolean;
	statusCode?: number;
	message?: string;
	durationMs: number;
};

export async function fetchEnrollProIntegrationHealth(authToken?: string): Promise<EnrollProHealthResult> {
	const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	const start = Date.now();
	try {
		const res = await fetch(`${baseUrl}${HEALTH_ENDPOINT}`, {
			headers: authHeaders(authToken),
			signal: AbortSignal.timeout(5000),
		});
		const durationMs = Date.now() - start;
		if (!res.ok) {
			return { reachable: false, statusCode: res.status, message: `HTTP ${res.status}`, durationMs };
		}
		return { reachable: true, statusCode: res.status, durationMs };
	} catch (error) {
		const durationMs = Date.now() - start;
		const message = error instanceof Error ? error.message : String(error);
		return { reachable: false, message: message.slice(0, 200), durationMs };
	}
}

async function fetchJson(path: string, authToken?: string, options?: { useServiceTokenFallback?: boolean }): Promise<unknown> {
	const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	const res = await fetch(`${baseUrl}${path}`, {
		headers: authHeaders(authToken, options),
		signal: AbortSignal.timeout(10000),
	});
	if (!res.ok) {
		throw serviceError(res.status, 'UPSTREAM_ERROR', `EnrollPro ${path} returned ${res.status}.`, {
			details: { path, status: res.status, statusText: res.statusText },
		});
	}
	return res.json();
}

function extractRows(payload: unknown): unknown[] {
	if (!payload || typeof payload !== 'object') return [];
	const candidate = payload as {
		data?: unknown;
		gradeLevels?: Array<{ sections?: unknown[] }>;
	};
	if (Array.isArray(candidate.data)) return candidate.data;
	if (Array.isArray(candidate.gradeLevels)) {
		return candidate.gradeLevels.flatMap((grade) => Array.isArray(grade.sections) ? grade.sections : []);
	}
	return [];
}

function extractTotalPages(payload: unknown): number | null {
	if (!payload || typeof payload !== 'object') return null;
	const meta = (payload as { meta?: { totalPages?: unknown } }).meta;
	const totalPages = Number(meta?.totalPages);
	return Number.isInteger(totalPages) && totalPages > 0 ? totalPages : null;
}

async function fetchPaginatedRows(paths: string[], authToken?: string): Promise<{ rows: unknown[]; sourcePath: string }> {
	let lastError: unknown = null;
	for (const path of paths) {
		try {
			const rows: unknown[] = [];
			const pageSize = 200;
			let page = 1;
			let totalPages = 1;

			while (page <= totalPages) {
				const separator = path.includes('?') ? '&' : '?';
				const payload = await fetchJson(`${path}${separator}page=${page}&limit=${pageSize}`, authToken);
				const pageRows = extractRows(payload);
				rows.push(...pageRows);
				const reportedTotalPages = extractTotalPages(payload);
				totalPages = reportedTotalPages ?? (pageRows.length < pageSize ? page : page + 1);
				page += 1;
			}

			return { rows, sourcePath: path };
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : serviceError(502, 'UPSTREAM_ERROR', 'EnrollPro feed could not be read.');
}

function rowExternalIds(rows: unknown[]): Set<number> {
	const ids = new Set<number>();
	for (const row of rows) {
		if (!row || typeof row !== 'object') continue;
		const candidate = row as { id?: unknown; teacherId?: unknown };
		const id = Number(candidate.id ?? candidate.teacherId);
		if (Number.isInteger(id) && id > 0) ids.add(id);
	}
	return ids;
}

export async function fetchSectionExternalIds(authToken?: string): Promise<Set<number>> {
	const { rows } = await fetchPaginatedRows([SECTION_ENDPOINT], authToken);
	return rowExternalIds(rows);
}

async function fetchRolloverCounts(authToken?: string): Promise<RolloverFeedCounts & { sectionExternalIds: Set<number>; sectionRows: unknown[]; sources: Record<string, string> }> {
	const [sections, faculty, settings] = await Promise.allSettled([
		fetchPaginatedRows([SECTION_ENDPOINT], authToken),
		fetchPaginatedRows(FACULTY_ENDPOINTS, authToken),
		fetchJson(PUBLIC_SETTINGS_ENDPOINT, undefined, { useServiceTokenFallback: false }),
	]);

	if (sections.status === 'rejected') throw sections.reason;
	if (faculty.status === 'rejected') throw faculty.reason;

	return {
		sectionCount: sections.value.rows.length,
		facultyCount: faculty.value.rows.length,
		settingsReachable: settings.status === 'fulfilled',
		sectionExternalIds: rowExternalIds(sections.value.rows),
		sectionRows: sections.value.rows,
		sources: {
			sections: sections.value.sourcePath,
			faculty: faculty.value.sourcePath,
			settings: PUBLIC_SETTINGS_ENDPOINT,
		},
	};
}

/**
 * RR-09A: an archive-resolvable conflict is one the non-destructive
 * archive+sync flow can dissolve without deleting anything. `YEAR_LABEL_MISMATCH`
 * dissolves via ATLAS-owned mirror-label reconciliation; `SECTION_ID_COLLISION`
 * means same-year section data that does not match the feed and always needs
 * the (manual) marked-test-data or reset path — `findMappingConflicts` scopes
 * its section check to the EnrollPro active year id, so data under other years
 * can never produce that conflict in the first place.
 */
export function isArchiveResolvableConflict(conflictCodes: string[]): boolean {
	return conflictCodes.length > 0 && conflictCodes.every((code) => code === 'YEAR_LABEL_MISMATCH');
}

export function resolveMappingConflictAction(publishedResetBlocked: boolean, conflictCodes: string[] = []): {
	recommendedAction: RolloverAction;
	message: string;
} {
	if (isArchiveResolvableConflict(conflictCodes)) {
		return {
			recommendedAction: 'RUN_ARCHIVE_AND_SYNC',
			message: 'EnrollPro moved to a new school year. Archive the old school year and sync the new one.',
		};
	}
	if (publishedResetBlocked) {
		return {
			recommendedAction: 'REVIEW_MAPPING_CONFLICT',
			message: 'ATLAS has dummy data using the EnrollPro year ID, but published schedule artifacts block a reset. Review migration before syncing.',
		};
	}
	return {
		recommendedAction: 'RESET_DUMMY_YEAR',
		message: 'ATLAS has dummy data using the EnrollPro year ID. Reset dummy data and sync from EnrollPro.',
	};
}

function buildDriftState(input: {
	atlasSchoolYearId: number | null;
	upstreamYear: EnrollProYearInfo | null;
	upstreamReachable: boolean;
	hasMappingConflict: boolean;
	conflictCodes?: string[];
	publishedResetBlocked?: boolean;
	mirrorSyncedAt?: Date | null;
}): ActiveYearDriftState {
	if (!input.upstreamReachable || !input.upstreamYear) {
		return {
			status: 'enrollpro-unreachable',
			message: 'EnrollPro active school year could not be verified. ATLAS will keep using saved setup data until the source is reachable.',
			recommendedAction: 'RETRY_ENROLLPRO',
			atlasSchoolYearId: input.atlasSchoolYearId,
			enrollProSchoolYearId: null,
			enrollProSchoolYearLabel: null,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	if (input.hasMappingConflict) {
		const action = resolveMappingConflictAction(input.publishedResetBlocked ?? false, input.conflictCodes ?? []);
		return {
			status: 'mapping-conflict',
			message: action.message,
			recommendedAction: action.recommendedAction,
			atlasSchoolYearId: input.atlasSchoolYearId,
			enrollProSchoolYearId: input.upstreamYear.id,
			enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	if (input.atlasSchoolYearId !== input.upstreamYear.id) {
		return {
			status: 'atlas-stale',
			message: `EnrollPro is now on ${input.upstreamYear.yearLabel}. Sync the new school year before creating a timetable.`,
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			atlasSchoolYearId: input.atlasSchoolYearId,
			enrollProSchoolYearId: input.upstreamYear.id,
			enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
			mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
		};
	}

	return {
		status: 'aligned',
		message: `ATLAS is aligned with EnrollPro ${input.upstreamYear.yearLabel}.`,
		recommendedAction: 'NONE',
		atlasSchoolYearId: input.atlasSchoolYearId,
		enrollProSchoolYearId: input.upstreamYear.id,
		enrollProSchoolYearLabel: input.upstreamYear.yearLabel,
		mirrorSyncedAt: input.mirrorSyncedAt?.toISOString() ?? null,
	};
}

export async function findMappingConflicts(
	schoolId: number,
	upstreamYear: EnrollProYearInfo,
	sectionExternalIds?: Set<number>,
): Promise<RolloverConflict[]> {
	const conflicts: RolloverConflict[] = [];
	const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
		select: { yearLabel: true },
	});
	if (mirror && mirror.yearLabel !== upstreamYear.yearLabel) {
		conflicts.push({
			code: 'YEAR_LABEL_MISMATCH',
			message: `ATLAS already mirrors EnrollPro year ${upstreamYear.id} as ${mirror.yearLabel}, not ${upstreamYear.yearLabel}.`,
			details: { existingYearLabel: mirror.yearLabel, enrollProYearLabel: upstreamYear.yearLabel },
		});
	}

	if (sectionExternalIds && sectionExternalIds.size > 0) {
		const existingSections = await prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId: upstreamYear.id },
			select: { externalId: true },
			take: 500,
		});
		if (existingSections.length > 0) {
			const overlap = existingSections.filter((section) => sectionExternalIds.has(section.externalId)).length;
			if (overlap === 0) {
				conflicts.push({
					code: 'SECTION_ID_COLLISION',
					message: `ATLAS already has section data for school year #${upstreamYear.id}, but it does not match EnrollPro ${upstreamYear.yearLabel}.`,
					details: { existingSectionCount: existingSections.length, enrollProSectionCount: sectionExternalIds.size },
				});
			}
		}
	}

	return conflicts;
}

export async function detectReconfiguredSections(
	schoolId: number,
	schoolYearId: number,
	upstreamSections: Array<{ id: number; name: string; gradeLevelId: number; programType: string }>,
): Promise<ReconfiguredSection[]> {
	const existingSections = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId },
		select: { externalId: true, name: true, gradeLevelId: true, programType: true },
		take: 500,
	});
	const existingByExternalId = new Map(
		existingSections.map((s) => [s.externalId, s]),
	);

	const reconfigured: ReconfiguredSection[] = [];
	for (const upstream of upstreamSections) {
		const existing = existingByExternalId.get(upstream.id);
		if (!existing) continue;

		const nameChanged = existing.name !== upstream.name;
		const gradeChanged = existing.gradeLevelId !== upstream.gradeLevelId;
		const programChanged = existing.programType !== upstream.programType;

		if (nameChanged || gradeChanged || programChanged) {
			reconfigured.push({
				externalId: upstream.id,
				sectionName: upstream.name,
				previousName: existing.name,
				previousGradeLevelId: existing.gradeLevelId,
				previousProgramType: existing.programType,
				newName: upstream.name,
				newGradeLevelId: upstream.gradeLevelId,
				newProgramType: upstream.programType,
			});
		}
	}

	return reconfigured;
}

async function getLatestAtlasSchoolYearId(schoolId: number): Promise<number | null> {
	// RR-09A: archived years are historical scope and never participate in
	// active-year selection — not even as snapshot/run fallback evidence.
	const archivedYearIds = (await prisma.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isArchived: true },
		select: { enrollProSchoolYearId: true },
	})).map((mirror) => mirror.enrollProSchoolYearId);
	const notArchived = archivedYearIds.length > 0 ? { schoolYearId: { notIn: archivedYearIds } } : {};

	const [mirror, sectionSnapshot, generationRun] = await Promise.all([
		prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			select: { enrollProSchoolYearId: true },
		}),
		prisma.sectionSnapshot.findFirst({
			where: { schoolId, ...notArchived },
			orderBy: { fetchedAt: 'desc' },
			select: { schoolYearId: true },
		}),
		prisma.generationRun.findFirst({
			where: { schoolId, ...notArchived },
			orderBy: { createdAt: 'desc' },
			select: { schoolYearId: true },
		}),
	]);
	return mirror?.enrollProSchoolYearId ?? sectionSnapshot?.schoolYearId ?? generationRun?.schoolYearId ?? null;
}

function emptyDummyYearCounts(): RolloverDummyYearRecordCounts {
	return {
		sectionMirrors: 0,
		facultyPreferences: 0,
		preferenceTimeSlots: 0,
		preferenceReviews: 0,
		facultyRoomPreferences: 0,
		roomRequestAppeals: 0,
		roomRequestAppealHistory: 0,
		schedulingPolicies: 0,
		generationRuns: 0,
		publishedGenerationRuns: 0,
		manualScheduleEdits: 0,
		followUpFlags: 0,
		publishedScheduleRevisions: 0,
		auditLogs: 0,
		lockedSessions: 0,
		lockedSessionActions: 0,
		gradeShiftWindows: 0,
		facultySnapshots: 0,
		sectionSnapshots: 0,
		instructionalCohorts: 0,
		teachingLoadFacultySubjects: 0,
		teachingLoadOwnerships: 0,
	};
}

function isPublishedRunSummary(summary: unknown): boolean {
	if (!summary || typeof summary !== 'object') return false;
	const candidate = summary as { isPublished?: unknown; publishedAt?: unknown; publishedBy?: unknown };
	return candidate.isPublished === true
		|| (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0)
		|| typeof candidate.publishedBy === 'number';
}

async function countDummyYearRecords(schoolId: number, schoolYearId: number): Promise<RolloverDummyYearRecordCounts> {
	const generationRuns = await prisma.generationRun.findMany({
		where: { schoolId, schoolYearId },
		select: { id: true, summary: true },
	});
	const generationRunIds = generationRuns.map((run) => run.id);
	const preferenceIds = (await prisma.facultyPreference.findMany({
		where: { schoolId, schoolYearId },
		select: { id: true },
	})).map((preference) => preference.id);
	const appealIds = (await prisma.roomRequestAppeal.findMany({
		where: { schoolId, schoolYearId },
		select: { id: true },
	})).map((appeal) => appeal.id);

	const [
		sectionMirrors,
		facultyPreferences,
		preferenceTimeSlots,
		preferenceReviews,
		facultyRoomPreferences,
		roomRequestAppeals,
		roomRequestAppealHistory,
		schedulingPolicies,
		manualScheduleEdits,
		followUpFlags,
		publishedScheduleRevisions,
		auditLogs,
		lockedSessions,
		lockedSessionActions,
		gradeShiftWindows,
		facultySnapshots,
		sectionSnapshots,
		instructionalCohorts,
		teachingLoadFacultySubjects,
		teachingLoadOwnerships,
	] = await Promise.all([
		prisma.sectionMirror.count({ where: { schoolId, schoolYearId } }),
		prisma.facultyPreference.count({ where: { schoolId, schoolYearId } }),
		preferenceIds.length > 0
			? prisma.preferenceTimeSlot.count({ where: { preferenceId: { in: preferenceIds } } })
			: Promise.resolve(0),
		preferenceIds.length > 0
			? prisma.preferenceReview.count({ where: { preferenceId: { in: preferenceIds } } })
			: Promise.resolve(0),
		prisma.facultyRoomPreference.count({ where: { schoolId, schoolYearId } }),
		prisma.roomRequestAppeal.count({ where: { schoolId, schoolYearId } }),
		appealIds.length > 0
			? prisma.roomRequestAppealHistory.count({ where: { appealId: { in: appealIds } } })
			: Promise.resolve(0),
		prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId } }),
		generationRunIds.length > 0
			? prisma.manualScheduleEdit.count({ where: { schoolId, schoolYearId, runId: { in: generationRunIds } } })
			: prisma.manualScheduleEdit.count({ where: { schoolId, schoolYearId } }),
		generationRunIds.length > 0
			? prisma.followUpFlag.count({ where: { runId: { in: generationRunIds } } })
			: Promise.resolve(0),
		prisma.publishedScheduleRevision.count({ where: { schoolId, schoolYearId } }),
		prisma.auditLog.count({ where: { schoolId, schoolYearId } }),
		prisma.lockedSession.count({ where: { schoolId, schoolYearId } }),
		prisma.lockedSessionAction.count({ where: { schoolId, schoolYearId } }),
		prisma.gradeShiftWindow.count({ where: { schoolId, schoolYearId } }),
		prisma.facultySnapshot.count({ where: { schoolId, schoolYearId } }),
		prisma.sectionSnapshot.count({ where: { schoolId, schoolYearId } }),
		prisma.instructionalCohort.count({ where: { schoolId, schoolYearId } }),
		prisma.facultySubject.count({ where: { schoolId, schoolYearId } }),
		prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId } }),
	]);

	return {
		sectionMirrors,
		facultyPreferences,
		preferenceTimeSlots,
		preferenceReviews,
		facultyRoomPreferences,
		roomRequestAppeals,
		roomRequestAppealHistory,
		schedulingPolicies,
		generationRuns: generationRuns.length,
		publishedGenerationRuns: generationRuns.filter((run) => isPublishedRunSummary(run.summary)).length,
		manualScheduleEdits,
		followUpFlags,
		publishedScheduleRevisions,
		auditLogs,
		lockedSessions,
		lockedSessionActions,
		gradeShiftWindows,
		facultySnapshots,
		sectionSnapshots,
		instructionalCohorts,
		teachingLoadFacultySubjects,
		teachingLoadOwnerships,
	};
}

function hasAnyDummyRows(counts: RolloverDummyYearRecordCounts): boolean {
	return Object.values(counts).some((value) => value > 0);
}

async function buildDummyYearResetPreview(
	schoolId: number,
	status: Pick<RolloverStatusResult, 'drift' | 'enrollProActiveYear'>,
): Promise<RolloverDummyYearResetPreview> {
	const targetSchoolYearId = status.enrollProActiveYear?.id ?? null;
	if (!targetSchoolYearId) {
		return {
			targetSchoolYearId,
			confirmationText: DUMMY_YEAR_RESET_CONFIRMATION_TEXT,
			canResetDummyYear: false,
			publishedResetBlocked: false,
			teachingLoadResetRequired: false,
			counts: emptyDummyYearCounts(),
			blockers: [{
				code: 'ENROLLPRO_UNAVAILABLE',
				message: 'EnrollPro active school year must be reachable before dummy data can be reset.',
			}],
		};
	}

	const counts = await countDummyYearRecords(schoolId, targetSchoolYearId);
	const blockers: RolloverConflict[] = [];
	if (counts.publishedGenerationRuns > 0 || counts.publishedScheduleRevisions > 0) {
		blockers.push({
			code: 'PUBLISHED_YEAR_RESET_BLOCKED',
			message: 'This school year has published schedule artifacts. ATLAS will not reset it through the dummy cleanup path.',
			details: {
				publishedGenerationRuns: counts.publishedGenerationRuns,
				publishedScheduleRevisions: counts.publishedScheduleRevisions,
			},
		});
	}
	if (status.drift.status !== 'mapping-conflict') {
		blockers.push({
			code: 'RESET_NOT_REQUIRED',
			message: 'ATLAS does not currently report a mapping conflict for the EnrollPro active school year.',
		});
	}

	return {
		targetSchoolYearId,
		confirmationText: DUMMY_YEAR_RESET_CONFIRMATION_TEXT,
		canResetDummyYear: blockers.length === 0 && hasAnyDummyRows(counts),
		publishedResetBlocked: counts.publishedGenerationRuns > 0 || counts.publishedScheduleRevisions > 0,
		teachingLoadResetRequired: counts.teachingLoadFacultySubjects > 0 || counts.teachingLoadOwnerships > 0,
		counts,
		blockers,
	};
}

export function getTestDataRecoveryConfirmation(schoolYearId: number | null): string {
	return Number.isInteger(schoolYearId) && schoolYearId! > 0
		? `CLEAR_TEST_DATA_AND_SYNC_${schoolYearId}`
		: 'CLEAR_TEST_DATA_AND_SYNC_UNAVAILABLE';
}

export async function classifyRecoveryState(
	schoolId: number,
	status: RolloverStatusResult,
): Promise<RecoveryClassifierResult> {
	const base: Omit<RecoveryClassifierResult, 'classification' | 'message' | 'canClearTestData'> = {
		schoolId,
		enrollProActiveYear: status.enrollProActiveYear,
		atlasSchoolYearId: status.atlasSchoolYearId,
		conflictCode: status.conflicts[0]?.code ?? null,
		artifactCounts: status.conflictingRecordCounts ?? null,
		blockers: [],
		confirmationText: getTestDataRecoveryConfirmation(status.enrollProActiveYear?.id ?? null),
		testDataMarked: status.testDataMarked,
	};

	if (status.drift.status === 'enrollpro-unreachable') {
		return {
			...base,
			classification: 'ENROLLPRO_UNREACHABLE',
			message: 'EnrollPro is unreachable. Cannot determine the active school year or perform any recovery.',
			canClearTestData: false,
		};
	}

	if (status.reconfiguredSections.length > 0) {
		return {
			...base,
			classification: 'MANUAL_RECONFIGURE_REQUIRED',
			message: `${status.reconfiguredSections.length} section(s) were renamed, re-graded, or re-programmed. Review and acknowledge the changes before syncing.`,
			canClearTestData: false,
		};
	}

	if (status.drift.status === 'aligned') {
		return {
			...base,
			classification: 'AUTO_ROLLOVER_READY',
			message: 'ATLAS is aligned with EnrollPro. No action needed.',
			canClearTestData: false,
		};
	}

	if (status.drift.status === 'mapping-conflict') {
		const hasSectionCollision = status.conflicts.some((c) => c.code === 'SECTION_ID_COLLISION');
		if (hasSectionCollision) {
			const counts = status.conflictingRecordCounts;
			const blockers: RolloverConflict[] = [];

			if (status.publishedResetBlocked) {
				blockers.push({
					code: 'PUBLISHED_DATA_BLOCKED',
					message: 'Published schedule artifacts exist for this school year. Test-data cleanup requires explicit acknowledgement.',
				});
			}

			const canClear = status.testDataMarked === true
				&& status.enrollProActiveYear != null
				&& counts != null
				&& (counts.sectionMirrors > 0 || counts.generationRuns > 0 || counts.schedulingPolicies > 0);

			return {
				...base,
				classification: canClear ? 'TEST_DATA_RECOVERY_AVAILABLE' : 'TEST_DATA_RECOVERY_BLOCKED',
				message: canClear
					? `ATLAS has existing data for school year #${status.enrollProActiveYear!.id} that does not match the current EnrollPro feed. This may be leftover test data. You can clear it and re-sync from EnrollPro.`
					: status.testDataMarked
						? 'ATLAS has a marked test-data collision, but no clearable ATLAS-owned artifacts were found.'
						: 'ATLAS has a section ID collision. Mark this school year as test data before recovery can be offered.',
				blockers,
				canClearTestData: canClear,
			};
		}

		// RR-09A: a label-only mismatch is archive-resolvable — the old year
		// can be archived (history preserved) and the label reconciled without
		// deleting anything. Section collisions above stay on the manual
		// marked-test-data path.
		if (isArchiveResolvableConflict(status.conflicts.map((conflict) => conflict.code))) {
			return {
				...base,
				classification: 'ARCHIVE_AND_SYNC_AVAILABLE',
				message: 'EnrollPro moved to a new school year. Archive the old school year and sync the new one. History is preserved.',
				canClearTestData: false,
			};
		}

		return {
			...base,
			classification: 'MANUAL_MAPPING_CONFLICT_REQUIRED',
			message: 'ATLAS has a mapping conflict that requires manual review. This is not a test-data collision.',
			canClearTestData: false,
		};
	}

	if (status.drift.status === 'atlas-stale' && status.conflicts.length === 0) {
		return {
			...base,
			classification: 'AUTO_ROLLOVER_READY',
			message: 'EnrollPro has a newer active school year. Automatic rollover sync is ready to apply.',
			canClearTestData: false,
		};
	}

	return {
		...base,
		classification: 'MANUAL_MAPPING_CONFLICT_REQUIRED',
		message: 'Rollover requires manual review.',
		canClearTestData: false,
	};
}

export async function getRolloverStatus(
	schoolId: number,
	authToken?: string,
	options?: { includeCounts?: boolean; atlasSchoolYearId?: number | null },
): Promise<RolloverStatusResult> {
	const atlasSchoolYearId = options?.atlasSchoolYearId ?? await getLatestAtlasSchoolYearId(schoolId);

	const health = await fetchEnrollProIntegrationHealth(authToken);
	if (!health.reachable) {
		const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
		});
		const drift: ActiveYearDriftState = {
			status: 'enrollpro-unreachable',
			message: `EnrollPro integration health check failed (${health.message ?? `HTTP ${health.statusCode}`}). ATLAS will keep using saved setup data.`,
			recommendedAction: 'RETRY_ENROLLPRO',
			atlasSchoolYearId,
			enrollProSchoolYearId: null,
			enrollProSchoolYearLabel: null,
			mirrorSyncedAt: mirror?.lastSyncedAt?.toISOString() ?? null,
		};
		return {
			schoolId,
			atlasSchoolYearId,
			enrollProActiveYear: null,
			drift,
			mirror: mirror ? {
				enrollProSchoolYearId: mirror.enrollProSchoolYearId,
				yearLabel: mirror.yearLabel,
				isActive: mirror.isActive,
				lastVerifiedAt: mirror.lastVerifiedAt?.toISOString() ?? null,
				lastSyncedAt: mirror.lastSyncedAt?.toISOString() ?? null,
				facultyCount: mirror.facultyCount,
				sectionCount: mirror.sectionCount,
				syncStatus: mirror.syncStatus,
				lastFailureSummary: mirror.lastFailureSummary,
			} : null,
			conflicts: [],
			reconfiguredSections: [],
			canResetDummyYear: false,
			resetTargetSchoolYearId: null,
			conflictingRecordCounts: null,
			teachingLoadResetRequired: false,
			publishedResetBlocked: false,
			testDataMarked: false,
			archivedYears: await listArchivedYears(schoolId, false),
		};
	}

	const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
	const mirror = upstreamYear
		? await prisma.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
		})
		: null;

	let counts: RolloverFeedCounts | undefined;
	let conflicts: RolloverConflict[] = [];
	let reconfiguredSections: ReconfiguredSection[] = [];
	let publishedResetBlocked = false;
	if (upstreamYear && options?.includeCounts) {
		const feedCounts = await fetchRolloverCounts(authToken);
		counts = {
			facultyCount: feedCounts.facultyCount,
			sectionCount: feedCounts.sectionCount,
			settingsReachable: feedCounts.settingsReachable,
		};
		conflicts = await findMappingConflicts(schoolId, upstreamYear, feedCounts.sectionExternalIds);

		if (conflicts.length === 0 && feedCounts.sectionRows.length > 0) {
			const upstreamSections = feedCounts.sectionRows
				.map((row) => {
					const r = row as Record<string, unknown>;
					const grade = r.gradeLevel as Record<string, unknown> | undefined;
					const id = Number(r.id);
					const name = String(r.name ?? '');
					const gradeLevelId = Number(grade?.id ?? grade?.displayOrder ?? 0);
					const rawProgramType = String(r.programType ?? '');
					if (!id || !name || !gradeLevelId || !rawProgramType) return null;
					const normalized = normalizeProgramMetadata(rawProgramType);
					return { id, name, gradeLevelId, programType: normalized.programType as string };
				})
				.filter((s): s is { id: number; name: string; gradeLevelId: number; programType: string } => s !== null);
			reconfiguredSections = await detectReconfiguredSections(schoolId, upstreamYear.id, upstreamSections);
		}
	} else if (upstreamYear) {
		conflicts = await findMappingConflicts(schoolId, upstreamYear);
	}

	if (upstreamYear && conflicts.length > 0) {
		const previewCounts = await countDummyYearRecords(schoolId, upstreamYear.id);
		publishedResetBlocked = previewCounts.publishedGenerationRuns > 0 || previewCounts.publishedScheduleRevisions > 0;
	}

	const drift = buildDriftState({
		atlasSchoolYearId,
		upstreamYear,
		upstreamReachable: !!upstreamYear,
		hasMappingConflict: conflicts.length > 0,
		conflictCodes: conflicts.map((conflict) => conflict.code),
		publishedResetBlocked,
		mirrorSyncedAt: mirror?.lastSyncedAt ?? null,
	});
	const resetPreview = await buildDummyYearResetPreview(schoolId, { drift, enrollProActiveYear: upstreamYear });

	return {
		schoolId,
		atlasSchoolYearId,
		enrollProActiveYear: upstreamYear,
		drift,
		mirror: mirror ? {
			enrollProSchoolYearId: mirror.enrollProSchoolYearId,
			yearLabel: mirror.yearLabel,
			isActive: mirror.isActive,
			lastVerifiedAt: mirror.lastVerifiedAt?.toISOString() ?? null,
			lastSyncedAt: mirror.lastSyncedAt?.toISOString() ?? null,
			facultyCount: mirror.facultyCount,
			sectionCount: mirror.sectionCount,
			syncStatus: mirror.syncStatus,
			lastFailureSummary: mirror.lastFailureSummary,
		} : null,
		testDataMarked: mirror?.lastSyncMetadata != null
			&& typeof mirror.lastSyncMetadata === 'object'
			&& (mirror.lastSyncMetadata as Record<string, unknown>).testDataMarked === true,
		...(counts ? { counts } : {}),
		conflicts,
		reconfiguredSections,
		canResetDummyYear: resetPreview.canResetDummyYear,
		resetTargetSchoolYearId: resetPreview.targetSchoolYearId,
		conflictingRecordCounts: resetPreview.counts,
		teachingLoadResetRequired: resetPreview.teachingLoadResetRequired,
		publishedResetBlocked: resetPreview.publishedResetBlocked,
		archivedYears: await listArchivedYears(schoolId, false),
	};
}

export async function previewRolloverSync(schoolId: number, authToken?: string): Promise<RolloverStatusResult> {
	return getRolloverStatus(schoolId, authToken, { includeCounts: true });
}

/**
 * Reconcile a stale ATLAS year-mirror label to upstream truth.
 *
 * The mirror label is ATLAS-owned metadata (EnrollPro is never written to),
 * so correcting it is safe and dissolves `YEAR_LABEL_MISMATCH` without
 * deleting history. Used by the hardened dummy-year reset (RR-08) so its
 * apply phase can complete, and by archive-and-sync (RR-09A).
 * Returns true when a label was corrected.
 */
export async function reconcileActiveYearMirrorLabel(
	schoolId: number,
	upstreamYear: EnrollProYearInfo,
): Promise<boolean> {
	const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
		select: { id: true, yearLabel: true },
	});
	if (!mirror || mirror.yearLabel === upstreamYear.yearLabel) {
		return false;
	}
	await prisma.enrollProSchoolYearMirror.update({
		where: { id: mirror.id },
		data: { yearLabel: upstreamYear.yearLabel },
	});
	return true;
}

// ─── RR-09A: School-year archive lifecycle ───

export type ArchivedYearPreservedCounts = {
	sectionMirrors: number;
	generationRuns: number;
	publishedGenerationRuns: number;
	publishedScheduleRevisions: number;
	schedulingPolicies: number;
	facultySnapshots: number;
	sectionSnapshots: number;
	teachingLoadFacultySubjects: number;
	teachingLoadOwnerships: number;
};

export type ArchiveSchoolYearInput = {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	reason?: string;
	authToken?: string;
	initiatedBy?: 'user' | 'system';
	/** Suppress the per-year notification when a combined flow notifies once. */
	suppressNotification?: boolean;
};

export type ArchiveSchoolYearResult = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	alreadyArchived: boolean;
	archivedAt: string;
	preservedCounts: ArchivedYearPreservedCounts;
};

async function collectPreservedCounts(schoolId: number, schoolYearId: number): Promise<ArchivedYearPreservedCounts> {
	const counts = await countDummyYearRecords(schoolId, schoolYearId);
	return {
		sectionMirrors: counts.sectionMirrors,
		generationRuns: counts.generationRuns,
		publishedGenerationRuns: counts.publishedGenerationRuns,
		publishedScheduleRevisions: counts.publishedScheduleRevisions,
		schedulingPolicies: counts.schedulingPolicies,
		facultySnapshots: counts.facultySnapshots,
		sectionSnapshots: counts.sectionSnapshots,
		teachingLoadFacultySubjects: counts.teachingLoadFacultySubjects,
		teachingLoadOwnerships: counts.teachingLoadOwnerships,
	};
}

async function listArchivedYears(schoolId: number, withCounts: boolean): Promise<ArchivedYearSummary[]> {
	const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isArchived: true },
		orderBy: { archivedAt: 'desc' },
		select: {
			enrollProSchoolYearId: true,
			yearLabel: true,
			archivedAt: true,
			archivedBy: true,
			archiveReason: true,
		},
	});
	return Promise.all(mirrors.map(async (mirror) => ({
		enrollProSchoolYearId: mirror.enrollProSchoolYearId,
		yearLabel: mirror.yearLabel,
		archivedAt: mirror.archivedAt?.toISOString() ?? null,
		archivedBy: mirror.archivedBy,
		archiveReason: mirror.archiveReason,
		preservedCounts: withCounts
			? await collectPreservedCounts(schoolId, mirror.enrollProSchoolYearId)
			: null,
	})));
}

/**
 * Archive a school year — NON-DESTRUCTIVE by design.
 *
 * Deactivates the year mirror and marks it archived while preserving every
 * row under the year as read-only history. Refuses to archive the EnrollPro
 * ACTIVE year (that is the new year, not history). Deletes NOTHING.
 */
export async function archiveSchoolYear(input: ArchiveSchoolYearInput): Promise<ArchiveSchoolYearResult> {
	const health = await fetchEnrollProIntegrationHealth(input.authToken);
	if (!health.reachable) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro is unreachable. Cannot verify which year is active, so nothing was archived.', {
			actionHint: 'Wait for EnrollPro to become reachable, then archive again.',
		});
	}
	const activeYear = await fetchEnrollProActiveSchoolYear(input.authToken);
	if (!activeYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Nothing was archived.', {
			actionHint: 'Wait for EnrollPro to become reachable, then archive again.',
		});
	}
	if (activeYear.id === input.schoolYearId) {
		throw serviceError(409, 'CANNOT_ARCHIVE_ACTIVE_YEAR', `School year #${input.schoolYearId} is EnrollPro's active year (${activeYear.yearLabel}) and cannot be archived.`, {
			actionHint: 'Archive superseded years only; the active year is the new one.',
		});
	}

	const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId: input.schoolId, enrollProSchoolYearId: input.schoolYearId } },
	});
	if (!mirror) {
		throw serviceError(404, 'SCHOOL_YEAR_MIRROR_NOT_FOUND', `No ATLAS mirror exists for school year #${input.schoolYearId}. Nothing to archive.`, {
			actionHint: 'Run a rollover sync first so ATLAS mirrors the year.',
		});
	}

	if (mirror.isArchived) {
		// Idempotent: an already-archived year keeps its original timestamps.
		const preservedCounts = await collectPreservedCounts(input.schoolId, input.schoolYearId);
		return {
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			yearLabel: mirror.yearLabel,
			alreadyArchived: true,
			archivedAt: mirror.archivedAt?.toISOString() ?? new Date().toISOString(),
			preservedCounts,
		};
	}

	const preservedCounts = await collectPreservedCounts(input.schoolId, input.schoolYearId);
	const archivedAt = new Date();
	await prisma.$transaction(async (tx) => {
		await tx.enrollProSchoolYearMirror.update({
			where: { id: mirror.id },
			data: {
				isActive: false,
				isArchived: true,
				archivedAt,
				archivedBy: input.actorId,
				archiveReason: input.reason ?? `Superseded by EnrollPro rollover to ${activeYear.yearLabel}`,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'ARCHIVE_SCHOOL_YEAR',
				actorId: input.actorId,
				targetIds: [input.schoolYearId],
				metadata: {
					source: 'enrollpro-rollover',
					initiatedBy: input.initiatedBy ?? 'user',
					yearLabel: mirror.yearLabel,
					archiveReason: input.reason ?? `Superseded by EnrollPro rollover to ${activeYear.yearLabel}`,
					// Non-destruction proof: these rows must still exist after archiving.
					preservedCounts,
					enrollProActiveYear: activeYear,
				},
			},
		});
	});

	if (!input.suppressNotification) {
		publishNotificationEvent({
			type: 'SCHOOL_YEAR_ARCHIVED',
			domain: 'integration',
			severity: 'info',
			audience: 'PRIVILEGED',
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			facultyId: null,
			message: `School year ${mirror.yearLabel} (#${input.schoolYearId}) was archived. All history is preserved and read-only.`,
			metadata: {
				archivedYearId: input.schoolYearId,
				yearLabel: mirror.yearLabel,
				preservedCounts,
				initiatedBy: input.initiatedBy ?? 'user',
			},
		});
	}

	return {
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		yearLabel: mirror.yearLabel,
		alreadyArchived: false,
		archivedAt: archivedAt.toISOString(),
		preservedCounts,
	};
}

export type ArchiveAndSyncInput = {
	schoolId: number;
	actorId: number;
	authToken?: string;
	reason?: string;
	initiatedBy?: 'user' | 'system';
	acknowledgeReconfiguredSectionIds?: number[];
	/** Test seam: replaces the standard apply (same signature). */
	applyRolloverSyncImpl?: typeof applyRolloverSync;
	/** Test seam: replaces the direct notification publish. */
	publishNotificationImpl?: typeof publishNotificationEvent;
};

export type ArchiveAndSyncResult = {
	schoolId: number;
	enrollProActiveYear: EnrollProYearInfo;
	archivedYears: Array<ArchiveSchoolYearResult>;
	labelReconciled: boolean;
	sync: RolloverApplyResult;
};

/**
 * RR-09A rollover resolution flow — the non-destructive alternative to the
 * dummy-year reset:
 *   1. archive every ATLAS year mirror that is not archived and not the
 *      EnrollPro active year (the superseded years — history preserved);
 *   2. reconcile a stale label on the EnrollPro active year's mirror
 *      (ATLAS-owned metadata — dissolves YEAR_LABEL_MISMATCH);
 *   3. run the standard applyRolloverSync (faculty reconcile + section
 *      upsert + policy bootstrap + mirror activation).
 * Safe to re-run: archiving is idempotent, reconciliation is idempotent, and
 * the apply upserts. EnrollPro is never written to.
 */
export async function archiveAndSyncActiveYear(input: ArchiveAndSyncInput): Promise<ArchiveAndSyncResult> {
	const preview = await previewRolloverSync(input.schoolId, input.authToken);
	if (!preview.enrollProActiveYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Archive-and-sync was not applied.', {
			actionHint: 'Wait for EnrollPro to become reachable, then try again.',
		});
	}
	const activeYear = preview.enrollProActiveYear;

	const toArchive = await prisma.enrollProSchoolYearMirror.findMany({
		where: {
			schoolId: input.schoolId,
			isArchived: false,
			enrollProSchoolYearId: { not: activeYear.id },
		},
		orderBy: { enrollProSchoolYearId: 'asc' },
		select: { enrollProSchoolYearId: true },
	});

	const archivedYears: ArchiveSchoolYearResult[] = [];
	for (const candidate of toArchive) {
		archivedYears.push(await archiveSchoolYear({
			schoolId: input.schoolId,
			schoolYearId: candidate.enrollProSchoolYearId,
			actorId: input.actorId,
			authToken: input.authToken,
			reason: input.reason ?? `Superseded by EnrollPro rollover to ${activeYear.yearLabel}`,
			initiatedBy: input.initiatedBy,
			suppressNotification: true,
		}));
	}

	const labelReconciled = await reconcileActiveYearMirrorLabel(input.schoolId, activeYear);
	// Recovery guard: the EnrollPro active year must never stay archived.
	await prisma.enrollProSchoolYearMirror.updateMany({
		where: { schoolId: input.schoolId, enrollProSchoolYearId: activeYear.id, isArchived: true },
		data: { isArchived: false, archivedAt: null, archivedBy: null, archiveReason: null },
	});

	const sync = await (input.applyRolloverSyncImpl ?? applyRolloverSync)(input.schoolId, input.authToken, {
		actorId: input.actorId,
		initiatedBy: input.initiatedBy,
		acknowledgeReconfiguredSectionIds: input.acknowledgeReconfiguredSectionIds,
	});

	await prisma.auditLog.create({
		data: {
			schoolId: input.schoolId,
			schoolYearId: activeYear.id,
			action: 'ARCHIVE_AND_SYNC_APPLIED',
			actorId: input.actorId,
			targetIds: [activeYear.id, ...archivedYears.map((year) => year.schoolYearId)],
			metadata: {
				source: 'enrollpro-rollover',
				initiatedBy: input.initiatedBy ?? 'user',
				enrollProActiveYear: activeYear,
				archivedYears: archivedYears.map((year) => ({
					schoolYearId: year.schoolYearId,
					yearLabel: year.yearLabel,
					alreadyArchived: year.alreadyArchived,
					preservedCounts: year.preservedCounts,
				})),
				labelReconciled,
				syncEvidence: {
					sectionCount: sync.sync.sections?.count ?? null,
					facultyActiveCount: sync.sync.faculty?.activeCount ?? null,
					policyReady: sync.sync.policyReady,
				},
			},
		},
	});

	const publish = input.publishNotificationImpl ?? publishNotificationEvent;
	publish({
		type: 'ROLLOVER_ARCHIVE_SYNC_COMPLETED',
		domain: 'integration',
		severity: 'success',
		audience: 'PRIVILEGED',
		schoolId: input.schoolId,
		schoolYearId: activeYear.id,
		facultyId: null,
		message: archivedYears.length > 0
			? `School year rolled over: archived ${archivedYears.map((year) => year.yearLabel).join(', ')}, synced ${activeYear.yearLabel}. No action needed.`
			: `School year ${activeYear.yearLabel} is active and synced. No action needed.`,
		metadata: {
			archivedYears: archivedYears.map((year) => ({ schoolYearId: year.schoolYearId, yearLabel: year.yearLabel })),
			enrollProActiveYear: activeYear,
			labelReconciled,
			initiatedBy: input.initiatedBy ?? 'user',
		},
	});

	return {
		schoolId: input.schoolId,
		enrollProActiveYear: activeYear,
		archivedYears,
		labelReconciled,
		sync,
	};
}

export type ArchiveAndSyncPreview = {
	schoolId: number;
	enrollProActiveYear: EnrollProYearInfo | null;
	atlasSchoolYearId: number | null;
	drift: ActiveYearDriftState;
	yearsToArchive: Array<{
		schoolYearId: number;
		yearLabel: string;
		preservedCounts: ArchivedYearPreservedCounts;
	}>;
	labelReconcileRequired: boolean;
	syncPlan: string;
	summary: string;
};

/** Read-only preview of what archive-and-sync would do. */
export async function previewArchiveAndSync(
	schoolId: number,
	authToken?: string,
): Promise<ArchiveAndSyncPreview> {
	const status = await getRolloverStatus(schoolId, authToken, { includeCounts: true });
	if (!status.enrollProActiveYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Preview is unavailable.', {
			actionHint: 'Wait for EnrollPro to become reachable, then preview again.',
		});
	}
	const activeYear = status.enrollProActiveYear;

	const candidates = await prisma.enrollProSchoolYearMirror.findMany({
		where: {
			schoolId,
			isArchived: false,
			enrollProSchoolYearId: { not: activeYear.id },
		},
		orderBy: { enrollProSchoolYearId: 'asc' },
		select: { enrollProSchoolYearId: true, yearLabel: true },
	});

	const yearsToArchive = [];
	for (const candidate of candidates) {
		yearsToArchive.push({
			schoolYearId: candidate.enrollProSchoolYearId,
			yearLabel: candidate.yearLabel,
			preservedCounts: await collectPreservedCounts(schoolId, candidate.enrollProSchoolYearId),
		});
	}

	const activeMirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
		select: { yearLabel: true },
	});
	const labelReconcileRequired = activeMirror != null && activeMirror.yearLabel !== activeYear.yearLabel;

	const archivedList = yearsToArchive.map((year) => `${year.yearLabel} (#${year.schoolYearId})`).join(', ');
	const summary = yearsToArchive.length > 0
		? `Archive ${archivedList} as read-only history${labelReconcileRequired ? ', correct the ATLAS year label' : ''}, then sync ${activeYear.yearLabel} from EnrollPro. Nothing is deleted.`
		: `Sync ${activeYear.yearLabel} from EnrollPro${labelReconcileRequired ? ' after correcting the ATLAS year label' : ''}. Nothing is deleted.`;

	return {
		schoolId,
		enrollProActiveYear: activeYear,
		atlasSchoolYearId: status.atlasSchoolYearId,
		drift: status.drift,
		yearsToArchive,
		labelReconcileRequired,
		syncPlan: `Faculty reconcile, section upsert, policy bootstrap, and mirror activation for ${activeYear.yearLabel}.`,
		summary,
	};
}

export async function applyRolloverSync(
	schoolId: number,
	authToken?: string,
	options?: { facultyMode?: FacultySyncMode; actorId?: number; acknowledgeReconfiguredSectionIds?: number[]; initiatedBy?: 'user' | 'system' },
): Promise<RolloverApplyResult> {
	const startedAt = Date.now();
	const preview = await previewRolloverSync(schoolId, authToken);
	if (!preview.enrollProActiveYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Try again when EnrollPro is reachable.', {
			actionHint: 'Check EnrollPro connection, then run rollover sync again.',
		});
	}
	if (preview.conflicts.length > 0) {
		throw serviceError(409, 'SCHOOL_YEAR_MAPPING_CONFLICT', 'ATLAS found existing data that conflicts with the EnrollPro active school year.', {
			actionHint: 'Review the migration conflict before syncing EnrollPro into ATLAS.',
			details: { conflicts: preview.conflicts },
		});
	}

	const acknowledgedIds = new Set(options?.acknowledgeReconfiguredSectionIds ?? []);
	const unacknowledged = preview.reconfiguredSections.filter((s) => !acknowledgedIds.has(s.externalId));
	if (unacknowledged.length > 0) {
		throw serviceError(409, 'SECTION_RECONFIGURATION_REVIEW_REQUIRED', `${unacknowledged.length} section(s) were renamed, re-graded, or re-programmed since the last sync. Review and acknowledge the changes before syncing.`, {
			actionHint: 'Preview the rollover, review the reconfigured sections, then apply with the acknowledged section IDs.',
			details: {
				unacknowledgedSections: unacknowledged.map((s) => ({
					externalId: s.externalId,
					sectionName: s.sectionName,
					previousName: s.previousName,
					previousGradeLevelId: s.previousGradeLevelId,
					previousProgramType: s.previousProgramType,
					newName: s.newName,
					newGradeLevelId: s.newGradeLevelId,
					newProgramType: s.newProgramType,
				})),
			},
		});
	}

	const activeYear = preview.enrollProActiveYear;
	let facultySync: Awaited<ReturnType<typeof syncFacultyFromExternal>> | null = null;
	let sectionSync: Awaited<ReturnType<typeof syncSectionsFromExternal>> | null = null;
	let canonicalTemplatesSeeded = 0;
	let failedPhase: string | null = null;
	try {
		facultySync = await syncFacultyFromExternal(schoolId, activeYear.id, authToken, {
			mode: options?.facultyMode ?? 'reconcile',
			pruneSectionAssignments: false,
			invalidateRuns: false,
			seedAssignments: false,
			syncAdvisoryAssignments: false,
		});
		sectionSync = await syncSectionsFromExternal(schoolId, activeYear.id, authToken);
		const completedFacultySync = facultySync;
		const completedSectionSync = sectionSync;
		failedPhase = 'policy';
		await getOrCreatePolicy(schoolId, activeYear.id);
		failedPhase = 'canonical-templates';
		const canonicalTemplateSync = await ensureCanonicalClassProgramSlots(schoolId, activeYear.id);
		canonicalTemplatesSeeded = canonicalTemplateSync.seeded;

		failedPhase = 'mirror-commit';
		const syncedAt = new Date();
		const completedAt = Date.now();
		await prisma.$transaction(async (tx) => {
			await tx.enrollProSchoolYearMirror.updateMany({
				where: { schoolId, isActive: true, enrollProSchoolYearId: { not: activeYear.id } },
				data: { isActive: false },
			});
			await tx.enrollProSchoolYearMirror.upsert({
				where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
				update: {
					yearLabel: activeYear.yearLabel,
					isActive: true,
					lastVerifiedAt: syncedAt,
					lastSyncedAt: syncedAt,
					sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
					facultyCount: completedFacultySync.activeCount,
					sectionCount: completedSectionSync.count,
					syncStatus: 'setup-review-required',
					lastFailureSummary: null,
					lastSyncMetadata: {
						sectionsRemovedForSameYear: completedSectionSync.removed,
						sectionSkippedCount: completedSectionSync.skipped,
						facultyStaleCount: completedFacultySync.staleCount,
						facultyDeactivatedCount: completedFacultySync.deactivatedCount,
						facultySkippedCount: completedFacultySync.reconciliation.skipped,
						settingsReachable: preview.counts?.settingsReachable ?? null,
						teachingLoadAutoCopied: false,
						sourceGeneratedAt: completedSectionSync.fetchedAt.toISOString(),
						completedAt: new Date(completedAt).toISOString(),
						durationMs: completedAt - startedAt,
						initiatedBy: options?.initiatedBy ?? 'user',
					},
				},
				create: {
					schoolId,
					enrollProSchoolYearId: activeYear.id,
					yearLabel: activeYear.yearLabel,
					isActive: true,
					lastVerifiedAt: syncedAt,
					lastSyncedAt: syncedAt,
					sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
					facultyCount: completedFacultySync.activeCount,
					sectionCount: completedSectionSync.count,
					syncStatus: 'setup-review-required',
					lastSyncMetadata: {
						sectionsRemovedForSameYear: completedSectionSync.removed,
						sectionSkippedCount: completedSectionSync.skipped,
						facultyStaleCount: completedFacultySync.staleCount,
						facultyDeactivatedCount: completedFacultySync.deactivatedCount,
						facultySkippedCount: completedFacultySync.reconciliation.skipped,
						settingsReachable: preview.counts?.settingsReachable ?? null,
						teachingLoadAutoCopied: false,
						sourceGeneratedAt: completedSectionSync.fetchedAt.toISOString(),
						completedAt: new Date(completedAt).toISOString(),
						durationMs: completedAt - startedAt,
						initiatedBy: options?.initiatedBy ?? 'user',
					},
				},
			});
			await tx.teachingLoadCycle.upsert({
				where: { schoolId_schoolYearId: { schoolId, schoolYearId: activeYear.id } },
				update: {},
				create: { schoolId, schoolYearId: activeYear.id, state: 'EMPTY' },
			});
		});

		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId: activeYear.id,
				action: 'ROLLOVER_SYNC_APPLIED',
				actorId: options?.actorId ?? 0,
				targetIds: [activeYear.id],
				metadata: {
					sectionCount: completedSectionSync.count,
					sectionSkippedCount: completedSectionSync.skipped,
					sectionRemovedCount: completedSectionSync.removed,
					facultyActiveCount: completedFacultySync.activeCount,
					facultySkippedCount: completedFacultySync.reconciliation.skipped,
					facultyStaleCount: completedFacultySync.staleCount,
					facultyDeactivatedCount: completedFacultySync.deactivatedCount,
					acknowledgedReconfiguredSectionIds: Array.from(acknowledgedIds),
					reconfiguredSectionCount: preview.reconfiguredSections.length,
					sourceGeneratedAt: completedSectionSync.fetchedAt.toISOString(),
					completedAt: new Date(completedAt).toISOString(),
					durationMs: completedAt - startedAt,
					initiatedBy: options?.initiatedBy ?? 'user',
				},
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const failedAt = Date.now();

		const existingMirror = await prisma.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
			select: { isActive: true },
		});
		const preserveActive = existingMirror?.isActive ?? false;

		await prisma.enrollProSchoolYearMirror.upsert({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: activeYear.id } },
			update: {
				yearLabel: activeYear.yearLabel,
				isActive: preserveActive,
				lastVerifiedAt: new Date(),
				sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
				syncStatus: 'failed',
				lastFailureSummary: message.slice(0, 500),
				lastSyncMetadata: {
					failedPhase,
					failedAt: new Date(failedAt).toISOString(),
					durationMs: failedAt - startedAt,
					initiatedBy: options?.initiatedBy ?? 'user',
				},
			},
			create: {
				schoolId,
				enrollProSchoolYearId: activeYear.id,
				yearLabel: activeYear.yearLabel,
				isActive: false,
				lastVerifiedAt: new Date(),
				sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
				syncStatus: 'failed',
				lastFailureSummary: message.slice(0, 500),
				lastSyncMetadata: {
					failedPhase,
					failedAt: new Date(failedAt).toISOString(),
					durationMs: failedAt - startedAt,
					initiatedBy: options?.initiatedBy ?? 'user',
				},
			},
		});

		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId: activeYear.id,
				action: 'ROLLOVER_SYNC_FAILED',
				actorId: options?.actorId ?? 0,
				targetIds: [activeYear.id],
				metadata: {
					failedPhase,
					errorMessage: message.slice(0, 500),
					sourceGeneratedAt: sectionSync?.fetchedAt?.toISOString() ?? null,
					failedAt: new Date(failedAt).toISOString(),
					durationMs: failedAt - startedAt,
					initiatedBy: options?.initiatedBy ?? 'user',
				},
			},
		});

		throw error;
	}

	const status = await getRolloverStatus(schoolId, authToken, {
		includeCounts: true,
		atlasSchoolYearId: activeYear.id,
	});
	return {
		...status,
		applied: true,
		sync: {
			faculty: facultySync,
			sections: sectionSync,
			policyReady: true,
			canonicalTemplatesSeeded,
		},
	};
}

export async function resetDummyYearAndApplyRollover(input: ResetDummyYearInput): Promise<RolloverDummyYearResetResult> {
	const preview = await previewRolloverSync(input.schoolId, input.authToken);
	const resetPreview = await buildDummyYearResetPreview(input.schoolId, preview);

	if (!input.confirmReset) {
		return {
			...preview,
			previewOnly: true,
			resetApplied: false,
			reset: resetPreview,
			rolloverApply: null,
		};
	}

	if (input.confirmationText !== DUMMY_YEAR_RESET_CONFIRMATION_TEXT) {
		throw serviceError(400, 'CONFIRMATION_REQUIRED', `confirmationText="${DUMMY_YEAR_RESET_CONFIRMATION_TEXT}" is required to reset dummy school-year data.`, {
			actionHint: 'Enter the exact confirmation phrase shown in the reset preview.',
		});
	}
	if (!preview.enrollProActiveYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Reset was not applied.', {
			actionHint: 'Check EnrollPro connection, then preview reset again.',
		});
	}
	if (resetPreview.publishedResetBlocked) {
		throw serviceError(409, 'PUBLISHED_YEAR_RESET_BLOCKED', 'This school year has published schedule artifacts and cannot be reset as dummy data.', {
			actionHint: 'Use a production migration path for published schedule history.',
			details: { counts: resetPreview.counts },
		});
	}

	const activeYearCheck = await fetchEnrollProActiveSchoolYear(input.authToken);
	if (!activeYearCheck) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Reset was not applied.', {
			actionHint: 'Check EnrollPro connection, then preview reset again.',
		});
	}
	if (activeYearCheck.id !== preview.enrollProActiveYear.id || activeYearCheck.yearLabel !== preview.enrollProActiveYear.yearLabel) {
		throw serviceError(409, 'ACTIVE_YEAR_CHANGED', 'EnrollPro active school year changed after preview. Reset was not applied.', {
			actionHint: 'Preview the rollover reset again before applying.',
			details: { previewYear: preview.enrollProActiveYear, currentYear: activeYearCheck },
		});
	}

	const schoolYearId = preview.enrollProActiveYear.id;

	// RR-08 resumability: if a prior reset for this same school year committed
	// its destructive clear phase but died before the EnrollPro apply, resume
	// directly at the apply instead of re-running (and re-auditing) the clear.
	// The destructive deletes are idempotent, but skipping them keeps the
	// original DUMMY_YEAR_RESET audit row (and its phase marker) intact so the
	// resume chain stays observable.
	const resumableMarker = await findResumableResetMarker(input.schoolId, schoolYearId);
	const resumeFromPriorClear = resumableMarker !== null;
	let markerAuditId: number;

	if (!resumeFromPriorClear) {
		if (!resetPreview.canResetDummyYear) {
			throw serviceError(409, 'RESET_NOT_AVAILABLE', 'Dummy-year reset is not available for the current rollover state.', {
				actionHint: 'Run rollover preview and review the current blockers.',
				details: { blockers: resetPreview.blockers, counts: resetPreview.counts },
			});
		}

		const markerAudit = await prisma.$transaction(async (tx) => {
			const generationRunIds = (await tx.generationRun.findMany({
				where: { schoolId: input.schoolId, schoolYearId },
				select: { id: true },
			})).map((run) => run.id);
			const preferenceIds = (await tx.facultyPreference.findMany({
				where: { schoolId: input.schoolId, schoolYearId },
				select: { id: true },
			})).map((preference) => preference.id);
			const appealIds = (await tx.roomRequestAppeal.findMany({
				where: { schoolId: input.schoolId, schoolYearId },
				select: { id: true },
			})).map((appeal) => appeal.id);

			if (appealIds.length > 0) {
				await tx.roomRequestAppealHistory.deleteMany({ where: { appealId: { in: appealIds } } });
			}
			await tx.roomRequestAppeal.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.facultyRoomPreference.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

			if (preferenceIds.length > 0) {
				await tx.preferenceReview.deleteMany({ where: { preferenceId: { in: preferenceIds } } });
				await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: { in: preferenceIds } } });
			}
			await tx.facultyPreference.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

			await tx.lockedSessionAction.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.lockedSession.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.gradeShiftWindow.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.facultySnapshot.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.sectionSnapshot.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.instructionalCohort.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.schedulingPolicy.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.sectionMirror.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

			await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.facultySubject.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			await tx.teachingLoadCycle.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

			await tx.auditLog.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			if (generationRunIds.length > 0) {
				await tx.manualScheduleEdit.deleteMany({ where: { schoolId: input.schoolId, schoolYearId, runId: { in: generationRunIds } } });
				await tx.followUpFlag.deleteMany({ where: { runId: { in: generationRunIds } } });
			} else {
				await tx.manualScheduleEdit.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
			}
			await tx.generationRun.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

			return tx.auditLog.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId,
					action: 'DUMMY_YEAR_RESET',
					actorId: input.actorId,
					targetIds: [schoolYearId],
					metadata: {
						source: 'enrollpro-rollover',
						deletedCounts: resetPreview.counts,
						teachingLoadReset: true,
						enrollProActiveYear: preview.enrollProActiveYear,
						// RR-08 phase marker: `cleared` commits with this
						// transaction; `syncApplied` flips only after the
						// EnrollPro apply below succeeds. A crash between the
						// two leaves a resumable marker.
						phases: { cleared: true, syncApplied: false, teachingLoadCleared: false },
					},
				},
				select: { id: true, metadata: true },
			});
		});
		markerAuditId = markerAudit.id;
	} else {
		markerAuditId = resumableMarker.auditId;
	}

	// The target year's mirror may carry a stale label (the RR-08 live wedge:
	// a crashed apply left `2026-2027` on the EnrollPro `2027-2028` year).
	// The mirror label is ATLAS-owned metadata, so correct it to upstream
	// truth before apply — otherwise applyRolloverSync's conflict gate would
	// refuse the sync and the reset could never complete for this wedge.
	await reconcileActiveYearMirrorLabel(input.schoolId, activeYearCheck);

	const rolloverApply = await applyRolloverSync(input.schoolId, input.authToken, { facultyMode: 'prune' });
	// The follow-up teaching-load clear stays school+year-scoped deleteMany
	// (idempotent, atomic per transaction). Its outcome is recorded in the
	// phase marker so a crash between apply and this transaction is
	// distinguishable.
	await prisma.$transaction([
		prisma.subjectSectionOwnership.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } }),
		prisma.facultySubject.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } }),
		prisma.teachingLoadCycle.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } }),
	]);
	await prisma.auditLog.update({
		where: { id: markerAuditId },
		data: {
			metadata: {
				source: 'enrollpro-rollover',
				phases: { cleared: true, syncApplied: true, teachingLoadCleared: true },
				resumePath: resumeFromPriorClear ? 'resumed-after-clear' : 'fresh',
				syncEvidence: {
					enrollProActiveYear: rolloverApply.enrollProActiveYear,
					sectionCount: rolloverApply.sync.sections?.count ?? null,
					facultyActiveCount: rolloverApply.sync.faculty?.activeCount ?? null,
				},
			},
		},
	});
	return {
		...rolloverApply,
		previewOnly: false,
		resetApplied: true,
		reset: resetPreview,
		rolloverApply,
		resumePath: resumeFromPriorClear ? 'resumed-after-clear' : 'fresh',
	};
}

export type TestYearRecoveryInput = {
	schoolId: number;
	actorId: number;
	authToken?: string;
	confirmClear?: boolean;
	confirmationText?: string;
	acknowledgePublished?: boolean;
	initiatedBy?: 'user' | 'system';
	/** Test-only fault injection: throws inside the cleanup transaction to prove atomic rollback. */
	failCleanupTxForTest?: boolean;
};

export type TestYearRecoveryResult = {
	preview: RecoveryClassifierResult;
	cleared: boolean;
	/**
	 * RR-15A: true ONLY when applyRolloverSync() executed inside this
	 * invocation. Fresh and resumed-after-clear runs report true;
	 * resumed-after-sync runs report false with `sync: null` because the
	 * synchronization already committed in an earlier invocation.
	 */
	syncExecuted: boolean;
	sync: RolloverApplyResult | null;
	previousActiveSchoolYearId: number | null;
	archivedYears: Array<ArchiveSchoolYearResult>;
	archiveFailed: boolean;
	archiveError?: string;
	partialSuccess: boolean;
	teachingLoadCycle: TeachingLoadCycleSource | null;
	/** RR-15 resumability: how this run completed the recovery lifecycle. */
	resumePath?: 'fresh' | 'resumed-after-clear' | 'resumed-after-sync';
};

/**
 * RR-15 phase marker for test-data recovery. The marker lives in the
 * TEST_YEAR_RECOVERY_CLEANUP audit row so a crash or failure between phases
 * leaves a durable, retryable record (same discipline as the DUMMY_YEAR_RESET
 * marker). Phases:
 *  - cleared: the destructive cleanup transaction committed;
 *  - syncApplied: applyRolloverSync committed (mirror activated, cycle created);
 *  - archivesApplied: every superseded year was archived (or none remained).
 */
type TestYearRecoveryMarker = {
	auditId: number;
	phases: { cleared: boolean; syncApplied: boolean; archivesApplied: boolean };
	previousActiveSchoolYearId: number | null;
	/** Cleanup artifact counts captured by the original destructive run. */
	artifactCounts: RolloverDummyYearRecordCounts | null;
};

async function findTestYearRecoveryMarker(
	schoolId: number,
	schoolYearId: number,
): Promise<TestYearRecoveryMarker | null> {
	const prior = await prisma.auditLog.findFirst({
		where: { schoolId, schoolYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
		orderBy: { id: 'desc' },
		select: { id: true, metadata: true },
	});
	if (!prior) return null;
	const metadata = (prior.metadata ?? {}) as Record<string, unknown>;
	const phases = metadata?.phases as { cleared?: boolean; syncApplied?: boolean; archivesApplied?: boolean } | undefined;
	if (!phases || typeof phases !== 'object' || phases.cleared !== true) return null;
	return {
		auditId: prior.id,
		phases: {
			cleared: phases.cleared === true,
			syncApplied: phases.syncApplied === true,
			archivesApplied: phases.archivesApplied === true,
		},
		previousActiveSchoolYearId: Number(metadata?.previousActiveSchoolYearId ?? 0) > 0
			? Number(metadata.previousActiveSchoolYearId)
			: null,
		artifactCounts: (metadata?.deletedCounts as RolloverDummyYearRecordCounts | undefined) ?? null,
	};
}

/**
 * RR-15A: archive-only completion markers. Automation inspects these BEFORE
 * the ordinary aligned-skip path so a recovery whose synchronization already
 * committed (marker cleared=true, syncApplied=true) but whose archival is
 * still pending (archivesApplied !== true) is completed without rerunning
 * destructive cleanup or synchronization.
 *
 * Safety: only markers for the school's own rows whose target year equals the
 * verified EnrollPro ACTIVE year qualify; cleared-only markers (sync never
 * committed) never qualify for archive-only retry.
 */
export type PendingArchiveRecoveryMarker = {
	auditId: number;
	schoolId: number;
	schoolYearId: number;
	phases: { cleared: boolean; syncApplied: boolean; archivesApplied: boolean };
	previousActiveSchoolYearId: number | null;
};

export async function findPendingArchiveRecoveryMarker(
	schoolId: number,
	activeEnrollProYearId?: number | null,
): Promise<PendingArchiveRecoveryMarker | null> {
	const candidates = await prisma.auditLog.findMany({
		where: { schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
		orderBy: { id: 'desc' },
		select: { id: true, schoolYearId: true, metadata: true },
	});
	for (const candidate of candidates) {
		const metadata = (candidate.metadata ?? {}) as Record<string, unknown>;
		const phases = metadata?.phases as { cleared?: boolean; syncApplied?: boolean; archivesApplied?: boolean } | undefined;
		if (!phases || typeof phases !== 'object') continue;
		if (phases.cleared !== true || phases.syncApplied !== true) continue;
		if (phases.archivesApplied === true) continue;
		if (candidate.schoolYearId == null) continue;
		if (activeEnrollProYearId != null && candidate.schoolYearId !== activeEnrollProYearId) continue;
		return {
			auditId: candidate.id,
			schoolId,
			schoolYearId: candidate.schoolYearId,
			phases: {
				cleared: true,
				syncApplied: true,
				archivesApplied: false,
			},
			previousActiveSchoolYearId: Number(metadata?.previousActiveSchoolYearId ?? 0) > 0
				? Number(metadata.previousActiveSchoolYearId)
				: null,
		};
	}
	return null;
}

async function updateTestYearRecoveryMarker(auditId: number, patch: Record<string, unknown>): Promise<void> {
	const current = await prisma.auditLog.findUnique({ where: { id: auditId }, select: { metadata: true } });
	const baseMetadata = (current?.metadata as unknown as Record<string, unknown> | null | undefined) ?? {};
	await prisma.auditLog.update({
		where: { id: auditId },
		data: {
			metadata: {
				...baseMetadata,
				...patch,
			} as unknown as Prisma.InputJsonValue,
		},
	});
}

/**
 * RR-15B: archive every non-archived superseded year after a successful
 * recovery sync, reusing the existing non-destructive `archiveSchoolYear()`.
 * Runs for all candidates even when one fails so the maximum amount of the
 * lifecycle completes; the caller reports partial success when any fail.
 */
async function archiveSupersededYearsForRecovery(
	schoolId: number,
	activeYear: { id: number; yearLabel: string },
	options: { actorId: number; initiatedBy: 'user' | 'system'; authToken?: string },
): Promise<{ archivedYears: Array<ArchiveSchoolYearResult>; failed: boolean; error?: string }> {
	const candidates = await prisma.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isArchived: false, enrollProSchoolYearId: { not: activeYear.id } },
		orderBy: { enrollProSchoolYearId: 'asc' },
		select: { enrollProSchoolYearId: true },
	});
	const archivedYears: Array<ArchiveSchoolYearResult> = [];
	let firstError: string | undefined;
	for (const candidate of candidates) {
		try {
			archivedYears.push(await archiveSchoolYear({
				schoolId,
				schoolYearId: candidate.enrollProSchoolYearId,
				actorId: options.actorId,
				authToken: options.authToken,
				reason: `Superseded by test-data recovery rollover to ${activeYear.yearLabel}`,
				initiatedBy: options.initiatedBy,
				suppressNotification: false,
			}));
		} catch (error) {
			if (firstError === undefined) {
				firstError = error instanceof Error ? error.message : String(error);
			}
		}
	}
	return { archivedYears, failed: firstError !== undefined, error: firstError };
}

export async function previewTestYearRecovery(
	schoolId: number,
	authToken?: string,
): Promise<RecoveryClassifierResult> {
	const status = await getRolloverStatus(schoolId, authToken, { includeCounts: true });
	return classifyRecoveryState(schoolId, status);
}

/**
 * RR-15A: feed-free classifier preview for resumed recovery runs. Built from
 * the persisted active mirror only (no health/school-year/sections/faculty
 * fetches) so a resumed-after-sync run provably makes zero adapter calls.
 * Honest classification: aligned when the active mirror is the upstream year.
 */
async function composeResumedRecoveryPreview(
	schoolId: number,
	upstreamYear: EnrollProYearInfo,
): Promise<RecoveryClassifierResult> {
	const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, isActive: true },
		orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
		select: { enrollProSchoolYearId: true },
	});
	const atlasSchoolYearId = activeMirror?.enrollProSchoolYearId ?? null;
	const aligned = atlasSchoolYearId === upstreamYear.id;
	const status: RolloverStatusResult = {
		schoolId,
		atlasSchoolYearId,
		enrollProActiveYear: upstreamYear,
		drift: {
			status: aligned ? 'aligned' : 'atlas-stale',
			message: aligned ? `ATLAS is aligned with EnrollPro ${upstreamYear.yearLabel}.` : 'ATLAS is not aligned with the EnrollPro active year.',
			recommendedAction: aligned ? 'NONE' : 'RUN_ROLLOVER_SYNC',
			atlasSchoolYearId,
			enrollProSchoolYearId: upstreamYear.id,
			enrollProSchoolYearLabel: upstreamYear.yearLabel,
			mirrorSyncedAt: null,
		},
		mirror: null,
		conflicts: [],
		reconfiguredSections: [],
		canResetDummyYear: false,
		resetTargetSchoolYearId: null,
		conflictingRecordCounts: null,
		teachingLoadResetRequired: false,
		publishedResetBlocked: false,
		testDataMarked: false,
	};
	return classifyRecoveryState(schoolId, status);
}

/**
 * RR-15A recovery state machine:
 *
 *   fresh               → cleanup → sync → cycle verify → archive → notify
 *   resumed-after-clear → (cleanup already committed) sync → cycle verify →
 *                         archive → notify
 *   resumed-after-sync  → verify committed sync state (typed errors on
 *                         mismatch) → archive → notify. NEVER reruns
 *                         applyRolloverSync(); result.syncExecuted=false and
 *                         result.sync=null for this path.
 *
 * Each phase is explicit and the marker (cleared / syncApplied /
 * archivesApplied) is the durable record of how far the lifecycle got.
 */
export async function applyTestYearRecovery(
	input: TestYearRecoveryInput,
): Promise<TestYearRecoveryResult> {
	const initiatedBy = input.initiatedBy ?? (input.actorId > 0 ? 'user' : 'system');

	// Cheap upstream gate: the EnrollPro ACTIVE year is what every path keys
	// on. Resume paths must NOT run the heavy preview (health + school-year +
	// sections + faculty + settings feeds) because resumed-after-sync is
	// archive-only and must make zero synchronization/adapter calls.
	const upstreamYear = await fetchEnrollProActiveSchoolYear(input.authToken);
	if (!upstreamYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified.', {
			actionHint: 'Check EnrollPro connection, then try again.',
		});
	}
	const targetYearId = upstreamYear.id;

	// RR-15 resumability: a prior run that committed cleanup but crashed before
	// sync (cleared:true, syncApplied:false) resumes at the sync; a prior run
	// that synced but could not archive (syncApplied:true, archivesApplied:
	// false) resumes at the archive step only. Both skip the classification
	// gate because the aligned state after a partial recovery no longer
	// classifies as TEST_DATA_RECOVERY_AVAILABLE.
	const marker = await findTestYearRecoveryMarker(input.schoolId, targetYearId);
	const resumeAfterClear = marker !== null && marker.phases.cleared === true && marker.phases.syncApplied !== true;
	const resumeAfterSync = marker !== null && marker.phases.syncApplied === true && marker.phases.archivesApplied !== true;

	// Resumed paths use a lightweight classifier preview composed from the
	// persisted active mirror (NO feed fetches). Only the fresh path needs
	// the full preview (classification gate + artifact counts for cleanup).
	const preview = resumeAfterClear || resumeAfterSync
		? await composeResumedRecoveryPreview(input.schoolId, upstreamYear)
		: await previewTestYearRecovery(input.schoolId, input.authToken);

	if (!resumeAfterSync && !resumeAfterClear && preview.classification !== 'TEST_DATA_RECOVERY_AVAILABLE') {
		throw serviceError(409, 'RECOVERY_NOT_AVAILABLE', `Test-data recovery is not available. Current classification: ${preview.classification}`, {
			actionHint: 'Review the rollover status and conflict classification first.',
			details: { classification: preview.classification, conflictCode: preview.conflictCode },
		});
	}

	if (!input.confirmClear) {
		return {
			preview,
			cleared: false,
			syncExecuted: false,
			sync: null,
			previousActiveSchoolYearId: preview.atlasSchoolYearId,
			archivedYears: [],
			archiveFailed: false,
			partialSuccess: false,
			teachingLoadCycle: null,
		};
	}

	const requiredConfirmation = getTestDataRecoveryConfirmation(targetYearId);
	if (input.confirmationText !== requiredConfirmation) {
		throw serviceError(400, 'CONFIRMATION_REQUIRED', `confirmationText="${requiredConfirmation}" is required to clear test data.`, {
			actionHint: 'Enter the exact confirmation phrase shown in the recovery preview.',
		});
	}

	if (preview.blockers.some((b) => b.code === 'PUBLISHED_DATA_BLOCKED') && !input.acknowledgePublished) {
		throw serviceError(409, 'PUBLISHED_ACKNOWLEDGEMENT_REQUIRED', 'Published schedule artifacts exist. You must explicitly acknowledge this before clearing test data.', {
			actionHint: 'Set acknowledgePublished=true to confirm you understand published artifacts will be cleared.',
		});
	}

	const activeYear = upstreamYear;

	// ── Phase 0 (resumed-after-sync only): verify the committed sync state ──
	// The marker says synchronization committed; the persisted state must
	// agree (active target mirror, upstream label, Teaching Load cycle,
	// sole-active-year invariant). On disagreement, return a typed
	// RECOVERY_STATE_MISMATCH instead of silently rerunning synchronization.
	if (resumeAfterSync) {
		await assertRecoverySyncCommittedState(input.schoolId, targetYearId, activeYear, marker!);
	}

	// ── Phase 1: destructive cleanup (fresh runs only) ──
	let markerAuditId: number;
	let sync: RolloverApplyResult | null = null;
	let syncExecuted = false;
	if (!resumeAfterSync) {
		try {
			if (resumeAfterClear) {
				markerAuditId = marker!.auditId;
			} else {
				markerAuditId = await clearTestYearArtifactsAndRecordMarker(input, targetYearId, activeYear, preview, initiatedBy);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			publishNotificationEvent({
				type: 'TEST_YEAR_RECOVERY_FAILED',
				domain: 'integration',
				severity: 'error',
				audience: 'PRIVILEGED',
				schoolId: input.schoolId,
				schoolYearId: targetYearId,
				facultyId: null,
				message: `Test-data recovery cleanup failed: ${message.slice(0, 200)}`,
				metadata: { phase: 'cleanup', initiatedBy, actorId: input.actorId },
			});
			throw error;
		}

		// ── Phase 2: standard rollover synchronization (fresh + resumed-after-clear) ──
		try {
			sync = await applyRolloverSync(input.schoolId, input.authToken, {
				actorId: input.actorId,
				initiatedBy,
			});
			syncExecuted = true;
			await updateTestYearRecoveryMarker(markerAuditId, {
				phases: { cleared: true, syncApplied: true, archivesApplied: false },
				syncEvidence: {
					enrollProActiveYear: { id: activeYear.id, yearLabel: activeYear.yearLabel },
					sectionCount: sync.sync.sections?.count ?? null,
					facultyActiveCount: sync.sync.faculty?.activeCount ?? null,
					policyReady: sync.sync.policyReady,
					canonicalTemplatesSeeded: sync.sync.canonicalTemplatesSeeded,
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await prisma.auditLog.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId: targetYearId,
					action: 'TEST_YEAR_RECOVERY_SYNC_FAILED',
					actorId: input.actorId,
					targetIds: [targetYearId],
					metadata: {
						errorMessage: message.slice(0, 500),
						initiatedBy,
						phases: { cleared: true, syncApplied: false, archivesApplied: false },
					},
				},
			});
			publishNotificationEvent({
				type: 'TEST_YEAR_RECOVERY_FAILED',
				domain: 'integration',
				severity: 'error',
				audience: 'PRIVILEGED',
				schoolId: input.schoolId,
				schoolYearId: targetYearId,
				facultyId: null,
				message: `Test-data recovery sync failed after cleanup: ${message.slice(0, 200)}`,
				metadata: { phase: 'sync', initiatedBy, actorId: input.actorId },
			});
			throw error;
		}
	} else {
		markerAuditId = marker!.auditId;
	}

	// ── Phase 3: Teaching Load annual cycle ──
	// Fresh / resumed-after-clear: the sync created the cycle (EMPTY v1);
	// normalize through the annual-contract service and announce it.
	// Resumed-after-sync: cycle existence was already verified in Phase 0 and
	// it is unchanged by an archive-only retry, so no event is re-emitted.
	let teachingLoadCycle: TeachingLoadCycleSource | null = null;
	if (syncExecuted) {
		const cycleRow = await ensureTeachingLoadCycle(input.schoolId, targetYearId);
		teachingLoadCycle = serializeTeachingLoadCycle(cycleRow);
		publishNotificationEvent({
			type: 'TEACHING_LOAD_CHANGED',
			domain: 'integration',
			severity: 'info',
			audience: 'PRIVILEGED',
			schoolId: input.schoolId,
			schoolYearId: targetYearId,
			facultyId: null,
			message: 'Teaching Load annual cycle is ready after rollover.',
			metadata: {
				state: teachingLoadCycle.state,
				version: teachingLoadCycle.version,
				updatedAt: teachingLoadCycle.updatedAt,
				initiatedBy,
				actorId: input.actorId,
			},
		});
	} else if (resumeAfterSync) {
		const cycleRow = await prisma.teachingLoadCycle.findUnique({
			where: { schoolId_schoolYearId: { schoolId: input.schoolId, schoolYearId: targetYearId } },
		});
		// Phase 0 already verified existence; the read supplies the payload.
		teachingLoadCycle = cycleRow ? serializeTeachingLoadCycle(cycleRow) : null;
	}

	// ── Phase 4: archive superseded years (non-destructive) ──
	const archiveOutcome = await archiveSupersededYearsForRecovery(input.schoolId, activeYear, {
		actorId: input.actorId,
		initiatedBy,
		authToken: input.authToken,
	});
	await updateTestYearRecoveryMarker(markerAuditId, {
		phases: {
			cleared: true,
			syncApplied: true,
			archivesApplied: !archiveOutcome.failed,
		},
		archiveEvidence: {
			archivedYears: archiveOutcome.archivedYears.map((year) => ({
				schoolYearId: year.schoolYearId,
				yearLabel: year.yearLabel,
				alreadyArchived: year.alreadyArchived,
			})),
			...(archiveOutcome.error !== undefined ? { archiveError: archiveOutcome.error.slice(0, 500) } : {}),
		},
		completedAt: new Date().toISOString(),
		resumePath: resumeAfterClear ? 'resumed-after-clear' : resumeAfterSync ? 'resumed-after-sync' : 'fresh',
		...(resumeAfterSync ? { archiveOnlyCompletion: true } : {}),
	});

	// ── Phase 5: completion notification ──
	const resumePath = resumeAfterClear ? 'resumed-after-clear' : resumeAfterSync ? 'resumed-after-sync' : 'fresh';
	const commonEventFields = {
		domain: 'integration' as const,
		audience: 'PRIVILEGED' as const,
		schoolId: input.schoolId,
		schoolYearId: targetYearId,
		facultyId: null,
		initiatedBy,
		actorId: input.actorId,
	};
	const outcomeMetadata = {
		cleared: true,
		syncExecuted,
		archiveFailed: archiveOutcome.failed,
		archivedYears: archiveOutcome.archivedYears.map((year) => ({ schoolYearId: year.schoolYearId, yearLabel: year.yearLabel })),
		previousActiveSchoolYearId: marker?.previousActiveSchoolYearId ?? preview.atlasSchoolYearId,
		// Resume paths compose a feed-free preview, so original cleanup counts
		// come from the durable marker captured during the destructive run.
		artifactCounts: marker?.artifactCounts ?? preview.artifactCounts,
		teachingLoadCycle: teachingLoadCycle ? { state: teachingLoadCycle.state, version: teachingLoadCycle.version } : null,
		resumePath,
	};

	if (archiveOutcome.failed) {
		publishNotificationEvent({
			...commonEventFields,
			type: 'TEST_YEAR_RECOVERY_PARTIAL_SUCCESS',
			severity: 'warning',
			message: resumeAfterSync
				? `Archival of superseded school years is still pending after the recovery retry for ${activeYear.yearLabel}.`
				: `Test-year data cleared and ${activeYear.yearLabel} synced, but archiving superseded school years failed. Retry recovery to complete archival.`,
			metadata: {
				...outcomeMetadata,
				archiveError: archiveOutcome.error?.slice(0, 300),
				archiveEvidence: archiveOutcome.archivedYears.map((year) => ({ schoolYearId: year.schoolYearId, yearLabel: year.yearLabel })),
			},
		});
	} else {
		publishNotificationEvent({
			...commonEventFields,
			type: 'TEST_YEAR_RECOVERY_COMPLETED',
			severity: 'warning',
			message: resumeAfterSync
				? `Pending archival completed for ${activeYear.yearLabel} after recovery.`
				: `Test-year data cleared for school year #${targetYearId} and EnrollPro sync applied.${archiveOutcome.archivedYears.length > 0 ? ` Archived ${archiveOutcome.archivedYears.length} superseded school year(s) as read-only history.` : ''}`,
			metadata: outcomeMetadata,
		});
	}

	return {
		preview,
		cleared: true,
		syncExecuted,
		sync,
		previousActiveSchoolYearId: marker?.previousActiveSchoolYearId ?? preview.atlasSchoolYearId,
		archivedYears: archiveOutcome.archivedYears,
		archiveFailed: archiveOutcome.failed,
		archiveError: archiveOutcome.error,
		partialSuccess: archiveOutcome.failed,
		teachingLoadCycle,
		resumePath,
	};
}

/**
 * RR-15A: verify that the persisted state matches a marker that claims
 * syncApplied=true. Any disagreement raises a typed `RECOVERY_STATE_MISMATCH`
 * instead of silently rerunning the synchronization:
 *  - the target-year mirror exists, is active, and carries the upstream label;
 *  - the target year is the ONLY active year mirror;
 *  - the target-year TeachingLoadCycle exists.
 */
async function assertRecoverySyncCommittedState(
	schoolId: number,
	targetYearId: number,
	activeYear: EnrollProYearInfo,
	marker: TestYearRecoveryMarker,
): Promise<void> {
	const mismatch = (reason: string) => serviceError(
		409,
		'RECOVERY_STATE_MISMATCH',
		`Recovery marker for school year #${targetYearId} records syncApplied=true, but ${reason}. Refusing to rerun synchronization silently.`,
		{
			actionHint: 'Restore the committed recovery state or archive the marker after an explicit operator decision.',
			details: { schoolYearId: targetYearId, markerAuditId: marker.auditId, reason },
		},
	);

	const mirror = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: targetYearId } },
		select: { isActive: true, yearLabel: true },
	});
	if (!mirror) throw mismatch('no target-year mirror exists');
	if (!mirror.isActive) throw mismatch('the target-year mirror is not active');
	if (mirror.yearLabel !== activeYear.yearLabel) {
		throw mismatch(`the target-year mirror label (${mirror.yearLabel}) differs from EnrollPro (${activeYear.yearLabel})`);
	}
	const otherActive = await prisma.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, isActive: true, enrollProSchoolYearId: { not: targetYearId } },
		select: { enrollProSchoolYearId: true },
	});
	if (otherActive) throw mismatch(`another school year (#${otherActive.enrollProSchoolYearId}) is still active`);
	const cycle = await prisma.teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId: targetYearId } },
		select: { id: true },
	});
	if (!cycle) throw mismatch('the target-year TeachingLoadCycle is missing');
}

/**
 * Destructive phase of test-data recovery: deletes only the preview-approved
 * target-year artifacts and creates the durable phase-marker audit row in the
 * SAME transaction. The target-year TeachingLoadCycle is deleted here as part
 * of the fixture purge — `applyRolloverSync()` recreates it fresh (EMPTY v1)
 * and recovery never deletes it after synchronization commits. Target-year
 * AUDIT rows are never deleted (RR-15A): the scaffold/marking/prior-marker
 * authorization chain survives as forensic history.
 */
async function clearTestYearArtifactsAndRecordMarker(
	input: TestYearRecoveryInput,
	schoolYearId: number,
	activeYear: EnrollProYearInfo,
	preview: RecoveryClassifierResult,
	initiatedBy: 'user' | 'system',
): Promise<number> {
	const schoolId = input.schoolId;
	return prisma.$transaction(async (tx) => {
		const generationRunIds = (await tx.generationRun.findMany({
			where: { schoolId, schoolYearId },
			select: { id: true },
		})).map((run) => run.id);
		const preferenceIds = (await tx.facultyPreference.findMany({
			where: { schoolId, schoolYearId },
			select: { id: true },
		})).map((preference) => preference.id);
		const appealIds = (await tx.roomRequestAppeal.findMany({
			where: { schoolId, schoolYearId },
			select: { id: true },
		})).map((appeal) => appeal.id);

		if (appealIds.length > 0) {
			await tx.roomRequestAppealHistory.deleteMany({ where: { appealId: { in: appealIds } } });
		}
		await tx.roomRequestAppeal.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.facultyRoomPreference.deleteMany({ where: { schoolId, schoolYearId } });

		if (preferenceIds.length > 0) {
			await tx.preferenceReview.deleteMany({ where: { preferenceId: { in: preferenceIds } } });
			await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: { in: preferenceIds } } });
		}
		await tx.facultyPreference.deleteMany({ where: { schoolId, schoolYearId } });

		await tx.lockedSessionAction.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.lockedSession.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.gradeShiftWindow.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.facultySnapshot.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.sectionSnapshot.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.instructionalCohort.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.schedulingPolicy.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.sectionMirror.deleteMany({ where: { schoolId, schoolYearId } });

		// Test-only fault injection: throws AFTER several deletes so what is
		// proven is the transactional rollback of partial cleanup work.
		if (input.failCleanupTxForTest === true) {
			throw serviceError(500, 'TEST_YEAR_CLEANUP_SIMULATED', 'simulated cleanup transaction failure', {
				details: { phase: 'cleanup' },
			});
		}

		await tx.subjectSectionOwnership.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.facultySubject.deleteMany({ where: { schoolId, schoolYearId } });
		await tx.teachingLoadCycle.deleteMany({ where: { schoolId, schoolYearId } });

		// RR-15A: audit preservation. Cleanup NEVER deletes target-year audit
		// logs. The authorization and provenance chain (scaffold, marking,
		// prior cleanup markers, prior sync failures, security events) is
		// retained as forensic history; the cleanup marker records how many
		// year-scoped audit rows were preserved.
		const preservedAuditLogCount = await tx.auditLog.count({ where: { schoolId, schoolYearId } });
		if (generationRunIds.length > 0) {
			await tx.manualScheduleEdit.deleteMany({ where: { schoolId, schoolYearId, runId: { in: generationRunIds } } });
			await tx.followUpFlag.deleteMany({ where: { runId: { in: generationRunIds } } });
		} else {
			await tx.manualScheduleEdit.deleteMany({ where: { schoolId, schoolYearId } });
		}
		await tx.generationRun.deleteMany({ where: { schoolId, schoolYearId } });

		const marker = await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'TEST_YEAR_RECOVERY_CLEANUP',
				actorId: input.actorId,
				targetIds: [schoolYearId],
				metadata: {
					source: 'enrollpro-rollover',
					deletedCounts: preview.artifactCounts,
					teachingLoadReset: true,
					enrollProActiveYear: { id: activeYear.id, yearLabel: activeYear.yearLabel },
					initiatedBy,
					previousActiveSchoolYearId: preview.atlasSchoolYearId,
					// RR-15A: audit chain is preserved (scaffold, marking,
					// prior recovery markers/failures); nothing year-scoped is
					// deleted. Legacy fixture audit rows are marked superseded
					// by this cleanup record instead of removed.
					auditPreservation: { preserved: true, preservedAuditLogCount },
					// RR-15 phase marker: `cleared` commits with this
					// transaction; `syncApplied` and `archivesApplied` flip
					// only after each later phase succeeds. A crash between
					// phases leaves a resumable marker.
					phases: { cleared: true, syncApplied: false, archivesApplied: false },
				},
			},
			select: { id: true },
		});
		return marker.id;
	});
}

// ─── RR-15C: recovery scaffold for legacy fixtures without a year mirror ───

export type RecoveryMirrorScaffoldResult = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	mirrorId: number;
	alreadyScaffolded: boolean;
};

export type RecoveryMirrorScaffoldInput = {
	schoolId: number;
	actorId: number;
	authToken?: string;
	/** Optional explicit target; must equal the EnrollPro ACTIVE year. */
	schoolYearId?: number;
	acknowledgePublished?: boolean;
	initiatedBy?: 'user' | 'system';
};

/**
 * Privileged recovery-scaffold operation for legacy fixtures that have
 * target-year artifacts but no `EnrollProSchoolYearMirror` row (the mirror
 * model postdates those fixtures). Creates ONE inactive mirror row with the
 * upstream label and a recovery-specific pending status so the guarded
 * mark-test-data + recovery flow can operate. Never activates the year,
 * never deletes artifacts, never overwrites an existing mirror's metadata,
 * and is idempotent (a repeat call returns the existing scaffold without a
 * duplicate audit or event).
 */
export async function scaffoldTestYearRecoveryMirror(
	input: RecoveryMirrorScaffoldInput,
): Promise<RecoveryMirrorScaffoldResult> {
	const initiatedBy = input.initiatedBy ?? (input.actorId > 0 ? 'user' : 'system');
	const health = await fetchEnrollProIntegrationHealth(input.authToken);
	if (!health.reachable) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro is unreachable. Cannot verify the active school year, so recovery scaffolding was not applied.', {
			actionHint: 'Wait for EnrollPro to become reachable, then scaffold again.',
		});
	}
	const activeYear = await fetchEnrollProActiveSchoolYear(input.authToken);
	if (!activeYear) {
		throw serviceError(503, 'ENROLLPRO_UNAVAILABLE', 'EnrollPro active school year could not be verified. Recovery scaffolding was not applied.', {
			actionHint: 'Wait for EnrollPro to become reachable, then scaffold again.',
		});
	}
	if (input.schoolYearId != null && input.schoolYearId !== activeYear.id) {
		throw serviceError(409, 'ACTIVE_YEAR_MISMATCH', `Recovery scaffolding targets the EnrollPro active year only. Requested year #${input.schoolYearId} is not the active year #${activeYear.id} (${activeYear.yearLabel}).`, {
			actionHint: 'Scaffold the EnrollPro active year so recovery can classify its artifacts.',
			details: { requestedSchoolYearId: input.schoolYearId, activeYear },
		});
	}

	const counts = await countDummyYearRecords(input.schoolId, activeYear.id);
	const artifactsExist = counts.sectionMirrors > 0 || counts.generationRuns > 0 || counts.schedulingPolicies > 0;
	if (!artifactsExist) {
		throw serviceError(409, 'NO_RECOVERY_ARTIFACTS', `No ATLAS artifacts exist for the EnrollPro active year #${activeYear.id}. Nothing to scaffold.`, {
			actionHint: 'Recovery scaffolding is only needed when legacy target-year artifacts exist without a year mirror.',
			details: { artifactCounts: counts },
		});
	}
	const publishedBlocked = counts.publishedGenerationRuns > 0 || counts.publishedScheduleRevisions > 0;
	if (publishedBlocked && input.acknowledgePublished !== true) {
		throw serviceError(409, 'PUBLISHED_ACKNOWLEDGEMENT_REQUIRED', 'Published schedule artifacts exist for this school year. Scaffolding requires explicit acknowledgement.', {
			actionHint: 'Set acknowledgePublished=true to confirm you understand published artifacts will be handled by the recovery apply policy.',
			details: {
				publishedGenerationRuns: counts.publishedGenerationRuns,
				publishedScheduleRevisions: counts.publishedScheduleRevisions,
			},
		});
	}

	const existing = await prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId: input.schoolId, enrollProSchoolYearId: activeYear.id } },
		select: { id: true, yearLabel: true, isActive: true, syncStatus: true, lastSyncMetadata: true },
	});
	if (existing) {
		const metadata = existing.lastSyncMetadata as Record<string, unknown> | null;
		const isPriorScaffold = metadata?.scaffoldedForTestDataRecovery === true
			&& existing.isActive === false
			&& existing.syncStatus === 'recovery-pending'
			&& existing.yearLabel === activeYear.yearLabel;
		if (isPriorScaffold) {
			// Idempotent: repeat scaffold of the same fixture returns the
			// existing scaffold without a duplicate audit or event.
			return {
				schoolId: input.schoolId,
				schoolYearId: activeYear.id,
				yearLabel: existing.yearLabel,
				mirrorId: existing.id,
				alreadyScaffolded: true,
			};
		}
		throw serviceError(409, 'MIRROR_ALREADY_EXISTS', `A year mirror already exists for school year #${activeYear.id} (${existing.yearLabel}). Recovery scaffolding is only for fixtures without a mirror.`, {
			actionHint: existing.syncStatus === 'recovery-pending'
				? 'The mirror already carries recovery state; mark it as test data to continue.'
				: 'Use the mark-test-data operation when a normal mirror already exists.',
			details: { mirrorId: existing.id, syncStatus: existing.syncStatus, isActive: existing.isActive },
		});
	}

	const now = new Date();
	const mirror = await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId: input.schoolId,
			enrollProSchoolYearId: activeYear.id,
			yearLabel: activeYear.yearLabel,
			isActive: false,
			isArchived: false,
			sourceEndpoint: SCHOOL_YEAR_ENDPOINT,
			facultyCount: 0,
			sectionCount: 0,
			syncStatus: 'recovery-pending',
			lastSyncMetadata: {
				scaffoldedForTestDataRecovery: true,
				scaffoldedAt: now.toISOString(),
				scaffoldedBy: input.actorId,
				initiatedBy,
			},
		},
		select: { id: true, yearLabel: true },
	});

	await prisma.auditLog.create({
		data: {
			schoolId: input.schoolId,
			schoolYearId: activeYear.id,
			action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED',
			actorId: input.actorId,
			targetIds: [mirror.id],
			metadata: {
				source: 'enrollpro-rollover',
				initiatedBy,
				yearLabel: activeYear.yearLabel,
				isActive: false,
				reason: 'legacy fixture predates the year-mirror model; inactive marker row only (no fixture data attached)',
			},
		},
	});

	publishNotificationEvent({
		type: 'TEST_YEAR_RECOVERY_MIRROR_SCAFFOLDED',
		domain: 'integration',
		severity: 'info',
		audience: 'PRIVILEGED',
		schoolId: input.schoolId,
		schoolYearId: activeYear.id,
		facultyId: null,
		message: `Recovery scaffold mirror created for ${activeYear.yearLabel} (#${activeYear.id}). Mark it as test data to continue.`,
		metadata: {
			mirrorId: mirror.id,
			yearLabel: activeYear.yearLabel,
			initiatedBy,
			actorId: input.actorId,
		},
	});

	return {
		schoolId: input.schoolId,
		schoolYearId: activeYear.id,
		yearLabel: mirror.yearLabel,
		mirrorId: mirror.id,
		alreadyScaffolded: false,
	};
}
