/**
 * Class Program Matrix Export Service
 *
 * Generates grade-level class-program output where every section in the grade
 * appears as a column with canonical time rows. Each row preserves the full
 * weekday identity: a Monday entry never populates Tuesday-Friday and
 * same-interval entries on different weekdays coexist.
 *
 * The source is bound to one effective run (requested or latest completed) and
 * one selected ordered term, matching the reviewed workbook export route. There
 * is no stale-faculty fallback: when no run/term can be bound the service fails
 * closed with a typed empty result rather than silently showing a stale run.
 */

import { getDataContext } from '../lib/data-context.js';
import { resolveCanonicalSlotsForPrograms, normalizeGradeLevelSync } from './class-program-slot.service.js';
import { resolvePublishedRun } from './published-schedule.service.js';

const db = () => getDataContext();

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

// ─── Types ───

export type SpecializationVisibility = 'hidden' | 'visible';

export interface ClassProgramMatrixParams {
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	visibility?: SpecializationVisibility;
	/** Explicit source run. When omitted the latest completed run is bound. */
	runId?: number;
	/** Resolved numeric ordered-term index from the verified term authority. */
	termIndex?: number;
	/** Disposable read-only client for source-level output contract tests. */
	client?: any;
	/** Disposable published-run resolver for source-level output contract tests. */
	publishedRunResolver?: (schoolId: number, schoolYearId: number) => Promise<{
		source: { runId: number };
		entries: RawEntry[];
		summary: Record<string, unknown> | null;
	}>;
}

export interface MatrixCell {
	day: string;
	timeSlot: string;
	subject: string | null;
	teacher: string | null;
	room: string | null;
	isSpecialization: boolean;
}

export interface MatrixColumn {
	sectionId: number;
	sectionName: string;
	programType: string | null;
	/** One cell per visible class time row per weekday (row-major). */
	entries: MatrixCell[];
}

export interface ClassProgramMatrixOutput {
	gradeLevel: number;
	schoolYear: string;
	sourceRunId: number | null;
	termIndex: number | null;
	timeRows: Array<{
		startTime: string;
		endTime: string;
		rowKind: string;
		label: string;
	}>;
	columns: MatrixColumn[];
	warnings: string[];
}

type RawEntry = {
	sectionId: number;
	subjectId: number | null;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	termIndex?: number | null;
};

function isSpecializationSubject(subject: { name?: string | null; code?: string | null } | undefined): boolean {
	const code = (subject?.code ?? '').trim().toUpperCase();
	const name = (subject?.name ?? '').trim().toUpperCase();
	return code.includes('_SPEC')
		|| code.includes('SPECIALIZATION')
		|| name.includes('SPECIALIZATION')
		|| name.startsWith('SPECIAL PROGRAM ');
}

async function resolveSourceRun(
	params: ClassProgramMatrixParams,
): Promise<{ runId: number; entries: RawEntry[]; summary: Record<string, unknown> | null } | null> {
	const { schoolId, schoolYearId, runId } = params;
	const database = (params.client ?? db()) as ReturnType<typeof db>;

	const loadRun = async (id: number) => database.generationRun.findFirst({
		where: { id, schoolId, schoolYearId },
		select: { id: true, status: true, summary: true, draftEntries: true },
	});

	let selectedId: number | null = null;
	if (runId != null) {
		selectedId = runId;
	} else {
		// Lightweight candidate selection: metadata only, then one heavy read for
		// the selected run. Never scan every completed run's JSON payload.
		const candidate = await database.generationRun.findFirst({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			select: { id: true },
		});
		if (!candidate) return null;
		selectedId = candidate.id;
	}
	if (selectedId === null) return null;

	const run = await loadRun(selectedId);
	if (!run) {
		if (runId != null) throw new Error('RUN_NOT_FOUND');
		return null;
	}
	const summary = run.summary as Record<string, unknown> | null;
	if (run.status !== 'COMPLETED' && summary?.isPublished !== true) {
		throw new Error('RUN_NOT_COMPLETED');
	}

	if (summary?.isPublished === true) {
		// A published source must use the revision-effective authority, exactly
		// like the reviewed workbook route; never the pre-revision draft JSON.
		const resolvePublished = params.publishedRunResolver ?? resolvePublishedRun;
		const published = await resolvePublished(schoolId, schoolYearId);
		if (published.source.runId !== run.id) {
			if (runId != null) throw new Error('RUN_NOT_FOUND');
			return null;
		}
		return {
			runId: run.id,
			entries: published.entries as unknown as RawEntry[],
			summary: published.summary,
		};
	}

	return { runId: run.id, entries: (run.draftEntries ?? []) as unknown as RawEntry[], summary };
}

function applyTermFilter(entries: RawEntry[], termIndex: number | undefined): RawEntry[] {
	if (termIndex === undefined) return entries;
	if (entries.some((entry) => entry.termIndex == null)) {
		throw new Error('TERM_FILTER_NOT_READY');
	}
	return entries.filter((entry) => entry.termIndex === termIndex);
}

// ─── Export Function ───

