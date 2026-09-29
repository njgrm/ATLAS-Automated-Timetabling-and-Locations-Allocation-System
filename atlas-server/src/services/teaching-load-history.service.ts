import { getDataContext } from '../lib/data-context.js';

const db = () => getDataContext();

type HistoryServiceError = Error & { statusCode: number; code: string };

function fail(statusCode: number, code: string, message: string): never {
	const error = new Error(message) as HistoryServiceError;
	error.statusCode = statusCode;
	error.code = code;
	throw error;
}

/**
 * A9 c5 — the plain year states, REUSED from A7-C2's `listSchoolYears`
 * (`enrollpro-rollover.service.ts`) rather than invented a second time. The
 * School Year Setup card and this page now say the same three words about the
 * same year.
 *
 *  - `current`          the year ATLAS is working in now
 *  - `past`             genuinely past, not yet "kept as history"
 *  - `kept as history`  genuinely past AND archived
 */
export type TeachingLoadHistoryYearState = 'current' | 'past' | 'kept as history';

/**
 * The leading four-digit year of a label, or `null` when there is not one.
 *
 * `2022-2023` -> 2022, `SY 2025-2026` -> 2025. This is the ONLY thing "past" is
 * decided from, because it is the only thing a year label actually asserts.
 * `null` means the label cannot be ordered against another label, and an
 * unorderable year is never offered as history: a fail-closed guess here would
 * show a scheduler last year's load as this year's.
 */
export function teachingLoadHistoryYearStart(yearLabel: string | null | undefined): number | null {
	const match = /\d{4}/.exec(String(yearLabel ?? ''));
	if (!match) return null;
	const year = Number(match[0]);
	return Number.isInteger(year) ? year : null;
}

/** The mirror that wins the active-year election: `isActive`, highest id wins a tie. */
function pickActive<T extends { isActive: boolean; enrollProSchoolYearId: number }>(mirrors: T[]): T | null {
	return mirrors
		.filter((mirror) => mirror.isActive)
		.reduce<T | null>(
			(best, mirror) => (best === null || mirror.enrollProSchoolYearId > best.enrollProSchoolYearId ? mirror : best),
			null,
		);
}

export type TeachingLoadHistoryCycle = {
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: string;
	updatedAt: string;
};

export type TeachingLoadHistoryYear = {
	schoolYearId: number;
	yearLabel: string;
	/** A9 c5: no longer a `true` literal — a past year that is not yet kept is false. */
	isArchived: boolean;
	state: TeachingLoadHistoryYearState;
	/** A9 c5: how many subject assignments this year actually holds, in ONE query. */
	assignmentCount: number;
	archivedAt: string | null;
	archiveReason: string | null;
	cycle: TeachingLoadHistoryCycle | null;
};

export type TeachingLoadHistoryFutureYear = { schoolYearId: number; yearLabel: string };

export type TeachingLoadHistoryYears = {
	schoolId: number;
	activeSchoolYearId: number | null;
	activeYearLabel: string | null;
	years: TeachingLoadHistoryYear[];
	/** Drill/future years, named so the page can disclose them instead of hiding them. */
	futureYears: TeachingLoadHistoryFutureYear[];
};

/**
 * A9 c5 — EVERY school year the school has, classified from its own label.
 *
 * The previous query filtered `isArchived: true`, which is exactly why 2022-2023
 * (past, not yet kept) was unreachable: it existed, and the filter excluded it.
 * Reading every mirror and ordering by `yearStart` fixes the whole class, and it
 * is the same shape A7-C2 already uses for School Year Setup.
 *
 * Ordering is most recent first (`yearStart` desc, then id desc) so the year a
 * scheduler wants is the first option they see.
 */
