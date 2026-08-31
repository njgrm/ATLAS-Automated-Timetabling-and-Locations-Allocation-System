/**
 * Class Program Matrix Export Service
 *
 * Generates grade-level class-program matrix output where every section
 * in the grade appears as a column, with canonical time rows.
 *
 * Supports specialization visibility toggle for non-regular sections.
 * Uses effective schedule truth (latest valid completed run with stale-faculty check).
 */

import { prisma } from '../lib/prisma.js';
import { resolveClassProgramSlots, normalizeGradeLevelSync } from './class-program-slot.service.js';

// ─── Types ───

export type SpecializationVisibility = 'hidden' | 'visible';

export interface ClassProgramMatrixParams {
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	visibility?: SpecializationVisibility;
}

export interface MatrixColumn {
	sectionId: number;
	sectionName: string;
	programType: string | null;
	entries: Array<{
		timeSlot: string;
		subject: string | null;
		teacher: string | null;
		room: string | null;
		isSpecialization: boolean;
	}>;
}

export interface ClassProgramMatrixOutput {
	gradeLevel: number;
	schoolYear: string;
	timeRows: Array<{
		startTime: string;
		endTime: string;
		rowKind: string;
		label: string;
	}>;
	columns: MatrixColumn[];
	warnings: string[];
}

// ─── Run Resolution ───

type RawEntry = {
	sectionId: number;
	subjectId: number | null;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
};

function isSpecializationSubject(subject: { name?: string | null; code?: string | null } | undefined): boolean {
	const code = (subject?.code ?? '').trim().toUpperCase();
	const name = (subject?.name ?? '').trim().toUpperCase();
	return code.includes('_SPEC')
		|| code.includes('SPECIALIZATION')
		|| name.includes('SPECIALIZATION')
		|| name.startsWith('SPECIAL PROGRAM ');
}

/**
 * Resolve the latest valid completed run for a school/year.
 * Selects lightweight candidate metadata first, then loads only the
 * selected run's draftEntries to verify no stale faculty references.
 */
async function resolveLatestValidEntries(
	schoolId: number,
	schoolYearId: number,
): Promise<RawEntry[]> {
	const candidates = await prisma.generationRun.findMany({
		where: { schoolId, schoolYearId, status: 'COMPLETED' },
		orderBy: { createdAt: 'desc' },
		select: { id: true },
		take: 20,
	});

	if (candidates.length === 0) return [];

	// Load active faculty IDs for stale check
	const activeFaculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isStale: false },
		select: { id: true },
	});
	const activeFacultyIds = new Set(activeFaculty.map(f => f.id));

	for (const candidate of candidates) {
		const run = await prisma.generationRun.findUnique({
			where: { id: candidate.id },
			select: { draftEntries: true },
		});
		if (!run?.draftEntries) continue;
		const entries = run.draftEntries as unknown as RawEntry[];
		const hasStaleFaculty = entries.some(e => e.facultyId != null && !activeFacultyIds.has(e.facultyId));
		if (!hasStaleFaculty) return entries;
	}

	// Fallback: return newest run's entries even if stale (better than empty)
	const fallback = await prisma.generationRun.findUnique({
		where: { id: candidates[0].id },
		select: { draftEntries: true },
	});
	return (fallback?.draftEntries as unknown as RawEntry[]) ?? [];
}

// ─── Export Function ───

/**
 * Generate a grade-level class-program matrix.
 * Every active section in the grade appears as a column.
 * Canonical time rows are used for row ordering.
 */
export async function generateClassProgramMatrix(
	params: ClassProgramMatrixParams,
): Promise<ClassProgramMatrixOutput> {
	const { schoolId, schoolYearId, gradeLevel, visibility = 'hidden' } = params;
	const actualGrade = normalizeGradeLevelSync(gradeLevel);
	const warnings: string[] = [];

	// 1. Load canonical time rows
	const canonicalSlots = await resolveClassProgramSlots(schoolId, schoolYearId, actualGrade);

	// 2. Load all active sections for this grade
	const sections = await prisma.sectionMirror.findMany({
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

	// 4. Load effective schedule entries (latest valid completed run)
	const sectionExternalIds = sections.map(s => s.externalId);
	const allEntries = sectionExternalIds.length > 0
		? await resolveLatestValidEntries(schoolId, schoolYearId)
		: [];
	const entries = allEntries.filter(e => sectionExternalIds.includes(e.sectionId));

	// 5. Collect unique room and faculty IDs from entries for label maps
	const roomIds = [...new Set(entries.map(e => e.roomId).filter((id): id is number => id != null && id > 0))];
	const facultyIds = [...new Set(entries.map(e => e.facultyId).filter((id): id is number => id != null && id > 0))];

	// 6. Load subject, faculty, and room maps for labels
	const [subjects, faculty, rooms] = await Promise.all([
		prisma.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, name: true, code: true },
		}),
		facultyIds.length > 0
			? prisma.facultyMirror.findMany({
				where: { id: { in: facultyIds }, schoolId, isStale: false },
				select: { id: true, firstName: true, lastName: true },
			})
			: Promise.resolve([]),
		roomIds.length > 0
			? prisma.room.findMany({
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

	// 8. Build columns with entries mapped to visible time rows
	const columns: MatrixColumn[] = sections.map(section => {
		const sectionEntries = entries.filter(e => e.sectionId === section.externalId);
		const isSpecialProgram = section.programType && section.programType !== 'REGULAR';

		const entriesForSection = visibleTimeRows.map(row => {
			const matchingEntry = sectionEntries.find(e =>
				e.startTime === row.startTime && e.endTime === row.endTime
			);
			const matchingSubject = matchingEntry?.subjectId ? subjectMap.get(matchingEntry.subjectId) : undefined;
			const hideSpecializationCell = visibility === 'hidden' && isSpecializationSubject(matchingSubject);

			const isSpecialization = !!(isSpecialProgram && row.label === 'Specialization');

			return {
				timeSlot: `${row.startTime}-${row.endTime}`,
				subject: !hideSpecializationCell && matchingSubject ? matchingSubject.name : null,
				teacher: !hideSpecializationCell && matchingEntry?.facultyId ? facultyMap.get(matchingEntry.facultyId) ?? null : null,
				room: !hideSpecializationCell && matchingEntry?.roomId ? roomMap.get(matchingEntry.roomId) ?? null : null,
				isSpecialization,
			};
		});

		return {
			sectionId: section.id,
			sectionName: section.name,
			programType: section.programType,
			entries: entriesForSection,
		};
	});

	// 9. Load school year label
	const mirror = await prisma.enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		select: { yearLabel: true },
	});

	return {
		gradeLevel: actualGrade,
		schoolYear: mirror?.yearLabel ?? String(schoolYearId),
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
