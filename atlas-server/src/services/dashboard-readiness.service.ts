import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext, type RuntimeContextResult } from './runtime-context.service.js';
import { evaluateCurriculumReadiness } from './school-year-offering.service.js';

export type DashboardReadinessSourceState =
	| 'verified_live'
	| 'checking_source'
	| 'using_saved_data'
	| 'no_saved_data'
	| 'partial_degraded';

export type DashboardLifecyclePhase = 'SETUP' | 'PREFERENCES' | 'GENERATION' | 'REVIEW' | 'PUBLISHED';
export type DashboardLatestRunStatus = 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

type DomainSource = {
	state: DashboardReadinessSourceState;
	message: string;
	source: string;
	fetchedAt: string | null;
	error?: string;
};

type DashboardSummaryInput = {
	schoolId: number;
	authToken?: string;
};

type SafeResult<T> = {
	ok: boolean;
	data: T | null;
	error?: string;
};

type DashboardBuilding = {
	id: number;
	name: string;
	shortCode: string | null;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	color: string;
	floorCount: number;
	isTeachingBuilding: boolean;
	rooms: Array<{
		id: number;
		name: string;
		floor: number;
		type: string;
		capacity: number | null;
		isTeachingSpace: boolean;
		floorPosition: number;
		buildingId: number;
		features: string[];
	}>;
};

type CampusReadinessData = {
	buildings: DashboardBuilding[];
	campusImageUrl: string | null;
	teachingRoomCount: number;
	totalRoomCount: number;
	buildingSetupStatus: {
		done: boolean;
		subMessage?: string;
	};
};

type SubjectReadinessData = {
	subjectCount: number;
	unassignedSubjectCount: number;
};

type FacultyReadinessData = {
	facultyCount: number;
	lastSyncedAt: string | null;
};

type SectionReadinessData = {
	sectionCount: number | null;
	lastSyncedAt: string | null;
};

type LatestRunReadinessData = {
	latestRunStatus: DashboardLatestRunStatus;
	latestRunId: number | null;
	violationCount: number | null;
	isPublished: boolean;
	publishedRunId: number | null;
	createdAt: string | null;
	finishedAt: string | null;
};

export type DashboardCurriculumReadiness = {
	ready: boolean;
	termConfigPresent: boolean;
	requirementCount: number;
	blockerCode: string | null;
	blockerMessage: string | null;
};

export type DashboardReadinessSummary = {
	schoolId: number;
	activeSchoolYearId: number | null;
	activeSchoolYearLabel: string | null;
	resolvedAt: string;
	sourceState: DashboardReadinessSourceState;
	sourceMessage: string;
	campus: CampusReadinessData;
	subjects: SubjectReadinessData;
	faculty: FacultyReadinessData;
	sections: SectionReadinessData;
	generation: LatestRunReadinessData;
	curriculum: DashboardCurriculumReadiness | null;
	lifecyclePhase: DashboardLifecyclePhase;
	sources: {
		runtimeContext: DomainSource;
		campus: DomainSource;
		subjects: DomainSource;
		faculty: DomainSource;
		sections: DomainSource;
		generation: DomainSource;
		curriculum: DomainSource;
	};
};