export async function listTeachingLoadHistoryYears(schoolId: number): Promise<TeachingLoadHistoryYears> {
	const mirrors = await db().enrollProSchoolYearMirror.findMany({
		where: { schoolId },
		select: {
			enrollProSchoolYearId: true,
			yearLabel: true,
			isActive: true,
			isArchived: true,
			archivedAt: true,
			archiveReason: true,
		},
	});
	const active = pickActive(mirrors);
	const activeStart = active ? teachingLoadHistoryYearStart(active.yearLabel) : null;

	type Mirror = (typeof mirrors)[number];
	type RankedMirror = { mirror: Mirror; start: number };

	const past = mirrors
		.filter((mirror) => mirror.enrollProSchoolYearId !== active?.enrollProSchoolYearId)
		.map((mirror) => ({ mirror, start: teachingLoadHistoryYearStart(mirror.yearLabel) }))
		// The type predicate is load-bearing, not decoration: the comparators below
		// subtract `start`, and a null there would sort a year as `NaN` into an
		// arbitrary position instead of excluding it.
		.filter((entry): entry is RankedMirror => entry.start !== null && activeStart !== null && entry.start < activeStart)
		.sort((a, b) => b.start - a.start || b.mirror.enrollProSchoolYearId - a.mirror.enrollProSchoolYearId);

	const futureYears = mirrors
		.filter((mirror) => mirror.enrollProSchoolYearId !== active?.enrollProSchoolYearId)
		.map((mirror) => ({ mirror, start: teachingLoadHistoryYearStart(mirror.yearLabel) }))
		.filter(({ start }) => start === null || activeStart === null || start >= activeStart)
		// A label with no year in it cannot be ordered, so it sorts last and is only
		// ever named in the disclosure line.
		.sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER)
			|| a.mirror.enrollProSchoolYearId - b.mirror.enrollProSchoolYearId)
		.map(({ mirror }) => ({ schoolYearId: mirror.enrollProSchoolYearId, yearLabel: mirror.yearLabel }));

	if (past.length === 0) {
		return { schoolId, activeSchoolYearId: active?.enrollProSchoolYearId ?? null, activeYearLabel: active?.yearLabel ?? null, years: [], futureYears };
	}

	const pastYearIds = past.map(({ mirror }) => mirror.enrollProSchoolYearId);
	// ONE query for every offered year, so a school with twenty past years still
	// costs a single round trip rather than twenty.
	const counts = await db().facultySubject.groupBy({
		by: ['schoolYearId'],
		where: { schoolId, schoolYearId: { in: pastYearIds } },
		_count: { _all: true },
	}) as unknown as Array<{ schoolYearId: number; _count: { _all: number } }>;
	const countByYear = new Map(counts.map((row) => [row.schoolYearId, row._count._all]));

	const cycles = await db().teachingLoadCycle.findMany({
		where: { schoolId, schoolYearId: { in: pastYearIds } },
		select: {
			schoolYearId: true,
			state: true,
			version: true,
			initializedAt: true,
			updatedAt: true,
		},
	});
	const cycleByYear = new Map(cycles.map((cycle) => [cycle.schoolYearId, cycle]));

	return {
		schoolId,
		activeSchoolYearId: active?.enrollProSchoolYearId ?? null,
		activeYearLabel: active?.yearLabel ?? null,
		years: past.map(({ mirror }) => {
			const cycle = cycleByYear.get(mirror.enrollProSchoolYearId);
			return {
				schoolYearId: mirror.enrollProSchoolYearId,
				yearLabel: mirror.yearLabel,
				isArchived: mirror.isArchived,
				state: (mirror.isArchived ? 'kept as history' : 'past') as TeachingLoadHistoryYearState,
				// A year with no saved assignments is still LISTED. Dropping it is how
				// a scheduler concludes the year was never saved, which is a claim
				// about data the page cannot make.
				assignmentCount: countByYear.get(mirror.enrollProSchoolYearId) ?? 0,
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
		}),
		futureYears,
	};
}

export async function getTeachingLoadHistory(schoolId: number, schoolYearId: number) {
	const mirror = await db().enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: {
			enrollProSchoolYearId: true,
			yearLabel: true,
			isActive: true,
			isArchived: true,
			archivedAt: true,
			archiveReason: true,
		},
	});
	if (!mirror) fail(404, 'HISTORY_YEAR_NOT_FOUND', 'No school-year history exists for this school and year.');

	const active = await db().enrollProSchoolYearMirror.findFirst({
		where: { schoolId, isActive: true },
		orderBy: { enrollProSchoolYearId: 'desc' },
		select: { enrollProSchoolYearId: true, yearLabel: true },
	});
	if (mirror.enrollProSchoolYearId === active?.enrollProSchoolYearId) {
		fail(409, 'HISTORY_YEAR_IS_CURRENT', 'This is the current Teaching Load. Open Teaching Load to work on it.');
	}

	/**
	 * A9 c5 — the readable rule, exactly: a kept year, or a year that is strictly
	 * before the active year. A past year that has NOT been kept yet is readable,
	 * because that is the year a scheduler most wants and the old `isArchived`
	 * test refused it with `HISTORY_YEAR_NOT_ARCHIVED`.
	 *
	 * Everything else still fails closed, and the failure says which of the two
	 * things went wrong, so the page never answers a past-year question with a
	 * future-year message.
	 */
	const start = teachingLoadHistoryYearStart(mirror.yearLabel);
	const activeStart = active ? teachingLoadHistoryYearStart(active.yearLabel) : null;
	const readable = mirror.isArchived === true || (start !== null && activeStart !== null && start < activeStart);
	if (!readable) {
		fail(409, 'HISTORY_YEAR_NOT_PAST', 'This school year is not a past year, so it cannot be opened as Teaching Load history.');
	}

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
	if (!cycle) fail(404, 'TEACHING_LOAD_CYCLE_NOT_FOUND', 'This school year has no annual Teaching Load cycle.');

	const sectionById = new Map(sections.map((section) => [section.externalId, section]));
	const teachers = new Map<number, {
		facultyId: number;
		facultyName: string;
		department: string | null;
		/** A9 c5: teaching minutes and class count per WEEK, so the page can answer "what was this teacher's load?". */
		weeklyMinutes: number;
		classCount: number;
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
			weeklyMinutes: 0,
			classCount: 0,
			assignments: [],
		};
		const classCount = assignment.sectionIds.length;
		// `minMinutesPerWeek` is the subject's own weekly demand, so one subject
		// taught across three sections is that demand three times over.
		row.weeklyMinutes += assignment.subject.minMinutesPerWeek * classCount;
		row.classCount += classCount;
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
		isArchived: mirror.isArchived,
		state: (mirror.isArchived ? 'kept as history' : 'past') as Exclude<TeachingLoadHistoryYearState, 'current'>,
		activeSchoolYearId: active?.enrollProSchoolYearId ?? null,
		activeYearLabel: active?.yearLabel ?? null,
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
