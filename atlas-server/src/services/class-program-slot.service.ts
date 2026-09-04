/**
 * Class Program Slot Service
 *
 * Manages canonical class-program slot templates that define
 * grade/program-specific class rows and blocked breaks for scheduling.
 *
 * These slots represent the stakeholder class-program template contract
 * Subject labels from the stakeholder documents are source evidence only;
 * generation assigns subjects per section and does not hard-lock them here.
 */

import { prisma } from '../lib/prisma.js';
import type { ProgramType, ClassProgramSlotKind } from '@prisma/client';

// ─── Grade Normalization ───

/**
 * Normalize a grade level ID or name to the actual grade number (7, 8, 9, or 10).
 *
 * EnrollPro uses internal grade_level_ids that do NOT match actual grade numbers.
 * For example, grade_level_id=7 is Grade 9, not Grade 7.
 *
 * This helper extracts the actual grade number from:
 * - Grade level names like "Grade 7", "Grade 10"
 * - Grade level IDs by looking up the name in the database
 */
export async function normalizeGradeLevelForSlots(
	gradeLevelIdOrName: number | string,
	schoolId?: number,
): Promise<number> {
	// If it's a string like "Grade 9", extract the number
	if (typeof gradeLevelIdOrName === 'string') {
		const match = gradeLevelIdOrName.match(/Grade\s+(\d+)/i);
		if (match) return parseInt(match[1], 10);
		// Try parsing as number
		const num = parseInt(gradeLevelIdOrName, 10);
		if (!isNaN(num)) return num;
		return NaN;
	}

	const id = gradeLevelIdOrName;

	// Known mapping for this school (grade_level_id -> actual grade number)
	// This is the canonical mapping from the database
	const KNOWN_MAPPINGS: Record<number, number> = {
		5: 7,  // grade_level_id 5 -> Grade 7
		6: 8,  // grade_level_id 6 -> Grade 8
		7: 9,  // grade_level_id 7 -> Grade 9
		8: 10, // grade_level_id 8 -> Grade 10
		17: 7, // current EnrollPro feed ID 17 -> Grade 7
		18: 8, // current EnrollPro feed ID 18 -> Grade 8
		19: 9, // current EnrollPro feed ID 19 -> Grade 9
		20: 10, // current EnrollPro feed ID 20 -> Grade 10
	};

	if (id in KNOWN_MAPPINGS) return KNOWN_MAPPINGS[id];

	// If ID is already a valid grade number (7-10), return it directly
	if (id >= 7 && id <= 10) return id;

	// If ID >= 100, use the existing normalization (value % 100)
	if (id >= 100) {
		const normalized = id % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}

	// Last resort: try to look up the grade level name from the database
	if (schoolId) {
		const gradeLevel = await prisma.sectionMirror.findFirst({
			where: { schoolId, gradeLevelId: id },
			select: { gradeLevelName: true },
		});
		if (gradeLevel?.gradeLevelName) {
			const match = gradeLevel.gradeLevelName.match(/Grade\s+(\d+)/i);
			if (match) return parseInt(match[1], 10);
		}
	}

	// Return the ID as-is if no normalization possible
	return id;
}

/**
 * Normalize an EnrollPro internal grade_level_id to an actual grade number.
 *
 * EnrollPro uses internal IDs that do NOT match actual grade numbers:
 * - grade_level_id 5 -> Grade 7
 * - grade_level_id 6 -> Grade 8
 * - grade_level_id 7 -> Grade 9
 * - grade_level_id 8 -> Grade 10
 * - current feed IDs 17-20 -> Grades 7-10
 *
 * Use this function when you have an internal EnrollPro ID.
 */
export function normalizeInternalGradeId(gradeLevelId: number): number {
	const KNOWN_MAPPINGS: Record<number, number> = {
		5: 7,  // grade_level_id 5 -> Grade 7
		6: 8,  // grade_level_id 6 -> Grade 8
		7: 9,  // grade_level_id 7 -> Grade 9
		8: 10, // grade_level_id 8 -> Grade 10
		17: 7, // current EnrollPro feed ID 17 -> Grade 7
		18: 8, // current EnrollPro feed ID 18 -> Grade 8
		19: 9, // current EnrollPro feed ID 19 -> Grade 9
		20: 10, // current EnrollPro feed ID 20 -> Grade 10
	};

	if (gradeLevelId in KNOWN_MAPPINGS) return KNOWN_MAPPINGS[gradeLevelId];
	if (gradeLevelId >= 7 && gradeLevelId <= 10) return gradeLevelId;
	if (gradeLevelId >= 100) {
		const normalized = gradeLevelId % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}
	return gradeLevelId;
}

