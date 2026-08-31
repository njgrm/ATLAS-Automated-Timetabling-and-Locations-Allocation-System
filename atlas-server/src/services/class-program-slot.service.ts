/**
 * Class Program Slot Service
 *
 * Manages canonical class-program slot templates that define
 * subject-by-timeslot assignments for grade/program-specific scheduling.
 *
 * These slots represent the stakeholder class-program template contract
 * and are used by generation to prefer specific time rows for specific
 * subjects in specific grade/program contexts.
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
 *
 * Use this function when you have an internal EnrollPro ID.
 */
export function normalizeInternalGradeId(gradeLevelId: number): number {
	const KNOWN_MAPPINGS: Record<number, number> = {
		5: 7,  // grade_level_id 5 -> Grade 7
		6: 8,  // grade_level_id 6 -> Grade 8
		7: 9,  // grade_level_id 7 -> Grade 9
		8: 10, // grade_level_id 8 -> Grade 10
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

// ─── Grade 9/10 Afternoon Template (from stakeholder DOCX) ───

const GRADE_9_10_AFTERNOON_SLOTS: Array<Omit<ClassProgramSlotRow, 'id' | 'schoolId' | 'schoolYearId' | 'isActive'>> = [
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '09:45', endTime: '10:30', rowKind: 'CLASS', subjectFamily: 'ARAL', subjectLabel: 'ARAL/Reading', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'ARAL/Reading row from bottom table' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '10:30', endTime: '11:15', rowKind: 'CLASS', subjectFamily: 'SPECIALIZATION', subjectLabel: 'Specialization', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Specialization row 1' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '11:15', endTime: '12:00', rowKind: 'CLASS', subjectFamily: 'SPECIALIZATION', subjectLabel: 'Specialization', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Specialization row 2 (corrected to 45 min)' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '12:15', endTime: '13:00', rowKind: 'BREAK', subjectFamily: null, subjectLabel: 'Lunch Break', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Lunch break — blocked' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '12:15', endTime: '13:00', rowKind: 'CONFLICT', subjectFamily: null, subjectLabel: 'Flag Ceremony/HGP/TLE', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Duplicate row — conflicts with lunch, non-schedulable until Product decision' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '13:00', endTime: '13:45', rowKind: 'CLASS', subjectFamily: 'SCIENCE', subjectLabel: 'Science', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Science row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '13:45', endTime: '14:30', rowKind: 'CLASS', subjectFamily: 'FILIPINO', subjectLabel: 'Filipino', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Filipino row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '14:30', endTime: '15:15', rowKind: 'CLASS', subjectFamily: 'MATHEMATICS', subjectLabel: 'Mathematics', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Mathematics row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '15:15', endTime: '15:30', rowKind: 'BREAK', subjectFamily: null, subjectLabel: 'Health Break', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Health break — 15 min' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '15:30', endTime: '16:15', rowKind: 'CLASS', subjectFamily: 'ENGLISH', subjectLabel: 'English', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'English row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '16:15', endTime: '17:00', rowKind: 'CLASS', subjectFamily: 'AP', subjectLabel: 'AP', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Araling Panlipunan row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '17:00', endTime: '17:45', rowKind: 'CLASS', subjectFamily: 'MAPEH', subjectLabel: 'MAPEH', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'MAPEH row' },
	{ gradeLevel: 9, programType: null, dayOfWeek: null, startTime: '17:45', endTime: '18:30', rowKind: 'CLASS', subjectFamily: 'ESP', subjectLabel: 'VE/ESP', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Values Education / EsP row' },
];

// ─── Grade 7/8 Morning Template (from stakeholder DOCX) ───

const GRADE_7_8_MORNING_SLOTS: Array<Omit<ClassProgramSlotRow, 'id' | 'schoolId' | 'schoolYearId' | 'isActive'>> = [
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 1' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 2' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '07:30', endTime: '08:15', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 3' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '08:15', endTime: '09:00', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 4' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '09:00', endTime: '09:15', rowKind: 'BREAK', subjectFamily: null, subjectLabel: 'Health Break', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Health break — 15 min' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '09:15', endTime: '10:00', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 5' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '10:00', endTime: '10:45', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 6' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '10:45', endTime: '11:30', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 7' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '11:30', endTime: '12:15', rowKind: 'CLASS', subjectFamily: null, subjectLabel: 'Class', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Morning class row 8' },
	{ gradeLevel: 7, programType: null, dayOfWeek: null, startTime: '12:15', endTime: '13:00', rowKind: 'BREAK', subjectFamily: null, subjectLabel: 'Lunch Break', sourceLabel: 'STAKEHOLDER_DOCX', sourceNote: 'Lunch break — 45 min' },
];

// ─── Seed Function ───

/**
 * Seed canonical class-program slots for a school/year.
 * Only seeds if no slots exist for the given school/year yet.
 */
export async function seedClassProgramSlots(
	schoolId: number,
	schoolYearId: number,
): Promise<{ seeded: number }> {
	const existing = await prisma.classProgramSlot.count({
		where: { schoolId, schoolYearId },
	});

	if (existing > 0) {
		return { seeded: 0 };
	}

	// Seed Grade 9 and Grade 10 afternoon slots
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

	// Grade 9 and 10 afternoon slots
	for (const slot of GRADE_9_10_AFTERNOON_SLOTS) {
		rows.push({ ...slot, schoolId, schoolYearId, gradeLevel: 9, isActive: true });
		rows.push({ ...slot, schoolId, schoolYearId, gradeLevel: 10, isActive: true });
	}

	// Grade 7 and 8 morning slots
	for (const slot of GRADE_7_8_MORNING_SLOTS) {
		rows.push({ ...slot, schoolId, schoolYearId, gradeLevel: 7, isActive: true });
		rows.push({ ...slot, schoolId, schoolYearId, gradeLevel: 8, isActive: true });
	}

	await prisma.classProgramSlot.createMany({ data: rows });

	return { seeded: rows.length };
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

	// Fallback to grade + null program (all-program)
	if (programType != null) {
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
