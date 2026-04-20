/**
 * Locked-session service — CRUD for pre-generation pinned schedule entries.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import { buildPeriodSlots, type PeriodSlot, type PolicyInput } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

// ─── Types ───

export interface LockedSessionInput {
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
}

export interface LockedSessionRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	createdBy: number;
	createdAt: Date;
}

// ─── List ───

export async function listLocks(schoolId: number, schoolYearId: number): Promise<LockedSessionRow[]> {
	return prisma.lockedSession.findMany({
		where: { schoolId, schoolYearId },
		orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
	});
}

// ─── Create ───

export async function createLock(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	input: LockedSessionInput,
): Promise<LockedSessionRow> {
	// Basic validation
	const validDays = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	if (!validDays.has(input.day)) {
		throw err(400, 'INVALID_DAY', `Day must be one of: ${[...validDays].join(', ')}`);
	}
	if (!input.sectionId || !input.subjectId) {
		throw err(400, 'MISSING_FIELDS', 'sectionId and subjectId are required.');
	}
	if (!input.startTime || !input.endTime) {
		throw err(400, 'MISSING_FIELDS', 'startTime and endTime are required.');
	}
	if (!Number.isInteger(input.facultyId) || input.facultyId < 1) {
		throw err(400, 'MISSING_FIELDS', 'facultyId is required and must be a positive integer. Locks must specify an explicit faculty assignment.');
	}
	if (!Number.isInteger(input.roomId) || input.roomId < 1) {
		throw err(400, 'MISSING_FIELDS', 'roomId is required and must be a positive integer. Locks must specify an explicit room assignment.');
	}

	// Validate time slot matches a canonical period slot
	const effectiveSlots = await getEffectivePeriodSlots(schoolId, schoolYearId);
	const slotMatch = effectiveSlots.find((s) => s.startTime === input.startTime && s.endTime === input.endTime);
	if (!slotMatch) {
		const valid = effectiveSlots.map((s) => `${s.startTime}-${s.endTime}`).join(', ');
		throw err(400, 'INVALID_TIME_SLOT', `Time slot ${input.startTime}-${input.endTime} does not match any canonical period slot. Valid slots: ${valid}`);
	}

	// Conflict check: same section at same time slot
	const existing = await prisma.lockedSession.findFirst({
		where: {
			schoolId,
			schoolYearId,
			sectionId: input.sectionId,
			day: input.day as any,
			startTime: input.startTime,
		},
	});
	if (existing) {
		throw err(409, 'LOCK_CONFLICT', `A lock already exists for this section at ${input.day} ${input.startTime}. Remove it first.`);
	}

	return prisma.lockedSession.create({
		data: {
			schoolId,
			schoolYearId,
			sectionId: input.sectionId,
			subjectId: input.subjectId,
			facultyId: input.facultyId,
			roomId: input.roomId,
			day: input.day as any,
			startTime: input.startTime,
			endTime: input.endTime,
			createdBy: actorId,
		},
	});
}

// ─── Delete ───

// ─── Get effective period slots ───

export async function getEffectivePeriodSlots(schoolId: number, schoolYearId: number): Promise<PeriodSlot[]> {
	const policyRecord = await getOrCreatePolicy(schoolId, schoolYearId);
	const policyInput: PolicyInput = {
		maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
		earliestStartTime: policyRecord.earliestStartTime,
		latestEndTime: policyRecord.latestEndTime,
		lunchStartTime: policyRecord.lunchStartTime ?? undefined,
		lunchEndTime: policyRecord.lunchEndTime ?? undefined,
		enforceLunchWindow: policyRecord.enforceLunchWindow ?? undefined,
	};
	return buildPeriodSlots(policyInput);
}

// ─── Delete ───

export async function deleteLock(lockId: number, schoolId: number, schoolYearId: number): Promise<void> {
	const lock = await prisma.lockedSession.findFirst({
		where: { id: lockId, schoolId, schoolYearId },
	});
	if (!lock) {
		throw err(404, 'LOCK_NOT_FOUND', 'Locked session not found in this school/year scope.');
	}
	await prisma.lockedSession.delete({ where: { id: lockId } });
}