/**
 * Normalize a grade level value to an actual grade number.
 *
 * This function handles both:
 * 1. Actual grade numbers (7, 8, 9, 10) -> pass through
 * 2. Internal EnrollPro IDs (5, 6, 7, 8) -> map to actual grades
 *
 * Since internal ID 7 conflicts with actual grade 7, this function
 * checks if the value is a valid actual grade first, then falls back
 * to internal ID mapping.
 */
export function normalizeGradeLevelSync(gradeLevelId: number): number {
	// If it's already a valid actual grade number (7-10), return as-is
	if (gradeLevelId >= 7 && gradeLevelId <= 10) return gradeLevelId;

	// Known mapping for internal EnrollPro grade_level_ids
	return normalizeInternalGradeId(gradeLevelId);
}

// ─── Types ───

export interface ClassProgramSlotRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	programType: ProgramType | null;
	dayOfWeek: string | null;
	startTime: string;
	endTime: string;
	rowKind: ClassProgramSlotKind;
	subjectFamily: string | null;
	subjectLabel: string | null;
	sourceLabel: string;
	sourceNote: string | null;
	isActive: boolean;
}

export interface ResolvedSlotRow extends ClassProgramSlotRow {
	/** Whether this row came from an exact grade/program match or a grade-only fallback */
	isExactMatch: boolean;
}

// ─── 2026-2027 Stakeholder Template Catalog ───

type CatalogSlot = Omit<ClassProgramSlotRow, 'id' | 'schoolId' | 'schoolYearId' | 'isActive'>;

export const CANONICAL_TEMPLATE_VERSION = 'STAKEHOLDER_DNO_2026_2027_45MIN_R2';
const SOURCE_LABEL = CANONICAL_TEMPLATE_VERSION;

function catalogSlot(
	startTime: string,
	endTime: string,
	rowKind: ClassProgramSlotKind,
	subjectLabel: string | null,
	sourceNote: string,
): CatalogSlot {
	return {
		gradeLevel: 0,
		programType: null,
		dayOfWeek: null,
		startTime,
		endTime,
		rowKind,
		subjectFamily: null,
		subjectLabel,
		sourceLabel: SOURCE_LABEL,
		sourceNote,
	};
}

const GRADE_7_8_REGULAR: CatalogSlot[] = [
	catalogSlot('06:00', '06:45', 'CLASS', 'Class', 'DNO morning base row 1'),
	catalogSlot('06:45', '07:30', 'CLASS', 'Class', 'DNO morning base row 2'),
	catalogSlot('07:30', '08:15', 'CLASS', 'Class', 'DNO morning base row 3'),
	catalogSlot('08:15', '09:00', 'CLASS', 'Class', 'DNO morning base row 4'),
	catalogSlot('09:00', '09:15', 'BREAK', 'Health Break', 'DNO morning health break'),
	catalogSlot('09:15', '10:00', 'CLASS', 'Class', 'DNO morning base row 5'),
	catalogSlot('10:00', '10:45', 'CLASS', 'Class', 'DNO morning base row 6'),
	catalogSlot('10:45', '11:30', 'CLASS', 'Class', 'DNO morning base row 7'),
	catalogSlot('11:30', '12:15', 'CLASS', 'Class', 'DNO morning base row 8'),
	catalogSlot('12:15', '13:00', 'BREAK', 'Lunch Break', 'DNO lunch break'),
];

const GRADE_7_8_SPECIAL = [
	...GRADE_7_8_REGULAR,
	catalogSlot('13:00', '13:45', 'CLASS', 'Specialization', 'DNO expanded morning specialization row 1'),
	catalogSlot('13:45', '14:30', 'CLASS', 'Specialization', 'DNO expanded morning specialization row 2'),
];

const GRADE_9_10_REGULAR: CatalogSlot[] = [
	catalogSlot('12:15', '13:00', 'BREAK', 'Lunch Break', 'DNO afternoon lunch break'),
	catalogSlot('13:00', '13:45', 'CLASS', 'Class', 'DNO afternoon base row 1'),
	catalogSlot('13:45', '14:30', 'CLASS', 'Class', 'DNO afternoon base row 2'),
	catalogSlot('14:30', '15:15', 'CLASS', 'Class', 'DNO afternoon base row 3'),
	catalogSlot('15:15', '15:30', 'BREAK', 'Health Break', 'DNO afternoon health break'),
	catalogSlot('15:30', '16:15', 'CLASS', 'Class', 'DNO afternoon base row 4'),
	catalogSlot('16:15', '17:00', 'CLASS', 'Class', 'DNO afternoon base row 5'),
	catalogSlot('17:00', '17:45', 'CLASS', 'Class', 'DNO afternoon base row 6'),
	catalogSlot('17:45', '18:30', 'CLASS', 'Class', 'DNO afternoon base row 7'),
];

