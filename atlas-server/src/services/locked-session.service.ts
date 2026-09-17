/**
 * Locked-session service — CRUD for pre-generation pinned schedule entries.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import { buildCanonicalDisplayGrid, buildPeriodSlots, type PeriodSlot, type PolicyInput } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

/**
 * SLOT-BREAK-AUTHORITY-C11R — the persisted canonical `classProgramSlot` rows
 * for the school/year. Only the fields the display authority consumes are read.
 */
async function loadCanonicalDisplayRows(schoolId: number, schoolYearId: number) {
	return prisma.classProgramSlot.findMany({
		where: { schoolId, schoolYearId, isActive: true },
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true, subjectLabel: true, dayOfWeek: true },
		orderBy: [{ gradeLevel: 'asc' }, { startTime: 'asc' }],
	});
}

/**
 * SLOT-BREAK-AUTHORITY-C11R — the canonical `(gradeLevel, programType)` scope a
 * lock's section belongs to. The section roster keys sections by their EnrollPro
 * `externalId` (the same key the generation/pre-generation entry sets use), and
 * `displayOrder` is the actual grade number the canonical grid is keyed by.
 * Returns `null` when the section is unknown, so the caller keeps the
 * school-wide canonical union rather than coercing a missing scope.
 */
async function resolveSectionCanonicalScope(
	schoolId: number,
	schoolYearId: number,
	sectionId: number,
): Promise<{ gradeLevel: number; programType: string | null } | null> {
	const section = await prisma.sectionMirror.findFirst({
		where: { schoolId, schoolYearId, externalId: sectionId },
		select: { displayOrder: true, gradeLevelId: true, programType: true },
	});
	if (!section) return null;
	return {
		gradeLevel: Number(section.displayOrder ?? section.gradeLevelId ?? 0),
		programType: section.programType ?? null,
	};
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

	// Validate time slot matches a canonical period slot. The canonical
	// `classProgramSlot` grid owns the slot set for the lock's section scope;
	// the policy path remains the fallback for a scope with no canonical rows.
	const sectionScope = await resolveSectionCanonicalScope(schoolId, schoolYearId, input.sectionId);
	const effectiveSlots = await getEffectivePeriodSlots(schoolId, schoolYearId, sectionScope);
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

export async function getEffectivePeriodSlots(
	schoolId: number,
	schoolYearId: number,
	scope?: { gradeLevel: number; programType: string | null } | null,
): Promise<PeriodSlot[]> {
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
		enableLunchWindow: policyRecord.enableLunchWindow ?? undefined,
	};
	// SLOT-BREAK-AUTHORITY-C11R: a scope that HAS canonical `classProgramSlot`
	// rows derives its period grid from them. `scope` absent resolves the honest
	// union of every canonical scope present (never a coerced single scope). The
	// policy path below is only the fallback for scopes with no canonical rows.
	const canonicalRows = await loadCanonicalDisplayRows(schoolId, schoolYearId);
	if (canonicalRows.length === 0) {
		return buildPeriodSlots(policyInput);
	}
	const grid = buildCanonicalDisplayGrid({
		rows: canonicalRows,
		scopes: scope ? [scope] : null,
		policy: policyInput,
	});
	return grid.periodSlots;
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
