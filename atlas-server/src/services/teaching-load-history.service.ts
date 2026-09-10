import { getDataContext } from '../lib/data-context.js';

const db = () => getDataContext();

type HistoryServiceError = Error & { statusCode: number; code: string };

function fail(statusCode: number, code: string, message: string): never {
	const error = new Error(message) as HistoryServiceError;
	error.statusCode = statusCode;
	error.code = code;
	throw error;
}

export type TeachingLoadHistoryYear = {
	schoolYearId: number;
	yearLabel: string;
	isArchived: true;
	archivedAt: string | null;
	archiveReason: string | null;
	cycle: {
		state: 'EMPTY' | 'POPULATED';
		version: number;
		initializedAt: string;
		updatedAt: string;
	} | null;
};

export async function listTeachingLoadHistoryYears(schoolId: number): Promise<TeachingLoadHistoryYear[]> {
	const mirrors = await db().enrollProSchoolYearMirror.findMany({
		where: { schoolId, isArchived: true },
		select: {
			enrollProSchoolYearId: true,
			yearLabel: true,
			isArchived: true,
			archivedAt: true,
			archiveReason: true,
		},
		orderBy: [{ archivedAt: 'desc' }, { enrollProSchoolYearId: 'desc' }],
	});
	if (mirrors.length === 0) return [];

	const yearIds = mirrors.map((mirror) => mirror.enrollProSchoolYearId);
	const cycles = await db().teachingLoadCycle.findMany({
		where: { schoolId, schoolYearId: { in: yearIds } },
		select: {
			schoolYearId: true,
			state: true,
			version: true,
			initializedAt: true,
			updatedAt: true,
		},
	});
	const cycleByYear = new Map(cycles.map((cycle) => [cycle.schoolYearId, cycle]));

	return mirrors.map((mirror) => {
		const cycle = cycleByYear.get(mirror.enrollProSchoolYearId);
		return {
			schoolYearId: mirror.enrollProSchoolYearId,
			yearLabel: mirror.yearLabel,
			isArchived: true,
			archivedAt: mirror.archivedAt?.toISOString() ?? null,
			archiveReason: mirror.archiveReason ?? null,
			cycle: cycle
				? {
					state: cycle.state,
					version: cycle.version,
					initializedAt: cycle.initializedAt.toISOString(),
					updatedAt: cycle.updatedAt.toISOString(),
				}
				: null,
		};
	});
}

export async function getTeachingLoadHistory(schoolId: number, schoolYearId: number) {
	const mirror = await db().enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: {
			enrollProSchoolYearId: true,
			yearLabel: true,
			isArchived: true,
			archivedAt: true,
			archiveReason: true,
		},
	});
	if (!mirror) fail(404, 'HISTORY_YEAR_NOT_FOUND', 'No school-year history exists for this school and year.');
	if (!mirror.isArchived) fail(409, 'HISTORY_YEAR_NOT_ARCHIVED', 'Only archived school years can be opened as Teaching Load history.');

	const [cycle, assignments, sections] = await Promise.all([
		db().teachingLoadCycle.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { state: true, version: true, initializedAt: true, updatedAt: true },
		}),
		db().facultySubject.findMany({
			where: { schoolId, schoolYearId },
			select: {
				id: true,
				sectionIds: true,
				assignedAt: true,
				faculty: {
					select: { id: true, firstName: true, lastName: true, department: true },
				},
				subject: {
					select: { id: true, code: true, name: true, outputLabel: true, minMinutesPerWeek: true },
				},
			},
			orderBy: [{ faculty: { lastName: 'asc' } }, { faculty: { firstName: 'asc' } }, { subject: { code: 'asc' } }],
		}),
		db().sectionMirror.findMany({
			where: { schoolId, schoolYearId },
			select: { externalId: true, name: true, gradeLevelName: true, displayOrder: true },
		}),
	]);
	if (!cycle) fail(404, 'TEACHING_LOAD_CYCLE_NOT_FOUND', 'This archived school year has no annual Teaching Load cycle.');

	const sectionById = new Map(sections.map((section) => [section.externalId, section]));
	const teachers = new Map<number, {
		facultyId: number;
		facultyName: string;
		department: string | null;
		assignments: Array<{
			facultySubjectId: number;
			subjectId: number;
			subjectCode: string;
			subjectName: string;
			minutesPerWeek: number;
			assignedAt: string;
			sections: Array<{ sectionId: number; sectionName: string; gradeLevelName: string }>;
		}>;
	}>();

	for (const assignment of assignments) {
		const faculty = assignment.faculty;
		const row = teachers.get(faculty.id) ?? {
			facultyId: faculty.id,
			facultyName: `${faculty.lastName}, ${faculty.firstName}`,
			department: faculty.department,
			assignments: [],
		};
		row.assignments.push({
			facultySubjectId: assignment.id,
			subjectId: assignment.subject.id,
			subjectCode: assignment.subject.code,
			subjectName: assignment.subject.outputLabel ?? assignment.subject.name,
			minutesPerWeek: assignment.subject.minMinutesPerWeek,
			assignedAt: assignment.assignedAt.toISOString(),
			sections: assignment.sectionIds.map((sectionId) => {
				const section = sectionById.get(sectionId);
				return {
					sectionId,
					sectionName: section?.name ?? `Section #${sectionId}`,
					gradeLevelName: section?.gradeLevelName ?? (section?.displayOrder ? `Grade ${section.displayOrder}` : 'Grade unavailable'),
				};
			}),
		});
		teachers.set(faculty.id, row);
	}

	return {
		schoolId,
		schoolYearId,
		yearLabel: mirror.yearLabel,
		isArchived: true as const,
		archivedAt: mirror.archivedAt?.toISOString() ?? null,
		archiveReason: mirror.archiveReason ?? null,
		cycle: {
			state: cycle.state,
			version: cycle.version,
			initializedAt: cycle.initializedAt.toISOString(),
			updatedAt: cycle.updatedAt.toISOString(),
		},
		teachers: Array.from(teachers.values()),
		totals: {
			teachers: teachers.size,
			assignments: assignments.length,
			sections: new Set(assignments.flatMap((assignment) => assignment.sectionIds)).size,
		},
	};
}
