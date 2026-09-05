/**
 * Grade shift window service — time window restrictions per grade band.
 * Business logic only; no transport concerns.
 */

import { getDataContext } from '../lib/data-context.js';
import type { ProgramType } from '@prisma/client';

const db = () => getDataContext();

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

function isValidTime(value: string): boolean {
	return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function timeToMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

const PHASE3_DEFAULT_WINDOWS: Array<GradeWindowInput> = [
	{ gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 8, programType: null, startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 10, programType: null, startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 7, programType: 'STE', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 8, programType: 'STE', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 9, programType: 'STE', startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 10, programType: 'STE', startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 7, programType: 'SPA', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 8, programType: 'SPA', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 9, programType: 'SPA', startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 10, programType: 'SPA', startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 7, programType: 'SPS', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 8, programType: 'SPS', startTime: '06:00', endTime: '15:30' },
	{ gradeLevel: 9, programType: 'SPS', startTime: '09:45', endTime: '18:30' },
	{ gradeLevel: 10, programType: 'SPS', startTime: '09:45', endTime: '18:30' },
];

async function validateAgainstPolicyBounds(
	schoolId: number,
	schoolYearId: number,
	input: GradeWindowInput,
): Promise<void> {
	const policy = await db().schedulingPolicy.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		select: { earliestStartTime: true, latestEndTime: true },
	});
	if (!policy) return;

	const windowStart = timeToMinutes(input.startTime);
	const windowEnd = timeToMinutes(input.endTime);
	const policyStart = timeToMinutes(policy.earliestStartTime);
	const policyEnd = timeToMinutes(policy.latestEndTime);

	if (windowStart < policyStart || windowEnd > policyEnd) {
		throw err(
			400,
			'WINDOW_OUT_OF_POLICY_BOUNDS',
			`Grade ${input.gradeLevel}${input.programType ? ` / ${input.programType}` : ''} shift window must stay within the scheduling policy bounds (${policy.earliestStartTime} - ${policy.latestEndTime}).`,
		);
	}
}

// ─── Types ───

export interface GradeWindowInput {
	gradeLevel: number;
	programType?: ProgramType | null;
	startTime: string;
	endTime: string;
}

export interface GradeWindowRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	gradeLevel: number;
	programType?: ProgramType | null;
	startTime: string;
	endTime: string;
	createdAt: Date;
	updatedAt: Date;
}

// ─── List ───

export async function listGradeWindows(schoolId: number, schoolYearId: number): Promise<GradeWindowRow[]> {
	return db().gradeShiftWindow.findMany({
		where: { schoolId, schoolYearId },
		orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
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
	if (input.programType != null && !['REGULAR', 'STE', 'SPS', 'SPA', 'SPJ', 'SPFL', 'SPTVE', 'OTHER'].includes(input.programType)) {
		throw err(400, 'INVALID_PROGRAM', 'programType must be a valid program type when provided.');
	}
	if (!input.startTime || !input.endTime) {
		throw err(400, 'MISSING_FIELDS', 'startTime and endTime are required.');
	}
	if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
		throw err(400, 'INVALID_TIME_FORMAT', 'startTime and endTime must use HH:mm format.');
	}
	if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
		throw err(400, 'INVALID_TIME_RANGE', 'startTime must be earlier than endTime.');
	}
	await validateAgainstPolicyBounds(schoolId, schoolYearId, input);

	if (input.programType == null) {
		const existing = await db().gradeShiftWindow.findFirst({
			where: {
				schoolId,
				schoolYearId,
				gradeLevel: input.gradeLevel,
				programType: null,
			},
			select: { id: true },
		});

		if (existing) {
			return db().gradeShiftWindow.update({
				where: { id: existing.id },
				data: {
					startTime: input.startTime,
					endTime: input.endTime,
					programType: null,
				},
			});
		}

		return db().gradeShiftWindow.create({
			data: {
				schoolId,
				schoolYearId,
				gradeLevel: input.gradeLevel,
				programType: null,
				startTime: input.startTime,
				endTime: input.endTime,
			},
		});
	}

	return db().gradeShiftWindow.upsert({
		where: {
			schoolId_schoolYearId_gradeLevel_programType: {
				schoolId,
				schoolYearId,
				gradeLevel: input.gradeLevel,
				programType: input.programType ?? null,
			},
		},
		update: {
			programType: input.programType ?? null,
			startTime: input.startTime,
			endTime: input.endTime,
		},
		create: {
			schoolId,
			schoolYearId,
			gradeLevel: input.gradeLevel,
			programType: input.programType ?? null,
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

const LEGACY_DEFAULT_START = '07:30';
const LEGACY_DEFAULT_END = '17:00';

export async function ensurePhase3GradeWindows(schoolId: number, schoolYearId: number): Promise<GradeWindowRow[]> {
	const ensured: GradeWindowRow[] = [];
	for (const window of PHASE3_DEFAULT_WINDOWS) {
		const existing = await db().gradeShiftWindow.findFirst({
			where: {
				schoolId,
				schoolYearId,
				gradeLevel: window.gradeLevel,
				programType: window.programType ?? null,
			},
		});

		if (existing) {
			const isLegacyDefault = existing.startTime === LEGACY_DEFAULT_START && existing.endTime === LEGACY_DEFAULT_END;
			if (isLegacyDefault) {
				const healed = await db().gradeShiftWindow.update({
					where: { id: existing.id },
					data: { startTime: window.startTime, endTime: window.endTime },
				});
				ensured.push(healed);
			} else {
				ensured.push(existing);
			}
			continue;
		}

		ensured.push(await upsertGradeWindow(schoolId, schoolYearId, window));
	}

	return ensured;
}

// ─── Delete ───

export async function deleteGradeWindow(schoolId: number, schoolYearId: number, gradeLevel: number): Promise<void> {
	const existing = await db().gradeShiftWindow.findFirst({
		where: { schoolId, schoolYearId, gradeLevel },
	});
	if (!existing) {
		throw err(404, 'WINDOW_NOT_FOUND', `No grade shift window found for grade ${gradeLevel}.`);
	}
	await db().gradeShiftWindow.delete({ where: { id: existing.id } });
}