export async function generateClassProgramMatrix(
	params: ClassProgramMatrixParams,
): Promise<ClassProgramMatrixOutput> {
	const { schoolId, schoolYearId, gradeLevel, visibility = 'hidden', termIndex } = params;
	const actualGrade = normalizeGradeLevelSync(gradeLevel);
	const warnings: string[] = [];
	const database = (params.client ?? db()) as ReturnType<typeof db>;

	// 1. Load all active sections for this grade
	const sections = await database.sectionMirror.findMany({
		where: {
			schoolId,
			schoolYearId,
			gradeLevelName: `Grade ${actualGrade}`,
			isActiveForScheduling: true,
			isStale: false,
		},
		select: {
			id: true,
			externalId: true,
			name: true,
			programType: true,
		},
		orderBy: { name: 'asc' },
	});

	// 2. Resolve the union of exact program templates represented in this grade.
	const canonicalSlots = await resolveCanonicalSlotsForPrograms(
		schoolId,
		schoolYearId,
		actualGrade,
		['REGULAR', ...sections.map((section) => section.programType as any)],
	);

	if (sections.length === 0) {
		warnings.push(`No active sections found for Grade ${actualGrade}`);
	}

	// 3. Build time rows from canonical slots
	const timeRows = canonicalSlots.map(slot => ({
		startTime: slot.startTime,
		endTime: slot.endTime,
		rowKind: slot.rowKind,
		label: slot.subjectLabel ?? slot.rowKind,
	}));

	// 4. Bind one effective run + selected ordered term.
	const source = await resolveSourceRun(params);
	if (!source) {
		warnings.push('NO_SOURCE_RUN');
		const mirror = await database.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, enrollProSchoolYearId: schoolYearId },
			select: { yearLabel: true },
		});
		return {
			gradeLevel: actualGrade,
			schoolYear: mirror?.yearLabel ?? String(schoolYearId),
			sourceRunId: null,
			termIndex: termIndex ?? null,
			timeRows,
			columns: [],
			warnings,
		};
	}

	const sectionExternalIds = sections.map(s => s.externalId);
	const allEntries = applyTermFilter(source.entries, termIndex)
		.filter(e => sectionExternalIds.includes(e.sectionId));

	// 5. Collect unique room and faculty IDs from entries for label maps
	const roomIds = [...new Set(allEntries.map(e => e.roomId).filter((id): id is number => id != null && id > 0))];
	const facultyIds = [...new Set(allEntries.map(e => e.facultyId).filter((id): id is number => id != null && id > 0))];

	// 6. Load subject, faculty, and room maps for labels
	const [subjects, faculty, rooms] = await Promise.all([
		database.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, name: true, code: true },
		}),
		facultyIds.length > 0
			? database.facultyMirror.findMany({
				where: { id: { in: facultyIds }, schoolId, isStale: false },
				select: { id: true, firstName: true, lastName: true },
			})
			: Promise.resolve([]),
		roomIds.length > 0
			? database.room.findMany({
				where: { id: { in: roomIds } },
				select: { id: true, name: true, building: { select: { name: true } } },
			})
			: Promise.resolve([]),
	]);

	const subjectMap = new Map(subjects.map(s => [s.id, s]));
	const facultyMap = new Map(faculty.map(f => [f.id, `${f.lastName}, ${f.firstName}`]));
	const roomMap = new Map(rooms.map(r => [r.id, `${r.building.name} / ${r.name}`]));

	// 7. Compute visible time rows (hidden mode omits specialization rows)
	const hasSpecialProgramSections = sections.some(s => s.programType && s.programType !== 'REGULAR');
	const visibleTimeRows = visibility === 'hidden' && hasSpecialProgramSections
		? timeRows.filter(row => row.label !== 'Specialization')
		: timeRows;

	// 8. Build weekday-preserving columns. Each cell keeps (day, interval,
	// section, subject, faculty, room); no first-entry-by-interval selection.
	const columns: MatrixColumn[] = sections.map(section => {
		const sectionEntries = allEntries.filter(e => e.sectionId === section.externalId);
		const isSpecialProgram = !!(section.programType && section.programType !== 'REGULAR');
		const cells: MatrixCell[] = [];

		for (const row of visibleTimeRows) {
			if (row.rowKind !== 'CLASS') continue;
			for (const day of WEEKDAYS) {
				const matchingEntry = sectionEntries.find(e =>
					e.day === day && e.startTime === row.startTime && e.endTime === row.endTime
				);
				const matchingSubject = matchingEntry?.subjectId ? subjectMap.get(matchingEntry.subjectId) : undefined;
				const subjectCode = (matchingSubject?.code ?? '').trim().toUpperCase();
				// HG/ARAL are reference-only: never ordinary timetable cells.
				const referenceOnly = subjectCode === 'HG' || subjectCode === 'ARAL';
				const hideSpecializationCell = visibility === 'hidden' && isSpecializationSubject(matchingSubject);

				cells.push({
					day,
					timeSlot: `${row.startTime}-${row.endTime}`,
					subject: !referenceOnly && !hideSpecializationCell && matchingSubject ? matchingSubject.name : null,
					teacher: !referenceOnly && !hideSpecializationCell && matchingEntry?.facultyId
						? facultyMap.get(matchingEntry.facultyId) ?? null
						: null,
					room: !referenceOnly && !hideSpecializationCell && matchingEntry?.roomId
						? roomMap.get(matchingEntry.roomId) ?? null
						: null,
					isSpecialization: isSpecialProgram && row.label === 'Specialization',
				});
			}
		}

		return {
			sectionId: section.id,
			sectionName: section.name,
			programType: section.programType,
			entries: cells,
		};
	});

	// 9. Load school year label
	const mirror = await database.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		select: { yearLabel: true },
	});

	return {
		gradeLevel: actualGrade,
		schoolYear: mirror?.yearLabel ?? String(schoolYearId),
		sourceRunId: source.runId,
		termIndex: termIndex ?? null,
		timeRows: visibleTimeRows,
		columns,
		warnings,
	};
}

/**
 * Validate specialization visibility parameter.
 */
export function validateSpecializationVisibility(value: string | undefined): SpecializationVisibility | null {
	if (!value) return 'hidden'; // Default
	const normalized = value.toLowerCase().trim();
	if (normalized === 'hidden' || normalized === 'visible') return normalized;
	return null; // Invalid
}
