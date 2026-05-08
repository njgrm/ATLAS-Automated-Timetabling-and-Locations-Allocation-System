import { prisma } from '../lib/prisma.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

function err(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	e.actionHint = options?.actionHint;
	e.details = options?.details;
	return e;
}

function extractDraftFacultyIds(draftEntries: unknown): number[] {
	if (!Array.isArray(draftEntries)) return [];
	const facultyIds = draftEntries
		.map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? (entry as { facultyId?: unknown }).facultyId : undefined))
		.filter((facultyId): facultyId is number => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
	return [...new Set(facultyIds)];
}

export type ActiveDraftRun = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	status: 'COMPLETED';
	version: number;
	finishedAt: Date | null;
	createdAt: Date;
	draftEntries: unknown;
};

export async function resolveActiveDraftRun(schoolId: number, schoolYearId: number): Promise<ActiveDraftRun> {
	const latestRun = await prisma.generationRun.findFirst({
		where: { schoolId, schoolYearId, status: 'COMPLETED' },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			status: true,
			version: true,
			finishedAt: true,
			createdAt: true,
			draftEntries: true,
		},
	});

	if (!latestRun) {
		throw err(
			404,
			'NO_ACTIVE_DRAFT',
			'No active draft timetable run is available for this school year.',
			{
				actionHint: 'Ask the scheduling officer to generate a new timetable draft, then refresh this page.',
			},
		);
	}

	const activeFaculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isActiveForScheduling: true, isStale: false },
		select: { id: true },
	});
	const activeFacultyIds = new Set(activeFaculty.map((member) => member.id));
	const staleFacultyIds = extractDraftFacultyIds(latestRun.draftEntries).filter((facultyId) => !activeFacultyIds.has(facultyId));

	if (staleFacultyIds.length > 0) {
		throw err(
			409,
			'STALE_RUN_DATA',
			'Latest draft timetable run references stale faculty assignments.',
			{
				actionHint: 'Trigger a fresh generation run after faculty sync so the latest draft binds to current faculty records.',
				details: {
					latestRunId: latestRun.id,
					staleFacultyIds,
				},
			},
		);
	}

	return {
		...latestRun,
		status: 'COMPLETED',
	};
}