const GRADE_9_10_SPECIAL: CatalogSlot[] = [
	catalogSlot('09:45', '10:30', 'CLASS', 'Specialization', 'Approved 2026-09-03: photographed 09:45 start row — 45-minute specialization class'),
	catalogSlot('10:30', '11:15', 'CLASS', 'Specialization', 'DNO expanded afternoon specialization row 1 (45-minute class)'),
	catalogSlot('11:15', '12:00', 'CLASS', 'Specialization', 'DNO expanded afternoon specialization row 2 (45-minute class per corrected stakeholder contract)'),
	...GRADE_9_10_REGULAR,
];

export const KNOWN_PROGRAM_TYPES: ProgramType[] = ['REGULAR', 'STE', 'SPA', 'SPS'];

export function getExpectedCanonicalSlots(gradeLevel: number, programType: ProgramType): CatalogSlot[] {
	const isSpecial = programType !== 'REGULAR';
	const base = gradeLevel <= 8 ? GRADE_7_8_REGULAR : GRADE_9_10_REGULAR;
	const expanded = gradeLevel <= 8 ? GRADE_7_8_SPECIAL : GRADE_9_10_SPECIAL;
	return (isSpecial ? expanded : base).map((slot) => ({
		...slot,
		gradeLevel,
		programType,
	}));
}

export function validateCanonicalTemplateRows(
	rows: Array<Pick<ClassProgramSlotRow, 'gradeLevel' | 'programType' | 'startTime' | 'endTime' | 'rowKind'>>,
	gradeLevel: number,
	programType: ProgramType,
): string[] {
	const expected = getExpectedCanonicalSlots(gradeLevel, programType);
	const actualKeys = new Set(rows.map((row) => `${row.startTime}-${row.endTime}-${row.rowKind}`));
	const expectedKeys = new Set(expected.map((row) => `${row.startTime}-${row.endTime}-${row.rowKind}`));
	const issues: string[] = [];
	for (const key of expectedKeys) if (!actualKeys.has(key)) issues.push(`missing:${key}`);
	for (const key of actualKeys) if (!expectedKeys.has(key)) issues.push(`unexpected:${key}`);
	for (const row of rows) {
		const duration = toMinutes(row.endTime) - toMinutes(row.startTime);
		if (row.rowKind === 'CLASS' && duration !== 45) issues.push(`invalid-class-duration:${row.startTime}-${row.endTime}`);
	}
	return issues.sort();
}

function toMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

export interface CanonicalTemplateCoverage {
	gradeLevel: number;
	programType: ProgramType;
	classRowCount: number;
	rowCount: number;
	issues: string[];
}

// ─── Seed Function ───

/**
 * Seed canonical class-program slots for a school/year.
 * Seeds only missing exact grade/program groups and never overwrites existing rows.
 */
export async function seedClassProgramSlots(
	schoolId: number,
	schoolYearId: number,
): Promise<{ seeded: number }> {
	const existing = await prisma.classProgramSlot.findMany({
		where: { schoolId, schoolYearId },
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true },
	});
	const existingGroups = new Set(existing.map((row) => `${row.gradeLevel}:${row.programType ?? 'NULL'}`));
	const rows: Array<{
		schoolId: number;
		schoolYearId: number;
		gradeLevel: number;
		programType: ProgramType | null;
		dayOfWeek: string | null;
		startTime: string;
		endTime: string;
		rowKind: ClassProgramSlotKind;
		subjectFamily: string | null;
		subjectLabel: string | null;
		sourceLabel: string;
		sourceNote: string | null;
		isActive: boolean;
	}> = [];

	for (const gradeLevel of [7, 8, 9, 10]) {
		for (const programType of KNOWN_PROGRAM_TYPES) {
			if (existingGroups.has(`${gradeLevel}:${programType}`)) continue;
			for (const slot of getExpectedCanonicalSlots(gradeLevel, programType)) {
				rows.push({ ...slot, schoolId, schoolYearId, isActive: true });
			}
		}
	}

	if (rows.length > 0) await prisma.classProgramSlot.createMany({ data: rows, skipDuplicates: true });

	return { seeded: rows.length };
}

