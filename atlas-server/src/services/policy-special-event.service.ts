/**
 * Policy special-event service — shift-specific break/event CRUD and effective-event resolution.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import { VALID_EVENT_TYPES, VALID_GRADE_GROUPS, getEffectiveEvents, type GradeGroup, type SpecialEventType, type SpecialEventRowLike, type EffectiveSpecialEvent } from '../lib/policy-special-events.js';

// Re-export types from the pure module
export { VALID_EVENT_TYPES, VALID_GRADE_GROUPS, getEffectiveEvents };
export type { GradeGroup, SpecialEventType, EffectiveSpecialEvent };

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

// ─── Types ───

export interface SpecialEventInput {
	eventType: SpecialEventType;
	label: string;
	gradeGroup?: GradeGroup | null;
	programType?: string | null;
	startTime: string;
	endTime: string;
	enabled?: boolean;
	sortOrder?: number;
}

export interface SpecialEventRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	eventType: string;
	label: string;
	gradeGroup: string | null;
	programType: string | null;
	startTime: string;
	endTime: string;
	enabled: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

// ─── Validation ───

/** Values that mean "no specific program" and should be stored as null. */
const DEFAULT_PROGRAM_ALIASES = new Set(['', 'REGULAR', 'REG', 'DEFAULT', 'ALL']);

/**
 * Canonicalize programType: trim whitespace, uppercase, map default/empty to null.
 * This prevents duplicate effective scopes caused by casing or whitespace differences.
 */
export function normalizeProgramType(raw: string | null | undefined): string | null {
	if (raw == null) return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	const upper = trimmed.toUpperCase();
	if (DEFAULT_PROGRAM_ALIASES.has(upper)) return null;
	return upper;
}

function validateInput(input: SpecialEventInput): void {
	if (!VALID_EVENT_TYPES.includes(input.eventType)) {
		throw err(400, 'INVALID_EVENT_TYPE', `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
	}
	if (!input.label || input.label.trim().length === 0) {
		throw err(400, 'MISSING_LABEL', 'label is required.');
	}
	if (input.label.length > 120) {
		throw err(400, 'LABEL_TOO_LONG', 'label must be 120 characters or fewer.');
	}
	if (input.gradeGroup != null && !VALID_GRADE_GROUPS.includes(input.gradeGroup as GradeGroup)) {
		throw err(400, 'INVALID_GRADE_GROUP', `gradeGroup must be one of: ${VALID_GRADE_GROUPS.join(', ')} or null.`);
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
}

// ─── CRUD ───

export async function listSpecialEvents(schoolId: number, schoolYearId: number): Promise<SpecialEventRow[]> {
	return prisma.policySpecialEvent.findMany({
		where: { schoolId, schoolYearId },
		orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }, { gradeGroup: 'asc' }],
	});
}

export async function upsertSpecialEvent(
	schoolId: number,
	schoolYearId: number,
	input: SpecialEventInput,
): Promise<SpecialEventRow> {
	validateInput(input);

	const programType = normalizeProgramType(input.programType);
	const gradeGroup = input.gradeGroup ?? null;

	const existing = await prisma.policySpecialEvent.findFirst({
		where: {
			schoolId,
			schoolYearId,
			eventType: input.eventType,
			gradeGroup,
			programType,
		},
	});

	if (existing) {
		return prisma.policySpecialEvent.update({
			where: { id: existing.id },
			data: {
				label: input.label.trim(),
				startTime: input.startTime,
				endTime: input.endTime,
				enabled: input.enabled ?? true,
				sortOrder: input.sortOrder ?? 0,
			},
		});
	}

	return prisma.policySpecialEvent.create({
		data: {
			schoolId,
			schoolYearId,
			eventType: input.eventType,
			label: input.label.trim(),
			gradeGroup,
			programType,
			startTime: input.startTime,
			endTime: input.endTime,
			enabled: input.enabled ?? true,
			sortOrder: input.sortOrder ?? 0,
		},
	});
}

export async function upsertSpecialEvents(
	schoolId: number,
	schoolYearId: number,
	events: SpecialEventInput[],
): Promise<SpecialEventRow[]> {
	const results: SpecialEventRow[] = [];
	for (const event of events) {
		results.push(await upsertSpecialEvent(schoolId, schoolYearId, event));
	}
	return results;
}

export async function deleteSpecialEvent(schoolId: number, schoolYearId: number, eventId: number): Promise<void> {
	const existing = await prisma.policySpecialEvent.findFirst({
		where: { id: eventId, schoolId, schoolYearId },
	});
	if (!existing) {
		throw err(404, 'EVENT_NOT_FOUND', `Special event ${eventId} not found for this school/year.`);
	}
	await prisma.policySpecialEvent.delete({ where: { id: eventId } });
}

export async function deleteSpecialEventsByType(
	schoolId: number,
	schoolYearId: number,
	eventType: SpecialEventType,
): Promise<number> {
	const result = await prisma.policySpecialEvent.deleteMany({
		where: { schoolId, schoolYearId, eventType },
	});
	return result.count;
}

// ─── Effective Event Resolution ───

// Re-exported from lib/policy-special-events.ts via the top-level export.

/**
 * Seed default shift-specific events for the real 2026-2027 baseline.
 * Checks the full scope key (eventType + gradeGroup + programType) so missing
 * grade-group counterparts are created even if another row of the same eventType exists.
 */
export async function seedShiftBaseline(schoolId: number, schoolYearId: number): Promise<SpecialEventRow[]> {
	const defaults: SpecialEventInput[] = [
		{ eventType: 'HEALTH_BREAK', label: 'Day Shift Health Break', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15', sortOrder: 1 },
		{ eventType: 'LUNCH_BREAK', label: 'Day Shift Lunch Break', gradeGroup: '7-8', startTime: '12:15', endTime: '13:00', sortOrder: 2 },
		{ eventType: 'LUNCH_BREAK', label: 'Afternoon Shift Lunch Break', gradeGroup: '9-10', startTime: '12:15', endTime: '13:00', sortOrder: 3 },
		{ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health Break', gradeGroup: '9-10', startTime: '15:15', endTime: '15:30', sortOrder: 4 },
	];

	const existing = await prisma.policySpecialEvent.findMany({
		where: { schoolId, schoolYearId },
		select: { eventType: true, gradeGroup: true, programType: true },
	});
	const existingScopeKeys = new Set(
		existing.map((e) => `${e.eventType}:${e.gradeGroup ?? ''}:${e.programType ?? ''}`),
	);

	const toSeed = defaults.filter((d) => {
		const scopeKey = `${d.eventType}:${d.gradeGroup ?? ''}:${d.programType ?? ''}`;
		return !existingScopeKeys.has(scopeKey);
	});

	if (toSeed.length === 0) {
		return listSpecialEvents(schoolId, schoolYearId);
	}

	return upsertSpecialEvents(schoolId, schoolYearId, toSeed);
}