async function safe<T>(operation: () => Promise<T>): Promise<SafeResult<T>> {
	try {
		return { ok: true, data: await operation() };
	} catch (error) {
		return {
			ok: false,
			data: null,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function iso(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : value;
}

function source(
	state: DashboardReadinessSourceState,
	message: string,
	sourceLabel: string,
	fetchedAt: string | null,
	error?: string,
): DomainSource {
	return {
		state,
		message,
		source: sourceLabel,
		fetchedAt,
		...(error ? { error } : {}),
	};
}

function summarizeCampus(buildings: DashboardBuilding[], campusImageUrl: string | null): CampusReadinessData {
	const teachingBuildings = buildings.filter((building) => building.isTeachingBuilding !== false);
	const teachingBuildingsWithoutRooms = teachingBuildings.filter((building) => building.rooms.length === 0);
	const placeholderNamedBuildings = teachingBuildings.filter((building) => /^Building \d+$/.test(building.name));
	const invalidTeachingBuildings = teachingBuildings.filter(
		(building) => /^Building \d+$/.test(building.name) || building.rooms.length === 0,
	);
	const teachingRoomCount = buildings.reduce(
		(sum, building) => sum + (building.isTeachingBuilding !== false
			? building.rooms.filter((room) => room.isTeachingSpace).length
			: 0),
		0,
	);
	const totalRoomCount = buildings.reduce((sum, building) => sum + building.rooms.length, 0);
	const done = teachingBuildings.length > 0 && invalidTeachingBuildings.length === 0;
	let subMessage: string | undefined;

	if (!done) {
		if (teachingBuildings.length === 0) {
			subMessage = 'No teaching buildings set up yet';
		} else if (teachingBuildingsWithoutRooms.length > 0 && placeholderNamedBuildings.length > 0) {
			subMessage = `${teachingBuildingsWithoutRooms.length} without rooms, ${placeholderNamedBuildings.length} need a name`;
		} else if (teachingBuildingsWithoutRooms.length > 0) {
			subMessage = `${teachingBuildingsWithoutRooms.length} building${teachingBuildingsWithoutRooms.length !== 1 ? 's' : ''} have no rooms`;
		} else if (placeholderNamedBuildings.length > 0) {
			subMessage = `${placeholderNamedBuildings.length} building${placeholderNamedBuildings.length !== 1 ? 's' : ''} need a name`;
		}
	}

	return {
		buildings,
		campusImageUrl,
		teachingRoomCount,
		totalRoomCount,
		buildingSetupStatus: { done, ...(subMessage ? { subMessage } : {}) },
	};
}

function mapRunStatus(status: string | null | undefined): DashboardLatestRunStatus {
	switch ((status ?? '').toUpperCase()) {
		case 'COMPLETED':
		case 'SUCCESS':
			return 'COMPLETED';
		case 'QUEUED':
		case 'RUNNING':
		case 'IN_PROGRESS':
		case 'PENDING':
			return 'IN_PROGRESS';
		case 'FAILED':
		case 'ERROR':
			return 'FAILED';
		default:
			return 'NONE';
	}
}

function readNumber(value: unknown): number | null {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function countViolations(summary: unknown, violations: unknown): number | null {
	if (Array.isArray(violations)) return violations.length;
	if (!isRecord(summary)) return null;

	const direct = readNumber(summary.violationCount ?? summary.totalViolationCount);
	if (direct !== null) return direct;

	const hard = readNumber(summary.hardViolationCount);
	const soft = readNumber(summary.softViolationCount);
	if (hard !== null || soft !== null) {
		return (hard ?? 0) + (soft ?? 0);
	}

	if (isRecord(summary.violationCounts)) {
		return Object.values(summary.violationCounts).reduce<number>((total, value) => {
			const numeric = readNumber(value);
			return total + (numeric ?? 0);
		}, 0);
	}

	return null;
}

/**
 * EVAL-C01 — strict publication flag.
 *
 * Mirrors the public published-schedule contract (`isPublished === true`) and
 * additionally requires a COMPLETED run. Loose markers (`publishedAt` string or
 * `publishedBy` number on a FAILED or superseded row) must never read as
 * published: those are stale markers, not faculty/student-visible truth.
 */
export function isStrictlyPublishedRun(args: { status: string | null | undefined; summary: unknown }): boolean {
	if (mapRunStatus(args.status) !== 'COMPLETED') return false;
	if (!isRecord(args.summary)) return false;
	return args.summary.isPublished === true;
}

export type DashboardScopeVerdict =
	| { ok: true; schoolId: number }
	| { ok: false; code: 'SCHOOL_SCOPE_REQUIRED' | 'SCHOOL_SCOPE_MISMATCH'; message: string };

/**
 * EVAL-C01 — actor-school scope for Dashboard reads. The school always comes
 * from the authenticated actor; there is no school-1 fallback. An unresolved
 * actor or a query school that disagrees with the actor is rejected before any
 * domain read runs.
 */
export function resolveDashboardScope(
	actorSchoolId: number | null | undefined,
	querySchoolId: number | null | undefined,
): DashboardScopeVerdict {
	if (typeof actorSchoolId !== 'number' || !Number.isInteger(actorSchoolId) || actorSchoolId <= 0) {
		return { ok: false, code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' };
	}
	if (querySchoolId != null && querySchoolId !== actorSchoolId) {
		return { ok: false, code: 'SCHOOL_SCOPE_MISMATCH', message: 'Requested school does not match the authenticated school.' };
	}
	return { ok: true, schoolId: actorSchoolId };
}

/**
 * EVAL-C01R — active-year authority.
 *
 * The runtime active school year is the SOLE authority for current Dashboard
 * lifecycle. There is no default year and no requested-year fallback: when
 * runtime resolution is missing or degraded, the Dashboard has no current
 * year and must never let a requested `schoolYearId` stand in as truth.
 */
export function resolveDashboardActiveYear(runtimeActiveYearId: number | null | undefined): number | null {
	if (typeof runtimeActiveYearId === 'number' && Number.isInteger(runtimeActiveYearId) && runtimeActiveYearId > 0) {
		return runtimeActiveYearId;
	}
	return null;
}

/**
 * EVAL-C01R — publication WHERE builder (predicate pushed into SQL).
 *
 * Only a COMPLETED run whose `summary.isPublished === true` for the exact
 * (actor school, runtime active year) is a publication candidate. The
 * predicate runs in the database, so an older valid publication is never
 * hidden behind newer unpublished completed runs, and FAILED rows (with or
 * without stale markers) never match. No `take` window exists here.
 */
export function buildDashboardPublicationWhere(args: { schoolId: number; schoolYearId: number }) {
	return {
		schoolId: args.schoolId,
		schoolYearId: args.schoolYearId,
		status: 'COMPLETED' as const,
		summary: { path: ['isPublished'], equals: true },
	};
}

/**
 * EVAL-C01 — single coherent lifecycle decision with fail-closed guards.
 *
 * - Degraded dependencies suppress publication: a partial snapshot never
 *   infers PUBLISHED.
 * - Missing Curriculum Requirements (no term configuration or no ready
 *   requirements) hold the lifecycle at SETUP as a setup/generation blocker.
 * - Otherwise the schedule lifecycle follows setup readiness, latest-run
 *   status, and strictly-resolved publication.
 */
export function resolveDashboardLifecycle(args: {
	subjectCount: number;
	facultyCount: number;
	sectionCount: number | null;
	unassignedSubjectCount: number;
	buildingsDone: boolean;
	latestRunStatus: DashboardLatestRunStatus;
	publishedRunPresent: boolean;
	curriculumReady: boolean;
	hasDomainError: boolean;
}): { phase: DashboardLifecyclePhase; isPublished: boolean } {
	const isPublished = !args.hasDomainError && args.publishedRunPresent;
	if (isPublished) return { phase: 'PUBLISHED', isPublished: true };

	if (!args.curriculumReady) return { phase: 'SETUP', isPublished: false };

	const setupReady =
		args.subjectCount > 0 &&
		args.facultyCount > 0 &&
		args.unassignedSubjectCount === 0 &&
		(args.sectionCount ?? 0) > 0 &&
		args.buildingsDone;

	if (!setupReady) return { phase: 'SETUP', isPublished: false };
	if (args.latestRunStatus === 'NONE') return { phase: 'PREFERENCES', isPublished: false };
	if (args.latestRunStatus === 'IN_PROGRESS' || args.latestRunStatus === 'FAILED') return { phase: 'GENERATION', isPublished: false };
	return { phase: 'REVIEW', isPublished: false };
}

function lifecyclePhase(args: {
	subjectCount: number;
	facultyCount: number;
	sectionCount: number | null;
	unassignedSubjectCount: number;
	buildingsDone: boolean;
	latestRunStatus: DashboardLatestRunStatus;
	latestRunIsPublished: boolean;
}): DashboardLifecyclePhase {
	return resolveDashboardLifecycle({
		subjectCount: args.subjectCount,
		facultyCount: args.facultyCount,
		sectionCount: args.sectionCount,
		unassignedSubjectCount: args.unassignedSubjectCount,
		buildingsDone: args.buildingsDone,
		latestRunStatus: args.latestRunStatus,
		publishedRunPresent: args.latestRunIsPublished,
		curriculumReady: true,
		hasDomainError: false,
	}).phase;
}

function overallSourceState(args: {
	runtimeContext: RuntimeContextResult | null;
	hasSchoolYear: boolean;
	hasSavedData: boolean;
	hasDomainError: boolean;
}): { state: DashboardReadinessSourceState; message: string } {
	if (args.hasDomainError) {
		return { state: 'partial_degraded', message: 'Some readiness sources are unavailable.' };
	}
	if (!args.hasSavedData) {
		return { state: 'no_saved_data', message: 'No saved readiness data is available yet.' };
	}
	if (args.runtimeContext?.source === 'enrollpro-verified' && args.runtimeContext.stale !== true) {
		return { state: 'verified_live', message: 'Verified live readiness data.' };
	}
	if (args.hasSchoolYear) {
		return { state: 'using_saved_data', message: 'Using saved readiness data.' };
	}
	return { state: 'no_saved_data', message: 'No active school year is available yet.' };
}

export async function getDashboardReadinessSummary(input: DashboardSummaryInput): Promise<DashboardReadinessSummary> {
	const resolvedAt = new Date().toISOString();
	const runtimeResult = await safe(() => resolveRuntimeContext(input.schoolId, input.authToken));
	const runtimeContext = runtimeResult.data;
	const activeSchoolYearId = resolveDashboardActiveYear(runtimeContext?.activeSchoolYearId);
	const activeSchoolYearLabel = runtimeContext?.activeSchoolYearLabel ?? null;

	const [campusResult, subjectResult, facultyResult, sectionResult, generationResult, publicationResult, curriculumResult] = await Promise.all([
		safe(async () => {
			const [school, buildings] = await Promise.all([
				prisma.school.findUnique({
					where: { id: input.schoolId },
					select: { campusImageUrl: true, updatedAt: true },
				}),
				prisma.building.findMany({
					where: { schoolId: input.schoolId },
					select: {
						id: true,
						name: true,
						shortCode: true,
						x: true,
						y: true,
						width: true,
						height: true,
						rotation: true,
						color: true,
						floorCount: true,
						isTeachingBuilding: true,
						updatedAt: true,
						rooms: {
							orderBy: [{ floor: 'asc' }, { floorPosition: 'asc' }],
							select: {
								id: true,
								name: true,
								floor: true,
								type: true,
								capacity: true,
								isTeachingSpace: true,
								floorPosition: true,
								buildingId: true,
								features: true,
							},
						},
					},
					orderBy: { name: 'asc' },
				}),
			]);

			return {
				campusImageUrl: school?.campusImageUrl ?? null,
				updatedAt: buildings.reduce<Date | null>((latest, building) => {
					if (!latest || building.updatedAt > latest) return building.updatedAt;
					return latest;
				}, school?.updatedAt ?? null),
				buildings: buildings.map(({ updatedAt: _updatedAt, ...building }) => building),
			};
		}),
		safe(async () => {
			const [subjectCount, unassignedSubjectCount] = await Promise.all([
				prisma.subject.count({ where: { schoolId: input.schoolId, isActive: true } }),
				prisma.subject.count({
					where: {
						schoolId: input.schoolId,
						isActive: true,
						facultySubjects: { none: {} },
					},
				}),
			]);
			return { subjectCount, unassignedSubjectCount };
		}),
		safe(async () => {
			const [facultyCount, latestFaculty] = await Promise.all([
				prisma.facultyMirror.count({ where: { schoolId: input.schoolId, isStale: false } }),
				prisma.facultyMirror.findFirst({
					where: { schoolId: input.schoolId },
					orderBy: { lastSyncedAt: 'desc' },
					select: { lastSyncedAt: true },
				}),
			]);
			return { facultyCount, lastSyncedAt: iso(latestFaculty?.lastSyncedAt) };
		}),
		safe(async () => {
			if (!activeSchoolYearId) {
				return { sectionCount: null, lastSyncedAt: null };
			}
			const [sectionCount, latestSection] = await Promise.all([
				prisma.sectionMirror.count({ where: { schoolId: input.schoolId, schoolYearId: activeSchoolYearId, isStale: false } }),
				prisma.sectionMirror.findFirst({
					where: { schoolId: input.schoolId, schoolYearId: activeSchoolYearId, isStale: false },
					orderBy: { lastSyncedAt: 'desc' },
					select: { lastSyncedAt: true },
				}),
			]);
			return { sectionCount, lastSyncedAt: iso(latestSection?.lastSyncedAt) };
		}),
		safe(async () => {
			if (!activeSchoolYearId) {
				return {
					latestRunStatus: 'NONE' as const,
					latestRunId: null,
					violationCount: null,
					createdAt: null,
					finishedAt: null,
				};
			}
			const run = await prisma.generationRun.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: activeSchoolYearId },
				// EVAL-C01R1 — deterministic secondary id-desc ordering so that
				// equal-createdAt rows resolve to the higher id.
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: {
					id: true,
					status: true,
					summary: true,
					violations: true,
					createdAt: true,
					finishedAt: true,
				},
			});
			if (!run) {
				return {
					latestRunStatus: 'NONE' as const,
					latestRunId: null,
					violationCount: null,
					createdAt: null,
					finishedAt: null,
				};
			}
			return {
				latestRunStatus: mapRunStatus(String(run.status)),
				latestRunId: run.id,
				violationCount: countViolations(run.summary, run.violations),
				createdAt: run.createdAt.toISOString(),
				finishedAt: iso(run.finishedAt),
			};
		}),
		// EVAL-C01R — publication resolution for the exact (actor school,
		// runtime active year). The `isPublished === true` predicate is pushed
		// into the SQL WHERE (no in-memory window), so an older valid
		// publication is never hidden behind newer unpublished completed runs
		// and FAILED stale-marker rows never match. Select is minimal
		// (id/status/summary/createdAt): draftEntries, violations, and
		// unassignedItems are never loaded. EVAL-C01R1 — deterministic
		// newest-published selection via orderBy [createdAt desc, id desc].
		safe(async (): Promise<{ isPublished: boolean; publishedRunId: number | null }> => {
			if (!activeSchoolYearId) {
				return { isPublished: false, publishedRunId: null };
			}
			const where = buildDashboardPublicationWhere({ schoolId: input.schoolId, schoolYearId: activeSchoolYearId });
			const row = await prisma.generationRun.findFirst({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: { id: true, status: true, summary: true, createdAt: true },
			});
			if (!row) return { isPublished: false, publishedRunId: null };
			return isStrictlyPublishedRun({ status: row.status, summary: row.summary })
				? { isPublished: true, publishedRunId: row.id }
				: { isPublished: false, publishedRunId: null };
		}),
		// EVAL-C01 — consume the existing Curriculum Requirements read
		// contract only. A throw (e.g. missing year authority) degrades the
		// snapshot instead of inferring readiness.
		safe(async (): Promise<DashboardCurriculumReadiness | null> => {
			if (!activeSchoolYearId) return null;
			const readiness = await evaluateCurriculumReadiness(input.schoolId, activeSchoolYearId);
			const firstBlocker = readiness.blockers[0] ?? null;
			return {
				ready: readiness.ready,
				termConfigPresent: readiness.termConfigPresent,
				requirementCount: readiness.requirementCount,
				blockerCode: firstBlocker?.code ?? null,
				blockerMessage: firstBlocker?.message ?? null,
			};
		}),
	]);

	const campus = campusResult.data
		? summarizeCampus(campusResult.data.buildings, campusResult.data.campusImageUrl)
		: summarizeCampus([], null);
	const subjects = subjectResult.data ?? { subjectCount: 0, unassignedSubjectCount: 0 };
	const faculty = facultyResult.data ?? { facultyCount: 0, lastSyncedAt: null };
	const sections = sectionResult.data ?? { sectionCount: null, lastSyncedAt: null };
	const latestRun = generationResult.data ?? {
		latestRunStatus: 'NONE' as const,
		latestRunId: null,
		violationCount: null,
		createdAt: null,
		finishedAt: null,
	};
	const curriculum = curriculumResult.ok ? curriculumResult.data : null;
	const hasDomainError = !runtimeResult.ok || !campusResult.ok || !subjectResult.ok || !facultyResult.ok || !sectionResult.ok || !generationResult.ok || !publicationResult.ok || !curriculumResult.ok;
	const publication = publicationResult.ok
		? (publicationResult.data ?? { isPublished: false, publishedRunId: null })
		: { isPublished: false, publishedRunId: null };
	const lifecycle = resolveDashboardLifecycle({
		subjectCount: subjects.subjectCount,
		facultyCount: faculty.facultyCount,
		sectionCount: sections.sectionCount,
		unassignedSubjectCount: subjects.unassignedSubjectCount,
		buildingsDone: campus.buildingSetupStatus.done,
		latestRunStatus: latestRun.latestRunStatus,
		publishedRunPresent: publication.isPublished,
		curriculumReady: curriculum?.ready === true,
		hasDomainError,
	});
	const generation: LatestRunReadinessData = {
		latestRunStatus: latestRun.latestRunStatus,
		latestRunId: latestRun.latestRunId,
		violationCount: latestRun.violationCount,
		isPublished: lifecycle.isPublished,
		publishedRunId: lifecycle.isPublished ? publication.publishedRunId : null,
		createdAt: latestRun.createdAt,
		finishedAt: latestRun.finishedAt,
	};
	const hasSavedData = Boolean(
		activeSchoolYearId || campus.buildings.length > 0 || subjects.subjectCount > 0 || faculty.facultyCount > 0 || sections.sectionCount,
	);
	const sourceState = overallSourceState({
		runtimeContext,
		hasSchoolYear: Boolean(activeSchoolYearId),
		hasSavedData,
		hasDomainError,
	});

	return {
		schoolId: input.schoolId,
		activeSchoolYearId,
		activeSchoolYearLabel,
		resolvedAt,
		sourceState: sourceState.state,
		sourceMessage: sourceState.message,
		campus,
		subjects,
		faculty,
		sections,
		generation,
		curriculum,
		lifecyclePhase: lifecycle.phase,
		sources: {
			runtimeContext: runtimeResult.ok && runtimeContext
				? source(
					runtimeContext.source === 'enrollpro-verified' && runtimeContext.stale !== true
						? 'verified_live'
						: 'using_saved_data',
					runtimeContext.source === 'enrollpro-verified'
						? 'Active school year checked against EnrollPro.'
						: 'Active school year resolved from saved ATLAS evidence.',
					runtimeContext.source,
					runtimeContext.resolvedAt,
				)
				: source('no_saved_data', 'No active school year context is available.', 'atlas.runtime_context', resolvedAt, runtimeResult.error),
			campus: campusResult.ok
				? source(campus.buildings.length > 0 ? 'using_saved_data' : 'no_saved_data', 'Campus readiness loaded from ATLAS.', 'atlas.buildings', iso(campusResult.data?.updatedAt))
				: source('partial_degraded', 'Campus readiness could not be loaded.', 'atlas.buildings', resolvedAt, campusResult.error),
			subjects: subjectResult.ok
				? source(subjects.subjectCount > 0 ? 'using_saved_data' : 'no_saved_data', 'Subject readiness loaded from ATLAS.', 'atlas.subjects', resolvedAt)
				: source('partial_degraded', 'Subject readiness could not be loaded.', 'atlas.subjects', resolvedAt, subjectResult.error),
			faculty: facultyResult.ok
				? source(faculty.facultyCount > 0 ? 'using_saved_data' : 'no_saved_data', 'Faculty readiness loaded from ATLAS mirror.', 'atlas.faculty_mirrors', faculty.lastSyncedAt)
				: source('partial_degraded', 'Faculty readiness could not be loaded.', 'atlas.faculty_mirrors', resolvedAt, facultyResult.error),
			sections: sectionResult.ok
				? source(sections.sectionCount && sections.sectionCount > 0 ? 'using_saved_data' : 'no_saved_data', 'Section readiness loaded from ATLAS mirror.', 'atlas.section_mirrors', sections.lastSyncedAt)
				: source('partial_degraded', 'Section readiness could not be loaded.', 'atlas.section_mirrors', resolvedAt, sectionResult.error),
			generation: generationResult.ok
				? source(generation.latestRunId ? 'using_saved_data' : 'no_saved_data', 'Latest generation status loaded from ATLAS.', 'atlas.generation_runs', generation.finishedAt ?? generation.createdAt)
				: source('partial_degraded', 'Latest generation status could not be loaded.', 'atlas.generation_runs', resolvedAt, generationResult.error),
			curriculum: curriculumResult.ok && curriculum
				? source(
					curriculum.ready ? 'using_saved_data' : 'no_saved_data',
					curriculum.ready
						? 'Curriculum Requirements are ready for this school year.'
						: (curriculum.blockerMessage ?? 'Curriculum Requirements need attention before generation.'),
					'atlas.curriculum_requirements',
					resolvedAt,
				)
				: source('partial_degraded', 'Curriculum Requirements could not be checked.', 'atlas.curriculum_requirements', resolvedAt, curriculumResult.error),
		},
	};
}