export async function ensureCanonicalClassProgramSlots(
	schoolId: number,
	schoolYearId: number,
): Promise<{ seeded: number; coverage: CanonicalTemplateCoverage[] }> {
	const seeded = await seedClassProgramSlots(schoolId, schoolYearId);
	const rows = await prisma.classProgramSlot.findMany({
		where: { schoolId, schoolYearId, isActive: true },
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true },
	});
	const coverage = [7, 8, 9, 10].flatMap((gradeLevel) => KNOWN_PROGRAM_TYPES.map((programType) => {
		const matching = rows.filter((row) => row.gradeLevel === gradeLevel && row.programType === programType);
		return {
			gradeLevel,
			programType,
			classRowCount: matching.filter((row) => row.rowKind === 'CLASS').length,
			rowCount: matching.length,
			issues: validateCanonicalTemplateRows(matching, gradeLevel, programType),
		};
	}));
	return { seeded: seeded.seeded, coverage };
}

// ─── Resolver ───

/**
 * Resolve canonical class-program slots for a given school/year/grade/program.
 *
 * Resolution strategy:
 * 1. Exact grade + program match
 * 2. Exact grade + null program (all-program fallback)
 * 3. Never fall back across grade levels
 *
 * Returns rows ordered by day of week (Mon-Fri) then start time.
 * Break and conflict rows are included but marked with their rowKind.
 */
export async function resolveClassProgramSlots(
	schoolId: number,
	schoolYearId: number,
	gradeLevel: number,
	programType?: ProgramType | null,
): Promise<ResolvedSlotRow[]> {
	// Try exact grade + program first
	const exactRows = await prisma.classProgramSlot.findMany({
		where: {
			schoolId,
			schoolYearId,
			gradeLevel,
			programType: programType ?? null,
			isActive: true,
		},
		orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
	});

	if (exactRows.length > 0) {
		return exactRows.map(r => ({ ...r, isExactMatch: true }));
	}

	// Only unknown program types may use the grade-wide generic fallback. Known
	// programs must have their own exact contract so they cannot silently lose
	// their additional or restricted capacity.
	if (programType != null && !KNOWN_PROGRAM_TYPES.includes(programType)) {
		const fallbackRows = await prisma.classProgramSlot.findMany({
			where: {
				schoolId,
				schoolYearId,
				gradeLevel,
				programType: null,
				isActive: true,
			},
			orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
		});

		if (fallbackRows.length > 0) {
			return fallbackRows.map(r => ({ ...r, isExactMatch: false }));
		}
	}

	// No slots found
	return [];
}

/** Resolve and de-duplicate the exact templates used by a mixed-program grade output. */
export async function resolveCanonicalSlotsForPrograms(
	schoolId: number,
	schoolYearId: number,
	gradeLevel: number,
	programTypes: Array<ProgramType | null | undefined> = KNOWN_PROGRAM_TYPES,
): Promise<ResolvedSlotRow[]> {
	const rows = await Promise.all(
		[...new Set(programTypes.map((programType) => programType ?? 'REGULAR'))].map((programType) =>
			resolveClassProgramSlots(schoolId, schoolYearId, gradeLevel, programType as ProgramType),
		),
	);
	const deduped = new Map<string, ResolvedSlotRow>();
	for (const group of rows) {
		for (const row of group) {
			const key = `${row.startTime}-${row.endTime}-${row.rowKind}-${row.subjectLabel ?? ''}`;
			if (!deduped.has(key)) deduped.set(key, row);
		}
	}
	return [...deduped.values()].sort((left, right) => {
		const startDiff = toMinutes(left.startTime) - toMinutes(right.startTime);
		return startDiff !== 0 ? startDiff : toMinutes(left.endTime) - toMinutes(right.endTime);
	});
}

/**
 * Get only schedulable class rows (excludes BREAK and CONFLICT).
 */
export async function resolveSchedulableSlots(
	schoolId: number,
	schoolYearId: number,
	gradeLevel: number,
	programType?: ProgramType | null,
): Promise<ResolvedSlotRow[]> {
	const all = await resolveClassProgramSlots(schoolId, schoolYearId, gradeLevel, programType);
	return all.filter(r => r.rowKind === 'CLASS');
}

/**
 * Get warning rows (CONFLICT kind).
 */
export async function resolveConflictSlots(
	schoolId: number,
	schoolYearId: number,
	gradeLevel: number,
	programType?: ProgramType | null,
): Promise<ResolvedSlotRow[]> {
	const all = await resolveClassProgramSlots(schoolId, schoolYearId, gradeLevel, programType);
	return all.filter(r => r.rowKind === 'CONFLICT');
}
