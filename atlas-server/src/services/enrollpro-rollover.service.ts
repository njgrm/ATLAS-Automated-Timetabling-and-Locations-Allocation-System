import { prisma } from '../lib/prisma.js';
import { syncFacultyFromExternal, type FacultySyncMode } from './faculty.service.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
import { syncSectionsFromExternal } from './section.service.js';
import { fetchEnrollProActiveSchoolYear, normalizeProgramMetadata } from './section-adapter.js';

type DriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type RolloverAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR';

type RolloverServiceError = Error & {
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
};

export type RolloverApplyResult = RolloverStatusResult & {
	applied: boolean;
	sync: {
		faculty: Awaited<ReturnType<typeof syncFacultyFromExternal>> | null;
		sections: Awaited<ReturnType<typeof syncSectionsFromExternal>> | null;
		policyReady: boolean;
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
};

const SCHOOL_YEAR_ENDPOINT = '/integration/v1/school-year';
const SECTION_ENDPOINT = '/integration/v1/sections';
const FACULTY_ENDPOINTS = ['/integration/v1/faculty', '/integration/v1/default/faculty'];
const PUBLIC_SETTINGS_ENDPOINT = '/settings/public';
const HEALTH_ENDPOINT = '/integration/v1/health';
const DUMMY_YEAR_RESET_CONFIRMATION_TEXT = 'RESET_DUMMY_SCHOOL_YEAR_1';

function serviceError(
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

function authHeaders(authToken?: string): Record<string, string> | undefined {
	const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
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

async function fetchJson(path: string, authToken?: string): Promise<unknown> {
	const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
	const res = await fetch(`${baseUrl}${path}`, {
		headers: authHeaders(authToken),
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
		fetchJson(PUBLIC_SETTINGS_ENDPOINT, authToken),
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

export function resolveMappingConflictAction(publishedResetBlocked: boolean): {
	recommendedAction: RolloverAction;
	message: string;
} {
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
		const action = resolveMappingConflictAction(input.publishedResetBlocked ?? false);
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
	const [mirror, sectionSnapshot, generationRun] = await Promise.all([
		prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			select: { enrollProSchoolYearId: true },
		}),
		prisma.sectionSnapshot.findFirst({
			where: { schoolId },
			orderBy: { fetchedAt: 'desc' },
			select: { schoolYearId: true },
		}),
		prisma.generationRun.findFirst({
			where: { schoolId },
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
		prisma.facultySubject.count({ where: { schoolId } }),
		prisma.subjectSectionOwnership.count({ where: { schoolId } }),
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
		...(counts ? { counts } : {}),
		conflicts,
		reconfiguredSections,
		canResetDummyYear: resetPreview.canResetDummyYear,
		resetTargetSchoolYearId: resetPreview.targetSchoolYearId,
		conflictingRecordCounts: resetPreview.counts,
		teachingLoadResetRequired: resetPreview.teachingLoadResetRequired,
		publishedResetBlocked: resetPreview.publishedResetBlocked,
	};
}

export async function previewRolloverSync(schoolId: number, authToken?: string): Promise<RolloverStatusResult> {
	return getRolloverStatus(schoolId, authToken, { includeCounts: true });
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
	if (!resetPreview.canResetDummyYear) {
		throw serviceError(409, 'RESET_NOT_AVAILABLE', 'Dummy-year reset is not available for the current rollover state.', {
			actionHint: 'Run rollover preview and review the current blockers.',
			details: { blockers: resetPreview.blockers, counts: resetPreview.counts },
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
	await prisma.$transaction(async (tx) => {
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

		await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: input.schoolId } });
		await tx.facultySubject.deleteMany({ where: { schoolId: input.schoolId } });

		await tx.auditLog.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
		if (generationRunIds.length > 0) {
			await tx.manualScheduleEdit.deleteMany({ where: { schoolId: input.schoolId, schoolYearId, runId: { in: generationRunIds } } });
			await tx.followUpFlag.deleteMany({ where: { runId: { in: generationRunIds } } });
		} else {
			await tx.manualScheduleEdit.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });
		}
		await tx.generationRun.deleteMany({ where: { schoolId: input.schoolId, schoolYearId } });

		await tx.auditLog.create({
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
				},
			},
		});
	});

	const rolloverApply = await applyRolloverSync(input.schoolId, input.authToken, { facultyMode: 'prune' });
	await prisma.$transaction([
		prisma.subjectSectionOwnership.deleteMany({ where: { schoolId: input.schoolId } }),
		prisma.facultySubject.deleteMany({ where: { schoolId: input.schoolId } }),
	]);
	return {
		...rolloverApply,
		previewOnly: false,
		resetApplied: true,
		reset: resetPreview,
		rolloverApply,
	};
}
