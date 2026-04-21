/**
 * Locked-session service — CRUD for pre-generation pinned schedule entries.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { buildPeriodSlots } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
// ─── List ───
export async function listLocks(schoolId, schoolYearId) {
    return prisma.lockedSession.findMany({
        where: { schoolId, schoolYearId },
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });
}
// ─── Create ───
export async function createLock(schoolId, schoolYearId, actorId, input) {
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
            day: input.day,
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
            day: input.day,
            startTime: input.startTime,
            endTime: input.endTime,
            createdBy: actorId,
        },
    });
}
// ─── Delete ───
// ─── Get effective period slots ───
export async function getEffectivePeriodSlots(schoolId, schoolYearId) {
    const policyRecord = await getOrCreatePolicy(schoolId, schoolYearId);
    const policyInput = {
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
export async function deleteLock(lockId, schoolId, schoolYearId) {
    const lock = await prisma.lockedSession.findFirst({
        where: { id: lockId, schoolId, schoolYearId },
    });
    if (!lock) {
        throw err(404, 'LOCK_NOT_FOUND', 'Locked session not found in this school/year scope.');
    }
    await prisma.lockedSession.delete({ where: { id: lockId } });
}
//# sourceMappingURL=locked-session.service.js.map