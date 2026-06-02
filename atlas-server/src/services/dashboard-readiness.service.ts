import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext, type RuntimeContextResult } from './runtime-context.service.js';

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
	schoolYearId?: number;
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
	createdAt: string | null;
	finishedAt: string | null;
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
	lifecyclePhase: DashboardLifecyclePhase;
	sources: {
		runtimeContext: DomainSource;
		campus: DomainSource;
		subjects: DomainSource;
		faculty: DomainSource;
		sections: DomainSource;
		generation: DomainSource;
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

function readPublished(summary: unknown): boolean {
	if (!isRecord(summary)) return false;
	return summary.isPublished === true || typeof summary.publishedAt === 'string' || typeof summary.publishedBy === 'number';
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
	if (args.latestRunIsPublished) return 'PUBLISHED';

	const setupReady =
		args.subjectCount > 0 &&
		args.facultyCount > 0 &&
		args.unassignedSubjectCount === 0 &&
		(args.sectionCount ?? 0) > 0 &&
		args.buildingsDone;

	if (!setupReady) return 'SETUP';
	if (args.latestRunStatus === 'NONE') return 'PREFERENCES';
	if (args.latestRunStatus === 'IN_PROGRESS' || args.latestRunStatus === 'FAILED') return 'GENERATION';
	return 'REVIEW';
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
	const activeSchoolYearId = input.schoolYearId ?? runtimeContext?.activeSchoolYearId ?? null;
	const activeSchoolYearLabel = runtimeContext?.activeSchoolYearLabel ?? null;

	const [campusResult, subjectResult, facultyResult, sectionResult, generationResult] = await Promise.all([
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
					isPublished: false,
					createdAt: null,
					finishedAt: null,
				};
			}
			const run = await prisma.generationRun.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: activeSchoolYearId },
				orderBy: { createdAt: 'desc' },
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
					isPublished: false,
					createdAt: null,
					finishedAt: null,
				};
			}
			return {
				latestRunStatus: mapRunStatus(String(run.status)),
				latestRunId: run.id,
				violationCount: countViolations(run.summary, run.violations),
				isPublished: readPublished(run.summary),
				createdAt: run.createdAt.toISOString(),
				finishedAt: iso(run.finishedAt),
			};
		}),
	]);

	const campus = campusResult.data
		? summarizeCampus(campusResult.data.buildings, campusResult.data.campusImageUrl)
		: summarizeCampus([], null);
	const subjects = subjectResult.data ?? { subjectCount: 0, unassignedSubjectCount: 0 };
	const faculty = facultyResult.data ?? { facultyCount: 0, lastSyncedAt: null };
	const sections = sectionResult.data ?? { sectionCount: null, lastSyncedAt: null };
	const generation = generationResult.data ?? {
		latestRunStatus: 'NONE' as const,
		latestRunId: null,
		violationCount: null,
		isPublished: false,
		createdAt: null,
		finishedAt: null,
	};
	const hasDomainError = !runtimeResult.ok || !campusResult.ok || !subjectResult.ok || !facultyResult.ok || !sectionResult.ok || !generationResult.ok;
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
		lifecyclePhase: lifecyclePhase({
			subjectCount: subjects.subjectCount,
			facultyCount: faculty.facultyCount,
			sectionCount: sections.sectionCount,
			unassignedSubjectCount: subjects.unassignedSubjectCount,
			buildingsDone: campus.buildingSetupStatus.done,
			latestRunStatus: generation.latestRunStatus,
			latestRunIsPublished: generation.isPublished,
		}),
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
		},
	};
}