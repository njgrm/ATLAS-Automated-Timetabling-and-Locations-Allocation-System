/**
 * Grade shift window service — time window restrictions per grade band.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

// ─── Types ───

export interface GradeWindowInput {
	gradeLevel: number;
	startTime: string;
	endTime: string;
}

export interface GradeWindowRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	startTime: string;
	endTime: string;
	createdAt: Date;
	updatedAt: Date;
}

// ─── List ───

export async function listGradeWindows(schoolId: number, schoolYearId: number): Promise<GradeWindowRow[]> {
	return prisma.gradeShiftWindow.findMany({
		where: { schoolId, schoolYearId },
		orderBy: { gradeLevel: 'asc' },
	});
}

// ─── Upsert ───

export async function upsertGradeWindow(
	schoolId: number,
	schoolYearId: number,
	input: GradeWindowInput,
): Promise<GradeWindowRow> {
	if (![7, 8, 9, 10].includes(input.gradeLevel)) {
		throw err(400, 'INVALID_GRADE', 'Grade level must be 7, 8, 9, or 10.');
	}
	if (!input.startTime || !input.endTime) {
		throw err(400, 'MISSING_FIELDS', 'startTime and endTime are required.');
	}

	return prisma.gradeShiftWindow.upsert({
		where: {
			schoolId_schoolYearId_gradeLevel: {
				schoolId,
				schoolYearId,
				gradeLevel: input.gradeLevel,
			},
		},
		update: {
			startTime: input.startTime,
			endTime: input.endTime,
		},
		create: {
			schoolId,
			schoolYearId,
			gradeLevel: input.gradeLevel,
			startTime: input.startTime,
			endTime: input.endTime,
		},
	});
}

// ─── Batch upsert (for updating all windows at once) ───

export async function upsertGradeWindows(
	schoolId: number,
	schoolYearId: number,
	windows: GradeWindowInput[],
): Promise<GradeWindowRow[]> {
	const results: GradeWindowRow[] = [];
	for (const w of windows) {
		results.push(await upsertGradeWindow(schoolId, schoolYearId, w));
	}
	return results;
}

// ─── Delete ───

export async function deleteGradeWindow(schoolId: number, schoolYearId: number, gradeLevel: number): Promise<void> {
	const existing = await prisma.gradeShiftWindow.findFirst({
		where: { schoolId, schoolYearId, gradeLevel },
	});
	if (!existing) {
		throw err(404, 'WINDOW_NOT_FOUND', `No grade shift window found for grade ${gradeLevel}.`);
	}
	await prisma.gradeShiftWindow.delete({ where: { id: existing.id } });
}
